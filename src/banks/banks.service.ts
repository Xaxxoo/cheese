// src/banks/banks.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
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
import { BankDeposit, BankDepositStatus } from './entities/bank-deposit.entity';
import { BankTransferDto, BankWebhookDto, ResolveAccountDto } from './dto';
import { PulseMfbClient } from './pulsemfb.client';
import { KycStatus } from '../auth/entities/user.entity';
import { DAILY_NGN_LIMIT, formatNgnLimit } from '../kyc/tier.limits';
import { TierMilestoneService } from '../kyc/tier-milestone.service';
import { isInsecureDeviceSignatureBypassEnabled } from '../common/utils/device-signature.util';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertsService } from '../alerts/alerts.service';
import { ReferralService } from '../referral/referral.service';

type BankDirectoryEntry = {
  code: string;
  name: string;
  shortName: string;
  color: string;
  nipEnabled: boolean;
  type: 'commercial' | 'microfinance' | 'fintech' | 'merchant';
};

// ── Nigerian banks ────────────────────────────────────────────────────────────
// Commercial banks use 6-digit CBN sort codes (000xxx) as required by PulseMFB.
// Fintechs and MFBs retain their standard NIBSS codes (090xxx / 100xxx).
// Heritage Bank (000020) and Diamond Bank (000005) removed — both defunct.
//
// Some banks (notably Access Bank) are reachable via multiple bank codes on PulseMFB.
// When the primary code fails name enquiry we try the alternates in order.
const BANK_CODE_FALLBACKS: Record<string, string[]> = {
  '000014': ['044', '100013', '100042'], // Access Bank
};

const NIGERIAN_BANKS: BankDirectoryEntry[] = [
  // ── Commercial banks (CBN sort codes) ──────────────────────────────────────
  { code: '000014', name: 'Access Bank',             shortName: 'Access',    color: '#E30813', nipEnabled: true, type: 'commercial' },
  { code: '000009', name: 'Citibank Nigeria',         shortName: 'Citibank',  color: '#003B70', nipEnabled: true, type: 'commercial' },
  { code: '000010', name: 'EcoBank Nigeria',          shortName: 'EcoBank',   color: '#008000', nipEnabled: true, type: 'commercial' },
  { code: '000007', name: 'Fidelity Bank',            shortName: 'Fidelity',  color: '#00703C', nipEnabled: true, type: 'commercial' },
  { code: '000016', name: 'First Bank of Nigeria',    shortName: 'First Bank',color: '#01579B', nipEnabled: true, type: 'commercial' },
  { code: '000003', name: 'First City Monument Bank', shortName: 'FCMB',      color: '#00008B', nipEnabled: true, type: 'commercial' },
  { code: '000027', name: 'Globus Bank',              shortName: 'Globus',    color: '#1A1A6E', nipEnabled: true, type: 'commercial' },
  { code: '000013', name: 'Guaranty Trust Bank',      shortName: 'GTBank',    color: '#F36F21', nipEnabled: true, type: 'commercial' },
  { code: '000006', name: 'Jaiz Bank',                shortName: 'Jaiz',      color: '#006400', nipEnabled: true, type: 'commercial' },
  { code: '000002', name: 'Keystone Bank',            shortName: 'Keystone',  color: '#1E3A5F', nipEnabled: true, type: 'commercial' },
  { code: '000029', name: 'Lotus Bank',               shortName: 'Lotus',     color: '#006400', nipEnabled: true, type: 'commercial' },
  { code: '000030', name: 'Parallex Bank',            shortName: 'Parallex',  color: '#00A651', nipEnabled: true, type: 'commercial' },
  { code: '000008', name: 'Polaris Bank',             shortName: 'Polaris',   color: '#D32F2F', nipEnabled: true, type: 'commercial' },
  { code: '000031', name: 'Premium Trust Bank',       shortName: 'PremiumTrust', color: '#1B3A6B', nipEnabled: true, type: 'commercial' },
  { code: '000023', name: 'Providus Bank',            shortName: 'Providus',  color: '#004080', nipEnabled: true, type: 'commercial' },
  { code: '000012', name: 'Stanbic IBTC Bank',        shortName: 'Stanbic',   color: '#009EE0', nipEnabled: true, type: 'commercial' },
  { code: '000021', name: 'Standard Chartered',       shortName: 'StanChart', color: '#0072AA', nipEnabled: true, type: 'commercial' },
  { code: '000001', name: 'Sterling Bank',            shortName: 'Sterling',  color: '#CC0000', nipEnabled: true, type: 'commercial' },
  { code: '000022', name: 'Suntrust Bank',            shortName: 'Suntrust',  color: '#FF8C00', nipEnabled: true, type: 'commercial' },
  { code: '000026', name: 'TAJ Bank',                 shortName: 'TAJ',       color: '#006400', nipEnabled: true, type: 'commercial' },
  { code: '000025', name: 'Titan Trust Bank',         shortName: 'Titan',     color: '#1B3A6B', nipEnabled: true, type: 'commercial' },
  { code: '000018', name: 'Union Bank of Nigeria',    shortName: 'Union',     color: '#003366', nipEnabled: true, type: 'commercial' },
  { code: '000004', name: 'United Bank for Africa',   shortName: 'UBA',       color: '#D0021B', nipEnabled: true, type: 'commercial' },
  { code: '000011', name: 'Unity Bank',               shortName: 'Unity',     color: '#006400', nipEnabled: true, type: 'commercial' },
  { code: '000017', name: 'Wema Bank',                shortName: 'Wema',      color: '#5A2D82', nipEnabled: true, type: 'commercial' },
  { code: '000015', name: 'Zenith Bank',              shortName: 'Zenith',    color: '#C8102E', nipEnabled: true, type: 'commercial' },

  // ── Microfinance banks (standard NIBSS 090xxx codes) ───────────────────────
  { code: '090713', name: 'Pulse Microfinance Bank',      shortName: 'Pulse MFB',    color: '#0F7B52', nipEnabled: true,  type: 'microfinance' },
  { code: '090405', name: 'Moniepoint Microfinance Bank', shortName: 'Moniepoint',   color: '#004B87', nipEnabled: true,  type: 'microfinance' },
  { code: '090267', name: 'Kuda Microfinance Bank',       shortName: 'Kuda',         color: '#40196D', nipEnabled: true,  type: 'microfinance' },

  // ── Fintechs / payment service banks (standard NIBSS 100xxx codes) ─────────
  { code: '100004', name: 'OPay',    shortName: 'OPay',    color: '#008751', nipEnabled: true, type: 'fintech' },
  { code: '100033', name: 'PalmPay', shortName: 'PalmPay', color: '#00A859', nipEnabled: true, type: 'fintech' },
];

