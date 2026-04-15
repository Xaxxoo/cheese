// src/kyc/kyc.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../auth/entities/user.entity';
import { KycService } from './kyc.service';
import { VerifyBvnDto, VerifyNinDto, VerifySelfieDto, VerifyDocumentDto, AdminApproveDto, AdminRejectDto } from './dto';

@ApiTags('KYC')
@ApiBearerAuth('access-token')
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly config: ConfigService,
  ) {}

  private requireAdminKey(key: string | undefined): void {
    const adminKey = this.config.get<string>('ADMIN_API_KEY');
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  // ── GET /kyc/status ─────────────────────────────────────────────────────────
  @Get('status')
  @ApiOperation({
    summary: 'Get KYC status',
    description: 'Returns current KYC status, tier, and past verification attempts.',
  })
  @ApiResponse({ status: 200, description: 'KYC status returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStatus(@CurrentUser() user: User) {
    return this.kycService.getStatus(user.id);
  }

  // ── POST /kyc/verify/bvn ────────────────────────────────────────────────────
  @Post('verify/bvn')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify BVN',
    description:
      'Submits a BVN to Dojah for verification. On success, sets kycStatus to "verified".',
  })
  @ApiResponse({ status: 200, description: 'BVN verified' })
  @ApiResponse({ status: 400, description: 'Invalid BVN or verification failed' })
  @ApiResponse({ status: 409, description: 'Already verified' })
  @ApiResponse({ status: 503, description: 'KYC service unavailable' })
  verifyBvn(@CurrentUser() user: User, @Body() dto: VerifyBvnDto) {
    return this.kycService.verifyBvn(user.id, dto.bvn);
  }

  // ── POST /kyc/verify/nin ────────────────────────────────────────────────────
  @Post('verify/nin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify NIN',
    description:
      'Submits a NIN to Dojah for verification. On success, sets kycStatus to "verified".',
  })
  @ApiResponse({ status: 200, description: 'NIN verified' })
  @ApiResponse({ status: 400, description: 'Invalid NIN or verification failed' })
  @ApiResponse({ status: 409, description: 'Already verified' })
  @ApiResponse({ status: 503, description: 'KYC service unavailable' })
  verifyNin(@CurrentUser() user: User, @Body() dto: VerifyNinDto) {
    return this.kycService.verifyNin(user.id, dto.nin);
  }

  // ── POST /kyc/verify/selfie ─────────────────────────────────────────────────
  @Post('verify/selfie')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @ApiOperation({
    summary: 'Selfie face-match (upgrades to Gold)',
    description:
      'Matches a selfie against the BVN photo via Dojah. ' +
      'Requires BVN or NIN to be verified first. On success, upgrades tier to Gold.',
  })
  @ApiResponse({ status: 200, description: 'Face matched — tier upgraded to Gold' })
  @ApiResponse({ status: 400, description: 'Face match failed or BVN/NIN not yet verified' })
  @ApiResponse({ status: 409, description: 'Already Gold or above' })
  @ApiResponse({ status: 503, description: 'KYC service unavailable' })
  verifySelfie(@CurrentUser() user: User, @Body() dto: VerifySelfieDto) {
    return this.kycService.verifySelfie(user.id, dto.selfieImage, dto.bvn);
  }

  // ── POST /kyc/verify/document ───────────────────────────────────────────────
  @Post('verify/document')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @ApiOperation({
    summary: 'Document verification (Gold → Black prerequisite)',
    description:
      'Verifies a passport, driver\'s license, or NIN slip via Dojah. ' +
      'Requires Gold tier. On success, marks account as pending admin approval for Black.',
  })
  @ApiResponse({ status: 200, description: 'Document verified — pending admin approval' })
  @ApiResponse({ status: 400, description: 'Invalid document or not Gold tier' })
  @ApiResponse({ status: 409, description: 'Already submitted or already Black' })
  @ApiResponse({ status: 503, description: 'KYC service unavailable' })
  verifyDocument(@CurrentUser() user: User, @Body() dto: VerifyDocumentDto) {
    return this.kycService.verifyDocument(user.id, dto.documentImage, dto.documentType);
  }

  // ── POST /kyc/admin/approve-black ───────────────────────────────────────────
  @Public()
  @Post('admin/approve-black')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Approve Black tier upgrade',
    description: 'Requires X-Admin-Key header. Upgrades user to Black and sends confirmation email.',
  })
  @ApiResponse({ status: 200, description: 'User upgraded to Black' })
  @ApiResponse({ status: 401, description: 'Invalid admin key' })
  @ApiResponse({ status: 400, description: 'No pending approval for this user' })
  adminApproveBlack(
    @Headers('x-admin-key') adminKey: string,
    @Body() dto: AdminApproveDto,
  ) {
    this.requireAdminKey(adminKey);
    return this.kycService.adminApproveBlack(dto.userId);
  }

  // ── POST /kyc/admin/reject-black ────────────────────────────────────────────
  @Public()
  @Post('admin/reject-black')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Reject Black tier upgrade',
    description: 'Requires X-Admin-Key header. Clears the pending flag so user can re-submit.',
  })
  @ApiResponse({ status: 200, description: 'Black tier request rejected' })
  @ApiResponse({ status: 401, description: 'Invalid admin key' })
  adminRejectBlack(
    @Headers('x-admin-key') adminKey: string,
    @Body() dto: AdminRejectDto,
  ) {
    this.requireAdminKey(adminKey);
    return this.kycService.adminRejectBlack(dto.userId, dto.reason);
  }
}
