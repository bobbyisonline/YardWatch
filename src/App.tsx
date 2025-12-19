import { useState, useMemo, useEffect } from 'react';
import {
  GameSelectorApi,
  PitcherSelectorApi,
  Toggles,
  ResultsTable,
  BatterDetailPanel,
  EmptyState,
  ErrorBanner,
  StatLegend,
  LoadingSpinner,
  AttackPitchCard,
} from './components';
import {
  useGame,
  useAttackPitch,
  usePitcherProfile,
  useBattersBatch,
} from './hooks';
import {
  computeAllPredictions,
  DEFAULT_SCORING_CONFIG,
} from './domain/apiScoring';
import type { PredictionRow } from './domain/types';
import type { ScoringConfig } from './domain/apiScoring';
import './App.css';

// Default to a date from the 2024 season with games (off-season has no games)
function getDefaultDate(): string {
  const today = new Date();
  const month = today.getMonth(); // 0-indexed
  
  // MLB season runs April (3) through October (9)
  // If we're in off-season, default to a late 2024 season date
  if (month < 3 || month > 9) {
    return '2024-09-15'; // Late 2024 season - lots of games
  }
  
  return today.toISOString().split('T')[0];
}

function App() {
  // Selection state
  const [selectedDate, setSelectedDate] = useState(getDefaultDate());
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedPitcherId, setSelectedPitcherId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away' | null>(null);
  const [selectedBatterId, setSelectedBatterId] = useState<string | null>(null);

  // Config state
  const [useHrFactors, setUseHrFactors] = useState(DEFAULT_SCORING_CONFIG.useHrFactors);
  const [minSampleSize, setMinSampleSize] = useState(DEFAULT_SCORING_CONFIG.minSampleSize);
  const [error, setError] = useState<string | null>(null);

  // API queries
  const gameQuery = useGame(selectedGameId);
  const pitcherQuery = usePitcherProfile(selectedPitcherId);
  const attackPitchQuery = useAttackPitch(selectedPitcherId);

  // Get opposing lineup batter IDs
  const batterIds = useMemo(() => {
    if (!gameQuery.data || !selectedTeam) return [];

    // If we selected the home pitcher, we analyze away batters (and vice versa)
    const lineup =
      selectedTeam === 'home'
        ? gameQuery.data.away_team.lineup
        : gameQuery.data.home_team.lineup;

    return lineup.map((p) => p.batter_id);
  }, [gameQuery.data, selectedTeam]);

  const battersQuery = useBattersBatch(batterIds);

  // Scoring config
  const scoringConfig: ScoringConfig = useMemo(
    () => ({
      ...DEFAULT_SCORING_CONFIG,
      useHrFactors,
      minSampleSize,
    }),
    [useHrFactors, minSampleSize]
  );

  // Compute predictions
  const predictions: PredictionRow[] = useMemo(() => {
    if (
      !pitcherQuery.data ||
      !attackPitchQuery.data ||
      !battersQuery.data ||
      battersQuery.data.length === 0
    ) {
      return [];
    }

    return computeAllPredictions(
      battersQuery.data,
      attackPitchQuery.data,
      pitcherQuery.data,
      scoringConfig
    );
  }, [pitcherQuery.data, attackPitchQuery.data, battersQuery.data, scoringConfig]);

  const selectedPrediction = useMemo(() => {
    if (!selectedBatterId) return null;
    return predictions.find((p) => p.batterId === selectedBatterId) ?? null;
  }, [predictions, selectedBatterId]);

  // Loading state
  const isLoadingData =
    (selectedPitcherId && pitcherQuery.isLoading) ||
    (selectedPitcherId && attackPitchQuery.isLoading) ||
    (batterIds.length > 0 && battersQuery.isLoading);

  // Error handling
  useEffect(() => {
    const queryError =
      gameQuery.error || pitcherQuery.error || attackPitchQuery.error || battersQuery.error;

    if (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'An error occurred');
    }
  }, [gameQuery.error, pitcherQuery.error, attackPitchQuery.error, battersQuery.error]);

  // Handlers
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedGameId(null);
    setSelectedPitcherId(null);
    setSelectedTeam(null);
    setSelectedBatterId(null);
  };

  const handleGameSelect = (gameId: string) => {
    setSelectedGameId(gameId);
    setSelectedPitcherId(null);
    setSelectedTeam(null);
    setSelectedBatterId(null);
  };

  const handlePitcherSelect = (pitcherId: number, team: 'home' | 'away') => {
    setSelectedPitcherId(pitcherId);
    setSelectedTeam(team);
    setSelectedBatterId(null);
  };

  const handleBatterSelect = (batterId: string) => {
    setSelectedBatterId(batterId === selectedBatterId ? null : batterId);
  };

  const handleCloseDetail = () => {
    setSelectedBatterId(null);
  };

  const handleDismissError = () => {
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-content">
          <img src="/yardwatch-logo.png" alt="YardWatch" className="app-logo" />
        </div>
      </header>

      {error && <ErrorBanner message={error} onDismiss={handleDismissError} />}

      <main className="app-main">
        <aside className="controls-panel">
          <GameSelectorApi
            selectedGameId={selectedGameId}
            onSelectGame={handleGameSelect}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />

          <PitcherSelectorApi
            gameId={selectedGameId}
            selectedPitcherId={selectedPitcherId}
            onSelectPitcher={handlePitcherSelect}
          />

          <AttackPitchCard
            attackPitch={attackPitchQuery.data ?? null}
            isLoading={attackPitchQuery.isLoading && !!selectedPitcherId}
          />

          <Toggles
            useHrFactors={useHrFactors}
            onToggleHrFactors={setUseHrFactors}
            minSampleSize={minSampleSize}
            onMinSampleSizeChange={setMinSampleSize}
          />

          <StatLegend />
        </aside>

        <section className="results-panel">
          {isLoadingData ? (
            <div className="loading-container">
              <LoadingSpinner message="Analyzing matchups..." size="lg" />
            </div>
          ) : !selectedGameId || !selectedPitcherId || predictions.length === 0 ? (
            <EmptyState
              hasGame={!!selectedGameId}
              hasPitcher={!!selectedPitcherId}
              hasPredictions={predictions.length > 0}
            />
          ) : (
            <div className="results-content">
              <ResultsTable
                predictions={predictions}
                selectedBatterId={selectedBatterId}
                onSelectBatter={handleBatterSelect}
              />
              <BatterDetailPanel prediction={selectedPrediction} onClose={handleCloseDetail} />
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>
          YardWatch analyzes pitch-type mismatches to identify HR opportunities. Powered by
          Statcast data.
        </p>
      </footer>
    </div>
  );
}

export default App;
