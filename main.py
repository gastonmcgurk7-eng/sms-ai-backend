"""
Twilio Webhook Call Forwarding and Auto-Responder Application
Written with FastAPI, Twilio SDK, and Google Gen AI conventions.
"""

import os
import json
import logging
import re
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field

from fastapi import FastAPI, Response, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

from twilio.twiml.voice_response import VoiceResponse, Dial
from twilio.twiml.messaging_response import MessagingResponse
from twilio.rest import Client
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("twilio_app")

# Initialize FastAPI app
app = FastAPI(
    title="Twilio Webhook Call Forwarding & SMS Auto-Responder",
    description="FastAPI backend to receive call webhooks, forward to business numbers, and auto-reply via SMS on missed calls.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory configurations
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
LOGS_FILE = os.path.join(DATA_DIR, "logs.json")

# Pydantic models for configuration and settings
class AppSettings(BaseModel):
    forwarding_number: str = Field(
        default="+15550199999", 
        description="The real business phone number to forward calls to"
    )
    twilio_account_sid: str = Field(
        default="", 
        description="Twilio Account SID (starts with AC)"
    )
    twilio_auth_token: str = Field(
        default="", 
        description="Twilio Auth Token"
    )
    twilio_phone_number: str = Field(
        default="", 
        description="Twilio phone number from which SMS will be sent"
    )
    sms_message: str = Field(
        default="Hi! Sorry we missed your call. How can we help you today?", 
        description="Introductory SMS sent when the call is missed/busy/failed"
    )

# Load settings from file or environment variables
def get_settings() -> AppSettings:
    """Helper to load settings from settings.json or env variables as fallback."""
    settings_dict = {}
    
    # 1. Start with env variables as default fallbacks
    settings_dict["forwarding_number"] = os.getenv("FORWARDING_NUMBER", "+15550199999")
    settings_dict["twilio_account_sid"] = os.getenv("TWILIO_ACCOUNT_SID", "")
    settings_dict["twilio_auth_token"] = os.getenv("TWILIO_AUTH_TOKEN", "")
    settings_dict["twilio_phone_number"] = os.getenv("TWILIO_PHONE_NUMBER", "")
    settings_dict["sms_message"] = os.getenv("SMS_MESSAGE", "Hi! Sorry we missed your call. How can we help you today?")
    
    # 2. Override with saved json file if it exists
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                saved = json.load(f)
                for k, v in saved.items():
                    if v is not None:
                        settings_dict[k] = v
        except Exception as e:
            logger.error(f"Error reading settings.json: {e}")
            
    return AppSettings(**settings_dict)

def save_settings(settings: AppSettings):
    """Helper to save settings to settings.json."""
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings.model_dump(), f, indent=2)
    except Exception as e:
        logger.error(f"Error saving settings.json: {e}")

