import { Controller, Get, Patch, Delete, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
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

  // ── GET /admin/transactions ────────────────────────────────────────────────
  @Get('transactions')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all transactions (paginated, filterable)' })
  listTransactions(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
    @Query('type')   type?:   string,
    @Query('search') search?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminAuthService.listTransactions({
      page:  Math.max(1, parseInt(page  ?? '1',  10)),
      limit: Math.min(100, parseInt(limit ?? '20', 10)),
      status,
      type,
      search,
      userId,
    });
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

  // ── DELETE /admin/users/:id ────────────────────────────────────────────────
  @Delete('users/:id')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a user (super_admin only)' })
  async deleteUser(@Param('id') id: string, @CurrentUser() requester: User) {
    await this.adminAuthService.deleteUser(id, requester);
  }

  // ── PATCH /admin/users/:id/status ─────────────────────────────────────────
  @Patch('users/:id/status')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  setUserStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.adminAuthService.setUserActive(id, isActive);
  }

  // ── GET /admin/kyc ────────────────────────────────────────────────────────
  @Get('kyc')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List users with KYC info (filterable, paginated)' })
  listKycUsers(
    @Query('page')         page?:         string,
    @Query('limit')        limit?:        string,
    @Query('search')       search?:       string,
    @Query('tier')         tier?:         string,
    @Query('kyc')          kyc?:          string,
    @Query('pendingBlack') pendingBlack?: string,
  ) {
    return this.adminAuthService.listKycUsers({
      page:         Math.max(1, parseInt(page  ?? '1',  10)),
      limit:        Math.min(100, parseInt(limit ?? '20', 10)),
      search,
      tier,
      kyc,
      pendingBlack: pendingBlack === 'true',
    });
  }

  // ── POST /admin/kyc/:id/approve ────────────────────────────────────────────
  @Post('kyc/:id/approve')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve Black tier for a user' })
  approveBlack(@Param('id') id: string) {
    return this.adminAuthService.approveBlackTier(id);
  }

  // ── POST /admin/kyc/:id/reject ─────────────────────────────────────────────
  @Post('kyc/:id/reject')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject Black tier request for a user' })
  rejectBlack(@Param('id') id: string, @Body('reason') reason: string) {
    return this.adminAuthService.rejectBlackTier(id, reason ?? '');
  }

  // ── GET /admin/cards ───────────────────────────────────────────────────────
  @Get('cards')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List virtual cards (paginated, filterable)' })
  listCards(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminAuthService.listAdminCards({
      page:  Math.max(1, parseInt(page  ?? '1',  10)),
      limit: Math.min(100, parseInt(limit ?? '20', 10)),
      status,
      search,
    });
  }

  // ── GET /admin/waitlist ────────────────────────────────────────────────────
  @Get('waitlist')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List waitlist entries (paginated, filterable)' })
  listWaitlist(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminAuthService.listWaitlistEntries({
      page:  Math.max(1, parseInt(page  ?? '1',  10)),
      limit: Math.min(100, parseInt(limit ?? '20', 10)),
      status,
      search,
    });
  }
}
