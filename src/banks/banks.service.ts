// src/banks/banks.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { RatesService } from '../rates/rates.service';
import { TransactionsService } from '../transactions/transactions.service';
import { TxStatus, TxType } from '../transactions/entities/transaction.entity';
import {
  BankTransfer,
  BankTransferStatus,
} from './entities/bank-transfer.entity';
import { BankTransferDto, BankWebhookDto, ResolveAccountDto } from './dto';
import { PulseMfbClient } from './pulsemfb.client';
import { KycStatus } from '../auth/entities/user.entity';
import { DAILY_NGN_LIMIT, formatNgnLimit } from '../kyc/tier.limits';
import { TierMilestoneService } from '../kyc/tier-milestone.service';

type BankDirectoryEntry = {
  code: string;
  name: string;
  shortName: string;
  color: string;
  nipEnabled: boolean;
  type: 'commercial' | 'microfinance' | 'fintech' | 'merchant';
};

// ── Nigerian banks (NIP-enabled) ─────────────────────────────────────────────
const NIGERIAN_BANKS: BankDirectoryEntry[] = [
  {
    code: '044',
    name: 'Access Bank',
    shortName: 'Access',
    color: '#E30813',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '063',
    name: 'Access Bank (Diamond)',
    shortName: 'Diamond',
    color: '#004C97',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '035A',
    name: 'ALAT by WEMA',
    shortName: 'ALAT',
    color: '#5A2D82',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '401',
    name: 'ASO Savings',
    shortName: 'ASO',
    color: '#006400',
    nipEnabled: false,
    type: 'microfinance',
  },
  {
    code: '023',
    name: 'Citibank Nigeria',
    shortName: 'Citibank',
    color: '#003B70',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '050',
    name: 'EcoBank Nigeria',
    shortName: 'EcoBank',
    color: '#008000',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '562',
    name: 'Ekondo Microfinance',
    shortName: 'Ekondo',
    color: '#FF6600',
    nipEnabled: false,
    type: 'microfinance',
  },
  {
    code: '070',
    name: 'Fidelity Bank',
    shortName: 'Fidelity',
    color: '#00703C',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '011',
    name: 'First Bank of Nigeria',
    shortName: 'First Bank',
    color: '#01579B',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '214',
    name: 'First City Monument Bank',
    shortName: 'FCMB',
    color: '#00008B',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '058',
    name: 'Guaranty Trust Bank',
    shortName: 'GTBank',
    color: '#F36F21',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '030',
    name: 'Heritage Bank',
    shortName: 'Heritage',
    color: '#8B0000',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '301',
    name: 'Jaiz Bank',
    shortName: 'Jaiz',
    color: '#006400',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '082',
    name: 'Keystone Bank',
    shortName: 'Keystone',
    color: '#1E3A5F',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '526',
    name: 'Parallex Bank',
    shortName: 'Parallex',
    color: '#00A651',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '076',
    name: 'Polaris Bank',
    shortName: 'Polaris',
    color: '#D32F2F',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '090713',
    name: 'Pulse Microfinance Bank',
    shortName: 'Pulse MFB',
    color: '#0F7B52',
    nipEnabled: true,
    type: 'microfinance',
  },
  {
    code: '101',
    name: 'Providus Bank',
    shortName: 'Providus',
    color: '#004080',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '221',
    name: 'Stanbic IBTC Bank',
    shortName: 'Stanbic',
    color: '#009EE0',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '068',
    name: 'Standard Chartered',
    shortName: 'StanChart',
    color: '#0072AA',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '232',
    name: 'Sterling Bank',
    shortName: 'Sterling',
    color: '#CC0000',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '100',
    name: 'Suntrust Bank',
    shortName: 'Suntrust',
    color: '#FF8C00',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '302',
    name: 'TAJ Bank',
    shortName: 'TAJ',
    color: '#006400',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '102',
    name: 'Titan Trust Bank',
    shortName: 'Titan',
    color: '#1B3A6B',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '032',
    name: 'Union Bank of Nigeria',
    shortName: 'Union',
    color: '#003366',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '033',
    name: 'United Bank for Africa',
    shortName: 'UBA',
    color: '#D0021B',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '215',
    name: 'Unity Bank',
    shortName: 'Unity',
    color: '#006400',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '035',
    name: 'Wema Bank',
    shortName: 'Wema',
    color: '#5A2D82',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '057',
    name: 'Zenith Bank',
    shortName: 'Zenith',
    color: '#C8102E',
    nipEnabled: true,
    type: 'commercial',
  },
  {
    code: '120001',
    name: 'Opay',
    shortName: 'Opay',
    color: '#008751',
    nipEnabled: true,
    type: 'fintech',
  },
  {
    code: '120002',
    name: 'PalmPay',
    shortName: 'PalmPay',
    color: '#00A859',
    nipEnabled: true,
    type: 'fintech',
  },
  {
    code: '120003',
    name: 'Moniepoint',
    shortName: 'Moniepoint',
    color: '#004B87',
    nipEnabled: true,
    type: 'fintech',
  },
  {
    code: '120004',
    name: 'Kuda Bank',
    shortName: 'Kuda',
    color: '#40196D',
    nipEnabled: true,
    type: 'fintech',
  },
];

