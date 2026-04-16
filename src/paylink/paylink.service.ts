// src/paylink/paylink.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThan, Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { RatesService } from '../rates/rates.service';
import { TransactionsService } from '../transactions/transactions.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TxStatus, TxType } from '../transactions/entities/transaction.entity';
import { NotificationType } from '../notifications/entities/notification.entity';

import {
  PaymentRequest,
  PayLinkStatus,
} from './entities/payment-request.entity';
import { CreatePayLinkDto, PayLinkPayDto } from './dto';

const PLATFORM_FEE_PCT = 0.001;
const MIN_USDC = 0.01;
const MAX_USDC = 50_000;
const DEFAULT_EXPIRY_HOURS = 168; // 7 days
const MAX_EXPIRY_HOURS = 720; // 30 days

export interface PayLinkView {
  id: string;
  token: string;
  url: string;
  amountUsdc: string;
  note: string | null;
  status: PayLinkStatus;
  expiresAt: Date;
  createdAt: Date;
  creator: { username: string; fullName: string | null };
  payer: { username: string } | null;
  paidAt: Date | null;
}

@Injectable()
export class PayLinkService {
  private readonly logger = new Logger(PayLinkService.name);

  constructor(
    @InjectRepository(PaymentRequest)
    private readonly prRepo: Repository<PaymentRequest>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    private readonly stellarService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Helpers ───────────────────────────────────────────────

  private buildUrl(
    username: string,
    amountUsdc: string,
    token: string,
  ): string {
    const base = this.config.get<string>(
      'app.payLinkBaseUrl',
      'https://cheesepay.xyz',
    );
    const display = parseFloat(amountUsdc).toFixed(2);
    return `${base}/pay/${username}/${display}/${token}`;
  }

  private toView(
    pr: PaymentRequest,
    creator: { username: string; fullName: string | null },
    payerUsername?: string | null,
  ): PayLinkView {
    return {
      id: pr.id,
      token: pr.token,
      url: this.buildUrl(creator.username, pr.amountUsdc, pr.token),
      amountUsdc: pr.amountUsdc,
      note: pr.note,
      status: pr.status,
      expiresAt: pr.expiresAt,
      createdAt: pr.createdAt,
      creator,
      payer: payerUsername ? { username: payerUsername } : null,
      paidAt: pr.paidAt,
    };
  }

  // ── POST /paylink ─────────────────────────────────────────
  async createPayLink(creatorId: string, dto: CreatePayLinkDto) {
    const amount = parseFloat(dto.amountUsdc);
    if (isNaN(amount) || amount < MIN_USDC)
      throw new BadRequestException(
        `Minimum request amount is $${MIN_USDC} USDC`,
      );
    if (amount > MAX_USDC)
      throw new BadRequestException(
        `Maximum request amount is $${MAX_USDC.toLocaleString()} USDC`,
      );

    const creator = await this.userRepo.findOne({
      where: { id: creatorId, isActive: true },
    });
    if (!creator) throw new NotFoundException('User not found');
    if (!creator.stellarPublicKey)
      throw new BadRequestException('Your wallet is not fully set up yet');

    const expiryHours = Math.min(
      dto.expiresInHours ?? DEFAULT_EXPIRY_HOURS,
      MAX_EXPIRY_HOURS,
    );
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const token = uuidv4();

    const pr = await this.prRepo.save(
      this.prRepo.create({
        creatorId,
        token,
        amountUsdc: amount.toFixed(6),
        note: dto.note?.trim() || null,
        expiresAt,
        status: PayLinkStatus.PENDING,
      }),
    );

    const url = this.buildUrl(creator.username, pr.amountUsdc, token);
    this.logger.log(
      `PayLink created: @${creator.username} $${amount.toFixed(2)} USDC — ${token}`,
    );

    return {
      id: pr.id,
      url,
      token,
      amountUsdc: pr.amountUsdc,
      note: pr.note,
      expiresAt,
      expiresInHours: expiryHours,
    };
  }

  // ── GET /paylink/:token (public) ──────────────────────────
  async resolveLink(token: string): Promise<PayLinkView> {
    const pr = await this.prRepo.findOne({
      where: { token },
      relations: ['creator', 'payer'],
    });
    if (!pr) throw new NotFoundException('Payment link not found');

    if (pr.status === PayLinkStatus.PENDING && pr.expiresAt < new Date()) {
      await this.prRepo.update(pr.id, { status: PayLinkStatus.EXPIRED });
      pr.status = PayLinkStatus.EXPIRED;
    }

    return this.toView(
      pr,
      { username: pr.creator.username, fullName: pr.creator.fullName },
      pr.payer?.username ?? null,
    );
  }

  // ── POST /paylink/:token/pay ───────────────────────────────
  async payLink(
    payerId: string,
    token: string,
    dto: PayLinkPayDto,
    payerIp?: string,
  ) {
    // 1. Load request
    const pr = await this.prRepo.findOne({
      where: { token },
      relations: ['creator'],
    });
    if (!pr) throw new NotFoundException('Payment link not found');

    if (pr.status === PayLinkStatus.CANCELLED)
      throw new GoneException('This payment request was cancelled');
    if (pr.status === PayLinkStatus.PAID)
      throw new ConflictException(
        'Payment already completed — double payment prevented',
      );
    if (pr.status === PayLinkStatus.EXPIRED || pr.expiresAt < new Date()) {
      await this.prRepo.update(pr.id, { status: PayLinkStatus.EXPIRED });
      throw new GoneException('This payment link has expired');
    }

    // 2. Load payer
    const payer = await this.userRepo.findOne({
      where: { id: payerId, isActive: true },
    });
    if (!payer?.stellarPublicKey || !payer.stellarSecretEnc)
      throw new BadRequestException('Your wallet is not ready');

    // 3. Self-payment guard
    if (pr.creatorId === payerId)
      throw new ForbiddenException('You cannot pay your own payment request');

    // 4. Device verification
    const device = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId, userId: payerId, isActive: true },
    });
    if (!device)
      throw new ForbiddenException(
        'Device not recognized. Please re-register your device.',
      );

    // 5. PIN verification — timing-safe comparison
    const expectedPin = createHmac('sha256', dto.deviceId)
      .update(payer.pinHash ?? '')
      .digest('hex');
    const received = Buffer.from(dto.pinHash, 'hex');
    const expected = Buffer.from(expectedPin, 'hex');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new ForbiddenException('Incorrect PIN');

    // 6. Calculate amounts
    const amount = parseFloat(pr.amountUsdc);
    const fee = parseFloat((amount * PLATFORM_FEE_PCT).toFixed(6));
    const totalCost = parseFloat((amount + fee).toFixed(6));

    // 7. Balance check
    const { usdc: rawBalance } = await this.stellarService.getUsdcBalance(
      payer.stellarPublicKey,
    );
    const balance = parseFloat(rawBalance);
    if (balance < totalCost) {
      throw new BadRequestException(
        `Insufficient balance. ` +
          `Need $${totalCost.toFixed(4)} USDC (includes $${fee.toFixed(4)} fee). ` +
          `Available: $${balance.toFixed(4)} USDC.`,
      );
    }

    // 8. Atomic lock + status flip — double-spend prevention
    //    SELECT FOR UPDATE ensures only ONE concurrent request can
    //    flip this row from PENDING → PAID.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const locked = await queryRunner.manager
        .createQueryBuilder(PaymentRequest, 'pr')
        .setLock('pessimistic_write')
        .where('pr.id = :id', { id: pr.id })
        .getOne();

      if (!locked) throw new NotFoundException('Request disappeared');
      if (locked.status !== PayLinkStatus.PENDING) {
        throw new ConflictException(
          locked.status === PayLinkStatus.PAID
            ? 'Payment was just completed by another request'
            : `Request is no longer payable (${locked.status})`,
        );
      }
      if (locked.expiresAt < new Date()) {
        await queryRunner.manager.update(PaymentRequest, pr.id, {
          status: PayLinkStatus.EXPIRED,
        });
        throw new GoneException('Link expired while processing');
      }

      // GATE: flip to PAID before Stellar. This is the atomic lock.
      await queryRunner.manager.update(PaymentRequest, pr.id, {
        status: PayLinkStatus.PAID,
        payerId,
        payerIp: payerIp ?? null,
        paidAt: new Date(),
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // 9. Execute Stellar transfer (DB already gated — revert on failure)
    let txHash: string | null = null;
    if (!pr.creator.stellarPublicKey)
      throw new InternalServerErrorException('Creator wallet not configured');
    try {
      txHash = await this.stellarService.sendUsdc({
        fromSecretEnc: payer.stellarSecretEnc,
        toAddress: pr.creator.stellarPublicKey,
        amountUsdc: amount.toFixed(7),
        memo: `cheesepay:${pr.token.slice(0, 8)}`,
      });
    } catch (err) {
      this.logger.error(
        `PayLink Stellar send failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Revert DB gate so payer can retry
      await this.prRepo.update(pr.id, {
        status: PayLinkStatus.PENDING,
        payerId: null,
        paidAt: null,
        payerIp: null,
      });
      throw new BadRequestException(
        'Network transfer failed. No funds were moved. Please try again.',
      );
    }

    // 10. Record transaction
    const rate = await this.ratesService.getCurrentRate();
    const ngnEq = (amount * parseFloat(rate.effectiveRate)).toFixed(2);
    const ref = `CW-PAY-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    const tx = await this.txService.create({
      userId: payerId,
      type: TxType.PAY_REQUEST,
      status: TxStatus.COMPLETED,
      amountUsdc: amount.toFixed(6),
      amountNgn: ngnEq,
      feeUsdc: fee.toFixed(6),
      rateApplied: rate.effectiveRate,
      recipientUsername: pr.creator.username,
      recipientAddress: pr.creator.stellarPublicKey,
      txHash,
      reference: ref,
      description: pr.note
        ? `PayLink: "${pr.note}"`
        : `PayLink → @${pr.creator.username}`,
    });

    // 11. Persist on-chain receipt
    await this.prRepo.update(pr.id, {
      settledTxId: tx.id,
      settledTxHash: txHash,
    });

    const paidAt = new Date();
    const frontendUrl = this.config.get<string>(
      'app.frontendUrl',
      'https://cheesepay.xyz',
    );

    // 12. Notify creator (push + email) — fire-and-forget
    this.notificationsService
      .create({
        userId: pr.creatorId,
        type: NotificationType.MONEY,
        title: `💰 $${amount.toFixed(2)} USDC received from @${payer.username}`,
        body: pr.note
          ? `Payment for "${pr.note}" has arrived in your wallet.`
          : `Your PayLink request was fulfilled.`,
        deepLink: '/wallet',
      })
      .catch(() => {});

    this.emailService
      .sendMoneyReceived({
        to: pr.creator.email,
        fullName: pr.creator.fullName,
        amountUsdc: amount.toFixed(2),
        appUrl: `${frontendUrl}/wallet`,
      })
      .catch(() => {});

    // 13. Notify payer (sent confirmation)
    this.emailService
      .sendMoneySent({
        to: payer.email,
        fullName: payer.fullName,
        amountUsdc: amount.toFixed(2),
        recipientUsername: pr.creator.username,
        reference: ref,
        fee: fee.toFixed(4),
        appUrl: `${frontendUrl}/wallet/history`,
      })
      .catch(() => {});

    this.logger.log(
      `PayLink settled: @${payer.username} → @${pr.creator.username} $${amount} | hash:${txHash}`,
    );

    return {
      txId: tx.id,
      txHash,
      amountUsdc: amount.toFixed(6),
      fee: fee.toFixed(6),
      paidAt,
    };
  }

  // ── GET /paylink/my ───────────────────────────────────────
  async myLinks(creatorId: string, page = 1, pageSize = 20) {
    const creator = await this.userRepo.findOne({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('User not found');

    const [rows, total] = await this.prRepo.findAndCount({
      where: { creatorId },
      relations: ['payer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Eagerly expire stale rows in the result set
    const now = new Date();
    const stale = rows.filter(
      (r) => r.status === PayLinkStatus.PENDING && r.expiresAt < now,
    );
    if (stale.length) {
      await this.prRepo.update(
        stale.map((r) => r.id),
        { status: PayLinkStatus.EXPIRED },
      );
      stale.forEach((r) => {
        r.status = PayLinkStatus.EXPIRED;
      });
    }

    return {
      data: rows.map((r) =>
        this.toView(
          r,
          { username: creator.username, fullName: creator.fullName },
          r.payer?.username ?? null,
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  // ── DELETE /paylink/:token ────────────────────────────────
  async cancelLink(creatorId: string, token: string) {
    const pr = await this.prRepo.findOne({ where: { token } });
    if (!pr) throw new NotFoundException('Payment link not found');
    if (pr.creatorId !== creatorId)
      throw new ForbiddenException(
        'You can only cancel your own payment requests',
      );
    if (pr.status === PayLinkStatus.PAID)
      throw new ConflictException(
        'Cannot cancel a link that has already been paid',
      );
    if (pr.status === PayLinkStatus.CANCELLED)
      throw new ConflictException('Already cancelled');

    await this.prRepo.update(pr.id, { status: PayLinkStatus.CANCELLED });
    this.logger.log(`PayLink cancelled: ${token}`);
    return { message: 'Payment request cancelled successfully' };
  }

  // ── CRON: hourly expiry sweep ─────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleLinks(): Promise<void> {
    const result = await this.prRepo.update(
      { status: PayLinkStatus.PENDING, expiresAt: LessThan(new Date()) },
      { status: PayLinkStatus.EXPIRED },
    );
    if ((result.affected ?? 0) > 0)
      this.logger.log(
        `Cron: expired ${result.affected} stale payment request(s)`,
      );
  }
}