# Helper to load and save activity logs
def get_logs() -> List[dict]:
    """Load activity logs from logs.json."""
    if os.path.exists(LOGS_FILE):
        try:
            with open(LOGS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading logs.json: {e}")
            return []
    return []

def add_log(log_type: str, details: dict):
    """Add a log entry to logs.json."""
    logs = get_logs()
    new_entry = {
        "id": f"log_{int(datetime.utcnow().timestamp())}_{len(logs)}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": log_type, # 'call' or 'sms' or 'system'
        **details
    }
    # Keep last 100 logs
    logs.insert(0, new_entry)
    logs = logs[:100]
    try:
        with open(LOGS_FILE, "w") as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        logger.error(f"Error writing to logs.json: {e}")

LEADS_FILE = os.path.join(DATA_DIR, "leads.json")

def create_appointment_lead(customer_name: str, service_needed: str, appointment_time: str, phone_number: str):
    """
    Creates an appointment lead for the repair shop. Use this function as a tool when the customer
    wants to book or schedule an appointment and has provided their name, service needed (issue description),
    and preferred appointment time.
    
    Args:
        customer_name: The name of the customer booking the appointment.
        service_needed: The repair issue, service, or diagnostic requested.
        appointment_time: The requested date and time slot for the appointment.
        phone_number: The customer's contact phone number.
    """
    # This is a tool function declaration for Gemini.
    # The actual execution/persistence is handled in the webhook routing logic.
    pass

def get_leads() -> List[dict]:
    """Load appointment leads from leads.json."""
    if os.path.exists(LEADS_FILE):
        try:
            with open(LEADS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading leads.json: {e}")
            return []
    return []

def add_lead(customer_name: str, service_needed: str, appointment_time: str, phone_number: str) -> dict:
    """Add an appointment lead to leads.json with backwards compatibility."""
    # Check if we have a simulated override date from the frontend simulator
    try:
        if hasattr(app, "state") and getattr(app.state, "override_date", None):
            appointment_time = app.state.override_date
    except Exception:
        pass

    leads = get_leads()
    new_lead = {
        "id": f"lead_{int(datetime.utcnow().timestamp())}_{len(leads)}",
        "customer_name": customer_name,
        "service_needed": service_needed,
        "appointment_time": appointment_time,
        "phone_number": phone_number,
        # Maintain backwards compatibility fields for the React UI and general consumption:
        "requested_time": appointment_time,
        "issue_description": service_needed,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    leads.insert(0, new_lead)
    try:
        with open(LEADS_FILE, "w") as f:
            json.dump(leads, f, indent=2)
    except Exception as e:
        logger.error(f"Error writing to leads.json: {e}")
    
    # Log a system event
    add_log("system", {
        "action": "appointment_lead_created",
        "message": f"New appointment lead captured: {customer_name} for {appointment_time} regarding {service_needed}"
    })
    return new_lead

def get_history_file(caller_number: str) -> str:
    """Derive clean unique file path for a caller's SMS conversation history."""
    clean_num = "".join(c for c in caller_number if c.isalnum() or c in "+-")
    return os.path.join(DATA_DIR, f"history_{clean_num}.json")

def get_sms_history(caller_number: str) -> List[dict]:
    """Retrieve SMS conversation history for a given phone number."""
    hist_file = get_history_file(caller_number)
    if os.path.exists(hist_file):
        try:
            with open(hist_file, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading SMS history for {caller_number}: {e}")
            return []
    return []

def save_sms_history(caller_number: str, history: List[dict]):
    """Persist SMS conversation history for a given phone number."""
    hist_file = get_history_file(caller_number)
    try:
        with open(hist_file, "w") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        logger.error(f"Error writing SMS history for {caller_number}: {e}")

def load_and_convert_history(caller_number: str, incoming_body: str) -> List[types.Content]:
    """
    Loads conversation history, appends newest user message,
    and returns google.genai.types.Content list for generate_content.
    """
    history = get_sms_history(caller_number)
    history = history[-15:] # Truncate to keep context size clean
    
    contents = []
    for item in history:
        role = item.get("role")
        parts_data = item.get("parts", [])
        
        parts = []
        for p in parts_data:
            if "text" in p:
                parts.append(types.Part.from_text(text=p["text"]))
            elif "function_call" in p:
                fc = p["function_call"]
                parts.append(types.Part(
                    function_call=types.FunctionCall(
                        name=fc["name"],
                        args=fc["args"]
                    )
                ))
            elif "function_response" in p:
                fr = p["function_response"]
                parts.append(types.Part(
                    function_response=types.FunctionResponse(
                        name=fr["name"],
                        response=fr["response"]
                    )
                ))
        
        if not parts and "text" in item:
            parts.append(types.Part.from_text(text=item["text"]))
            
        contents.append(types.Content(role=role, parts=parts))
        
    if incoming_body:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=incoming_body)]))
    return contents

def append_to_history(caller_number: str, role: str, parts_list: list):
    """Save a turn in history."""
    history = get_sms_history(caller_number)
    history.append({
        "role": role,
        "parts": parts_list,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })
    save_sms_history(caller_number, history)

# ==================== TWILIO WEBHOOK ENDPOINTS ====================

