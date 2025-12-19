import { describe, it, expect } from 'vitest';
import {
  getAttackPitch,
  normalizeUsage,
  normalizePitchWeakness,
  normalizeBatterStrength,
  computeHRFactor,
  computePrediction,
  computeLeagueAverages,
  computeAllPredictions,
} from '../domain/scoring';
import type { PitcherPitch, BatterPitchProfile, LeagueAverages, ScoringConfig } from '../domain/types';

describe('getAttackPitch', () => {
  it('returns null for empty array', () => {
    expect(getAttackPitch([])).toBeNull();
  });

  it('returns the single pitch when only one exists', () => {
    const pitches: PitcherPitch[] = [
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Fastball',
        usage: 0.5,
        pitchRV: -2.0,
        pitchHRRate: 0.03,
      },
    ];
    const result = getAttackPitch(pitches);
    expect(result?.pitchType).toBe('Fastball');
  });

  it('selects the pitch with worst pitchRV among top 2 by usage', () => {
    const pitches: PitcherPitch[] = [
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Fastball',
        usage: 0.45,
        pitchRV: 2.0,
        pitchHRRate: 0.02,
      },
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Slider',
        usage: 0.35,
        pitchRV: -4.0,
        pitchHRRate: 0.04,
      },
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Curveball',
        usage: 0.20,
        pitchRV: -6.0,
        pitchHRRate: 0.05,
      },
    ];
    const result = getAttackPitch(pitches);
    expect(result?.pitchType).toBe('Slider');
  });

  it('correctly identifies attack pitch when highest usage has worst RV', () => {
    const pitches: PitcherPitch[] = [
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Fastball',
        usage: 0.50,
        pitchRV: -5.0,
        pitchHRRate: 0.04,
      },
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Slider',
        usage: 0.30,
        pitchRV: 1.0,
        pitchHRRate: 0.02,
      },
    ];
    const result = getAttackPitch(pitches);
    expect(result?.pitchType).toBe('Fastball');
  });

  it('ignores third highest usage pitch even if it has worst RV', () => {
    const pitches: PitcherPitch[] = [
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Fastball',
        usage: 0.40,
        pitchRV: 1.0,
        pitchHRRate: 0.02,
      },
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Slider',
        usage: 0.35,
        pitchRV: 0.5,
        pitchHRRate: 0.02,
      },
      {
        pitcherId: 'P1',
        pitcherName: 'Test Pitcher',
        pitchType: 'Changeup',
        usage: 0.25,
        pitchRV: -10.0,
        pitchHRRate: 0.08,
      },
    ];
    const result = getAttackPitch(pitches);
    expect(result?.pitchType).toBe('Slider');
  });
});

describe('normalizeUsage', () => {
  it('returns 0 when maxUsage is 0', () => {
    expect(normalizeUsage(0.5, 0)).toBe(0);
  });

  it('returns 1 when usage equals maxUsage', () => {
    expect(normalizeUsage(0.5, 0.5)).toBe(1);
  });

  it('returns correct ratio', () => {
    expect(normalizeUsage(0.25, 0.5)).toBe(0.5);
  });

  it('clamps to 1 when usage exceeds maxUsage', () => {
    expect(normalizeUsage(0.6, 0.5)).toBe(1);
  });
});

describe('normalizePitchWeakness', () => {
  it('returns 0 when pitchRV is positive', () => {
    expect(normalizePitchWeakness(2.0, 5.0)).toBe(0);
  });

  it('returns correct ratio for negative pitchRV', () => {
    expect(normalizePitchWeakness(-2.5, 5.0)).toBe(0.5);
  });

  it('returns 1 when pitchRV equals negative leagueWorst', () => {
    expect(normalizePitchWeakness(-5.0, 5.0)).toBe(1);
  });

  it('clamps to 1 for extreme negative values', () => {
    expect(normalizePitchWeakness(-10.0, 5.0)).toBe(1);
  });
});

describe('normalizeBatterStrength', () => {
  it('returns 0 when batterRV is negative', () => {
    expect(normalizeBatterStrength(-2.0, 10.0)).toBe(0);
  });

  it('returns correct ratio for positive batterRV', () => {
    expect(normalizeBatterStrength(5.0, 10.0)).toBe(0.5);
  });

  it('returns 1 when batterRV equals leagueBest', () => {
    expect(normalizeBatterStrength(10.0, 10.0)).toBe(1);
  });
});

