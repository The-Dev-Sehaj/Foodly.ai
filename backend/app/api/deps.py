from fastapi import HTTPException, Header
from supabase import Client
from app.database import get_supabase


def get_db() -> Client:
    return get_supabase()


def verify_token(authorization: str = Header(...)) -> str:
    """Extract and verify Supabase JWT via Supabase API, return user_id."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.removeprefix("Bearer ")
    user_id = verify_token_raw(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


def verify_token_raw(token: str) -> str | None:
    """Verify a raw JWT string using Supabase's own auth API."""
    try:
        db = get_supabase()
        response = db.auth.get_user(token)
        if response.user:
            return str(response.user.id)
        return None
    except Exception as e:
        print(f"[auth] Token verification failed: {e}")
        return None


def get_user_info(token: str) -> tuple[str, str] | None:
    """Return (user_id, email) from a Supabase JWT."""
    try:
        db = get_supabase()
        response = db.auth.get_user(token)
        if response.user:
            return str(response.user.id), response.user.email or ""
        return None
    except Exception:
        return None
