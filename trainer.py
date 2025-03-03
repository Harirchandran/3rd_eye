import sys
import time
import cv2
import numpy as np
import os
import json
import dbconnection

def train_model():
    print("Initializing Training Model... Please wait.")
    sys.stdout.flush()
    time.sleep(2)

    training_dir = "trainingImages"
    print(f"Loading training images from directory: {training_dir}")
    sys.stdout.flush()
    time.sleep(2)
    
    # Get all subfolders in trainingImages (each folder represents a criminal with CID)
    all_folders = [d for d in os.listdir(training_dir) if os.path.isdir(os.path.join(training_dir, d))]
    if not all_folders:
        print("No folders found in trainingImages. Exiting.")
        return

    print("Fetching criminal records from the database...")
    sys.stdout.flush()
    time.sleep(2)
    criminals = dbconnection.fetch_criminals() or []
    cid_to_name = {rec['cid'].strip().lower(): rec['name'] for rec in criminals}  # Map CID to name
    print(f"Found {len(criminals)} criminal record(s) in the database.")
    sys.stdout.flush()
    time.sleep(2)

    faces = []
    labels = []
    label_map = {}
    current_label = 0
    max_images_per_person = 1000  # Process up to 1000 images per person
    target_size = (200, 200)      # Use fixed resolution for training

    for folder in all_folders:
        folder_path = os.path.join(training_dir, folder)
        actual_cid = folder.strip().lower()

        # Ensure CID exists in the database
        if actual_cid not in cid_to_name:
            print(f"Warning: Criminal record for CID '{folder}' not found in database. Skipping folder.")
            sys.stdout.flush()
            time.sleep(2)
            continue
        
        criminal_name = cid_to_name[actual_cid]
        label_map[current_label] = {"cid": folder, "name": criminal_name}
        print(f"\nProcessing images for: CID {folder} ({criminal_name})")
        sys.stdout.flush()
        time.sleep(2)

        image_files = os.listdir(folder_path)
        image_count = 0

        for filename in image_files:
            if image_count >= max_images_per_person:
                break  # Only process up to the maximum images per person
            if filename.lower().endswith(('.jpg', '.png')):
                image_path = os.path.join(folder_path, filename)
                # Read image in grayscale for consistency
                img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
                if img is None:
                    print(f"Warning: Could not read image {image_path}. Skipping.")
                    sys.stdout.flush()
                    time.sleep(2)
                    continue
                img_resized = cv2.resize(img, target_size)
                img_resized = cv2.equalizeHist(img_resized)  # Ensure preprocessing matches capture.py
                faces.append(img_resized)
                labels.append(current_label)
                image_count += 1

        print(f"Found {image_count} valid image(s) for CID {folder} ({criminal_name}).")
        sys.stdout.flush()
        time.sleep(2)
        current_label += 1

    if not faces:
        print("No valid training data found! Exiting.")
        return

    print(f"\nTraining model using {len(faces)} face images...")
    sys.stdout.flush()
    time.sleep(2)
    recognizer = cv2.face.LBPHFaceRecognizer_create(radius=2, neighbors=8, grid_x=8, grid_y=8)
    recognizer.train(faces, np.array(labels))
    recognizer.save("trainer.yml")
    
    with open("label_map.json", "w") as f:
        json.dump(label_map, f)
    
    print("Training complete!")
    sys.stdout.flush()
    time.sleep(2)
    print("Model saved as 'trainer.yml'")
    sys.stdout.flush()
    time.sleep(2)
    print("Label map saved as 'label_map.json'")
    sys.stdout.flush()
    time.sleep(2)

if __name__ == '__main__':
    print("Starting trainer.py...")
    sys.stdout.flush()
    time.sleep(2)
    train_model()