describe('computeHRFactor', () => {
  it('returns 1.0 and adds fallback when hrRate is null', () => {
    const fallbacks: string[] = [];
    const result = computeHRFactor(null, 0.03, fallbacks, 'pitch');
    expect(result).toBe(1.0);
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toContain('Pitcher HR rate missing');
  });

  it('returns 1.0 and adds fallback when hrRate is 0', () => {
    const fallbacks: string[] = [];
    const result = computeHRFactor(0, 0.03, fallbacks, 'batter');
    expect(result).toBe(1.0);
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toContain('Batter HR rate missing');
  });

  it('calculates correct ratio', () => {
    const fallbacks: string[] = [];
    const result = computeHRFactor(0.06, 0.03, fallbacks, 'pitch');
    expect(result).toBe(1.5);
    expect(fallbacks).toHaveLength(0);
  });

  it('clamps to 0.5 when ratio is below', () => {
    const fallbacks: string[] = [];
    const result = computeHRFactor(0.01, 0.03, fallbacks, 'pitch');
    expect(result).toBeCloseTo(0.5, 1);
  });

  it('clamps to 1.5 when ratio exceeds', () => {
    const fallbacks: string[] = [];
    const result = computeHRFactor(0.10, 0.03, fallbacks, 'pitch');
    expect(result).toBe(1.5);
  });
});

