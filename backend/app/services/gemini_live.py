import asyncio
from typing import AsyncGenerator
from google import genai
from google.genai import types
from app.config import settings

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options={"api_version": "v1beta"},
        )
    return _client


SYSTEM_PROMPT_TEMPLATE = """\
You are Foodly, an AI cooking assistant with live camera vision and voice. \
You watch through the user's camera and listen as they cook in real-time.

Your job:
- Guide them step-by-step through cooking
- Give short, visual feedback on what you see (e.g. "that's enough tomatoes", "stir more", "onions look golden")
- Remind them of personal tips from their history (e.g. "don't forget the salt — you skipped it last time")
- Keep ALL responses SHORT and ACTION-ORIENTED (user's hands are busy)
- Speak naturally and encouragingly

User Profile:
  Dietary restrictions: {dietary_restrictions}
  Skill level: {skill_level}
  Equipment: {equipment}

Recent cooking sessions:
{recent_sessions}

Personal notes about this user:
{user_notes}

Relevant past experiences:
{relevant_memories}

Rules: Be brief. If you see something needs attention, say it immediately. \
Max 2 sentences per response unless explaining a complex step."""


def build_system_prompt(context: dict) -> str:
    recent = "\n".join(
        f"  - {s['recipe_name']} ({s['date'][:10]}): {s.get('summary', 'no summary')}"
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
        result = await get_client().aio.models.embed_content(
            model="models/text-embedding-004",
            contents=text,
        )
        return result.embeddings[0].values
    except Exception as e:
        print(f"[embedding] failed: {e}")
        return []


async def summarize_session(events: list[dict]) -> str:
    """Ask Gemini to summarize a cooking session from logged events."""
    try:
        event_log = "\n".join(
            f"[{e['time']}] {e['type']}: {e.get('detail', '')}" for e in events[:50]
        )
        prompt = (
            "Summarize this cooking session in 2-3 sentences for memory storage. "
            "Focus on what was cooked, any issues, and what the user did well or struggled with:\n\n"
            + event_log
        )
        response = await get_client().aio.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        print(f"[summarize] failed, using fallback: {e}")
        audio_turns = sum(1 for ev in events if ev["type"] == "audio_in")
        return f"Cooking session with {audio_turns} audio exchanges."
