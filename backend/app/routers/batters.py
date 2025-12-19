"""Batter-related API endpoints."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services import get_batter_profile, get_batters_batch_fast, lookup_player_id, get_player_info, get_players_info_batch
from app.models import BatterProfile
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/{batter_id}", response_model=BatterProfile)
async def get_batter(
    batter_id: int,
    season: Optional[int] = Query(None, description="Season year (defaults to current)")
):
    """
    Get a batter's profile with performance vs each pitch type.
    
    Includes:
    - Run value vs each pitch type (positive = good for batter)
    - Batting average / slugging vs each pitch
    - HR rate
    - Whiff rate
    - Sample size (pitches seen)
    """
    season = season or settings.current_season
    
    profile = await get_batter_profile(batter_id, season)
    
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"Batter {batter_id} not found or has no data for {season}"
        )
    
    # Supplement with MLB API data for name/team
    player_info = await get_player_info(batter_id)
    if player_info:
        profile.name = player_info.get("name", profile.name)
        profile.team = player_info.get("team", profile.team)
        profile.bats = player_info.get("bats", profile.bats)
    
    return profile


@router.get("/{batter_id}/vs-pitch/{pitch_type}")
async def get_batter_vs_pitch(
    batter_id: int,
    pitch_type: str,
    season: Optional[int] = Query(None)
):
    """
    Get a batter's performance against a specific pitch type.
    """
    season = season or settings.current_season
    
    profile = await get_batter_profile(batter_id, season)
    
    if not profile:
        raise HTTPException(status_code=404, detail="Batter not found")
    
    # Find the pitch type
    pitch_type_upper = pitch_type.upper()
    vs_pitch = next(
        (p for p in profile.vs_pitch_types if p.pitch_type == pitch_type_upper),
        None
    )
    
    if not vs_pitch:
        raise HTTPException(
            status_code=404,
            detail=f"No data for batter {batter_id} vs {pitch_type}"
        )
    
    player_info = await get_player_info(batter_id)
    batter_name = player_info.get("name", "Unknown") if player_info else "Unknown"
    
    return {
        "batter_id": batter_id,
        "batter_name": batter_name,
        "pitch_type": vs_pitch.pitch_type,
        "pitch_name": vs_pitch.pitch_name,
        "pitches_seen": vs_pitch.pitches_seen,
        "run_value": vs_pitch.run_value,
        "batting_avg": vs_pitch.batting_avg,
        "slg_pct": vs_pitch.slg_pct,
        "hr_rate": vs_pitch.hr_rate,
        "whiff_pct": vs_pitch.whiff_pct
    }


@router.get("/lookup/{last_name}/{first_name}")
async def lookup_batter_by_name(last_name: str, first_name: str):
    """Look up a batter's ID by name."""
    player_id = await lookup_player_id(first_name, last_name)
    
    if not player_id:
        raise HTTPException(status_code=404, detail=f"Batter {first_name} {last_name} not found")
    
    return {"batter_id": player_id, "name": f"{first_name} {last_name}"}


@router.post("/batch")
async def get_batters_batch(
    batter_ids: list[int],
    season: Optional[int] = Query(None)
):
    """
    Get profiles for multiple batters at once.
    Useful for fetching entire lineup data.
    Uses cached season data for much faster performance.
    """
    season = season or settings.current_season
    
    # Use fast batch function that uses cached season data
    profiles = await get_batters_batch_fast(batter_ids, season)
    
    if not profiles:
        return []
    
    # Get all player info in one batch call
    profile_ids = [p.batter_id for p in profiles]
    player_infos = await get_players_info_batch(profile_ids)
    
    # Update profiles with names and teams
    for profile in profiles:
        info = player_infos.get(profile.batter_id, {})
        if info:
            profile.name = info.get("name", profile.name)
            profile.team = info.get("team", profile.team)
            if info.get("bats"):
                profile.bats = info.get("bats")
    
    return profiles
