# YardWatch - Home Run Matchup Predictor

A React + TypeScript web application that predicts home run likelihood for hitters versus starting pitchers using pitch-type mismatch analysis. Built with explainability at its core—every prediction shows the top reasons and detailed metrics behind the score.

## Features

- **Pitch-Type Mismatch Analysis**: Identifies a pitcher's "attack pitch" (their most-used pitch with the worst run value) and evaluates batter performance against that pitch type
- **Explainable Predictions**: Every score includes detailed explanations showing pitch usage, pitcher weakness, batter strength, and HR factors
- **Interactive UI**: Select games, pitchers, and view detailed matchup breakdowns
- **Configurable Scoring**: Toggle HR factors on/off and adjust minimum sample size thresholds
- **Deterministic & Testable**: Pure scoring functions with comprehensive unit tests

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

The app will be available at `http://localhost:5173`

## Project Structure

```
src/
├── App.tsx                 # Main application component
├── App.css                 # Application styles
├── main.tsx                # Entry point
├── domain/
│   ├── types.ts            # TypeScript interfaces
│   ├── scoring.ts          # Pure scoring functions
│   └── utils.ts            # Utility functions
├── data/
│   ├── pitcher_pitches_2025.json    # Pitcher pitch data
│   ├── batter_vs_pitch_2025.json    # Batter pitch profiles
│   └── lineups_sample.json          # Game lineups
├── dataLoaders/
│   └── loadData.ts         # Data loading utilities
├── components/
│   ├── GameSelector.tsx
│   ├── PitcherSelector.tsx
│   ├── Toggles.tsx
│   ├── ResultsTable.tsx
│   ├── BatterDetailPanel.tsx
│   ├── EmptyState.tsx
│   └── ErrorBanner.tsx
└── tests/
    └── scoring.test.ts     # Unit tests for scoring logic
```

## Replacing Sample Data with Real 2025 Data

The app is designed to easily swap sample data with real exported data from Baseball Savant, FanGraphs, or similar sources.

### Data File Formats

#### 1. `pitcher_pitches_2025.json`

Array of pitcher pitch type records:

```json
[
  {
    "pitcherId": "string",      // Unique pitcher ID
    "pitcherName": "string",    // Display name
    "pitchType": "string",      // One of: Fastball, Sinker, Cutter, Slider, Curveball, Changeup, Splitter, Sweeper
    "usage": 0.42,              // Usage rate 0-1
    "pitchRV": -3.5,            // Pitch Runs Above Average (negative = worse for pitcher)
    "pitchHRRate": 0.028        // HR per pitch (or null if unavailable)
  }
]
```

#### 2. `batter_vs_pitch_2025.json`

Array of batter pitch type profiles:

```json
[
  {
    "batterId": "string",       // Unique batter ID
    "batterName": "string",     // Display name
    "batterTeam": "string",     // Team abbreviation
    "bats": "L" | "R" | "S",    // Batting side
    "pitchType": "string",      // Pitch type
    "batterRV": 6.5,            // Runs above average vs pitch type (positive = better for batter)
    "batterHRRate": 0.065,      // HR rate vs pitch type (or null)
    "sampleSize": 120           // Number of pitches/PAs seen
  }
]
```

#### 3. `lineups_sample.json`

Array of game lineup records:

```json
[
  {
    "gameId": "string",
    "gameDate": "2025-06-15",
    "homeTeam": {
      "teamId": "string",
      "teamName": "string",
      "startingPitcherId": "string",
      "lineup": ["batterId1", "batterId2", ...]
    },
    "awayTeam": {
      "teamId": "string",
      "teamName": "string", 
      "startingPitcherId": "string",
      "lineup": ["batterId1", "batterId2", ...]
    }
  }
]
```

### Converting from CSV

If your data is in CSV format, convert to JSON before placing in `/src/data`. Example using Node.js:

```javascript
const csv = require('csv-parse/sync');
const fs = require('fs');

const csvData = fs.readFileSync('pitcher_pitches.csv', 'utf-8');
const records = csv.parse(csvData, { columns: true, cast: true });
fs.writeFileSync('pitcher_pitches_2025.json', JSON.stringify(records, null, 2));
```

## Scoring Model

The scoring algorithm is deterministic and designed for explainability:

### 1. Attack Pitch Selection

```
1. Get pitcher's pitches sorted by usage (descending)
2. Take top 2 pitches by usage
3. Select the one with the most negative pitchRV (worst)
```

### 2. Normalization (0-1 scale)

```
NormUsage = usage / maxUsageAmongPitcherPitches
NormPitchWeakness = abs(min(pitchRV, 0)) / abs(leagueWorstPitchRV)
NormBatterStrength = max(batterRV, 0) / leagueBestBatterRV
```

### 3. Base Interaction Score

```
interaction = NormUsage × NormPitchWeakness × NormBatterStrength
```

### 4. HR Factors (Optional)

When enabled:
```
HR_Pitch_Factor = clamp(pitchHRRate / leagueAvgPitchHRRate, 0.5, 1.5)
HR_Batter_Factor = clamp(batterHRRate / leagueAvgBatterHRRate, 0.5, 1.5)
```

If HR rates are missing, factor defaults to 1.0 and a fallback note is recorded.

### 5. Final Score

```
raw = interaction × HR_Pitch_Factor × HR_Batter_Factor
score = clamp(round(raw × SCORE_SCALE × 100), 0, 100)
probability = clamp(raw × PROB_SCALE, 0.01, 0.35)
```

## Why It's Explainable

Every prediction includes:

1. **Attack Pitch Identification**: Shows which pitch type was identified as the vulnerability and why
2. **Component Breakdown**: Displays normalized usage, pitch weakness, and batter strength values
3. **HR Factor Details**: When enabled, shows how HR rates modified the score
4. **Fallback Transparency**: Any missing data points are explicitly noted (e.g., "Pitcher HR rate missing: used league average")
5. **Full Metric Display**: All underlying pitcher and batter metrics are visible in the detail panel

## Limitations

- **Sample Data**: The included data is synthetic/illustrative. Replace with real 2025 season exports for actual predictions.
- **No Live Updates**: Data is loaded statically at build time. For real-time lineup updates, integrate with an API.
- **Simplified Model**: The pitch-type mismatch model captures one important factor but doesn't account for:
  - Ballpark factors
  - Weather conditions
  - Recent batter/pitcher form
  - Platoon advantages beyond pitch type
  - Count-specific pitch usage changes
- **HR Rate Availability**: HR per pitch data may be sparse for some pitch types; the fallback system handles this gracefully.

## Testing

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run
```

Tests cover:
- Attack pitch selection logic
- Normalization functions
- HR factor calculations with fallbacks
- End-to-end prediction generation
- Sample size filtering

## License

MIT
