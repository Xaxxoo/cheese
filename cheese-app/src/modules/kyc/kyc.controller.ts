import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { KycService } from '../services/kyc.service';
import { KycProviderService } from '../services/kyc-provider.service';
import {
  InitiateKycDto,
  UpdateKycDto,
  ManualReviewDto,
  KycResponseDto,
  KycStatusResponseDto,
  QueryKycDto,
  KycWebhookDto,
} from '../dto/kyc.dto';
import { KycStatus } from '../entities/kyc.entity';
import { Request } from 'express';

// You'll need to implement these guards based on your auth system
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../../auth/guards/roles.guard';
// import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly kycProviderService: KycProviderService,
  ) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate KYC verification for a user' })
  @ApiResponse({
    status: 201,
    description: 'KYC verification initiated successfully',
    type: KycResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'KYC already in progress or completed' })
  async initiateKyc(@Body() dto: InitiateKycDto): Promise<KycResponseDto> {
    const kyc = await this.kycService.initiateKyc(dto);

    return {
      id: kyc.id,
      userId: kyc.userId,
      verificationId: kyc.verificationId,
      status: kyc.status,
      level: kyc.level,
      verificationUrl: kyc.verificationUrl,
      firstName: kyc.firstName,
      lastName: kyc.lastName,
      email: kyc.email,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      completedAt: kyc.completedAt,
      expiresAt: kyc.expiresAt,
    };
  }

  @Get('user/:userId')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC verification status by user ID' })
  @ApiResponse({
    status: 200,
    description: 'KYC verification found',
    type: KycResponseDto,
  })
  @ApiResponse({ status: 404, description: 'KYC verification not found' })
  async getKycByUserId(
    @Param('userId') userId: string,
  ): Promise<KycResponseDto> {
    const kyc = await this.kycService.getKycByUserId(userId);

    return {
      id: kyc.id,
      userId: kyc.userId,
      verificationId: kyc.verificationId,
      status: kyc.status,
      level: kyc.level,
      verificationUrl: kyc.verificationUrl,
      firstName: kyc.firstName,
      lastName: kyc.lastName,
      email: kyc.email,
      rejectionReason: kyc.rejectionReason,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      completedAt: kyc.completedAt,
      expiresAt: kyc.expiresAt,
    };
  }

  @Get('status/:userId')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user verification status' })
  @ApiResponse({
    status: 200,
    description: 'Verification status retrieved',
    type: KycStatusResponseDto,
  })
  async getUserStatus(
    @Param('userId') userId: string,
  ): Promise<KycStatusResponseDto> {
    const kyc = await this.kycService.getKycByUserId(userId);
    const isVerified = await this.kycService.isUserVerified(userId);

    return {
      id: kyc.id,
      status: kyc.status,
      level: kyc.level,
      isVerified,
      canTransact: isVerified && kyc.status === KycStatus.APPROVED,
      completedAt: kyc.completedAt,
      expiresAt: kyc.expiresAt,
      rejectionReason: kyc.rejectionReason,
    };
  }

  @Get('verification/:id')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC verification by ID' })
  @ApiResponse({
    status: 200,
    description: 'KYC verification found',
    type: KycResponseDto,
  })
  @ApiResponse({ status: 404, description: 'KYC verification not found' })
  async getKycById(@Param('id') id: string): Promise<KycResponseDto> {
    const kyc = await this.kycService.getKycById(id);

    return {
      id: kyc.id,
      userId: kyc.userId,
      verificationId: kyc.verificationId,
      status: kyc.status,
      level: kyc.level,
      verificationUrl: kyc.verificationUrl,
      firstName: kyc.firstName,
      lastName: kyc.lastName,
      email: kyc.email,
      rejectionReason: kyc.rejectionReason,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      completedAt: kyc.completedAt,
      expiresAt: kyc.expiresAt,
    };
  }

  @Patch(':id')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update KYC verification details' })
  @ApiResponse({
    status: 200,
    description: 'KYC verification updated',
    type: KycResponseDto,
  })
  @ApiResponse({ status: 404, description: 'KYC verification not found' })
  @ApiResponse({ status: 400, description: 'Cannot update approved KYC' })
  async updateKyc(
    @Param('id') id: string,
    @Body() dto: UpdateKycDto,
  ): Promise<KycResponseDto> {
    const kyc = await this.kycService.updateKyc(id, dto);

    return {
      id: kyc.id,
      userId: kyc.userId,
      verificationId: kyc.verificationId,
      status: kyc.status,
      level: kyc.level,
      verificationUrl: kyc.verificationUrl,
      firstName: kyc.firstName,
      lastName: kyc.lastName,
      email: kyc.email,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      completedAt: kyc.completedAt,
      expiresAt: kyc.expiresAt,
    };
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry failed or expired KYC verification' })
  @ApiResponse({
    status: 200,
    description: 'KYC verification retried',
    type: KycResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot retry this verification' })
  async retryKyc(@Param('id') id: string): Promise<KycResponseDto> {
    const kyc = await this.kycService.retryKyc(id);

    return {
      id: kyc.id,
      userId: kyc.userId,
      verificationId: kyc.verificationId,
      status: kyc.status,
      level: kyc.level,
      verificationUrl: kyc.verificationUrl,
      firstName: kyc.firstName,
      lastName: kyc.lastName,
      email: kyc.email,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      completedAt: kyc.completedAt,
      expiresAt: kyc.expiresAt,
    };
  }

  @Get()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'compliance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query KYC verifications (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'List of KYC verifications',
  })
  async queryKyc(@Query() query: QueryKycDto) {
    return this.kycService.queryKyc(query);
  }

  @Get('reviews/pending')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'compliance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending manual reviews (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'List of verifications requiring manual review',
  })
  async getPendingReviews(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.kycService.getPendingReviews(page, limit);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'compliance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perform manual review (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Manual review completed',
    type: KycResponseDto,
  })
  async manualReview(
    @Param('id') id: string,
    @Body() dto: ManualReviewDto,
  ): Promise<KycResponseDto> {
    const kyc = await this.kycService.manualReview(id, dto);

    return {
      id: kyc.id,
      userId: kyc.userId,
      verificationId: kyc.verificationId,
      status: kyc.status,
      level: kyc.level,
      verificationUrl: kyc.verificationUrl,
      firstName: kyc.firstName,
      lastName: kyc.lastName,
      email: kyc.email,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      completedAt: kyc.completedAt,
      expiresAt: kyc.expiresAt,
    };
  }

  @Get('statistics')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC statistics (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'KYC statistics',
  })
  async getStatistics() {
    return this.kycService.getStatistics();
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook endpoint for KYC provider callbacks',
  })
  @ApiHeader({
    name: 'x-webhook-signature',
    description: 'Webhook signature for verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid webhook signature',
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: KycWebhookDto,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
  ) {
    // Verify webhook signature
    const rawBody = req.rawBody?.toString() || JSON.stringify(body);
    const isValid = this.kycProviderService.verifyWebhookSignature(
      rawBody,
      signature,
      timestamp,
    );

    if (!isValid) {
      return { error: 'Invalid signature' };
    }

    // Process webhook
    await this.kycService.handleWebhook(
      body.verificationId,
      body.status,
      {
        rejectionReason: body.rejectionReason,
        riskAssessment: body.riskAssessment,
        metadata: body.metadata,
      },
    );

    return { success: true };
  }
}