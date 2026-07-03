// src/admin-auth/admin-treasury.controller.ts
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsNumberString, IsString, IsUUID, Matches } from 'class-validator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminTreasuryService } from './admin-treasury.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, AdminRole } from '../auth/entities/user.entity';

class TreasuryTransferDto {
  @IsString()
  @Matches(/^G[A-Z0-9]{55}$/, { message: 'Invalid Stellar address' })
  toAddress: string;

  @IsNumberString({}, { message: 'amountUsdc must be a numeric string' })
  amountUsdc: string;
}

class RecoverContractBalanceDto {
  @IsUUID()
  userId: string;

  @IsNumberString({}, { message: 'amountUsdc must be a numeric string' })
  amountUsdc: string;
}

class SweepClassicWalletDto {
  @IsUUID()
  userId: string;
}

@ApiTags('Admin – Treasury')
@Controller('admin/treasury')
@UseGuards(AdminJwtGuard)
@ApiBearerAuth('access-token')
export class AdminTreasuryController {
  constructor(private readonly treasury: AdminTreasuryService) {}

  // ── GET /admin/treasury ──────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Platform treasury USDC balance and address' })
  getBalance() {
    return this.treasury.getBalance();
  }

  // ── POST /admin/treasury/transfer ────────────────────────────────────────
  @Post('transfer')
  @ApiOperation({ summary: 'Transfer USDC out of the platform treasury wallet' })
  transfer(
    @CurrentUser() admin: User,
    @Body() dto: TreasuryTransferDto,
  ) {
    const allowed: AdminRole[] = [AdminRole.SUPER_ADMIN, AdminRole.TREASURER];
    if (!admin.adminRole || !allowed.includes(admin.adminRole)) {
      throw new ForbiddenException(
        'Only super_admin or treasurer roles can initiate treasury transfers',
      );
    }
    return this.treasury.transfer(dto.toAddress, dto.amountUsdc);
  }

  // ── POST /admin/treasury/evm-withdraw ────────────────────────────────────
  @Post('evm-withdraw')
  @ApiOperation({ summary: 'Sweep all available funds from the EVM CheeseVault' })
  evmWithdraw(@CurrentUser() admin: User) {
    const allowed: AdminRole[] = [AdminRole.SUPER_ADMIN, AdminRole.TREASURER];
    if (!admin.adminRole || !allowed.includes(admin.adminRole)) {
      throw new ForbiddenException('Only super_admin or treasurer roles can withdraw from the vault');
    }
    return this.treasury.evmWithdraw();
  }

  // ── POST /admin/treasury/recover-contract-balance ─────────────────────────
  @Post('recover-contract-balance')
  @ApiOperation({
    summary: 'Return a user\'s USDC from the Soroban contract back to their Stellar address',
  })
  recoverContractBalance(
    @CurrentUser() admin: User,
    @Body() dto: RecoverContractBalanceDto,
  ) {
    const allowed: AdminRole[] = [AdminRole.SUPER_ADMIN, AdminRole.TREASURER];
    if (!admin.adminRole || !allowed.includes(admin.adminRole)) {
      throw new ForbiddenException(
        'Only super_admin or treasurer roles can recover contract balances',
      );
    }
    return this.treasury.recoverContractBalance({
      userId: dto.userId,
      amountUsdc: dto.amountUsdc,
    });
  }

  // ── GET /admin/treasury/lookup-addresses ─────────────────────────────────
  @Get('lookup-addresses')
  @ApiOperation({ summary: 'Map Stellar addresses to usernames' })
  lookupAddresses(@Query('addresses') addresses: string) {
    const list = (addresses ?? '').split(',').map((a) => a.trim()).filter(Boolean);
    return this.treasury.lookupAddresses(list);
  }

  // ── POST /admin/treasury/restore-contract-balances ───────────────────────
  @Post('restore-contract-balances')
  @ApiOperation({
    summary: 'Restore expired Soroban Balance entries for given usernames so drain can process them',
  })
  restoreContractBalances(
    @CurrentUser() admin: User,
    @Body() body: { usernames: string[] },
  ) {
    if (admin.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can restore contract balances');
    }
    return this.treasury.restoreContractBalances(body.usernames ?? []);
  }

  // ── POST /admin/treasury/sweep-classic-wallet ────────────────────────────
  @Post('sweep-classic-wallet')
  @ApiOperation({
    summary: "Sweep USDC from a user's classic Stellar wallet to the platform treasury",
  })
  sweepClassicWallet(
    @CurrentUser() admin: User,
    @Body() dto: SweepClassicWalletDto,
  ) {
    const allowed: AdminRole[] = [AdminRole.SUPER_ADMIN, AdminRole.TREASURER];
    if (!admin.adminRole || !allowed.includes(admin.adminRole)) {
      throw new ForbiddenException(
        'Only super_admin or treasurer roles can sweep wallets',
      );
    }
    return this.treasury.sweepClassicWallet({ userId: dto.userId });
  }

  // ── POST /admin/treasury/contract-drain-all ────────────────────────────────
  @Post('contract-drain-all')
  @ApiOperation({
    summary: 'Drain ALL USDC from the Soroban contract back to the platform treasury (tracked balances + excess)',
  })
  contractDrainAll(@CurrentUser() admin: User) {
    if (admin.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can drain the contract');
    }
    return this.treasury.contractDrainAll();
  }
}
