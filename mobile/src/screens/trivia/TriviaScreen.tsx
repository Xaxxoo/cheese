import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import {
  ArrowLeft, Trophy, Play, ChevronRight, Clock, Star,
  CheckCircle2, XCircle, Crown,
} from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { COLORS } from '../../constants'
import {
  startRound, submitRound, getLeaderboard, getMyStats,
  type TriviaQuestion, type SubmitRoundResponse, type LeaderboardEntry, type TriviaStats,
} from '../../api/trivia'

type Props = NativeStackScreenProps<AppStackParamList, 'Trivia'>

type Tab = 'play' | 'leaderboard'
type GameState = 'idle' | 'loading' | 'playing' | 'submitting' | 'results'

const QUESTION_TIME = 15 // seconds per question

export default function TriviaScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('play')
  const [gameState, setGameState] = useState<GameState>('idle')

  // Play state
  const [roundId, setRoundId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<{ questionIndex: number; answer: string }[]>([])
  const [timer, setTimer] = useState(QUESTION_TIME)
  const [results, setResults] = useState<SubmitRoundResponse | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stats & leaderboard
  const [stats, setStats] = useState<TriviaStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingBoard, setLoadingBoard] = useState(false)

  // Load stats on mount
  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoadingStats(true)
    try {
      setStats(await getMyStats())
    } catch { /* ignore */ }
    setLoadingStats(false)
  }

  async function loadLeaderboard() {
    setLoadingBoard(true)
    try {
      setLeaderboard(await getLeaderboard())
    } catch { /* ignore */ }
    setLoadingBoard(false)
  }

  // Timer logic
  useEffect(() => {
    if (gameState !== 'playing') return
    setTimer(QUESTION_TIME)
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          // Auto-skip: record no answer
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
      // Submit
      void doSubmit(newAnswers)
    }
  }, [currentQ, questions, answers])

  async function handleStart() {
    setGameState('loading')
    try {
      const data = await startRound()
      setRoundId(data.roundId)
      setQuestions(data.questions)
      setCurrentQ(0)
      setAnswers([])
      setResults(null)
      setGameState('playing')
    } catch (err) {
      Alert.alert('Error', (err as Error).message ?? 'Could not start round')
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
      void loadStats()
    } catch (err) {
      Alert.alert('Error', (err as Error).message ?? 'Could not submit answers')
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
  }

  function switchTab(t: Tab) {
    setTab(t)
    if (t === 'leaderboard') void loadLeaderboard()
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={20} color="#fff" strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trivia</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab toggle */}
      <View style={s.tabRow}>
        {(['play', 'leaderboard'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => switchTab(t)}
          >
            {t === 'play'
              ? <Play size={14} color={tab === t ? COLORS.gold : 'rgba(255,255,255,0.4)'} strokeWidth={1.5} />
              : <Trophy size={14} color={tab === t ? COLORS.gold : 'rgba(255,255,255,0.4)'} strokeWidth={1.5} />
            }
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'play' ? 'Play' : 'Leaderboard'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats bar */}
      {stats && (
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{stats.todayRounds}/{stats.maxRoundsPerDay}</Text>
            <Text style={s.statLabel}>Rounds</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{stats.weeklyTotal}</Text>
            <Text style={s.statLabel}>Weekly</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>#{stats.weeklyRank}</Text>
            <Text style={s.statLabel}>Rank</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.content}>
        {tab === 'play' ? (
          <>
            {/* Idle state */}
            {gameState === 'idle' && (
              <View style={s.idleCard}>
                <Star size={48} color={COLORS.gold} strokeWidth={1.2} />
                <Text style={s.idleTitle}>Daily Trivia</Text>
                <Text style={s.idleDesc}>
                  Answer 10 questions and earn points!{'\n'}
                  Top scorer each week wins $2 USDC.
                </Text>
                <TouchableOpacity style={s.startBtn} onPress={handleStart}>
                  <Play size={18} color="#000" strokeWidth={2} />
                  <Text style={s.startBtnText}>Start Round</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading */}
            {gameState === 'loading' && (
              <View style={s.centerBox}>
                <ActivityIndicator size="large" color={COLORS.gold} />
                <Text style={s.loadingText}>Fetching questions...</Text>
              </View>
            )}

            {/* Playing */}
            {gameState === 'playing' && questions[currentQ] && (
              <View style={s.questionCard}>
                {/* Progress */}
                <View style={s.progressRow}>
                  <Text style={s.progressText}>{currentQ + 1}/{questions.length}</Text>
                  <View style={s.timerBadge}>
                    <Clock size={12} color={timer <= 5 ? COLORS.red : 'rgba(255,255,255,0.5)'} strokeWidth={1.5} />
                    <Text style={[s.timerText, timer <= 5 && { color: COLORS.red }]}>{timer}s</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${((currentQ + 1) / questions.length) * 100}%` }]} />
                </View>

                {/* Category + difficulty */}
                <View style={s.metaRow}>
                  <Text style={s.category}>{questions[currentQ].category}</Text>
                  <Text style={[s.difficulty, {
                    color: questions[currentQ].difficulty === 'hard' ? COLORS.red
                      : questions[currentQ].difficulty === 'medium' ? COLORS.amber : COLORS.green,
                  }]}>
                    {questions[currentQ].difficulty}
                  </Text>
                </View>

                {/* Question */}
                <Text style={s.questionText}>{questions[currentQ].question}</Text>

                {/* Answers */}
                {questions[currentQ].answers.map((ans, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.answerBtn}
                    onPress={() => handleAnswer(ans)}
                  >
                    <Text style={s.answerText}>{ans}</Text>
                    <ChevronRight size={16} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Submitting */}
            {gameState === 'submitting' && (
              <View style={s.centerBox}>
                <ActivityIndicator size="large" color={COLORS.gold} />
                <Text style={s.loadingText}>Scoring...</Text>
              </View>
            )}

            {/* Results */}
            {gameState === 'results' && results && (
              <View>
                <View style={s.resultsHeader}>
                  <Trophy size={40} color={COLORS.gold} strokeWidth={1.2} />
                  <Text style={s.scoreTitle}>{results.score} pts</Text>
                  <Text style={s.scoreSubtitle}>
                    {results.correctAnswers}/{results.totalQuestions} correct
                    {!results.scoringRound ? ' (practice round)' : ''}
                  </Text>
                </View>

                {/* Results breakdown */}
                {results.results.map(r => (
                  <View key={r.index} style={s.resultRow}>
                    {r.isCorrect
                      ? <CheckCircle2 size={18} color={COLORS.green} strokeWidth={1.5} />
                      : <XCircle size={18} color={COLORS.red} strokeWidth={1.5} />
                    }
                    <View style={s.resultInfo}>
                      <Text style={s.resultQ} numberOfLines={2}>{r.question}</Text>
                      {!r.isCorrect && (
                        <Text style={s.resultCorrect}>Correct: {r.correctAnswer}</Text>
                      )}
                    </View>
                    {r.pointsEarned > 0 && (
                      <Text style={s.resultPts}>+{r.pointsEarned}</Text>
                    )}
                  </View>
                ))}

                <TouchableOpacity style={s.startBtn} onPress={handlePlayAgain}>
                  <Play size={18} color="#000" strokeWidth={2} />
                  <Text style={s.startBtnText}>Play Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          /* Leaderboard */
          <>
            {loadingBoard ? (
              <View style={s.centerBox}>
                <ActivityIndicator size="large" color={COLORS.gold} />
              </View>
            ) : leaderboard.length === 0 ? (
              <View style={s.centerBox}>
                <Trophy size={40} color="rgba(255,255,255,0.15)" strokeWidth={1.2} />
                <Text style={s.emptyText}>No scores yet this week</Text>
              </View>
            ) : (
              leaderboard.map(entry => (
                <View key={entry.userId} style={s.boardRow}>
                  <View style={s.rankBadge}>
                    {entry.rank === 1
                      ? <Crown size={16} color={COLORS.gold} strokeWidth={1.5} />
                      : <Text style={s.rankText}>{entry.rank}</Text>
                    }
                  </View>
                  <Text style={s.boardUsername}>@{entry.username}</Text>
                  <Text style={s.boardScore}>{entry.totalScore} pts</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#fff' },

  tabRow:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.surface, borderRadius: 12, padding: 3 },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabBtnActive: { backgroundColor: 'rgba(212,168,67,0.12)' },
  tabText:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive:{ color: COLORS.gold },

  statsBar:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: COLORS.border },
  statItem:     { flex: 1, alignItems: 'center' },
  statValue:    { fontSize: 16, fontWeight: '700', color: '#fff' },
  statLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  statDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 },

  content:      { padding: 16, paddingBottom: 48 },

  // Idle
  idleCard:     { backgroundColor: COLORS.surface, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  idleTitle:    { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 16 },
  idleDesc:     { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 24 },
  startBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.gold, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 16 },
  startBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },

  // Loading
  centerBox:    { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText:  { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 12 },

  // Question
  questionCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  progressRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressText: { fontSize: 13, fontWeight: '600', color: COLORS.gold },
  timerBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText:    { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  progressBar:  { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 16 },
  progressFill: { height: 3, backgroundColor: COLORS.gold, borderRadius: 2 },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  category:     { fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 },
  difficulty:   { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText: { fontSize: 16, fontWeight: '600', color: '#fff', lineHeight: 24, marginBottom: 20 },
  answerBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  answerText:   { flex: 1, fontSize: 14, color: '#fff' },

  // Results
  resultsHeader:{ alignItems: 'center', marginBottom: 24 },
  scoreTitle:   { fontSize: 36, fontWeight: '800', color: COLORS.gold, marginTop: 8 },
  scoreSubtitle:{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  resultRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border },
  resultInfo:   { flex: 1 },
  resultQ:      { fontSize: 13, color: '#fff', lineHeight: 18 },
  resultCorrect:{ fontSize: 11, color: COLORS.green, marginTop: 4 },
  resultPts:    { fontSize: 13, fontWeight: '700', color: COLORS.gold },

  // Leaderboard
  boardRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border },
  rankBadge:    { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  rankText:     { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  boardUsername: { flex: 1, fontSize: 14, color: '#fff', fontWeight: '500' },
  boardScore:   { fontSize: 14, fontWeight: '700', color: COLORS.gold },

  emptyText:    { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 12 },
})
