// src/admin-auth/admin-treasury.controller.ts
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNumberString, IsString, Matches } from 'class-validator';
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
}
