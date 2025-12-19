"""Pitcher-related API endpoints."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services import get_pitcher_profile, lookup_player_id, get_player_info
from app.models import PitcherProfile, PitcherSummary
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/{pitcher_id}", response_model=PitcherProfile)
async def get_pitcher(
    pitcher_id: int,
    season: Optional[int] = Query(None, description="Season year (defaults to current)")
):
    """
    Get a pitcher's full profile with pitch-type breakdowns.
    
    Includes:
    - Usage percentages for each pitch type
    - Run values (negative = bad for pitcher)
    - Batting average / slugging against
    - HR rate per pitch
    - Whiff rates
    """
    season = season or settings.current_season
    
    profile = await get_pitcher_profile(pitcher_id, season)
    
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"Pitcher {pitcher_id} not found or has no data for {season}"
        )
    
    # Supplement with MLB API data for name/team if needed
    if profile.name == "Unknown":
        player_info = await get_player_info(pitcher_id)
        if player_info:
            profile.name = player_info.get("name", "Unknown")
            profile.team = player_info.get("team", profile.team)
    
    return profile


@router.get("/{pitcher_id}/attack-pitch")
async def get_attack_pitch(
    pitcher_id: int,
    season: Optional[int] = Query(None)
):
    """
    Get the pitcher's most exploitable pitch (attack pitch).
    
    Logic: Among top 2 most-used pitches, returns the one with 
    the worst (most negative) run value.
    """
    season = season or settings.current_season
    
    profile = await get_pitcher_profile(pitcher_id, season)
    
    if not profile or not profile.pitches:
        raise HTTPException(status_code=404, detail="Pitcher not found or has no pitch data")
    
    # Get top 2 by usage
    top_pitches = sorted(profile.pitches, key=lambda p: p.usage_pct, reverse=True)[:2]
    
    if not top_pitches:
        raise HTTPException(status_code=404, detail="No pitch data available")
    
    # Find the one with worst (most negative) run value for pitcher
    # More negative run_value = worse for pitcher = attack pitch
    attack_pitch = min(top_pitches, key=lambda p: p.run_value_per_100)
    
    return {
        "pitcher_id": pitcher_id,
        "pitcher_name": profile.name,
        "attack_pitch": attack_pitch.pitch_type,
        "attack_pitch_name": attack_pitch.pitch_name,
        "usage_pct": attack_pitch.usage_pct,
        "run_value": attack_pitch.run_value,
        "run_value_per_100": attack_pitch.run_value_per_100,
        "hr_rate": attack_pitch.hr_rate,
        "top_pitches_considered": [
            {"pitch": p.pitch_type, "name": p.pitch_name, "usage": p.usage_pct, "rv_per_100": p.run_value_per_100}
            for p in top_pitches
        ]
    }


@router.get("/lookup/{last_name}/{first_name}")
async def lookup_pitcher_by_name(last_name: str, first_name: str):
    """Look up a pitcher's ID by name."""
    player_id = await lookup_player_id(first_name, last_name)
    
    if not player_id:
        raise HTTPException(status_code=404, detail=f"Pitcher {first_name} {last_name} not found")
    
    return {"pitcher_id": player_id, "name": f"{first_name} {last_name}"}
