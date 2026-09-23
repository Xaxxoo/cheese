// src/yield/yield.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, Tier } from '../auth/entities/user.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletService } from '../wallet/wallet.service';
import { TxType } from '../transactions/entities/transaction.entity';

export interface YieldStatus {
  enrolled: boolean;
  enrolledAt: Date | null;
  tier: Tier;
  apyRate: string;
  totalEarned: string;
  lastDistributionAt: Date | null;
  balanceUsdc: string;
  minBalanceUsdc: number;
}

@Injectable()
export class YieldService {
  private readonly logger = new Logger(YieldService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly txService: TransactionsService,
    private readonly walletService: WalletService,
    private readonly config: ConfigService,
  ) {}

  getApyForTier(tier: Tier): number {
    switch (tier) {
      case Tier.GOLD:
        return this.config.get<number>('yield.apyGold', 0.055);
      case Tier.BLACK:
        return this.config.get<number>('yield.apyBlack', 0.06);
      default:
        return this.config.get<number>('yield.apySilver', 0.05);
    }
  }

  async enroll(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.yieldEnrolled) {
      throw new BadRequestException('Already enrolled in yield');
    }

    const minBalance = this.config.get<number>('yield.minBalanceUsdc', 1);
    const balance = await this.walletService.getBalance(userId);
    if (parseFloat(balance.totalUsdc) < minBalance) {
      throw new BadRequestException(
        `Minimum balance of $${minBalance} USDC required to enroll`,
      );
    }

    await this.userRepo.update(
      { id: userId },
      { yieldEnrolled: true, yieldEnrolledAt: new Date() },
    );

    this.logger.log(`User enrolled in yield [userId=${userId}]`);
  }

  async unenroll(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.yieldEnrolled) {
      throw new BadRequestException('Not currently enrolled in yield');
    }

    await this.userRepo.update({ id: userId }, { yieldEnrolled: false });

    this.logger.log(`User unenrolled from yield [userId=${userId}]`);
  }

  async getStatus(userId: string): Promise<YieldStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const apy = this.getApyForTier(user.tier);
    const balance = await this.walletService.getBalance(userId);

    return {
      enrolled: user.yieldEnrolled,
      enrolledAt: user.yieldEnrolledAt,
      tier: user.tier,
      apyRate: (apy * 100).toFixed(1),
      totalEarned: parseFloat(user.totalYieldEarned).toFixed(6),
      lastDistributionAt: user.lastYieldAt,
      balanceUsdc: balance.totalUsdc,
      minBalanceUsdc: this.config.get<number>('yield.minBalanceUsdc', 1),
    };
  }

  async getHistory(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.txService.getList(userId, 1, 100).then((result) => ({
      ...result,
      items: result.items.filter(
        (tx: { type: string }) => tx.type === TxType.YIELD_CREDIT,
      ),
    }));
  }
}
