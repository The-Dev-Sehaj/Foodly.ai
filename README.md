# Foodly.ai

An AI-powered live cooking assistant that watches you cook through your phone camera, guides you step-by-step, remembers your habits, and helps you plan meals — all in real time.

Point your phone at the stove and Foodly tells you when to stir, whether you've added enough ingredients, and reminds you of things you tend to forget — like salt.

---

## Features

### Live Cooking Sessions
- Tap **Start Cooking** on the home screen, optionally type a dish or pick one from the quick-start grid
- Foodly greets you first and confirms it knows what you're making
- Streams audio (16kHz PCM) and video frames (JPEG, ~0.25 FPS) over WebSocket to the backend
- Gemini Live API responds with voice guidance in real time (24kHz PCM audio played back on device)
- Session status pill and animated recording dot give live feedback on connection state
- **End Session** saves the session, generates a structured summary, and redirects to History

### Personalized Coaching via User Profile
- Set your **skill level** (Beginner / Intermediate / Advanced) in the Profile tab
- Set **dietary restrictions** (vegetarian, vegan, gluten-free, dairy-free, nut-free, halal, kosher)
- Both are injected directly into Gemini's system prompt at session start — Foodly adjusts its explanations and will never suggest restricted ingredients without offering substitutions

### Session Memory
- After each session, the backend generates a structured summary and a semantic embedding (Gemini text-embedding-004, 768 dimensions) stored in Supabase with pgvector
- When you start a new session, Foodly loads your last 5 sessions and performs a vector similarity search for past sessions relevant to the current recipe — all injected as context so Foodly can reference what you've done before

### Cooking History
- **History tab** lists all past sessions with recipe name, date, duration, and completion percentage
- Tap any session to open a detail view showing:
  - AI-generated session summary
  - Recipe steps
  - What was discussed / coaching moments
  - Tips to remember for next time
  - Ingredients list
- Delete any session — it is permanently removed from Supabase and Foodly will no longer reference it in future sessions

### AI Recipe Generator
- **Recipes tab** — type any request ("spicy chicken tacos", "quick vegan pasta", "15-minute dinner") and Foodly generates a full recipe using Gemini 2.5 Flash Lite
- Each recipe is saved to your account and displayed as a card
- Tap a card to expand it inline and see:
  - Ingredient list with quantities (displayed as chips)
  - Numbered step-by-step instructions
  - Cooking tips
- Delete recipes you no longer want

### UI & Design
- Warm Foodly brand theme throughout: cream `#FAF5EE`, brown `#3D2010`, amber `#C4813A`
- Spring/fade/slide animations on every screen using React Native Animated and Reanimated
- Floating 🦫 mascot on the login and home screens
- Dark camera view during sessions with amber recording dot glow, branded status pills, and an amber End Session button
- Four-tab navigation: Cook, Recipes, History, Profile

---

## Stack

| Layer | Technology |
|---|---|
| Mobile app | React Native (Expo SDK 52, Expo Router) |
| Live AI | Gemini Live API — real-time bidirectional audio + video |
| Recipe / summary AI | Gemini 2.5 Flash Lite (REST v1) |
| Backend | Python FastAPI (WebSocket + HTTP) |
| Database | Supabase (PostgreSQL + pgvector) |
| Embeddings | Gemini text-embedding-004 (768 dimensions) |
| Auth | Supabase Auth (email/password) |

---

## How it works

```
Phone camera + microphone
        ↓  WebSocket
  FastAPI backend
        ↓  loads user profile + dietary restrictions + skill level
        ↓  loads last 5 sessions + vector-similarity past sessions
        ↓  builds system prompt with full memory context
        ↓  Gemini Live API  (bidirectional audio/video stream)
        ↓  audio response streamed back to phone
  Session ends → Gemini 2.5 Flash Lite generates structured summary
              → embedded with text-embedding-004
              → stored in Supabase with pgvector for future recall
```

---

## Database schema

```
users               → email, dietary_restrictions[], skill_level, equipment[]
cooking_sessions    → recipe_name, summary, details (jsonb), embedding vector(768), duration
recipe_steps        → step_number, step_name, skipped, struggled
ingredients_used    → ingredient, quantity, substitution
user_notes          → persistent coaching notes per user
saved_recipes       → title, description, cooking_time, servings, difficulty,
                      ingredients (jsonb), steps (jsonb), tips (jsonb)
```

Semantic search is handled by a `match_cooking_sessions()` PostgreSQL function using pgvector's HNSW index.

---

## Project structure

