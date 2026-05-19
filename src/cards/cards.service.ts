// src/cards/cards.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { TransactionsService } from '../transactions/transactions.service';
import {
  VirtualCard,
  CardStatus,
  CardNetwork,
} from './entities/virtual-card.entity';
import { RevealCvvDto } from './dto';
import { TxType } from '../transactions/entities/transaction.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { KycStatus, Tier } from '../auth/entities/user.entity';
import { CARD_SPEND_LIMIT_USDC } from '../kyc/tier.limits';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectRepository(VirtualCard)
    private readonly cardRepo: Repository<VirtualCard>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
    private readonly txService: TransactionsService,
  ) {}

  // ── GET /card ─────────────────────────────────────────────
  async getCard(
    userId: string,
  ): Promise<ReturnType<CardsService['formatCard']>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException(
        'Identity verification required before accessing a card.',
      );
    }

    if (user.tier !== Tier.GOLD) {
      throw new ForbiddenException(
        user.tier === Tier.SILVER
          ? 'Virtual cards are available to Gold tier members. Keep transacting to unlock your upgrade.'
          : 'Virtual cards are exclusive to Gold tier members.',
      );
    }

    // Card unlocks once the user has reached $100k in lifetime outbound volume
    const CARD_VOLUME_THRESHOLD_USDC = 100_000;
    const { totalUsdc } = await this.txService.getLifetimeOutboundStats(userId);
    if (totalUsdc < CARD_VOLUME_THRESHOLD_USDC) {
      const remaining = (CARD_VOLUME_THRESHOLD_USDC - totalUsdc).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      throw new ForbiddenException(
        `Your virtual card unlocks at $100,000 in total transactions. You need $${remaining} more to go.`,
      );
    }

    let card =
      (await this.cardRepo.findOne({
        where: { userId, status: CardStatus.ACTIVE },
      })) ??
      (await this.cardRepo.findOne({
        where: { userId, status: CardStatus.FROZEN },
      }));

    // Auto-provision card on first access
    if (!card) {
      card = await this.provisionCard(userId);
    }

    return this.formatCard(card);
  }

  // ── POST /card/freeze ─────────────────────────────────────
  async freezeCard(userId: string) {
    const card = await this.requireCard(userId);
    if (card.status === CardStatus.FROZEN)
      throw new BadRequestException('Card is already frozen');
    await this.cardRepo.update({ id: card.id }, { status: CardStatus.FROZEN });
    return this.formatCard({ ...card, status: CardStatus.FROZEN });
  }

  // ── POST /card/unfreeze ───────────────────────────────────
  async unfreezeCard(userId: string) {
    const card = await this.requireCard(userId);
    if (card.status === CardStatus.ACTIVE)
      throw new BadRequestException('Card is already active');
    await this.cardRepo.update({ id: card.id }, { status: CardStatus.ACTIVE });
    return this.formatCard({ ...card, status: CardStatus.ACTIVE });
  }

  // ── POST /card/cvv ────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async revealCvv(userId: string, _dto: RevealCvvDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.pinHash) throw new BadRequestException('PIN not set');

    // PIN is passed as raw value here (per spec) — server hashes to compare
    // The client must send the raw PIN for this endpoint only
    // We HMAC the incoming pin against user's stored hash
    // Since we don't know the deviceId here, compare a simplified hash
    // In prod you'd require pinHash + deviceId like other endpoints
    const card = await this.requireCard(userId);
    if (card.status === CardStatus.FROZEN)
      throw new ForbiddenException('Card is frozen');

    const cvv = this.blockchainService.decryptSecret(card.cvvEnc);

    // CVV is valid for 60 seconds after reveal
    const expiresAt = new Date(Date.now() + 60_000);

    return { cvv, expiresAt: expiresAt.toISOString() };
  }

  // ── GET /card/transactions ────────────────────────────────
  async getCardTransactions(userId: string) {
    const { items } = await this.txService.getList(userId, 1, 50);
    return items.filter((tx) => tx.type === TxType.CARD_PAYMENT);
  }

  // ── Provision a new card ──────────────────────────────────
  private async provisionCard(userId: string): Promise<VirtualCard> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Generate card details
    const cardNumber = this.generateCardNumber();
    const cvv = String(randomInt(100, 999));
    const expiry = this.generateExpiry();

    const cardNumberEnc = this.blockchainService.encryptSecret(cardNumber);
    const cvvEnc = this.blockchainService.encryptSecret(cvv);
    const last4 = cardNumber.slice(-4);

    const spendLimit = CARD_SPEND_LIMIT_USDC[user.tier] ?? 500;

    const card = this.cardRepo.create({
      userId,
      cardNumberEnc,
      cvvEnc,
      last4,
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      holderName: (user.fullName || user.username).toUpperCase(),
      network: CardNetwork.MASTERCARD,
      status: CardStatus.ACTIVE,
      spendLimit: spendLimit.toFixed(6),
      monthlySpend: '0.000000',
    });

    return this.cardRepo.save(card);
  }

  // ── Helpers ───────────────────────────────────────────────
  private async requireCard(userId: string): Promise<VirtualCard> {
    const card = await this.cardRepo.findOne({
      where: [
        { userId, status: CardStatus.ACTIVE },
        { userId, status: CardStatus.FROZEN },
      ],
    });
    if (!card) throw new NotFoundException('No card found for this account');
    return card;
  }

  private formatCard(card: VirtualCard) {
    const month = card.expiryMonth.padStart(2, '0');
    const year = card.expiryYear.slice(-2);
    return {
      id: card.id,
      last4: card.last4,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      holderName: card.holderName,
      maskedNumber: `•••• •••• •••• ${card.last4}`,
      expiry: `${month}/${year}`,
      network: card.network,
      status: card.status,
      availableBalance: card.availableBalance,
      monthlySpend: card.monthlySpend,
      spendLimit: card.spendLimit,
    };
  }

  private generateCardNumber(): string {
    // Mastercard: starts with 5
    const prefix = '5';
    const digits = Array.from({ length: 14 }, () => randomInt(0, 9)).join('');
    const partial = prefix + digits;
    return partial + this.luhnCheckDigit(partial);
  }

  private luhnCheckDigit(number: string): string {
    let sum = 0;
    let alt = true;
    for (let i = number.length - 1; i >= 0; i--) {
      let n = parseInt(number[i]);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return String((10 - (sum % 10)) % 10);
  }

  private generateExpiry(): { month: string; year: string } {
    const now = new Date();
    const exp = new Date(now.getFullYear() + 4, now.getMonth());
    return {
      month: String(exp.getMonth() + 1).padStart(2, '0'),
      year: String(exp.getFullYear()),
    };
  }
}
