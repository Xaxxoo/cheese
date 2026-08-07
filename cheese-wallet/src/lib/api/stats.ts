import axios from 'axios';
import { API_URL, ENDPOINTS } from '@/constants';

export interface PublicStats {
  totalUsers: number;
  verifiedUsers: number;
  totalTransactions: number;
  activeWallets: number;
  totalVolumeUsdc: number;
  tierDistribution: {
    silver: number;
    gold: number;
    black: number;
  };
}

export interface ChartPoint {
  date: string;
  volume: number;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const { data } = await axios.get<{ data: PublicStats }>(
    `${API_URL}${ENDPOINTS.PUBLIC_STATS.METRICS}`,
  );
  return data.data;
}

export async function fetchPublicChart(days: number = 30): Promise<ChartPoint[]> {
  const { data } = await axios.get<{ data: ChartPoint[] }>(
    `${API_URL}${ENDPOINTS.PUBLIC_STATS.CHART}`,
    { params: { days } },
  );
  return data.data;
}
