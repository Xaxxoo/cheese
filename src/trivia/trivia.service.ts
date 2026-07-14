import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { TriviaScore } from './entities/trivia-score.entity';
import { User } from '../auth/entities/user.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { TransactionsService } from '../transactions/transactions.service';
import { TxStatus, TxType } from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { EmailService } from '../email/email.service';

// ── Types ───────────────────────────────────────────────────

interface OpenTdbQuestion {
  category: string;
  type: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface CachedRound {
  userId: string;
  questions: OpenTdbQuestion[];
  expiresAt: number;
}

const DIFFICULTY_POINTS: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

const MAX_ROUNDS_PER_DAY = 3;
const ROUND_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ─────────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Returns the Monday 00:00 UTC for the week containing `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → go back 6, otherwise go to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class TriviaService {
  private readonly logger = new Logger(TriviaService.name);
  private readonly rounds = new Map<string, CachedRound>();

  constructor(
    @InjectRepository(TriviaScore)
    private readonly scoreRepo: Repository<TriviaScore>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly blockchainService: BlockchainService,
    private readonly txService: TransactionsService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  // ── Start a new round ───────────────────────────────────────

  async startRound(userId: string) {
    // Clean expired entries
    this.purgeExpired();

    // Fetch 10 questions from Open Trivia DB
    const res = await axios.get<{ response_code: number; results: OpenTdbQuestion[] }>(
      'https://opentdb.com/api.php?amount=10&type=multiple',
      { timeout: 10_000 },
    );

    if (res.data.response_code !== 0 || !res.data.results?.length) {
      throw new BadRequestException('Could not fetch trivia questions. Try again.');
    }

    const roundId = uuidv4();
    this.rounds.set(roundId, {
      userId,
      questions: res.data.results,
      expiresAt: Date.now() + ROUND_TTL_MS,
    });

    // Return questions without correct answers
    const questions = res.data.results.map((q, i) => {
      const allAnswers = shuffleArray([
        ...q.incorrect_answers.map(decodeHtmlEntities),
        decodeHtmlEntities(q.correct_answer),
      ]);
      return {
        index: i,
        question: decodeHtmlEntities(q.question),
        category: decodeHtmlEntities(q.category),
        difficulty: q.difficulty,
        answers: allAnswers,
      };
    });

    return { roundId, questions };
  }

  // ── Submit answers ──────────────────────────────────────────

  async submitRound(userId: string, dto: { roundId: string; answers: { questionIndex: number; answer: string }[] }) {
    const round = this.rounds.get(dto.roundId);
    if (!round) {
      throw new NotFoundException('Round not found or expired');
    }
    if (round.userId !== userId) {
      throw new BadRequestException('This round belongs to another user');
    }
    if (Date.now() > round.expiresAt) {
      this.rounds.delete(dto.roundId);
      throw new BadRequestException('Round expired');
    }

    // Remove from cache (one submission per round)
    this.rounds.delete(dto.roundId);

    // Count today's completed rounds
    const today = new Date();
    const weekStart = toDateString(getMonday(today));
    const todayStr = toDateString(today);

    const todayRounds = await this.scoreRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('DATE(s.played_at) = :todayStr', { todayStr })
      .getCount();

    const roundNumber = todayRounds + 1;

    // Score the answers
    let score = 0;
    let correctAnswers = 0;
    const results = round.questions.map((q, i) => {
      const userAnswer = dto.answers.find((a) => a.questionIndex === i);
      const correctAnswer = decodeHtmlEntities(q.correct_answer);
      const isCorrect = userAnswer?.answer === correctAnswer;

      if (isCorrect) {
        correctAnswers++;
        // Only earn points in the first 3 rounds
        if (roundNumber <= MAX_ROUNDS_PER_DAY) {
          score += DIFFICULTY_POINTS[q.difficulty] ?? 1;
        }
      }

      return {
        index: i,
        question: decodeHtmlEntities(q.question),
        correctAnswer,
        userAnswer: userAnswer?.answer ?? null,
        isCorrect,
        difficulty: q.difficulty,
        pointsEarned: isCorrect && roundNumber <= MAX_ROUNDS_PER_DAY
          ? (DIFFICULTY_POINTS[q.difficulty] ?? 1)
          : 0,
      };
    });

    // If past the daily limit, score is 0
    const finalScore = roundNumber > MAX_ROUNDS_PER_DAY ? 0 : score;

    // Save to DB
    await this.scoreRepo.save(
      this.scoreRepo.create({
        userId,
        score: finalScore,
        correctAnswers,
        totalQuestions: 10,
        roundNumber,
        weekStart,
      }),
    );

    return {
      score: finalScore,
      correctAnswers,
      totalQuestions: 10,
      roundNumber,
      scoringRound: roundNumber <= MAX_ROUNDS_PER_DAY,
      results,
    };
  }

  // ── Weekly leaderboard ──────────────────────────────────────

  async getWeeklyLeaderboard(limit = 50) {
    const weekStart = toDateString(getMonday(new Date()));

    const rows = await this.scoreRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      .addSelect('SUM(s.score)', 'totalScore')
      .addSelect('u.username', 'username')
      .innerJoin('users', 'u', 'u.id = s.user_id')
      .where('s.week_start = :weekStart', { weekStart })
      .groupBy('s.user_id')
      .addGroupBy('u.username')
      .orderBy('"totalScore"', 'DESC')
      .limit(limit)
      .getRawMany<{ userId: string; totalScore: string; username: string }>();

    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      totalScore: parseInt(r.totalScore, 10),
    }));
  }

  // ── User stats ──────────────────────────────────────────────

  async getMyStats(userId: string) {
    const today = new Date();
    const todayStr = toDateString(today);
    const weekStart = toDateString(getMonday(today));

    // Today's rounds and points
    const todayScores = await this.scoreRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('DATE(s.played_at) = :todayStr', { todayStr })
      .getMany();

    const todayRounds = todayScores.length;
    const todayPoints = todayScores.reduce((sum, s) => sum + s.score, 0);

    // Weekly total
    const weeklyResult = await this.scoreRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.score), 0)', 'total')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.week_start = :weekStart', { weekStart })
      .getRawOne<{ total: string }>();

    const weeklyTotal = parseInt(weeklyResult?.total ?? '0', 10);

    // Weekly rank
    const rankResult = await this.scoreRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'uid')
      .addSelect('SUM(s.score)', 'total')
      .where('s.week_start = :weekStart', { weekStart })
      .groupBy('s.user_id')
      .having('SUM(s.score) > :weeklyTotal', { weeklyTotal })
      .getRawMany();

    const weeklyRank = rankResult.length + 1;

    // All-time total
    const allTimeResult = await this.scoreRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.score), 0)', 'total')
      .where('s.user_id = :userId', { userId })
      .getRawOne<{ total: string }>();

    const allTimeTotal = parseInt(allTimeResult?.total ?? '0', 10);

    return {
      todayRounds,
      todayPoints,
      maxRoundsPerDay: MAX_ROUNDS_PER_DAY,
      weeklyTotal,
      weeklyRank,
      allTimeTotal,
    };
  }

  // ── Cron: reward weekly winner ──────────────────────────────

  @Cron('0 0 * * 1') // Every Monday at 00:00
  async rewardWeeklyWinner() {
    const lastMonday = getMonday(new Date());
    lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
    const lastWeekStart = toDateString(lastMonday);

    this.logger.log(`Running weekly trivia reward for week ${lastWeekStart}`);

    // Top scorer, tiebreak by earliest play
    const topRow = await this.scoreRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      .addSelect('SUM(s.score)', 'totalScore')
      .addSelect('MIN(s.played_at)', 'firstPlayed')
      .where('s.week_start = :lastWeekStart', { lastWeekStart })
      .groupBy('s.user_id')
      .orderBy('"totalScore"', 'DESC')
      .addOrderBy('"firstPlayed"', 'ASC')
      .limit(1)
      .getRawOne<{ userId: string; totalScore: string; firstPlayed: string }>();

    if (!topRow || parseInt(topRow.totalScore, 10) === 0) {
      this.logger.log('No trivia winner for last week — no scores recorded');
      return;
    }

    const winner = await this.userRepo.findOne({ where: { id: topRow.userId } });
    if (!winner?.stellarPublicKey) {
      this.logger.warn(`Trivia winner ${topRow.userId} has no wallet — skipping reward`);
      return;
    }

    // Credit $2 USDC
    const reference = `CW-TRIVIA-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
    try {
      const txHash = await this.blockchainService.platformDepositUsdc(
        winner.stellarPublicKey,
        '2',
      );

      await this.txService.create({
        userId: winner.id,
        type: TxType.TRIVIA_REWARD,
        status: TxStatus.COMPLETED,
        amountUsdc: '2',
        feeUsdc: '0',
        reference,
        txHash,
        description: `Trivia weekly winner reward — week of ${lastWeekStart}`,
      });

      await this.notificationsService.create({
        userId: winner.id,
        type: NotificationType.POINTS_AWARDED,
        title: 'Trivia Winner!',
        body: `Congrats! You won the weekly trivia and earned $2 USDC.`,
      });

      // Send winner email
      if (winner.email) {
        await this.emailService.sendTriviaWinner({
          to: winner.email,
          fullName: winner.fullName ?? winner.username,
          username: winner.username,
          totalScore: parseInt(topRow.totalScore, 10),
          weekOf: lastWeekStart,
          amountUsdc: '2',
        });
      }

      this.logger.log(
        `Trivia reward sent to ${winner.username} (${winner.id}) — $2 USDC [hash=${txHash}]`,
      );
    } catch (err) {
      this.logger.error(
        `[CRITICAL] Trivia reward failed for user ${winner.id}: ${(err as Error).message}`,
      );
    }
  }

  // ── Internal helpers ────────────────────────────────────────

  private purgeExpired() {
    const now = Date.now();
    for (const [id, round] of this.rounds) {
      if (now > round.expiresAt) {
        this.rounds.delete(id);
      }
    }
  }
}
