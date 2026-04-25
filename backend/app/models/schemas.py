from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserProfile(BaseModel):
    id: UUID
    email: str
    dietary_restrictions: list[str] = []
    skill_level: str = "beginner"
    equipment: list[str] = []


class RecipeCooked(BaseModel):
    id: UUID
    user_id: UUID
    recipe_name: str
    date: datetime
    rating: Optional[int] = None
    completion: float = 0.0


class UserNote(BaseModel):
    id: UUID
    user_id: UUID
    note: str
    created_at: datetime


class CookingSession(BaseModel):
    id: UUID
    user_id: UUID
    recipe_name: Optional[str] = None
    summary: Optional[str] = None
    duration_seconds: Optional[int] = None
    completion_percentage: int = 0
    created_at: datetime


class UserContext(BaseModel):
    profile: Optional[UserProfile] = None
    recent_sessions: list[CookingSession] = []
    user_notes: list[UserNote] = []
    relevant_memories: list[str] = []


class SessionRating(BaseModel):
    rating: int = Field(ge=1, le=5)
    notes: Optional[str] = None
