// src/banks/pulsemfb.client.ts
//
// Authenticated HTTP client for the PulseMFB External API.
//
// Authentication:
//   Every request is signed with HMAC-SHA256 using the private key.
//   Signature payload: timestamp + METHOD + /api/v1/external-api/path + bodyJson
//   Headers: x-public-key, x-signature, x-timestamp
//
// The repo includes PulseMFB's Postman collection, which documents the
// public base URL as https://api.pulsemfb.com and the external API paths
// under /api/v1/external-api.

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

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
  beneficiary_account?: string;
  credit_account?: string;
  status: string; // "completed" | "pending" | "failed"
  created_at: string;
}

export interface PulseMfbTransferStatus extends PulseMfbTransferResult {
  completed_at?: string;
}

@Injectable()
export class PulseMfbClient implements OnModuleInit {
  private readonly logger = new Logger(PulseMfbClient.name);
  private readonly apiBasePath = '/api/v1/external-api';

  private baseUrl!: string;
  private publicKey!: string;
  private privateKey!: string;
  private debitAccount!: string;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const configuredBaseUrl =
      this.config.get<string>('pulsemfb.baseUrl') ??
      'https://api.pulsemfb.com';

    this.baseUrl = this.normalizeBaseUrl(configuredBaseUrl);
    this.publicKey = this.config.get<string>('pulsemfb.publicKey') ?? '';
    this.privateKey = this.config.get<string>('pulsemfb.privateKey') ?? '';
    this.debitAccount = this.config.get<string>('pulsemfb.debitAccount') ?? '';

    if (this.publicKey && this.privateKey) {
      this.ready = true;
      this.logger.log(
        `PulseMFB client ready [env=${this.config.get('app.nodeEnv')}] ` +
          `[account=${this.debitAccount || 'not-configured'}] ` +
          `[base=${this.baseUrl}${this.apiBasePath}]`,
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

  async nameEnquiry(
    accountNumber: string,
    bankCode: string,
  ): Promise<PulseMfbNameEnquiryResult> {
    const data = await this.post<{ data: PulseMfbNameEnquiryResult }>(
      '/transfers/name-enquiry',
      { accountNumber, bankCode },
    );
    return data.data;
  }

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
    this.logger.log(
      `PulseMFB transfer request [ref=${params.reference}] ` +
        `[bankCode=${params.beneficiaryBankCode}] ` +
        `[bankName=${params.beneficiaryBankName}] ` +
        `[account=${params.beneficiaryAccountNumber}]`,
    );

    const data = await this.post<{ data: PulseMfbTransferResult }>(
      '/transfers',
      {
        debit_account_number: params.debitAccount,
        beneficiary_account_number: params.beneficiaryAccountNumber,
        beneficiary_bank_code: params.beneficiaryBankCode,
        beneficiary_bank_name: params.beneficiaryBankName,
        beneficiary_name: params.beneficiaryName,
        amount: params.amount,
        narration: params.narration,
        reference: params.reference,
      },
    );
    return data.data;
  }

  async getTransferStatus(reference: string): Promise<PulseMfbTransferStatus> {
    const data = await this.get<{ data: PulseMfbTransferStatus }>(
      `/transfers/${encodeURIComponent(reference)}`,
    );
    return data.data;
  }

  // PulseMFB sends X-Webhook-Signature: HMAC-SHA256(webhookSecret, rawBody)
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.get<string>('pulsemfb.webhookSecret');
    if (!secret) {
      this.logger.warn(
        'PULSE_MFB_WEBHOOK_SECRET not set — skipping signature verification',
      );
      return true;
    }
    try {
      const expected = createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      // timingSafeEqual requires equal-length buffers — guard first
      if (signature.length !== expected.length) return false;
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/$/, '');
    if (trimmed.endsWith(this.apiBasePath)) {
      return trimmed.slice(0, -this.apiBasePath.length);
    }
    return trimmed;
  }

  private buildRequestPath(path: string): string {
    if (path.startsWith(this.apiBasePath)) {
      return path;
    }
    return `${this.apiBasePath}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private buildHeaders(
    method: string,
    requestPath: string,
    body: unknown,
  ): Record<string, string> {
    const timestamp = Date.now().toString();
    const bodyString = body ? JSON.stringify(body) : '';
    const sigPayload =
      timestamp + method.toUpperCase() + requestPath + bodyString;
    const signature = createHmac('sha256', this.privateKey)
      .update(sigPayload)
      .digest('hex');

    this.logger.log(
      `PulseMFB sig payload [${method} ${requestPath}]: ` +
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

  private async post<T>(
    path: string,
    body: unknown,
    timeoutMs = 30_000,
  ): Promise<T> {
    this.requireReady(path);
    const requestPath = this.buildRequestPath(path);
    const fullUrl = `${this.baseUrl}${requestPath}`;
    const bodyString = JSON.stringify(body);
    const headers = this.buildHeaders('POST', requestPath, body);

    this.logger.log(`PulseMFB POST ${fullUrl} body=${bodyString}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, requestPath);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `Banking provider timed out after ${timeoutMs / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string, timeoutMs = 30_000): Promise<T> {
    this.requireReady(path);
    const requestPath = this.buildRequestPath(path);
    const headers = this.buildHeaders('GET', requestPath, null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${requestPath}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, requestPath);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `Banking provider timed out after ${timeoutMs / 1000}s`,
        );
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
