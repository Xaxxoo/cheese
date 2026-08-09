// src/bridge/bridge.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

import { BridgeService } from './bridge.service';
import { BridgeTransferService } from './bridge-transfer.service';
import { BridgeTransferDto, BridgeWebhookDto } from './dto';
import { BRIDGE_COUNTRIES } from './bridge.config';

@ApiTags('Bridge')
@Controller('bridge')
export class BridgeController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly bridgeTransferService: BridgeTransferService,
  ) {}

  // ── GET /bridge/countries ──────────────────────────────────────────────────
  @Get('countries')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List Bridge-supported countries',
    description:
      'Returns the static configuration for countries that use Bridge for off-ramp. ' +
      'Includes currency, payment rail, min/max amounts, and fee percentage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of country configurations',
  })
  getCountries() {
    return Object.values(BRIDGE_COUNTRIES);
  }

  // ── POST /bridge/transfer ─────────────────────────────────────────────────
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Initiate a Bridge off-ramp transfer',
    description:
      'Converts USDC to local fiat via Bridge for non-Nigeria countries. ' +
      'Validates KYC, PIN, device signature, and balance before creating the transfer. ' +
      'If Bridge API keys are not configured, returns a graceful error.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer created or queued for processing',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error, insufficient balance, or Bridge not configured',
  })
  @ApiResponse({
    status: 403,
    description: 'KYC not verified, incorrect PIN, or unrecognised device',
  })
  createTransfer(
    @CurrentUser() user: User,
    @Body() dto: BridgeTransferDto,
  ) {
    return this.bridgeTransferService.createTransfer(user.id, dto);
  }

  // ── GET /bridge/transfer/:reference ───────────────────────────────────────
  @Get('transfer/:reference')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Sync a Bridge transfer status',
    description:
      'Polls Bridge for the current state of a transfer and updates the local record.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current transfer status',
  })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  syncTransferStatus(
    @CurrentUser() user: User,
    @Param('reference') reference: string,
  ) {
    return this.bridgeTransferService.syncTransferStatus(user.id, reference);
  }

  // ── POST /bridge/kyc ─────────────────────────────────────────────────────
  @Post('kyc')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Start Bridge KYC for the current user',
    description:
      'Generates a Bridge KYC link for the user. Not enforced during beta — ' +
      'users can optionally complete this ahead of time. Returns the hosted ' +
      'KYC link URL if Bridge API keys are configured.',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC link generated or already completed',
  })
  @ApiResponse({
    status: 400,
    description: 'Bridge not configured or KYC creation failed',
  })
  startKyc(@CurrentUser() user: User) {
    return this.bridgeTransferService.startKyc(user.id);
  }

  // ── GET /bridge/kyc ─────────────────────────────────────────────────────
  @Get('kyc')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Check Bridge KYC status for the current user',
    description:
      'Returns whether the user has completed Bridge KYC, has a pending link, ' +
      'or has not started yet.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current Bridge KYC status',
  })
  getKycStatus(@CurrentUser() user: User) {
    return this.bridgeTransferService.getKycStatus(user.id);
  }

  // ── POST /bridge/webhook ──────────────────────────────────────────────────
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bridge inbound webhook',
    description:
      'Receives transfer status updates from Bridge. ' +
      'Verifies the webhook signature via HMAC-SHA256 before processing.',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async processWebhook(
    @Body() dto: BridgeWebhookDto,
    @Req() req: { rawBody?: Buffer },
    @Headers('x-webhook-signature') signature: string,
  ) {
    const rawBody = (req.rawBody ?? Buffer.from(JSON.stringify(dto))).toString(
      'utf8',
    );
    const sigValid = this.bridgeService.verifyWebhookSignature(
      rawBody,
      signature ?? '',
    );
    if (!sigValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.bridgeTransferService.processWebhook(dto);
  }
}
