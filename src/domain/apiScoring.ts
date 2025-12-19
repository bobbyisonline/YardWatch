/**
 * Scoring logic that works with API data types
 * Adapts from API responses to domain scoring functions
 */

import type {
  PitcherProfile,
  BatterProfile,
  AttackPitchResponse,
} from '../api';
import type { PredictionRow, ExplanationItem } from './types';
import { clamp, formatDecimal } from './utils';

export interface ScoringConfig {
  useHrFactors: boolean;
  minSampleSize: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  useHrFactors: true,
  minSampleSize: 20,
};

interface LeagueAverages {
  worstPitchRV: number;
  bestBatterRV: number;
  avgPitchHRRate: number;
  avgBatterHRRate: number;
}

// Compute league averages from pitcher/batter data
export function computeLeagueAveragesFromApi(
  pitcherProfiles: PitcherProfile[],
  batterProfiles: BatterProfile[]
): LeagueAverages {
  const pitchRVs: number[] = [];
  const batterRVs: number[] = [];
  const pitchHRRates: number[] = [];
  const batterHRRates: number[] = [];

  for (const pitcher of pitcherProfiles) {
    for (const pitch of pitcher.pitches) {
      pitchRVs.push(pitch.run_value_per_100);
      if (pitch.hr_rate > 0) {
        pitchHRRates.push(pitch.hr_rate);
      }
    }
  }

  for (const batter of batterProfiles) {
    for (const vs of batter.vs_pitch_types) {
      batterRVs.push(vs.run_value_per_100);
      if (vs.hr_rate > 0) {
        batterHRRates.push(vs.hr_rate);
      }
    }
  }

  const worstPitchRV = pitchRVs.length > 0 ? Math.min(...pitchRVs) : -10;
  const bestBatterRV = batterRVs.length > 0 ? Math.max(...batterRVs) : 10;
  const avgPitchHRRate =
    pitchHRRates.length > 0
      ? pitchHRRates.reduce((a, b) => a + b, 0) / pitchHRRates.length
      : 0.03;
  const avgBatterHRRate =
    batterHRRates.length > 0
      ? batterHRRates.reduce((a, b) => a + b, 0) / batterHRRates.length
      : 0.04;

  return {
    worstPitchRV: Math.abs(worstPitchRV),
    bestBatterRV,
    avgPitchHRRate,
    avgBatterHRRate,
  };
}

// Default league averages when we don't have full data
const DEFAULT_LEAGUE_AVERAGES: LeagueAverages = {
  worstPitchRV: 10,
  bestBatterRV: 5,  // RV/100 scale
  avgPitchHRRate: 0.03,
  avgBatterHRRate: 0.04,
};

function normalizeUsage(usage: number): number {
  // Usage from API is 0-100, normalize to 0-1 score
  // 30%+ usage = 1.0, 15% usage = 0.0
  return clamp((usage - 15) / 15, 0, 1);
}

function normalizePitchWeakness(rv_per_100: number): number {
  // More negative RV = worse for pitcher = higher score
  // rv_per_100 typically ranges from -2 to +2
  // -1.0 or worse = 1.0 score, 0 = 0.5, +1.0 or better = 0
  return clamp((0 - rv_per_100) / 2, 0, 1);
}

function normalizeBatterStrength(rv_per_100: number): number {
  // Batter RV/100: positive = good at hitting this pitch, negative = bad
  // Range typically -4 to +4
  // 
  // CRITICAL: Negative RV means batter is BAD vs this pitch
  // This should REDUCE score, not just zero out
  
  // Map -4 to +4 range to 0 to 1
  // -4 = 0.0 (terrible), 0 = 0.5 (average), +4 = 1.0 (excellent)
  return clamp((rv_per_100 + 4) / 8, 0, 1);
}

function computeHRFactors(
  pitchHRRate: number,
  batterHRRate: number,
  avgPitchHR: number,
  avgBatterHR: number
): { pitchFactor: number; batterFactor: number } {
  // How much above average is this pitcher's HR rate on this pitch?
  const pitchFactor = pitchHRRate > 0 ? pitchHRRate / avgPitchHR : 1;
  // How much above average is this batter's HR rate vs this pitch?
  const batterFactor = batterHRRate > 0 ? batterHRRate / avgBatterHR : 1;
  
  return {
    pitchFactor: clamp(pitchFactor, 0.5, 2),
    batterFactor: clamp(batterFactor, 0.5, 2),
  };
}

