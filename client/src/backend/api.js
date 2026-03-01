// client/src/backend/api.js
// All fetch calls to the Kōru FastAPI backend in one place.

const BASE_URL = "http://localhost:8000";

// ─── Helper ───────────────────────────────────────────────────────────────────
async function request(method, path, body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Something went wrong");
  }

  return res.json();
}

// ─── Health ───────────────────────────────────────────────────────────────────

/** Check if all services are up. Returns { status, services } */
export async function healthCheck() {
  return request("GET", "/health");
}

// ─── Entries ──────────────────────────────────────────────────────────────────

/**
 * Step 1 — Send free text to Gemini for extraction, saves as draft.
 * Call this when user clicks "Log Entry".
 * @returns { entry_id, extracted_data }
 */
export async function createDraft({ userId, text, date, condition, conditionData }) {
  return request("POST", "/entries/draft", {
    user_id: userId,
    text,
    date, // "YYYY-MM-DD"
    condition: condition || null,
    condition_data: conditionData || null,
  });
}

/**
 * Step 2 — Confirm a draft after user reviews tags in InsightModal.
 * Call this when user clicks "Confirm & Save".
 * @returns { message, entry_id }
 */
export async function confirmEntry({ entryId, extractedData }) {
  return request("PATCH", `/entries/${entryId}/confirm`, {
    extracted_data: extractedData,
  });
}

/**
 * Get all confirmed entries for the Timeline page.
 * @param {string} userId
 * @param {string} [month] - optional "YYYY-MM" filter
 * @returns { entries: [...] }
 */
export async function getEntries({ userId, month = null }) {
  const query = month ? `?month=${month}` : "";
  return request("GET", `/entries/${userId}${query}`);
}

// ─── Patterns ─────────────────────────────────────────────────────────────────

/**
 * Get Gemini-analyzed patterns for the Patterns page.
 * @returns { has_enough_data: bool, patterns: [...] }
 */
export async function getPatterns({ userId }) {
  return request("GET", `/patterns/${userId}`);
}