import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAuthService } from './admin-auth.service';

@ApiTags('Admin')
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  // ── GET /admin/stats ───────────────────────────────────────────────────────
  @Get('stats')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dashboard KPI statistics' })
  getStats() {
    return this.adminAuthService.getStats();
  }

  // ── GET /admin/users ───────────────────────────────────────────────────────
  @Get('users')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all app users (paginated)' })
  listUsers(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('search') search?: string,
    @Query('tier')   tier?:   string,
    @Query('kyc')    kyc?:    string,
  ) {
    return this.adminAuthService.listUsers({
      page:  Math.max(1, parseInt(page  ?? '1',  10)),
      limit: Math.min(100, parseInt(limit ?? '20', 10)),
      search,
      tier,
      kyc,
    });
  }

  // ── GET /admin/health ──────────────────────────────────────────────────────
  @Get('health')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Service health status' })
  getHealth() {
    return this.adminAuthService.getHealth();
  }

  // ── GET /admin/transfers ───────────────────────────────────────────────────
  @Get('transfers')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List bank transfers (paginated, filterable)' })
  listTransfers(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminAuthService.listTransfers({
      page:   Math.max(1, parseInt(page  ?? '1',  10)),
      limit:  Math.min(100, parseInt(limit ?? '20', 10)),
      status,
      search,
      userId,
    });
  }

  // ── GET /admin/users/:id ───────────────────────────────────────────────────
  @Get('users/:id')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get detailed user profile' })
  getUserDetail(@Param('id') id: string) {
    return this.adminAuthService.getUserDetail(id);
  }

  // ── PATCH /admin/transfers/:id/complete ───────────────────────────────────
  @Patch('transfers/:id/complete')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Manually mark a bank transfer as completed' })
  completeTransfer(@Param('id') id: string) {
    return this.adminAuthService.completeTransfer(id);
  }

  // ── PATCH /admin/users/:id/kyc ────────────────────────────────────────────
  @Patch('users/:id/kyc')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Manually set a user KYC status to verified' })
  setUserKycVerified(@Param('id') id: string) {
    return this.adminAuthService.setUserKycVerified(id);
  }

  // ── PATCH /admin/users/:id/flag ────────────────────────────────────────────
  @Patch('users/:id/flag')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Flag or unflag a user' })
  flagUser(@Param('id') id: string, @Body('flag') flag: boolean) {
    return this.adminAuthService.flagUser(id, flag);
  }

  // ── GET /admin/paylinks ────────────────────────────────────────────────────
  @Get('paylinks')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all pay links (paginated, filterable)' })
  listPaylinks(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminAuthService.listPaylinks({
      page:  Math.max(1, parseInt(page  ?? '1',  10)),
      limit: Math.min(100, parseInt(limit ?? '20', 10)),
      status,
      search,
    });
  }

  // ── PATCH /admin/users/:id/status ─────────────────────────────────────────
  @Patch('users/:id/status')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  setUserStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.adminAuthService.setUserActive(id, isActive);
  }
}
