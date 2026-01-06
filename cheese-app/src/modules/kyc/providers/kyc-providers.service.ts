import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { KycLevel } from '../entities/kyc.entity';
import * as crypto from 'crypto';

export interface KycProviderResponse {
  verificationId: string;
  verificationUrl: string;
  status: string;
  expiresAt?: Date;
}

export interface KycVerificationData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  country?: string;
  level: KycLevel;
  userId: string;
  metadata?: Record<string, any>;
}

export interface KycProviderConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
  webhookUrl: string;
  provider: string;
}

@Injectable()
export class KycProviderService {
  private readonly logger = new Logger(KycProviderService.name);
  private readonly config: KycProviderConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      apiUrl: this.configService.get<string>('KYC_PROVIDER_API_URL'),
      apiKey: this.configService.get<string>('KYC_PROVIDER_API_KEY'),
      webhookSecret: this.configService.get<string>('KYC_PROVIDER_WEBHOOK_SECRET'),
      webhookUrl: this.configService.get<string>('KYC_WEBHOOK_URL'),
      provider: this.configService.get<string>('KYC_PROVIDER', 'onfido'),
    };
  }

  /**
   * Create a new KYC verification session with external provider
   */
  async createVerification(
    data: KycVerificationData,
  ): Promise<KycProviderResponse> {
    try {
      this.logger.log(
        `Creating KYC verification for user ${data.userId} with provider ${this.config.provider}`,
      );

      const payload = this.buildVerificationPayload(data);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.apiUrl}/verifications`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.log(
        `KYC verification created: ${response.data.verificationId}`,
      );

      return this.mapProviderResponse(response.data);
    } catch (error) {
      this.logger.error(
        `Failed to create KYC verification: ${error.message}`,
        error.stack,
      );

      if (error.response) {
        throw new HttpException(
          {
            message: 'Failed to initiate KYC verification',
            error: error.response.data,
          },
          error.response.status || HttpStatus.BAD_GATEWAY,
        );
      }

      throw new HttpException(
        'KYC provider service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get verification status from external provider
   */
  async getVerificationStatus(verificationId: string): Promise<any> {
    try {
      this.logger.log(`Fetching verification status: ${verificationId}`);

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.config.apiUrl}/verifications/${verificationId}`,
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch verification status: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Cancel a verification
   */
  async cancelVerification(verificationId: string): Promise<void> {
    try {
      this.logger.log(`Cancelling verification: ${verificationId}`);

      await firstValueFrom(
        this.httpService.delete(
          `${this.config.apiUrl}/verifications/${verificationId}`,
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
            },
          },
        ),
      );

      this.logger.log(`Verification cancelled: ${verificationId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify webhook signature from provider
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp?: string,
  ): boolean {
    try {
      // Different providers use different signature methods
      // This is a generic HMAC SHA256 approach
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(timestamp ? `${timestamp}.${payload}` : payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Build verification payload based on provider
   */
  private buildVerificationPayload(data: KycVerificationData): any {
    // This is a generic payload structure
    // Customize based on your actual KYC provider's API
    return {
      applicant: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone_number: data.phoneNumber,
        dob: data.dateOfBirth,
        country: data.country,
      },
      verification_level: this.mapKycLevel(data.level),
      webhook_url: this.config.webhookUrl,
      redirect_url: `${this.configService.get('APP_URL')}/kyc/complete`,
      external_ref: data.userId,
      metadata: data.metadata,
    };
  }

  /**
   * Map internal KYC level to provider's level
   */
  private mapKycLevel(level: KycLevel): string {
    const levelMap = {
      [KycLevel.BASIC]: 'basic',
      [KycLevel.INTERMEDIATE]: 'standard',
      [KycLevel.ADVANCED]: 'enhanced',
    };

    return levelMap[level] || 'basic';
  }

  /**
   * Map provider response to internal format
   */
  private mapProviderResponse(providerData: any): KycProviderResponse {
    // Customize based on your provider's response structure
    return {
      verificationId: providerData.id || providerData.verification_id,
      verificationUrl: providerData.url || providerData.verification_url,
      status: providerData.status,
      expiresAt: providerData.expires_at
        ? new Date(providerData.expires_at)
        : undefined,
    };
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.config.provider;
  }
}