export function computePrediction(
  batter: BatterProfile,
  attackPitch: AttackPitchResponse,
  pitcher: PitcherProfile,
  config: ScoringConfig,
  leagueAverages: LeagueAverages = DEFAULT_LEAGUE_AVERAGES
): PredictionRow | null {
  // Find batter's stats vs the attack pitch
  const batterVsPitch = batter.vs_pitch_types.find(
    (v) => v.pitch_type === attackPitch.attack_pitch
  );

  // Find pitcher's stats for the attack pitch
  const pitcherPitch = pitcher.pitches.find(
    (p) => p.pitch_type === attackPitch.attack_pitch
  );

  if (!pitcherPitch) {
    return null;
  }

  // REQUIRE sufficient sample size - no guessing
  if (!batterVsPitch || batterVsPitch.pitches_seen < config.minSampleSize) {
    // Return null - this batter won't be shown
    return null;
  }

  const batterRVPer100 = batterVsPitch.run_value_per_100;
  const batterHRRate = batterVsPitch.hr_rate;
  const sampleSize = batterVsPitch.pitches_seen;

  // Calculate component scores (all 0-1 scale)
  const usageScore = normalizeUsage(pitcherPitch.usage_pct);
  const pitchWeaknessScore = normalizePitchWeakness(pitcherPitch.run_value_per_100);
  const batterStrengthScore = normalizeBatterStrength(batterRVPer100);

  // HR factors (multipliers around 1.0)
  let hrPitchFactor = 1;
  let hrBatterFactor = 1;
  
  if (config.useHrFactors) {
    const factors = computeHRFactors(
      pitcherPitch.hr_rate,
      batterHRRate,
      leagueAverages.avgPitchHRRate,
      leagueAverages.avgBatterHRRate
    );
    hrPitchFactor = factors.pitchFactor;
    hrBatterFactor = factors.batterFactor;
  }

  // NEW FORMULA: Multiplicative approach
  // - Pitcher opportunity (usage * weakness) creates the ceiling
  // - Batter strength determines how much of that ceiling they capture
  // - HR factors provide boost/penalty
  //
  // If batter is BAD at hitting this pitch (batterStrengthScore < 0.5), 
  // their score will be low even if the pitch is hittable
  
  const pitcherOpportunity = (usageScore * 0.4 + pitchWeaknessScore * 0.6);
  
  // Batter strength now has REAL impact - bad batters get low scores
  // batterStrengthScore: 0 = terrible, 0.5 = average, 1.0 = excellent
  const batterMultiplier = 0.2 + (batterStrengthScore * 1.6);  // Range: 0.2 to 1.8
  
  // Base score: pitcher opportunity * batter ability
  const baseScore = pitcherOpportunity * batterMultiplier;
  
  // Apply HR factors (only if we have batter sample data)
  const hrMultiplier = config.useHrFactors ? (hrPitchFactor * 0.5 + hrBatterFactor * 0.5) : 1;
  const rawScore = baseScore * hrMultiplier;

  // Scale to 0-100 (no more aggressive scaling)
  const score = Math.round(clamp(rawScore * 100, 0, 100));

  // Calculate probability (more conservative)
  // Max ~15% for the best matchups
  const probability = clamp(rawScore * 0.15, 0, 0.15);

  // Build explanations
  const explanations: ExplanationItem[] = [
    {
      text: `Attack pitch is ${attackPitch.attack_pitch_name} (top usage + worst run value)`,
      type: 'attack-pitch',
    },
    {
      text: `Pitch usage: ${pitcherPitch.usage_pct.toFixed(1)}%`,
      type: 'usage',
    },
    {
      text: `Pitcher RV/100: ${formatDecimal(pitcherPitch.run_value_per_100)} (negative = hittable)`,
      type: 'pitcher-weakness',
    },
  ];

  // Show batter performance with interpretation
  const batterRating = batterRVPer100 > 1 ? 'CRUSHES' : 
                       batterRVPer100 > 0 ? 'good vs' : 
                       batterRVPer100 > -1 ? 'average vs' : 
                       batterRVPer100 > -2 ? 'struggles vs' : 'terrible vs';
  explanations.push({
    text: `Batter ${batterRating} ${attackPitch.attack_pitch_name}: ${batterRVPer100 > 0 ? '+' : ''}${formatDecimal(batterRVPer100)} RV/100 (${sampleSize} PA)`,
    type: 'batter-strength',
  });

  if (config.useHrFactors) {
    // Always show HR rate info for transparency
    const hrRatePct = (batterHRRate * 100).toFixed(1);
    explanations.push({
      text: `HR rate vs ${attackPitch.attack_pitch_name}: ${hrRatePct}% (factor: ${formatDecimal(hrBatterFactor)}x)`,
      type: 'hr-factor',
    });
  }

  // Top reasons for display
  const topReasons = explanations.slice(0, 5).map((e) => e.text);

  return {
    batterId: String(batter.batter_id),
    batterName: batter.name,
    batterTeam: batter.team,
    attackPitch: attackPitch.attack_pitch_name as any,
    score,
    probability,
    topReasons,
    detail: {
      attackPitch: attackPitch.attack_pitch_name as any,
      pitcherUsage: pitcherPitch.usage_pct,
      pitcherPitchRV: pitcherPitch.run_value_per_100,
      pitcherHRRate: pitcherPitch.hr_rate,
      batterRV: batterRVPer100,
      batterHRRate,
      batterSampleSize: sampleSize,
      rawScore,
      normalizedUsage: usageScore,
      normalizedPitchWeakness: pitchWeaknessScore,
      normalizedBatterStrength: batterStrengthScore,
      hrPitchFactor,
      hrBatterFactor,
      fallbacks: [],
      explanations,
    },
  };
}

export function computeAllPredictions(
  batters: BatterProfile[],
  attackPitch: AttackPitchResponse,
  pitcher: PitcherProfile,
  config: ScoringConfig
): PredictionRow[] {
  // Compute league averages from available data
  const leagueAverages = computeLeagueAveragesFromApi([pitcher], batters);

  const predictions: PredictionRow[] = [];

  for (const batter of batters) {
    const prediction = computePrediction(batter, attackPitch, pitcher, config, leagueAverages);
    if (prediction) {
      predictions.push(prediction);
    }
  }

  // Sort by score descending
  return predictions.sort((a, b) => b.score - a.score);
}
