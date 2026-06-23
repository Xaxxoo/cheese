// src/private-gateway/private-gateway.service.ts
import * as crypto from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivateInvoice, PrivateInvoiceStatus } from './entities/private-invoice.entity';
import { CreatePrivateInvoiceDto } from './dto';
import { RatesService } from '../rates/rates.service';
import { PulseMfbClient } from '../banks/pulsemfb.client';
import { BlockchainService } from '../blockchain/services/blockchain.service';

@Injectable()
export class PrivateGatewayService {
  private readonly logger = new Logger(PrivateGatewayService.name);

  constructor(
    @InjectRepository(PrivateInvoice)
    private readonly invoiceRepo: Repository<PrivateInvoice>,
    private readonly ratesService: RatesService,
    private readonly pulseMfb: PulseMfbClient,
    private readonly blockchainService: BlockchainService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async createInvoice(dto: CreatePrivateInvoiceDto): Promise<{
    reference: string;
    receivingAddress: string;
    amountUsdc: number;
    expiresAt: Date;
    merchantName: string;
  }> {
    const reference = this.generateReference();
    const expiresInMinutes = dto.expiresInMinutes ?? 60;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Snapshot the NGN rate at creation time (non-fatal if unavailable)
    let amountNgn: string | null = null;
    let rateApplied: string | null = null;
    try {
      const rate = await this.ratesService.getCurrentRate();
      const ngn = dto.amountUsdc * parseFloat(rate.effectiveRate);
      amountNgn = ngn.toFixed(2);
      rateApplied = rate.effectiveRate;
    } catch {
      // Will be recomputed at settlement time
    }

    const invoice = this.invoiceRepo.create({
      reference,
      merchantId: dto.merchantId,
      merchantName: dto.merchantName,
      amountUsdc: dto.amountUsdc.toFixed(6),
      amountNgn,
      rateApplied,
      settlementBankCode: dto.settlementBankCode,
      settlementAccountNumber: dto.settlementAccountNumber,
      settlementAccountName: dto.settlementAccountName,
      settlementBankName: dto.settlementBankName,
      callbackUrl: dto.callbackUrl ?? null,
      expiresAt,
    });

    await this.invoiceRepo.save(invoice);

    let receivingAddress = 'NOT_CONFIGURED';
    try {
      receivingAddress = this.blockchainService.getStellarPlatformPublicKey();
    } catch {
      this.logger.warn('Stellar platform key unavailable — receivingAddress not set');
    }

    this.logger.log(
      `Invoice created [ref=${reference}] [merchant=${dto.merchantId}] [amount=${dto.amountUsdc} USDC]`,
    );

    return { reference, receivingAddress, amountUsdc: dto.amountUsdc, expiresAt, merchantName: dto.merchantName };
  }

  // ── Resolve (public — for Veil wallet QR scan) ────────────────────────────

  async resolveInvoice(reference: string): Promise<{
    id: string;
    merchantName: string;
    amountUsdc: string;
    amountNgn: string | null;
    receivingAddress: string;
    memo: string;
    expiresAt: Date;
    status: PrivateInvoiceStatus;
  }> {
    const invoice = await this.invoiceRepo.findOne({ where: { reference } });
    if (!invoice) throw new NotFoundException(`Invoice ${reference} not found`);

    let receivingAddress = 'NOT_CONFIGURED';
    try {
      receivingAddress = this.blockchainService.getStellarPlatformPublicKey();
    } catch {
      // non-fatal
    }

    return {
      id: invoice.id,
      merchantName: invoice.merchantName,
      amountUsdc: invoice.amountUsdc,
      amountNgn: invoice.amountNgn,
      receivingAddress,
      memo: invoice.reference, // the Stellar text memo the customer must send
      expiresAt: invoice.expiresAt,
      status: invoice.status,
    };
  }

  // ── Status (merchant poll) ────────────────────────────────────────────────

  async getInvoiceStatus(reference: string): Promise<{
    reference: string;
    status: PrivateInvoiceStatus;
    stellarTxHash: string | null;
    settlementReference: string | null;
    failureReason: string | null;
    paidAt: Date | null;
    settledAt: Date | null;
    createdAt: Date;
    expiresAt: Date;
  }> {
    const invoice = await this.invoiceRepo.findOne({ where: { reference } });
    if (!invoice) throw new NotFoundException(`Invoice ${reference} not found`);

    return {
      reference: invoice.reference,
      status: invoice.status,
      stellarTxHash: invoice.stellarTxHash,
      settlementReference: invoice.settlementReference,
      failureReason: invoice.failureReason,
      paidAt: invoice.paidAt,
      settledAt: invoice.settledAt,
      createdAt: invoice.createdAt,
      expiresAt: invoice.expiresAt,
    };
  }

  // ── Called by scheduler — matches hot-wallet payment to open invoice ───────

  async processPlatformPayment(
    txHash: string,
    fromAddress: string,
    amountUsdc: string,
    memo: string,
  ): Promise<void> {
    const reference = memo.trim();
    if (!reference.startsWith('PI-')) return; // not a private gateway payment

    const invoice = await this.invoiceRepo.findOne({ where: { reference } });
    if (!invoice) return; // unknown reference — ignore silently

    if (invoice.status !== PrivateInvoiceStatus.PENDING) {
      this.logger.debug(`Invoice [ref=${reference}] already ${invoice.status} — skipping`);
      return;
    }

    if (invoice.expiresAt < new Date()) {
      this.logger.warn(`Invoice [ref=${reference}] payment received after expiry — ignoring`);
      return;
    }

    const invoicedAmount = parseFloat(invoice.amountUsdc);
    const receivedAmount = parseFloat(amountUsdc);

    if (receivedAmount < invoicedAmount) {
      this.logger.warn(
        `Invoice [ref=${reference}] received ${receivedAmount} USDC < invoiced ${invoicedAmount} USDC — ignoring`,
      );
      return;
    }

    // Atomically claim the invoice to prevent duplicate processing
    const updated = await this.invoiceRepo.update(
      { id: invoice.id, status: PrivateInvoiceStatus.PENDING },
      { status: PrivateInvoiceStatus.PAID, stellarTxHash: txHash, paidAt: new Date() },
    );

    if (!updated.affected) {
      this.logger.debug(`Invoice [ref=${reference}] already claimed by concurrent process`);
      return;
    }

    this.logger.log(
      `Invoice [ref=${reference}] PAID [tx=${txHash}] [from=${fromAddress}] [amount=${amountUsdc} USDC]`,
    );

    const freshInvoice = await this.invoiceRepo.findOneOrFail({ where: { id: invoice.id } });
    await this.settleInvoice(freshInvoice, txHash);
  }

  // ── Settlement ────────────────────────────────────────────────────────────

  async settleInvoice(invoice: PrivateInvoice, _txHash: string): Promise<void> {
    await this.invoiceRepo.update(invoice.id, { status: PrivateInvoiceStatus.SETTLING });

    try {
      // Use rate snapshot from invoice creation; fall back to current rate
      let amountNgn: number;
      if (invoice.amountNgn) {
        amountNgn = parseFloat(invoice.amountNgn);
      } else {
        amountNgn = await this.ratesService.usdcToNgn(parseFloat(invoice.amountUsdc));
      }

      const result = await this.pulseMfb.initiateTransfer({
        debitAccount: this.pulseMfb.platformDebitAccount,
        beneficiaryAccountNumber: invoice.settlementAccountNumber,
        beneficiaryBankCode: invoice.settlementBankCode,
        beneficiaryBankName: invoice.settlementBankName,
        beneficiaryName: invoice.settlementAccountName,
        amount: parseFloat(amountNgn.toFixed(2)),
        narration: `Veil settlement ${invoice.reference}`,
        reference: invoice.reference,
      });

      const settlementRef = result.internal_reference || result.reference;

      await this.invoiceRepo.update(invoice.id, { settlementReference: settlementRef });

      this.logger.log(
        `Invoice [ref=${invoice.reference}] settlement initiated [bankRef=${settlementRef}] [status=${result.status}]`,
      );

      if (result.status === 'completed') {
        await this.markSettled(invoice.id, settlementRef);
      }

      this.fireCallback({ ...invoice, status: PrivateInvoiceStatus.SETTLING }).catch(() => {});
    } catch (err) {
      const reason = (err as Error).message;
      this.logger.error(`Invoice [ref=${invoice.reference}] settlement failed: ${reason}`);
      await this.markFailed(invoice.id, reason);
      const failed = await this.invoiceRepo.findOne({ where: { id: invoice.id } });
      if (failed) this.fireCallback(failed).catch(() => {});
    }
  }

  // ── Called by scheduler after PulseMFB confirms completion ───────────────

  async markSettled(invoiceId: string, bankRef: string): Promise<void> {
    await this.invoiceRepo.update(invoiceId, {
      status: PrivateInvoiceStatus.SETTLED,
      settlementReference: bankRef,
      settledAt: new Date(),
    });

    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (invoice) {
      this.logger.log(`Invoice [ref=${invoice.reference}] SETTLED [bankRef=${bankRef}]`);
      this.fireCallback(invoice).catch(() => {});
    }
  }

  async markFailed(invoiceId: string, reason: string): Promise<void> {
    await this.invoiceRepo.update(invoiceId, {
      status: PrivateInvoiceStatus.FAILED,
      failureReason: reason,
    });
    this.logger.warn(`Invoice [id=${invoiceId}] FAILED: ${reason}`);
  }

  // ── Called by scheduler to poll PulseMFB for settling invoices ────────────

  async checkSettlingInvoices(): Promise<void> {
    if (!this.pulseMfb.isReady) return;

    const settling = await this.invoiceRepo.find({
      where: { status: PrivateInvoiceStatus.SETTLING },
    });

    for (const invoice of settling) {
      if (!invoice.settlementReference) continue;
      try {
        const remote = await this.pulseMfb.getTransferStatus(invoice.settlementReference);
        if (remote.status === 'completed') {
          await this.markSettled(invoice.id, invoice.settlementReference);
        } else if (remote.status === 'failed') {
          await this.markFailed(invoice.id, 'Transfer failed at banking provider');
          const failed = await this.invoiceRepo.findOne({ where: { id: invoice.id } });
          if (failed) this.fireCallback(failed).catch(() => {});
        }
      } catch (err) {
        this.logger.warn(
          `Could not poll settlement [ref=${invoice.reference}]: ${(err as Error).message}`,
        );
      }
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async fireCallback(invoice: Partial<PrivateInvoice>): Promise<void> {
    if (!invoice.callbackUrl) return;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      await fetch(invoice.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: invoice.reference,
          status: invoice.status,
          amountUsdc: invoice.amountUsdc,
          amountNgn: invoice.amountNgn,
          settlementReference: invoice.settlementReference,
          settledAt: invoice.settledAt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      this.logger.log(`Callback fired [ref=${invoice.reference}]`);
    } catch (err) {
      this.logger.warn(`Callback failed [ref=${invoice.reference}]: ${(err as Error).message}`);
    }
  }

  private generateReference(): string {
    const hex = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `PI-${hex}`;
  }
}
