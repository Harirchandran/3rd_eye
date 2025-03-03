import sys
import time
import os
import cv2
import random
import dbconnection
import config
from supabase import create_client

SUPABASE_URL = "https://jxsurwtcxvznuqlgnxis.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c3Vyd3RjeHZ6bnVxbGdueGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDA3MjIsImV4cCI6MjA1NTIxNjcyMn0.vSYd0BZK3OgbPvxT1n0uwc_o0xyTuVp1IqdiBtdTdQA"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def main():
    print("Starting Capture Script...")
    sys.stdout.flush()
    time.sleep(2)
    
    cid = input("Enter Criminal ID (Unique CID): ").strip()
    if not cid:
        print("Criminal ID cannot be empty. Exiting.")
        return
    cid = cid.lower()  # Normalize CID to lowercase for consistency
    sys.stdout.flush()
    time.sleep(2)
    
    # Check if criminal exists using case-insensitive query
    try:
        criminal_found = dbconnection.fetch_criminal_by_cid(cid)
        if not criminal_found:
            print(f"Criminal with CID '{cid}' not found in database.")
            sys.stdout.flush()
            time.sleep(2)
            return
        else:
            print("Criminal found:")
            print(f"Name: {criminal_found.get('name')}")
            print(f"Age: {criminal_found.get('age')}")
            sys.stdout.flush()
            time.sleep(2)
            proceed = input("Proceed with photo capture for this criminal? (y/n): ").strip().lower()
            if proceed != 'y':
                print("Capture cancelled.")
                return
    except Exception as e:
        print(f"Error checking criminal: {e}")
        return

    # Ensure the trainingImages base directory exists
    os.makedirs("trainingImages", exist_ok=True)
    person_folder = os.path.join("trainingImages", cid)
    os.makedirs(person_folder, exist_ok=True)
    
    raw_faces = []
    print("Loading Haar cascade for face detection...")
    sys.stdout.flush()
    time.sleep(2)
    face_cascade = cv2.CascadeClassifier(config.HAARCASCADE_PATH)
    if face_cascade.empty():
        print("Failed to load Haar cascade. Exiting.")
        return
    
    print("Opening webcam...")
    sys.stdout.flush()
    time.sleep(2)
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam. Exiting.")
        return
    sys.stdout.flush()
    time.sleep(2)
    
    print("Setting camera resolution...")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    print("Warming up the camera...")
    sys.stdout.flush()
    for _ in range(30):
        ret, _ = cap.read()
        if not ret:
            continue
        time.sleep(0.05)
    print("Camera warm-up complete.")
    sys.stdout.flush()
    time.sleep(2)
    
    count = 0
    max_images = 1000
    print("Capturing images. Press 'q' to stop capture.")
    sys.stdout.flush()
    time.sleep(2)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to capture frame. Retrying...")
            continue
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(100, 100))
        if len(faces) > 0:
            faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
            (x, y, w, h) = faces[0]
            raw_face = frame[y:y+h, x:x+w].copy()
            raw_faces.append(raw_face)
            face_roi = cv2.resize(cv2.equalizeHist(gray[y:y+h, x:x+w]), (200, 200))
            image_path = os.path.join(person_folder, f"frame{count}.jpg")
            cv2.imwrite(image_path, face_roi)
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.putText(frame, f"Captured: {count}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)
            count += 1
        else:
            cv2.putText(frame, "No face detected", (10,30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
        
        cv2.imshow("Capture - Press 'q' to stop", frame)
        if cv2.waitKey(1) & 0xFF == ord('q') or count >= max_images:
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    # Instead of requiring 5 images, sample up to 5 images if available
    upload_count = min(5, len(raw_faces))
    if upload_count == 0:
        print("No images captured for upload.")
        return
    selected_raw = random.sample(raw_faces, upload_count)
    
    try:
        existing_files_response = supabase.storage.from_('criminal_photos').list("")
    except Exception as e:
        print("Error listing files in bucket:", e)
        existing_files_response = []
    existing_names = set()
    for file_obj in existing_files_response:
        name = file_obj.get("name")
        if name:
            existing_names.add(name)
    
    new_uploads = 0
    for i in range(1, upload_count + 1):
        file_name = f"{cid}_{i}.jpg"
        if file_name in existing_names:
            print(f"Photo {file_name} already exists.")
        else:
            if selected_raw:
                image_to_upload = selected_raw.pop(0)
                os.makedirs("temp", exist_ok=True)
                temp_path = os.path.join("temp", file_name)
                cv2.imwrite(temp_path, image_to_upload)
                try:
                    with open(temp_path, "rb") as f:
                        response = supabase.storage.from_('criminal_photos').upload(file_name, f, {"upsert": "false"})
                        try:
                            error_msg = response.get("error", None)
                        except Exception:
                            error_msg = None
                        if error_msg:
                            print(f"Error uploading {file_name}: {error_msg}")
                        else:
                            print(f"Uploaded {file_name} successfully.")
                            new_uploads += 1
                except Exception as upload_error:
                    print(f"Error during upload of {file_name}: {upload_error}")
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
            else:
                print(f"No image available to upload for {file_name}.")
    print("Upload process complete. Total new uploads:", new_uploads)
    sys.stdout.flush()
    time.sleep(2)

if __name__ == "__main__":
    main()
