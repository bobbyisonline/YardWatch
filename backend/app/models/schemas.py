from pydantic import BaseModel
from typing import Optional
from datetime import date


# ============ Pitcher Models ============

class PitchTypeStats(BaseModel):
    """Stats for a single pitch type."""
    pitch_type: str
    pitch_name: str
    usage_pct: float  # 0-100
    pitches_thrown: int
    run_value: float  # Negative = bad for pitcher
    run_value_per_100: float
    batting_avg: float
    slg_pct: float
    whiff_pct: float
    hr_rate: float  # HR per pitch


class PitcherProfile(BaseModel):
    """Full pitcher profile with all pitch types."""
    pitcher_id: int
    name: str
    team: str
    throws: str  # L or R
    pitches: list[PitchTypeStats]
    total_pitches: int
    season: int


class PitcherSummary(BaseModel):
    """Brief pitcher info for lists."""
    pitcher_id: int
    name: str
    team: str
    throws: str


# ============ Batter Models ============

class BatterVsPitchType(BaseModel):
    """Batter performance against a specific pitch type."""
    pitch_type: str
    pitch_name: str
    pitches_seen: int
    run_value: float  # Positive = good for batter (total)
    run_value_per_100: float  # RV per 100 pitches (normalized)
    batting_avg: float
    slg_pct: float
    hr_rate: float
    whiff_pct: float


class BatterProfile(BaseModel):
    """Full batter profile with vs-pitch breakdowns."""
    batter_id: int
    name: str
    team: str
    bats: str  # L, R, or S
    vs_pitch_types: list[BatterVsPitchType]
    total_pitches_seen: int
    season: int


class BatterSummary(BaseModel):
    """Brief batter info for lists."""
    batter_id: int
    name: str
    team: str
    bats: str


# ============ Game/Lineup Models ============

class LineupPlayer(BaseModel):
    """Player in a lineup."""
    batter_id: int
    name: str
    batting_order: int
    position: str


class TeamLineup(BaseModel):
    """Single team's lineup for a game."""
    team_id: int
    team_name: str
    team_abbrev: str
    starting_pitcher_id: Optional[int] = None
    starting_pitcher_name: Optional[str] = None
    lineup: list[LineupPlayer]


class Game(BaseModel):
    """Game with both team lineups."""
    game_id: str
    game_date: date
    game_time: Optional[str] = None
    venue: Optional[str] = None
    home_team: TeamLineup
    away_team: TeamLineup
    status: str  # scheduled, in_progress, final


class GameSummary(BaseModel):
    """Brief game info for lists."""
    game_id: str
    game_date: date
    home_team: str
    away_team: str
    home_pitcher: Optional[str] = None
    away_pitcher: Optional[str] = None


# ============ Matchup/Prediction Models ============

class MatchupPrediction(BaseModel):
    """HR matchup prediction for a batter vs pitcher."""
    batter_id: int
    batter_name: str
    team: str
    attack_pitch: str
    attack_pitch_name: str
    score: int  # 0-100
    hr_probability: float  # 0-1
    reasons: list[str]
    
    # Component scores for explainability
    usage_score: float
    pitcher_weakness_score: float
    batter_strength_score: float
    hr_factor_score: Optional[float] = None


class MatchupRequest(BaseModel):
    """Request for computing matchup predictions."""
    pitcher_id: int
    batter_ids: list[int]
    use_hr_factors: bool = True
    min_sample_size: int = 20
