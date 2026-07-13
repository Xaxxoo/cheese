// src/bills/bills.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { NotificationsService } from '../notifications/notifications.service';
import { FlutterwaveBillsClient } from './flutterwave-bills.client';
import { PayBillDto, VerifyBillCustomerDto } from './dto/pay-bill.dto';
import { isInsecureDeviceSignatureBypassEnabled } from '../common/utils/device-signature.util';

// Small flat fee in USDC for each bill payment
const BILL_PAYMENT_FEE_USDC = '0.02';

function canonicalizeSignaturePayload(payload: Record<string, string>): string {
  const sortedPayload = Object.keys(payload)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
  return JSON.stringify(sortedPayload);
}

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
    private readonly fwClient: FlutterwaveBillsClient,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── GET /bills/billers ──────────────────────────────────────────────────
  async getBillers(category?: string) {
    const billers = await this.fwClient.getBillers('NG');

    if (!category) return billers;

    const cat = category.toLowerCase();
    return billers.filter((b) => {
      const name = (b.name || b.biller_name || '').toLowerCase();
      switch (cat) {
        case 'airtime':
          return b.is_airtime === true;
        case 'data':
          return !b.is_airtime && name.includes('data');
        case 'tv':
          return (
            name.includes('dstv') ||
            name.includes('gotv') ||
            name.includes('startimes') ||
            name.includes('cable')
          );
        case 'electricity':
          return (
            name.includes('electric') ||
            name.includes('disco') ||
            name.includes('power')
          );
        default:
          return true;
      }
    });
  }

  // ── GET /bills/variations ─────────────────────────────────────────────────
  async getVariations(serviceId: string) {
    const items = await this.fwClient.getBillerItems(serviceId);
    const variations = items.map((item) => ({
      variation_code: item.item_code,
      name: item.name,
      variation_amount: String(item.amount),
      fixedPrice: item.amount > 0 ? 'Yes' : 'No',
    }));
    return { serviceId, variations };
  }

  // ── POST /bills/verify ────────────────────────────────────────────────────
  async verifyCustomer(dto: VerifyBillCustomerDto) {
    // Flutterwave requires an item_code to validate a customer.
    // If the frontend didn't supply variationCode, auto-fetch the first biller item.
    let itemCode = dto.variationCode;
    if (!itemCode) {
      const items = await this.fwClient.getBillerItems(dto.serviceId);
      if (!items.length) {
        throw new BadRequestException(
          'No items found for this biller. Please check the service ID.',
        );
      }
      itemCode = items[0].item_code;
    }

    const result = await this.fwClient.validateCustomer(
      dto.serviceId,
      itemCode,
      dto.billersCode,
    );

    if (result.status !== 'success') {
      throw new BadRequestException(
        'Could not verify customer. Please check the details and try again.',
      );
    }

    return {
      verified: true,
      customerName: result.data?.name ?? null,
      details: result.data,
    };
  }

  // ── POST /bills/pay ───────────────────────────────────────────────────────
  async payBill(userId: string, dto: PayBillDto) {
    // 1. Load user
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stellarPublicKey || !user.stellarSecretEnc) {
      throw new BadRequestException('Wallet not initialised');
    }

    // 2. Verify PIN
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

    const sigMessage = this.buildSignatureMessage(userId, dto);
    const sigValid = this.blockchainService.verifyDeviceSignature({
      publicKey: device.publicKey,
      signature: dto.deviceSignature,
      message: sigMessage,
    });
    if (!sigValid && !isInsecureDeviceSignatureBypassEnabled(this.config)) {
      throw new ForbiddenException('Invalid device signature');
    }

    // 4. Determine NGN amount
    const amountNgn = this.resolveAmountNgn(dto);
    if (isNaN(amountNgn) || amountNgn <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    // 5. Convert NGN → USDC and add fee
    const rate = await this.ratesService.getCurrentRate();
    const effectiveRate = parseFloat(rate.effectiveRate);
    const amountUsdc = (
      amountNgn / effectiveRate +
      parseFloat(BILL_PAYMENT_FEE_USDC)
    ).toFixed(6);

    // 6. Check USDC balance
    const { usdc: usdcBalance } =
      await this.blockchainService.getStellarBalance(user.stellarPublicKey);
    if (parseFloat(usdcBalance) < parseFloat(amountUsdc)) {
      throw new BadRequestException('Insufficient USDC balance');
    }

    // 7. Create PENDING transaction record
    const reference = `CW-BILL-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
    const tx = await this.txService.create({
      userId,
      type: TxType.BILL_PAYMENT,
      status: TxStatus.PENDING,
      amountUsdc,
      amountNgn: amountNgn.toString(),
      feeUsdc: BILL_PAYMENT_FEE_USDC,
      rateApplied: rate.effectiveRate,
      reference,
      description: `Bill payment — ${dto.serviceId}`,
    });

    // 8. Deduct USDC
    let stellarTxHash: string;
    try {
      stellarTxHash = await this.blockchainService.platformWithdrawUsdc(
        user.stellarSecretEnc,
        amountUsdc,
        reference,
      );
      await this.txService.update(tx.id, { txHash: stellarTxHash });
    } catch (err) {
      await this.txService.update(tx.id, {
        status: TxStatus.FAILED,
        failureReason: (err as Error).message,
      });
      throw new BadRequestException(
        `USDC debit failed: ${(err as Error).message}`,
      );
    }

    // 9. Call Flutterwave Bills
    try {
      // Map frontend field names to Flutterwave field names:
      //   serviceId    → biller_code
      //   billersCode  → customer_id
      //   variationCode → item_code
      const itemCode = dto.variationCode || dto.serviceId;
      const fwResult = await this.fwClient.pay({
        biller_code: dto.serviceId,
        item_code: itemCode,
        customer_id: dto.billersCode,
        amount: dto.amount ?? amountNgn.toString(),
        country: 'NG',
        reference,
      });

      if (fwResult.status !== 'success') {
        throw new Error(fwResult.message ?? 'Bill payment failed');
      }

      await this.txService.update(tx.id, { status: TxStatus.COMPLETED });
      this.logger.log(
        `Bill payment completed [ref=${reference}] [service=${dto.serviceId}] [fw_ref=${fwResult.data?.flw_ref ?? ''}]`,
      );

      // Fire-and-forget notification
      void this.notificationsService
        .notifyTransactionComplete(userId, reference, amountUsdc)
        .catch((e: Error) =>
          this.logger.warn(
            `Bill payment notification failed [ref=${reference}]: ${e.message}`,
          ),
        );

      return {
        reference,
        status: 'completed',
        message: 'Bill payment successful.',
        serviceId: dto.serviceId,
        billersCode: dto.billersCode,
        amountNgn: amountNgn.toString(),
        amountUsdc,
        rateApplied: rate.effectiveRate,
        fee: BILL_PAYMENT_FEE_USDC,
        providerReference: fwResult.data?.flw_ref ?? '',
        purchasedCode: fwResult.data?.token ?? null,
        stellarTxHash,
      };
    } catch (err) {
      const errMsg = (err as Error).message ?? '';
      this.logger.error(
        `Flutterwave payment failed for ${reference} — refunding USDC: ${errMsg}`,
      );

      // Refund USDC
      await this.refundUsdc({
        userId,
        toPublicKey: user.stellarPublicKey,
        amountUsdc,
        reference,
        reason: errMsg,
      });

      await this.txService.update(tx.id, {
        status: TxStatus.FAILED,
        failureReason: `Bill payment failed — USDC refunded. ${errMsg}`,
      });

      throw new BadRequestException(
        `Bill payment failed: ${errMsg}. Your USDC has been refunded.`,
      );
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resolveAmountNgn(dto: PayBillDto): number {
    if (dto.amount) {
      return parseFloat(dto.amount);
    }
    // For data/tv with a variation, we'd need to look up the variation amount.
    // The client must supply amount for all bill types.
    throw new BadRequestException('Amount is required');
  }

  private buildSignatureMessage(userId: string, dto: PayBillDto): string {
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
      action: 'bill_payment',
      amount: dto.amount ?? '',
      nonce: dto.nonce!,
      recipient: dto.billersCode,
      serviceId: dto.serviceId,
      timestamp: dto.timestamp!,
      userId,
    });
  }

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
      this.logger.error(
        `[CRITICAL] USDC refund FAILED — MANUAL ACTION REQUIRED ` +
          `[user=${opts.userId}] [amount=${opts.amountUsdc}] [ref=${opts.reference}]: ` +
          (err as Error).message,
      );
    }
  }
}
