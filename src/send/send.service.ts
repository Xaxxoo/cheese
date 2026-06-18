// src/send/send.service.ts
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
import { SendToAddressDto, SendToUsernameDto } from './dto';
import { KycStatus } from '../auth/entities/user.entity';
import { DAILY_CRYPTO_LIMIT_USDC, formatCryptoLimit } from '../kyc/tier.limits';
import { TierMilestoneService } from '../kyc/tier-milestone.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isInsecureDeviceSignatureBypassEnabled } from '../common/utils/device-signature.util';

const FALLBACK_FEE_RATE = 0.001; // 0.1% — used when Soroban contract is unavailable
const MIN_USDC = 0.01;

@Injectable()
export class SendService {
  private readonly logger = new Logger(SendService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    private readonly blockchainService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
    private readonly config: ConfigService,
    private readonly tierMilestone: TierMilestoneService,
    private readonly referralService: ReferralService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── GET /send/resolve/:username ───────────────────────────
  async resolveUsername(
    username: string,
  ): Promise<{ address: string; username: string }> {
    const user = await this.userRepo.findOne({
      where: { username: username.replace(/^@/, ''), isActive: true },
    });
    if (!user?.stellarPublicKey)
      throw new NotFoundException(`@${username} not found`);
    return { address: user.stellarPublicKey, username: user.username };
  }

  // ── POST /send/username ───────────────────────────────────
  async sendToUsername(senderId: string, dto: SendToUsernameDto) {
    const recipient = await this.resolveUsername(dto.username);
    return this.executeSend(senderId, {
      toAddress: recipient.address,
      amountUsdc: dto.amountUsdc,
      pinHash: dto.pinHash,
      deviceId: dto.deviceId,
      deviceSignature: dto.deviceSignature,
      recipientUsername: recipient.username,
      type: TxType.SEND_USERNAME,
    });
  }

  // ── GET /send/fee-rate ────────────────────────────────────
  async getFeeRatePublic(): Promise<{ feeRate: number; feePct: string }> {
    const feeRate = await this.getFeeRate();
    return { feeRate, feePct: `${(feeRate * 100).toFixed(2)}%` };
  }

  // ── POST /send/address ────────────────────────────────────
  async sendToAddress(senderId: string, dto: SendToAddressDto) {
    return this.executeSend(senderId, {
      toAddress: dto.address,
      amountUsdc: dto.amountUsdc,
      pinHash: dto.pinHash,
      deviceId: dto.deviceId,
      deviceSignature: dto.deviceSignature,
      network: dto.network,
      memo: dto.memo,
      type: TxType.SEND_ADDRESS,
    });
  }

  // ── Shared execution logic ────────────────────────────────
  private async executeSend(
    senderId: string,
    params: {
      toAddress: string;
      amountUsdc: string;
      pinHash: string;
      deviceId: string;
      deviceSignature: string;
      recipientUsername?: string;
      network?: string;
      memo?: string;
      type: TxType;
    },
  ) {
    // 1. Load sender
    const sender = await this.userRepo.findOne({ where: { id: senderId } });
    if (!sender?.stellarPublicKey || !sender.stellarSecretEnc) {
      throw new BadRequestException('Wallet not initialised');
    }

    // 2. KYC gate — must be verified before any outbound transaction
    if (sender.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException(
        'Identity verification required before sending. Please complete KYC in your profile.',
      );
    }

    // 3. Daily crypto send limit
    const amount = parseFloat(params.amountUsdc);
    const dailyLimit = DAILY_CRYPTO_LIMIT_USDC[sender.tier];
    const dailySpent = await this.txService.getDailyOutboundUsdc(senderId);
    if (dailySpent + amount > dailyLimit) {
      const remaining = Math.max(0, dailyLimit - dailySpent);
      throw new ForbiddenException(
        `Daily send limit reached. Your ${sender.tier} tier allows ${formatCryptoLimit(sender.tier)}/day. ` +
          `Remaining today: $${remaining.toFixed(2)} USDC.`,
      );
    }

    // 4. Verify PIN
    if (!sender.pinHash) throw new BadRequestException('PIN not set');
    const pinOk = timingSafeEqual(
      Buffer.from(sender.pinHash),
      Buffer.from(params.pinHash),
    );
    if (!pinOk) throw new ForbiddenException('Incorrect PIN');

    // 3. Verify device & device signature
    const device = await this.deviceRepo.findOne({
      where: { deviceId: params.deviceId, userId: senderId, isActive: true },
    });
    if (!device) throw new ForbiddenException('Device not recognised');
    const sigValid = this.blockchainService.verifyDeviceSignature({
      publicKey: device.publicKey,
      signature: params.deviceSignature,
      message: params.deviceId,
    });
    if (!sigValid && !isInsecureDeviceSignatureBypassEnabled(this.config)) {
      throw new ForbiddenException('Invalid device signature');
    }

    // 7. Validate amount
    if (isNaN(amount) || amount < MIN_USDC) {
      throw new BadRequestException(`Minimum send amount is ${MIN_USDC} USDC`);
    }

    // 5a. Trustline guard — external address sends only.
    //     All Cheese Pay users already have a USDC trustline; external wallets may not.
    //     Fail fast here so the transaction never reaches the contract and fails on-chain.
    if (params.type === TxType.SEND_ADDRESS) {
      const hasTrustline = await this.blockchainService.hasUsdcTrustline(
        params.toAddress,
      );
      if (!hasTrustline) {
        throw new BadRequestException(
          "Your destination account isn't set up to receive USDC. " +
            'The recipient needs to add a USDC trustline in their Stellar wallet ' +
            'before you can send to that address.',
        );
      }
    }

    // 5. Check balance and choose send path.
    //    Pre-migration users hold funds in the Soroban contract; users who
    //    deposited via classic Stellar hold funds on Horizon. We read both in
    //    parallel and route to whichever pool covers the requested amount.
    //    Soroban is preferred for user-to-user sends (cheaper, internal);
    //    classic Stellar is the fallback when Soroban balance is insufficient.
    const canUseSoroban =
      !params.memo &&
      this.blockchainService.isSorobanReady &&
      !!sender.username;

    const [sorobanRaw, horizonRaw] = await Promise.all([
      canUseSoroban
        ? this.blockchainService
            .getSorobanBalance(sender.username!)
            .catch(() => '0.0000000')
        : Promise.resolve('0.0000000'),
      this.blockchainService
        .getStellarUsdcBalance(sender.stellarPublicKey)
        .catch(() => '0.0000000'),
    ]);

    const sorobanBal = parseFloat(sorobanRaw);
    const horizonBal = parseFloat(horizonRaw);

    // Use Soroban only when it alone has enough funds; otherwise fall back to
    // classic Stellar so users with Horizon-only balances can still send.
    const useClassic = !canUseSoroban || sorobanBal < amount;
    const availableBal = useClassic ? horizonBal : sorobanBal;

    if (availableBal < amount) {
      throw new BadRequestException('Insufficient USDC balance');
    }

    // Fetch fee rate from on-chain contract (falls back to 0.1% if unavailable)
    const feeRate = await this.getFeeRate();
    const feeUsdc = amount * feeRate;

    // 6. Get NGN equivalent
    const ngnAmount = await this.ratesService.usdcToNgn(amount);
    const rateRecord = await this.ratesService.getCurrentRate();

    // 7. Create pending transaction
    const reference = `CW-SEND-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
    const tx = await this.txService.create({
      userId: senderId,
      type: params.type,
      status: TxStatus.PENDING,
      amountUsdc: params.amountUsdc,
      amountNgn: String(ngnAmount.toFixed(2)),
      feeUsdc: String(feeUsdc.toFixed(6)),
      rateApplied: rateRecord.effectiveRate,
      recipientAddress: params.toAddress,
      recipientUsername: params.recipientUsername || null,
      network: params.network || 'stellar',
      reference,
    });

    try {
      let txHash: string;
      if (useClassic) {
        txHash = await this.blockchainService.sendUsdc({
          fromSecretEnc: sender.stellarSecretEnc,
          toAddress: params.toAddress,
          amountUsdc: params.amountUsdc,
          memo: params.memo ?? reference,
        });
      } else {
        try {
          const result = await this.blockchainService.sendViaContract({
            fromUsername: sender.username,
            fromPublicKey: sender.stellarPublicKey!,
            toUsername: params.recipientUsername,
            toPublicKey: params.recipientUsername ? undefined : params.toAddress,
            amountUsdc: params.amountUsdc,
          });
          txHash = result.txHash;
        } catch (sorobanErr) {
          // The contract's physical USDC token balance can fall below its internal
          // ledger entries (e.g., when users have deposits tracked on-ledger but
          // the corresponding USDC sits in the platform Horizon account).  If the
          // contract can't fulfil the withdrawal, retry via classic Stellar.
          if (horizonBal >= amount) {
            this.logger.warn(
              `sendViaContract failed — falling back to classic Stellar [user=${senderId}]: ${(sorobanErr as Error).message}`,
            );
            txHash = await this.blockchainService.sendUsdc({
              fromSecretEnc: sender.stellarSecretEnc,
              toAddress: params.toAddress,
              amountUsdc: params.amountUsdc,
              memo: params.memo ?? reference,
            });
          } else {
            throw sorobanErr;
          }
        }
      }

      await this.txService.update(tx.id, {
        status: TxStatus.COMPLETED,
        txHash,
      });

      // Fire-and-forget milestone check
      void this.tierMilestone.checkAndNotify(senderId);

      // Fire-and-forget referral qualification (no-op if already qualified)
      void this.referralService
        .qualifyReferral(senderId)
        .catch((e: Error) =>
          this.logger.warn(`qualifyReferral failed [user=${senderId}]: ${e.message}`),
        );

      // Fire-and-forget: email to sender
      const appUrl = this.config.get<string>(
        'app.frontendUrl',
        'https://cheesepay.xyz',
      );
      this.emailService
        .sendMoneySent({
          to: sender.email,
          fullName: sender.fullName,
          amountUsdc: params.amountUsdc,
          amountNgn: String(ngnAmount.toFixed(2)),
          recipientUsername: params.recipientUsername,
          recipientAddress: params.toAddress,
          txHash,
          reference,
          fee: String(feeUsdc.toFixed(6)),
          appUrl,
        })
        .catch((err: Error) =>
          this.logger.error(
            `Sender transfer email failed [tx=${tx.id}]: ${err.message}`,
          ),
        );

      // Record receipt + notify recipient (SEND_USERNAME only — they're a Cheese Pay user)
      if (params.type === TxType.SEND_USERNAME && params.recipientUsername) {
        const recipientUser = await this.userRepo.findOne({
          where: { username: params.recipientUsername },
        });
        if (recipientUser) {
          // Create the recipient's inbound deposit record.
          // Uses createDeposit (ON CONFLICT DO NOTHING) so the wallet scheduler
          // won't create a duplicate when it next polls Horizon for this user.
          const recvRef = `CW-RECV-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
          const recvInserted = await this.txService
            .createDeposit({
              userId: recipientUser.id,
              type: TxType.DEPOSIT,
              status: TxStatus.COMPLETED,
              amountUsdc: params.amountUsdc,
              amountNgn: String(ngnAmount.toFixed(2)),
              feeUsdc: '0.000000',
              rateApplied: rateRecord.effectiveRate,
              txHash,
              network: 'stellar',
              reference: recvRef,
              description: `from @${sender.username ?? 'someone'}`,
            })
            .catch((e: Error) => {
              this.logger.warn(
                `Recipient deposit record failed [tx=${tx.id}]: ${e.message}`,
              );
              return false;
            });

          const senderLabel = sender.username ? `@${sender.username}` : 'someone';

          // Push notification (fire-and-forget)
          void this.notificationsService
            .notifyMoneyReceived(recipientUser.id, params.amountUsdc, senderLabel)
            .catch((err: Error) =>
              this.logger.warn(`Recipient push failed [tx=${tx.id}]: ${err.message}`),
            );

          // Email (fire-and-forget) — only if we were the first to record this
          // deposit. If the wallet scheduler already inserted it (race), it will
          // have sent the email; we must not send a second one.
          if (recvInserted && recipientUser.email) {
            void this.emailService
              .sendMoneyReceived({
                to: recipientUser.email,
                fullName: recipientUser.fullName,
                amountUsdc: params.amountUsdc,
                amountNgn: String(ngnAmount.toFixed(2)),
                txHash,
                network: 'stellar',
                senderName: senderLabel,
                appUrl,
              })
              .catch((err: Error) =>
                this.logger.error(
                  `Recipient transfer email failed [tx=${tx.id}]: ${err.message}`,
                ),
              );
          }
        }
      }

      return this.txService.getById(senderId, tx.id);
    } catch (err) {
      await this.txService.update(tx.id, {
        status: TxStatus.FAILED,
        failureReason: (err as Error).message,
      });
      throw new BadRequestException(
        `Transaction failed: ${(err as Error).message}`,
      );
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  private async getFeeRate(): Promise<number> {
    if (!this.blockchainService.isSorobanReady) return FALLBACK_FEE_RATE;
    try {
      return await this.blockchainService.getContractFeeRate();
    } catch (err) {
      this.logger.warn(
        `Could not read fee_rate from contract — using fallback ${FALLBACK_FEE_RATE}: ${(err as Error).message}`,
      );
      return FALLBACK_FEE_RATE;
    }
  }
}
