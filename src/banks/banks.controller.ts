// src/banks/banks.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
import { BanksService } from './banks.service';
import { BankTransferDto, BankWebhookDto, ResolveAccountDto } from './dto';

@ApiTags('Banks')
@Controller('banks')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  // ── GET /banks ────────────────────────────────────────────────────────────
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List Nigerian banks',
    description:
      'Returns all supported Nigerian banks with their bank codes.',
  })
  @ApiResponse({ status: 200, description: 'Array of banks with name and code' })
  getBanks() {
    return this.banksService.getBanks();
  }

  // ── POST /banks/resolve ───────────────────────────────────────────────────
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Resolve bank account name',
    description:
      'Looks up the account holder name for a given account number and bank code. ' +
      'Use this before initiating a transfer to confirm the recipient.',
  })
  @ApiResponse({ status: 200, description: 'Account resolved — returns account name' })
  @ApiResponse({ status: 400, description: 'Account not found or invalid details' })
  resolveAccount(@Body() dto: ResolveAccountDto) {
    return this.banksService.resolveAccount(dto);
  }

  // ── POST /banks/transfer ──────────────────────────────────────────────────
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Withdraw USDC as NGN to a bank account',
    description:
      "Converts the user's USDC to NGN at the current effective rate and initiates " +
      'a bank transfer. Requires PIN hash and device ID.\n\n' +
      '**Flow:**\n' +
      '1. USDC is deducted from the user\'s Stellar wallet.\n' +
      '2. The banking provider is called to initiate the NGN payout.\n' +
      '3. The transfer stays in **processing** state until `POST /banks/webhook` ' +
      'receives a `transfer.success` or `transfer.failed` event.\n\n' +
      'If the banking provider call fails *after* USDC is deducted, the USDC is ' +
      'automatically refunded to the user\'s wallet.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer initiated — status is "processing" until webhook confirms',
  })
  @ApiResponse({ status: 400, description: 'Insufficient balance or validation error' })
  @ApiResponse({ status: 401, description: 'Invalid PIN or unrecognised device' })
  bankTransfer(@CurrentUser() user: User, @Body() dto: BankTransferDto) {
    return this.banksService.bankTransfer(user.id, dto);
  }

  // ── POST /banks/webhook ───────────────────────────────────────────────────
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '(Demo) Banking provider webhook',
    description:
      '**This is a demo endpoint for testing on Swagger.** In production this ' +
      'would be called by your banking provider when a transfer settles.\n\n' +
      '**How to test the full flow:**\n' +
      '1. Call `POST /banks/transfer` — copy the `reference` from the response.\n' +
      '2. Call this endpoint with that reference and `event: transfer.success` ' +
      'to simulate a successful NGN settlement.\n' +
      '3. Or use `transfer.failed` / `transfer.reversed` to simulate a failure — ' +
      'the USDC will be automatically refunded to the user\'s wallet.\n\n' +
      '**Events:**\n' +
      '- `transfer.success` — NGN landed in recipient account → marks transfer COMPLETED.\n' +
      '- `transfer.failed`  — NGN payout failed → refunds USDC, marks transfer FAILED.\n' +
      '- `transfer.reversed` — NGN was returned after settlement → refunds USDC, marks REVERSED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed — returns updated status and whether USDC was refunded',
  })
  @ApiResponse({ status: 404, description: 'Transfer reference not found' })
  processWebhook(@Body() dto: BankWebhookDto) {
    return this.banksService.processWebhook(dto);
  }
}
