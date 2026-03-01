import os
import json
import time
import calendar
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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

    # Skip Gemini ping to save API quota
    print("✅ Gemini API     — configured (skipping ping to save quota)")

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
    condition: Optional[str] = None        # "diabetes" | "hypertension" | None
    condition_data: Optional[dict] = None  # e.g. {"glucose": "120", "insulin": true}

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
def call_gemini(prompt: str, retries: int = 2) -> dict | list:
    for attempt in range(retries):
        try:
            response = gemini.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
            return json.loads(response.text.strip())
        except Exception as e:
            if "429" in str(e) and attempt < retries - 1:
                wait = (attempt + 1) * 10
                print(f"⚠️  Gemini rate limited, retrying in {wait}s (attempt {attempt + 1}/{retries})...")
                time.sleep(wait)
            else:
                raise


# ═════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═════════════════════════════════════════════════════════════════════════════
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Kōru API is running 🌿"}


@app.get("/health")
async def health_check():
    """Live check — hit http://localhost:8000/health anytime to verify all services."""
    results = {"fastapi": "ok", "supabase": "unknown", "gemini": "configured"}

    try:
        supabase.table("entries").select("id").limit(1).execute()
        results["supabase"] = "ok"
    except Exception as e:
        results["supabase"] = f"error: {str(e)}"

    # Don't ping Gemini here — it wastes API quota
    # Gemini connectivity is validated when users actually make requests

    all_ok = all(v != "unknown" for v in results.values())
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

        # Merge condition-specific structured data into extracted_json
        if request.condition and request.condition_data:
            extracted_json["condition"] = request.condition
            extracted_json["condition_data"] = request.condition_data

        db_response = supabase.table("entries").insert({
            "user_id": request.user_id,
            "date": request.date,
            "raw_text": request.text,
            "extracted_json": extracted_json,
            "status": "confirmed",
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
            year, mon = map(int, month.split("-"))
            last_day = calendar.monthrange(year, mon)[1]
            query = query.gte("date", f"{month}-01").lte("date", f"{month}-{last_day:02d}")

        db_response = query.execute()

        entries = [
            {
                "id": row["id"],
                "date": row["date"],
                "raw_text": row["raw_text"],
                "tags": _extract_tags(row["extracted_json"]),
                "mood": row["extracted_json"].get("mood", "neutral"),
                "extracted_json": row["extracted_json"],
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

    # Condition-specific tags
    cond = extracted_json.get("condition")
    cdata = extracted_json.get("condition_data") or {}
    if cond == "diabetes":
        if cdata.get("glucose"):
            tags.append(f"glucose {cdata['glucose']}")
        if cdata.get("insulin") is True:
            tags.append("insulin taken")
        if cdata.get("carbs"):
            tags.append(f"{cdata['carbs']} carbs")
    elif cond == "hypertension":
        if cdata.get("bp"):
            tags.append(f"BP {cdata['bp']}")
        if cdata.get("heart_rate"):
            tags.append(f"{cdata['heart_rate']} bpm")
        if cdata.get("medication") is True:
            tags.append("medication taken")

    return tags


# ═════════════════════════════════════════════════════════════════════════════
# PATTERNS — Local statistical analysis (no Gemini needed)
# GET /patterns/{user_id}
# ═════════════════════════════════════════════════════════════════════════════

def _compute_patterns(entries: list[dict]) -> list[dict]:
    """Analyze extracted_json fields across entries to find correlations."""
    total = len(entries)
    patterns = []

    # Build per-entry flags
    rows = []
    for e in entries:
        d = e.get("extracted_json") or {}
        rows.append({
            "low_sleep": d.get("sleep") == "low" or (d.get("sleep_hours") is not None and d.get("sleep_hours", 99) < 6),
            "high_stress": d.get("stress") == "high",
            "exercise": bool(d.get("exercise")),
            "good_mood": d.get("mood") == "good",
            "bad_mood": d.get("mood") == "bad",
            "headache": "headache" in [s.lower() for s in (d.get("symptoms") or [])],
            "fatigue": "fatigue" in [s.lower() for s in (d.get("symptoms") or [])],
            "high_sleep": d.get("sleep") == "high" or (d.get("sleep_hours") is not None and d.get("sleep_hours", 0) >= 7),
            "low_stress": d.get("stress") == "low",
        })

    # Define cause → effect rules to check
    rules = [
        ("low_sleep", "headache", "Sleeping < 6h", "Headache"),
        ("low_sleep", "fatigue", "Sleeping < 6h", "Fatigue"),
        ("low_sleep", "bad_mood", "Sleeping < 6h", "Bad mood"),
        ("high_stress", "headache", "High stress", "Headache"),
        ("high_stress", "bad_mood", "High stress", "Bad mood"),
        ("high_stress", "low_sleep", "High stress", "Poor sleep"),
        ("exercise", "good_mood", "Exercise", "Good mood"),
        ("exercise", "high_sleep", "Exercise", "Better sleep"),
        ("high_sleep", "good_mood", "Good sleep (7h+)", "Good mood"),
        ("low_stress", "good_mood", "Low stress", "Good mood"),
    ]

    for cause_key, effect_key, cause_label, effect_label in rules:
        cause_rows = [r for r in rows if r[cause_key]]
        if len(cause_rows) < 2:
            continue
        both = sum(1 for r in cause_rows if r[effect_key])
        pct = round(both / len(cause_rows) * 100)
        if pct < 40:
            continue

        # Determine strength
        is_positive = cause_key in ("exercise", "high_sleep", "low_stress")
        if is_positive:
            strength = "positive"
        elif pct >= 75:
            strength = "high"
        else:
            strength = "med"

        patterns.append({
            "cause": cause_label,
            "effect": effect_label,
            "occurrences": both,
            "total": len(cause_rows),
            "percentage": pct,
            "strength": strength,
        })

    # Sort by percentage descending, take top 5
    patterns.sort(key=lambda p: p["percentage"], reverse=True)
    return patterns[:5]


def _compute_stats(entries: list[dict]) -> dict:
    """Compute summary statistics from entries."""
    total = len(entries)
    moods = {"good": 0, "neutral": 0, "bad": 0}
    sleep_hours_list = []
    exercise_count = 0
    stress_counts = {"low": 0, "medium": 0, "high": 0}
    all_symptoms = {}

    for e in entries:
        d = e.get("extracted_json") or {}
        mood = d.get("mood", "neutral")
        moods[mood] = moods.get(mood, 0) + 1

        sh = d.get("sleep_hours")
        if sh is not None:
            sleep_hours_list.append(sh)

        if d.get("exercise"):
            exercise_count += 1

        stress = d.get("stress", "medium")
        stress_counts[stress] = stress_counts.get(stress, 0) + 1

        for s in (d.get("symptoms") or []):
            sl = s.lower()
            all_symptoms[sl] = all_symptoms.get(sl, 0) + 1

    avg_sleep = round(sum(sleep_hours_list) / len(sleep_hours_list), 1) if sleep_hours_list else None
    top_symptoms = sorted(all_symptoms.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_entries": total,
        "mood_distribution": moods,
        "avg_sleep_hours": avg_sleep,
        "exercise_rate": round(exercise_count / total * 100) if total > 0 else 0,
        "stress_distribution": stress_counts,
        "top_symptoms": [{"name": s, "count": c} for s, c in top_symptoms],
    }


def _generate_predictions(patterns: list[dict], stats: dict) -> list[dict]:
    """Generate actionable predictions/tips from patterns and stats."""
    predictions = []

    for p in patterns:
        if p["strength"] == "high":
            predictions.append({
                "type": "warning",
                "icon": "⚠️",
                "text": f"When you have {p['cause'].lower()}, there's a {p['percentage']}% chance of {p['effect'].lower()}.",
                "tip": f"Try to avoid {p['cause'].lower()} to reduce {p['effect'].lower()}.",
            })
        elif p["strength"] == "positive":
            predictions.append({
                "type": "positive",
                "icon": "💡",
                "text": f"{p['cause']} is linked to {p['effect'].lower()} {p['percentage']}% of the time.",
                "tip": f"Keep it up! {p['cause']} clearly benefits you.",
            })

    # Add stat-based insights
    if stats.get("avg_sleep_hours") and stats["avg_sleep_hours"] < 6:
        predictions.append({
            "type": "warning",
            "icon": "🛏️",
            "text": f"Your average sleep is only {stats['avg_sleep_hours']}h — below the recommended 7-8h.",
            "tip": "Prioritize a consistent bedtime to improve your overall health.",
        })
    elif stats.get("avg_sleep_hours") and stats["avg_sleep_hours"] >= 7:
        predictions.append({
            "type": "positive",
            "icon": "🛏️",
            "text": f"Great sleep average of {stats['avg_sleep_hours']}h per night.",
            "tip": "Your sleep habits are solid — keep maintaining them.",
        })

    if stats.get("exercise_rate", 0) < 30:
        predictions.append({
            "type": "warning",
            "icon": "🏃",
            "text": f"You only exercised {stats['exercise_rate']}% of days.",
            "tip": "Even a short walk 3x/week can significantly improve mood and sleep.",
        })
    elif stats.get("exercise_rate", 0) >= 50:
        predictions.append({
            "type": "positive",
            "icon": "🏃",
            "text": f"You exercised {stats['exercise_rate']}% of days — great consistency!",
            "tip": "Your body thanks you. Exercise is your strongest positive habit.",
        })

    return predictions[:6]


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
            return {"has_enough_data": False, "patterns": [], "stats": None, "predictions": []}

        patterns = _compute_patterns(entries)
        stats = _compute_stats(entries)
        predictions = _generate_predictions(patterns, stats)

        return {
            "has_enough_data": True,
            "patterns": patterns,
            "stats": stats,
            "predictions": predictions,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))