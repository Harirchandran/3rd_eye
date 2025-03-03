import cv2
import dbconnection
import json
import os
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import threading
import config

# ThreadPoolExecutor for asynchronous logging
executor = ThreadPoolExecutor(max_workers=5)

# Threaded video stream class for smoother camera capture
class VideoStream:
    def __init__(self, src=0):
        self.cap = cv2.VideoCapture(src)
        if not self.cap.isOpened():
            raise Exception("Unable to access camera")
        self.stopped = False
        self.frame = None
        self.lock = threading.Lock()
    
    def start(self):
        threading.Thread(target=self.update, daemon=True).start()
        return self
    
    def update(self):
        while not self.stopped:
            ret, frame = self.cap.read()
            if not ret:
                continue
            with self.lock:
                self.frame = frame.copy()
            time.sleep(0.01)  # slight delay to reduce CPU usage
    
    def read(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None
    
    def stop(self):
        self.stopped = True
        self.cap.release()

def async_log_detection(cid, name):
    """Log detection asynchronously with local timestamp."""
    try:
        timestamp = datetime.now().isoformat()
        # Ensure that dbconnection.log_criminal_detection is updated to accept a timestamp parameter.
        dbconnection.log_criminal_detection(cid, name, timestamp=timestamp)
    except Exception as e:
        print("Error logging criminal detection:", e)

def recognize_faces():
    print("Initializing real-time face recognition system...")
    print("Analyzing model, loading data, and preparing resources. Please wait...")
    if not os.path.exists("trainer.yml"):
        print("No trained model found! Please train the model first (run trainer.py).")
        return

    recognizer = cv2.face.LBPHFaceRecognizer_create(radius=2, neighbors=8, grid_x=8, grid_y=8)
    try:
        recognizer.read("trainer.yml")
    except Exception as e:
        print("Error loading model:", e)
        return

    # Calculate dynamic threshold; fall back to 120 if recognizer doesn't provide one.
    try:
        default_threshold = recognizer.getThreshold()
    except AttributeError:
        default_threshold = 120
    recognition_threshold = default_threshold * 0.8  # Example adjustment

    face_cascade = cv2.CascadeClassifier(config.HAARCASCADE_PATH)
    try:
        with open("label_map.json", "r") as f:
            label_map = json.load(f)
    except Exception as e:
        print("Error loading label map:", e)
        label_map = {}

    # Start the threaded video stream
    try:
        vs = VideoStream(src=0).start()
    except Exception as e:
        print("Error starting video stream:", e)
        return

    # Warm-up routine
    print("Warming up the camera...")
    time.sleep(1)

    print("Starting real-time face recognition...")
    cooldown_period = 10  # seconds before re-logging the same person
    last_logged = {}

    while True:
        frame = vs.read()
        if frame is None:
            continue
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(100, 100))
        
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            face_roi = cv2.resize(face_roi, (200, 200))
            label, confidence = recognizer.predict(face_roi)
            record = label_map.get(str(label))
            if record is None:
                record = {"name": "Unknown", "cid": "Unknown"}
            elif isinstance(record, str):
                record = {"name": record, "cid": record}
            
            current_time = time.time()
            cid_record = record["cid"]
            
            if confidence < recognition_threshold:
                if cid_record in last_logged:
                    elapsed = current_time - last_logged[cid_record]
                    if elapsed < cooldown_period:
                        display_text = f"{record['name']} (logged {elapsed:.1f}s ago)"
                        color = (0, 255, 255)
                    else:
                        executor.submit(async_log_detection, record["cid"], record["name"])
                        last_logged[cid_record] = current_time
                        display_text = f"{record['name']} ({confidence:.2f})"
                        color = (0, 255, 0)
                else:
                    executor.submit(async_log_detection, record["cid"], record["name"])
                    last_logged[cid_record] = current_time
                    display_text = f"{record['name']} ({confidence:.2f})"
                    color = (0, 255, 0)
            else:
                display_text = f"Unknown ({confidence:.2f})"
                color = (0, 0, 255)
            
            cv2.putText(frame, display_text, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX,
                        0.8, color, 2, cv2.LINE_AA)
            cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
        
        cv2.imshow("Real-Time Face Recognition", frame)
        if cv2.waitKey(10) & 0xFF == ord('q'):
            break
    
    vs.stop()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    recognize_faces()