describe('computePrediction', () => {
  const pitcherPitches: PitcherPitch[] = [
    {
      pitcherId: 'P1',
      pitcherName: 'Test Pitcher',
      pitchType: 'Fastball',
      usage: 0.45,
      pitchRV: 2.0,
      pitchHRRate: 0.03,
    },
    {
      pitcherId: 'P1',
      pitcherName: 'Test Pitcher',
      pitchType: 'Slider',
      usage: 0.35,
      pitchRV: -4.0,
      pitchHRRate: 0.04,
    },
  ];

  const batterProfiles: BatterPitchProfile[] = [
    {
      batterId: 'B1',
      batterName: 'Test Batter',
      batterTeam: 'TST',
      bats: 'R',
      pitchType: 'Slider',
      batterRV: 6.0,
      batterHRRate: 0.06,
      sampleSize: 50,
    },
    {
      batterId: 'B2',
      batterName: 'Small Sample Batter',
      batterTeam: 'TST',
      bats: 'L',
      pitchType: 'Slider',
      batterRV: 8.0,
      batterHRRate: 0.08,
      sampleSize: 10,
    },
  ];

  const leagueAverages: LeagueAverages = {
    worstPitchRV: 5.0,
    bestBatterRV: 10.0,
    avgPitchHRRate: 0.03,
    avgBatterHRRate: 0.05,
  };

  const config: ScoringConfig = {
    useHrFactors: true,
    minSampleSize: 20,
    scoreScale: 2.5,
    probScale: 0.35,
  };

  it('returns null when batter has no profile for attack pitch', () => {
    const result = computePrediction(
      'B_UNKNOWN',
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      config
    );
    expect(result).toBeNull();
  });

  it('returns null when batter sample size is below minimum', () => {
    const result = computePrediction(
      'B2',
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      config
    );
    expect(result).toBeNull();
  });

  it('returns prediction for valid batter', () => {
    const result = computePrediction(
      'B1',
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      config
    );
    expect(result).not.toBeNull();
    expect(result?.batterId).toBe('B1');
    expect(result?.attackPitch).toBe('Slider');
    expect(result?.score).toBeGreaterThan(0);
    expect(result?.probability).toBeGreaterThan(0);
  });

  it('includes explanations in prediction', () => {
    const result = computePrediction(
      'B1',
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      config
    );
    expect(result?.detail.explanations.length).toBeGreaterThan(0);
    expect(result?.detail.explanations[0].text).toContain('Slider');
  });

  it('higher batterRV produces higher score', () => {
    const lowRVBatter: BatterPitchProfile[] = [
      {
        batterId: 'B_LOW',
        batterName: 'Low RV Batter',
        batterTeam: 'TST',
        bats: 'R',
        pitchType: 'Slider',
        batterRV: 2.0,
        batterHRRate: 0.03,
        sampleSize: 50,
      },
    ];
    
    const highRVBatter: BatterPitchProfile[] = [
      {
        batterId: 'B_HIGH',
        batterName: 'High RV Batter',
        batterTeam: 'TST',
        bats: 'R',
        pitchType: 'Slider',
        batterRV: 8.0,
        batterHRRate: 0.07,
        sampleSize: 50,
      },
    ];

    const lowResult = computePrediction(
      'B_LOW',
      'P1',
      pitcherPitches,
      lowRVBatter,
      leagueAverages,
      config
    );
    
    const highResult = computePrediction(
      'B_HIGH',
      'P1',
      pitcherPitches,
      highRVBatter,
      leagueAverages,
      config
    );

    expect(highResult!.score).toBeGreaterThan(lowResult!.score);
  });

  it('worse pitchRV produces higher score', () => {
    const goodPitchPitcher: PitcherPitch[] = [
      {
        pitcherId: 'P_GOOD',
        pitcherName: 'Good Pitch Pitcher',
        pitchType: 'Slider',
        usage: 0.50,
        pitchRV: -1.0,
        pitchHRRate: 0.02,
      },
    ];
    
    const badPitchPitcher: PitcherPitch[] = [
      {
        pitcherId: 'P_BAD',
        pitcherName: 'Bad Pitch Pitcher',
        pitchType: 'Slider',
        usage: 0.50,
        pitchRV: -5.0,
        pitchHRRate: 0.05,
      },
    ];

    const batterForTest: BatterPitchProfile[] = [
      {
        batterId: 'B_TEST',
        batterName: 'Test Batter',
        batterTeam: 'TST',
        bats: 'R',
        pitchType: 'Slider',
        batterRV: 5.0,
        batterHRRate: 0.05,
        sampleSize: 50,
      },
    ];

    const goodResult = computePrediction(
      'B_TEST',
      'P_GOOD',
      goodPitchPitcher,
      batterForTest,
      leagueAverages,
      config
    );
    
    const badResult = computePrediction(
      'B_TEST',
      'P_BAD',
      badPitchPitcher,
      batterForTest,
      leagueAverages,
      config
    );

    expect(badResult!.score).toBeGreaterThan(goodResult!.score);
  });

  it('higher usage produces higher score', () => {
    const lowUsagePitcher: PitcherPitch[] = [
      {
        pitcherId: 'P_LOW_USE',
        pitcherName: 'Low Usage Pitcher',
        pitchType: 'Slider',
        usage: 0.20,
        pitchRV: -3.0,
        pitchHRRate: 0.03,
      },
    ];
    
    const highUsagePitcher: PitcherPitch[] = [
      {
        pitcherId: 'P_HIGH_USE',
        pitcherName: 'High Usage Pitcher',
        pitchType: 'Slider',
        usage: 0.50,
        pitchRV: -3.0,
        pitchHRRate: 0.03,
      },
    ];

    const batterForTest: BatterPitchProfile[] = [
      {
        batterId: 'B_TEST',
        batterName: 'Test Batter',
        batterTeam: 'TST',
        bats: 'R',
        pitchType: 'Slider',
        batterRV: 5.0,
        batterHRRate: 0.05,
        sampleSize: 50,
      },
    ];

    const lowResult = computePrediction(
      'B_TEST',
      'P_LOW_USE',
      lowUsagePitcher,
      batterForTest,
      leagueAverages,
      config
    );
    
    const highResult = computePrediction(
      'B_TEST',
      'P_HIGH_USE',
      highUsagePitcher,
      batterForTest,
      leagueAverages,
      config
    );

    expect(highResult!.detail.rawScore).toBeGreaterThanOrEqual(lowResult!.detail.rawScore);
  });
});

describe('computeLeagueAverages', () => {
  it('computes correct league averages', () => {
    const pitches: PitcherPitch[] = [
      { pitcherId: 'P1', pitcherName: 'P1', pitchType: 'Fastball', usage: 0.5, pitchRV: -2.0, pitchHRRate: 0.02 },
      { pitcherId: 'P1', pitcherName: 'P1', pitchType: 'Slider', usage: 0.5, pitchRV: -4.0, pitchHRRate: 0.04 },
    ];
    
    const batters: BatterPitchProfile[] = [
      { batterId: 'B1', batterName: 'B1', batterTeam: 'T1', bats: 'R', pitchType: 'Fastball', batterRV: 5.0, batterHRRate: 0.05, sampleSize: 50 },
      { batterId: 'B2', batterName: 'B2', batterTeam: 'T1', bats: 'L', pitchType: 'Slider', batterRV: 8.0, batterHRRate: 0.07, sampleSize: 50 },
    ];

    const result = computeLeagueAverages(pitches, batters);
    
    expect(result.worstPitchRV).toBe(4.0);
    expect(result.bestBatterRV).toBe(8.0);
    expect(result.avgPitchHRRate).toBe(0.03);
    expect(result.avgBatterHRRate).toBeCloseTo(0.06);
  });
});

