from fastapi import HTTPException, Header
from jose import jwt, JWTError
from supabase import Client
from app.config import settings
from app.database import get_supabase


def get_db() -> Client:
    return get_supabase()


def verify_token(authorization: str = Header(...)) -> str:
    """Extract and verify Supabase JWT, return user_id."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def verify_token_raw(token: str) -> str:
    """Verify a raw JWT string (used in WebSocket handshakes)."""
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return user_id
    except JWTError:
        return None
