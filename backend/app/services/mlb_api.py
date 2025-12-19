"""
MLB Stats API service for fetching game schedules and lineups.
The MLB Stats API is free and requires no authentication.
"""

import httpx
from datetime import date, datetime, timedelta
from typing import Optional
from cachetools import TTLCache
import logging

from app.config import get_settings
from app.models import Game, GameSummary, TeamLineup, LineupPlayer

logger = logging.getLogger(__name__)
settings = get_settings()

# Base URL for MLB Stats API
MLB_API_BASE = "https://statsapi.mlb.com/api/v1"

# Cache for lineup data (shorter TTL since lineups change)
_lineup_cache: TTLCache = TTLCache(maxsize=100, ttl=settings.cache_ttl_lineups)
_schedule_cache: TTLCache = TTLCache(maxsize=50, ttl=settings.cache_ttl_lineups)


# Team ID to abbreviation mapping
TEAM_ABBREVS = {
    108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC",
    113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU",
    118: "KC", 119: "LAD", 120: "WSH", 121: "NYM", 133: "OAK",
    134: "PIT", 135: "SD", 136: "SEA", 137: "SF", 138: "STL",
    139: "TB", 140: "TEX", 141: "TOR", 142: "MIN", 143: "PHI",
    144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
}


async def get_todays_games() -> list[GameSummary]:
    """Get today's MLB schedule."""
    return await get_games_for_date(date.today())


async def get_games_for_date(game_date: date) -> list[GameSummary]:
    """Get MLB schedule for a specific date."""
    cache_key = f"schedule_{game_date.isoformat()}"
    
    if cache_key in _schedule_cache:
        return _schedule_cache[cache_key]
    
    date_str = game_date.strftime("%Y-%m-%d")
    url = f"{MLB_API_BASE}/schedule"
    params = {
        "sportId": 1,  # MLB
        "date": date_str,
        "hydrate": "probablePitcher,team"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30.0)
            response.raise_for_status()
            data = response.json()
        
        games = []
        
        for date_entry in data.get("dates", []):
            for game in date_entry.get("games", []):
                game_id = str(game.get("gamePk"))
                
                # Get team info
                home = game.get("teams", {}).get("home", {})
                away = game.get("teams", {}).get("away", {})
                
                home_team = home.get("team", {}).get("name", "Unknown")
                away_team = away.get("team", {}).get("name", "Unknown")
                
                # Get probable pitchers
                home_pitcher = None
                away_pitcher = None
                
                if "probablePitcher" in home:
                    home_pitcher = home["probablePitcher"].get("fullName")
                if "probablePitcher" in away:
                    away_pitcher = away["probablePitcher"].get("fullName")
                
                games.append(GameSummary(
                    game_id=game_id,
                    game_date=game_date,
                    home_team=home_team,
                    away_team=away_team,
                    home_pitcher=home_pitcher,
                    away_pitcher=away_pitcher
                ))
        
        _schedule_cache[cache_key] = games
        return games
        
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching schedule: {e}")
        raise
    except Exception as e:
        logger.error(f"Error fetching schedule: {e}")
        raise


