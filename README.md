# 🌿 Kōru

**An AI-powered health journal that thinks.**

Log your day through voice, text, or facial analysis — Kōru extracts your health data automatically, finds hidden patterns over time, and personalizes everything for your condition.

> *"You get headaches 82% of the days you sleep under 6 hours."*

---

## Inspiration

Most people live with recurring symptoms for years — headaches, fatigue, poor sleep — and never figure out *why*. They Google it, they forget about it, or they go to the doctor with nothing but a vague feeling: *"I've been tired lately."*

We realized the problem isn't that people don't have health data — it's that they have **no way to capture it naturally** and **no tool to connect the dots**. Traditional health apps ask you to fill out forms every day. Nobody does that. Doctors get 15-minute appointments and zero longitudinal context.

We thought: what if you could just *talk about your day* — or even just *look at your camera for 15 seconds* — and an AI would extract the health signals, store them as structured data, and over time tell you things about yourself you never would have noticed?

That's Kōru. The name comes from the Māori word for a spiral fern — symbolizing new growth, renewal, and the unfolding of patterns over time.

---

## What it does

**Kōru is a multimodal health journal with a built-in correlation engine.**

### Multimodal Check-in
You don't fill out forms. You check in using any combination of:
- **Voice diary** — speak freely about your day; speech-to-text captures everything
- **AI face scan** — a 15-second MediaPipe facial analysis detects sleep quality, stress, tension, mood, and focus from 468 facial landmarks — no buttons, no input required
- **Free-text journaling** — type naturally: *"Woke up with a headache, slept 5 hours, had two coffees"*

### AI Extraction
Your unstructured input is processed by **Gemini 2.5 Flash**, which extracts structured health variables automatically:

```json
{
  "symptoms": ["headache"],
  "sleep": "low",
  "sleep_hours": 5,
  "food": ["coffee"],
  "stress": "high",
  "exercise": false,
  "mood": "bad"
}
```

No forms. No checkboxes. Just talk — the AI handles parsing.

### Condition-Specific Tracking
During onboarding, users choose a health condition, and **the entire experience adapts**:

| Condition | Tracked Fields |
|---|---|
| 🌿 General Health | Sleep, mood, stress, exercise |
| 🩸 Diabetes | Glucose (mg/dL), insulin, carb intake, meal type |
| ❤️‍🩹 Hypertension | Blood pressure, heart rate, sodium intake, medication |

### Pattern Detection & Correlation Engine
After 7+ entries, Kōru computes statistical correlations across your data:

$$P(\text{effect} \mid \text{cause}) = \frac{\sum_{i=1}^{n} \mathbb{1}[C_i \wedge E_i]}{\sum_{i=1}^{n} \mathbb{1}[C_i]} \times 100$$

This powers insights like:
- *"Sleeping < 6h → Headache (75% correlation, 3 of 4 times)"*
- *"Exercise → Good mood (80% correlation)"*
- *"High stress → Bad mood (67% correlation)"*

### Condition-Specific Charts
For chronic conditions, a dynamic bar chart shows daily values over time (glucose, blood pressure) with color-coded bars (🟢 normal, 🔴 high, 🟡 low), threshold lines, and indicator dots (💉 insulin, 💊 medication). The chart system is **config-driven** — adding a new condition requires zero code changes.

### Timeline
A full history of entries with day cards, mood indicators, expanded health details, symptom/food tags, condition-specific data, and month-by-month navigation. When you visit a doctor, you don't show up with a vague feeling — you show up with 30 days of structured data and the patterns that matter.

---

## How we built it

### Architecture

```
┌─────────────┐     HTTP/JSON      ┌─────────────┐     SQL       ┌───────────┐
│   React +   │ ◄──────────────► │   FastAPI    │ ◄──────────► │  Supabase │
│   Vite      │                    │   (Python)   │              │ (Postgres)│
└──────┬──────┘                    └──────┬──────┘              └───────────┘
       │                                  │
  MediaPipe                          Gemini 2.5
  FaceLandmarker                     Flash API
  (in-browser)                    (extraction + analysis)
```

**Frontend** — React 19 + Vite. MediaPipe FaceLandmarker runs entirely in-browser for real-time facial analysis (no video leaves the device). Web Speech API for voice logging. Pure CSS animations and charts with no library dependencies. A config-driven condition system via a `useConditionConfig` hook makes the entire UI adapt to the user's condition.

**Backend** — FastAPI with async endpoints and Pydantic validation. Gemini 2.5 Flash for structured health data extraction from natural language. Supabase (hosted PostgreSQL) for persistent storage. A local statistical correlation engine computes patterns without needing Gemini. A config-driven chart builder (`CONDITION_CHART_CONFIGS`) means adding a new illness is just a dictionary entry.

**Face Scan Math** — We use the Eye Aspect Ratio for sleep detection:

$$\text{EAR} = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2 \cdot \|p_1 - p_4\|}$$

And a normalized brow-to-face-width ratio for stress:

