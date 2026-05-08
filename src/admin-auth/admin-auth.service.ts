import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, AdminRole } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly rtRepo: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(
    dto: AdminLoginDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{
    admin: ReturnType<typeof this.sanitise>;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email, isActive: true },
    });

    if (!user || !user.isAdmin || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const { accessToken, refreshToken } = await this.issueTokens(user, meta);
    return { admin: this.sanitise(user), accessToken, refreshToken };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.rtRepo.update({ tokenHash }, { isRevoked: true });
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(
    oldRefreshToken: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string }> {
    const tokenHash = createHash('sha256')
      .update(oldRefreshToken)
      .digest('hex');

    const stored = await this.rtRepo.findOne({
      where: { tokenHash, isRevoked: false },
      relations: ['user'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (!stored.user.isAdmin) {
      throw new UnauthorizedException('Not an admin account');
    }

    // Rotate — revoke old, issue new
    await this.rtRepo.update({ tokenHash }, { isRevoked: true });
    const { accessToken, refreshToken: newRefresh } = await this.issueTokens(
      stored.user,
      meta,
    );

    // Return new refresh token so controller can set the cookie
    return { accessToken, refreshToken: newRefresh } as unknown as {
      accessToken: string;
    };
  }

  // ── Me ────────────────────────────────────────────────────────────────────

  sanitise(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName ?? user.email.split('@')[0],
      adminRole: user.adminRole,
      mustChangePassword: user.mustChangePassword ?? false,
    };
  }

  // ── Admin management ──────────────────────────────────────────────────────

  sanitiseAdmin(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName ?? user.email.split('@')[0],
      adminRole: user.adminRole,
      createdAt: user.createdAt,
    };
  }

  async listAdmins() {
    const admins = await this.userRepo.find({
      where: { isAdmin: true },
      order: { createdAt: 'DESC' },
    });
    return admins.map((u) => this.sanitiseAdmin(u));
  }

  async createAdmin(dto: CreateAdminDto, requester: User) {
    if (requester.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can manage admins');
    }

    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      if (existing.isAdmin) {
        throw new ConflictException('Already an admin');
      }
      // Promote existing user
      existing.isAdmin = true;
      existing.adminRole = dto.adminRole;
      const saved = await this.userRepo.save(existing);
      return this.sanitiseAdmin(saved);
    }

    // Create brand-new admin account
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const prefix = dto.email
      .split('@')[0]
      .replace(/[^a-z0-9_]/gi, '')
      .slice(0, 16);
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const username = `${prefix}_${suffix}`;

    const user = this.userRepo.create({
      email: dto.email,
      fullName: dto.fullName,
      username,
      passwordHash,
      isAdmin: true,
      adminRole: dto.adminRole,
      emailVerified: true,
      isActive: true,
      mustChangePassword: true,
    });

    const saved = await this.userRepo.save(user);
    return this.sanitiseAdmin(saved);
  }

  async updateAdminRole(
    targetId: string,
    dto: UpdateAdminRoleDto,
    requester: User,
  ) {
    if (requester.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can manage admins');
    }
    if (targetId === requester.id) {
      throw new BadRequestException('Cannot change own role');
    }

    const target = await this.userRepo.findOne({ where: { id: targetId } });
    if (!target || !target.isAdmin) {
      throw new NotFoundException('Admin not found');
    }

    target.adminRole = dto.adminRole;
    const saved = await this.userRepo.save(target);
    return this.sanitiseAdmin(saved);
  }

  async revokeAdmin(targetId: string, requester: User) {
    if (requester.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can manage admins');
    }
    if (targetId === requester.id) {
      throw new BadRequestException('Cannot revoke yourself');
    }

    const target = await this.userRepo.findOne({ where: { id: targetId } });
    if (!target || !target.isAdmin) {
      throw new NotFoundException('Admin not found');
    }

    // Protect last super_admin
    if (target.adminRole === AdminRole.SUPER_ADMIN) {
      const superCount = await this.userRepo.count({
        where: { isAdmin: true, adminRole: AdminRole.SUPER_ADMIN },
      });
      if (superCount <= 1) {
        throw new BadRequestException('Cannot revoke the last super_admin');
      }
    }

    target.isAdmin = false;
    target.adminRole = null;
    await this.userRepo.save(target);

    // Revoke all active refresh tokens
    await this.rtRepo.update({ userId: targetId }, { isRevoked: true });
  }

  // ── Change password ───────────────────────────────────────────────────────

  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await this.userRepo.save(user);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async issueTokens(
    user: User,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      isAdmin: true,
      adminRole: user.adminRole,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: '8h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.refreshSecret'),
      expiresIn: '7d',
    });

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const expiresAt = new Date(this.jwtService.decode(refreshToken).exp * 1000);

    await this.rtRepo.save(
      this.rtRepo.create({
        userId: user.id,
        tokenHash,
        deviceId: null,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ip ?? null,
      }),
    );

    return { accessToken, refreshToken };
  }
}
