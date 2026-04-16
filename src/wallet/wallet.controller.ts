// src/wallet/wallet.controller.ts
import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth('access-token')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Get total wallet balance',
    description:
      'Aggregates Stellar contract balance + EVM balance in parallel. Returns totalUsdc, ngnEquivalent, and per-chain breakdowns.',
  })
  @ApiResponse({
    status: 200,
    description:
      'stellarUsdc, evmUsdc, totalUsdc, totalUsdcDisplay, ngnEquivalent, ngnRate, lastUpdated',
  })
  getBalance(@CurrentUser() user: User) {
    return this.walletService.getBalance(user.id);
  }

  @Get('address')
  @ApiOperation({
    summary: 'Get deposit addresses',
    description:
      'Returns the Stellar address (primary USDC deposit path) and the EVM address.',
  })
  @ApiResponse({
    status: 200,
    description: 'stellarAddress, evmAddress, network, asset',
  })
  getAddress(@CurrentUser() user: User) {
    return this.walletService.getAddress(user.id);
  }

  @Post('provision')
  @ApiOperation({
    summary: 'Provision missing wallets',
    description:
      'Creates a Stellar wallet for the authenticated user if one does not exist yet. Safe to call multiple times — idempotent.',
  })
  @ApiResponse({ status: 201, description: 'stellarPublicKey, alreadyExisted' })
  provisionWallet(@CurrentUser() user: User) {
    return this.walletService.provisionWallet(user.id);
  }

  @Get('deposit-networks')
  @ApiOperation({
    summary: 'List supported deposit networks',
    description:
      'Returns Stellar and EVM deposit options with fees, confirmation times, and instructions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of supported deposit networks',
  })
  getDepositNetworks() {
    return this.walletService.getDepositNetworks();
  }
}
