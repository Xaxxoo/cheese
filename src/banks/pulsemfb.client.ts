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
// Bank codes:
//   PulseMFB uses its OWN internal bank codes, NOT the NIBSS NIP codes
//   used by most Nigerian apps.  We seed a known-good mapping below and
//   supplement it by fetching PulseMFB's /banks list at startup.
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

interface PulseMfbBankEntry {
  code: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed mapping: NIBSS NIP code → PulseMFB internal code
// Add entries here as you discover them from PulseMFB's portal/docs.
// The dynamic bank list fetch (onModuleInit) will cover the rest.
// ─────────────────────────────────────────────────────────────────────────────
const NIBSS_TO_PULSEMFB: Record<string, string> = {
  '058': '100',         // GTBank  (Guaranty Trust Bank)
  '999992': '1200014',  // OPay
};

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PulseMfbClient implements OnModuleInit {
  private readonly logger = new Logger(PulseMfbClient.name);

  private baseUrl: string;
  private publicKey: string;
  private privateKey: string;
  private debitAccount: string;
  private ready = false;

  // Bank list fetched from PulseMFB at startup — used for code resolution
  private bankCache: PulseMfbBankEntry[] = [];

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
      // Fire-and-forget bank list fetch; seed map covers us if this fails
      void this.refreshBankList();
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
    nibssBankCode: string,
    bankName: string,
  ): Promise<PulseMfbNameEnquiryResult> {
    const bankCode = this.resolveBankCode(nibssBankCode, bankName);
    const data = await this.post<{ data: PulseMfbNameEnquiryResult }>(
      '/api/v1/external-api/transfers/name-enquiry',
      { account_number: accountNumber, bank_code: bankCode },
      // 15_000,
    );
    console.log('PulseMFB name enquiry response', data);
    return data.data;
  }

  // ── Initiate Transfer ───────────────────────────────────────────────────────
  async initiateTransfer(params: {
    debitAccount: string;
    beneficiaryAccountNumber: string;
    beneficiaryBankCode: string;  // NIBSS code — resolved internally to PulseMFB code
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

    const resolvedBankCode = this.resolveBankCode(
      params.beneficiaryBankCode,
      beneficiaryBankName,
    );

    this.logger.log(
      `PulseMFB transfer request [ref=${params.reference}] ` +
        `[nibssCode=${params.beneficiaryBankCode}] ` +
        `[resolvedCode=${resolvedBankCode}] ` +
        `[bankName=${beneficiaryBankName}]`,
    );

    const data = await this.post<{ data: PulseMfbTransferResult }>(
      '/api/v1/external-api/transfers',
      {
        debit_account_number: params.debitAccount,
        beneficiary_account_number: params.beneficiaryAccountNumber,
        beneficiary_bank_code: resolvedBankCode,
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
  // Bank code resolution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Maps a standard NIBSS bank code to PulseMFB's internal routing code.
   * Resolution order:
   *   1. Seed map (NIBSS_TO_PULSEMFB — hardcoded known-good values)
   *   2. Dynamic bank list fetched from PulseMFB at startup (matched by name)
   *   3. Fall back to the NIBSS code with a warning (transfer may still fail)
   */
  private resolveBankCode(nibssCode: string, bankName: string): string {
    // 1. Seed map — fastest, most reliable
    if (NIBSS_TO_PULSEMFB[nibssCode]) {
      const resolved = NIBSS_TO_PULSEMFB[nibssCode];
      if (resolved !== nibssCode) {
        this.logger.log(
          `Bank code resolved via seed [${nibssCode} → ${resolved}] (${bankName})`,
        );
      }
      return resolved;
    }

    // 2. Dynamic list — match by normalised bank name
    if (this.bankCache.length > 0) {
      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const needle = normalize(bankName);
      const found =
        this.bankCache.find((b) => normalize(b.name) === needle) ??
        this.bankCache.find(
          (b) =>
            normalize(b.name).includes(needle) ||
            needle.includes(normalize(b.name)),
        );
      if (found) {
        this.logger.log(
          `Bank code resolved via dynamic list [${nibssCode} → ${found.code}] (${bankName} ↔ ${found.name})`,
        );
        // Cache in seed map so subsequent calls are O(1)
        NIBSS_TO_PULSEMFB[nibssCode] = found.code;
        return found.code;
      }
    }

    // 3. Fallback — warn loudly so the operator knows to add a seed entry
    this.logger.warn(
      `No PulseMFB bank code found for NIBSS code ${nibssCode} (${bankName}) — ` +
        `sending NIBSS code as-is; add it to NIBSS_TO_PULSEMFB if transfers fail`,
    );
    return nibssCode;
  }

  /**
   * Fetches PulseMFB's supported bank list and caches it.
   * Called fire-and-forget from onModuleInit; never throws.
   */
  private async refreshBankList(): Promise<void> {
    try {
      const data = await this.get<{ data: PulseMfbBankEntry[] }>(
        '/api/v1/external-api/banks',
        10_000,
      );
      if (Array.isArray(data?.data) && data.data.length > 0) {
        this.bankCache = data.data;
        this.logger.log(
          `PulseMFB bank list loaded: ${this.bankCache.length} banks`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `PulseMFB bank list unavailable — using seed map only: ${(err as Error).message}`,
      );
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
