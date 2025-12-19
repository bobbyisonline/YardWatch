"""
Statcast data service using pybaseball.
Fetches and aggregates pitch-level data for pitchers and batters.
"""

import pandas as pd
from pybaseball import statcast, playerid_lookup, statcast_pitcher, statcast_batter, cache
from cachetools import TTLCache
from datetime import datetime, timedelta
from typing import Optional
import logging

from app.config import get_settings
from app.models import PitcherProfile, PitchTypeStats, BatterProfile, BatterVsPitchType

logger = logging.getLogger(__name__)
settings = get_settings()

# Enable pybaseball caching to speed up repeated queries
cache.enable()

# In-memory caches
_pitcher_cache: TTLCache = TTLCache(maxsize=500, ttl=settings.cache_ttl_pitchers)
_batter_cache: TTLCache = TTLCache(maxsize=500, ttl=settings.cache_ttl_batters)
_season_data_cache: dict = {}


# Pitch type mapping for human-readable names
PITCH_TYPE_NAMES = {
    "FF": "4-Seam Fastball",
    "SI": "Sinker",
    "FC": "Cutter",
    "SL": "Slider",
    "CU": "Curveball",
    "KC": "Knuckle Curve",
    "CH": "Changeup",
    "FS": "Splitter",
    "KN": "Knuckleball",
    "EP": "Eephus",
    "SC": "Screwball",
    "SV": "Sweeper",
    "ST": "Sweeping Curve",
}


def get_pitch_name(pitch_type: str) -> str:
    """Get human-readable pitch name."""
    return PITCH_TYPE_NAMES.get(pitch_type, pitch_type)


async def get_season_statcast_data(season: int, use_cache: bool = True) -> pd.DataFrame:
    """
    Fetch full season Statcast data.
    This is expensive - ideally run once and cache/store.
    """
    cache_key = f"season_{season}"
    
    if use_cache and cache_key in _season_data_cache:
        return _season_data_cache[cache_key]
    
    logger.info(f"Fetching Statcast data for {season} season...")
    
    # Get season date range
    start_date = f"{season}-03-20"  # Spring training / opening day
    end_date = f"{season}-11-05"  # End of World Series
    
    # If current season, only fetch up to today
    today = datetime.now()
    if season == today.year:
        end_date = today.strftime("%Y-%m-%d")
    
    try:
        data = statcast(start_dt=start_date, end_dt=end_date)
        
        if data is not None and not data.empty:
            _season_data_cache[cache_key] = data
            logger.info(f"Loaded {len(data)} pitches for {season}")
            return data
        else:
            logger.warning(f"No data returned for {season}")
            return pd.DataFrame()
            
    except Exception as e:
        logger.error(f"Error fetching Statcast data: {e}")
        raise


async def get_pitcher_profile(
    pitcher_id: int,
    season: int = None
) -> Optional[PitcherProfile]:
    """
    Get pitcher's pitch-type breakdown with run values.
    """
    season = season or settings.current_season
    cache_key = f"pitcher_{pitcher_id}_{season}"
    
    if cache_key in _pitcher_cache:
        return _pitcher_cache[cache_key]
    
    try:
        # Fetch pitcher's Statcast data for the season
        start_date = f"{season}-03-20"
        end_date = f"{season}-11-05"
        
        today = datetime.now()
        if season == today.year:
            end_date = today.strftime("%Y-%m-%d")
        
        data = statcast_pitcher(start_dt=start_date, end_dt=end_date, player_id=pitcher_id)
        
        if data is None or data.empty:
            logger.warning(f"No data for pitcher {pitcher_id}")
            return None
        
        # Aggregate by pitch type
        pitch_stats = _aggregate_pitcher_pitch_types(data)
        
        # Get pitcher info
        pitcher_name = data['player_name'].iloc[0] if 'player_name' in data.columns else "Unknown"
        
        # Get team (most recent)
        team = "UNK"
        if 'home_team' in data.columns:
            # Pitcher's team is home_team when pitching at home
            teams = data['home_team'].value_counts()
            if not teams.empty:
                team = teams.index[0]
        
        # Get handedness
        throws = "R"
        if 'p_throws' in data.columns:
            throws = data['p_throws'].iloc[0]
        
        profile = PitcherProfile(
            pitcher_id=pitcher_id,
            name=pitcher_name,
            team=team,
            throws=throws,
            pitches=pitch_stats,
            total_pitches=len(data),
            season=season
        )
        
        _pitcher_cache[cache_key] = profile
        return profile
        
    except Exception as e:
        logger.error(f"Error getting pitcher profile {pitcher_id}: {e}")
        raise


