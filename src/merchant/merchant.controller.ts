import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MerchantService } from './merchant.service';
import { MerchantJwtGuard } from './guards/merchant-jwt.guard';
import type { MerchantJwtContext } from './strategies/merchant-jwt.strategy';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { AddPayoutAccountDto } from './dto/add-payout-account.dto';
import { UpdatePayoutAccountDto } from './dto/update-payout-account.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

// @Public() bypasses the global JwtAccessGuard (user guard).
// MerchantJwtGuard on the class requires a valid merchant JWT for all routes.
@Public()
@UseGuards(MerchantJwtGuard)
@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: Request) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.getDashboard(ctx);
  }

  @Get('payments')
  async listPayments(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.listPayments(ctx, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
  }

  @Get('payments/:id')
  async getPayment(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.getPayment(ctx, id);
    if (!result) throw new NotFoundException('Payment not found');
    return result;
  }

  @Post('payments')
  async createPayment(@Req() req: Request, @Body() dto: CreatePaymentRequestDto) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.createPaymentRequest(ctx, dto);
  }

  @Get('settlements')
  async getSettlements(@Req() req: Request) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.getSettlements(ctx);
  }

  // ── Payout accounts ──────────────────────────────────────────────────────

  @Post('payout-accounts')
  async addPayoutAccount(@Req() req: Request, @Body() dto: AddPayoutAccountDto) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.addPayoutAccount(ctx, dto);
  }

  @Patch('payout-accounts/:id')
  async updatePayoutAccount(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdatePayoutAccountDto,
  ) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.updatePayoutAccount(ctx, id, dto);
    if (!result) throw new NotFoundException('Payout account not found');
    return result;
  }

  @Delete('payout-accounts/:id')
  async removePayoutAccount(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.removePayoutAccount(ctx, id);
    if (!result) throw new NotFoundException('Payout account not found');
    return result;
  }

  @Patch('payout-accounts/:id/set-default')
  async setDefaultPayoutAccount(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.setDefaultPayoutAccount(ctx, id);
    if (!result) throw new NotFoundException('Payout account not found');
    return result;
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  @Get('api-keys')
  async listApiKeys(@Req() req: Request) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.listApiKeys(ctx);
  }

  @Post('api-keys')
  async createApiKey(@Req() req: Request, @Body() dto: CreateApiKeyDto) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.createApiKey(ctx, dto);
  }

  @Delete('api-keys/:id')
  async revokeApiKey(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.revokeApiKey(ctx, id);
    if (!result) throw new NotFoundException('API key not found');
    return result;
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  @Get('webhooks')
  async listWebhooks(@Req() req: Request) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.listWebhooks(ctx);
  }

  @Post('webhooks')
  async createWebhook(@Req() req: Request, @Body() dto: CreateWebhookDto) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantService.createWebhook(ctx, dto);
  }

  @Patch('webhooks/:id')
  async updateWebhook(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.updateWebhook(ctx, id, dto);
    if (!result) throw new NotFoundException('Webhook not found');
    return result;
  }

  @Delete('webhooks/:id')
  async deleteWebhook(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.deleteWebhook(ctx, id);
    if (!result) throw new NotFoundException('Webhook not found');
    return result;
  }

  @Get('webhooks/:id/deliveries')
  async getWebhookDeliveries(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).user as MerchantJwtContext;
    const result = await this.merchantService.getWebhookDeliveries(ctx, id);
    if (!result) throw new NotFoundException('Webhook not found');
    return result;
  }
}
