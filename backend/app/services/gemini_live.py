import asyncio
from typing import AsyncGenerator
from google import genai
from google.genai import types
from app.config import settings

_client: genai.Client | None = None
_flash_client: genai.Client | None = None


def get_client() -> genai.Client:
    """v1beta client — required for Gemini Live API."""
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options={"api_version": "v1beta"},
        )
    return _client


def get_flash_client() -> genai.Client:
    """Standard v1 client for generate_content / embed_content calls."""
    global _flash_client
    if _flash_client is None:
        _flash_client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options={"api_version": "v1"},
        )
    return _flash_client


SYSTEM_PROMPT_TEMPLATE = """\
You are Foodly, an AI cooking assistant with live camera vision and voice. \
You watch through the user's camera and listen as they cook in real-time.

Your job:
- Guide them step-by-step through cooking
- Give short, visual feedback on what you see (e.g. "that's enough tomatoes", "stir more", "onions look golden")
- Remind them of personal tips from their history (e.g. "don't forget the salt — you skipped it last time")
- Keep ALL responses SHORT and ACTION-ORIENTED (user's hands are busy)
- Speak naturally and encouragingly

IMPORTANT — User Profile (always apply this):
  Skill level: {skill_level}
    → If beginner: explain every step clearly, don't assume knowledge.
    → If intermediate: give tips and shortcuts, skip obvious basics.
    → If advanced: be concise, focus on technique and refinement.
  Dietary restrictions: {dietary_restrictions}
    → NEVER suggest or allow ingredients that violate these restrictions.
    → If a step involves a restricted ingredient, immediately offer a substitution.
  Equipment: {equipment}

Recent cooking sessions:
{recent_sessions}

Personal notes about this user:
{user_notes}

Relevant past experiences:
{relevant_memories}

Rules: Be brief. If you see something needs attention, say it immediately. \
Max 2 sentences per response unless explaining a complex step.

Special rule — pasta breaking: If and ONLY IF the user explicitly asks whether they should break the pasta, \
respond with exactly: "Mama mia! Don't ever do such a thing. Put it normally." \
Never say this unprompted."""


def build_system_prompt(context: dict) -> str:
    recent = "\n".join(
        f"  - {s['recipe_name']} ({s.get('created_at', '')[:10]}): {s.get('summary', 'no summary')}"
        for s in context.get("recent_sessions", [])
    ) or "  No recent sessions."

    notes = "\n".join(
        f"  - {n['note']}" for n in context.get("user_notes", [])
    ) or "  No personal notes yet."

    memories = "\n".join(
        f"  - {m}" for m in context.get("relevant_memories", [])
    ) or "  No relevant memories."

    profile = context.get("profile", {})
    return SYSTEM_PROMPT_TEMPLATE.format(
        dietary_restrictions=", ".join(profile.get("dietary_restrictions", [])) or "none",
        skill_level=profile.get("skill_level", "beginner"),
        equipment=", ".join(profile.get("equipment", [])) or "standard kitchen equipment",
        recent_sessions=recent,
        user_notes=notes,
        relevant_memories=memories,
    )


