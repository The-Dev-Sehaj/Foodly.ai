# Foodly.ai

An AI-powered live cooking assistant that watches you cook through your phone camera, guides you step-by-step, and remembers your habits across every session.

Point your phone at the stove and Foodly tells you when to stir, whether you've added enough ingredients, and reminds you of things you tend to forget — like salt.

---

## What makes it different

Most AI assistants have no memory between conversations. Foodly remembers your past cooking sessions — what recipes you made, what you struggled with, what substitutions you used — and injects that context into every new session. After you finish cooking, it summarizes the session and stores a vector embedding so future sessions can semantically recall relevant past experiences.

---

## Stack

| Layer | Technology |
|---|---|
| Mobile app | React Native (Expo SDK 52, Expo Router) |
| Live AI | Gemini 2.0 Flash Live API (real-time video + audio) |
| Backend | Python FastAPI (WebSocket proxy) |
| Database | Supabase (PostgreSQL + pgvector) |
| Embeddings | Gemini text-embedding-004 (768 dimensions) |
| Auth | Supabase Auth |

---

## How it works

```
Phone camera + microphone
        ↓  WebSocket
  FastAPI backend
        ↓  loads user profile + past sessions from Supabase
        ↓  builds system prompt with memory context
        ↓  Gemini Live API (bidirectional audio/video stream)
        ↓  audio response back to phone
  Session ends → summarize → embed → store in pgvector
```

1. User opens the app and logs in
2. Types or selects a recipe and taps **Start Cooking**
3. Backend loads their profile, last 5 sessions, personal notes, and semantically similar past sessions — all injected into Gemini's system prompt
4. Phone streams audio chunks (16kHz PCM) and video frames (JPEG at ~0.7 FPS) to the backend over WebSocket
5. Backend forwards everything to Gemini Live API
6. Gemini responds in audio (24kHz PCM), backend streams it back to the phone
7. When the session ends, Gemini summarizes what happened, the summary is embedded and stored in Supabase for future recall

---

## Database schema

```
users               → dietary restrictions, skill level, equipment
cooking_sessions    → recipe name, summary, pgvector embedding(768), duration
recipe_steps        → which steps were skipped or struggled with
ingredients_used    → quantities and substitutions made
user_notes          → persistent tips ("user always burns garlic")
```

Semantic search is handled by a `match_cooking_sessions()` PostgreSQL function using pgvector's HNSW index.

---

## Project structure

```
Foodly.ai/
├── backend/                    # Python FastAPI server
│   ├── app/
│   │   ├── main.py             # App entry point
│   │   ├── config.py           # Environment settings
│   │   ├── database.py         # Supabase client
│   │   ├── api/routes/
│   │   │   ├── session.py      # /ws/session  — live cooking WebSocket
│   │   │   ├── history.py      # GET /api/history
│   │   │   └── profile.py      # GET/PATCH /api/profile
│   │   └── services/
│   │       ├── gemini_live.py  # Gemini Live session, embeddings, summarization
│   │       └── memory_service.py # Load/save context, pgvector search
│   └── requirements.txt
├── mobile/                     # Expo React Native app
│   ├── app/
│   │   ├── (auth)/login.tsx    # Sign in / sign up
│   │   ├── (tabs)/index.tsx    # Home — start a session
│   │   ├── (tabs)/history.tsx  # Past sessions
│   │   ├── (tabs)/profile.tsx  # Dietary restrictions, skill level
│   │   └── session.tsx         # Live cooking screen (camera + audio)
│   ├── hooks/useSession.ts     # Audio chunking, WebSocket lifecycle
│   ├── services/
│   │   ├── websocket.ts        # FoodlyWebSocket class
│   │   ├── api.ts              # HTTP API calls
│   │   └── supabase.ts         # Supabase client
│   └── components/
│       └── AudioVisualizer.tsx # Animated audio waveform bars
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Expo Go](https://expo.dev/go) app installed on your phone
- A Google account with access to [Google AI Studio](https://aistudio.google.com)
- A [Supabase](https://supabase.com) account (free tier works)

---

### 1. Get a Gemini API key

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API key** and copy it

---

### 2. Set up Supabase

1. Create a new project at [https://supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New query**
3. Paste the entire contents of `supabase/migrations/001_initial_schema.sql` and click **Run**
4. Collect these four values from **Project Settings → API**:
   - Project URL
   - `anon` public key
   - `service_role` secret key
   - JWT secret (under JWT Settings)

---

### 3. Run the backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1      # PowerShell
# or: source venv/bin/activate   # bash/macOS

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env
```

Edit `backend/.env` and fill in your values:

```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
GEMINI_LIVE_MODEL=models/gemini-2.0-flash-live-001
GEMINI_EMBEDDING_MODEL=models/text-embedding-004
```

Start the server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify it's running: open `http://localhost:8000/health` in a browser — you should see `{"status":"ok"}`.

---

### 4. Run the mobile app

Open a second terminal:

```bash
cd mobile

# Install dependencies
npm install --legacy-peer-deps

# Create .env file
copy .env.example .env
```

Edit `mobile/.env` and fill in your values:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_BACKEND_WS_URL=ws://YOUR_LOCAL_IP:8000
EXPO_PUBLIC_BACKEND_HTTP_URL=http://YOUR_LOCAL_IP:8000
```

> **Important:** Replace `YOUR_LOCAL_IP` with your computer's local network IP address (not `localhost`). Find it by running `ipconfig` in PowerShell and looking for the IPv4 address under your Wi-Fi adapter (e.g. `192.168.1.42`). Your phone and computer must be on the same Wi-Fi network.

Start Expo:

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone.

---

### 5. Using the app

1. Sign up with any email and password on the login screen
2. On the home screen, type what you're making or pick a quick-start recipe
3. Tap **Start Cooking** — grant camera and microphone permissions when prompted
4. Place your phone on a stand pointing at your workspace and start cooking
5. Foodly will watch and listen, guiding you in real time
6. Tap **End Session** when done — your session is summarized and saved automatically
7. View past sessions under the **History** tab

---

## Environment variables reference

### backend/.env

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (server-side only, never expose to client) |
| `SUPABASE_JWT_SECRET` | Used to verify Supabase JWTs on incoming WebSocket connections |
| `GEMINI_LIVE_MODEL` | Live model ID (default: `models/gemini-2.0-flash-live-001`) |
| `GEMINI_EMBEDDING_MODEL` | Embedding model ID (default: `models/text-embedding-004`) |

### mobile/.env

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key (safe to expose to client) |
| `EXPO_PUBLIC_BACKEND_WS_URL` | WebSocket URL of your backend (use local IP, not localhost) |
| `EXPO_PUBLIC_BACKEND_HTTP_URL` | HTTP URL of your backend |

---

## Common issues

**"WebSocket connection failed"** — Your phone can't reach the backend. Check that both devices are on the same Wi-Fi and that you used your computer's local IP (not `localhost`) in `mobile/.env`.

**"Unauthorized" on WebSocket** — The `SUPABASE_JWT_SECRET` in `backend/.env` doesn't match your Supabase project's JWT secret.

**`uvicorn` not recognized** — Your virtual environment isn't activated. Run `.\venv\Scripts\Activate.ps1` first, or use `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.

**pgvector extension error** — Go to Supabase → Database → Extensions, enable **pgvector** manually, then re-run the migration SQL.

**Gemini API errors** — Confirm your API key has access to `gemini-2.0-flash-live-001` in Google AI Studio.
