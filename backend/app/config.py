from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings."""
    
    app_name: str = "YardWatch API"
    debug: bool = False
    
    # Cache settings (in seconds)
    cache_ttl_pitchers: int = 3600  # 1 hour
    cache_ttl_batters: int = 3600
    cache_ttl_lineups: int = 300  # 5 minutes (lineups change)
    
    # Data settings
    current_season: int = 2025
    min_pitches_for_pitch_type: int = 50  # Min pitches to include a pitch type
    
    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
