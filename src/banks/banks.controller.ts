// src/banks/banks.controller.ts
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
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
import { BanksService } from './banks.service';
import { PulseMfbClient } from './pulsemfb.client';
import {
  BankTransferDto,
  BankWebhookDto,
  PulseMfbWebhookDto,
  ResolveAccountDto,
} from './dto';

@ApiTags('Banks')
@Controller('banks')
export class BanksController {
  constructor(
    private readonly banksService: BanksService,
    private readonly pulseMfb: PulseMfbClient,
  ) {}

  // ── GET /banks ────────────────────────────────────────────────────────────
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List Nigerian banks',
    description: 'Returns all supported Nigerian banks with their bank codes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of banks with name and code',
  })
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
  @ApiResponse({
    status: 200,
    description: 'Account resolved — returns account name',
  })
  @ApiResponse({
    status: 400,
    description: 'Account not found or invalid details',
  })
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
      "Converts the user's USDC to NGN at the current effective rate and queues a bank transfer. " +
      'All validation runs synchronously; the actual debit and payout are processed asynchronously ' +
      'via an internal job queue so the HTTP response is never held open while the banking provider ' +
      'processes the request.\n\n' +
      '**Flow:**\n' +
      '1. Request is validated (KYC, daily limit, PIN, device signature, balance, account name).\n' +
      '2. A `pending` transfer record is created and the job is queued.\n' +
      '3. **`200` is returned immediately** — `status` will be `"pending"`.\n' +
      '4. The background worker deducts USDC from the Stellar wallet (SAGA step 1).\n' +
      '5. The worker calls PulseMFB to initiate the NGN payout (SAGA step 2).\n' +
      '6. The transfer moves to `processing` and stays there until PulseMFB settles it ' +
      'via webhook (`POST /banks/webhook/pulsemfb`) or the status poller (`GET /banks/transfer/:reference`).\n\n' +
      '**SAGA failure handling:**\n' +
      '- Step 1 fails (Stellar error): transfer marked `failed`, no USDC moved, user notified.\n' +
      '- Step 2 times out: transfer stays `processing` — the scheduler polls PulseMFB every 5 minutes.\n' +
      '- Step 2 rejected definitively: USDC is automatically refunded (compensating transaction), ' +
      'transfer marked `failed`, user notified.\n\n' +
      '**Polling for final status:**\n' +
      'Use `GET /banks/transfer/:reference` to manually sync the status, or listen for the ' +
      'push notification / email that fires when the transfer settles.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transfer accepted and queued — `status` is `"pending"`. ' +
      'Poll `GET /banks/transfer/:reference` or wait for a push notification to get the final status.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — insufficient balance, amount out of range, account mismatch, or service temporarily unavailable.',
  })
  @ApiResponse({
    status: 403,
    description: 'KYC not verified, daily limit exceeded, incorrect PIN, or unrecognised device.',
  })
  bankTransfer(@CurrentUser() user: User, @Body() dto: BankTransferDto) {
    return this.banksService.bankTransfer(user.id, dto);
  }

  // ── GET /banks/transfer/:reference ───────────────────────────────────────
  @Get('transfer/:reference')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Sync a transfer status from the banking provider',
    description:
      'Queries PulseMFB for the current status of a transfer and updates the ' +
      'local record if it has settled. Use this to resolve transfers that are ' +
      'stuck in **pending** or **processing** because the webhook was not received.',
  })
  @ApiResponse({ status: 200, description: 'Current transfer status (and whether it was synced)' })
  @ApiResponse({ status: 404, description: 'Transfer reference not found' })
  syncTransferStatus(
    @CurrentUser() user: User,
    @Param('reference') reference: string,
  ) {
    return this.banksService.syncTransferStatus(user.id, reference);
  }

  // ── GET /banks/onramp-availability ───────────────────────────────────────
  @Get('onramp-availability')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get available USDC for purchase (40% of platform treasury)' })
  getOnRampAvailability() {
    return this.banksService.getAvailableOnRampUsdc();
  }

  // ── GET /banks/virtual-account ───────────────────────────────────────────
  @Get('virtual-account')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Get the user's virtual NGN account for deposits",
    description:
      'Returns the dedicated PulseMFB virtual bank account assigned to this user. ' +
      'If the account has not been created yet it is provisioned on first call. ' +
      'Users transfer NGN to this account to receive the equivalent USDC in their wallet.',
  })
  @ApiResponse({
    status: 200,
    description: 'Virtual account details — accountNumber and accountName',
  })
  getVirtualAccount(@CurrentUser() user: User) {
    return this.banksService.getOrCreateVirtualAccount(user);
  }

  // ── GET /banks/deposits ───────────────────────────────────────────────────
  @Get('deposits')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List the user's inbound NGN deposits",
    description:
      'Returns a paginated list of deposits made to the user\'s virtual NGN account, ' +
      'ordered most-recent first. Each item reflects the current processing status ' +
      '(pending → completed / failed) and the USDC amount credited.',
  })
  @ApiResponse({ status: 200, description: 'Paginated deposit list' })
  getDeposits(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.banksService.getDeposits(user.id, page, pageSize);
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
      '1. Call `POST /banks/transfer` — the response returns `status: "pending"` and a `reference`.\n' +
      '2. Wait for the background worker to process the job (USDC debit + PulseMFB call), ' +
      'then call `GET /banks/transfer/:reference` to confirm the transfer is in `processing`.\n' +
      '3. Call this endpoint with that reference and `event: transfer.success` ' +
      'to simulate a successful NGN settlement.\n' +
      '4. Or use `transfer.failed` / `transfer.reversed` to simulate a failure — ' +
      "the USDC will be automatically refunded to the user's wallet.\n\n" +
      '**Events:**\n' +
      '- `transfer.success` — NGN landed in recipient account → marks transfer COMPLETED.\n' +
      '- `transfer.failed`  — NGN payout failed → refunds USDC, marks transfer FAILED.\n' +
      '- `transfer.reversed` — NGN was returned after settlement → refunds USDC, marks REVERSED.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Webhook processed — returns updated status and whether USDC was refunded',
  })
  @ApiResponse({ status: 404, description: 'Transfer reference not found' })
  processWebhook(@Body() dto: BankWebhookDto) {
    return this.banksService.processWebhook(dto);
  }

  // ── POST /banks/webhook/pulsemfb ──────────────────────────────────────────
  @Public()
  @Post('webhook/pulsemfb')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PulseMFB inbound webhook',
    description:
      'Receives transfer settlement events from PulseMFB.\n\n' +
      'PulseMFB signs every request with `X-Webhook-Signature: HMAC-SHA256(webhookSecret, rawBody)`. ' +
      'Set `PULSE_MFB_WEBHOOK_SECRET` to enable signature verification.\n\n' +
      '**Events handled:**\n' +
      '- `transfer.completed` → marks the transfer COMPLETED.\n' +
      '- `transfer.failed` → refunds USDC to the user, marks transfer FAILED.\n\n' +
      '**Configure this URL in your PulseMFB webhook settings:**\n' +
      '`POST https://<your-domain>/v1/banks/webhook/pulsemfb`',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async processPulseMfbWebhook(
    @Body() dto: PulseMfbWebhookDto,
    @Req() req: { rawBody?: Buffer },
    @Headers('x-webhook-signature') signature: string,
  ) {
    const rawBody = (req.rawBody ?? Buffer.from(JSON.stringify(dto))).toString(
      'utf8',
    );
    const sigValid = this.pulseMfb.verifyWebhookSignature(
      rawBody,
      signature ?? '',
    );
    if (!sigValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.banksService.processPulseMfbWebhook(dto.event, dto.data);
  }
}
