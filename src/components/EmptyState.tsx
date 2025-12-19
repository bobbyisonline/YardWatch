interface EmptyStateProps {
  hasGame: boolean;
  hasPitcher: boolean;
  hasPredictions: boolean;
}

export function EmptyState({ hasGame, hasPitcher, hasPredictions }: EmptyStateProps) {
  if (!hasGame) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚾</div>
        <h3>Select a Game</h3>
        <p>Choose a game from the dropdown to start analyzing home run matchups.</p>
      </div>
    );
  }

  if (!hasPitcher) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🎯</div>
        <h3>Select a Pitcher</h3>
        <p>Choose a starting pitcher to see matchup predictions against the opposing lineup.</p>
      </div>
    );
  }

  if (!hasPredictions) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h3>No Predictions Available</h3>
        <p>
          No batters meet the current sample size threshold, or no pitch profile data is available
          for the selected matchup.
        </p>
        <p className="empty-state-hint">Try lowering the minimum sample size filter.</p>
      </div>
    );
  }

  return null;
}