async def get_game_with_lineups(game_id: str) -> Optional[Game]:
    """
    Get full game details including lineups.
    Works for both live and historical games.
    """
    cache_key = f"game_{game_id}"
    
    if cache_key in _lineup_cache:
        return _lineup_cache[cache_key]
    
    # Try boxscore endpoint first (works for completed games)
    # Fall back to live feed for current games
    async with httpx.AsyncClient() as client:
        # First try to get basic game info from schedule
        game_data = None
        live_data = None
        
        # Try the boxscore endpoint (works for historical games)
        boxscore_url = f"{MLB_API_BASE}/game/{game_id}/boxscore"
        try:
            response = await client.get(boxscore_url, timeout=30.0)
            if response.status_code == 200:
                boxscore_data = response.json()
                live_data = {"boxscore": boxscore_data}
        except httpx.HTTPError as e:
            logger.warning(f"Boxscore fetch failed for {game_id}: {e}")
        
        # Get game content/metadata
        content_url = f"{MLB_API_BASE}/game/{game_id}/content"
        try:
            response = await client.get(content_url, timeout=30.0)
            if response.status_code == 200:
                content_data = response.json()
        except httpx.HTTPError:
            content_data = {}
        
        # Try live feed as fallback (works for current/recent games)
        if not live_data:
            live_url = f"{MLB_API_BASE}/game/{game_id}/feed/live"
            try:
                response = await client.get(live_url, timeout=30.0)
                if response.status_code == 200:
                    data = response.json()
                    game_data = data.get("gameData", {})
                    live_data = data.get("liveData", {})
            except httpx.HTTPError as e:
                logger.warning(f"Live feed fetch failed for {game_id}: {e}")
        
        # If we still have no data, try schedule lookup
        if not game_data and not live_data:
            # Return None - game not found
            logger.error(f"Could not fetch data for game {game_id}")
            return None
        
        # Extract data from boxscore response
        if live_data and "boxscore" in live_data:
            boxscore = live_data.get("boxscore", {})
            teams_data = boxscore.get("teams", {})
            
            home_team_data = teams_data.get("home", {}).get("team", {})
            away_team_data = teams_data.get("away", {}).get("team", {})
            
            # Get players dict for name lookup
            home_players = teams_data.get("home", {}).get("players", {})
            away_players = teams_data.get("away", {}).get("players", {})
            
            def get_player_name(players_dict: dict, player_id: int) -> str:
                player_key = f"ID{player_id}"
                return players_dict.get(player_key, {}).get("person", {}).get("fullName", "Unknown")
            
            def get_position(players_dict: dict, player_id: int) -> str:
                player_key = f"ID{player_id}"
                return players_dict.get(player_key, {}).get("position", {}).get("abbreviation", "")
            
            # Get batting orders
            home_batters = teams_data.get("home", {}).get("battingOrder", [])
            away_batters = teams_data.get("away", {}).get("battingOrder", [])
            
            # Build home lineup
            home_lineup = []
            for i, batter_id in enumerate(home_batters[:9], 1):
                home_lineup.append(LineupPlayer(
                    batter_id=batter_id,
                    name=get_player_name(home_players, batter_id),
                    batting_order=i,
                    position=get_position(home_players, batter_id)
                ))
            
            # Build away lineup
            away_lineup = []
            for i, batter_id in enumerate(away_batters[:9], 1):
                away_lineup.append(LineupPlayer(
                    batter_id=batter_id,
                    name=get_player_name(away_players, batter_id),
                    batting_order=i,
                    position=get_position(away_players, batter_id)
                ))
            
            # Get pitchers from boxscore
            home_pitcher_id = None
            home_pitcher_name = None
            away_pitcher_id = None
            away_pitcher_name = None
            
            # Try to find starting pitchers from pitchers list
            home_pitchers = teams_data.get("home", {}).get("pitchers", [])
            away_pitchers = teams_data.get("away", {}).get("pitchers", [])
            
            if home_pitchers:
                first_pitcher_id = home_pitchers[0]
                home_pitcher_id = first_pitcher_id
                home_pitcher_name = get_player_name(home_players, first_pitcher_id)
            
            if away_pitchers:
                first_pitcher_id = away_pitchers[0]
                away_pitcher_id = first_pitcher_id
                away_pitcher_name = get_player_name(away_players, first_pitcher_id)
            
            # Build game object
            game = Game(
                game_id=game_id,
                game_date=date.today(),  # Will be overwritten if we have better data
                game_time=None,
                venue=boxscore.get("teams", {}).get("home", {}).get("team", {}).get("venue", {}).get("name"),
                home_team=TeamLineup(
                    team_id=home_team_data.get("id", 0),
                    team_name=home_team_data.get("name", "Unknown"),
                    team_abbrev=TEAM_ABBREVS.get(home_team_data.get("id", 0), "UNK"),
                    starting_pitcher_id=home_pitcher_id,
                    starting_pitcher_name=home_pitcher_name,
                    lineup=home_lineup
                ),
                away_team=TeamLineup(
                    team_id=away_team_data.get("id", 0),
                    team_name=away_team_data.get("name", "Unknown"),
                    team_abbrev=TEAM_ABBREVS.get(away_team_data.get("id", 0), "UNK"),
                    starting_pitcher_id=away_pitcher_id,
                    starting_pitcher_name=away_pitcher_name,
                    lineup=away_lineup
                ),
                status="Final"
            )
            
            _lineup_cache[cache_key] = game
            return game
    
    return None


async def get_player_info(player_id: int) -> dict:
    """Get player details from MLB API."""
    url = f"{MLB_API_BASE}/people/{player_id}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=15.0)
            response.raise_for_status()
            data = response.json()
        
        people = data.get("people", [])
        if people:
            player = people[0]
            current_team = player.get("currentTeam", {})
            return {
                "id": player.get("id"),
                "name": player.get("fullName"),
                "first_name": player.get("firstName"),
                "last_name": player.get("lastName"),
                "team": current_team.get("abbreviation") or current_team.get("name", ""),
                "team_id": current_team.get("id"),
                "position": player.get("primaryPosition", {}).get("abbreviation"),
                "bats": player.get("batSide", {}).get("code"),
                "throws": player.get("pitchHand", {}).get("code"),
            }
        
        return {}
        
    except Exception as e:
        logger.error(f"Error fetching player {player_id}: {e}")
        return {}


async def get_players_info_batch(player_ids: list[int]) -> dict[int, dict]:
    """
    Get player details for multiple players in one request.
    MLB API supports comma-separated IDs.
    """
    if not player_ids:
        return {}
    
    # MLB API supports up to ~50 IDs per request
    ids_str = ",".join(str(pid) for pid in player_ids)
    url = f"{MLB_API_BASE}/people?personIds={ids_str}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=20.0)
            response.raise_for_status()
            data = response.json()
        
        result = {}
        for player in data.get("people", []):
            current_team = player.get("currentTeam", {})
            result[player.get("id")] = {
                "id": player.get("id"),
                "name": player.get("fullName"),
                "first_name": player.get("firstName"),
                "last_name": player.get("lastName"),
                "team": current_team.get("abbreviation") or current_team.get("name", ""),
                "team_id": current_team.get("id"),
                "position": player.get("primaryPosition", {}).get("abbreviation"),
                "bats": player.get("batSide", {}).get("code"),
                "throws": player.get("pitchHand", {}).get("code"),
            }
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching players batch: {e}")
        return {}


async def search_players(query: str) -> list[dict]:
    """Search for players by name."""
    url = f"{MLB_API_BASE}/sports/1/players"
    params = {
        "season": settings.current_season,
        "search": query
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=15.0)
            response.raise_for_status()
            data = response.json()
        
        results = []
        for player in data.get("people", [])[:20]:  # Limit to 20
            results.append({
                "id": player.get("id"),
                "name": player.get("fullName"),
                "team": player.get("currentTeam", {}).get("name"),
                "position": player.get("primaryPosition", {}).get("abbreviation"),
            })
        
        return results
        
    except Exception as e:
        logger.error(f"Error searching players: {e}")
        return []