function getTransferFeeUsdc(amountNgn: number, effectiveRate: number): number {
  if (amountNgn < 50_000)  return 0.03
  if (amountNgn < 100_000) return 500 / effectiveRate
  if (amountNgn < 500_000) return 1_000 / effectiveRate
  return 1_300 / effectiveRate
}
const MIN_TRANSFER_NGN = 500;
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

function canonicalizeSignaturePayload(payload: Record<string, string>): string {
  const sortedPayload = Object.keys(payload)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});

  return JSON.stringify(sortedPayload);
}

function isPulseMfbAuthFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('invalid api credentials') ||
    normalized.includes('tampered request') ||
    normalized.includes('unauthorized') ||
    normalized.includes('not whitelisted') ||
    normalized.includes('whitelist') ||
    normalized.includes('pending approval')
  );
}

function isPulseMfbRecipientValidationFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('invalid credit account') ||
    normalized.includes('account number') ||
    normalized.includes('account not found') ||
    normalized.includes('invalid bank code') ||
    normalized.includes('beneficiary_bank_code') ||
    normalized.includes('beneficiary_bank_name') ||
    normalized.includes('beneficiary_name')
  );
}

function isPulseMfbInternalError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('gson') ||
    normalized.includes('must not be null') ||
    normalized.includes('nullpointerexception') ||
    normalized.includes('classcastexception') ||
    normalized.includes('internal server error') ||
    normalized.includes('deserializ') ||
    normalized.includes('fromjson')
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export interface BankTransferJobData {
  transferId: string;
  txId: string;
  userId: string;
  userPublicKey: string;
  userSecretEnc: string;
  amountUsdc: string;
  amountNgn: number;
  feeUsdc: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  username: string;
  userEmail?: string;
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
    @InjectRepository(BankDeposit)
    private readonly depositRepo: Repository<BankDeposit>,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
    private readonly pulseMfb: PulseMfbClient,
    private readonly tierMilestone: TierMilestoneService,
    private readonly referralService: ReferralService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly alertsService: AlertsService,
    @Optional() @InjectQueue('bank-transfer')
    private readonly bankTransferQueue: Queue | undefined,
  ) {}

  // ── GET /banks ────────────────────────────────────────────────────────────
  // async getBanks(): Promise<{
  //   name: string;
  //   code: string;
  // }[]> {
  async getBanks(): Promise<BankDirectoryEntry[]> {
    return NIGERIAN_BANKS;
    // try {
    //   const result = await this.pulseMfb.banks();
    //   return result;
    // } catch (err) {
    //   this.logger.error('Failed to fetch PulseMFB bank list', { error: (err as Error).message });
    //   return [];
    // }
  }

  // ── POST /banks/resolve ───────────────────────────────────────────────────
  async resolveAccount(dto: ResolveAccountDto): Promise<{
    accountName: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
    verified: boolean;
  }> {
    const bankName = this.findBankByCode(dto.bankCode)?.name ?? dto.bankCode;
    const codesToTry = [dto.bankCode, ...(BANK_CODE_FALLBACKS[dto.bankCode] ?? [])];

    let lastError: Error | undefined;

    for (const code of codesToTry) {
      try {
        const result = await this.pulseMfb.nameEnquiry(
          dto.accountNumber,
          code,
        );

        if (result.responseCode === '00' && result.accountName.trim()) {
          if (code !== dto.bankCode) {
            this.logger.log(
              `Access Bank name enquiry succeeded with fallback code ${code} (primary ${dto.bankCode} failed)`,
            );
          }
          return {
            accountName: result.accountName,
            accountNumber: dto.accountNumber,
            bankCode: code,
            bankName,
            verified: true,
          };
        }

        const providerMessage =
          result.responseMessage?.trim() ||
          'Could not verify the recipient account';
        this.logger.warn('PulseMFB name enquiry did not verify account', {
          accountNumber: dto.accountNumber,
          bankCode: code,
          responseCode: result.responseCode,
          responseMessage: providerMessage,
        });
        lastError = new BadRequestException(
          'Could not verify the recipient account. Please check the account number and bank.',
        );
      } catch (err) {
        const errorMessage = (err as Error).message;
        this.logger.error('PulseMFB name enquiry failed', {
          accountNumber: dto.accountNumber,
          bankCode: code,
          error: errorMessage,
        });

        // Auth failures affect all codes — bail immediately
        if (isPulseMfbAuthFailureMessage(errorMessage)) {
          throw err;
        }
        if (isPulseMfbInternalError(errorMessage)) {
          throw new BadRequestException(
            'The banking provider is temporarily unavailable. Please try again in a few minutes.',
          );
        }

        lastError = err as Error;
      }
    }

    // All codes exhausted
    if (lastError instanceof BadRequestException) {
      throw lastError;
    }
    throw new BadRequestException(
      'Could not verify the recipient account. Please try again.',
    );
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
    if (!sigValid && !isInsecureDeviceSignatureBypassEnabled(this.config)) {
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
    const feeUsdc = getTransferFeeUsdc(amountNgn, effectiveRate).toFixed(6);
    const amountUsdc = (amountNgn / effectiveRate + parseFloat(feeUsdc)).toFixed(6);

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
    if (!resolvedAccount.verified || !resolvedAccount.accountName.trim()) {
      throw new BadRequestException(
        'Could not verify the recipient account. Confirm the bank and account number and try again.',
      );
    }
    if (
      normalizeAccountName(resolvedAccount.accountName) !==
      normalizeAccountName(dto.accountName)
    ) {
      throw new BadRequestException(
        `Account name mismatch. Resolved name is "${resolvedAccount.accountName}".`,
      );
    }
    const accountName = resolvedAccount.accountName;
    // Use the bank code that actually worked at PulseMFB (may be a fallback)
    const effectiveBankCode = resolvedAccount.bankCode;

    // 8. Create PENDING records — both start as PENDING before any money moves
    const reference = `CW-NGN-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

    const transfer = await this.transferRepo.save(
      this.transferRepo.create({
        userId,
        accountNumber: dto.accountNumber,
        bankCode: effectiveBankCode,
        bankName,
        accountName,
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
      recipientName: accountName,
      accountNumber: dto.accountNumber,
      bankName,
      reference,
      description: `Withdrawal to ${accountName} — ${bankName}`,
    });

    // 9. Queue the SAGA job — debit + payout run asynchronously so the HTTP
    //    response is not held open while PulseMFB processes (25–45 s).
    //    The user is notified via push/email once the transfer settles.
    const jobData: BankTransferJobData = {
      transferId: transfer.id,
      txId: tx.id,
      userId,
      userPublicKey: user.stellarPublicKey,
      userSecretEnc: user.stellarSecretEnc,
      amountUsdc,
      amountNgn,
      feeUsdc,
      bankCode: effectiveBankCode,
      bankName,
      accountNumber: dto.accountNumber,
      accountName,
      reference,
      username: user.username,
      userEmail: user.email ?? undefined,
    };

    if (this.bankTransferQueue) {
      try {
        await this.bankTransferQueue.add('process', jobData, {
          attempts: 1,           // No automatic BullMQ retries — SAGA handles errors internally
          removeOnComplete: true,
          removeOnFail: false,   // Keep failed jobs in Redis for inspection
        });
        this.logger.log(`Bank transfer queued [ref=${reference}]`);
      } catch (queueErr) {
        // Redis is unavailable — clean up the PENDING records immediately so the
        // scheduler cannot later mistake them for submitted transfers and attempt
        // a spurious USDC refund from the platform wallet.
        // No USDC has been touched at this point so no compensation is needed.
        this.logger.error(
          `Bank transfer queue unavailable [ref=${reference}]: ${(queueErr as Error).message}`,
        );
        await this.transferRepo.update(
          { id: transfer.id },
          { status: BankTransferStatus.FAILED, failureReason: 'Queue unavailable — please retry' },
        );
        await this.txService.update(tx.id, {
          status: TxStatus.FAILED,
          failureReason: 'Queue unavailable — please retry',
        });
        throw new BadRequestException(
          'Service temporarily unavailable. Please try again in a moment.',
        );
      }
    } else {
      // Redis not available (dev environment without queue) — fall back to sync execution
      this.logger.warn(
        `Bank transfer queue unavailable — processing synchronously [ref=${reference}]`,
      );
      await this.executeTransferSaga(jobData);
    }

    return {
      reference,
      providerReference: null,
      status: BankTransferStatus.PENDING,
      message:
        'Your transfer is being processed. You will receive a notification once the NGN payout settles.',
      amountNgn: dto.amountNgn,
      amountUsdc,
      rateApplied: rate.effectiveRate,
      fee: feeUsdc,
      recipientName: accountName,
      bankName,
      stellarTxHash: null,
      createdAt: transfer.createdAt,
    };
  }

  // ── Transfer SAGA ─────────────────────────────────────────────────────────
  //
  // Executes the two-step SAGA for a bank transfer:
  //
  //   Step 1 — Deduct USDC from the user's Stellar wallet → platform wallet.
  //            On failure: mark FAILED (no USDC moved, no compensation needed).
  //
  //   Step 2 — Initiate NGN payout via PulseMFB.
  //            On timeout: mark PROCESSING (scheduler + webhook resolve later).
  //            On immediate success: mark COMPLETED, fire notifications.
  //            On definitive rejection: compensating transaction — refund USDC,
  //            mark FAILED, alert admin, notify user.
  //
  // Called by BankTransferProcessor (queue consumer) and, when Redis is not
  // available, directly from bankTransfer() as a synchronous fallback.
  // This method never throws — all error paths are handled internally.
  //
  async executeTransferSaga(data: BankTransferJobData): Promise<void> {
    const {
      transferId,
      txId,
      userId,
      userPublicKey,
      userSecretEnc,
      amountUsdc,
      amountNgn,
      feeUsdc,
      bankCode,
      bankName,
      accountNumber,
      accountName,
      reference,
      username,
      userEmail,
    } = data;

    // ── SAGA Step 1: Deduct USDC ───────────────────────────────────────────
    try {
      const stellarTxHash = await this.blockchainService.platformWithdrawUsdc(
        userSecretEnc,
        amountUsdc,
        reference,
      );
      await this.txService.update(txId, { txHash: stellarTxHash });
      this.logger.log(
        `USDC deducted [ref=${reference}] [hash=${stellarTxHash}]`,
      );
    } catch (err) {
      // USDC never left the user — mark FAILED, no compensating transaction needed
      const errMsg = (err as Error).message;
      await this.transferRepo.update(
        { id: transferId },
        { status: BankTransferStatus.FAILED, failureReason: errMsg },
      );
      await this.txService.update(txId, {
        status: TxStatus.FAILED,
        failureReason: errMsg,
      });
      void this.alertsService
        .notifyFailedTransfer({
          username,
          userEmail,
          amountNgn,
          amountUsdc,
          feeUsdc,
          bankName,
          accountName,
          accountNumber,
          reference,
          failureReason: errMsg,
          stage: 'stellar',
        })
        .catch((e: Error) =>
          this.logger.error(
            `Failed transfer alert error [ref=${reference}]: ${e.message}`,
          ),
        );
      void this.notificationsService
        .notifyBankTransferFailed(userId, String(amountNgn), errMsg)
        .catch((e: Error) =>
          this.logger.warn(
            `Bank transfer failure notification error [ref=${reference}]: ${e.message}`,
          ),
        );
      return;
    }

    // ── SAGA Step 2: Initiate NGN payout ──────────────────────────────────
    //
    // IMPORTANT: The SAGA rollback catch block ONLY wraps initiateBankingTransfer.
    // Post-success work (processWebhook, milestone check) runs OUTSIDE this scope
    // so that a DB hiccup there cannot trigger a USDC refund for a payout that
    // already landed at PulseMFB.
    let sagaResult: { providerRef: string; completedImmediately: boolean };
    try {
      sagaResult = await this.initiateBankingTransfer({
        debitAccount: this.pulseMfb.platformDebitAccount,
        accountNumber,
        bankCode,
        bankName,
        accountName,
        amountNgn,
        reference,
      });
    } catch (err) {
      const errMsg = (err as Error).message ?? '';
      const isTimeout = errMsg.toLowerCase().includes('timed out');

      if (isTimeout) {
        // Timeout ≠ rejection — PulseMFB may have received and processed the
        // request. Leave PROCESSING; the webhook or scheduler will resolve it.
        this.logger.error(
          `Banking provider timed out for [ref=${reference}] — leaving PROCESSING, awaiting webhook`,
        );
        await this.transferRepo.update(
          { id: transferId },
          {
            status: BankTransferStatus.PROCESSING,
            failureReason: errMsg,
          },
        );
        return;
      }

      // Definitive rejection — SAGA compensating transaction: refund USDC
      this.logger.error(
        `Banking provider rejected [ref=${reference}] — refunding USDC: ${errMsg}`,
      );
      await this.refundUsdc({
        userId,
        toPublicKey: userPublicKey,
        amountUsdc,
        reference,
        reason: errMsg,
      });
      await this.transferRepo.update(
        { id: transferId },
        { status: BankTransferStatus.FAILED, failureReason: errMsg },
      );
      await this.txService.update(txId, {
        status: TxStatus.FAILED,
        failureReason: `Banking provider failed — USDC refunded. ${errMsg}`,
      });
      void this.alertsService
        .notifyFailedTransfer({
          username,
          userEmail,
          amountNgn,
          amountUsdc,
          feeUsdc,
          bankName,
          accountName,
          accountNumber,
          reference,
          failureReason: errMsg,
          stage: 'provider',
        })
        .catch((e: Error) =>
          this.logger.error(
            `Failed transfer alert error [ref=${reference}]: ${e.message}`,
          ),
        );
      void this.notificationsService
        .notifyBankTransferFailed(userId, String(amountNgn), errMsg)
        .catch((e: Error) =>
          this.logger.warn(
            `Bank transfer failure notification error [ref=${reference}]: ${e.message}`,
          ),
        );
      return;
    }

    // ── Post-SAGA: persist result and fire notifications ──────────────────
    // We are outside the rollback scope here — a failure at this point must
    // NOT trigger a USDC refund because PulseMFB has already accepted (or
    // completed) the payout.
    const { providerRef, completedImmediately } = sagaResult;

    if (completedImmediately) {
      // PulseMFB settled synchronously — save provider ref then delegate to
      // processWebhook so status update + notifications follow the same path
      // as the webhook (push notification, email, referral qualification).
      await this.transferRepo.update(
        { id: transferId },
        { providerReference: providerRef },
      );
      try {
        await this.processWebhook({ reference, event: 'transfer.success' });
      } catch (err) {
        // The NGN payout already landed — do not refund. Log and let the
        // scheduler or a manual webhook replay resolve the status.
        this.logger.error(
          `processWebhook failed for immediately-settled transfer [ref=${reference}]: ${(err as Error).message}`,
        );
      }
      this.logger.log(
        `Bank transfer settled immediately via processor [ref=${reference}] [provider=${providerRef}]`,
      );
    } else {
      // PulseMFB accepted but settlement is pending — webhook or scheduler
      // will fire transfer.success / transfer.failed when it resolves.
      await this.transferRepo.update(
        { id: transferId },
        {
          status: BankTransferStatus.PROCESSING,
          providerReference: providerRef,
        },
      );
      this.logger.log(
        `Bank transfer submitted to provider [ref=${reference}] [provider=${providerRef}]`,
      );
    }

    // Fire-and-forget tier milestone check
    void this.tierMilestone.checkAndNotify(userId);
  }

  // ── POST /banks/webhook ───────────────────────────────────────────────────
  async processWebhook(dto: BankWebhookDto) {
    const transfer = await this.findTransferByAnyReference(dto.reference);
    if (!transfer) {
      throw new NotFoundException(
        `No transfer found with reference or provider reference: ${dto.reference}`,
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
        reference: transfer.reference,
        providerReference: transfer.providerReference,
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
        await this.txService.updateByReference(transfer.reference, {
          status: TxStatus.COMPLETED,
        });
        this.logger.log(
          `Bank transfer settled [ref=${transfer.reference}] ` +
            `[providerRef=${transfer.providerReference ?? dto.reference}]`,
        );
        void this.referralService
          .qualifyReferral(transfer.userId)
          .catch((e: Error) =>
            this.logger.warn(`qualifyReferral failed [user=${transfer.userId}]: ${e.message}`),
          );

        // Fire-and-forget user notifications
        const successUser = await this.userRepo.findOne({
          where: { id: transfer.userId },
          select: ['id', 'email', 'fullName', 'username'],
        });
        if (successUser) {
          void this.notificationsService
            .notifyTransactionComplete(
              successUser.id,
              transfer.reference,
              transfer.amountUsdc,
            )
            .catch((e: Error) =>
              this.logger.warn(`Bank transfer notification failed [ref=${transfer.reference}]: ${e.message}`),
            );
          if (successUser.email) {
            this.emailService
              .sendMoneySent({
                to: successUser.email,
                fullName: successUser.fullName ?? successUser.username,
                amountUsdc: transfer.amountUsdc,
                amountNgn: transfer.amountNgn,
                recipientName: `${transfer.accountName} · ${transfer.bankName}`,
                reference: transfer.reference,
                fee: transfer.feeUsdc ?? '0',
                appUrl: this.config.get<string>('app.frontendUrl', 'https://cheesepay.xyz'),
              })
              .catch((e: Error) =>
                this.logger.error(`Bank transfer success email failed [ref=${transfer.reference}]: ${e.message}`),
              );
          }
        }

        return {
          processed: true,
          reference: transfer.reference,
          providerReference: transfer.providerReference,
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
            reference: transfer.reference,
            reason: dto.failureReason ?? dto.event,
          });
        } else {
          this.logger.error(
            `Cannot refund — user ${transfer.userId} has no Stellar wallet [ref=${transfer.reference}]`,
          );
        }

        await this.transferRepo.update(
          { id: transfer.id },
          {
            status: newStatus,
            failureReason: dto.failureReason ?? dto.event,
          },
        );
        await this.txService.updateByReference(transfer.reference, {
          status:
            newStatus === BankTransferStatus.REVERSED
              ? TxStatus.REVERSED
              : TxStatus.FAILED,
          failureReason: dto.failureReason ?? dto.event,
        });

        this.logger.log(
          `Bank transfer ${dto.event} [ref=${transfer.reference}] ` +
            `[providerRef=${transfer.providerReference ?? dto.reference}] — ` +
            `USDC refund initiated`,
        );

        // Fire-and-forget admin alert
        void this.alertsService
          .notifyFailedTransfer({
            username: user?.username ?? `user:${transfer.userId}`,
            userEmail: user?.email ?? undefined,
            amountNgn: transfer.amountNgn,
            amountUsdc: transfer.amountUsdc,
            feeUsdc: transfer.feeUsdc ?? '0.000000',
            bankName: transfer.bankName,
            accountName: transfer.accountName,
            accountNumber: transfer.accountNumber,
            reference: transfer.reference,
            failureReason: dto.failureReason ?? dto.event,
            stage: 'webhook',
          })
          .catch((e: Error) =>
            this.logger.error(
              `Failed transfer alert error [ref=${transfer.reference}]: ${e.message}`,
            ),
          );

        // Fire-and-forget failure notification
        if (user) {
          void this.notificationsService
            .notifyBankTransferFailed(
              user.id,
              transfer.amountNgn,
              dto.failureReason ?? dto.event,
            )
            .catch((e: Error) =>
              this.logger.warn(`Bank transfer failure notification failed [ref=${transfer.reference}]: ${e.message}`),
            );
        }

        return {
          processed: true,
          reference: transfer.reference,
          providerReference: transfer.providerReference,
          status: newStatus,
          refunded: !!user?.stellarPublicKey,
        };
      }
    }
  }

  // ── GET /banks/onramp-availability ───────────────────────────────────────
  // Returns how much USDC is available for users to buy (40% of treasury).
  async getAvailableOnRampUsdc(): Promise<{
    availableUsdc: string;
    availableUsdcDisplay: string;
  }> {
    const treasuryBalance = await this.blockchainService.getPlatformUsdcBalance();
    const available = parseFloat(treasuryBalance) * 0.4;
    return {
      availableUsdc:        available.toFixed(2),
      availableUsdcDisplay: `$${available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
  }

  // ── GET /banks/virtual-account ───────────────────────────────────────────
  // Returns the user's dedicated NGN virtual account, creating one if it does
  // not exist yet.  The account is permanently tied to the user.
  async getOrCreateVirtualAccount(
    user: User,
  ): Promise<{ accountNumber: string; accountName: string }> {
    if (user.virtualAccountNumber && user.virtualAccountName) {
      return {
        accountNumber: user.virtualAccountNumber,
        accountName:   user.virtualAccountName,
      };
    }

    if (!this.pulseMfb.isReady) {
      throw new BadRequestException(
        'Banking provider not configured — virtual accounts unavailable',
      );
    }

    // Stable reference: VA- + first 16 hex chars of the UUID (no dashes)
    const reference = `VA-${user.id.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    const result    = await this.pulseMfb.createVirtualAccount({
      customerName:  user.fullName ?? user.username,
      customerEmail: user.email,
      customerPhone: user.phone ?? undefined,
      reference,
    });

    await this.userRepo.update(
      { id: user.id },
      {
        virtualAccountNumber: result.accountNumber,
        virtualAccountName:   result.accountName,
        virtualAccountRef:    reference,
      },
    );

    this.logger.log(
      `Virtual account created [user=@${user.username}] [account=${result.accountNumber}]`,
    );

    return { accountNumber: result.accountNumber, accountName: result.accountName };
  }

  // ── GET /banks/deposits ───────────────────────────────────────────────────
  async getDeposits(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.depositRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // ── VAS deposit processing (vas.completed webhook) ────────────────────────
  // Called by processPulseMfbWebhook when event === 'vas.completed'.
  // Converts the inbound NGN amount to USDC and credits the user's wallet.
  private async processVasDeposit(
    data: Record<string, unknown>,
  ): Promise<{ processed: boolean; reason?: string }> {
    // PulseMFB field names for vas.completed are not officially documented;
    // handle both camelCase and snake_case variants defensively.
    const accountNumber =
      (typeof data.account_number === 'string' && data.account_number) ||
      (typeof data.accountNumber  === 'string' && data.accountNumber)  || null;

    const rawAmount = data.amount ?? data.amountNgn ?? data.amount_ngn;
    const amountNgn =
      typeof rawAmount === 'number' ? rawAmount :
      typeof rawAmount === 'string' ? parseFloat(rawAmount) : null;

    const reference =
      (typeof data.reference    === 'string' && data.reference)    ||
      (typeof data.session_id   === 'string' && data.session_id)   ||
      (typeof data.sessionId    === 'string' && data.sessionId)    ||
      (typeof data.payment_ref  === 'string' && data.payment_ref)  || null;

    const senderName =
      (typeof data.sender_name  === 'string' && data.sender_name)  ||
      (typeof data.senderName   === 'string' && data.senderName)   || null;

    const senderAccount =
      (typeof data.sender_account_number === 'string' && data.sender_account_number) ||
      (typeof data.senderAccountNumber   === 'string' && data.senderAccountNumber)   || null;

    if (!accountNumber || !amountNgn || amountNgn <= 0 || !reference) {
      this.logger.warn(
        `VAS deposit missing required fields [data=${JSON.stringify(data)}]`,
      );
      return { processed: false, reason: 'missing required fields' };
    }

    // Find the user who owns this virtual account
    const user = await this.userRepo.findOne({
      where: { virtualAccountNumber: accountNumber },
    });
    if (!user) {
      this.logger.warn(
        `VAS deposit for unknown virtual account [account=${accountNumber}] [ref=${reference}]`,
      );
      return { processed: false, reason: 'virtual account not found' };
    }

    if (!user.stellarPublicKey) {
      this.logger.warn(
        `VAS deposit for user without Stellar wallet [user=@${user.username}] [ref=${reference}]`,
      );
      return { processed: false, reason: 'user has no wallet' };
    }

    // Idempotency — skip only if already successfully completed
    const existing = await this.depositRepo.findOne({ where: { reference } });
    if (existing?.status === BankDepositStatus.COMPLETED) {
      this.logger.log(
        `VAS deposit already completed [ref=${reference}] [user=@${user.username}]`,
      );
      return { processed: true, reason: 'already processed' };
    }
    // If a previous attempt failed, delete the stale record so we retry cleanly
    if (existing?.status === BankDepositStatus.FAILED) {
      this.logger.warn(
        `VAS deposit retrying after previous failure [ref=${reference}] [user=@${user.username}]`,
      );
      await this.depositRepo.delete({ id: existing.id });
    }

    // Convert NGN → USDC at the current effective rate
    const rate          = await this.ratesService.getCurrentRate();
    const effectiveRate = parseFloat(rate.effectiveRate);
    const amountUsdc    = (amountNgn / effectiveRate).toFixed(6);
    const internalRef   = `DEP-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

    // Persist a pending record first so a crash mid-flight is recoverable
    const deposit = await this.depositRepo.save(
      this.depositRepo.create({
        userId:               user.id,
        reference,
        virtualAccountNumber: accountNumber,
        amountNgn:            amountNgn.toFixed(2),
        amountUsdc,
        rateApplied:          effectiveRate.toFixed(4),
        senderName:           senderName || null,
        senderAccountNumber:  senderAccount || null,
        status:               BankDepositStatus.PENDING,
      }),
    );

    this.logger.log(
      `VAS deposit processing [ref=${reference}] [user=@${user.username}] ` +
      `[ngn=${amountNgn}] [usdc=${amountUsdc}]`,
    );

    // Credit the user's Stellar wallet from the platform treasury
    let txHash: string;
    try {
      txHash = await this.blockchainService.platformDepositUsdc(
        user.stellarPublicKey,
        amountUsdc,
      );
    } catch (err) {
      const reason = (err as Error).message;
      this.logger.error(
        `VAS deposit credit failed [ref=${reference}] [user=@${user.username}]: ${reason}`,
      );
      await this.depositRepo.update(
        { id: deposit.id },
        { status: BankDepositStatus.FAILED, failureReason: reason },
      );
      return { processed: false, reason: 'credit failed' };
    }

    // Record the completed transaction
    await this.txService.create({
      userId:      user.id,
      type:        TxType.DEPOSIT,
      status:      TxStatus.COMPLETED,
      amountUsdc,
      amountNgn:   amountNgn.toFixed(2),
      rateApplied: effectiveRate.toFixed(4),
      txHash,
      reference:   internalRef,
      description: 'NGN bank deposit',
      network:     'stellar',
    });

    await this.depositRepo.update(
      { id: deposit.id },
      { status: BankDepositStatus.COMPLETED, txHash },
    );

    this.logger.log(
      `VAS deposit settled [ref=${reference}] [user=@${user.username}] [txHash=${txHash}]`,
    );

    // Fire-and-forget push notification
    void this.notificationsService
      .notifyDepositReceived(user.id, amountNgn.toFixed(2), amountUsdc)
      .catch((e: Error) =>
        this.logger.warn(`Deposit notification failed [ref=${reference}]: ${e.message}`),
      );

    return { processed: true };
  }

  // ── POST /banks/webhook/pulsemfb ─────────────────────────────────────────
  // Receives transfer.completed / transfer.failed events from PulseMFB.
  // The controller verifies the HMAC signature before calling this method.
  async processPulseMfbWebhook(event: string, data: Record<string, any>) {
    // VAS (virtual account) deposit events
    if (event === 'vas.completed') {
      this.logger.log('PulseMFB webhook [event=vas.completed] — processing deposit');
      return this.processVasDeposit(data as Record<string, unknown>);
    }

    if (event === 'vas.failed') {
      this.logger.warn(
        `PulseMFB webhook [event=vas.failed] — deposit failed [data=${JSON.stringify(data)}]`,
      );
      return { processed: false, event };
    }

    // We only act on transfer events — ignore account.created, etc.
    if (!event.startsWith('transfer.')) {
      this.logger.log(
        `PulseMFB webhook [event=${event}] — ignored (non-transfer)`,
      );
      return { processed: false, event };
    }

    const payload = data as Record<string, unknown>;
    const reference =
      (typeof payload.reference === 'string' && payload.reference) ||
      (typeof payload.internal_reference === 'string' &&
        payload.internal_reference) ||
      (typeof payload.external_reference === 'string' &&
        payload.external_reference) ||
      '';
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
    bankName: string;
    accountName: string;
    amountNgn: number;
    reference: string;
  }): Promise<{ providerRef: string; completedImmediately: boolean }> {
    const result = await this.pulseMfb.initiateTransfer({
      debitAccount: params.debitAccount,
      beneficiaryAccountNumber: params.accountNumber,
      beneficiaryBankCode: params.bankCode,
      beneficiaryBankName: params.bankName,
      beneficiaryName: params.accountName,
      amount: params.amountNgn,
      narration: `Cheese Pay withdrawal ${params.reference}`,
      reference: params.reference,
    });

    this.logger.log(
      `PulseMFB transfer initiated [ref=${params.reference}] ` +
        `[internal=${result.internal_reference}] [status=${result.status}]`,
    );

    return {
      providerRef: result.internal_reference,
      completedImmediately: result.status === 'completed',
    };
  }

  // ── GET /banks/transfer/:reference ───────────────────────────────────────
  // Polls PulseMFB for the current status of a transfer and syncs it locally.
  // Called by the frontend when a transfer is stuck in pending/processing.
  async syncTransferStatus(userId: string, reference: string) {
    const transfer = await this.findTransferByAnyReference(reference);
    if (!transfer) {
      throw new NotFoundException(`Transfer not found: ${reference}`);
    }
    if (transfer.userId !== userId) {
      throw new ForbiddenException();
    }

    const terminal = [
      BankTransferStatus.COMPLETED,
      BankTransferStatus.FAILED,
      BankTransferStatus.REVERSED,
    ];
    if (terminal.includes(transfer.status)) {
      return {
        reference: transfer.reference,
        status: transfer.status,
        synced: false,
      };
    }

    // Query by providerReference when available, otherwise fall back to our
    // own reference (handles the timeout case where we never got a response).
    const queryRef = transfer.providerReference ?? transfer.reference;
    let remote: Awaited<ReturnType<typeof this.pulseMfb.getTransferStatus>>;
    try {
      remote = await this.pulseMfb.getTransferStatus(queryRef);
    } catch {
      return {
        reference: transfer.reference,
        status: transfer.status,
        synced: false,
      };
    }

    if (remote.status === 'completed') {
      await this.processWebhook({
        reference: transfer.reference,
        event: 'transfer.success',
      });
      return {
        reference: transfer.reference,
        status: BankTransferStatus.COMPLETED,
        synced: true,
      };
    }

    if (remote.status === 'failed') {
      await this.processWebhook({
        reference: transfer.reference,
        event: 'transfer.failed',
        failureReason: 'Failed — detected via status poll',
      });
      return {
        reference: transfer.reference,
        status: BankTransferStatus.FAILED,
        synced: true,
      };
    }

    return {
      reference: transfer.reference,
      status: transfer.status,
      synced: false,
    };
  }

  private async findTransferByAnyReference(
    reference: string,
  ): Promise<BankTransfer | null> {
    return this.transferRepo.findOne({
      where: [{ reference }, { providerReference: reference }],
    });
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
