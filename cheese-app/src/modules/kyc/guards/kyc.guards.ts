import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KycService } from '../services/kyc.service';
import { REQUIRE_KYC_KEY, KycRequirement } from '../decorators/require-kyc.decorator';
import { KycLevel } from '../entities/kyc.entity';

@Injectable()
export class KycGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private kycService: KycService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const kycRequirement = this.reflector.getAllAndOverride<KycRequirement>(
      REQUIRE_KYC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!kycRequirement || !kycRequirement.required) {
      return true; // No KYC required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Assumes user is attached by auth guard

    if (!user || !user.id) {
      throw new ForbiddenException('User authentication required');
    }

    // Check if user is verified
    const isVerified = await this.kycService.isUserVerified(
      user.id,
      kycRequirement.level,
    );

    if (!isVerified) {
      const userLevel = await this.kycService.getUserVerificationLevel(
        user.id,
      );

      if (!userLevel) {
        throw new ForbiddenException(
          'KYC verification required. Please complete identity verification to access this resource.',
        );
      }

      if (kycRequirement.level) {
        throw new ForbiddenException(
          `Higher KYC level required. You have ${userLevel} verification but ${kycRequirement.level} is required.`,
        );
      }
    }

    return true;
  }
}