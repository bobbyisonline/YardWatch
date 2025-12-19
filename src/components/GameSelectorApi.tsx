/**
 * Game selector using live MLB API data
 */

import { useGamesByDate } from '../hooks';
import type { GameSummary } from '../api';

interface GameSelectorApiProps {
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function GameSelectorApi({
  selectedGameId,
  onSelectGame,
  selectedDate,
  onDateChange,
}: GameSelectorApiProps) {
  const { data: games, isLoading, error } = useGamesByDate(selectedDate);

  const formatGameLabel = (game: GameSummary): string => {
    const awayPitcher = game.away_pitcher ? ` (${game.away_pitcher})` : '';
    const homePitcher = game.home_pitcher ? ` (${game.home_pitcher})` : '';
    return `${game.away_team}${awayPitcher} @ ${game.home_team}${homePitcher}`;
  };

  return (
    <div className="control-group">
      <label htmlFor="date-select">Select Date</label>
      <input
        type="date"
        id="date-select"
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="date-input"
      />

      <label htmlFor="game-select">Select Game</label>
      <select
        id="game-select"
        value={selectedGameId ?? ''}
        onChange={(e) => onSelectGame(e.target.value)}
        disabled={isLoading || !games?.length}
      >
        <option value="">
          {isLoading
            ? 'Loading games...'
            : error
            ? 'Error loading games'
            : games?.length === 0
            ? 'No games scheduled'
            : 'Choose a game...'}
        </option>
        {games?.map((game) => (
          <option key={game.game_id} value={game.game_id}>
            {formatGameLabel(game)}
          </option>
        ))}
      </select>

      {error && (
        <div className="control-error">
          Failed to load games. Is the API running?
        </div>
      )}
    </div>
  );
}
