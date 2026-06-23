// src/private-gateway/private-gateway.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrivateGatewayService } from './private-gateway.service';
import { CreatePrivateInvoiceDto } from './dto';
import { ApiKeyGuard } from './guards/api-key.guard';

@ApiTags('Private Gateway')
@Controller('private-gateway')
export class PrivateGatewayController {
  constructor(private readonly gatewayService: PrivateGatewayService) {}

  // ── POST /private-gateway/invoice ─────────────────────────────────────────
  // Merchant creates an invoice. Returns reference + receiving address for QR.
  @Post('invoice')
  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a private invoice',
    description:
      'Creates a Veil ZK payment invoice. Returns the Stellar hot-wallet address and reference ' +
      'memo that the Veil wallet uses to route a shielded payment from the customer.',
  })
  @ApiHeader({ name: 'X-Api-Key', description: 'Merchant API key (required when PRIVATE_GATEWAY_API_KEY env is set)', required: false })
  @ApiResponse({ status: 201, description: 'Invoice created — returns reference, receivingAddress, amountUsdc, expiresAt, merchantName' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid or missing X-Api-Key' })
  createInvoice(@Body() dto: CreatePrivateInvoiceDto) {
    return this.gatewayService.createInvoice(dto);
  }

  // ── GET /private-gateway/invoice/:ref ─────────────────────────────────────
  // Public — used by Veil wallet after scanning the QR code.
  @Get('invoice/:ref')
  @Public()
  @ApiOperation({
    summary: 'Resolve invoice (public)',
    description:
      'Returns invoice details for display in the Veil wallet — merchant name, amount, ' +
      'receiving address, and the text memo the customer must attach to their Stellar payment.',
  })
  @ApiParam({ name: 'ref', example: 'PI-A1B2C3D4E5F6G7H8', description: 'Invoice reference' })
  @ApiResponse({ status: 200, description: 'Invoice resolved' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  resolveInvoice(@Param('ref') ref: string) {
    return this.gatewayService.resolveInvoice(ref);
  }

  // ── GET /private-gateway/invoice/:ref/status ──────────────────────────────
  // Merchant polls this to track payment progression.
  @Get('invoice/:ref/status')
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: 'Poll invoice status',
    description:
      'Returns the current status and settlement details for a private invoice. ' +
      'Poll every 3–5 seconds until status is settled or failed.',
  })
  @ApiHeader({ name: 'X-Api-Key', description: 'Merchant API key', required: false })
  @ApiParam({ name: 'ref', example: 'PI-A1B2C3D4E5F6G7H8', description: 'Invoice reference' })
  @ApiResponse({ status: 200, description: 'Invoice status' })
  @ApiResponse({ status: 401, description: 'Invalid or missing X-Api-Key' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  getStatus(@Param('ref') ref: string) {
    return this.gatewayService.getInvoiceStatus(ref);
  }
}
