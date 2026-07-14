'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Trophy, Play, ChevronRight, Clock, Star,
  CheckCircle2, XCircle, Crown, Loader2,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/cn'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import {
  startRound, submitRound, getLeaderboard, getMyStats,
  type TriviaQuestion, type SubmitRoundResponse, type LeaderboardEntry,
} from '@/lib/api/trivia'

type Tab = 'play' | 'leaderboard'
type GameState = 'idle' | 'loading' | 'playing' | 'submitting' | 'results'

const QUESTION_TIME = 15

export default function TriviaPage() {
  const [tab, setTab] = useState<Tab>('play')
  const [gameState, setGameState] = useState<GameState>('idle')

  // Play state
  const [roundId, setRoundId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<{ questionIndex: number; answer: string }[]>([])
  const [timer, setTimer] = useState(QUESTION_TIME)
  const [results, setResults] = useState<SubmitRoundResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stats
  const statsQ = useQuery({
    queryKey: QUERY_KEYS.TRIVIA_STATS,
    queryFn: getMyStats,
    staleTime: STALE_TIMES.TRIVIA,
    retry: 1,
  })

  // Leaderboard
  const boardQ = useQuery({
    queryKey: QUERY_KEYS.TRIVIA_LEADERBOARD,
    queryFn: getLeaderboard,
    staleTime: STALE_TIMES.TRIVIA,
    enabled: tab === 'leaderboard',
    retry: 1,
  })

  // Timer logic
  useEffect(() => {
    if (gameState !== 'playing') return
    setTimer(QUESTION_TIME)
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          handleAnswer(null)
          return QUESTION_TIME
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState, currentQ])

  const handleAnswer = useCallback((answer: string | null) => {
    if (timerRef.current) clearInterval(timerRef.current)

    const newAnswers = answer
      ? [...answers, { questionIndex: currentQ, answer }]
      : [...answers]
    setAnswers(newAnswers)

    if (currentQ < questions.length - 1) {
      setCurrentQ(prev => prev + 1)
    } else {
      void doSubmit(newAnswers)
    }
  }, [currentQ, questions, answers])

  async function handleStart() {
    setGameState('loading')
    setError(null)
    try {
      const data = await startRound()
      setRoundId(data.roundId)
      setQuestions(data.questions)
      setCurrentQ(0)
      setAnswers([])
      setResults(null)
      setGameState('playing')
    } catch (err) {
      setError((err as Error).message ?? 'Could not start round')
      setGameState('idle')
    }
  }

  async function doSubmit(finalAnswers: { questionIndex: number; answer: string }[]) {
    if (!roundId) return
    setGameState('submitting')
    try {
      const res = await submitRound(roundId, finalAnswers)
      setResults(res)
      setGameState('results')
      void statsQ.refetch()
    } catch (err) {
      setError((err as Error).message ?? 'Could not submit answers')
      setGameState('idle')
    }
  }

  function handlePlayAgain() {
    setGameState('idle')
    setRoundId(null)
    setQuestions([])
    setCurrentQ(0)
    setAnswers([])
    setResults(null)
    setError(null)
  }

  // Fire confetti when leaderboard loads with data
  const confettiFired = useRef(false)
  useEffect(() => {
    if (tab === 'leaderboard' && boardQ.data?.length && !confettiFired.current) {
      confettiFired.current = true
      const gold = '#d4a843'
      const burst = (angle: number, origin: { x: number; y: number }) =>
        confetti({
          particleCount: 60,
          angle,
          spread: 55,
          origin,
          colors: [gold, '#FFD700', '#FFA500', '#fff', '#c49a3a'],
          scalar: 0.8,
          drift: 0,
        })
      burst(60, { x: 0, y: 0.65 })
      burst(120, { x: 1, y: 0.65 })
      setTimeout(() => {
        burst(80, { x: 0.2, y: 0.7 })
        burst(100, { x: 0.8, y: 0.7 })
      }, 250)
    }
    if (tab === 'play') confettiFired.current = false
  }, [tab, boardQ.data])

  const stats = statsQ.data
  const q = questions[currentQ]

  return (
    <div className="flex flex-col pb-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white flex-1">Trivia</h1>
      </div>

      {/* Tab toggle */}
      <div className="mx-4 mb-3 flex rounded-xl bg-[#141414] p-0.5">
        {(['play', 'leaderboard'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all',
              tab === t ? 'bg-[#d4a843]/12 text-[#d4a843]' : 'text-white/40 hover:text-white/60',
            )}
          >
            {t === 'play' ? <Play size={12} /> : <Trophy size={12} />}
            {t === 'play' ? 'Play' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="mx-4 mb-3 flex rounded-2xl bg-[#141414] border border-white/8 divide-x divide-white/8">
          {[
            { value: `${stats.todayRounds}/${stats.maxRoundsPerDay}`, label: 'Rounds' },
            { value: String(stats.weeklyTotal), label: 'Weekly' },
            { value: `#${stats.weeklyRank}`, label: 'Rank' },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center py-3">
              <p className="text-sm font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 rounded-xl bg-red-400/10 border border-red-400/20 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4">
        {tab === 'play' ? (
          <>
            {/* Idle */}
            {gameState === 'idle' && (
              <div className="rounded-2xl bg-[#141414] border border-white/8 p-8 flex flex-col items-center">
                <Star size={44} className="text-[#d4a843]" strokeWidth={1.2} />
                <h2 className="text-xl font-bold text-white mt-4">Daily Trivia</h2>
                <p className="text-xs text-white/45 text-center mt-2 leading-5">
                  Answer 10 questions and earn points!<br />
                  Top scorer each week wins $2 USDC.
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="mt-6 flex items-center gap-2 bg-[#d4a843] text-black px-7 py-3 rounded-xl font-bold text-sm hover:bg-[#c49a3a] transition-colors"
                >
                  <Play size={16} />
                  Start Round
                </button>
              </div>
            )}

            {/* Loading */}
            {gameState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={32} className="text-[#d4a843] animate-spin" />
                <p className="text-xs text-white/40 mt-3">Fetching questions...</p>
              </div>
            )}

            {/* Playing */}
            {gameState === 'playing' && q && (
              <div className="rounded-2xl bg-[#141414] border border-white/8 p-5">
                {/* Progress */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#d4a843]">{currentQ + 1}/{questions.length}</span>
                  <div className="flex items-center gap-1">
                    <Clock size={12} className={timer <= 5 ? 'text-red-400' : 'text-white/50'} />
                    <span className={cn('text-xs font-semibold', timer <= 5 ? 'text-red-400' : 'text-white/50')}>{timer}s</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-0.5 bg-white/8 rounded-full mb-4">
                  <div
                    className="h-0.5 bg-[#d4a843] rounded-full transition-all"
                    style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                  />
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{q.category}</span>
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    q.difficulty === 'hard' ? 'text-red-400' : q.difficulty === 'medium' ? 'text-amber-400' : 'text-emerald-400',
                  )}>
                    {q.difficulty}
                  </span>
                </div>

                {/* Question */}
                <p className="text-sm font-semibold text-white leading-6 mb-5">{q.question}</p>

                {/* Answers */}
                <div className="flex flex-col gap-2">
                  {q.answers.map((ans, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAnswer(ans)}
                      className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl px-4 py-3.5 text-left text-xs text-white hover:bg-white/10 hover:border-[#d4a843]/30 transition-all"
                    >
                      {ans}
                      <ChevronRight size={14} className="text-white/20 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submitting */}
            {gameState === 'submitting' && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={32} className="text-[#d4a843] animate-spin" />
                <p className="text-xs text-white/40 mt-3">Scoring...</p>
              </div>
            )}

            {/* Results */}
            {gameState === 'results' && results && (
              <div>
                <div className="flex flex-col items-center mb-6">
                  <Trophy size={36} className="text-[#d4a843]" strokeWidth={1.2} />
                  <p className="text-3xl font-extrabold text-[#d4a843] mt-2">{results.score} pts</p>
                  <p className="text-xs text-white/40 mt-1">
                    {results.correctAnswers}/{results.totalQuestions} correct
                    {!results.scoringRound ? ' (practice round)' : ''}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {results.results.map(r => (
                    <div key={r.index} className="flex items-start gap-2.5 bg-[#141414] border border-white/8 rounded-xl p-3">
                      {r.isCorrect
                        ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                        : <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white leading-4 line-clamp-2">{r.question}</p>
                        {!r.isCorrect && (
                          <p className="text-[10px] text-emerald-400 mt-1">Correct: {r.correctAnswer}</p>
                        )}
                      </div>
                      {r.pointsEarned > 0 && (
                        <span className="text-xs font-bold text-[#d4a843] shrink-0">+{r.pointsEarned}</span>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePlayAgain}
                  className="mt-5 w-full flex items-center justify-center gap-2 bg-[#d4a843] text-black py-3 rounded-xl font-bold text-sm hover:bg-[#c49a3a] transition-colors"
                >
                  <Play size={16} />
                  Play Again
                </button>
              </div>
            )}
          </>
        ) : (
          /* Leaderboard */
          <>
            {boardQ.isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={32} className="text-[#d4a843] animate-spin" />
              </div>
            ) : !boardQ.data?.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Trophy size={36} className="text-white/15" strokeWidth={1.2} />
                <p className="text-xs text-white/30 mt-3">No scores yet this week</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {boardQ.data.map(entry => (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-3 bg-[#141414] border border-white/8 rounded-xl px-3.5 py-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/6 flex items-center justify-center shrink-0">
                      {entry.rank === 1
                        ? <Crown size={14} className="text-[#d4a843]" />
                        : <span className="text-[10px] font-bold text-white/50">{entry.rank}</span>
                      }
                    </div>
                    <span className="text-xs text-white font-medium flex-1">@{entry.username}</span>
                    <span className="text-xs font-bold text-[#d4a843]">{entry.totalScore} pts</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
