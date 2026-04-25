from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from app.api.deps import get_db, verify_token
from app.services.memory_service import add_user_note

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    dietary_restrictions: list[str] | None = None
    skill_level: str | None = None
    equipment: list[str] | None = None


class NoteCreate(BaseModel):
    note: str


@router.get("")
async def get_profile(
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    result = db.table("users").select("*").eq("id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.patch("")
async def update_profile(
    body: ProfileUpdate,
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = db.table("users").update(updates).eq("id", user_id).execute()
    return result.data[0] if result.data else {}


@router.get("/notes")
async def get_notes(
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    result = (
        db.table("user_notes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return {"notes": result.data or []}


@router.post("/notes")
async def create_note(
    body: NoteCreate,
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    await add_user_note(user_id, body.note, db)
    return {"status": "ok"}