def _aggregate_pitcher_pitch_types(data: pd.DataFrame) -> list[PitchTypeStats]:
    """Aggregate pitch data by pitch type for a pitcher."""
    
    pitch_stats = []
    total_pitches = len(data)
    
    # Filter to valid pitch types
    if 'pitch_type' not in data.columns:
        return pitch_stats
    
    data = data[data['pitch_type'].notna()]
    
    for pitch_type, group in data.groupby('pitch_type'):
        pitches_thrown = len(group)
        
        # Skip pitch types with too few samples
        if pitches_thrown < settings.min_pitches_for_pitch_type:
            continue
        
        # Calculate metrics
        usage_pct = (pitches_thrown / total_pitches) * 100
        
        # Run Value (delta_run_exp) - negative is bad for pitcher
        run_value = 0.0
        run_value_per_100 = 0.0
        if 'delta_run_exp' in group.columns:
            run_value = group['delta_run_exp'].sum()
            run_value_per_100 = (run_value / pitches_thrown) * 100
        
        # Batting average against
        batting_avg = 0.0
        hits = 0
        abs_count = 0
        if 'events' in group.columns:
            hit_events = ['single', 'double', 'triple', 'home_run']
            ab_events = ['single', 'double', 'triple', 'home_run', 'strikeout', 
                        'field_out', 'grounded_into_double_play', 'force_out',
                        'fielders_choice', 'fielders_choice_out', 'double_play',
                        'triple_play', 'sac_fly', 'field_error']
            
            events = group['events'].dropna()
            hits = events.isin(hit_events).sum()
            abs_count = events.isin(ab_events).sum()
            
            if abs_count > 0:
                batting_avg = hits / abs_count
        
        # Slugging percentage
        slg_pct = 0.0
        if abs_count > 0 and 'events' in group.columns:
            events = group['events'].dropna()
            singles = (events == 'single').sum()
            doubles = (events == 'double').sum()
            triples = (events == 'triple').sum()
            homers = (events == 'home_run').sum()
            total_bases = singles + (2 * doubles) + (3 * triples) + (4 * homers)
            slg_pct = total_bases / abs_count
        
        # Whiff rate
        whiff_pct = 0.0
        if 'description' in group.columns:
            swings = group['description'].isin([
                'swinging_strike', 'swinging_strike_blocked', 
                'foul', 'foul_tip', 'hit_into_play', 'hit_into_play_score',
                'hit_into_play_no_out'
            ]).sum()
            whiffs = group['description'].isin([
                'swinging_strike', 'swinging_strike_blocked'
            ]).sum()
            
            if swings > 0:
                whiff_pct = (whiffs / swings) * 100
        
        # HR rate (per pitch)
        hr_rate = 0.0
        if 'events' in group.columns:
            homers = (group['events'] == 'home_run').sum()
            hr_rate = homers / pitches_thrown
        
        pitch_stats.append(PitchTypeStats(
            pitch_type=pitch_type,
            pitch_name=get_pitch_name(pitch_type),
            usage_pct=round(usage_pct, 1),
            pitches_thrown=pitches_thrown,
            run_value=round(run_value, 2),
            run_value_per_100=round(run_value_per_100, 2),
            batting_avg=round(batting_avg, 3),
            slg_pct=round(slg_pct, 3),
            whiff_pct=round(whiff_pct, 1),
            hr_rate=round(hr_rate, 4)
        ))
    
    # Sort by usage
    pitch_stats.sort(key=lambda x: x.usage_pct, reverse=True)
    
    return pitch_stats


