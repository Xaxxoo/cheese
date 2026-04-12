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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { BanksService } from './banks.service';
import { BankTransferDto, ResolveAccountDto } from './dto';

@ApiTags('Banks')
@ApiBearerAuth('access-token')
@Controller('banks')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get()
  @ApiOperation({
    summary: 'List Nigerian banks',
    description:
      'Returns all supported Nigerian banks with their Paystack bank codes. Cached — updates infrequently.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of banks with name and code',
  })
  getBanks() {
    return this.banksService.getBanks();
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve bank account name',
    description:
      'Looks up the account holder name for a given account number and bank code via Paystack. Use this before initiating a transfer to confirm the recipient.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account resolved — returns account name',
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found or invalid details',
  })
  @ApiResponse({ status: 502, description: 'Paystack lookup failed' })
  resolveAccount(@Body() dto: ResolveAccountDto) {
    return this.banksService.resolveAccount(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Withdraw USDC as NGN to a bank account',
    description:
      "Converts the user's USDC to NGN at the current effective rate and initiates a Paystack bank transfer. Requires PIN hash and device signature.",
  })
  @ApiResponse({
    status: 200,
    description:
      'Transfer initiated — returns reference and estimated arrival time',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or validation error',
  })
  @ApiResponse({ status: 401, description: 'Invalid PIN or device signature' })
  @ApiResponse({ status: 502, description: 'Paystack transfer failed' })
  bankTransfer(@CurrentUser() user: User, @Body() dto: BankTransferDto) {
    return this.banksService.bankTransfer(user.id, dto);
  }
}
