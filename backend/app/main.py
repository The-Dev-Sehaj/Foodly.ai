from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import session, history, profile

app = FastAPI(title="Foodly.ai API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router)
app.include_router(history.router, prefix="/api")
app.include_router(profile.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