async def get_batter_profile(
    batter_id: int,
    season: int = None
) -> Optional[BatterProfile]:
    """
    Get batter's performance vs each pitch type.
    """
    season = season or settings.current_season
    cache_key = f"batter_{batter_id}_{season}"
    
    if cache_key in _batter_cache:
        return _batter_cache[cache_key]
    
    try:
        start_date = f"{season}-03-20"
        end_date = f"{season}-11-05"
        
        today = datetime.now()
        if season == today.year:
            end_date = today.strftime("%Y-%m-%d")
        
        data = statcast_batter(start_dt=start_date, end_dt=end_date, player_id=batter_id)
        
        if data is None or data.empty:
            logger.warning(f"No data for batter {batter_id}")
            return None
        
        # Aggregate by pitch type faced
        vs_pitch_stats = _aggregate_batter_vs_pitch_types(data)
        
        # Get batter info
        batter_name = "Unknown"
        if 'player_name' in data.columns:
            # For batter data, player_name is actually the pitcher
            # We need to look this up separately or use the ID
            pass
        
        # Get team
        team = "UNK"
        if 'home_team' in data.columns and 'away_team' in data.columns:
            # Check if batter was home or away more often
            if 'inning_topbot' in data.columns:
                # Top = away batting, Bot = home batting
                home_abs = (data['inning_topbot'] == 'Bot').sum()
                away_abs = (data['inning_topbot'] == 'Top').sum()
                
                if home_abs > away_abs:
                    team = data[data['inning_topbot'] == 'Bot']['home_team'].mode().iloc[0] if not data[data['inning_topbot'] == 'Bot']['home_team'].mode().empty else "UNK"
                else:
                    team = data[data['inning_topbot'] == 'Top']['away_team'].mode().iloc[0] if not data[data['inning_topbot'] == 'Top']['away_team'].mode().empty else "UNK"
        
        # Get handedness
        bats = "R"
        if 'stand' in data.columns:
            bats = data['stand'].mode().iloc[0] if not data['stand'].mode().empty else "R"
        
        profile = BatterProfile(
            batter_id=batter_id,
            name=batter_name,  # Will need separate lookup
            team=team,
            bats=bats,
            vs_pitch_types=vs_pitch_stats,
            total_pitches_seen=len(data),
            season=season
        )
        
        _batter_cache[cache_key] = profile
        return profile
        
    except Exception as e:
        logger.error(f"Error getting batter profile {batter_id}: {e}")
        raise


def _aggregate_batter_vs_pitch_types(data: pd.DataFrame) -> list[BatterVsPitchType]:
    """Aggregate batter performance by pitch type faced."""
    
    vs_stats = []
    
    if 'pitch_type' not in data.columns:
        return vs_stats
    
    data = data[data['pitch_type'].notna()]
    
    for pitch_type, group in data.groupby('pitch_type'):
        pitches_seen = len(group)
        
        # Skip small samples
        if pitches_seen < 20:
            continue
        
        # Run value (positive = good for batter)
        run_value = 0.0
        run_value_per_100 = 0.0
        if 'delta_run_exp' in group.columns:
            run_value = group['delta_run_exp'].sum()
            run_value_per_100 = (run_value / pitches_seen) * 100
        
        # Batting average
        batting_avg = 0.0
        abs_count = 0
        if 'events' in group.columns:
            hit_events = ['single', 'double', 'triple', 'home_run']
            ab_events = ['single', 'double', 'triple', 'home_run', 'strikeout', 
                        'field_out', 'grounded_into_double_play', 'force_out',
                        'fielders_choice', 'fielders_choice_out', 'double_play',
                        'triple_play', 'sac_fly', 'field_error']
            
            events = group['events'].dropna()
            hits = events.isin(hit_events).sum()
            abs_count = events.isin(ab_events).sum()
            
            if abs_count > 0:
                batting_avg = hits / abs_count
        
        # Slugging
        slg_pct = 0.0
        if abs_count > 0 and 'events' in group.columns:
            events = group['events'].dropna()
            singles = (events == 'single').sum()
            doubles = (events == 'double').sum()
            triples = (events == 'triple').sum()
            homers = (events == 'home_run').sum()
            total_bases = singles + (2 * doubles) + (3 * triples) + (4 * homers)
            slg_pct = total_bases / abs_count
        
        # HR rate
        hr_rate = 0.0
        if 'events' in group.columns:
            homers = (group['events'] == 'home_run').sum()
            hr_rate = homers / pitches_seen
        
        # Whiff rate
        whiff_pct = 0.0
        if 'description' in group.columns:
            swings = group['description'].isin([
                'swinging_strike', 'swinging_strike_blocked', 
                'foul', 'foul_tip', 'hit_into_play', 'hit_into_play_score',
                'hit_into_play_no_out'
            ]).sum()
            whiffs = group['description'].isin([
                'swinging_strike', 'swinging_strike_blocked'
            ]).sum()
            
            if swings > 0:
                whiff_pct = (whiffs / swings) * 100
        
        vs_stats.append(BatterVsPitchType(
            pitch_type=pitch_type,
            pitch_name=get_pitch_name(pitch_type),
            pitches_seen=pitches_seen,
            run_value=round(run_value, 2),
            run_value_per_100=round(run_value_per_100, 2),
            batting_avg=round(batting_avg, 3),
            slg_pct=round(slg_pct, 3),
            hr_rate=round(hr_rate, 4),
            whiff_pct=round(whiff_pct, 1)
        ))
    
    # Sort by pitches seen
    vs_stats.sort(key=lambda x: x.pitches_seen, reverse=True)
    
    return vs_stats


