// src/bills/vtpass.client.ts
//
// Authenticated HTTP client for the VTPass API.
//
// Authentication:
//   Every request includes 'api-key' and 'secret-key' headers.
//
// VTPass sandbox: https://sandbox.vtpass.com/api
// VTPass live:    https://vtpass.com/api

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VtpassVariation {
  variation_code: string;
  name: string;
  variation_amount: string;
  fixedPrice: string;
}

export interface VtpassVariationsResponse {
  content: {
    varations?: VtpassVariation[];
    variations?: VtpassVariation[];
  };
}

export interface VtpassVerifyResponse {
  content: {
    Customer_Name?: string;
    customerName?: string;
    Meter_Number?: string;
    Address?: string;
    [key: string]: unknown;
  };
  code: string;
}

export interface VtpassPayResponse {
  code: string;
  response_description: string;
  requestId: string;
  amount: string;
  transaction_date?: { date: string };
  purchased_code?: string;
  token?: string;
  content?: {
    transactions?: {
      status: string;
      type: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

@Injectable()
export class VtpassClient implements OnModuleInit {
  private readonly logger = new Logger(VtpassClient.name);

  private baseUrl!: string;
  private apiKey!: string;
  private secretKey!: string;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.baseUrl = (
      this.config.get<string>('vtpass.baseUrl') ??
      'https://sandbox.vtpass.com/api'
    ).replace(/\/$/, '');
    this.apiKey = this.config.get<string>('vtpass.apiKey') ?? '';
    this.secretKey = this.config.get<string>('vtpass.secretKey') ?? '';

    if (this.apiKey && this.secretKey) {
      this.ready = true;
      this.logger.log(
        `VTPass client ready [base=${this.baseUrl}]`,
      );
    } else {
      this.logger.warn(
        'VTPass not configured — set VTPASS_API_KEY and VTPASS_SECRET_KEY',
      );
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  async getVariations(serviceId: string): Promise<VtpassVariation[]> {
    const data = await this.get<VtpassVariationsResponse>(
      `/service-variations?serviceID=${encodeURIComponent(serviceId)}`,
    );
    // VTPass inconsistently uses "varations" (typo) and "variations"
    const list =
      data.content?.variations ?? data.content?.varations ?? [];
    return list;
  }

  async verifyCustomer(
    serviceId: string,
    billersCode: string,
  ): Promise<VtpassVerifyResponse> {
    return this.post<VtpassVerifyResponse>('/merchant-verify', {
      serviceID: serviceId,
      billersCode,
    });
  }

  async pay(payload: {
    request_id: string;
    serviceID: string;
    billersCode: string;
    variation_code?: string;
    amount?: string;
    phone: string;
  }): Promise<VtpassPayResponse> {
    return this.post<VtpassPayResponse>('/pay', payload);
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
      'secret-key': this.secretKey,
    };
  }

  private async get<T>(path: string, timeoutMs = 30_000): Promise<T> {
    this.requireReady(path);
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, path);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `VTPass timed out after ${timeoutMs / 1000}s`,
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
    const bodyString = JSON.stringify(body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: bodyString,
        signal: controller.signal,
      });
      return this.handleResponse<T>(res, path);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException(
          `VTPass timed out after ${timeoutMs / 1000}s`,
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
        ((json as Record<string, unknown>)?.response_description as string) ||
        ((json as Record<string, unknown>)?.message as string) ||
        `VTPass ${res.status}`;
      this.logger.error(
        `VTPass error [${path}] ${res.status}: ${msg} — body: ${JSON.stringify(json)}`,
      );
      throw new BadRequestException(
        'Bill payment provider is temporarily unavailable. Please try again.',
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
