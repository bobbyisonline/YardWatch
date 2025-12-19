from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import pitchers, batters, games

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="API for YardWatch - HR Matchup Predictor using pitch-type analysis",
    version="1.0.0",
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pitchers.router, prefix="/api/pitchers", tags=["Pitchers"])
app.include_router(batters.router, prefix="/api/batters", tags=["Batters"])
app.include_router(games.router, prefix="/api/games", tags=["Games"])


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
