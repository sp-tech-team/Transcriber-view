import io
import traceback
from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS
import os
import tempfile
import whisper
from pydub import AudioSegment
import pandas as pd
import time
import json
import boto3
from werkzeug.utils import secure_filename
from openpyxl import load_workbook
import platform
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime
import ffmpeg
from googleapiclient.errors import HttpError


S3_BUCKET = "s3s3bucket1vcdvcd"
S3_PREFIX = "Lekhani-Storage/"  # optional folder prefix

s3 = boto3.client("s3")

UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
CORS(app)

# Load Whisper model
model = whisper.load_model("medium")

# SSE status messages
status_messages = []

def push_status(msg):
    print(msg)
    status_messages.append(msg)

def clear_status():
    """Clear old status messages before starting a new process.."""
    status_messages.clear()
    
@app.route("/categories", methods=["GET"])
def get_categories_data():
    categories_path = os.path.join(os.path.dirname(__file__), "config", "categories.json")
    with open(categories_path, "r") as f:
        return json.load(f)

@app.route("/categories", methods=["GET"])
def get_categories():
    try:
        categories = get_categories_data()
        return jsonify(categories)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/status-stream")
def status_stream():
    # clear old messages when a client reconnects
    status_messages.clear()

    def generate():
        last_sent = 0
        while True:
            if len(status_messages) > last_sent:
                yield f"data: {status_messages[last_sent]}\n\n"
                last_sent += 1
            time.sleep(0.5)
    return Response(generate(), mimetype="text/event-stream")

def get_output_dir():
    user_home = os.path.expanduser("~")
    system = platform.system()

    # On local machine (assume GUI available)
    if system == "Darwin" or system == "Windows":
        return os.path.join(user_home, "Desktop", "WhisperAnswers")
    
    # On EC2 or other headless Linux servers
    return os.path.join(user_home, "WhisperAnswers")


# Transcription endpoint
@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    try:
        clear_status()

        if "audio" not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files["audio"]
        ext = os.path.splitext(audio_file.filename)[-1].lower()

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            audio_file.save(temp_file.name)
            input_path = temp_file.name

        push_status("Processing audio...")

        # Convert to WAV mono 16k using ffmpeg (faster, no RAM load)
        wav_path = input_path + "_converted.wav"
        (
            ffmpeg
            .input(input_path)
            .output(wav_path, ac=1, ar=16000)
            .run(overwrite_output=True)
        )

        push_status("Splitting audio into chunks...")

        # Create chunk directory
        chunk_dir = tempfile.mkdtemp()
        chunk_pattern = os.path.join(chunk_dir, "chunk_%03d.wav")

        # Split into 30-sec segments
        (
            ffmpeg
            .input(wav_path)
            .output(chunk_pattern, f="segment", segment_time=30)
            .run(overwrite_output=True)
        )

        push_status("Transcribing with Whisper...")

        # Transcribe each chunk
        full_text = ""
        for fname in sorted(os.listdir(chunk_dir)):
            chunk_path = os.path.join(chunk_dir, fname)

            result = model.transcribe(
                chunk_path,
                fp16=False,
                language="en",
                temperature=0.0
            )

            full_text += result["text"] + " "

        push_status("Transcription complete.")

        # Cleanup
        os.remove(input_path)
        os.remove(wav_path)

        return jsonify({"text": full_text.strip()})

    except Exception as e:
        push_status(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
    
#List files for Candidate and Volunteer
@app.route("/list-question-files/<category>", methods=["GET"])
def list_question_files(category):
    try:
        # Define the prefix to filter relevant files (e.g., "applicant_questions.xlsx")
        prefix = f"{S3_PREFIX}{category}"

        # List objects in the S3 bucket with the matching prefix
        response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)

        files = []
        for obj in response.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".xlsx"):
                # Strip the prefix if needed, or return full key
                filename = key.replace(S3_PREFIX, "")
                files.append(filename)

        return jsonify({"files": files})

    except Exception as e:
        print(f"[ERROR] Failed to list S3 files for category '{category}': {e}")
        return jsonify({"error": str(e)}), 500