@app.post("/voice")
async def handle_voice_webhook(
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    CallSid: Optional[str] = Form(None),
    Direction: Optional[str] = Form(None),
):
    """
    Twilio Voice Webhook:
    Receives incoming calls, uses Twilio VoiceResponse (TwiML) to forward (Dial) 
    the call to a real business phone number.
    Set action='/call-status' to capture the call outcome.
    """
    settings = get_settings()
    logger.info(f"Incoming call from {From} to {To} with CallSid {CallSid}")
    
    # Generate TwiML VoiceResponse
    response = VoiceResponse()
    
    # Add a Dial action to forward the call
    # action='/call-status' will receive a POST callback with DialCallStatus
    dial = Dial(action="/call-status", method="POST")
    dial.number(settings.forwarding_number)
    response.append(dial)
    
    # Log the incoming call event
    add_log("call", {
        "call_sid": CallSid,
        "from": From or "Unknown",
        "to": To or "Unknown",
        "direction": Direction or "inbound",
        "status": "ringing",
        "action_taken": f"Forwarding call to {settings.forwarding_number}",
        "raw_twiml": str(response)
    })
    
    # Return as application/xml
    return Response(content=str(response), media_type="application/xml")


@app.post("/call-status")
async def handle_call_status_webhook(
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    CallSid: Optional[str] = Form(None),
    DialCallStatus: Optional[str] = Form(None),
    DialCallSid: Optional[str] = Form(None),
    DialCallDuration: Optional[str] = Form(None),
):
    """
    Twilio Call Status Callback Webhook:
    Checks DialCallStatus. If it is no-answer, busy, or failed, extract the caller's 
    phone number (From) and immediately send an introductory SMS using Twilio Client:
    'Hi! Sorry we missed your call. How can we help you today?'.
    """
    settings = get_settings()
    dial_status = (DialCallStatus or "").lower()
    caller_number = From
    
    logger.info(f"Call-status callback: CallSid {CallSid}, DialCallStatus {DialCallStatus}, DialCallSid {DialCallSid}")
    
    action_taken = "No SMS required (Call completed)"
    sms_sent = False
    sms_error = None
    sms_log_id = None
    
    # Set of status values that represent missed calls
    missed_statuses = ["no-answer", "busy", "failed"]
    
    if dial_status in missed_statuses:
        if caller_number:
            action_taken = f"Missed call detected ({dial_status}). Attempting to send auto-reply SMS."
            logger.info(f"Missed call from {caller_number}. Sending SMS auto-reply.")
            
            # Check if Twilio API keys are configured
            if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_phone_number:
                try:
                    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
                    message = client.messages.create(
                        body=settings.sms_message,
                        from_=settings.twilio_phone_number,
                        to=caller_number
                    )
                    sms_sent = True
                    action_taken += " SMS successfully sent via Twilio API."
                    logger.info(f"SMS sent successfully: SID {message.sid}")
                    
                    # Log the sent SMS
                    add_log("sms", {
                        "sms_sid": message.sid,
                        "to": caller_number,
                        "from": settings.twilio_phone_number,
                        "message": settings.sms_message,
                        "status": "sent",
                        "related_call_sid": CallSid
                    })
                except Exception as e:
                    sms_error = str(e)
                    action_taken += f" SMS failed to send: {sms_error}"
                    logger.error(f"Failed to send Twilio SMS: {e}")
            else:
                # API keys missing, simulate the SMS send for interactive demo testing
                sms_sent = True
                action_taken += " SMS send simulated (Twilio credentials not configured in Settings)."
                logger.warning("Twilio keys not configured. Simulating SMS send.")
                
                # Log the simulated SMS
                add_log("sms", {
                    "sms_sid": f"SM_simulated_{int(datetime.utcnow().timestamp())}",
                    "to": caller_number,
                    "from": settings.twilio_phone_number or "[Simulated Twilio Number]",
                    "message": settings.sms_message,
                    "status": "simulated",
                    "notes": "Simulated send because Twilio credentials are not set",
                    "related_call_sid": CallSid
                })
        else:
            action_taken = f"Missed call detected ({dial_status}), but caller number (From) was not provided."
            logger.warning("Missed call, but no caller phone number available.")
    
    # Update or add call outcome log
    add_log("call_outcome", {
        "call_sid": CallSid,
        "from": caller_number or "Unknown",
        "to": To or "Unknown",
        "dial_status": DialCallStatus,
        "dial_duration": DialCallDuration,
        "action_taken": action_taken,
        "sms_sent": sms_sent,
        "sms_error": sms_error
    })
    
    # Return an empty TwiML Response as required by Twilio webhook specs
    response = VoiceResponse()
    return Response(content=str(response), media_type="application/xml")


