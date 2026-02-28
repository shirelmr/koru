import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = FastAPI(title="Kōru API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Clients ───────────────────────────────────────────────────────────────────
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

# ── Pydantic Models ───────────────────────────────────────────────────────────
class CheckInRequest(BaseModel):
    user_id: str
    text: str
    date: str  # YYYY-MM-DD

class ConfirmRequest(BaseModel):
    extracted_data: dict  # allows frontend edits before confirming

# ── Prompts ───────────────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """
Extract health variables from the following user text.
Return ONLY a valid JSON object with this exact structure:
{{
  "symptoms": ["headache", "fatigue"],
  "sleep": "low | medium | high",
  "sleep_hours": 5,
  "food": ["pizza", "coffee"],
  "stress": "low | medium | high",
  "exercise": true,
  "mood": "bad | neutral | good"
}}

Rules:
- symptoms: array of strings, empty [] if none mentioned
- sleep: infer quality from context if hours not explicit
- sleep_hours: integer or null if unknown
- food: array of foods/drinks mentioned, empty [] if none
- stress: infer from context if not explicit
- exercise: true/false, false if not mentioned
- mood: infer from overall tone

User text: "{text}"
"""

PATTERNS_PROMPT = """
You are analyzing a user's health journal entries to find meaningful patterns.
Given these entries (JSON array), identify cause-effect correlations.

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "cause": "Sleeping < 6h",
    "effect": "Headache",
    "occurrences": 3,
    "total": 4,
    "percentage": 75,
    "strength": "high"
  }}
]

Rules:
- strength: "high" (>75% correlation, negative), "med" (50-75%, negative), "positive" (any %, beneficial)
- Only include patterns with at least 2 occurrences
- Maximum 5 patterns, sorted by percentage descending
- percentage must be an integer
- If not enough data return an empty array []

Entries: {entries}
"""

# ── Helper ────────────────────────────────────────────────────────────────────
def call_gemini(prompt: str) -> dict | list:
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(response.text.strip())


# ═════════════════════════════════════════════════════════════════════════════
# STEP 1 — Extract (creates a DRAFT, not yet confirmed)
# POST /entries/draft
# ═════════════════════════════════════════════════════════════════════════════
@app.post("/entries/draft")
async def create_draft(request: CheckInRequest):
    """
    Calls Gemini to extract variables from free text.
    Saves a draft row (status='draft') in Supabase.
    Returns entry_id + extracted_data so the frontend can show the modal.
    """
    try:
        extracted_json = call_gemini(EXTRACTION_PROMPT.format(text=request.text))

        db_response = supabase.table("entries").insert({
            "user_id": request.user_id,
            "date": request.date,
            "raw_text": request.text,
            "extracted_json": extracted_json,
            "status": "draft",
        }).execute()

        inserted_row = db_response.data[0]

        return {
            "entry_id": inserted_row["id"],
            "extracted_data": extracted_json,
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini returned invalid JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═════════════════════════════════════════════════════════════════════════════
# STEP 2 — Confirm (user reviewed/edited tags → mark as confirmed)
# PATCH /entries/{entry_id}/confirm
# ═════════════════════════════════════════════════════════════════════════════
@app.patch("/entries/{entry_id}/confirm")
async def confirm_entry(entry_id: str, request: ConfirmRequest):
    """
    Marks a draft entry as confirmed.
    Accepts the (possibly user-edited) extracted_data from the frontend.
    """
    try:
        db_response = supabase.table("entries").update({
            "extracted_json": request.extracted_data,
            "status": "confirmed",
        }).eq("id", entry_id).execute()

        if not db_response.data:
            raise HTTPException(status_code=404, detail="Entry not found.")

        return {"message": "Entry confirmed.", "entry_id": entry_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═════════════════════════════════════════════════════════════════════════════
# TIMELINE — Get all confirmed entries for a user
# GET /entries/{user_id}?month=2026-02
# ═════════════════════════════════════════════════════════════════════════════
@app.get("/entries/{user_id}")
async def get_entries(user_id: str, month: str | None = None):
    """
    Returns all confirmed entries for a user.
    Optionally filter by month (YYYY-MM).
    """
    try:
        query = (
            supabase.table("entries")
            .select("id, date, raw_text, extracted_json")
            .eq("user_id", user_id)
            .eq("status", "confirmed")
            .order("date", desc=True)
        )

        if month:
            # e.g. month="2026-02" → filter between 2026-02-01 and 2026-02-28
            query = query.gte("date", f"{month}-01").lte("date", f"{month}-31")

        db_response = query.execute()

        # Shape data for the frontend Timeline component
        entries = [
            {
                "id": row["id"],
                "date": row["date"],
                "raw_text": row["raw_text"],
                "tags": _extract_tags(row["extracted_json"]),
                "mood": row["extracted_json"].get("mood", "neutral"),
            }
            for row in db_response.data
        ]

        return {"entries": entries}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _extract_tags(extracted_json: dict) -> list[str]:
    """Flatten extracted_json into a flat list of readable tags for the UI."""
    tags = []
    tags += extracted_json.get("symptoms", [])
    tags += extracted_json.get("food", [])
    sleep = extracted_json.get("sleep")
    if sleep:
        tags.append(f"{sleep} sleep")
    stress = extracted_json.get("stress")
    if stress:
        tags.append(f"{stress} stress")
    if extracted_json.get("exercise"):
        tags.append("exercise")
    return tags


# ═════════════════════════════════════════════════════════════════════════════
# PATTERNS — Gemini analyzes all entries and finds correlations
# GET /patterns/{user_id}
# ═════════════════════════════════════════════════════════════════════════════
@app.get("/patterns/{user_id}")
async def get_patterns(user_id: str):
    """
    Fetches all confirmed entries for the user,
    sends them to Gemini for pattern analysis,
    returns up to 5 cause-effect correlations.
    """
    try:
        db_response = (
            supabase.table("entries")
            .select("date, extracted_json")
            .eq("user_id", user_id)
            .eq("status", "confirmed")
            .order("date", desc=True)
            .limit(60)  # last 60 entries is plenty for pattern detection
            .execute()
        )

        entries = db_response.data

        # Need at least 7 entries for meaningful patterns
        if len(entries) < 7:
            return {"has_enough_data": False, "patterns": []}

        patterns = call_gemini(PATTERNS_PROMPT.format(entries=json.dumps(entries)))

        return {"has_enough_data": True, "patterns": patterns}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini returned invalid JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "Kōru API is running 🌿"}