// src/bills/bills.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { BillsService } from './bills.service';
import { PayBillDto, VerifyBillCustomerDto } from './dto/pay-bill.dto';

@ApiTags('Bills')
@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  // ── GET /bills/variations ─────────────────────────────────────────────────
  @Get('variations')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get service variations (packages)',
    description:
      'Fetches available packages for a VTPass service — e.g. data bundles for mtn-data, TV plans for dstv.',
  })
  @ApiQuery({ name: 'serviceId', example: 'mtn-data' })
  @ApiResponse({ status: 200, description: 'List of available variations' })
  getVariations(@Query('serviceId') serviceId: string) {
    return this.billsService.getVariations(serviceId);
  }

  // ── POST /bills/verify ────────────────────────────────────────────────────
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify a bill customer',
    description:
      'Verifies a customer identity using their smartcard number or meter number. ' +
      'Use before paying TV or electricity bills to confirm the customer name.',
  })
  @ApiResponse({ status: 200, description: 'Customer verified' })
  @ApiResponse({ status: 400, description: 'Customer not found' })
  verifyCustomer(@Body() dto: VerifyBillCustomerDto) {
    return this.billsService.verifyCustomer(dto);
  }

  // ── POST /bills/pay ───────────────────────────────────────────────────────
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('pay')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Pay a bill',
    description:
      "Converts the user's USDC to NGN and pays a bill via VTPass. " +
      'Requires PIN hash and device signature.\n\n' +
      '**Supported services:** airtime (mtn, airtel, glo, etisalat), ' +
      'data (mtn-data, airtel-data, glo-data, etisalat-data), ' +
      'TV (dstv, gotv, startimes), electricity (ikeja-electric, ekedc, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Bill payment completed' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or validation error' })
  @ApiResponse({ status: 403, description: 'Invalid PIN or unrecognised device' })
  payBill(@CurrentUser() user: User, @Body() dto: PayBillDto) {
    return this.billsService.payBill(user.id, dto);
  }
}
