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
      <div className="attack-pitch-card">
        <span className="attack-pitch-loading">Analyzing...</span>
      </div>
    );
  }

  if (!attackPitch) {
    return null;
  }

  return (
    <div className="attack-pitch-card">
      <div className="attack-pitch-header">
        <span className="attack-pitch-label">Attack Pitch</span>
        <span className="attack-pitch-badge">{attackPitch.attack_pitch_name}</span>
      </div>
      <div className="attack-pitch-stats">
        <span>{attackPitch.usage_pct.toFixed(1)}% usage</span>
        <span>{attackPitch.run_value_per_100.toFixed(2)} RV/100</span>
      </div>
    </div>
  );
}
