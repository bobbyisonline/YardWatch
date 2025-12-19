# YardWatch Backend API

FastAPI backend for YardWatch HR Matchup Predictor.

## Data Sources
- **Statcast/pybaseball** - Pitch-level data, run values, pitch type breakdowns
- **MLB Stats API** - Game schedules, lineups, player info (free, no auth)

## Setup

### 1. Create virtual environment
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the server
```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Main Endpoints

### Games & Lineups
- `GET /api/games/today` - Today's schedule with probable pitchers
- `GET /api/games/schedule/{date}` - Schedule for specific date (YYYY-MM-DD)
- `GET /api/games/{game_id}` - Full game with lineups
- `GET /api/games/{game_id}/matchups?team=home|away` - Matchup setup data

### Pitchers
- `GET /api/pitchers/{id}` - Full pitch-type profile
- `GET /api/pitchers/{id}/attack-pitch` - Get exploitable pitch

### Batters
- `GET /api/batters/{id}` - Performance vs all pitch types
- `GET /api/batters/{id}/vs-pitch/{pitch_type}` - Vs specific pitch
- `POST /api/batters/batch` - Get multiple batters at once

## Environment Variables

Create a `.env` file (optional):
```env
DEBUG=true
CURRENT_SEASON=2025
CACHE_TTL_PITCHERS=3600
CACHE_TTL_BATTERS=3600
CACHE_TTL_LINEUPS=300
```

## Notes

### Lineups
MLB lineups are typically released 2-4 hours before game time. Before then, the lineup arrays will be empty but probable pitchers will be available.

### Data Caching
- Pitcher/batter profiles: 1 hour TTL
- Lineups: 5 minutes TTL (they can change)

### pybaseball First Run
The first request for a player's data may be slow as pybaseball downloads from Baseball Savant. Subsequent requests use cached data.

### Rate Limiting
Both Baseball Savant (pybaseball) and MLB Stats API are free but be respectful with request volume. The built-in caching helps with this.