```
Foodly.ai/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # Environment settings
│   │   ├── api/routes/
│   │   │   ├── session.py           # /ws/session — live cooking WebSocket
│   │   │   ├── history.py           # GET/DELETE /api/history/{id}
│   │   │   ├── profile.py           # GET/PATCH /api/profile
│   │   │   └── recipes.py           # POST /api/recipes/generate, GET/DELETE
│   │   └── services/
│   │       ├── gemini_live.py       # Gemini Live session, embeddings, summarization
│   │       └── memory_service.py    # Load/save context, pgvector search
│   └── requirements.txt
├── mobile/
│   ├── app/
│   │   ├── (auth)/login.tsx         # Sign in / sign up
│   │   ├── (tabs)/index.tsx         # Cook — start a session
│   │   ├── (tabs)/ingredients.tsx   # Recipes — AI recipe generator
│   │   ├── (tabs)/history.tsx       # History — past session list
│   │   ├── (tabs)/profile.tsx       # Profile — skill level + dietary restrictions
│   │   ├── history/[id].tsx         # Session detail view
│   │   └── session.tsx              # Live cooking screen (camera + audio)
│   ├── hooks/useSession.ts          # Audio chunking, WebSocket lifecycle
│   └── services/
│       ├── websocket.ts             # FoodlyWebSocket class
│       ├── api.ts                   # HTTP API calls + TypeScript types
│       └── supabase.ts              # Supabase client
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql   # Core tables + pgvector
        ├── 002_add_session_details.sql  # details jsonb column
        └── 003_add_saved_recipes.sql    # saved_recipes table
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Expo Go](https://expo.dev/go) installed on your phone
- A Google account with [Google AI Studio](https://aistudio.google.com) access
- A [Supabase](https://supabase.com) account (free tier works)

---

### 1. Get a Gemini API key

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API key** and copy it

---

### 2. Set up Supabase

1. Create a new project at [https://supabase.com](https://supabase.com)
2. Go to **SQL Editor → New query**
3. Run each migration file in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_add_session_details.sql`
   - `supabase/migrations/003_add_saved_recipes.sql`
4. Collect from **Project Settings → API**:
   - Project URL
   - `anon` public key
   - `service_role` secret key
   - JWT secret (under JWT Settings)

---

### 3. Run the backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1       # PowerShell
# or: source venv/bin/activate    # macOS/Linux

pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env`:

```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
GEMINI_LIVE_MODEL=models/gemini-2.0-flash-live-001
```

Start the server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify: open `http://localhost:8000/health` — should return `{"status":"ok"}`.

---

### 4. Run the mobile app

```bash
cd mobile
npm install --legacy-peer-deps
copy .env.example .env
```

Edit `mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_BACKEND_WS_URL=ws://YOUR_LOCAL_IP:8000
EXPO_PUBLIC_BACKEND_HTTP_URL=http://YOUR_LOCAL_IP:8000
```

> **Important:** Use your computer's local network IP (not `localhost`). Run `ipconfig` in PowerShell and find the IPv4 address under your Wi-Fi adapter (e.g. `192.168.1.42`). Your phone and computer must be on the same Wi-Fi.

```bash
npx expo start
```

Scan the QR code with **Expo Go**.

---

### 5. Using the app

1. Sign up with any email and password
2. Go to **Profile** and set your skill level and dietary restrictions
3. On **Cook**, type what you're making or pick a quick-start recipe and tap **Start Cooking**
4. Grant camera and microphone permissions — Foodly will greet you first
5. Place your phone on a stand pointing at your workspace and cook
6. Tap **End Session** when done — your session is summarized and saved
7. View the full breakdown under **History** → tap any session
8. Use the **Recipes** tab to ask Foodly for any recipe on demand

---

## Environment variables reference

### backend/.env

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (never expose to client) |
| `SUPABASE_JWT_SECRET` | Used to verify Supabase JWTs on WebSocket connections |
| `GEMINI_LIVE_MODEL` | Live model ID (default: `models/gemini-2.0-flash-live-001`) |

### mobile/.env

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key (safe to expose to client) |
| `EXPO_PUBLIC_BACKEND_WS_URL` | WebSocket URL of your backend |
| `EXPO_PUBLIC_BACKEND_HTTP_URL` | HTTP URL of your backend |

---

## Common issues

**"WebSocket connection failed"** — Your phone can't reach the backend. Confirm both devices are on the same Wi-Fi and that you used your computer's local IP in `mobile/.env`.

**"Unauthorized" on WebSocket** — The `SUPABASE_JWT_SECRET` in `backend/.env` doesn't match your Supabase project's JWT secret.

**`uvicorn` not recognized** — Virtual environment isn't activated. Run `.\venv\Scripts\Activate.ps1` first.

**pgvector extension error** — Go to Supabase → Database → Extensions, enable **pgvector** manually, then re-run `001_initial_schema.sql`.

**Recipe generation fails** — Confirm your Gemini API key has access to `gemini-2.5-flash-lite` in Google AI Studio. The recipe endpoint uses the REST v1 API directly.

**Session saves immediately without listening** — This happens when `response_modalities` includes TEXT alongside AUDIO in the Gemini Live config. The backend only uses `["AUDIO"]`.
