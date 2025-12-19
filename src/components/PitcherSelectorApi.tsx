/**
 * Pitcher selector using live API data
 */

import { useGame } from '../hooks';

interface PitcherSelectorApiProps {
  gameId: string | null;
  selectedPitcherId: number | null;
  onSelectPitcher: (pitcherId: number, team: 'home' | 'away') => void;
}

export function PitcherSelectorApi({
  gameId,
  selectedPitcherId,
  onSelectPitcher,
}: PitcherSelectorApiProps) {
  const { data: game, isLoading, error } = useGame(gameId);

  if (!gameId) {
    return (
      <div className="control-group">
        <label htmlFor="pitcher-select">Select Starting Pitcher</label>
        <select id="pitcher-select" disabled>
          <option>Select a game first...</option>
        </select>
      </div>
    );
  }

  const pitchers: Array<{
    id: number | null;
    name: string;
    team: 'home' | 'away';
    teamName: string;
  }> = [];

  if (game) {
    if (game.home_team.starting_pitcher_id) {
      pitchers.push({
        id: game.home_team.starting_pitcher_id,
        name: game.home_team.starting_pitcher_name ?? 'TBD',
        team: 'home',
        teamName: game.home_team.team_abbrev,
      });
    }
    if (game.away_team.starting_pitcher_id) {
      pitchers.push({
        id: game.away_team.starting_pitcher_id,
        name: game.away_team.starting_pitcher_name ?? 'TBD',
        team: 'away',
        teamName: game.away_team.team_abbrev,
      });
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [pitcherId, team] = e.target.value.split(':');
    if (pitcherId && team) {
      onSelectPitcher(parseInt(pitcherId, 10), team as 'home' | 'away');
    }
  };

  const selectedValue = selectedPitcherId
    ? pitchers.find((p) => p.id === selectedPitcherId)
      ? `${selectedPitcherId}:${pitchers.find((p) => p.id === selectedPitcherId)?.team}`
      : ''
    : '';

  return (
    <div className="control-group">
      <label htmlFor="pitcher-select">Select Starting Pitcher</label>
      <select
        id="pitcher-select"
        value={selectedValue}
        onChange={handleChange}
        disabled={isLoading || pitchers.length === 0}
      >
        <option value="">
          {isLoading
            ? 'Loading...'
            : error
            ? 'Error loading game'
            : pitchers.length === 0
            ? 'Pitchers not announced yet'
            : 'Choose a pitcher...'}
        </option>
        {pitchers.map((p) => (
          <option key={`${p.id}:${p.team}`} value={`${p.id}:${p.team}`}>
            {p.name} ({p.teamName} SP)
          </option>
        ))}
      </select>

      {pitchers.length === 0 && game && !isLoading && (
        <div className="control-hint">
          Probable pitchers are usually announced 2-4 hours before game time.
        </div>
      )}
    </div>
  );
}
