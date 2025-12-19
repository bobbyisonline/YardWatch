/**
 * Attack pitch display card
 */

import type { AttackPitchResponse } from '../api';

interface AttackPitchCardProps {
  attackPitch: AttackPitchResponse | null;
  isLoading: boolean;
}

export function AttackPitchCard({ attackPitch, isLoading }: AttackPitchCardProps) {
  if (isLoading) {
    return (
      <div className="attack-pitch-info">
        <div className="attack-pitch-loading">
          <span className="attack-pitch-label">Analyzing pitches...</span>
        </div>
      </div>
    );
  }

  if (!attackPitch) {
    return null;
  }

  return (
    <div className="attack-pitch-info">
      <div className="attack-pitch-content">
        <span className="attack-pitch-label">Attack Pitch:</span>
        <span className="attack-pitch-value">{attackPitch.attack_pitch_name}</span>
      </div>
      <div className="attack-pitch-details">
        <span className="attack-pitch-stat">
          Usage: {attackPitch.usage_pct.toFixed(1)}%
        </span>
        <span className="attack-pitch-stat">
          RV/100: {attackPitch.run_value_per_100.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
