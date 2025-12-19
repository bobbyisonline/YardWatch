import type {
  PitcherPitch,
  BatterPitchProfile,
  PitchType,
  LeagueAverages,
  ScoringConfig,
  PredictionRow,
  PredictionDetail,
  ExplanationItem,
} from './types';
import { clamp, sortByDescending, sortByAscending, formatPercent, formatDecimal } from './utils';

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  useHrFactors: true,
  minSampleSize: 20,
  scoreScale: 2.5,
  probScale: 0.35,
};

export function computeLeagueAverages(
  pitcherPitches: PitcherPitch[],
  batterProfiles: BatterPitchProfile[]
): LeagueAverages {
  const pitchRVs = pitcherPitches.map((p) => p.pitchRV);
  const batterRVs = batterProfiles.map((b) => b.batterRV);
  const pitchHRRates = pitcherPitches
    .filter((p) => p.pitchHRRate !== null)
    .map((p) => p.pitchHRRate as number);
  const batterHRRates = batterProfiles
    .filter((b) => b.batterHRRate !== null)
    .map((b) => b.batterHRRate as number);

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

export function getAttackPitch(pitcherPitches: PitcherPitch[]): PitcherPitch | null {
  if (pitcherPitches.length === 0) return null;

  const sortedByUsage = sortByDescending(pitcherPitches, (p) => p.usage);
  const top2ByUsage = sortedByUsage.slice(0, 2);

  if (top2ByUsage.length === 0) return null;
  if (top2ByUsage.length === 1) return top2ByUsage[0];

  const sortedByWorstRV = sortByAscending(top2ByUsage, (p) => p.pitchRV);
  return sortedByWorstRV[0];
}

export function getPitcherPitches(
  allPitches: PitcherPitch[],
  pitcherId: string
): PitcherPitch[] {
  return allPitches.filter((p) => p.pitcherId === pitcherId);
}

export function getBatterProfile(
  allProfiles: BatterPitchProfile[],
  batterId: string,
  pitchType: PitchType
): BatterPitchProfile | null {
  return (
    allProfiles.find((b) => b.batterId === batterId && b.pitchType === pitchType) ?? null
  );
}

export function normalizeUsage(usage: number, maxUsage: number): number {
  if (maxUsage <= 0) return 0;
  return clamp(usage / maxUsage, 0, 1);
}

export function normalizePitchWeakness(pitchRV: number, leagueWorstRV: number): number {
  if (leagueWorstRV <= 0) return 0;
  const weakness = Math.abs(Math.min(pitchRV, 0));
  return clamp(weakness / leagueWorstRV, 0, 1);
}

export function normalizeBatterStrength(batterRV: number, leagueBestRV: number): number {
  if (leagueBestRV <= 0) return 0;
  const strength = Math.max(batterRV, 0);
  return clamp(strength / leagueBestRV, 0, 1);
}

export function computeHRFactor(
  hrRate: number | null,
  leagueAvgRate: number,
  fallbacks: string[],
  factorType: 'pitch' | 'batter'
): number {
  if (hrRate === null || hrRate <= 0) {
    fallbacks.push(
      `${factorType === 'pitch' ? 'Pitcher' : 'Batter'} HR rate missing: used league average`
    );
    return 1.0;
  }
  if (leagueAvgRate <= 0) return 1.0;
  return clamp(hrRate / leagueAvgRate, 0.5, 1.5);
}

export function generateExplanations(
  attackPitch: PitcherPitch,
  batterProfile: BatterPitchProfile | null,
  config: ScoringConfig,
  fallbacks: string[]
): ExplanationItem[] {
  const explanations: ExplanationItem[] = [];

  explanations.push({
    text: `Attack pitch is ${attackPitch.pitchType} (top usage + worst run value)`,
    type: 'attack-pitch',
  });

  explanations.push({
    text: `Pitch usage: ${formatPercent(attackPitch.usage)}`,
    type: 'usage',
  });

  explanations.push({
    text: `Pitch weakness (Pitch RV): ${formatDecimal(attackPitch.pitchRV)}`,
    type: 'pitcher-weakness',
  });

  if (batterProfile) {
    explanations.push({
      text: `Batter strength vs pitch (RV): ${formatDecimal(batterProfile.batterRV)} (sample ${batterProfile.sampleSize})`,
      type: 'batter-strength',
    });

    if (config.useHrFactors) {
      if (attackPitch.pitchHRRate !== null) {
        explanations.push({
          text: `Pitcher HR rate on ${attackPitch.pitchType}: ${formatPercent(attackPitch.pitchHRRate, 2)}`,
          type: 'hr-factor',
        });
      }
      if (batterProfile.batterHRRate !== null) {
        explanations.push({
          text: `Batter HR rate vs ${attackPitch.pitchType}: ${formatPercent(batterProfile.batterHRRate, 2)}`,
          type: 'hr-factor',
        });
      }
    }
  }

  for (const fallback of fallbacks) {
    explanations.push({
      text: fallback,
      type: 'fallback',
    });
  }

  return explanations;
}

export function computePrediction(
  batterId: string,
  pitcherId: string,
  allPitcherPitches: PitcherPitch[],
  allBatterProfiles: BatterPitchProfile[],
  leagueAverages: LeagueAverages,
  config: ScoringConfig
): PredictionRow | null {
  const pitcherPitches = getPitcherPitches(allPitcherPitches, pitcherId);
  const attackPitch = getAttackPitch(pitcherPitches);

  if (!attackPitch) return null;

  const batterProfile = getBatterProfile(allBatterProfiles, batterId, attackPitch.pitchType);

  if (!batterProfile) return null;
  if (batterProfile.sampleSize < config.minSampleSize) return null;

  const maxUsage = Math.max(...pitcherPitches.map((p) => p.usage));
  const normalizedUsage = normalizeUsage(attackPitch.usage, maxUsage);
  const normalizedPitchWeakness = normalizePitchWeakness(
    attackPitch.pitchRV,
    leagueAverages.worstPitchRV
  );
  const normalizedBatterStrength = normalizeBatterStrength(
    batterProfile.batterRV,
    leagueAverages.bestBatterRV
  );

  const interaction = normalizedUsage * normalizedPitchWeakness * normalizedBatterStrength;

  const fallbacks: string[] = [];
  let hrPitchFactor = 1.0;
  let hrBatterFactor = 1.0;

  if (config.useHrFactors) {
    hrPitchFactor = computeHRFactor(
      attackPitch.pitchHRRate,
      leagueAverages.avgPitchHRRate,
      fallbacks,
      'pitch'
    );
    hrBatterFactor = computeHRFactor(
      batterProfile.batterHRRate,
      leagueAverages.avgBatterHRRate,
      fallbacks,
      'batter'
    );
  }

  const raw = config.useHrFactors
    ? interaction * hrPitchFactor * hrBatterFactor
    : interaction;

  const score = clamp(Math.round(raw * config.scoreScale * 100), 0, 100);
  const probability = clamp(raw * config.probScale, 0.01, 0.35);

  const explanations = generateExplanations(attackPitch, batterProfile, config, fallbacks);

  const topReasons = explanations
    .filter((e) => e.type !== 'fallback')
    .slice(0, 2)
    .map((e) => e.text);

  const detail: PredictionDetail = {
    attackPitch: attackPitch.pitchType,
    pitcherUsage: attackPitch.usage,
    pitcherPitchRV: attackPitch.pitchRV,
    pitcherHRRate: attackPitch.pitchHRRate,
    batterRV: batterProfile.batterRV,
    batterHRRate: batterProfile.batterHRRate,
    batterSampleSize: batterProfile.sampleSize,
    rawScore: raw,
    normalizedUsage,
    normalizedPitchWeakness,
    normalizedBatterStrength,
    hrPitchFactor,
    hrBatterFactor,
    fallbacks,
    explanations,
  };

  return {
    batterId,
    batterName: batterProfile.batterName,
    batterTeam: batterProfile.batterTeam,
    attackPitch: attackPitch.pitchType,
    score,
    probability,
    topReasons,
    detail,
  };
}

export function computeAllPredictions(
  batterIds: string[],
  pitcherId: string,
  allPitcherPitches: PitcherPitch[],
  allBatterProfiles: BatterPitchProfile[],
  leagueAverages: LeagueAverages,
  config: ScoringConfig
): PredictionRow[] {
  const predictions: PredictionRow[] = [];

  for (const batterId of batterIds) {
    const prediction = computePrediction(
      batterId,
      pitcherId,
      allPitcherPitches,
      allBatterProfiles,
      leagueAverages,
      config
    );
    if (prediction) {
      predictions.push(prediction);
    }
  }

  return sortByDescending(predictions, (p) => p.score);
}