describe('computeAllPredictions', () => {
  const pitcherPitches: PitcherPitch[] = [
    {
      pitcherId: 'P1',
      pitcherName: 'Test Pitcher',
      pitchType: 'Slider',
      usage: 0.50,
      pitchRV: -3.0,
      pitchHRRate: 0.03,
    },
  ];

  const batterProfiles: BatterPitchProfile[] = [
    {
      batterId: 'B1',
      batterName: 'Batter One',
      batterTeam: 'TST',
      bats: 'R',
      pitchType: 'Slider',
      batterRV: 8.0,
      batterHRRate: 0.08,
      sampleSize: 50,
    },
    {
      batterId: 'B2',
      batterName: 'Batter Two',
      batterTeam: 'TST',
      bats: 'L',
      pitchType: 'Slider',
      batterRV: 4.0,
      batterHRRate: 0.04,
      sampleSize: 50,
    },
    {
      batterId: 'B3',
      batterName: 'Small Sample',
      batterTeam: 'TST',
      bats: 'R',
      pitchType: 'Slider',
      batterRV: 10.0,
      batterHRRate: 0.10,
      sampleSize: 15,
    },
  ];

  const leagueAverages: LeagueAverages = {
    worstPitchRV: 5.0,
    bestBatterRV: 10.0,
    avgPitchHRRate: 0.03,
    avgBatterHRRate: 0.05,
  };

  const config: ScoringConfig = {
    useHrFactors: true,
    minSampleSize: 20,
    scoreScale: 2.5,
    probScale: 0.35,
  };

  it('filters out batters below minSampleSize', () => {
    const results = computeAllPredictions(
      ['B1', 'B2', 'B3'],
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      config
    );
    
    expect(results).toHaveLength(2);
    expect(results.find(r => r.batterId === 'B3')).toBeUndefined();
  });

  it('returns results sorted by score descending', () => {
    const results = computeAllPredictions(
      ['B1', 'B2'],
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      config
    );
    
    expect(results[0].batterId).toBe('B1');
    expect(results[1].batterId).toBe('B2');
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  it('returns empty array when no valid batters', () => {
    const results = computeAllPredictions(
      ['B_UNKNOWN'],
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      config
    );
    
    expect(results).toHaveLength(0);
  });
});

describe('HR factors toggle', () => {
  const pitcherPitches: PitcherPitch[] = [
    {
      pitcherId: 'P1',
      pitcherName: 'Test Pitcher',
      pitchType: 'Slider',
      usage: 0.50,
      pitchRV: -3.0,
      pitchHRRate: 0.06,
    },
  ];

  const batterProfiles: BatterPitchProfile[] = [
    {
      batterId: 'B1',
      batterName: 'Test Batter',
      batterTeam: 'TST',
      bats: 'R',
      pitchType: 'Slider',
      batterRV: 5.0,
      batterHRRate: 0.08,
      sampleSize: 50,
    },
  ];

  const leagueAverages: LeagueAverages = {
    worstPitchRV: 5.0,
    bestBatterRV: 10.0,
    avgPitchHRRate: 0.03,
    avgBatterHRRate: 0.04,
  };

  it('produces different scores when HR factors are toggled', () => {
    const configWithHR: ScoringConfig = {
      useHrFactors: true,
      minSampleSize: 20,
      scoreScale: 2.5,
      probScale: 0.35,
    };
    
    const configWithoutHR: ScoringConfig = {
      useHrFactors: false,
      minSampleSize: 20,
      scoreScale: 2.5,
      probScale: 0.35,
    };

    const resultWithHR = computePrediction(
      'B1',
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      configWithHR
    );
    
    const resultWithoutHR = computePrediction(
      'B1',
      'P1',
      pitcherPitches,
      batterProfiles,
      leagueAverages,
      configWithoutHR
    );

    expect(resultWithHR!.detail.hrPitchFactor).toBeGreaterThan(1);
    expect(resultWithHR!.detail.hrBatterFactor).toBeGreaterThan(1);
    expect(resultWithoutHR!.detail.hrPitchFactor).toBe(1);
    expect(resultWithoutHR!.detail.hrBatterFactor).toBe(1);
  });
});
