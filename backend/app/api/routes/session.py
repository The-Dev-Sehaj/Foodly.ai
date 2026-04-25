import asyncio
import base64
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.deps import verify_token_raw, get_db
from app.services.gemini_live import GeminiLiveSession, build_system_prompt
from app.services.memory_service import load_user_context, save_session, search_memories

router = APIRouter(tags=["session"])


@router.websocket("/ws/session")
async def cooking_session(websocket: WebSocket):
    await websocket.accept()
    db = get_db()

    # ── 1. Auth handshake ────────────────────────────────────────
    try:
        init_raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        init_msg = json.loads(init_raw)
    except (asyncio.TimeoutError, Exception):
        await websocket.close(code=1008, reason="Expected init message")
        return

    if init_msg.get("type") != "init" or not init_msg.get("token"):
        await websocket.close(code=1008, reason="Invalid init message")
        return

    user_id = verify_token_raw(init_msg["token"])
    if not user_id:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    recipe_name: str | None = init_msg.get("recipe")

    # ── 2. Build system prompt with user memory ──────────────────
    try:
        context = await load_user_context(user_id, db)
        if recipe_name:
            memories = await search_memories(user_id, recipe_name, db)
            context["relevant_memories"] = memories
        system_prompt = build_system_prompt(context)
    except Exception:
        system_prompt = build_system_prompt({})

    # ── 3. Session event log ─────────────────────────────────────
    events: list[dict] = []
    start_time = time.time()

    def log_event(event_type: str, detail: str = "", **kwargs):
        events.append({
            "time": f"{time.time() - start_time:.1f}s",
            "type": event_type,
            "detail": detail,
            **kwargs,
        })

    log_event("session_start", recipe_name or "open session")
    await websocket.send_text(json.dumps({"type": "ready"}))

    # ── 4. Bidirectional relay with Gemini Live ──────────────────
    session_stopped = asyncio.Event()

    async def client_to_gemini(gemini: GeminiLiveSession):
        try:
            while not session_stopped.is_set():
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "audio":
                    pcm_data = base64.b64decode(msg["data"])
                    await gemini.send_audio(pcm_data)
                    log_event("audio_in", f"{len(pcm_data)} bytes")

                elif msg_type == "video":
                    jpeg_data = base64.b64decode(msg["data"])
                    await gemini.send_video_frame(jpeg_data)

                elif msg_type == "event":
                    log_event(
                        msg.get("event", "user_event"),
                        msg.get("detail", ""),
                        **msg.get("meta", {}),
                    )

                elif msg_type == "end":
                    session_stopped.set()
                    break

        except WebSocketDisconnect:
            session_stopped.set()
        except Exception:
            session_stopped.set()

    async def gemini_to_client(gemini: GeminiLiveSession):
        try:
            async for audio_chunk in gemini.receive():
                if session_stopped.is_set():
                    break
                encoded = base64.b64encode(audio_chunk).decode()
                await websocket.send_text(json.dumps({"type": "audio", "data": encoded}))
                log_event("audio_out", f"{len(audio_chunk)} bytes")
        except Exception:
            session_stopped.set()

    try:
        async with GeminiLiveSession(system_prompt) as gemini:
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(client_to_gemini(gemini)),
                    asyncio.create_task(gemini_to_client(gemini)),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
    except Exception:
        pass

    # ── 5. Persist session ───────────────────────────────────────
    duration = int(time.time() - start_time)
    audio_in_count = sum(1 for e in events if e["type"] == "audio_in")
    completion = min(100, audio_in_count * 2)

    try:
        session_id = await save_session(
            user_id=user_id,
            recipe_name=recipe_name,
            events=events,
            completion_percentage=completion,
            duration_seconds=duration,
            db=db,
        )
        await websocket.send_text(
            json.dumps({
                "type": "session_end",
                "session_id": session_id,
                "duration_seconds": duration,
            })
        )
    except Exception:
        pass

    try:
        await websocket.close()
    except Exception:
        pass