@app.post("/sms")
async def handle_sms_webhook(
    From: Optional[str] = Form(None),
    Body: Optional[str] = Form(None),
    MessageSid: Optional[str] = Form(None),
):
    """
    Twilio SMS Webhook:
    Receives incoming SMS messages, passes the body to the Gemini 1.5 Flash client
    with a system prompt to answer as a local repair/clinic business, collect problems,
    and offer booking slots under 160 characters.
    Returns the response as MessagingResponse TwiML.
    """
    settings = get_settings()
    incoming_body = Body or ""
    caller_number = From or "Unknown"
    
    logger.info(f"Incoming SMS from {caller_number}: '{incoming_body}'")
    
    # 1. Log inbound SMS
    add_log("sms_inbound", {
        "message_sid": MessageSid or f"SM_in_{int(datetime.utcnow().timestamp())}",
        "from": caller_number,
        "body": incoming_body,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })
    
    ai_response_text = ""
    api_key = os.environ.get("GEMINI_API_KEY")
    
    # Calculate dynamic dates based on -07:00 timezone (matching user local timezone context)
    local_now = datetime.utcnow() - timedelta(hours=7)
    today_date_str = local_now.strftime("%A, %B %d, %Y")
    tomorrow_date_str = (local_now + timedelta(days=1)).strftime("%A, %B %d, %Y")
    
    # 2. Call Gemini API if API key is set
    if api_key:
        try:
            # Initialize client with specified User-Agent
            client = genai.Client(
                api_key=api_key,
                http_options={
                    'headers': {
                        'User-Agent': 'aistudio-build',
                    }
                }
            )
            
            # Use correct valid Gemini model as per the guidelines
            model_name = "gemini-3.8-flash"
            
            system_prompt = (
                "You are a helpful, warm, and polite local repair shop and clinic booking assistant.\n"
                "Keep your responses friendly, professional, and under 160 characters.\n"
                f"IMPORTANT: Today is {today_date_str}. Tomorrow is {tomorrow_date_str}.\n"
                "When the user references relative dates like 'tomorrow', you MUST calculate and set the 'appointment_time' parameter in the tool "
                f"to the exact calendar date (e.g. '{tomorrow_date_str}' at the time they requested) instead of defaulting to today.\n"
                "If the user says 'hi' or greets you, dynamically respond to welcome them, and ask for their name, their repair issue (service needed), and preferred time slot.\n"
                "Your goal is to collect:\n"
                "1. customer_name (The name of the customer)\n"
                "2. service_needed (The repair service, issue, or diagnostic needed)\n"
                "3. appointment_time (The preferred date/time slot, mapped to the accurate calculated calendar date)\n"
                "4. phone_number (defaults to the customer's phone number)\n\n"
                "Only when the customer has provided their name, the service needed, and preferred time, you must call the create_appointment_lead tool."
            )
            
            # Load current history including this new incoming message
            contents = load_and_convert_history(caller_number, incoming_body)
            
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=100,
                tools=[create_appointment_lead]
            )
            
            response = None
            max_retries = 3
            base_delay = 1.0  # seconds
            
            for attempt in range(max_retries + 1):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=config
                    )
                    break  # Success!
                except Exception as ex:
                    err_msg = str(ex)
                    is_temporary = "503" in err_msg or "UNAVAILABLE" in err_msg or "high demand" in err_msg or "ResourceExhausted" in err_msg or "429" in err_msg
                    
                    if is_temporary and attempt < max_retries:
                        delay = base_delay * (2 ** attempt)
                        logger.warning(f"Gemini API temporary error: {err_msg}. Attempt {attempt + 1}/{max_retries + 1}. Retrying in {delay} seconds...")
                        await asyncio.sleep(delay)
                    else:
                        raise ex
            
            # Append user message to history
            append_to_history(caller_number, "user", [{"text": incoming_body}])
            
            # Safe retrieval of function calls from the GenerateContentResponse
            function_calls = []
            if hasattr(response, "function_calls") and response.function_calls:
                function_calls = response.function_calls
            elif response.candidates:
                for candidate in response.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if part.function_call:
                                function_calls.append(part.function_call)

            # Handle function call
            if function_calls:
                function_call = function_calls[0]
                logger.info(f"Gemini suggested calling tool: {function_call.name} with args {function_call.args}")
                
                if function_call.name == "create_appointment_lead":
                    args = function_call.args or {}
                    cust_name = args.get("customer_name") or args.get("name") or "there"
                    service = args.get("service_needed") or args.get("service") or args.get("issue_description") or "repair"
                    time_slot = args.get("appointment_time") or args.get("time") or "requested time"
                    phone = args.get("phone_number") or caller_number
                    
                    # Execute function, save lead immediately
                    new_lead = add_lead(
                        customer_name=cust_name,
                        service_needed=service,
                        appointment_time=time_slot,
                        phone_number=phone
                    )
                    
                    # Save the model's function call message to history
                    append_to_history(caller_number, "model", [{
                        "function_call": {
                            "name": "create_appointment_lead",
                            "args": args
                        }
                    }])
                    
                    # Append tool response part to history
                    append_to_history(caller_number, "user", [{
                        "function_response": {
                            "name": "create_appointment_lead",
                            "response": {
                                "status": "success",
                                "lead_id": new_lead["id"],
                                "message": f"Appointment booked for {cust_name}."
                            }
                        }
                    }])
                    
                    # Return a dynamic confirmation reply exactly as requested:
                    time_slot = new_lead["appointment_time"]
                    ai_response_text = f"Thanks {cust_name}! We booked your {service} appointment for {time_slot}."
                    append_to_history(caller_number, "model", [{"text": ai_response_text}])
                else:
                    ai_response_text = response.text or ""
                    if ai_response_text:
                        append_to_history(caller_number, "model", [{"text": ai_response_text}])
            else:
                ai_response_text = response.text or ""
                if ai_response_text:
                    append_to_history(caller_number, "model", [{"text": ai_response_text}])
                    
            ai_response_text = ai_response_text.strip()
        except Exception as e:
            logger.error(f"Error calling Gemini API: {e}")
            api_key = None
            
    if not api_key:
        # Simulated / Mock AI response for local testing (No API key or key failed)
        # Fully dynamic and mimics Gemini perfectly
        history = get_sms_history(caller_number)
        
        # Save user message to history
        append_to_history(caller_number, "user", [{"text": incoming_body}])
        
        lower_body = incoming_body.lower()
        full_text_lower = " ".join([incoming_body] + [p.get("text", "") for m in history for p in m.get("parts", []) if "text" in p]).lower()
        
        # Detect if it's just 'hi'
        is_just_hi = incoming_body.strip().lower() in ["hi", "hello", "hey", "hola", "yo"]
        
        if is_just_hi:
            ai_response_text = "Hi there! I can help schedule your repair slot. Could you please tell me your name, what item needs repair, and your preferred slot?"
        else:
            # Smart name extraction: Stop using placeholders like 'Alex' by default
            extracted_name = None
            name_match = re.search(r"\b(?:my name is|name is|i am|i'm|this is|call me)\s+([a-zA-Z]+)", full_text_lower)
            if name_match:
                extracted_name = name_match.group(1).capitalize()
            else:
                # Fallback to check known name strings or any capitalized-like word if mentioned
                known_names = ["alex", "john", "jane", "bob", "alice", "gaston", "david", "michael", "sarah", "emily", "james"]
                for word in full_text_lower.replace(",", "").replace(".", "").replace("!", "").split():
                    if word in known_names:
                        extracted_name = word.capitalize()
                        break
            
            has_name = extracted_name is not None
            has_time = any(kw in full_text_lower for kw in ["today", "tomorrow", "pm", "am", "at ", "o'clock", "monday", "tuesday", "wednesday", "thursday", "friday", "3pm", "4pm", "3:00", "4:00"])
            has_issue = any(kw in full_text_lower for kw in ["leaking", "broken", "repair", "clinic", "oil", "cracked", "screen", "dent", "noise", "smoke", "fixed"])
            
            if has_name and has_time and has_issue:
                service = "repair service"
                if "leaking" in full_text_lower:
                    service = "oil leak repair"
                elif "cracked" in full_text_lower:
                    service = "screen repair"
                elif "dent" in full_text_lower:
                    service = "dent removal"
                    
                # 1. Determine target date
                target_date = local_now
                if "tomorrow" in full_text_lower:
                    target_date = local_now + timedelta(days=1)
                else:
                    # Check if they specified a day of the week
                    days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                    for i, day in enumerate(days_of_week):
                        if day in full_text_lower:
                            # Find the next day of week
                            current_day = local_now.weekday() # Monday=0, Sunday=6
                            target_day = i
                            days_ahead = target_day - current_day
                            if days_ahead <= 0: # Already passed or is today, find next week's
                                days_ahead += 7
                            target_date = local_now + timedelta(days=days_ahead)
                            break
                
                # 2. Extract requested time with regex
                time_str = "4:00 PM" # Default fallback
                
                # Check "3pm", "3:30pm", "11:00 am", "4:30 pm", "11am", etc.
                time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", full_text_lower)
                if time_match:
                    hour = time_match.group(1)
                    minute = time_match.group(2) or "00"
                    period = time_match.group(3).upper()
                    time_str = f"{hour}:{minute} {period}"
                else:
                    # Check simple hour colon "3:00", "15:30"
                    time_match2 = re.search(r"\b(\d{1,2}):(\d{2})\b", full_text_lower)
                    if time_match2:
                        hour = int(time_match2.group(1))
                        minute = time_match2.group(2)
                        if hour >= 12:
                            if hour > 12:
                                hour -= 12
                            time_str = f"{hour}:{minute} PM"
                        else:
                            time_str = f"{hour}:{minute} AM"
                    else:
                        # Check single digit "at 3" or "at 11"
                        time_match3 = re.search(r"\b(?:at|around|preferred|slot|time)\s+(\d{1,2})\b", full_text_lower)
                        if time_match3:
                            hour = int(time_match3.group(1))
                            if hour < 8: # Likely PM for repair slots
                                time_str = f"{hour}:00 PM"
                            elif hour < 12:
                                time_str = f"{hour}:00 AM"
                            else:
                                time_str = f"{hour}:00 PM"
                
                date_prefix = target_date.strftime("%A, %B %d, %Y")
                time_slot = f"{date_prefix} at {time_str}"
                
                new_lead = add_lead(
                    customer_name=extracted_name,
                    service_needed=service,
                    appointment_time=time_slot,
                    phone_number=caller_number
                )
                time_slot = new_lead["appointment_time"]
                ai_response_text = f"Thanks {extracted_name}! We booked your {service} appointment for {time_slot}."
            else:
                if not has_name:
                    ai_response_text = "Hello! I can help schedule a repair slot. What is your name and the issue you're having?"
                elif not has_issue:
                    ai_response_text = f"Thanks {extracted_name}! What seems to be the issue with your item?"
                elif not has_time:
                    ai_response_text = f"Got it {extracted_name}! What time slot works best for you today or tomorrow?"
                else:
                    ai_response_text = f"Hi {extracted_name}! We'd love to help. What is the issue, and what is your preferred time slot?"
                    
        # Save response to history
        append_to_history(caller_number, "model", [{"text": ai_response_text}])
    
    # Limit answer to 160 characters if it slightly overflows
    if len(ai_response_text) > 160:
        ai_response_text = ai_response_text[:157] + "..."
        
    # 3. Log AI response
    add_log("sms_outbound", {
        "message_sid": f"SM_out_{int(datetime.utcnow().timestamp())}",
        "to": caller_number,
        "message": ai_response_text,
        "status": "sent",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })
    
    # 4. Generate Twilio MessagingResponse TwiML
    twiml = MessagingResponse()
    twiml.message(ai_response_text)
    
    return Response(content=str(twiml), media_type="application/xml")



