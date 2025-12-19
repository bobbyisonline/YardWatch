import type { PitcherPitch, BatterPitchProfile, LineupGame } from '../domain/types';

import pitcherPitchesData from '../data/pitcher_pitches_2025.json';
import batterProfilesData from '../data/batter_vs_pitch_2025.json';
import lineupsData from '../data/lineups_sample.json';

export function loadPitcherPitches(): PitcherPitch[] {
  return pitcherPitchesData as PitcherPitch[];
}

export function loadBatterProfiles(): BatterPitchProfile[] {
  return batterProfilesData as BatterPitchProfile[];
}

export function loadLineups(): LineupGame[] {
  return lineupsData as LineupGame[];
}

export interface LoadedData {
  pitcherPitches: PitcherPitch[];
  batterProfiles: BatterPitchProfile[];
  lineups: LineupGame[];
}

export function loadAllData(): LoadedData {
  return {
    pitcherPitches: loadPitcherPitches(),
    batterProfiles: loadBatterProfiles(),
    lineups: loadLineups(),
  };
}

export function getPitcherById(
  pitcherPitches: PitcherPitch[],
  pitcherId: string
): { name: string; pitches: PitcherPitch[] } | null {
  const pitches = pitcherPitches.filter((p) => p.pitcherId === pitcherId);
  if (pitches.length === 0) return null;
  return {
    name: pitches[0].pitcherName,
    pitches,
  };
}

export function getGameById(lineups: LineupGame[], gameId: string): LineupGame | null {
  return lineups.find((g) => g.gameId === gameId) ?? null;
}
