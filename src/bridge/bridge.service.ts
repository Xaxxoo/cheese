// src/bridge/bridge.service.ts
//
// Authenticated HTTP client for the Bridge (by Stripe) API.
// Follows the same structural pattern as PulseMfbClient.

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface BridgeTransferResult {
  id: string;
  state: string; // 'pending' | 'in_review' | 'completed' | 'failed' | 'returned'
  amount: string;
  currency: string;
  source_deposit_instructions?: {
    network: string;
    address: string;
    currency: string;
  };
  created_at: string;
  updated_at: string;
}

export interface BridgeExternalAccountResult {
  id: string;
  currency: string;
  account_type: string;
}

export interface BridgeKycLinkResult {
  id: string;
  kyc_link: string;
  customer_id: string;
}

@Injectable()
export class BridgeService implements OnModuleInit {
  private readonly logger = new Logger(BridgeService.name);

  private apiKey = '';
  private baseUrl = '';
  private webhookSecret = '';
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.config.get<string>('bridge.apiKey') ?? '';
    this.baseUrl = (
      this.config.get<string>('bridge.baseUrl') ??
      'https://api.bridge.xyz'
    ).replace(/\/+$/, '');
    this.webhookSecret =
      this.config.get<string>('bridge.webhookSecret') ?? '';

    if (this.apiKey) {
      this.ready = true;
      this.logger.log(
        `Bridge client ready [env=${this.config.get('app.nodeEnv')}] [base=${this.baseUrl}]`,
      );
    } else {
      this.logger.warn(
        'Bridge not configured — set BRIDGE_API_KEY to enable off-ramp for non-Nigeria countries',
      );
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  // ── Public API wrappers ────────────────────────────────────────────────────

  async createKycLink(params: {
    full_name: string;
    email: string;
    type: string;
  }): Promise<BridgeKycLinkResult> {
    this.requireReady('createKycLink');
    return this.post<BridgeKycLinkResult>('/v0/kyc_links', params);
  }

  async createTransfer(params: {
    amount: string;
    on_behalf_of: string;
    source: {
      payment_rail: string;
      currency: string;
      from_address?: string;
    };
    destination: {
      payment_rail: string;
      currency: string;
      external_account_id?: string;
      to_address?: string;
    };
  }): Promise<BridgeTransferResult> {
    this.requireReady('createTransfer');
    return this.post<BridgeTransferResult>('/v0/transfers', params);
  }

  async getTransferStatus(id: string): Promise<BridgeTransferResult> {
    this.requireReady('getTransferStatus');
    return this.get<BridgeTransferResult>(
      `/v0/transfers/${encodeURIComponent(id)}`,
    );
  }

  async createExternalAccount(params: {
    customer_id: string;
    currency: string;
    account_type: string;
    account_details: Record<string, string>;
  }): Promise<BridgeExternalAccountResult> {
    this.requireReady('createExternalAccount');
    return this.post<BridgeExternalAccountResult>(
      '/v0/external_accounts',
      params,
    );
  }

  // ── Webhook signature verification ─────────────────────────────────────────

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'BRIDGE_WEBHOOK_SECRET not set — skipping signature verification',
      );
      return true;
    }
    try {
      const expected = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');
      if (signature.length !== expected.length) return false;
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // ── Internal HTTP helpers ──────────────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Api-Key': this.apiKey,
    };
  }

  private async post<T>(
    path: string,
    body: unknown,
    timeoutMs = 30_000,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.buildHeaders();
    const bodyString = JSON.stringify(body);

    this.logger.log(`Bridge POST ${url}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, path);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `Bridge API timed out after ${timeoutMs / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string, timeoutMs = 20_000): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.buildHeaders();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, path);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `Bridge API timed out after ${timeoutMs / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse<T>(res: Response, path: string): Promise<T> {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg: string =
        ((json as Record<string, unknown>)?.message as string) ||
        `Bridge ${res.status}`;
      this.logger.error(
        `Bridge error [${path}] ${res.status}: ${msg} — body: ${JSON.stringify(json)}`,
      );
      throw new BadRequestException(
        'Bridge transfer failed. Please try again or contact support.',
      );
    }
    return json as T;
  }

  private requireReady(op: string) {
    if (!this.ready) {
      throw new BadRequestException(
        'Bridge payments are not yet available',
      );
    }
  }
}
