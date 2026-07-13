// src/bills/flutterwave-bills.client.ts
//
// Authenticated HTTP client for the Flutterwave Bills API.
//
// Authentication:
//   OAuth2 client_credentials flow. Bearer token is cached and
//   refreshed 60s before expiry. A promise-based mutex prevents
//   concurrent token requests.

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ── Response shapes ──────────────────────────────────────────

export interface FwBiller {
  id: number;
  biller_code: string;
  name: string;
  default_commission: number;
  country: string;
  is_airtime: boolean;
  biller_name: string;
  item_code: string;
  short_name: string;
  fee: number;
  commission_on_fee: boolean;
  label_name: string;
  amount: number;
}

export interface FwBillerItem {
  id: number;
  biller_code: string;
  name: string;
  is_airtime: boolean;
  biller_name: string;
  item_code: string;
  amount: number;
  fee: number;
  label_name: string;
  short_name: string;
}

export interface FwValidateResponse {
  status: string;
  message: string;
  data: {
    response_code: string;
    address: string | null;
    response_message: string;
    name: string;
    biller_code: string;
    customer: string;
    product_code: string;
    email: string | null;
    fee: number;
    maximum: number;
    minimum: number;
  };
}

export interface FwPaymentResponse {
  status: string;
  message: string;
  data: {
    phone_number: string;
    amount: number;
    network: string;
    flw_ref: string;
    tx_ref: string;
    reference: string;
    token?: string;
    extra?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface FwPaymentStatusResponse {
  status: string;
  message: string;
  data: {
    currency: string;
    customer_id: string;
    frequency: string;
    amount: string;
    product: string;
    product_name: string;
    commission: number;
    transaction_date: string;
    country: string;
    tx_ref: string;
    extra: Record<string, unknown> | null;
    product_details: string | null;
    status: string;
    [key: string]: unknown;
  };
}

// ── Client ────────────────────────────────────────────────────

@Injectable()
export class FlutterwaveBillsClient implements OnModuleInit {
  private readonly logger = new Logger(FlutterwaveBillsClient.name);

  private baseUrl!: string;
  private clientId!: string;
  private clientSecret!: string;
  private callbackUrl!: string;
  private ready = false;

  // OAuth2 token state
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.baseUrl = (
      this.config.get<string>('flutterwaveBills.baseUrl') ??
      'https://api.flutterwave.com'
    ).replace(/\/$/, '');
    this.clientId =
      this.config.get<string>('flutterwaveBills.clientId') ?? '';
    this.clientSecret =
      this.config.get<string>('flutterwaveBills.clientSecret') ?? '';
    this.callbackUrl =
      this.config.get<string>('flutterwaveBills.callbackUrl') ?? '';

    if (this.clientId && this.clientSecret) {
      this.ready = true;
      this.logger.log(
        `Flutterwave Bills client ready [base=${this.baseUrl}]`,
      );
    } else {
      this.logger.warn(
        'Flutterwave Bills not configured — set FLUTTERWAVE_BILLS_CLIENT_ID and FLUTTERWAVE_BILLS_CLIENT_SECRET',
      );
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  // ── Public methods ─────────────────────────────────────────

  async getBillers(country?: string): Promise<FwBiller[]> {
    const params = new URLSearchParams();
    if (country) params.set('country', country);
    const qs = params.toString();
    const data = await this.get<{ status: string; message: string; data: FwBiller[] }>(
      `/v3/billers${qs ? `?${qs}` : ''}`,
    );
    return data.data ?? [];
  }

  async getBillerItems(billerCode: string): Promise<FwBillerItem[]> {
    const data = await this.get<{ status: string; message: string; data: FwBillerItem[] }>(
      `/v3/billers/${encodeURIComponent(billerCode)}/items`,
    );
    return data.data ?? [];
  }

  async validateCustomer(
    billerCode: string,
    itemCode: string,
    customer: string,
  ): Promise<FwValidateResponse> {
    return this.get<FwValidateResponse>(
      `/v3/billers/${encodeURIComponent(billerCode)}/items/${encodeURIComponent(itemCode)}/validate?customer=${encodeURIComponent(customer)}`,
    );
  }

  async pay(payload: {
    biller_code: string;
    item_code: string;
    customer_id: string;
    amount: string;
    country: string;
    reference: string;
    callback_url?: string;
  }): Promise<FwPaymentResponse> {
    const body = {
      ...payload,
      callback_url: payload.callback_url || this.callbackUrl,
    };
    return this.post<FwPaymentResponse>(
      `/v3/billers/${encodeURIComponent(payload.biller_code)}/items/${encodeURIComponent(payload.item_code)}/payment`,
      body,
    );
  }

  async getPaymentStatus(reference: string): Promise<FwPaymentStatusResponse> {
    return this.get<FwPaymentStatusResponse>(
      `/v3/bills/${encodeURIComponent(reference)}`,
    );
  }

  // ── OAuth2 token management ────────────────────────────────

  private async ensureToken(): Promise<void> {
    // Still valid for at least 60s
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return;
    }
    // Another call is already refreshing — wait for it
    if (this.tokenPromise) {
      await this.tokenPromise;
      return;
    }
    this.tokenPromise = this.refreshToken();
    try {
      await this.tokenPromise;
    } finally {
      this.tokenPromise = null;
    }
  }

  private async refreshToken(): Promise<void> {
    const url = `${this.baseUrl}/v3/oauth/token`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        }),
        signal: controller.signal,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(
          `OAuth token request failed [${res.status}]: ${JSON.stringify(json)}`,
        );
        throw new BadRequestException(
          'Bill payment provider authentication failed. Please try again later.',
        );
      }
      const body = json as { access_token?: string; expires_in?: number };
      if (!body.access_token) {
        throw new BadRequestException(
          'Bill payment provider returned invalid token response.',
        );
      }
      this.accessToken = body.access_token;
      // Default to 1h if expires_in missing
      const expiresInMs = (body.expires_in ?? 3600) * 1000;
      this.tokenExpiresAt = Date.now() + expiresInMs;
      this.logger.log('Flutterwave OAuth token refreshed');
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          'Bill payment provider token request timed out.',
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── HTTP helpers ───────────────────────────────────────────

  private async buildHeaders(): Promise<Record<string, string>> {
    await this.ensureToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  private async get<T>(path: string, timeoutMs = 30_000): Promise<T> {
    this.requireReady(path);
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = await this.buildHeaders();
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
      if (err instanceof BadRequestException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `Bill payment provider timed out after ${timeoutMs / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(
    path: string,
    body: unknown,
    timeoutMs = 30_000,
  ): Promise<T> {
    this.requireReady(path);
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = await this.buildHeaders();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, path);
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `Bill payment provider timed out after ${timeoutMs / 1000}s`,
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
        `Flutterwave ${res.status}`;
      this.logger.error(
        `Flutterwave error [${path}] ${res.status}: ${msg} — body: ${JSON.stringify(json)}`,
      );
      throw new BadRequestException(
        'Bill payment provider is temporarily unavailable. Please try again.',
      );
    }
    const body = json as { status?: string };
    if (body.status && body.status !== 'success') {
      this.logger.error(
        `Flutterwave non-success [${path}]: ${JSON.stringify(json)}`,
      );
      throw new BadRequestException(
        'Bill payment provider returned an error. Please try again.',
      );
    }
    return json as T;
  }

  private requireReady(op: string) {
    if (!this.ready) {
      throw new BadRequestException(
        `Bill payment provider not configured — cannot perform: ${op}`,
      );
    }
  }
}
