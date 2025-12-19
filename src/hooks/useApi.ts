/**
 * Custom React hooks for data fetching with React Query
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  Game,
  PitcherProfile,
  AttackPitchResponse,
  BatterProfile,
} from '../api';

// Query keys for cache management
export const queryKeys = {
  games: {
    all: ['games'] as const,
    today: () => [...queryKeys.games.all, 'today'] as const,
    byDate: (date: string) => [...queryKeys.games.all, 'date', date] as const,
    byId: (id: string) => [...queryKeys.games.all, id] as const,
    matchups: (gameId: string, team: 'home' | 'away') =>
      [...queryKeys.games.all, gameId, 'matchups', team] as const,
  },
  pitchers: {
    all: ['pitchers'] as const,
    profile: (id: number, season?: number) =>
      [...queryKeys.pitchers.all, id, season ?? 'current'] as const,
    attackPitch: (id: number, season?: number) =>
      [...queryKeys.pitchers.all, id, 'attack-pitch', season ?? 'current'] as const,
  },
  batters: {
    all: ['batters'] as const,
    profile: (id: number, season?: number) =>
      [...queryKeys.batters.all, id, season ?? 'current'] as const,
    batch: (ids: number[], season?: number) =>
      [...queryKeys.batters.all, 'batch', ids.join(','), season ?? 'current'] as const,
  },
};

// ============ Game Hooks ============

export function useTodaysGames() {
  return useQuery({
    queryKey: queryKeys.games.today(),
    queryFn: () => api.games.getToday(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useGamesByDate(date: string) {
  return useQuery({
    queryKey: queryKeys.games.byDate(date),
    queryFn: () => api.games.getByDate(date),
    staleTime: 5 * 60 * 1000,
    enabled: !!date,
  });
}

export function useGame(gameId: string | null) {
  return useQuery({
    queryKey: queryKeys.games.byId(gameId ?? ''),
    queryFn: () => api.games.getById(gameId!),
    staleTime: 2 * 60 * 1000, // 2 minutes - lineups can update
    enabled: !!gameId,
  });
}

export function useMatchupSetup(gameId: string | null, team: 'home' | 'away' | null) {
  return useQuery({
    queryKey: queryKeys.games.matchups(gameId ?? '', team ?? 'home'),
    queryFn: () => api.games.getMatchups(gameId!, team!),
    staleTime: 2 * 60 * 1000,
    enabled: !!gameId && !!team,
  });
}

// ============ Pitcher Hooks ============

export function usePitcherProfile(pitcherId: number | null, season?: number) {
  return useQuery({
    queryKey: queryKeys.pitchers.profile(pitcherId ?? 0, season),
    queryFn: () => api.pitchers.getProfile(pitcherId!, season),
    staleTime: 30 * 60 * 1000, // 30 minutes - pitcher stats don't change often
    enabled: !!pitcherId,
  });
}

export function useAttackPitch(pitcherId: number | null, season?: number) {
  return useQuery({
    queryKey: queryKeys.pitchers.attackPitch(pitcherId ?? 0, season),
    queryFn: () => api.pitchers.getAttackPitch(pitcherId!, season),
    staleTime: 30 * 60 * 1000,
    enabled: !!pitcherId,
  });
}

// ============ Batter Hooks ============

export function useBatterProfile(batterId: number | null, season?: number) {
  return useQuery({
    queryKey: queryKeys.batters.profile(batterId ?? 0, season),
    queryFn: () => api.batters.getProfile(batterId!, season),
    staleTime: 30 * 60 * 1000,
    enabled: !!batterId,
  });
}

export function useBattersBatch(batterIds: number[], season?: number) {
  return useQuery({
    queryKey: queryKeys.batters.batch(batterIds, season),
    queryFn: () => api.batters.getBatch(batterIds, season),
    staleTime: 30 * 60 * 1000,
    enabled: batterIds.length > 0,
  });
}

// ============ Combined Hooks for Matchup Predictions ============

export interface MatchupData {
  game: Game | null;
  pitcher: PitcherProfile | null;
  attackPitch: AttackPitchResponse | null;
  batters: BatterProfile[];
  isLoading: boolean;
  error: Error | null;
}

export function useMatchupData(
  gameId: string | null,
  pitcherId: number | null,
  batterIds: number[]
): MatchupData {
  const gameQuery = useGame(gameId);
  const pitcherQuery = usePitcherProfile(pitcherId);
  const attackPitchQuery = useAttackPitch(pitcherId);
  const battersQuery = useBattersBatch(batterIds);

  const isLoading =
    gameQuery.isLoading ||
    pitcherQuery.isLoading ||
    attackPitchQuery.isLoading ||
    battersQuery.isLoading;

  const error =
    gameQuery.error || pitcherQuery.error || attackPitchQuery.error || battersQuery.error;

  return {
    game: gameQuery.data ?? null,
    pitcher: pitcherQuery.data ?? null,
    attackPitch: attackPitchQuery.data ?? null,
    batters: battersQuery.data ?? [],
    isLoading,
    error: error as Error | null,
  };
}

// ============ Prefetch Helpers ============

export function usePrefetchGame() {
  const queryClient = useQueryClient();

  return (gameId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.games.byId(gameId),
      queryFn: () => api.games.getById(gameId),
    });
  };
}

export function usePrefetchPitcher() {
  const queryClient = useQueryClient();

  return (pitcherId: number) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.pitchers.profile(pitcherId),
      queryFn: () => api.pitchers.getProfile(pitcherId),
    });
    queryClient.prefetchQuery({
      queryKey: queryKeys.pitchers.attackPitch(pitcherId),
      queryFn: () => api.pitchers.getAttackPitch(pitcherId),
    });
  };
}
