// src/send/send.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { SendService } from './send.service';
import { SendToAddressDto, SendToUsernameDto } from './dto';

@ApiTags('Send')
@ApiBearerAuth('access-token')
@Controller('send')
export class SendController {
  constructor(private readonly sendService: SendService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('fee-rate')
  @ApiOperation({
    summary: 'Get current send fee rate from on-chain contract',
    description:
      'Returns the fee rate read from the Soroban contract fee_rate() view function. ' +
      'Use this to show the fee breakdown before the user confirms a transfer.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns feeRate (decimal) and feePct (human-readable string)',
  })
  getFeeRate() {
    return this.sendService.getFeeRatePublic();
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('resolve/:username')
  @ApiOperation({
    summary: 'Resolve username to wallet info',
    description:
      'Looks up a Cheese Pay username and returns the public profile (name, username, avatar) and Stellar address. Use this before initiating a send to confirm the recipient.',
  })
  @ApiParam({
    name: 'username',
    description: 'Cheese Pay username to look up',
    example: 'ada_finance',
  })
  @ApiResponse({
    status: 200,
    description: 'Username resolved — returns name, username, stellarAddress',
  })
  @ApiResponse({ status: 404, description: 'Username not found' })
  resolveUsername(@Param('username') username: string) {
    return this.sendService.resolveUsername(username);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send USDC by username',
    description:
      "Sends USDC to another Cheese Pay user by username. Requires PIN hash and device signature. The transaction is recorded in both users' histories and a push notification is sent to the recipient.",
  })
  @ApiResponse({
    status: 200,
    description:
      'Transfer successful — returns txId, txHash, and fee breakdown',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or validation error',
  })
  @ApiResponse({ status: 401, description: 'Invalid PIN or device signature' })
  @ApiResponse({ status: 404, description: 'Recipient username not found' })
  sendToUsername(@CurrentUser() user: User, @Body() dto: SendToUsernameDto) {
    return this.sendService.sendToUsername(user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('address')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send USDC to a Stellar address',
    description:
      'Sends USDC to any valid Stellar G-address. Use for external wallets. Requires PIN hash and device signature. A network fee of 0.00001 XLM is charged by Stellar.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer submitted to Stellar — returns txHash',
  })
  @ApiResponse({
    status: 400,
    description:
      'Insufficient balance, invalid address, or unsupported network',
  })
  @ApiResponse({ status: 401, description: 'Invalid PIN or device signature' })
  sendToAddress(@CurrentUser() user: User, @Body() dto: SendToAddressDto) {
    return this.sendService.sendToAddress(user.id, dto);
  }
}
