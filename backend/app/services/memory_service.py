from uuid import UUID, uuid4
from datetime import datetime, timezone
from supabase import Client
from app.services.gemini_live import generate_embedding, summarize_session


async def load_user_context(user_id: str, db: Client) -> dict:
    """Load user profile, recent sessions, notes, and relevant memories."""
    profile_res = db.table("users").select("*").eq("id", user_id).single().execute()
    profile = profile_res.data or {}

    sessions_res = (
        db.table("cooking_sessions")
        .select("id, recipe_name, summary, created_at, completion_percentage")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    recent_sessions = sessions_res.data or []

    notes_res = (
        db.table("user_notes")
        .select("note, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    user_notes = notes_res.data or []

    return {
        "profile": profile,
        "recent_sessions": recent_sessions,
        "user_notes": user_notes,
        "relevant_memories": [],
    }


async def search_memories(user_id: str, query: str, db: Client, limit: int = 3) -> list[str]:
    """Semantic search over past session summaries using pgvector."""
    embedding = await generate_embedding(query)
    result = db.rpc(
        "match_cooking_sessions",
        {
            "query_embedding": embedding,
            "match_user_id": user_id,
            "match_count": limit,
        },
    ).execute()
    return [row["summary"] for row in (result.data or []) if row.get("summary")]


async def save_session(
    user_id: str,
    recipe_name: str | None,
    events: list[dict],
    completion_percentage: int,
    duration_seconds: int,
    db: Client,
) -> str:
    """Summarize session, embed it, and persist everything to Supabase."""
    session_id = str(uuid4())
    summary = await summarize_session(events)
    embedding = await generate_embedding(summary)

    db.table("cooking_sessions").insert(
        {
            "id": session_id,
            "user_id": user_id,
            "recipe_name": recipe_name,
            "summary": summary,
            "embedding": embedding,
            "duration_seconds": duration_seconds,
            "completion_percentage": completion_percentage,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()

    ingredient_events = [e for e in events if e["type"] == "ingredient"]
    if ingredient_events:
        rows = [
            {
                "session_id": session_id,
                "user_id": user_id,
                "ingredient": e.get("ingredient"),
                "quantity": e.get("quantity"),
                "substitution": e.get("substitution"),
            }
            for e in ingredient_events
        ]
        db.table("ingredients_used").insert(rows).execute()

    return session_id


async def add_user_note(user_id: str, note: str, db: Client):
    db.table("user_notes").insert(
        {
            "id": str(uuid4()),
            "user_id": user_id,
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


async def get_session_history(user_id: str, db: Client, limit: int = 20) -> list[dict]:
    result = (
        db.table("cooking_sessions")
        .select("id, recipe_name, summary, created_at, duration_seconds, completion_percentage")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
