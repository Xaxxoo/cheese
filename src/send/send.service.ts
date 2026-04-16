// src/send/send.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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

const PLATFORM_FEE_PCT = 0.001; // 0.1%
const MIN_USDC = 0.01;

@Injectable()
export class SendService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    private readonly blockchainService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
    private readonly config: ConfigService,
    private readonly tierMilestone: TierMilestoneService,
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

  // ── POST /send/address ────────────────────────────────────
  async sendToAddress(senderId: string, dto: SendToAddressDto) {
    return this.executeSend(senderId, {
      toAddress: dto.address,
      amountUsdc: dto.amountUsdc,
      pinHash: dto.pinHash,
      deviceId: dto.deviceId,
      deviceSignature: dto.deviceSignature,
      network: dto.network,
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
    if (!sigValid && this.config.get('app.nodeEnv') === 'production') {
      throw new ForbiddenException('Invalid device signature');
    }

    // 7. Validate amount
    if (isNaN(amount) || amount < MIN_USDC) {
      throw new BadRequestException(`Minimum send amount is ${MIN_USDC} USDC`);
    }

    // 5. Check balance
    const balance = await this.blockchainService.getUsdcBalance(
      sender.stellarPublicKey,
    );
    const feeUsdc = amount * PLATFORM_FEE_PCT;
    const totalRequired = amount + feeUsdc;
    if (parseFloat(balance.usdc) < totalRequired) {
      throw new BadRequestException('Insufficient USDC balance');
    }

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

    // 8. Execute on-chain
    try {
      const txHash = await this.blockchainService.sendUsdc({
        fromSecretEnc: sender.stellarSecretEnc,
        toAddress: params.toAddress,
        amountUsdc: params.amountUsdc,
        memo: reference,
      });

      await this.txService.update(tx.id, {
        status: TxStatus.COMPLETED,
        txHash,
      });

      // Fire-and-forget milestone check
      void this.tierMilestone.checkAndNotify(senderId);

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
}
