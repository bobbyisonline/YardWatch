export const PITCH_TYPES = [
  'Fastball',
  'Sinker',
  'Cutter',
  'Slider',
  'Curveball',
  'Changeup',
  'Splitter',
  'Sweeper',
  'Knuckle Curve',
  'Slurve',
] as const;

export type PitchType = (typeof PITCH_TYPES)[number];

export interface PitcherPitch {
  pitcherId: string;
  pitcherName: string;
  pitchType: PitchType;
  usage: number;
  pitchRV: number;
  pitchHRRate: number | null;
}

export interface BatterPitchProfile {
  batterId: string;
  batterName: string;
  batterTeam: string;
  bats: 'L' | 'R' | 'S';
  pitchType: PitchType;
  batterRV: number;
  batterHRRate: number | null;
  sampleSize: number;
}

export interface TeamLineup {
  teamId: string;
  teamName: string;
  startingPitcherId: string;
  lineup: string[];
}

export interface LineupGame {
  gameId: string;
  gameDate: string;
  homeTeam: TeamLineup;
  awayTeam: TeamLineup;
}

export interface ExplanationItem {
  text: string;
  type: 'attack-pitch' | 'usage' | 'pitcher-weakness' | 'batter-strength' | 'hr-factor' | 'fallback';
}

export interface PredictionDetail {
  attackPitch: PitchType;
  pitcherUsage: number;
  pitcherPitchRV: number;
  pitcherHRRate: number | null;
  batterRV: number;
  batterHRRate: number | null;
  batterSampleSize: number;
  rawScore: number;
  normalizedUsage: number;
  normalizedPitchWeakness: number;
  normalizedBatterStrength: number;
  hrPitchFactor: number;
  hrBatterFactor: number;
  fallbacks: string[];
  explanations: ExplanationItem[];
}

export interface PredictionRow {
  batterId: string;
  batterName: string;
  batterTeam: string;
  attackPitch: PitchType;
  score: number;
  probability: number;
  topReasons: string[];
  detail: PredictionDetail;
}

export interface LeagueAverages {
  worstPitchRV: number;
  bestBatterRV: number;
  avgPitchHRRate: number;
  avgBatterHRRate: number;
}

export interface ScoringConfig {
  useHrFactors: boolean;
  minSampleSize: number;
  scoreScale: number;
  probScale: number;
}
