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
      { account_number: accountNumber, bank_code: bankCode },
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

    return {
      'Content-Type': 'application/json',
      'x-public-key': this.publicKey,
      'x-signature': signature,
      'x-timestamp': timestamp,
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    this.requireReady(path);
    const headers = this.buildHeaders('POST', path, body);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res, path);
  }

  private async get<T>(path: string): Promise<T> {
    this.requireReady(path);
    const headers = this.buildHeaders('GET', path, null);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<T>(res, path);
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
