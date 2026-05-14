import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MerchantService } from './merchant.service';
import { MerchantJwtGuard } from './guards/merchant-jwt.guard';
import type { MerchantJwtContext } from './strategies/merchant-jwt.strategy';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';

// @Public() bypasses the global JwtAccessGuard (user guard).
// MerchantJwtGuard on the class requires a valid merchant JWT for all routes.
@Public()
@UseGuards(MerchantJwtGuard)
@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: Request) {
    const ctx = req.user as MerchantJwtContext;
    return this.merchantService.getDashboard(ctx);
  }

  @Get('payments')
  async listPayments(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const ctx = req.user as MerchantJwtContext;
    return this.merchantService.listPayments(ctx, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
  }

  @Get('payments/:id')
  async getPayment(@Req() req: Request, @Param('id') id: string) {
    const ctx = req.user as MerchantJwtContext;
    const result = await this.merchantService.getPayment(ctx, id);
    if (!result) throw new NotFoundException('Payment not found');
    return result;
  }

  @Post('payments')
  async createPayment(@Req() req: Request, @Body() dto: CreatePaymentRequestDto) {
    const ctx = req.user as MerchantJwtContext;
    return this.merchantService.createPaymentRequest(ctx, dto);
  }

  @Get('settlements')
  async getSettlements(@Req() req: Request) {
    const ctx = req.user as MerchantJwtContext;
    return this.merchantService.getSettlements(ctx);
  }
}
