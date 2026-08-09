// src/bridge/bridge-transfer.service.ts
//
// Business-logic layer for Bridge off-ramp transfers (non-Nigeria).
// Follows the same validation + record-creation pattern as BanksService.bankTransfer().

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

import { User, KycStatus } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  TxStatus,
  TxType,
} from '../transactions/entities/transaction.entity';
import {
  BankTransfer,
  BankTransferStatus,
} from '../banks/entities/bank-transfer.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { isInsecureDeviceSignatureBypassEnabled } from '../common/utils/device-signature.util';

import { BridgeService } from './bridge.service';
import { BridgeTransferDto, BridgeWebhookDto } from './dto';
import { getBridgeCountryConfig } from './bridge.config';

@Injectable()
export class BridgeTransferService {
  private readonly logger = new Logger(BridgeTransferService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(BankTransfer)
    private readonly transferRepo: Repository<BankTransfer>,
    private readonly bridgeService: BridgeService,
    private readonly blockchainService: BlockchainService,
    private readonly txService: TransactionsService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ── POST /bridge/transfer ──────────────────────────────────────────────────
  async createTransfer(userId: string, dto: BridgeTransferDto) {
    // 1. Validate country
    const countryConfig = getBridgeCountryConfig(dto.countryCode);
    if (!countryConfig) {
      throw new BadRequestException(
        `Country "${dto.countryCode}" is not supported for Bridge transfers`,
      );
    }

    // 2. Load user
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stellarPublicKey || !user.stellarSecretEnc) {
      throw new BadRequestException('Wallet not initialised');
    }

    // 3. KYC gate — currently uses manual beta verification (kycStatus).
    //    TODO: once Bridge integration is live, also require bridgeCustomerId
    //    for non-Nigeria users:
    //    if (!user.bridgeCustomerId) {
    //      throw new ForbiddenException('Bridge identity verification required.');
    //    }
    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException(
        'Identity verification required before withdrawing. Please complete KYC in your profile.',
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

    // 5. Verify device & device signature
    const device = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId, userId, isActive: true },
    });
    if (!device) throw new ForbiddenException('Device not recognised');

    const sigMessage = this.buildSignatureMessage(userId, dto);
    const sigValid = this.blockchainService.verifyDeviceSignature({
      publicKey: device.publicKey,
      signature: dto.deviceSignature,
      message: sigMessage,
    });
    if (!sigValid && !isInsecureDeviceSignatureBypassEnabled(this.config)) {
      throw new ForbiddenException('Invalid device signature');
    }

    // 6. Validate amount against country limits
    const amountUsdc = parseFloat(dto.amountUsdc);
    if (isNaN(amountUsdc) || amountUsdc < countryConfig.minTransferUsdc) {
      throw new BadRequestException(
        `Minimum transfer is $${countryConfig.minTransferUsdc} USDC`,
      );
    }
    if (amountUsdc > countryConfig.maxTransferUsdc) {
      throw new BadRequestException(
        `Maximum transfer is $${countryConfig.maxTransferUsdc} USDC`,
      );
    }

    // 7. Calculate fee
    const feeUsdc = (
      (amountUsdc * countryConfig.feePercent) /
      100
    ).toFixed(6);
    const totalUsdc = (amountUsdc + parseFloat(feeUsdc)).toFixed(6);

    // 8. Check combined balance (Stellar + EVM)
    const { usdc: stellarUsdcBalance } =
      await this.blockchainService.getStellarBalance(user.stellarPublicKey);
    const stellarBal = parseFloat(stellarUsdcBalance);
    const totalNeeded = parseFloat(totalUsdc);

    let evmBal = 0;
    if (user.evmAddress) {
      evmBal = parseFloat(
        await this.blockchainService.getEvmBalance(user.evmAddress),
      );
    }

    const combinedBalance = stellarBal + evmBal;
    if (combinedBalance < totalNeeded) {
      throw new BadRequestException('Insufficient USDC balance');
    }

    // 9. Generate reference
    const reference = `CW-BRG-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

    // 10–12. Create records and call Bridge API
    //        Wrapped in a single try/catch so DB errors (e.g. missing
    //        migration) return a clean user-facing message instead of
    //        leaking raw Postgres errors.
    let transfer: BankTransfer;
    let tx: { id: string };

    try {
      // 10. Create BankTransfer record with Bridge-specific fields
      transfer = await this.transferRepo.save(
        this.transferRepo.create({
          userId,
          accountNumber: dto.accountIdentifier,
          bankCode: dto.bankCode ?? countryConfig.paymentRail,
          bankName: dto.bankName ?? countryConfig.name,
          accountName: dto.recipientName,
          amountNgn: '0', // Not an NGN transfer
          amountUsdc: totalUsdc,
          feeUsdc,
          rateApplied: '1', // USDC→fiat rate determined by Bridge
          reference,
          status: BankTransferStatus.PENDING,
          provider: 'bridge',
          countryCode: countryConfig.code,
          fiatCurrency: countryConfig.currency,
          stellarAmount: totalUsdc,
        }),
      );

      // 11. Create Transaction record
      tx = await this.txService.create({
        userId,
        type: TxType.BANK_TRANSFER,
        status: TxStatus.PENDING,
        amountUsdc: totalUsdc,
        feeUsdc,
        recipientName: dto.recipientName,
        reference,
        description: `Off-ramp to ${dto.recipientName} — ${countryConfig.name} (${countryConfig.currency})`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to create Bridge transfer records: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException(
        'Bridge payments are temporarily unavailable. Please try again later.',
      );
    }

    // 12. Call Bridge API — gracefully handle "not configured"
    try {
      const bridgeResult = await this.bridgeService.createTransfer({
        amount: dto.amountUsdc,
        on_behalf_of: userId,
        source: {
          payment_rail: 'stellar',
          currency: 'usdc',
          from_address: user.stellarPublicKey,
        },
        destination: {
          payment_rail: countryConfig.paymentRail,
          currency: countryConfig.currency.toLowerCase(),
        },
      });

      // Update with Bridge's transfer ID
      await this.transferRepo.update(transfer.id, {
        bridgeTransferId: bridgeResult.id,
        status: BankTransferStatus.PROCESSING,
      });
      await this.txService.update(tx.id, { status: TxStatus.PENDING });

      return {
        reference,
        status: 'processing',
        amountUsdc: totalUsdc,
        feeUsdc,
        country: countryConfig.name,
        currency: countryConfig.currency,
        message: `Transfer submitted to Bridge. You'll be notified once the payout settles.`,
      };
    } catch (err) {
      // Mark records as failed
      await this.transferRepo.update(transfer.id, {
        status: BankTransferStatus.FAILED,
        failureReason:
          err instanceof Error ? err.message : 'Bridge API error',
      }).catch(() => {});
      await this.txService.update(tx.id, { status: TxStatus.FAILED }).catch(() => {});

      const message =
        err instanceof BadRequestException
          ? (err.getResponse() as { message?: string })?.message ??
            err.message
          : 'Bridge transfer failed';

      throw new BadRequestException(message);
    }
  }

  // ── GET /bridge/transfer/:reference ────────────────────────────────────────
  async syncTransferStatus(userId: string, reference: string) {
    const transfer = await this.transferRepo.findOne({
      where: { userId, reference, provider: 'bridge' },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (
      !transfer.bridgeTransferId ||
      transfer.status === BankTransferStatus.COMPLETED ||
      transfer.status === BankTransferStatus.FAILED
    ) {
      return {
        reference: transfer.reference,
        status: transfer.status,
        synced: false,
      };
    }

    try {
      const bridgeStatus = await this.bridgeService.getTransferStatus(
        transfer.bridgeTransferId,
      );

      const newStatus = this.mapBridgeState(bridgeStatus.state);
      if (newStatus !== transfer.status) {
        await this.transferRepo.update(transfer.id, { status: newStatus });
        await this.txService.updateByReference(reference, {
          status:
            newStatus === BankTransferStatus.COMPLETED
              ? TxStatus.COMPLETED
              : newStatus === BankTransferStatus.FAILED
                ? TxStatus.FAILED
                : TxStatus.PENDING,
        });
      }

      return {
        reference: transfer.reference,
        status: newStatus,
        synced: true,
        amountFiat: bridgeStatus.amount,
        currency: bridgeStatus.currency,
      };
    } catch {
      return {
        reference: transfer.reference,
        status: transfer.status,
        synced: false,
      };
    }
  }

  // ── POST /bridge/webhook ───────────────────────────────────────────────────
  async processWebhook(dto: BridgeWebhookDto) {
    if (dto.event !== 'transfer.updated') {
      this.logger.log(`Bridge webhook ignored: ${dto.event}`);
      return { processed: false };
    }

    const bridgeTransferId = dto.data?.id as string | undefined;
    if (!bridgeTransferId) {
      this.logger.warn('Bridge webhook missing transfer ID');
      return { processed: false };
    }

    const transfer = await this.transferRepo.findOne({
      where: { bridgeTransferId },
    });
    if (!transfer) {
      this.logger.warn(
        `Bridge webhook: no transfer found for bridge ID ${bridgeTransferId}`,
      );
      return { processed: false };
    }

    const state = dto.data?.state as string | undefined;
    if (!state) return { processed: false };

    const newStatus = this.mapBridgeState(state);
    if (newStatus === transfer.status) {
      return { processed: false, reason: 'status unchanged' };
    }

    // Update local records
    await this.transferRepo.update(transfer.id, {
      status: newStatus,
      amountFiat: (dto.data?.amount as string) ?? transfer.amountFiat,
      failureReason:
        newStatus === BankTransferStatus.FAILED
          ? ((dto.data?.failure_reason as string) ?? 'Bridge transfer failed')
          : transfer.failureReason,
    });

    const txStatus =
      newStatus === BankTransferStatus.COMPLETED
        ? TxStatus.COMPLETED
        : newStatus === BankTransferStatus.FAILED
          ? TxStatus.FAILED
          : TxStatus.PENDING;
    await this.txService.updateByReference(transfer.reference, {
      status: txStatus,
    });

    // Send notification
    if (
      newStatus === BankTransferStatus.COMPLETED ||
      newStatus === BankTransferStatus.FAILED
    ) {
      const title =
        newStatus === BankTransferStatus.COMPLETED
          ? 'Transfer completed'
          : 'Transfer failed';
      const body =
        newStatus === BankTransferStatus.COMPLETED
          ? `Your transfer to ${transfer.accountName} has been completed.`
          : `Your transfer to ${transfer.accountName} failed. The USDC will be refunded.`;

      await this.notificationsService
        .create({
          userId: transfer.userId,
          type: NotificationType.MONEY,
          title,
          body,
        })
        .catch((e) => this.logger.warn(`Notification failed: ${e}`));
    }

    return { processed: true, status: newStatus };
  }

  // ── Bridge KYC ──────────────────────────────────────────────────────────
  // Not enforced during beta — users are manually verified. These endpoints
  // let users optionally start Bridge KYC ahead of time. When beta ends,
  // uncomment the bridgeCustomerId check in createTransfer() above.

  async startKyc(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Already has a Bridge customer — return existing state
    if (user.bridgeCustomerId) {
      return {
        status: 'completed',
        bridgeCustomerId: user.bridgeCustomerId,
        message: 'Bridge identity verification already completed.',
      };
    }

    // Already has a pending KYC link
    if (user.bridgeKycLinkId) {
      return {
        status: 'pending',
        bridgeKycLinkId: user.bridgeKycLinkId,
        message:
          'A verification link was already generated. Complete it in your browser.',
      };
    }

    // Create a new KYC link via Bridge
    try {
      const result = await this.bridgeService.createKycLink({
        full_name: user.fullName ?? user.username,
        email: user.email,
        type: 'individual',
      });

      await this.userRepo.update(userId, {
        bridgeKycLinkId: result.id,
        bridgeCustomerId: result.customer_id,
      });

      return {
        status: 'pending',
        kycLink: result.kyc_link,
        bridgeKycLinkId: result.id,
        message:
          'Open this link to complete Bridge identity verification.',
      };
    } catch (err) {
      this.logger.error(
        `Bridge KYC link creation failed for user ${userId}: ${err instanceof Error ? err.message : err}`,
      );
      const message =
        err instanceof BadRequestException
          ? (err.getResponse() as { message?: string })?.message ??
            err.message
          : 'Bridge identity verification is not available right now. Please try again later.';
      throw new BadRequestException(message);
    }
  }

  async getKycStatus(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.bridgeCustomerId) {
      return { status: 'completed', bridgeCustomerId: user.bridgeCustomerId };
    }
    if (user.bridgeKycLinkId) {
      return { status: 'pending', bridgeKycLinkId: user.bridgeKycLinkId };
    }
    return { status: 'none' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private mapBridgeState(state: string): BankTransferStatus {
    switch (state) {
      case 'completed':
        return BankTransferStatus.COMPLETED;
      case 'failed':
      case 'returned':
        return BankTransferStatus.FAILED;
      case 'pending':
      case 'in_review':
      default:
        return BankTransferStatus.PROCESSING;
    }
  }

  private buildSignatureMessage(
    userId: string,
    dto: BridgeTransferDto,
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

    return JSON.stringify({
      action: 'bridge_transfer',
      userId,
      deviceId: dto.deviceId,
      amount: dto.amountUsdc,
      recipient: `${dto.countryCode}:${dto.accountIdentifier}`,
      timestamp: dto.timestamp,
      nonce: dto.nonce,
    });
  }
}
