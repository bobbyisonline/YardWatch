"""Game and lineup-related API endpoints."""

from fastapi import APIRouter, HTTPException, Query
from datetime import date, datetime
from typing import Optional

from app.services import get_todays_games, get_games_for_date, get_game_with_lineups, search_players
from app.models import Game, GameSummary

router = APIRouter()


@router.get("/today", response_model=list[GameSummary])
async def get_today_schedule():
    """
    Get today's MLB schedule with probable pitchers.
    """
    games = await get_todays_games()
    return games


@router.get("/schedule/{date_str}", response_model=list[GameSummary])
async def get_schedule_for_date(date_str: str):
    """
    Get MLB schedule for a specific date.
    
    Date format: YYYY-MM-DD
    """
    try:
        game_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    games = await get_games_for_date(game_date)
    return games


@router.get("/{game_id}", response_model=Game)
async def get_game(game_id: str):
    """
    Get full game details including lineups.
    
    Note: Lineups are typically available 2-4 hours before game time.
    Before lineups are posted, the lineup arrays will be empty.
    """
    game = await get_game_with_lineups(game_id)
    
    if not game:
        raise HTTPException(status_code=404, detail=f"Game {game_id} not found")
    
    return game


@router.get("/{game_id}/matchups")
async def get_game_matchups(
    game_id: str,
    team: str = Query(..., description="'home' or 'away' - which team's batters to analyze")
):
    """
    Get matchup data for a game.
    
    Returns the opposing pitcher's attack pitch and the lineup to analyze.
    This is the main endpoint for setting up HR predictions.
    """
    game = await get_game_with_lineups(game_id)
    
    if not game:
        raise HTTPException(status_code=404, detail=f"Game {game_id} not found")
    
    team_lower = team.lower()
    
    if team_lower == "home":
        # Home batters vs away pitcher
        lineup = game.home_team.lineup
        opposing_pitcher_id = game.away_team.starting_pitcher_id
        opposing_pitcher_name = game.away_team.starting_pitcher_name
        batting_team = game.home_team.team_name
    elif team_lower == "away":
        # Away batters vs home pitcher
        lineup = game.away_team.lineup
        opposing_pitcher_id = game.home_team.starting_pitcher_id
        opposing_pitcher_name = game.home_team.starting_pitcher_name
        batting_team = game.away_team.team_name
    else:
        raise HTTPException(status_code=400, detail="team must be 'home' or 'away'")
    
    if not opposing_pitcher_id:
        return {
            "game_id": game_id,
            "batting_team": batting_team,
            "error": "Opposing starting pitcher not yet announced",
            "lineup": [{"batter_id": p.batter_id, "name": p.name, "order": p.batting_order} for p in lineup]
        }
    
    return {
        "game_id": game_id,
        "game_date": game.game_date.isoformat(),
        "batting_team": batting_team,
        "opposing_pitcher_id": opposing_pitcher_id,
        "opposing_pitcher_name": opposing_pitcher_name,
        "lineup": [
            {
                "batter_id": p.batter_id,
                "name": p.name,
                "batting_order": p.batting_order,
                "position": p.position
            }
            for p in lineup
        ],
        "lineup_available": len(lineup) > 0
    }


@router.get("/search/players")
async def search_for_players(q: str = Query(..., min_length=2)):
    """Search for players by name."""
    results = await search_players(q)
    return results
