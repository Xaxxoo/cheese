import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';

const REFRESH_COOKIE = 'admin_refresh_token';

const COOKIE_OPTS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/v1/admin/auth',   // must match the global prefix so browser sends cookie on refresh
  maxAge,
});

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  // ── POST /admin/auth/login ─────────────────────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
    const { admin, accessToken, refreshToken } =
      await this.adminAuthService.login(dto, meta);

    res.cookie(
      REFRESH_COOKIE,
      refreshToken,
      COOKIE_OPTS(7 * 24 * 60 * 60 * 1000),
    );

    return { admin, accessToken };
  }

  // ── POST /admin/auth/refresh ───────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate admin refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldToken: string | undefined = (
      req.cookies as Record<string, string>
    )[REFRESH_COOKIE];

    if (!oldToken) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'No refresh token' });
      return;
    }

    const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
    const result = (await this.adminAuthService.refresh(
      oldToken,
      meta,
    )) as unknown as {
      accessToken: string;
      refreshToken: string;
    };

    res.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      COOKIE_OPTS(7 * 24 * 60 * 60 * 1000),
    );
    return { accessToken: result.accessToken };
  }

  // ── POST /admin/auth/logout ────────────────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin logout' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: string | undefined = (req.cookies as Record<string, string>)[
      REFRESH_COOKIE
    ];

    if (token) await this.adminAuthService.logout(token);

    res.clearCookie(REFRESH_COOKIE, { path: '/v1/admin/auth' });
    return { message: 'Logged out' };
  }

  // ── GET /admin/auth/me ─────────────────────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current admin profile' })
  getMe(@CurrentUser() user: User) {
    return { admin: this.adminAuthService.sanitise(user) };
  }

  // ── GET /admin/auth/admins ─────────────────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Get('admins')
  @ApiOperation({ summary: 'List all admins' })
  async listAdmins() {
    return { admins: await this.adminAuthService.listAdmins() };
  }

  // ── POST /admin/auth/admins ────────────────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Post('admins')
  @ApiOperation({ summary: 'Create or promote an admin' })
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @CurrentUser() requester: User,
  ) {
    return { admin: await this.adminAuthService.createAdmin(dto, requester) };
  }

  // ── PATCH /admin/auth/admins/:id/role ──────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Patch('admins/:id/role')
  @ApiOperation({ summary: 'Change an admin role' })
  async updateAdminRole(
    @Param('id') id: string,
    @Body() dto: UpdateAdminRoleDto,
    @CurrentUser() requester: User,
  ) {
    return {
      admin: await this.adminAuthService.updateAdminRole(id, dto, requester),
    };
  }

  // ── PATCH /admin/auth/change-password ─────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own admin password' })
  async changePassword(
    @Body() dto: ChangeAdminPasswordDto,
    @CurrentUser() user: User,
  ) {
    await this.adminAuthService.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password updated' };
  }

  // ── DELETE /admin/auth/admins/:id ──────────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Delete('admins/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke admin access' })
  async revokeAdmin(@Param('id') id: string, @CurrentUser() requester: User) {
    await this.adminAuthService.revokeAdmin(id, requester);
    return { message: 'Revoked' };
  }
}