class GeminiLiveSession:
    """Manages a single Gemini Live API session for one cooking session."""

    def __init__(self, system_prompt: str):
        self._system_prompt = system_prompt
        self._session = None
        self._ctx = None

    async def __aenter__(self) -> "GeminiLiveSession":
        client = get_client()
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(
                parts=[types.Part(text=self._system_prompt)]
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Zephyr")
                )
            ),
        )
        self._ctx = client.aio.live.connect(
            model=settings.GEMINI_LIVE_MODEL, config=config
        )
        self._session = await self._ctx.__aenter__()
        return self

    async def __aexit__(self, *args):
        if self._ctx:
            await self._ctx.__aexit__(*args)

    async def send_text(self, text: str):
        """Trigger an initial Gemini response using realtime text input."""
        await self._session.send_realtime_input(text=text)

    async def send_audio(self, pcm_data: bytes):
        """Send raw PCM audio (16kHz, 16-bit, mono) to Gemini."""
        if pcm_data[:4] == b'RIFF':
            pcm_data = pcm_data[44:]
        if not pcm_data:
            return
        await self._session.send_realtime_input(
            audio=types.Blob(data=pcm_data, mime_type="audio/pcm;rate=16000")
        )

    async def send_video_frame(self, jpeg_data: bytes):
        """Send a JPEG video frame to Gemini."""
        await self._session.send_realtime_input(
            video=types.Blob(data=jpeg_data, mime_type="image/jpeg")
        )

    async def receive(self) -> AsyncGenerator[bytes, None]:
        """Yield audio response chunks (PCM 24kHz) for one turn, then return."""
        async for response in self._session.receive():
            server_content = getattr(response, "server_content", None)
            if server_content:
                model_turn = getattr(server_content, "model_turn", None)
                if model_turn:
                    for part in getattr(model_turn, "parts", []):
                        inline = getattr(part, "inline_data", None)
                        if inline and getattr(inline, "data", None):
                            yield inline.data
                if getattr(server_content, "turn_complete", False):
                    print("[gemini] turn_complete received, ready for next turn")
                    return


async def generate_embedding(text: str) -> list[float]:
    """Generate a text embedding. Returns empty list on failure."""
    try:
        result = await get_flash_client().aio.models.embed_content(
            model="models/text-embedding-004",
            contents=text,
        )
        return result.embeddings[0].values
    except Exception as e:
        print(f"[embedding] failed: {e}")
        return []


async def summarize_session(
    events: list[dict],
    recipe_name: str | None = None,
    duration_seconds: int = 0,
    transcript: list[str] | None = None,
) -> dict:
    """Generate a structured session summary for storage and the history detail screen."""
    import json as _json
    audio_turns = sum(1 for ev in events if ev["type"] == "audio_in")
    duration_min = max(1, duration_seconds // 60)
    recipe_label = recipe_name or "a free cooking session"

    transcript_section = ""
    if transcript:
        lines = "\n".join(f"- {t}" for t in transcript if t.strip())
        transcript_section = f"\n\nActual transcript of what Foodly said during the session:\n{lines}"
    else:
        transcript_section = f"\n\n(No transcript available — infer from recipe context.)"

    try:
        prompt = f"""You are creating a history entry for a Foodly AI cooking session.

Session info:
- Recipe: {recipe_label}
- Duration: {duration_min} minutes
- User audio interactions: {audio_turns}{transcript_section}

Return ONLY a valid JSON object with exactly these keys — no markdown, no explanation:
{{
  "summary": "2-3 sentence overview of how the session went based on the transcript",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "highlights": ["Specific thing discussed or coached 1", "Specific thing discussed 2", "Specific thing discussed 3"],
  "tips": ["Actionable tip from this session 1", "Actionable tip 2"],
  "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"]
}}

For summary: use the transcript to describe what actually happened, not generic statements.
For steps: the main recipe steps for {recipe_label} (up to 6, concise).
For highlights: pull specific coaching moments or topics from the transcript (up to 4).
For tips: reminders worth keeping for next time based on what came up (up to 3).
For ingredients: any ingredients mentioned in the transcript (up to 10, or infer for {recipe_label})."""

        response = await get_flash_client().aio.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
        import re as _re
        text = response.text.strip()
        match = _re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, _re.DOTALL)
        if match:
            text = match.group(1).strip()
        return _json.loads(text)
    except Exception as e:
        print(f"[summarize] structured summary failed: {e}")
        return {
            "summary": f"Cooking session{f' for {recipe_name}' if recipe_name else ''} with {audio_turns} audio exchanges.",
            "steps": [],
            "highlights": [],
            "tips": [],
            "ingredients": [],
        }
