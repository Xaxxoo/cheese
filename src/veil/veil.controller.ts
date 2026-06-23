// src/veil/veil.controller.ts
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
import { VeilService } from './veil.service';
import { DepositDto, PayInvoiceDto } from './dto';
import { ApiKeyGuard } from '../private-gateway/guards/api-key.guard';

@ApiTags('Veil (ZK Private Payments)')
@Controller('veil')
export class VeilController {
  constructor(private readonly veilService: VeilService) {}

  // ── POST /veil/deposit ────────────────────────────────────────────────────
  // Deposit USDC into the shielded pool and receive a private note.
  // The returned note ID is needed to pay invoices.
  @Post('deposit')
  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Deposit USDC into the Veil shielded pool',
    description:
      'Generates a shielded note (secret + nullifier → Poseidon commitment), ' +
      'registers the commitment in the Soroban VeilPool contract, and returns the note ID. ' +
      'The depositor\'s address is visible on-chain at this step only; ' +
      'all subsequent payments from this note are routed through the pool contract.',
  })
  @ApiHeader({ name: 'X-Api-Key', required: false })
  @ApiResponse({ status: 201, description: 'Note created — returns noteId, commitment, depositTxHash' })
  deposit(@Body() dto: DepositDto) {
    return this.veilService.deposit(dto);
  }

  // ── POST /veil/pay ────────────────────────────────────────────────────────
  // Pay a private invoice using a shielded note.
  // Generates a Groth16 ZK proof, submits it to the Soroban contract,
  // which verifies the proof on-chain and routes USDC to the Cheese hot wallet.
  @Post('pay')
  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pay a private invoice using a shielded note (ZK proof)',
    description:
      'Generates a Groth16 proof off-chain (snarkjs) proving that the caller knows ' +
      'the secret behind a committed note and that the note amount covers the invoice. ' +
      'Submits the proof to the Soroban VeilPool contract for on-chain verification using ' +
      'BN254 pairing host functions. On success, the pool contract transfers USDC to ' +
      'Cheese\'s hot wallet with the invoice reference in the memo — Cheese detects it ' +
      'and triggers NGN settlement to the merchant\'s bank account.',
  })
  @ApiHeader({ name: 'X-Api-Key', required: false })
  @ApiResponse({ status: 200, description: 'Payment submitted — returns sorobanTxHash, nullifierHash' })
  @ApiResponse({ status: 400, description: 'Note already spent or insufficient amount' })
  payInvoice(@Body() dto: PayInvoiceDto) {
    return this.veilService.payInvoice(dto);
  }

  // ── GET /veil/notes/:userId ───────────────────────────────────────────────
  @Get('notes/:userId')
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "List user's active shielded notes" })
  @ApiHeader({ name: 'X-Api-Key', required: false })
  @ApiParam({ name: 'userId', description: 'Cheese user UUID' })
  @ApiResponse({ status: 200, description: 'List of active notes (no secrets returned)' })
  listNotes(@Param('userId') userId: string) {
    return this.veilService.listNotes(userId);
  }
}
