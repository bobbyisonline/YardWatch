import type { LineupGame } from '../domain/types';

interface GameSelectorProps {
  games: LineupGame[];
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
}

export function GameSelector({ games, selectedGameId, onSelectGame }: GameSelectorProps) {
  return (
    <div className="control-group">
      <label htmlFor="game-select">Select Game</label>
      <select
        id="game-select"
        value={selectedGameId ?? ''}
        onChange={(e) => onSelectGame(e.target.value)}
      >
        <option value="" disabled>
          Choose a game...
        </option>
        {games.map((game) => (
          <option key={game.gameId} value={game.gameId}>
            {game.gameDate}: {game.awayTeam.teamName} @ {game.homeTeam.teamName}
          </option>
        ))}
      </select>
    </div>
  );
}