async def lookup_player_id(first_name: str, last_name: str) -> Optional[int]:
    """Look up a player's MLBAM ID by name."""
    try:
        results = playerid_lookup(last_name, first_name)
        
        if results is not None and not results.empty:
            # Return most recent player (highest key_mlbam)
            return int(results['key_mlbam'].max())
        
        return None
        
    except Exception as e:
        logger.error(f"Error looking up player {first_name} {last_name}: {e}")
        return None


# ============ BATCH OPERATIONS FOR SPEED ============

async def get_batters_batch_fast(
    batter_ids: list[int],
    season: int = None
) -> list[BatterProfile]:
    """
    Get profiles for multiple batters concurrently.
    Uses per-batter queries with pybaseball caching for speed.
    """
    import asyncio
    import concurrent.futures
    
    season = season or settings.current_season
    profiles = []
    ids_to_fetch = []
    
    # Check cache first
    for batter_id in batter_ids:
        cache_key = f"batter_{batter_id}_{season}"
        if cache_key in _batter_cache:
            profiles.append(_batter_cache[cache_key])
        else:
            ids_to_fetch.append(batter_id)
    
    if not ids_to_fetch:
        return profiles
    
    logger.info(f"Fetching {len(ids_to_fetch)} batters (pybaseball cached)...")
    
    # Fetch uncached batters using thread pool (pybaseball is sync)
    def fetch_batter_sync(batter_id: int) -> Optional[BatterProfile]:
        try:
            start_date = f"{season}-03-20"
            end_date = f"{season}-11-05"
            
            today = datetime.now()
            if season == today.year:
                end_date = today.strftime("%Y-%m-%d")
            
            data = statcast_batter(start_dt=start_date, end_dt=end_date, player_id=batter_id)
            
            if data is None or data.empty:
                return None
            
            vs_pitch_stats = _aggregate_batter_vs_pitch_types(data)
            if not vs_pitch_stats:
                return None
            
            # Get team
            team = "UNK"
            if 'home_team' in data.columns and 'away_team' in data.columns:
                if 'inning_topbot' in data.columns:
                    home_abs = (data['inning_topbot'] == 'Bot').sum()
                    away_abs = (data['inning_topbot'] == 'Top').sum()
                    if home_abs > away_abs:
                        mode_val = data[data['inning_topbot'] == 'Bot']['home_team'].mode()
                        team = mode_val.iloc[0] if not mode_val.empty else "UNK"
                    else:
                        mode_val = data[data['inning_topbot'] == 'Top']['away_team'].mode()
                        team = mode_val.iloc[0] if not mode_val.empty else "UNK"
            
            # Get handedness
            bats = "R"
            if 'stand' in data.columns:
                mode_val = data['stand'].mode()
                bats = mode_val.iloc[0] if not mode_val.empty else "R"
            
            return BatterProfile(
                batter_id=batter_id,
                name="Unknown",
                team=team,
                bats=bats,
                vs_pitch_types=vs_pitch_stats,
                total_pitches_seen=len(data),
                season=season
            )
        except Exception as e:
            logger.error(f"Error fetching batter {batter_id}: {e}")
            return None
    
    # Run in thread pool (3 concurrent to avoid overwhelming Baseball Savant)
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [loop.run_in_executor(executor, fetch_batter_sync, bid) for bid in ids_to_fetch]
        results = await asyncio.gather(*futures)
    
    # Cache and collect results
    for batter_id, profile in zip(ids_to_fetch, results):
        if profile:
            cache_key = f"batter_{batter_id}_{season}"
            _batter_cache[cache_key] = profile
            profiles.append(profile)
    
    return profiles
