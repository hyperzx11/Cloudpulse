import os
import json
import time
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is not set in .env")

client = genai.Client(api_key=api_key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class LogRequest(BaseModel):
    log_text: str

class DiagnosisResponse(BaseModel):
    summary: str
    root_cause: str
    category: str
    severity: str
    fix_command_or_code: str

# Model preference list: tries the primary first, then falls back
CANDIDATE_MODELS = [
    "gemini-3.8-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

@app.post("/analyze", response_model=DiagnosisResponse)
def analyze_log(payload: LogRequest):
    if not payload.log_text.strip():
        raise HTTPException(status_code=400, detail="Log text cannot be empty.")

    prompt = f"""
    You are an expert Cloud & SRE Engineer. Analyze this server/container log:
    \"\"\"{payload.log_text}\"\"\"

    You MUST return ONLY valid JSON matching this exact structure:
    {{
      "summary": "1-sentence overview",
      "root_cause": "technical explanation of the exact failure",
      "category": "Network, Database, Memory, or Configuration",
      "severity": "Low, Medium, or Critical",
      "fix_command_or_code": "exact terminal command or configuration change to fix it"
    }}
    """

    last_error = None

    for model_name in CANDIDATE_MODELS:
        for attempt in range(2):  # Try each model up to 2 times
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json"
                    }
                )
                data = json.loads(response.text)
                return DiagnosisResponse(**data)
            except Exception as e:
                err_str = str(e)
                last_error = e
                # If overloaded (503), wait briefly and retry or drop to the next model
                if "503" in err_str:
                    time.sleep(1)
                    continue
                # If the model does not exist or is deprecated (404), switch to the next immediately
                if "404" in err_str:
                    break
                break

    print(f"\n--- API ERROR: All candidate models failed: {last_error} ---\n")
    raise HTTPException(status_code=503, detail="AI service temporarily busy. Please retry in a few seconds.")