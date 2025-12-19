/**
 * API client for YardWatch backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  let url = `${API_BASE}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.detail || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

// ============ Types ============

export interface PitchTypeStats {
  pitch_type: string;
  pitch_name: string;
  usage_pct: number;
  pitches_thrown: number;
  run_value: number;
  run_value_per_100: number;
  batting_avg: number;
  slg_pct: number;
  whiff_pct: number;
  hr_rate: number;
}

export interface PitcherProfile {
  pitcher_id: number;
  name: string;
  team: string;
  throws: string;
  pitches: PitchTypeStats[];
  total_pitches: number;
  season: number;
}

export interface AttackPitchResponse {
  pitcher_id: number;
  pitcher_name: string;
  attack_pitch: string;
  attack_pitch_name: string;
  usage_pct: number;
  run_value: number;
  run_value_per_100: number;
  hr_rate: number;
  top_pitches_considered: Array<{
    pitch: string;
    name: string;
    usage: number;
    rv_per_100: number;
  }>;
}

export interface BatterVsPitchType {
  pitch_type: string;
  pitch_name: string;
  pitches_seen: number;
  run_value: number;
  run_value_per_100: number;
  batting_avg: number;
  slg_pct: number;
  hr_rate: number;
  whiff_pct: number;
}

export interface BatterProfile {
  batter_id: number;
  name: string;
  team: string;
  bats: string;
  vs_pitch_types: BatterVsPitchType[];
  total_pitches_seen: number;
  season: number;
}

export interface LineupPlayer {
  batter_id: number;
  name: string;
  batting_order: number;
  position: string;
}

export interface TeamLineup {
  team_id: number;
  team_name: string;
  team_abbrev: string;
  starting_pitcher_id: number | null;
  starting_pitcher_name: string | null;
  lineup: LineupPlayer[];
}

export interface Game {
  game_id: string;
  game_date: string;
  game_time: string | null;
  venue: string | null;
  home_team: TeamLineup;
  away_team: TeamLineup;
  status: string;
}

export interface GameSummary {
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_pitcher: string | null;
  away_pitcher: string | null;
}

export interface MatchupSetup {
  game_id: string;
  game_date: string;
  batting_team: string;
  opposing_pitcher_id: number;
  opposing_pitcher_name: string;
  lineup: Array<{
    batter_id: number;
    name: string;
    batting_order: number;
    position: string;
  }>;
  lineup_available: boolean;
  error?: string;
}

// ============ API Methods ============

export const api = {
  // Health check
  health: () => request<{ status: string }>('/health'),

  // Games
  games: {
    getToday: () => request<GameSummary[]>('/api/games/today'),

    getByDate: (date: string) => request<GameSummary[]>(`/api/games/schedule/${date}`),

    getById: (gameId: string) => request<Game>(`/api/games/${gameId}`),

    getMatchups: (gameId: string, team: 'home' | 'away') =>
      request<MatchupSetup>(`/api/games/${gameId}/matchups`, {
        params: { team },
      }),

    searchPlayers: (query: string) =>
      request<Array<{ id: number; name: string; team: string; position: string }>>(
        '/api/games/search/players',
        { params: { q: query } }
      ),
  },

  // Pitchers
  pitchers: {
    getProfile: (pitcherId: number, season?: number) =>
      request<PitcherProfile>(`/api/pitchers/${pitcherId}`, {
        params: season ? { season } : {},
      }),

    getAttackPitch: (pitcherId: number, season?: number) =>
      request<AttackPitchResponse>(`/api/pitchers/${pitcherId}/attack-pitch`, {
        params: season ? { season } : {},
      }),

    lookupByName: (firstName: string, lastName: string) =>
      request<{ pitcher_id: number; name: string }>(
        `/api/pitchers/lookup/${lastName}/${firstName}`
      ),
  },

  // Batters
  batters: {
    getProfile: (batterId: number, season?: number) =>
      request<BatterProfile>(`/api/batters/${batterId}`, {
        params: season ? { season } : {},
      }),

    getVsPitch: (batterId: number, pitchType: string, season?: number) =>
      request<BatterVsPitchType>(`/api/batters/${batterId}/vs-pitch/${pitchType}`, {
        params: season ? { season } : {},
      }),

    getBatch: (batterIds: number[], season?: number) =>
      request<BatterProfile[]>('/api/batters/batch', {
        method: 'POST',
        body: batterIds,
        params: season ? { season } : {},
      }),

    lookupByName: (firstName: string, lastName: string) =>
      request<{ batter_id: number; name: string }>(
        `/api/batters/lookup/${lastName}/${firstName}`
      ),
  },
};

export { ApiError };
export default api;
