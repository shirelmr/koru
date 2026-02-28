import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# ── Clients ───────────────────────────────────────────────────────────────────
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
GEMINI_MODEL = "gemini-2.5-flash"


# ── Startup Connection Checks ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "═" * 50)
    print("  Kōru API — Starting up...")
    print("═" * 50)

    print("✅ FastAPI        — running")

    # Supabase ping
    try:
        supabase.table("entries").select("id").limit(1).execute()
        print("✅ Supabase       — connected")
    except Exception as e:
        print(f"❌ Supabase       — FAILED: {e}")

    # Gemini ping
    try:
        response = gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents="Reply with the single word: ok",
            config=types.GenerateContentConfig(temperature=0.0),
        )
        _ = response.text
        print("✅ Gemini API     — connected")
    except Exception as e:
        print(f"❌ Gemini API     — FAILED: {e}")

    print("═" * 50)
    print("  All checks done. Server is ready 🌿")
    print("═" * 50 + "\n")

    yield

    print("\n🛑 Kōru API shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Kōru API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ───────────────────────────────────────────────────────────
class CheckInRequest(BaseModel):
    user_id: str
    text: str
    date: str  # YYYY-MM-DD

class ConfirmRequest(BaseModel):
    extracted_data: dict


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


# ── Gemini helper ─────────────────────────────────────────────────────────────
def call_gemini(prompt: str) -> dict | list:
    response = gemini.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(response.text.strip())


# ═════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═════════════════════════════════════════════════════════════════════════════
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Kōru API is running 🌿"}


@app.get("/health")
async def health_check():
    """Live check — hit http://localhost:8000/health anytime to verify all services."""
    results = {"fastapi": "ok", "supabase": "unknown", "gemini": "unknown"}

    try:
        supabase.table("entries").select("id").limit(1).execute()
        results["supabase"] = "ok"
    except Exception as e:
        results["supabase"] = f"error: {str(e)}"

    try:
        response = gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents="Reply with the single word: ok",
            config=types.GenerateContentConfig(temperature=0.0),
        )
        _ = response.text
        results["gemini"] = "ok"
    except Exception as e:
        results["gemini"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in results.values())
    if not all_ok:
        raise HTTPException(status_code=503, detail=results)

    return {"status": "all systems go 🌿", "services": results}


# ═════════════════════════════════════════════════════════════════════════════
# STEP 1 — Extract + save as draft
# POST /entries/draft
# ═════════════════════════════════════════════════════════════════════════════
@app.post("/entries/draft")
async def create_draft(request: CheckInRequest):
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
# STEP 2 — Confirm entry
# PATCH /entries/{entry_id}/confirm
# ═════════════════════════════════════════════════════════════════════════════
@app.patch("/entries/{entry_id}/confirm")
async def confirm_entry(entry_id: str, request: ConfirmRequest):
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
# TIMELINE — Get confirmed entries
# GET /entries/{user_id}?month=2026-02
# ═════════════════════════════════════════════════════════════════════════════
@app.get("/entries/{user_id}")
async def get_entries(user_id: str, month: str | None = None):
    try:
        query = (
            supabase.table("entries")
            .select("id, date, raw_text, extracted_json")
            .eq("user_id", user_id)
            .eq("status", "confirmed")
            .order("date", desc=True)
        )

        if month:
            query = query.gte("date", f"{month}-01").lte("date", f"{month}-31")

        db_response = query.execute()

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
# PATTERNS — Gemini pattern analysis
# GET /patterns/{user_id}
# ═════════════════════════════════════════════════════════════════════════════
@app.get("/patterns/{user_id}")
async def get_patterns(user_id: str):
    try:
        db_response = (
            supabase.table("entries")
            .select("date, extracted_json")
            .eq("user_id", user_id)
            .eq("status", "confirmed")
            .order("date", desc=True)
            .limit(60)
            .execute()
        )

        entries = db_response.data

        if len(entries) < 7:
            return {"has_enough_data": False, "patterns": []}

        patterns = call_gemini(PATTERNS_PROMPT.format(entries=json.dumps(entries)))

        return {"has_enough_data": True, "patterns": patterns}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini returned invalid JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))