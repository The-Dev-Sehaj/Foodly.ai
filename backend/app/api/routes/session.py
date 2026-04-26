import asyncio
import base64
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.deps import verify_token_raw, get_user_info, get_db
from app.services.gemini_live import GeminiLiveSession, build_system_prompt
from app.services.memory_service import load_user_context, save_session, search_memories

router = APIRouter(tags=["session"])


@router.websocket("/ws/session")
async def cooking_session(websocket: WebSocket):
    await websocket.accept()
    db = get_db()

    # ── 1. Auth handshake ────────────────────────────────────────
    async def reject(reason: str):
        try:
            await websocket.close(code=1008, reason=reason)
        except Exception:
            pass

    try:
        init_raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        init_msg = json.loads(init_raw)
    except (asyncio.TimeoutError, Exception):
        await reject("Expected init message")
        return

    if init_msg.get("type") != "init" or not init_msg.get("token"):
        await reject("Invalid init message")
        return

    user_info = get_user_info(init_msg["token"])
    print(f"[session] user_info resolved: {user_info}")
    if not user_info:
        await reject("Unauthorized")
        return
    user_id, user_email = user_info

    # Ensure user row exists in public.users (trigger may not have fired on signup)
    try:
        db.table("users").upsert({"id": user_id, "email": user_email}).execute()
    except Exception as e:
        print(f"[session] User upsert warning: {e}")

    recipe_name: str | None = init_msg.get("recipe")

    # ── 2. Build system prompt with user memory ──────────────────
    try:
        context = await load_user_context(user_id, db)
        print(f"[session] profile loaded: skill={context.get('profile', {}).get('skill_level')} dietary={context.get('profile', {}).get('dietary_restrictions')}")
    except Exception as e:
        print(f"[session] load_user_context failed: {e}")
        context = {}

    if recipe_name:
        try:
            memories = await search_memories(user_id, recipe_name, db)
            context["relevant_memories"] = memories
        except Exception as e:
            print(f"[session] search_memories failed (non-fatal): {e}")
            context["relevant_memories"] = []

    system_prompt = build_system_prompt(context)

    # ── 3. Session event log ─────────────────────────────────────
    events: list[dict] = []
    gemini_transcript: list[str] = []
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
                    try:
                        await gemini.send_audio(pcm_data)
                        log_event("audio_in", f"{len(pcm_data)} bytes")
                    except Exception as e:
                        print(f"[session] audio send error (non-fatal): {type(e).__name__}: {e}")

                elif msg_type == "video":
                    jpeg_data = base64.b64decode(msg["data"])
                    try:
                        await gemini.send_video_frame(jpeg_data)
                    except Exception as e:
                        print(f"[session] video send error (non-fatal): {type(e).__name__}: {e}")

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
            print("[session] client disconnected")
            session_stopped.set()
        except Exception as e:
            print(f"[session] client_to_gemini fatal error: {type(e).__name__}: {e}")
            session_stopped.set()

    async def gemini_to_client(gemini: GeminiLiveSession):
        turn = 0
        try:
            while not session_stopped.is_set():
                turn += 1
                print(f"[gemini] waiting for turn {turn}...")
                async for audio_chunk in gemini.receive():
                    if session_stopped.is_set():
                        break
                    encoded = base64.b64encode(audio_chunk).decode()
                    await websocket.send_text(json.dumps({"type": "audio", "data": encoded}))
                    log_event("audio_out", f"{len(audio_chunk)} bytes")
                print(f"[gemini] turn {turn} done, stopped={session_stopped.is_set()}")
                await asyncio.sleep(0)
        except Exception as e:
            print(f"[gemini] receive error turn {turn}: {type(e).__name__}: {e}")
            session_stopped.set()

    try:
        print("[session] Connecting to Gemini Live...")
        async with GeminiLiveSession(system_prompt) as gemini:
            print("[session] Gemini connected, starting relay")
            relay = [
                asyncio.create_task(client_to_gemini(gemini)),
                asyncio.create_task(gemini_to_client(gemini)),
            ]
            # Let both tasks reach their first await so gemini_to_client
            # is already listening before the greeting is sent.
            await asyncio.sleep(0.3)
            if recipe_name:
                greeting = (
                    f"The user just started a session to cook {recipe_name}. "
                    f"Greet them warmly, confirm you're ready to help with {recipe_name}, "
                    f"and ask if they have their ingredients ready."
                )
            else:
                greeting = (
                    "The user just opened a free cooking session. "
                    "Greet them warmly as Foodly and ask what they'd like to cook today."
                )
            try:
                await gemini.send_text(greeting)
            except Exception as e:
                print(f"[session] greeting failed (non-fatal): {e}")
            done, pending = await asyncio.wait(relay, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
    except Exception as e:
        print(f"[session] Gemini connection failed: {type(e).__name__}: {e}")

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
            transcript=gemini_transcript,
            db=db,
        )
        await websocket.send_text(
            json.dumps({
                "type": "session_end",
                "session_id": session_id,
                "duration_seconds": duration,
            })
        )
    except Exception as e:
        print(f"[session] Failed to save session: {type(e).__name__}: {e}")

    try:
        await websocket.close()
    except Exception:
        pass
