import apiClient from './client'
import { ENDPOINTS } from '@/constants'
import type { ApiResponse } from '@/types'

export interface TriviaQuestion {
  index: number
  question: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  answers: string[]
}

export interface StartRoundResponse {
  roundId: string
  questions: TriviaQuestion[]
}

export interface RoundResult {
  index: number
  question: string
  correctAnswer: string
  userAnswer: string | null
  isCorrect: boolean
  difficulty: string
  pointsEarned: number
}

export interface SubmitRoundResponse {
  score: number
  correctAnswers: number
  totalQuestions: number
  roundNumber: number
  scoringRound: boolean
  results: RoundResult[]
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  totalScore: number
}

export interface TriviaStats {
  todayRounds: number
  todayPoints: number
  maxRoundsPerDay: number
  weeklyTotal: number
  weeklyRank: number
  allTimeTotal: number
}

export async function startRound(): Promise<StartRoundResponse> {
  const { data } = await apiClient.post<ApiResponse<StartRoundResponse>>(ENDPOINTS.TRIVIA.START)
  return data.data
}

export async function submitRound(
  roundId: string,
  answers: { questionIndex: number; answer: string }[],
): Promise<SubmitRoundResponse> {
  const { data } = await apiClient.post<ApiResponse<SubmitRoundResponse>>(
    ENDPOINTS.TRIVIA.SUBMIT,
    { roundId, answers },
  )
  return data.data
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await apiClient.get<ApiResponse<LeaderboardEntry[]>>(ENDPOINTS.TRIVIA.LEADERBOARD)
  return data.data
}

export async function getMyStats(): Promise<TriviaStats> {
  const { data } = await apiClient.get<ApiResponse<TriviaStats>>(ENDPOINTS.TRIVIA.STATS)
  return data.data
}
