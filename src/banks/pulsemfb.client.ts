// src/banks/pulsemfb.client.ts
//
// Authenticated HTTP client for the PulseMFB External API.
//
// Authentication:
//   Every request is signed with HMAC-SHA256 using the private key.
//   Signature payload: timestamp + METHOD + /path + bodyJson
//   Headers: x-public-key, x-signature, x-timestamp
//
// Docs: https://documenter.getpostman.com/view/7118903/2sBXVhDqmZ
//

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Response shapes (trimmed to what we actually use)
// ─────────────────────────────────────────────────────────────────────────────

export interface PulseMfbNameEnquiryResult {
  responseCode: string; // "00" = success
  accountName: string;
  accountNumber: string;
  bankCode: string | null;
  responseMessage: string;
}

export interface PulseMfbTransferResult {
  reference: string;
  internal_reference: string;
  amount: number;
  debit_account: string;
  beneficiary_account: string;
  status: string; // "completed" | "pending" | "failed"
  created_at: string;
}

export interface PulseMfbTransferStatus extends PulseMfbTransferResult {
  completed_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PulseMfbClient implements OnModuleInit {
  private readonly logger = new Logger(PulseMfbClient.name);

  private baseUrl: string;
  private publicKey: string;
  private privateKey: string;
  private debitAccount: string;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.baseUrl = this.config.get<string>('pulsemfb.baseUrl')!;
    this.publicKey = this.config.get<string>('pulsemfb.publicKey') ?? '';
    this.privateKey = this.config.get<string>('pulsemfb.privateKey') ?? '';
    this.debitAccount = this.config.get<string>('pulsemfb.debitAccount') ?? '';

    if (this.publicKey && this.privateKey) {
      this.ready = true;
      this.logger.log(
        `PulseMFB client ready [env=${this.config.get('app.nodeEnv')}] [account=${this.debitAccount || 'not-configured'}]`,
      );
      if (!this.debitAccount) {
        this.logger.warn(
          'PULSE_MFB_DEBIT_ACCOUNT not set — account resolution and status lookups will work, but transfer initiation is disabled',
        );
      }
    } else {
      this.logger.warn(
        'PulseMFB not configured — set PULSE_MFB_PUBLIC_KEY and PULSE_MFB_PRIVATE_KEY',
      );
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  get platformDebitAccount(): string {
    if (!this.debitAccount) {
      throw new BadRequestException(
        'Banking provider transfer account not configured',
      );
    }
    return this.debitAccount;
  }

  // ── Name Enquiry ────────────────────────────────────────────────────────────
  async nameEnquiry(
    accountNumber: string,
    bankCode: string,
  ): Promise<PulseMfbNameEnquiryResult> {
    const data = await this.post<{ data: PulseMfbNameEnquiryResult }>(
      '/api/v1/external-api/transfers/name-enquiry',
      { accountNumber, bankCode },
      15_000,
    );
    return data.data;
  }

  // ── Initiate Transfer ───────────────────────────────────────────────────────
  async initiateTransfer(params: {
    debitAccount: string;
    beneficiaryAccountNumber: string;
    beneficiaryBankCode: string;
    beneficiaryBankName: string;
    beneficiaryName: string;
    amount: number;
    narration: string;
    reference: string;
  }): Promise<PulseMfbTransferResult> {
    const beneficiaryBankName = params.beneficiaryBankName.trim();
    if (!beneficiaryBankName) {
      throw new BadRequestException(
        'Beneficiary bank name could not be determined for this transfer',
      );
    }

    this.logger.log(
      `PulseMFB transfer request [ref=${params.reference}] ` +
        `[bankCode=${params.beneficiaryBankCode}] ` +
        `[bankName=${beneficiaryBankName}]`,
    );

    const data = await this.post<{ data: PulseMfbTransferResult }>(
      '/api/v1/external-api/transfers',
      {
        debit_account_number: params.debitAccount,
        beneficiary_account_number: params.beneficiaryAccountNumber,
        beneficiary_bank_code: params.beneficiaryBankCode,
        beneficiary_bank_name: beneficiaryBankName,
        beneficiary_name: params.beneficiaryName,
        amount: params.amount,
        narration: params.narration,
        reference: params.reference,
      },
    );
    return data.data;
  }

  // ── Get Transfer Status ─────────────────────────────────────────────────────
  async getTransferStatus(reference: string): Promise<PulseMfbTransferStatus> {
    const data = await this.get<{ data: PulseMfbTransferStatus }>(
      `/api/v1/external-api/transfers/${encodeURIComponent(reference)}`,
    );
    return data.data;
  }

  // ── Verify inbound webhook signature ───────────────────────────────────────
  // PulseMFB sends X-Webhook-Signature: HMAC-SHA256(webhookSecret, body)
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.get<string>('pulsemfb.webhookSecret');
    if (!secret) {
      this.logger.warn(
        'PULSE_MFB_WEBHOOK_SECRET not set — skipping signature verification',
      );
      return true; // allow through in unconfigured dev env
    }
    try {
      const expected = createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private HTTP helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildHeaders(
    method: string,
    path: string,
    body: unknown,
  ): Record<string, string> {
    const timestamp = Date.now().toString();
    const bodyString = body ? JSON.stringify(body) : '';
    const sigPayload = timestamp + method.toUpperCase() + path + bodyString;
    const signature = createHmac('sha256', this.privateKey)
      .update(sigPayload)
      .digest('hex');

    this.logger.log(
      `PulseMFB sig payload [${method} ${path}]: ` +
        `timestamp=${timestamp} bodyLen=${bodyString.length} ` +
        `payload="${sigPayload.slice(0, 120)}..."`,
    );

    return {
      'Content-Type': 'application/json',
      'x-public-key': this.publicKey,
      'x-signature': signature,
      'x-timestamp': timestamp,
    };
  }

  private async post<T>(path: string, body: unknown, timeoutMs = 30_000): Promise<T> {
    this.requireReady(path);
    // Strip trailing slash from baseUrl to avoid double-slash in URL
    const base = this.baseUrl.replace(/\/$/, '');
    const fullUrl = `${base}${path}`;
    const bodyString = JSON.stringify(body);
    const headers = this.buildHeaders('POST', path, body);

    this.logger.log(
      `PulseMFB POST ${fullUrl} body=${bodyString}`,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, path);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(`Banking provider timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string, timeoutMs = 30_000): Promise<T> {
    this.requireReady(path);
    const base = this.baseUrl.replace(/\/$/, '');
    const headers = this.buildHeaders('GET', path, null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, path);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(`Banking provider timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse<T>(res: Response, path: string): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg: string =
        ((json as Record<string, unknown>)?.message as string) ||
        ((json as Record<string, unknown>)?.responseMessage as string) ||
        `PulseMFB ${res.status}`;
      this.logger.error(
        `PulseMFB error [${path}] ${res.status}: ${msg} — body: ${JSON.stringify(json)}`,
      );
      throw new BadRequestException(`Banking provider error: ${msg}`);
    }
    return json as T;
  }

  private requireReady(op: string) {
    if (!this.ready) {
      throw new BadRequestException(
        `Banking provider not configured — cannot perform: ${op}`,
      );
    }
  }
}
