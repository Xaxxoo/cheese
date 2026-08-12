import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  username: string;
  referralCode?: string;
}

export interface RegisterResponse {
  success?: boolean;
  user: {
    id: string;
    email: string;
    username: string;
    referralCode: string;
    points: number;
    createdAt: string;
  };
  referralLink: string;
}

export interface UsernameCheckResponse {
  available: boolean;
  username: string;
  reason?: string;
}

export type SharePlatform = 'twitter' | 'linkedin' | 'whatsapp' | 'telegram' | 'facebook';

export interface SharePayload {
  userId: string;
  platform: SharePlatform;
}

export interface ShareResponse {
  success: boolean;
  shareEventId: string;
  message: string;
  pendingPoints: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  joinDate: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
}

export interface PointsResponse {
  points: number;
  shareCount: number;
  referralCount: number;
}

export interface RankResponse {
  rank: number | null;
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function registerWaitlist(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<any>('/waitlist/register', payload);
  return data?.data || data;
}

export async function checkUsername(username: string): Promise<UsernameCheckResponse> {
  try {
    const { data } = await api.get<any>('/waitlist/check-username', {
      params: { username },
    });

    const response = data?.data || data;

    if (response && typeof response === 'object') {
      return {
        available: response.available === true,
        username: response.username ?? username,
        reason: response.reason,
      };
    }

    return { available: true, username, reason: undefined };
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;

    if (status === 400) {
      let msgStr = 'Invalid username';

      if (errorData?.message) {
        msgStr = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : String(errorData.message);
      } else if (errorData?.error) {
        msgStr = String(errorData.error);
      }

      return {
        available: true,
        username,
        reason: msgStr,
      };
    }

    return {
      available: true,
      username,
      reason: error.message || 'Could not verify',
    };
  }
}

export async function trackShare(payload: SharePayload): Promise<ShareResponse> {
  const { data } = await api.post<any>('/waitlist/share', payload);
  return data?.data || data;
}

export async function getLeaderboard(): Promise<LeaderboardResponse> {
  try {
    const { data } = await api.get<any>('/leaderboard');
    const response = data?.data || data;

    if (Array.isArray(response)) {
      return { entries: response, total: response.length };
    }

    if (response && typeof response === 'object') {
      const rawEntries = Array.isArray(response.entries) ? response.entries : [];
      const entriesWithRank = rawEntries.map((entry: any, index: number) => ({
        ...entry,
        rank: typeof entry.rank === 'number' ? entry.rank : index + 1,
      }));
      return {
        entries: entriesWithRank,
        total: typeof response.total === 'number' ? response.total : rawEntries.length,
      };
    }

    return { entries: [], total: 0 };
  } catch {
    return { entries: [], total: 0 };
  }
}

export async function getReferralInfo(code: string) {
  const { data } = await api.get<any>(`/waitlist/referral/${code}`);
  return data?.data || data;
}

export async function getUserPoints(userId: string): Promise<PointsResponse> {
  const { data } = await api.get<any>(`/waitlist/points/${userId}`);
  return data?.data || data;
}

export async function getUserRank(userId: string): Promise<RankResponse> {
  const { data } = await api.get<any>(`/leaderboard/rank/${userId}`);
  return data?.data || data;
}

export async function getReservedUsernamesCount(): Promise<number> {
  const { data } = await api.get<any>('/waitlist/count');

  const value = data?.data ?? data;
  if (typeof value === 'number') return value;

  throw new Error('Invalid response format for count');
}