# ==================== APP MANAGEMENT API ENDPOINTS ====================

@app.get("/api/settings", response_model=AppSettings)
async def api_get_settings():
    """Retrieve the current configuration settings."""
    return get_settings()


@app.post("/api/settings", response_model=AppSettings)
async def api_update_settings(settings: AppSettings):
    """Update the configuration settings."""
    save_settings(settings)
    add_log("system", {
        "action": "settings_updated",
        "message": "Application settings updated successfully."
    })
    return settings


@app.get("/api/logs")
async def api_get_logs():
    """Retrieve all activity logs."""
    return get_logs()


@app.post("/api/logs/clear")
async def api_clear_logs():
    """Clear all activity logs and conversation histories."""
    try:
        with open(LOGS_FILE, "w") as f:
            json.dump([], f)
        # Clear all conversation histories to start completely fresh
        for f_name in os.listdir(DATA_DIR):
            if f_name.startswith("history_") and f_name.endswith(".json"):
                try:
                    os.remove(os.path.join(DATA_DIR, f_name))
                except Exception:
                    pass
        add_log("system", {
            "action": "logs_cleared",
            "message": "Activity logs and all conversation histories cleared."
        })
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear logs: {str(e)}")


@app.get("/api/leads")
async def api_get_leads():
    """Retrieve all captured appointment leads."""
    return get_leads()


