// src/kyc/dojah.client.ts
//
// Thin HTTP client for the Dojah Identity API.
// Docs: https://docs.dojah.io
//
// Auth headers on every request:
//   AppId:         your Dojah App ID
//   Authorization: your Dojah secret key

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE_URL = 'https://api.dojah.io';

// ─────────────────────────────────────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface DojahBvnResult {
  bvn:          string;
  firstName:    string;
  lastName:     string;
  middleName:   string;
  dateOfBirth:  string;
  phoneNumber:  string;
  image:        string; // base64 — stripped before storing
}

export interface DojahNinResult {
  nin:         string;
  firstName:   string;
  lastName:    string;
  middleName:  string;
  dateOfBirth: string;
  phone:       string;
  photo:       string; // base64 — stripped before storing
}

export interface DojahSelfieResult {
  match:      boolean;
  confidence: number;
}

export interface DojahDocumentResult {
  valid:        boolean;
  documentType: string;
  firstName:    string;
  lastName:     string;
  documentNo:   string;
  expiryDate:   string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class DojahClient implements OnModuleInit {
  private readonly logger = new Logger(DojahClient.name);
  private appId: string;
  private secretKey: string;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const appId     = this.config.get<string>('dojah.appId');
    const secretKey = this.config.get<string>('dojah.secretKey');

    if (appId && secretKey) {
      this.appId     = appId;
      this.secretKey = secretKey;
      this.ready     = true;
      this.logger.log('Dojah client ready');
    } else {
      this.logger.warn('Dojah not configured — KYC features disabled (set DOJAH_APP_ID and DOJAH_SECRET_KEY)');
    }
  }

  get isReady(): boolean { return this.ready; }

  // ── BVN lookup ─────────────────────────────────────────────────────────────

  async lookupBvn(bvn: string): Promise<DojahBvnResult> {
    const data = await this.get<any>(`/api/v1/kyc/bvn?bvn=${bvn}`);
    const e = data.entity;
    return {
      bvn:         e.bvn,
      firstName:   (e.first_name  ?? '').trim(),
      lastName:    (e.last_name   ?? '').trim(),
      middleName:  (e.middle_name ?? '').trim(),
      dateOfBirth: e.date_of_birth ?? '',
      phoneNumber: e.phone_number1 ?? '',
      image:       e.image ?? '',
    };
  }

  // ── NIN lookup ─────────────────────────────────────────────────────────────

  async lookupNin(nin: string): Promise<DojahNinResult> {
    const data = await this.get<any>(`/api/v1/kyc/nin?nin=${nin}`);
    const e = data.entity;
    return {
      nin:         e.nin ?? nin,
      firstName:   (e.firstname  ?? '').trim(),
      lastName:    (e.surname    ?? '').trim(),
      middleName:  (e.middlename ?? '').trim(),
      dateOfBirth: e.birthdate   ?? '',
      phone:       e.mobile      ?? '',
      photo:       e.photo       ?? '',
    };
  }

  // ── Document verification ───────────────────────────────────────────────────

  async verifyDocument(
    documentImage: string,
    documentType: 'passport' | 'drivers_license' | 'nin_slip',
  ): Promise<DojahDocumentResult> {
    const data = await this.post<any>('/api/v1/kyc/document/verify', {
      document_image: documentImage,
      document_type:  documentType,
    });
    const e = data.entity;
    return {
      valid:        Boolean(e.valid ?? e.status === 'success'),
      documentType: e.document_type ?? documentType,
      firstName:    (e.first_name ?? '').trim(),
      lastName:     (e.last_name  ?? '').trim(),
      documentNo:   e.document_number ?? '',
      expiryDate:   e.expiry_date     ?? '',
    };
  }

  // ── Selfie / face-match ─────────────────────────────────────────────────────

  async verifySelfie(selfieBase64: string, bvn: string): Promise<DojahSelfieResult> {
    const data = await this.post<any>('/api/v1/kyc/selfie/verify', {
      selfie_image: selfieBase64,
      bvn,
    });
    const e = data.entity;
    return {
      match:      Boolean(e.match),
      confidence: Number(e.confidence ?? 0),
    };
  }

  // ── HTTP helpers ────────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      'AppId':        this.appId,
      'Authorization': this.secretKey,
      'Content-Type': 'application/json',
    };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method:  'GET',
      headers: this.headers(),
    });
    return this.parseResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify(body),
    });
    return this.parseResponse<T>(res);
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Dojah returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      const msg = json?.error ?? json?.message ?? `Dojah error ${res.status}`;
      throw new Error(msg);
    }

    return json as T;
  }
}
