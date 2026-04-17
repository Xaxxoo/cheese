import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { WalletService } from '../services/wallet.service';
import { BlockchainTransactionService } from '../services/blockchain-transaction.service';
import {
  CreateWalletDto,
  DebitWalletDto,
  CreditWalletDto,
  TransferByUsernameDto,
  BlockchainTxFilterDto,
  UsernameResolveResponseDto,
} from '../dto/blockchain.dto';

@Controller('blockchain')
@UseGuards(ThrottlerGuard)
export class BlockchainController {
  constructor(
    private readonly walletService: WalletService,
    private readonly blockchainTxService: BlockchainTransactionService,
  ) {}

  // ── Wallet ────────────────────────────────────────────────────────────────

  /**
   * POST /blockchain/wallets
   * Create an on-chain wallet for a user.
   * Called once per user, during OTP verification in the auth flow.
   * Rate limited: 3 per 10 min per IP (prevents abuse of contract gas).
   */
  @Post('wallets')
  @Throttle({ default: { ttl: 600_000, limit: 3 } })
  @HttpCode(HttpStatus.CREATED)
  createWallet(@Body() dto: CreateWalletDto) {
    return this.walletService.createWallet(dto.userId, dto.username);
  }

  /**
   * GET /blockchain/wallets/:userId
   * Get wallet info for a user, including status and on-chain address.
   */
  @Get('wallets/:userId')
  getWallet(@Param('userId') userId: string) {
    return this.walletService.getWalletByUserId(userId);
  }

  /**
   * GET /blockchain/wallets/:userId/balance
   * Live USDC/USDT balance read directly from the smart contract.
   * Each call triggers a view call to the RPC node — no DB cache.
   */
  @Get('wallets/:userId/balance')
  getBalance(@Param('userId') userId: string) {
    return this.walletService.getBalance(userId);
  }

  /**
   * GET /blockchain/wallets/:userId/transactions
   * Paginated history of all blockchain transactions for a wallet.
   */
  @Get('wallets/:userId/transactions')
  getWalletTransactions(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.walletService.getTransactionHistory(userId, +page, +limit);
  }

  // ── Token operations ──────────────────────────────────────────────────────

  /**
   * POST /blockchain/wallets/debit
   * Debit USDC/USDT from a user's wallet to the platform treasury.
   * Triggered by the accounting module's processTransaction().
   * Rate limited: 10 per minute per IP.
   */
  @Post('wallets/debit')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async debitWallet(@Body() dto: DebitWalletDto) {
    const result = await this.walletService.debit(
      dto.userId,
      dto.amount,
      dto.appReference,
    );
    return result;
  }

  /**
   * POST /blockchain/wallets/credit
   * Credit USDC/USDT from the platform treasury to a user's wallet.
   * Triggered by reversal flows.
   */
  @Post('wallets/credit')
  @HttpCode(HttpStatus.OK)
  async creditWallet(@Body() dto: CreditWalletDto) {
    const result = await this.walletService.credit(
      dto.userId,
      dto.amount,
      dto.appReference,
    );
    return result;
  }

  /**
   * POST /blockchain/wallets/transfer
   * Peer-to-peer transfer between two wallets, routed on-chain by username.
   * Both sender and recipient must have active wallets with registered usernames.
   * Rate limited: 5 per minute per IP.
   */
  @Post('wallets/transfer')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async transferByUsername(@Body() dto: TransferByUsernameDto) {
    const result = await this.walletService.transferByUsername(
      dto.fromUsername,
      dto.toUsername,
      dto.amount,
      dto.appReference,
    );
    return result;
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  /**
   * PATCH /blockchain/wallets/:userId/suspend
   * Suspend a wallet — blocks all further contract operations.
   */
  @Patch('wallets/:userId/suspend')
  @HttpCode(HttpStatus.OK)
  suspendWallet(
    @Param('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.walletService.suspendWallet(userId, reason);
  }

  /**
   * PATCH /blockchain/wallets/:userId/reinstate
   * Reinstate a suspended wallet.
   */
  @Patch('wallets/:userId/reinstate')
  @HttpCode(HttpStatus.OK)
  reinstateWallet(@Param('userId') userId: string) {
    return this.walletService.reinstateWallet(userId);
  }

  // ── Username resolution ───────────────────────────────────────────────────

  /**
   * GET /blockchain/username/:username/resolve
   * Check whether a username is registered on-chain and get its wallet address.
   * Used by the payment initiation flow to validate recipient usernames.
   */
  @Get('username/:username/resolve')
  async resolveUsername(
    @Param('username') username: string,
  ): Promise<UsernameResolveResponseDto> {
    const result = await this.walletService.resolveUsername(username);
    return { username, ...result };
  }

  // ── Blockchain transactions ───────────────────────────────────────────────

  /**
   * GET /blockchain/transactions
   * Query blockchain transactions with filters. Admin endpoint.
   */
  @Get('transactions')
  queryTransactions(@Query() filters: BlockchainTxFilterDto) {
    return this.blockchainTxService.query(filters);
  }

  /**
   * GET /blockchain/transactions/:id
   * Get a single blockchain transaction by internal UUID.
   */
  @Get('transactions/:id')
  getTransaction(@Param('id') id: string) {
    return this.blockchainTxService.getById(id);
  }

  /**
   * GET /blockchain/transactions/by-hash/:txHash
   * Look up a blockchain transaction by its on-chain tx hash (0x…).
   */
  @Get('transactions/by-hash/:txHash')
  getTransactionByHash(@Param('txHash') txHash: string) {
    return this.blockchainTxService.getByTxHash(txHash);
  }

  /**
   * GET /blockchain/transactions/by-reference/:reference
   * Get all blockchain transactions linked to an app-level reference (CHZ-…).
   */
  @Get('transactions/by-reference/:reference')
  getTransactionsByReference(@Param('reference') reference: string) {
    return this.blockchainTxService.getByAppReference(reference);
  }
}