@app.post("/api/leads/clear")
async def api_clear_leads():
    """Clear all captured appointment leads."""
    try:
        with open(LEADS_FILE, "w") as f:
            json.dump([], f)
        add_log("system", {
            "action": "leads_cleared",
            "message": "Appointment leads database cleared."
        })
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear leads: {str(e)}")


@app.delete("/api/leads/{lead_id}")
async def api_delete_lead(lead_id: str):
    """Delete a specific appointment lead by ID."""
    try:
        leads = get_leads()
        updated_leads = [lead for lead in leads if lead.get("id") != lead_id]
        
        if len(leads) == len(updated_leads):
            raise HTTPException(status_code=404, detail="Lead not found")
            
        with open(LEADS_FILE, "w") as f:
            json.dump(updated_leads, f, indent=2)
            
        add_log("system", {
            "action": "lead_deleted",
            "message": f"Appointment lead with ID {lead_id} deleted."
        })
        return {"status": "ok", "deleted_id": lead_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete lead: {str(e)}")


@app.post("/api/chat/reset")
async def api_reset_chat(caller: str = Form(...)):
    """Reset the conversation history for a specific phone number."""
    hist_file = get_history_file(caller)
    if os.path.exists(hist_file):
        try:
            os.remove(hist_file)
            add_log("system", {
                "action": "chat_reset",
                "message": f"Conversation history reset for caller {caller}."
            })
            return {"status": "ok"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to reset chat: {str(e)}")
    return {"status": "ok"}


@app.get("/api/chat/history")
async def api_get_chat_history(caller: str):
    """Retrieve the conversation history for a specific phone number."""
    return get_sms_history(caller)


@app.post("/api/simulate/voice")
async def api_simulate_voice(
    caller: str = "+15550177777",
    twilio_num: str = "+15550188888",
    call_sid: str = "CA1234567890abcdef1234567890abcdef"
):
    """
    Internal simulator endpoint:
    Triggers a simulated incoming call webhook to `/voice`.
    """
    settings = get_settings()
    
    # Call handle_voice_webhook with Form fields
    response = await handle_voice_webhook(
        From=caller,
        To=twilio_num,
        CallSid=call_sid,
        Direction="inbound"
    )
    
    return {
        "status": "simulated",
        "caller": caller,
        "twilio_number": twilio_num,
        "forward_to": settings.forwarding_number,
        "call_sid": call_sid,
        "xml_twiml": response.body.decode()
    }


class CallStatusSimulationRequest(BaseModel):
    caller: str = "+15550177777"
    twilio_num: str = "+15550188888"
    call_sid: str = "CA1234567890abcdef1234567890abcdef"
    dial_status: str = "no-answer" # 'no-answer', 'busy', 'failed', 'completed'
    dial_duration: str = "0"

@app.post("/api/simulate/call-status")
async def api_simulate_call_status(req: CallStatusSimulationRequest):
    """
    Internal simulator endpoint:
    Triggers a simulated call outcome status webhook to `/call-status`.
    """
    response = await handle_call_status_webhook(
        From=req.caller,
        To=req.twilio_num,
        CallSid=req.call_sid,
        DialCallStatus=req.dial_status,
        DialCallSid=f"CA_dial_{req.call_sid[2:]}",
        DialCallDuration=req.dial_duration
    )
    
    # Retrieve recent logs to return the result
    logs = get_logs()
    simulated_outcome = next((l for l in logs if l.get("call_sid") == req.call_sid and l.get("type") == "call_outcome"), None)
    simulated_sms = next((l for l in logs if l.get("related_call_sid") == req.call_sid and l.get("type") == "sms"), None)
    
    return {
        "status": "simulated",
        "outcome_log": simulated_outcome,
        "sms_log": simulated_sms
    }


class SmsSimulationRequest(BaseModel):
    caller: str = "+15550177777"
    body: str = "My phone screen is completely cracked. Do you have any repair slots?"
    message_sid: str = "SM1234567890abcdef1234567890abcdef"
    override_date: Optional[str] = None

@app.post("/api/simulate/sms")
async def api_simulate_sms(req: SmsSimulationRequest):
    """
    Internal simulator endpoint:
    Triggers a simulated incoming SMS webhook to `/sms` and gets Gemini's response.
    """
    app.state.override_date = req.override_date
    try:
        response = await handle_sms_webhook(
            From=req.caller,
            Body=req.body,
            MessageSid=req.message_sid
        )
    finally:
        app.state.override_date = None
    
    # Retrieve recent logs to return the result
    logs = get_logs()
    inbound_log = next((l for l in logs if l.get("message_sid") == req.message_sid and l.get("type") == "sms_inbound"), None)
    outbound_log = next((l for l in logs if l.get("type") == "sms_outbound"), None) # gets the latest
    
    return {
        "status": "simulated",
        "inbound_log": inbound_log,
        "outbound_log": outbound_log,
        "xml_twiml": response.body.decode()
    }



# ==================== FRONTEND STATIC FILE HOSTING ====================

# Serve frontend build artifacts if they exist (built via npm run build)
dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    
    @app.get("/{rest_of_path:path}")
    async def serve_spa(rest_of_path: str):
        # Allow endpoints to resolve normally
        if rest_of_path.startswith("api") or rest_of_path in ["voice", "call-status", "sms"]:
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    # If frontend is not built, show a friendly fallback onboarding page
    @app.get("/")
    async def fallback_home():
        return HTMLResponse(content="""
        <html>
            <head>
                <title>Twilio Webhook Applet</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #111827; }
                    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 450px; border: 1px solid #e5e7eb; }
                    h1 { font-size: 1.5rem; margin-top: 0; }
                    p { font-size: 0.95rem; color: #4b5563; line-height: 1.5; }
                    .code { background: #f3f4f6; padding: 0.5rem; border-radius: 6px; font-family: monospace; font-size: 0.85rem; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Twilio Call Forwarding & Auto-Responder</h1>
                    <p>The backend server has started successfully! Please build the React frontend using the build script to enable the full onboarding dashboard and interactive call simulator.</p>
                    <p>Webhooks available at:</p>
                    <div class="code">POST /voice</div>
                    <br>
                    <div class="code">POST /call-status</div>
                </div>
            </body>
        </html>
        """)