$$\text{Brow} = \frac{d(\text{lm}_{70}, \text{lm}_{300})}{d(\text{lm}_{234}, \text{lm}_{454})}$$

Both computed client-side from MediaPipe's 468 facial landmarks.

**Key decisions:**
- Face analysis runs client-side — **privacy-first**, no video leaves the browser
- Two-step entry flow — Gemini extracts → user reviews in InsightModal → saved. Human stays in the loop while AI automates 95% of the work
- Condition data stored inside `extracted_json` — no database schema changes when adding new conditions

---

## Challenges we ran into

1. **Getting Gemini to return consistent JSON.** LLMs love to add markdown wrappers, extra commentary, or vary key names. We solved this by setting `response_mime_type="application/json"` and `temperature=0.0`, plus retry logic for rate limits.

2. **Face scan calibration.** Mapping raw landmark distances to meaningful 1–5 scales required extensive testing. EAR-to-sleep, brow-to-stress, and jaw-to-tension thresholds all needed manual tuning since facial proportions vary across people.

3. **Timezone bugs.** `new Date().toISOString()` converts to UTC, so late-night entries stored the wrong date. We switched to local date extraction using `getFullYear()` / `getMonth()` / `getDate()`.

4. **Condition data not reaching the database.** Initially, condition fields (glucose, BP) were only embedded as plain text. Gemini would sometimes miss them. We fixed this by passing structured `condition_data` alongside the text, then merging it into `extracted_json` server-side — guaranteeing it's always stored.

5. **Chart showing the wrong condition.** The chart picked the "most frequent" condition from history, so switching from diabetes to hypertension still showed glucose. Fixed by passing the user's current condition from the frontend to the API.

---

## Accomplishments that we're proud of

- **The face scan actually works.** In 15 seconds, with zero user input, we detect sleep quality, stress, tension, mood, and focus — all running locally in the browser with MediaPipe. No photos stored, no data sent anywhere.

- **Config-driven condition system.** Adding a new chronic condition (e.g., asthma, thyroid) requires adding one config object in the backend and one in the frontend hook — the check-in form, InsightModal, Timeline, Patterns chart, and tag extraction all adapt automatically. Zero component changes.

- **The correlation engine finds real patterns.** It's not just counting — it computes conditional probabilities across 10+ cause-effect rules (sleep → headache, exercise → mood, stress → poor sleep) and surfaces only statistically meaningful results (≥40% correlation, ≥2 occurrences).

- **Fully multimodal input.** Most health apps give you a form. Kōru lets you speak, type, or just look at your camera — and gets better data from all three combined than any form could.

- **Privacy-first design.** Face analysis is 100% client-side. Voice transcription uses the browser's built-in Web Speech API. The only data that leaves the device is the text you've written/spoken — never video, never audio.

---

## What we learned

- **LLMs need guardrails for structured output.** Even Gemini 2.5 Flash with `response_mime_type="application/json"` occasionally deviates. Setting `temperature=0.0` and building retry logic was essential for production reliability.

- **MediaPipe is incredibly powerful in-browser.** We expected to need a server for face analysis — turns out FaceLandmarker runs at 30fps entirely client-side, tracking 468 landmarks with sub-millisecond latency.

- **Config-driven architecture pays off fast.** We initially hard-coded diabetes and hypertension separately. Refactoring to a config-driven system took effort upfront, but now adding a condition is a 5-minute task instead of touching 6 files.

- **The two-step flow (extract → review) builds trust.** Users don't blindly trust AI extraction. Showing them what Gemini found and letting them edit before saving makes the whole system feel reliable — and the data ends up more accurate.

- **Health data is messy.** People say "I slept okay" or "pretty stressed" — mapping these to structured categories (low/medium/high) taught us a lot about the gap between natural language and clinical data models.

---

## What's next for Kōru

- **Gemini native audio** — replace Web Speech API with Gemini's multimodal audio input for richer voice analysis (tone, pace, hesitation as stress indicators)
- **Photo logging** — snap a photo of your meal and let Gemini Vision identify foods, estimate portions, and log nutrition automatically
- **1M token longitudinal analysis** — feed Gemini's full context window with months of entries for deep pattern discovery that our statistical engine can't find
- **More conditions** — asthma (peak flow, inhaler use), migraine (aura, triggers), thyroid (TSH levels, energy) — each just a config entry away
- **Doctor export** — generate a structured PDF or FHIR-compatible summary for your next appointment: 30 days of data, top patterns, and condition trends in one page
- **Mobile app** — React Native port for on-the-go check-ins with push notification reminders
- **Multi-user support** — authentication, family accounts, and the ability to share reports with caregivers or doctors

---

## 🧰 Built With

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, CSS |
| Face Analysis | MediaPipe FaceLandmarker (in-browser) |
| Voice Input | Web Speech API |
| Backend | FastAPI, Python 3.11 |
| AI / NLP | Gemini 2.5 Flash |
| Database | Supabase (PostgreSQL) |

---

*Kōru. Find your patterns.* 🌿
