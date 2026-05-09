import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
}
