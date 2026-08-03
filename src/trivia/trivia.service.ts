import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
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
import { TriviaReward, TriviaRewardStatus } from './entities/trivia-reward.entity';

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

const MAX_ROUNDS_PER_DAY = 20;
const ROUND_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TRIVIA_REWARD_USDC = '2';
const REWARD_LOCK_TTL_MS = 15 * 60 * 1000;

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
    @InjectRepository(TriviaReward)
    private readonly rewardRepo: Repository<TriviaReward>,
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

    const reward = await this.getOrCreateReward(
      lastWeekStart,
      topRow.userId,
      parseInt(topRow.totalScore, 10),
    );
    await this.claimAndSettleReward(reward);
  }

  // Recover rewards that were interrupted after the blockchain transfer or by
  // a transient database/provider failure. The deterministic memo lets us
  // find an already-submitted Stellar payment before sending another one.
  @Cron('*/10 * * * *')
  async recoverTriviaRewards() {
    const rewards = await this.rewardRepo.find({
      where: {
        status: In([
          TriviaRewardStatus.PENDING,
          TriviaRewardStatus.PROCESSING,
          TriviaRewardStatus.FAILED,
        ]),
      },
    });

    for (const reward of rewards) {
      if (
        reward.status === TriviaRewardStatus.PROCESSING &&
        reward.lockedAt &&
        Date.now() - reward.lockedAt.getTime() < REWARD_LOCK_TTL_MS
      ) {
        continue;
      }
      if (reward.status === TriviaRewardStatus.PROCESSING) {
        await this.rewardRepo.update(reward.id, {
          status: TriviaRewardStatus.FAILED,
          lockedAt: null,
          failureReason: 'Previous reward attempt timed out; retrying safely',
        });
      }
      await this.claimAndSettleReward(reward);
    }
  }

  private async getOrCreateReward(
    weekStart: string,
    winnerId: string,
    totalScore: number,
  ): Promise<TriviaReward> {
    const reference = `CW-TRIVIA-${weekStart.replace(/-/g, '')}`;
    const description = `Trivia weekly winner reward — week of ${weekStart}`;
    const existingTransaction = await this.txService.findByTypeAndDescription(
      TxType.TRIVIA_REWARD,
      description,
    );

    await this.rewardRepo
      .createQueryBuilder()
      .insert()
      .into(TriviaReward)
      .values({
        weekStart,
        winnerId: existingTransaction?.userId ?? winnerId,
        totalScore,
        amountUsdc: existingTransaction?.amountUsdc ?? TRIVIA_REWARD_USDC,
        reference: existingTransaction?.reference ?? reference,
        txHash: existingTransaction?.txHash ?? null,
        status: existingTransaction
          ? TriviaRewardStatus.COMPLETED
          : TriviaRewardStatus.PENDING,
        attempts: 0,
        rewardedAt: existingTransaction?.createdAt ?? null,
      })
      .orIgnore()
      .execute();

    const reward = await this.rewardRepo.findOne({ where: { weekStart } });
    if (!reward) throw new Error(`Could not create trivia reward for ${weekStart}`);

    if (existingTransaction && reward.status !== TriviaRewardStatus.COMPLETED) {
      await this.rewardRepo.update(reward.id, {
        winnerId: existingTransaction.userId,
        txHash: existingTransaction.txHash,
        amountUsdc: existingTransaction.amountUsdc,
        reference: existingTransaction.reference,
        status: TriviaRewardStatus.COMPLETED,
        rewardedAt: existingTransaction.createdAt,
        lockedAt: null,
        failureReason: null,
      });
      return (await this.rewardRepo.findOne({ where: { id: reward.id } })) ?? reward;
    }

    return reward;
  }

  private async claimAndSettleReward(reward: TriviaReward): Promise<void> {
    const claim = await this.rewardRepo
      .createQueryBuilder()
      .update(TriviaReward)
      .set({
        status: TriviaRewardStatus.PROCESSING,
        lockedAt: new Date(),
        failureReason: null,
        attempts: () => '"attempts" + 1',
      })
      .where('"id" = :id', { id: reward.id })
      .andWhere('"status" IN (:...statuses)', {
        statuses: [
          TriviaRewardStatus.PENDING,
          TriviaRewardStatus.FAILED,
        ],
      })
      .execute();

    if (!claim.affected) return;

    try {
      const winner = await this.userRepo.findOne({ where: { id: reward.winnerId } });
      if (!winner?.stellarPublicKey) {
        throw new Error('Trivia winner has no Stellar wallet');
      }

      const memo = `CW-TRIVIA-${reward.weekStart.replace(/-/g, '')}`;
      let txHash = reward.txHash;

      if (!txHash) {
        txHash = await this.blockchainService.findPlatformUsdcPaymentByMemo(
          winner.stellarPublicKey,
          reward.amountUsdc,
          memo,
        );
      }

      if (!txHash) {
        txHash = await this.blockchainService.platformDepositUsdc(
          winner.stellarPublicKey,
          reward.amountUsdc,
          memo,
        );
      }

      // Persist the hash before creating the user ledger row. If the process
      // dies after the chain transfer, the next recovery run can finish it.
      await this.rewardRepo.update(reward.id, {
        txHash,
        lockedAt: new Date(),
      });

      await this.txService.createIfAbsent({
        userId: winner.id,
        type: TxType.TRIVIA_REWARD,
        status: TxStatus.COMPLETED,
        amountUsdc: reward.amountUsdc,
        feeUsdc: '0',
        reference: reward.reference,
        txHash,
        description: `Trivia weekly winner reward — week of ${reward.weekStart}`,
      });

      await this.rewardRepo.update(reward.id, {
        status: TriviaRewardStatus.COMPLETED,
        rewardedAt: new Date(),
        lockedAt: null,
        failureReason: null,
      });

      try {
        await this.notificationsService.create({
          userId: winner.id,
          type: NotificationType.POINTS_AWARDED,
          title: 'Trivia Winner!',
          body: `Congrats! You won the weekly trivia and earned $2 USDC.`,
        });

        if (winner.email) {
          await this.emailService.sendTriviaWinner({
            to: winner.email,
            fullName: winner.fullName ?? winner.username,
            username: winner.username,
            totalScore: reward.totalScore,
            weekOf: reward.weekStart,
            amountUsdc: reward.amountUsdc,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Trivia reward delivered but notification/email failed ` +
            `[week=${reward.weekStart}]: ${(err as Error).message}`,
        );
      }

      this.logger.log(
        `Trivia reward reconciled for ${winner.username} (${winner.id}) — ` +
          `$${reward.amountUsdc} USDC [week=${reward.weekStart}] [hash=${txHash}]`,
      );
    } catch (err) {
      const reason = (err as Error).message;
      await this.rewardRepo.update(reward.id, {
        status: TriviaRewardStatus.FAILED,
        lockedAt: null,
        failureReason: reason.slice(0, 255),
      });
      this.logger.error(
        `Trivia reward reconciliation failed [week=${reward.weekStart}] ` +
          `[attempt=${reward.attempts + 1}]: ${reason}`,
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
