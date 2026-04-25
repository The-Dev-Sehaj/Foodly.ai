from fastapi import APIRouter, Depends
from supabase import Client
from app.api.deps import get_db, verify_token
from app.services.memory_service import get_session_history

router = APIRouter(prefix="/history", tags=["history"])


@router.get("")
async def get_history(
    limit: int = 20,
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    sessions = await get_session_history(user_id, db, limit=limit)
    return {"sessions": sessions}


@router.get("/{session_id}")
async def get_session_detail(
    session_id: str,
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    result = (
        db.table("cooking_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    steps = (
        db.table("recipe_steps")
        .select("*")
        .eq("session_id", session_id)
        .execute()
    )
    ingredients = (
        db.table("ingredients_used")
        .select("*")
        .eq("session_id", session_id)
        .execute()
    )

    return {
        "session": result.data,
        "steps": steps.data or [],
        "ingredients": ingredients.data or [],
    }
