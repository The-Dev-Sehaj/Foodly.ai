import json
import re
import httpx
from uuid import uuid4
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from app.api.deps import get_db, verify_token
from app.config import settings

router = APIRouter(prefix="/recipes", tags=["recipes"])


class RecipeQuery(BaseModel):
    query: str


def _extract_json(text: str) -> str:
    """Strip markdown code fences and extract the raw JSON string."""
    text = text.strip()
    # Handle ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text


async def _generate_recipe(query: str) -> dict:
    prompt = f"""Generate a detailed recipe based on this request: "{query}"

Return ONLY a valid JSON object — no markdown, no explanation:
{{
  "title": "Recipe name",
  "description": "1-2 sentence description of the dish",
  "cooking_time": "e.g. 30 minutes",
  "servings": 2,
  "difficulty": "beginner",
  "ingredients": [
    {{"name": "ingredient name", "amount": "quantity and unit"}},
    {{"name": "ingredient name", "amount": "quantity and unit"}}
  ],
  "steps": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "tips": [
    "Tip 1",
    "Tip 2"
  ]
}}

difficulty must be one of: beginner, intermediate, advanced.
Be practical, accurate, and delicious."""

    url = (
        f"https://generativelanguage.googleapis.com/v1/models/"
        f"gemini-2.5-flash-lite:generateContent?key={settings.GEMINI_API_KEY}"
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    raw = data["candidates"][0]["content"]["parts"][0]["text"]
    print(f"[recipes] raw response: {raw[:300]}")
    text = _extract_json(raw)
    return json.loads(text)


@router.post("/generate")
async def generate_recipe(
    body: RecipeQuery,
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    try:
        data = await _generate_recipe(body.query)
    except Exception as e:
        print(f"[recipes] ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Recipe generation failed: {e}")

    recipe_id = str(uuid4())
    row = {
        "id": recipe_id,
        "user_id": user_id,
        "title": data.get("title", "Untitled Recipe"),
        "description": data.get("description"),
        "cooking_time": data.get("cooking_time"),
        "servings": data.get("servings"),
        "difficulty": data.get("difficulty", "beginner"),
        "ingredients": data.get("ingredients", []),
        "steps": data.get("steps", []),
        "tips": data.get("tips", []),
        "query": body.query,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.table("saved_recipes").insert(row).execute()
    return {"recipe": row}


@router.get("")
async def get_recipes(
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    result = (
        db.table("saved_recipes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"recipes": result.data or []}


@router.delete("/{recipe_id}")
async def delete_recipe(
    recipe_id: str,
    user_id: str = Depends(verify_token),
    db: Client = Depends(get_db),
):
    check = (
        db.table("saved_recipes")
        .select("id")
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.table("saved_recipes").delete().eq("id", recipe_id).execute()
    return {"deleted": recipe_id}
