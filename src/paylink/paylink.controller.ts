// src/paylink/paylink.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PayLinkService } from './paylink.service';
import { CreatePayLinkDto, PayLinkPayDto } from './dto';

@ApiTags('PayLink')
@Controller('paylink')
export class PayLinkController {
  constructor(private readonly payLinkService: PayLinkService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a payment request link',
    description:
      'Generates a shareable payment request link. The payer can open it on cheesepay.xyz, connect their Cheese Pay account, and settle the amount in USDC. Links expire after 7 days by default.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Link created — returns shareableUrl, token, and full link object',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — amount out of range, note too long, etc.',
  })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePayLinkDto) {
    return this.payLinkService.createPayLink(userId, dto);
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List your payment request links',
    description:
      'Paginated list of payment links created by the authenticated user. Includes all statuses: pending, paid, expired, cancelled.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    example: 20,
    description: 'Items per page (max 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of payment links with total count',
  })
  myLinks(
    @CurrentUser('id') userId: string,
    @Query('page') page = '1',
    @Query('pageSize') size = '20',
  ) {
    return this.payLinkService.myLinks(userId, parseInt(page), parseInt(size));
  }

  @Get(':token')
  @Public()
  @ApiOperation({
    summary: 'Resolve a payment link (public)',
    description:
      "Public endpoint — no authentication required. Returns the link's amount, creator details, note, status, and expiry. Used by cheesepay.xyz to render the pay page before the payer authenticates.",
  })
  @ApiParam({
    name: 'token',
    description: 'UUID token from the payment URL',
    example: 'a8f1c93e-923a-4b1b-9f1a-d0c23e1c32e2',
  })
  @ApiResponse({
    status: 200,
    description:
      'Link resolved — returns amount, creator, note, status, expiresAt',
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  resolve(@Param('token') token: string) {
    return this.payLinkService.resolveLink(token);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':token/pay')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Pay a payment request link',
    description:
      'Authenticated payer settles the payment. Uses a SERIALIZABLE database transaction + SELECT FOR UPDATE to prevent double-spend. A 0.1% platform fee is added on top of the requested amount.',
  })
  @ApiParam({
    name: 'token',
    description: 'UUID token of the payment link',
    example: 'a8f1c93e-923a-4b1b-9f1a-d0c23e1c32e2',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed — returns txId and Stellar txHash',
  })
  @ApiResponse({ status: 400, description: 'Insufficient balance' })
  @ApiResponse({ status: 401, description: 'Invalid PIN or device signature' })
  @ApiResponse({
    status: 403,
    description: 'Creator cannot pay their own link',
  })
  @ApiResponse({
    status: 409,
    description: 'Link already paid, expired, or cancelled',
  })
  pay(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
    @Body() dto: PayLinkPayDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.payLinkService.payLink(userId, token, dto, ip);
  }

  @Delete(':token')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cancel a payment link',
    description:
      'Creator cancels their own pending link. Only PENDING links can be cancelled — paid or expired links cannot be changed.',
  })
  @ApiParam({
    name: 'token',
    description: 'UUID token of the link to cancel',
    example: 'a8f1c93e-923a-4b1b-9f1a-d0c23e1c32e2',
  })
  @ApiResponse({ status: 200, description: 'Link cancelled successfully' })
  @ApiResponse({
    status: 403,
    description: 'Link does not belong to user or is not cancellable',
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  cancel(@CurrentUser('id') userId: string, @Param('token') token: string) {
    return this.payLinkService.cancelLink(userId, token);
  }
}
