import os
from datetime import datetime
from supabase import create_client

SUPABASE_URL = "https://jxsurwtcxvznuqlgnxis.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c3Vyd3RjeHZ6bnVxbGdueGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDA3MjIsImV4cCI6MjA1NTIxNjcyMn0.vSYd0BZK3OgbPvxT1n0uwc_o0xyTuVp1IqdiBtdTdQA"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def log_error(error, context=""):
    try:
        supabase.table("errors").insert({
            "error": str(error),
            "context": context,
            "timestamp": datetime.now().isoformat()
        }).execute()
    except Exception as e:
        print("Error logging error:", e)

def fetch_criminals():
    """
    Fetch all criminals from the 'criminal' table.
    """
    try:
        response = supabase.table("criminal").select("*").execute()
        return response.data
    except Exception as e:
        log_error(e, "fetch_criminals")
        print("❌ Error fetching criminals:", e)
        return None

def fetch_criminal_by_cid(cid):
    """
    Fetch a criminal from the 'criminal' table with a specific CID.
    Uses case-insensitive matching by converting cid to lowercase.
    """
    try:
        response = supabase.table("criminal").select("*").ilike("cid", cid.lower()).execute()
        data = response.data
        if data:
            return data[0]
        else:
            return None
    except Exception as e:
        log_error(e, "fetch_criminal_by_cid")
        print("❌ Error fetching criminal by CID:", e)
        return None

def log_criminal_detection(criminal_id, name, timestamp):
    """
    Log a detected criminal into the 'cr_found' table with a local system timestamp.
    The table schema is:
      id serial primary key,
      detection_timestamp timestamp default current_timestamp,
      cid varchar(10) references criminal(cid),
      name varchar(255) not null
    """
    try:
        response = supabase.table("cr_found").insert({
            "cid": criminal_id.lower(),
            "name": name,
            "detection_timestamp": timestamp
        }).execute()
        return response
    except Exception as e:
        log_error(e, "log_criminal_detection")
        print("❌ Error logging criminal detection:", e)
        return None

def insert_criminal(cid, name, age, aadhar, phone, gender, address, reason, photo_url):
    """
    Insert a new criminal record into the 'criminal' table.
    Checks for unique CID before insertion.
    """
    cid = cid.lower()
    existing = fetch_criminal_by_cid(cid)
    if existing:
        raise ValueError("CID already exists")
    data = {
        "cid": cid,
        "name": name,
        "age": int(age),
        "aadhar": aadhar,
        "phone": phone,
        "gender": gender,
        "address": address,
        "reason": reason,
        "photo_url": photo_url
    }
    try:
        response = supabase.table("criminal").insert(data).execute()
        return response
    except Exception as e:
        log_error(e, "insert_criminal")
        print("❌ Error inserting criminal:", e)
        return None

def delete_criminal(cid):
    """
    Delete a criminal record from the 'criminal' table using the given CID.
    """
    try:
        response = supabase.table("criminal").delete().eq("cid", cid.lower()).execute()
        return response
    except Exception as e:
        log_error(e, "delete_criminal")
        print("❌ Error deleting criminal:", e)
        return None

if __name__ == "__main__":
    criminals = fetch_criminals()
    print(criminals)