#Load chosen question list for Candidate and Volunteer
@app.route("/load-questions-file/<category>", methods=["POST"])
def load_questions_file(category):
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        filename = secure_filename(file.filename)

        # Save to uploads folder with category
        category_folder = os.path.join(UPLOAD_FOLDER, category)
        os.makedirs(category_folder, exist_ok=True)

        file_path = os.path.join(category_folder, filename)
        file.save(file_path)

        # Load the file with pandas
        xl = pd.ExcelFile(file_path)
        sheet_names = [s for s in xl.sheet_names if s.lower() != "answers"]

        if not sheet_names:
            return jsonify({
                "questions": [],
                "warning": "No valid question sheet found",
                "file_path": file_path
            })

        df = pd.read_excel(file_path, sheet_name=sheet_names[0])
        if "Questions" not in df.columns:
            return jsonify({
                "questions": [],
                "warning": "No 'Questions' column found",
                "file_path": file_path
            })

        questions = df["Questions"].dropna().tolist()

        return jsonify({
            "questions": questions,
            "file_path": file_path   # 👈 return path so frontend can reuse
        })

    except Exception as e:
        import traceback
        print("ERROR:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

def get_google_sheets_service(user_access_token):
    """Create Google Sheets service with user's OAuth token"""
    try:
        creds = Credentials(token=user_access_token)
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        print(f"Error building sheets service: {e}")
        raise

def check_token_scopes(access_token):
    """Verify that the access token has the required scopes"""
    import requests
    
    try:
        response = requests.get(
            f'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={access_token}'
        )
        
        if response.status_code != 200:
            return False, "Invalid token"
        
        token_info = response.json()
        scopes = token_info.get('scope', '')
        
        print(f"📋 Token scopes: {scopes}")
        
        # Check if spreadsheets scope is present
        has_spreadsheets = 'https://www.googleapis.com/auth/spreadsheets' in scopes
        
        if not has_spreadsheets:
            print("❌ Token missing spreadsheets scope!")
            return False, "Missing Google Sheets permission"
        
        return True, "Valid"
        
    except Exception as e:
        print(f"Error checking token scopes: {e}")
        return False, str(e)

def create_new_sheet(service):
    """Create a new Google Sheet with date-based title and headers"""
    try:
        current_date = datetime.now().strftime("%d-%b-%Y")
        sheet_title = f"Lekhani Interview Answers - {current_date}"
        
        print(f"Creating new sheet with title: {sheet_title}")
        
        spreadsheet_body = {
            'properties': {
                'title': sheet_title
            },
            'sheets': [{
                'properties': {
                    'title': 'Answers',
                    'gridProperties': {
                        'frozenRowCount': 1,
                        'rowCount': 1000,
                        'columnCount': 6
                    }
                }
            }]
        }
        
        spreadsheet = service.spreadsheets().create(body=spreadsheet_body).execute()
        sheet_id = spreadsheet['spreadsheetId']
        
        print(f"✅ Created new sheet with ID: {sheet_id}")
        
        # ✅ CRITICAL: Get the actual sheetId of the first sheet (not always 0!)
        sheets = spreadsheet.get('sheets', [])
        if not sheets:
            raise Exception("No sheets found in created spreadsheet")
        
        first_sheet_id = sheets[0]['properties']['sheetId']
        print(f"📋 First sheet ID: {first_sheet_id}")
        
        # Add column headers
        headers = [["Name", "Candidate ID", "Category", "Question", "Answer", "Timestamp"]]
        
        service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range="Answers!A1:F1",
            valueInputOption="USER_ENTERED",
            body={"values": headers}
        ).execute()
        
        print(f"✅ Column headers written to row 1")
        
        # ✅ Format header row using the ACTUAL sheet ID
        # Apply formatting
        batch_update_requests = [
            # Set default formatting for ALL cells (white background, black text)
            {
                'repeatCell': {
                    'range': {
                        'sheetId': first_sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1000,
                        'startColumnIndex': 0,
                        'endColumnIndex': 6
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                            'textFormat': {
                                'bold': False,
                                'fontSize': 10,
                                'foregroundColor': {'red': 0.0, 'green': 0.0, 'blue': 0.0}
                            }
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            },
            # THEN override header row formatting (blue background, white text)
            {
                'repeatCell': {
                    'range': {
                        'sheetId': first_sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': 6
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.26, 'green': 0.52, 'blue': 0.96},
                            'textFormat': {
                                'bold': True,
                                'fontSize': 11,
                                'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}
                            },
                            'horizontalAlignment': 'CENTER',
                            'verticalAlignment': 'MIDDLE'
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
                }
            },
            # Auto-resize columns
            {
                'autoResizeDimensions': {
                    'dimensions': {
                        'sheetId': first_sheet_id,
                        'dimension': 'COLUMNS',
                        'startIndex': 0,
                        'endIndex': 6
                    }
                }
            }

        ]
        
        service.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body={'requests': batch_update_requests}
        ).execute()
        
        print(f"✅ Headers formatted")
        
        return sheet_id
        
    except HttpError as e:
        error_details = e.error_details if hasattr(e, 'error_details') else []
        print(f"❌ HttpError creating sheet: {e}")
        print(f"Error details: {error_details}")
        
        error_reason = None
        if error_details:
            for detail in error_details:
                if 'reason' in detail:
                    error_reason = detail['reason']
                    print(f"Error reason: {error_reason}")
                    break
        
        if error_reason == 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' or 'SCOPE_INSUFFICIENT' in str(e):
            raise PermissionError("SCOPE_INSUFFICIENT")
        elif e.resp.status == 403 or error_reason == 'insufficientPermissions':
            raise PermissionError("INSUFFICIENT_PERMISSIONS")
        elif e.resp.status == 401:
            raise PermissionError("AUTHENTICATION_FAILED")
        else:
            raise Exception(f"Failed to create spreadsheet: {str(e)}")
    
    except Exception as e:
        print(f"❌ Error creating new sheet: {traceback.format_exc()}")
        raise

def ensure_headers_exist(service, sheet_id):
    """Check if headers exist, and add them if missing"""
    try:
        # First, get the sheet metadata to find the actual sheetId
        spreadsheet = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
        sheets = spreadsheet.get('sheets', [])
        
        # Find the "Answers" sheet
        answers_sheet_id = None
        for sheet in sheets:
            if sheet['properties']['title'] == 'Answers':
                answers_sheet_id = sheet['properties']['sheetId']
                break
        
        if answers_sheet_id is None:
            print("⚠️ 'Answers' sheet not found, using first sheet")
            answers_sheet_id = sheets[0]['properties']['sheetId'] if sheets else 0
        
        print(f"📋 Using sheet ID: {answers_sheet_id}")
        
        # Check if headers exist
        result = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range="Answers!A1:F1"
        ).execute()
        
        values = result.get('values', [])
        
        if not values or len(values[0]) < 6:
            print("⚠️ Headers missing, adding them...")
            
            headers = [["Name", "Candidate ID", "Category", "Question", "Answer", "Timestamp"]]
            
            service.spreadsheets().values().update(
                spreadsheetId=sheet_id,
                range="Answers!A1:F1",
                valueInputOption="USER_ENTERED",
                body={"values": headers}
            ).execute()
            
            # Format headers using the correct sheet ID
            batch_update_requests = [{
                'repeatCell': {
                    'range': {
                        'sheetId': answers_sheet_id,  # ✅ Use actual sheet ID
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': 6
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.26, 'green': 0.52, 'blue': 0.96},
                            'textFormat': {
                                'bold': True,
                                'fontSize': 11,
                                'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}
                            },
                            'horizontalAlignment': 'CENTER'
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
            }]
            
            service.spreadsheets().batchUpdate(
                spreadsheetId=sheet_id,
                body={'requests': batch_update_requests}
            ).execute()
            
            print("✅ Headers added and formatted")
        else:
            print("✅ Headers already exist")
            
    except HttpError as e:
        if e.resp.status == 403:
            raise PermissionError("INSUFFICIENT_PERMISSIONS")
        elif e.resp.status == 404:
            raise Exception("SHEET_NOT_FOUND")
        else:
            print(f"⚠️ Could not verify headers: {e}")

@app.route("/save-answer", methods=["POST"])
def save_answer():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data received"}), 400
        
        sheet_id = data.get("sheet_id")
        row = data.get("row")
        access_token = data.get("access_token")
        
        # Validation
        if not access_token:
            return jsonify({
                "success": False, 
                "error": "Missing access token. Please sign in again.",
                "error_code": "NO_TOKEN"
            }), 400
        
        if not row or len(row) != 6:
            return jsonify({
                "success": False, 
                "error": "Invalid row data (must have 6 columns)"
            }), 400
        
        print(f"📥 Received request - sheet_id: {sheet_id}, row length: {len(row)}")
        
        # ✅ CRITICAL: Check token scopes BEFORE attempting any API calls
        has_scopes, scope_message = check_token_scopes(access_token)
        
        if not has_scopes:
            print(f"❌ Token scope check failed: {scope_message}")
            return jsonify({
                "success": False,
                "error": "Your Google account permissions are outdated. Please sign out and sign in again to grant access to Google Sheets.",
                "error_code": "SCOPE_INSUFFICIENT",
                "reauthenticate": True  # ✅ Signal frontend to force re-auth
            }), 403
        
        print("✅ Token has required scopes")
        
        # Get Google Sheets service
        try:
            service = get_google_sheets_service(access_token)
        except Exception as e:
            return jsonify({
                "success": False,
                "error": "Failed to authenticate with Google. Please sign out and sign in again.",
                "error_code": "AUTH_FAILED",
                "reauthenticate": True
            }), 401
        
        # Create new sheet if needed
        if not sheet_id:
            print("📝 No sheet_id provided, creating new sheet...")
            try:
                sheet_id = create_new_sheet(service)
            except PermissionError as e:
                error_type = str(e)
                
                if error_type == "SCOPE_INSUFFICIENT":
                    return jsonify({
                        "success": False,
                        "error": "Your Google account is missing required permissions. Please sign out and sign in again, making sure to allow access to Google Sheets.",
                        "error_code": "SCOPE_INSUFFICIENT",
                        "reauthenticate": True  # ✅ Force re-auth
                    }), 403
                else:
                    return jsonify({
                        "success": False,
                        "error": "Permission denied. Please ensure you have access to create Google Sheets.",
                        "error_code": "PERMISSION_DENIED"
                    }), 403
        else:
            print(f"📊 Using existing sheet: {sheet_id}")
            try:
                ensure_headers_exist(service, sheet_id)
            except PermissionError:
                return jsonify({
                    "success": False,
                    "error": "You don't have permission to access this sheet.",
                    "error_code": "PERMISSION_DENIED"
                }), 403
        
        # Append row
        body = {"values": [row]}
        
        try:
            result = service.spreadsheets().values().append(
                spreadsheetId=sheet_id,
                range="Answers!A2:F2",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body=body
            ).execute()
            
            print(f"✅ Successfully appended row to sheet {sheet_id}")
            
            return jsonify({
                "success": True,
                "sheet_id": sheet_id,
                "updates": result.get("updates"),
                "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{sheet_id}"
            })
            
        except HttpError as e:
            if e.resp.status == 403:
                return jsonify({
                    "success": False,
                    "error": "Permission denied to edit this sheet.",
                    "error_code": "PERMISSION_DENIED"
                }), 403
            else:
                raise
        
    except Exception as e:
        print("❌ ERROR in /save-answer:", traceback.format_exc())
        return jsonify({
            "success": False, 
            "error": str(e)
        }), 500

@app.route("/download_answers")
def download_answers():
    user_key = request.args.get("user_key")
    category = request.args.get("category")  # optional

    if not user_key:
        return {"error": "Missing user_key"}, 400

    if not category:
        return {"error": "Missing category"}, 400  # or make it optional

    # Build same key format as save_answer
    s3_key = f"{S3_PREFIX}{category}_questions{user_key}.xlsx"

    try:
        s3_object = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
        return send_file(
            io.BytesIO(s3_object["Body"].read()),
            as_attachment=True,
            download_name=f"{category}_questions_with_answers.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except s3.exceptions.NoSuchKey:
        return {"error": "No answers found for this user/category"}, 404


#load questions for recorder
@app.route("/load-questions/<category>", methods=["GET"])
def load_questions(category):
    print(f"[INFO] Received request to load questions for category: {category}")
    try:
        start_time = time.time()

        categories = get_categories_data()
        selected_category = next((cat for cat in categories if cat["key"] == category), None)

        if not selected_category:
            return jsonify({"error": f"Category '{category}' not found"}), 404

        s3_key = f"{S3_PREFIX}{category}_questions.xlsx"

        try:
            s3.head_object(Bucket=S3_BUCKET, Key=s3_key)
            print(f"[INFO] S3 key exists: '{s3_key}'")
        except s3.exceptions.ClientError as e:
            if selected_category.get("requiresFileUpload", False):
                return jsonify({"questions": []})
            return jsonify({"error": f"No question file found for category '{category}'"}), 404

        # Download Excel
        s3_start = time.time()
        s3_object = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
        excel_data = s3_object['Body'].read()
        print(f"[INFO] S3 download took {time.time() - s3_start:.2f} seconds")

        # Read Excel into DataFrame
        pd_start = time.time()
        df = pd.read_excel(io.BytesIO(excel_data))
        print(f"[INFO] Pandas read_excel took {time.time() - pd_start:.2f} seconds")

        questions = df["Questions"].dropna().tolist()

        print(f"[INFO] Total load_questions took {time.time() - start_time:.2f} seconds")
        return jsonify({"questions": questions})

    except Exception as e:
        print(f"[ERROR] Failed to load questions for category '{category}': {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500    


        
# Save feedback (general transcription)
@app.route("/save-feedback", methods=["POST"])
def save_feedback():
    try:
        data = request.get_json()
        text = data.get("transcription", "").strip()
        rating = data.get("rating", "").strip()

        if not text or not rating:
            return jsonify({"error": "Missing transcription or rating"}), 400

        feedback_dir = os.path.join(os.path.expanduser("~"), "WhisperFeedback")
        os.makedirs(feedback_dir, exist_ok=True)

        file_path = os.path.join(feedback_dir, "transcription_feedback.xlsx")
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        df = pd.DataFrame([[text, rating, timestamp]],
                          columns=["Transcription", "Rating", "Date & Time"])

        if os.path.exists(file_path):
            df_existing = pd.read_excel(file_path)
            df = pd.concat([df_existing, df], ignore_index=True)

        df.to_excel(file_path, index=False)
        #push_status("✅ Feedback saved successfully.")

        #return jsonify({})
        return jsonify({"message": "Feedback saved successfully",         
        "folder_path": feedback_dir  # ✅ Return folder path
})


    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