const TRANSFER_FEE_NGN = 50; // flat ₦50 per withdrawal
const MIN_TRANSFER_NGN = 100;
const MAX_TRANSFER_NGN = 10_000_000; // Black tier ceiling — daily limit enforced per-tier above

function normalizeAccountName(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function extractProviderFailureReason(
  data: Record<string, unknown>,
): string | undefined {
  const candidateKeys = [
    'failure_reason',
    'failureReason',
    'responseMessage',
    'message',
    'reason',
  ] as const;

  for (const key of candidateKeys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function canonicalizeSignaturePayload(
  payload: Record<string, string>,
): string {
  const sortedPayload = Object.keys(payload)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});

  return JSON.stringify(sortedPayload);
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BanksService {
  private readonly logger = new Logger(BanksService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(BankTransfer)
    private readonly transferRepo: Repository<BankTransfer>,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
    private readonly pulseMfb: PulseMfbClient,
    private readonly tierMilestone: TierMilestoneService,
  ) {}

  // ── GET /banks ────────────────────────────────────────────────────────────
  getBanks() {
    return NIGERIAN_BANKS;
  }

  // ── POST /banks/resolve ───────────────────────────────────────────────────
  async resolveAccount(
    dto: ResolveAccountDto,
  ): Promise<{
    accountName: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
  }> {
    const result = await this.pulseMfb.nameEnquiry(
      dto.accountNumber,
      dto.bankCode,
    );

    if (result.responseCode !== '00') {
      throw new BadRequestException(
        result.responseMessage || 'Account could not be resolved',
      );
    }

    return {
      accountName: result.accountName,
      accountNumber: result.accountNumber,
      bankCode: dto.bankCode,
      bankName: this.findBankByCode(dto.bankCode)?.name ?? dto.bankCode,
    };
  }

  // ── POST /banks/transfer ──────────────────────────────────────────────────
  async bankTransfer(userId: string, dto: BankTransferDto) {
    // 1. Load user
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stellarPublicKey || !user.stellarSecretEnc) {
      throw new BadRequestException('Wallet not initialised');
    }

    // 2. KYC gate
    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException(
        'Identity verification required before withdrawing. Please complete KYC in your profile.',
      );
    }

    // 3. Daily NGN withdrawal limit
    const amountNgn = parseFloat(dto.amountNgn);
    const dailyLimit = DAILY_NGN_LIMIT[user.tier];
    const dailySpent = await this.txService.getDailyOutboundNgn(userId);
    if (dailySpent + amountNgn > dailyLimit) {
      const remaining = Math.max(0, dailyLimit - dailySpent);
      throw new ForbiddenException(
        `Daily NGN withdrawal limit reached. Your ${user.tier} tier allows ${formatNgnLimit(user.tier)}/day. ` +
          `Remaining today: ₦${remaining.toLocaleString()}.`,
      );
    }

    // 4. Verify PIN
    if (!user.pinHash) throw new BadRequestException('PIN not set');
    const storedPinHash = Buffer.from(user.pinHash);
    const providedPinHash = Buffer.from(dto.pinHash);
    const pinOk =
      storedPinHash.length === providedPinHash.length &&
      timingSafeEqual(storedPinHash, providedPinHash);
    if (!pinOk) throw new ForbiddenException('Incorrect PIN');

    // 3. Verify device & device signature
    const device = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId, userId, isActive: true },
    });
    if (!device) throw new ForbiddenException('Device not recognised');
    const deviceSignatureMessage = this.buildBankTransferSignatureMessage(
      userId,
      dto,
    );
    const sigValid = this.blockchainService.verifyDeviceSignature({
      publicKey: device.publicKey,
      signature: dto.deviceSignature,
      message: deviceSignatureMessage,
    });
    if (!sigValid && this.config.get('app.nodeEnv') === 'production') {
      throw new ForbiddenException('Invalid device signature');
    }

    // 7. Validate NGN amount
    if (isNaN(amountNgn) || amountNgn < MIN_TRANSFER_NGN) {
      throw new BadRequestException(
        `Minimum transfer is ₦${MIN_TRANSFER_NGN.toLocaleString()}`,
      );
    }
    if (amountNgn > MAX_TRANSFER_NGN) {
      throw new BadRequestException(
        `Maximum transfer is ₦${MAX_TRANSFER_NGN.toLocaleString()}`,
      );
    }

    // 5. Calculate USDC to deduct (NGN amount + flat fee, converted at current rate)
    const rate = await this.ratesService.getCurrentRate();
    const effectiveRate = parseFloat(rate.effectiveRate);
    const amountUsdc = ((amountNgn + TRANSFER_FEE_NGN) / effectiveRate).toFixed(
      6,
    );
    const feeUsdc = (TRANSFER_FEE_NGN / effectiveRate).toFixed(6);

    // 6. Check USDC balance
    const { usdc: usdcBalance } =
      await this.blockchainService.getStellarBalance(user.stellarPublicKey);
    if (parseFloat(usdcBalance) < parseFloat(amountUsdc)) {
      throw new BadRequestException('Insufficient USDC balance');
    }

    // 7. Resolve bank + confirm beneficiary name
    const bank = this.findBankByCode(dto.bankCode);
    const bankName = bank?.name ?? dto.bankCode;
    const resolvedAccount = await this.resolveAccount({
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
    });
    if (
      normalizeAccountName(resolvedAccount.accountName) !==
      normalizeAccountName(dto.accountName)
    ) {
      throw new BadRequestException(
        `Account name mismatch. Resolved name is "${resolvedAccount.accountName}".`,
      );
    }

    // 8. Create PENDING records — both start as PENDING before any money moves
    const reference = `CW-NGN-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

    const transfer = await this.transferRepo.save(
      this.transferRepo.create({
        userId,
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName,
        accountName: resolvedAccount.accountName,
        amountNgn: dto.amountNgn,
        amountUsdc,
        feeUsdc,
        rateApplied: rate.effectiveRate,
        reference,
        status: BankTransferStatus.PENDING,
      }),
    );

    const tx = await this.txService.create({
      userId,
      type: TxType.BANK_TRANSFER,
      status: TxStatus.PENDING,
      amountUsdc,
      amountNgn: dto.amountNgn,
      feeUsdc,
      rateApplied: rate.effectiveRate,
      recipientName: resolvedAccount.accountName,
      accountNumber: dto.accountNumber,
      bankName,
      reference,
      description: `Withdrawal to ${resolvedAccount.accountName} — ${bankName}`,
    });

    // 9. Deduct USDC — send to the platform wallet which funds the NGN payout.
    //    platformWithdrawUsdc reads the platform keypair from config and handles the transfer.
    //    If this fails the user's balance is untouched, so we just mark failed and stop.
    let stellarTxHash: string;
    try {
      stellarTxHash = await this.blockchainService.platformWithdrawUsdc(
        user.stellarSecretEnc,
        amountUsdc,
        reference,
      );
      await this.txService.update(tx.id, { txHash: stellarTxHash });
    } catch (err) {
      // USDC never left the user — safe to mark failed with no refund
      await this.transferRepo.update(
        { id: transfer.id },
        {
          status: BankTransferStatus.FAILED,
          failureReason: (err as Error).message,
        },
      );
      await this.txService.update(tx.id, {
        status: TxStatus.FAILED,
        failureReason: (err as Error).message,
      });
      throw new BadRequestException(
        `USDC debit failed: ${(err as Error).message}`,
      );
    }

    // 10. Call the banking provider to initiate the NGN payout
    //     USDC has already moved at this point.
    //     If the provider call fails we MUST refund the USDC immediately.
    try {
      const providerRef = await this.initiateBankingTransfer({
        debitAccount: this.pulseMfb.platformDebitAccount,
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        accountName: resolvedAccount.accountName,
        amountNgn,
        reference,
      });

      // Mark PROCESSING — awaiting final settlement confirmation via webhook
      await this.transferRepo.update(
        { id: transfer.id },
        {
          status: BankTransferStatus.PROCESSING,
          providerReference: providerRef,
        },
      );
      // Transaction stays PENDING until the webhook fires transfer.success
    } catch (err) {
      this.logger.error(
        `Banking provider failed for ${reference} — refunding USDC: ${(err as Error).message}`,
      );

      // USDC is already on the platform wallet; send it back to the user
      await this.refundUsdc({
        userId,
        toPublicKey: user.stellarPublicKey,
        amountUsdc,
        reference,
        reason: (err as Error).message,
      });

      await this.transferRepo.update(
        { id: transfer.id },
        {
          status: BankTransferStatus.FAILED,
          failureReason: (err as Error).message,
        },
      );
      await this.txService.update(tx.id, {
        status: TxStatus.FAILED,
        failureReason: `Banking provider failed — USDC refunded. ${(err as Error).message}`,
      });

      throw new BadRequestException(
        `Bank transfer failed: ${(err as Error).message}`,
      );
    }

    // Fire-and-forget milestone check
    void this.tierMilestone.checkAndNotify(userId);

    return {
      reference,
      status: 'processing',
      message:
        'USDC deducted. NGN payout is being processed. You will receive a confirmation once the transfer settles.',
      amountNgn: dto.amountNgn,
      amountUsdc,
      rateApplied: rate.effectiveRate,
      fee: String(TRANSFER_FEE_NGN),
      recipientName: resolvedAccount.accountName,
      bankName,
      stellarTxHash,
      createdAt: transfer.createdAt,
    };
  }

  // ── POST /banks/webhook ───────────────────────────────────────────────────
  async processWebhook(dto: BankWebhookDto) {
    const transfer = await this.transferRepo.findOne({
      where: { reference: dto.reference },
    });
    if (!transfer) {
      throw new NotFoundException(
        `No transfer found with reference: ${dto.reference}`,
      );
    }

    // Idempotency — if already in a terminal state, return current status
    const terminalStatuses = [
      BankTransferStatus.COMPLETED,
      BankTransferStatus.FAILED,
      BankTransferStatus.REVERSED,
    ];
    if (terminalStatuses.includes(transfer.status)) {
      this.logger.warn(
        `Webhook received for already-settled transfer [ref=${dto.reference}] [status=${transfer.status}]`,
      );
      return {
        alreadyProcessed: true,
        reference: dto.reference,
        status: transfer.status,
      };
    }

    switch (dto.event) {
      // ── NGN landed in recipient account ──────────────────────────────────
      case 'transfer.success': {
        await this.transferRepo.update(
          { id: transfer.id },
          { status: BankTransferStatus.COMPLETED },
        );
        await this.txService.updateByReference(dto.reference, {
          status: TxStatus.COMPLETED,
        });
        this.logger.log(`Bank transfer settled [ref=${dto.reference}]`);
        return {
          processed: true,
          reference: dto.reference,
          status: 'completed',
        };
      }

      // ── NGN payout failed or was reversed — refund USDC to user ─────────
      case 'transfer.failed':
      case 'transfer.reversed': {
        const newStatus =
          dto.event === 'transfer.reversed'
            ? BankTransferStatus.REVERSED
            : BankTransferStatus.FAILED;

        const user = await this.userRepo.findOne({
          where: { id: transfer.userId },
        });
        if (user?.stellarPublicKey) {
          await this.refundUsdc({
            userId: transfer.userId,
            toPublicKey: user.stellarPublicKey,
            amountUsdc: transfer.amountUsdc,
            reference: dto.reference,
            reason: dto.failureReason ?? dto.event,
          });
        } else {
          this.logger.error(
            `Cannot refund — user ${transfer.userId} has no Stellar wallet [ref=${dto.reference}]`,
          );
        }

        await this.transferRepo.update(
          { id: transfer.id },
          {
            status: newStatus,
            failureReason: dto.failureReason ?? dto.event,
          },
        );
        await this.txService.updateByReference(dto.reference, {
          status:
            newStatus === BankTransferStatus.REVERSED
              ? TxStatus.REVERSED
              : TxStatus.FAILED,
          failureReason: dto.failureReason ?? dto.event,
        });

        this.logger.log(
          `Bank transfer ${dto.event} [ref=${dto.reference}] — USDC refund initiated`,
        );
        return {
          processed: true,
          reference: dto.reference,
          status: newStatus,
          refunded: !!user?.stellarPublicKey,
        };
      }
    }
  }

  // ── POST /banks/webhook/pulsemfb ─────────────────────────────────────────
  // Receives transfer.completed / transfer.failed events from PulseMFB.
  // The controller verifies the HMAC signature before calling this method.
  async processPulseMfbWebhook(event: string, data: Record<string, any>) {
    // We only act on transfer events — ignore account.created, vas.*, etc.
    if (!event.startsWith('transfer.')) {
      this.logger.log(
        `PulseMFB webhook [event=${event}] — ignored (non-transfer)`,
      );
      return { processed: false, event };
    }

    const reference: string = (data as Record<string, unknown>)[
      'reference'
    ] as string;
    if (!reference) {
      this.logger.warn(`PulseMFB webhook missing reference [event=${event}]`);
      return { processed: false, reason: 'missing reference' };
    }

    let internalEvent: 'transfer.success' | 'transfer.failed';
    if (event === 'transfer.completed') {
      internalEvent = 'transfer.success';
    } else if (event === 'transfer.failed') {
      internalEvent = 'transfer.failed';
    } else {
      this.logger.log(
        `PulseMFB webhook [event=${event}] [ref=${reference}] — ignored (unsupported transfer event)`,
      );
      return { processed: false, event };
    }

    this.logger.log(
      `PulseMFB webhook [event=${event}] [ref=${reference}] → processing as ${internalEvent}`,
    );

    // Reuse the existing processWebhook logic
    return this.processWebhook({
      reference,
      event: internalEvent,
      failureReason: extractProviderFailureReason(data) ?? event,
    });
  }

  // ── PulseMFB transfer ─────────────────────────────────────────────────────
  private async initiateBankingTransfer(params: {
    debitAccount: string;
    accountNumber: string;
    bankCode: string;
    accountName: string;
    amountNgn: number;
    reference: string;
  }): Promise<string> {
    const result = await this.pulseMfb.initiateTransfer({
      debitAccount: params.debitAccount,
      beneficiaryAccountNumber: params.accountNumber,
      beneficiaryBankCode: params.bankCode,
      beneficiaryName: params.accountName,
      amount: params.amountNgn,
      narration: `Cheese Pay withdrawal [${params.reference}]`,
      reference: params.reference,
    });

    this.logger.log(
      `PulseMFB transfer initiated [ref=${params.reference}] ` +
        `[internal=${result.internal_reference}] [status=${result.status}]`,
    );

    // Return the provider's internal reference for tracking
    return result.internal_reference;
  }

  // ── USDC refund helper ────────────────────────────────────────────────────
  //
  // Sends USDC back from the platform wallet to the user's Stellar address.
  // Called when the banking provider fails AFTER the USDC has already been
  // moved to the platform wallet.  Errors are logged but never re-thrown —
  // a failed refund must be flagged for manual ops resolution.
  //
  private async refundUsdc(opts: {
    userId: string;
    toPublicKey: string;
    amountUsdc: string;
    reference: string;
    reason: string;
  }): Promise<void> {
    try {
      const refundHash = await this.blockchainService.platformDepositUsdc(
        opts.toPublicKey,
        opts.amountUsdc,
      );
      this.logger.log(
        `USDC refunded [user=${opts.userId}] [amount=${opts.amountUsdc}] ` +
          `[hash=${refundHash}] [ref=${opts.reference}] [reason=${opts.reason}]`,
      );
    } catch (err) {
      // CRITICAL — needs manual intervention by ops team
      this.logger.error(
        `[CRITICAL] USDC refund FAILED — MANUAL ACTION REQUIRED ` +
          `[user=${opts.userId}] [amount=${opts.amountUsdc}] [ref=${opts.reference}]: ` +
          (err as Error).message,
      );
    }
  }

  private buildBankTransferSignatureMessage(
    userId: string,
    dto: BankTransferDto,
  ): string {
    const hasTimestamp = !!dto.timestamp;
    const hasNonce = !!dto.nonce;

    if (hasTimestamp !== hasNonce) {
      throw new BadRequestException(
        'device signature timestamp and nonce must be provided together',
      );
    }

    if (!hasTimestamp || !hasNonce) {
      return dto.deviceId;
    }

    return canonicalizeSignaturePayload({
      action: 'bank_transfer',
      amount: dto.amountNgn,
      nonce: dto.nonce!,
      recipient: `${dto.bankCode}:${dto.accountNumber}`,
      timestamp: dto.timestamp!,
      userId,
    });
  }

  private findBankByCode(bankCode: string): BankDirectoryEntry | undefined {
    return NIGERIAN_BANKS.find((bank) => bank.code === bankCode);
  }
}
