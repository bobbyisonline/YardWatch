import type { PitcherPitch, LineupGame, PitchType } from '../domain/types';
import { getAttackPitch } from '../domain/scoring';

interface PitcherOption {
  pitcherId: string;
  pitcherName: string;
  team: 'home' | 'away';
  teamName: string;
  attackPitch: PitchType | null;
}

interface PitcherSelectorProps {
  game: LineupGame | null;
  pitcherPitches: PitcherPitch[];
  selectedPitcherId: string | null;
  onSelectPitcher: (pitcherId: string) => void;
}

export function PitcherSelector({
  game,
  pitcherPitches,
  selectedPitcherId,
  onSelectPitcher,
}: PitcherSelectorProps) {
  if (!game) {
    return (
      <div className="control-group">
        <label>Select Pitcher</label>
        <select disabled>
          <option>Select a game first...</option>
        </select>
      </div>
    );
  }

  const getPitcherOption = (
    pitcherId: string,
    team: 'home' | 'away',
    teamName: string
  ): PitcherOption => {
    const pitches = pitcherPitches.filter((p) => p.pitcherId === pitcherId);
    const attack = getAttackPitch(pitches);
    return {
      pitcherId,
      pitcherName: pitches[0]?.pitcherName ?? 'Unknown Pitcher',
      team,
      teamName,
      attackPitch: attack?.pitchType ?? null,
    };
  };

  const options: PitcherOption[] = [
    getPitcherOption(game.homeTeam.startingPitcherId, 'home', game.homeTeam.teamName),
    getPitcherOption(game.awayTeam.startingPitcherId, 'away', game.awayTeam.teamName),
  ];

  const selectedOption = options.find((o) => o.pitcherId === selectedPitcherId);

  return (
    <div className="control-group">
      <label htmlFor="pitcher-select">Select Starting Pitcher</label>
      <select
        id="pitcher-select"
        value={selectedPitcherId ?? ''}
        onChange={(e) => onSelectPitcher(e.target.value)}
      >
        <option value="" disabled>
          Choose a pitcher...
        </option>
        {options.map((opt) => (
          <option key={opt.pitcherId} value={opt.pitcherId}>
            {opt.pitcherName} ({opt.teamName} SP)
          </option>
        ))}
      </select>
      {selectedOption?.attackPitch && (
        <div className="attack-pitch-info">
          <span className="attack-pitch-label">Attack Pitch:</span>
          <span className="attack-pitch-value">{selectedOption.attackPitch}</span>
        </div>
      )}
    </div>
  );
}
