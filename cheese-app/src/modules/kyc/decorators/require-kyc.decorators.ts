import { SetMetadata } from '@nestjs/common';
import { KycLevel } from '../entities/kyc.entity';

export const REQUIRE_KYC_KEY = 'requireKyc';

export interface KycRequirement {
  required: boolean;
  level?: KycLevel;
}

/**
 * Decorator to enforce KYC requirements on routes
 * @param required - Whether KYC is required
 * @param level - Minimum KYC level required (optional)
 * 
 * @example
 * @RequireKyc(true) // Requires basic KYC
 * @RequireKyc(true, KycLevel.INTERMEDIATE) // Requires intermediate KYC
 */
export const RequireKyc = (required = true, level?: KycLevel) =>
  SetMetadata(REQUIRE_KYC_KEY, { required, level } as KycRequirement);