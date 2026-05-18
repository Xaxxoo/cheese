import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, AdminRole, KycStatus, Tier, WalletStatus } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Transaction, TxStatus } from '../transactions/entities/transaction.entity';
import { BankTransfer, BankTransferStatus } from '../banks/entities/bank-transfer.entity';
import { PaymentRequest } from '../paylink/entities/payment-request.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';
import { BlockchainService } from '../blockchain/services/blockchain.service';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly rtRepo: Repository<RefreshToken>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(BankTransfer)
    private readonly bankTransferRepo: Repository<BankTransfer>,

    @InjectRepository(PaymentRequest)
    private readonly paymentRequestRepo: Repository<PaymentRequest>,

    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
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

  // ── Dashboard stats ───────────────────────────────────────────────────────

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      verifiedUsers,
      premiumUsers,
      pendingKyc,
      totalTransactions,
      activeWallets,
      pendingWallets,
      failedWallets,
      activeEvmWallets,
      pendingEvmWallets,
      failedEvmWallets,
      failedBankTransfersToday,
      flaggedUsers,
      volumeResult,
    ] = await Promise.all([
      this.userRepo.count({ where: { isAdmin: false } }),
      this.userRepo.count({ where: { isAdmin: false, kycStatus: KycStatus.VERIFIED } }),
      this.userRepo.count({ where: { isAdmin: false, tier: In([Tier.GOLD, Tier.BLACK]) } }),
      this.userRepo.count({ where: { isAdmin: false, kycStatus: KycStatus.SUBMITTED } }),
      this.txRepo.count(),
      this.userRepo.count({ where: { isAdmin: false, stellarWalletStatus: WalletStatus.ACTIVE  } }),
      this.userRepo.count({ where: { isAdmin: false, stellarWalletStatus: WalletStatus.PENDING } }),
      this.userRepo.count({ where: { isAdmin: false, stellarWalletStatus: WalletStatus.FAILED  } }),
      this.userRepo.count({ where: { isAdmin: false, evmWalletStatus: WalletStatus.ACTIVE  } }),
      this.userRepo.count({ where: { isAdmin: false, evmWalletStatus: WalletStatus.PENDING } }),
      this.userRepo.count({ where: { isAdmin: false, evmWalletStatus: WalletStatus.FAILED  } }),
      this.bankTransferRepo.count({ where: { status: BankTransferStatus.FAILED, createdAt: MoreThanOrEqual(today) } }),
      this.userRepo.count({ where: { isAdmin: false, isFlagged: true } }),
      this.txRepo
        .createQueryBuilder('t')
        .select('SUM(CAST(t.amount_usdc AS DECIMAL(20,6)))', 'total')
        .where('t.status = :s', { s: TxStatus.COMPLETED })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      premiumUsers,
      pendingKyc,
      totalTransactions,
      activeWallets,
      pendingWallets,
      failedWallets,
      activeEvmWallets,
      pendingEvmWallets,
      failedEvmWallets,
      failedBankTransfersToday,
      flaggedUsers,
      totalVolumeUsdc: parseFloat(volumeResult?.total ?? '0') || 0,
    };
  }

  // ── User listing ──────────────────────────────────────────────────────────

  async listUsers(query: {
    page: number;
    limit: number;
    search?: string;
    tier?: string;
    kyc?: string;
  }) {
    const { page, limit, search, tier, kyc } = query;

    const kycMap: Record<string, string> = {
      reviewing: KycStatus.SUBMITTED,
      failed:    KycStatus.REJECTED,
    };

    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.is_admin = :isAdmin', { isAdmin: false })
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere(
        '(LOWER(u.username) LIKE :q OR LOWER(u.full_name) LIKE :q OR LOWER(u.email) LIKE :q)',
        { q: `%${search.toLowerCase()}%` },
      );
    }
    if (tier && tier.toLowerCase() !== 'all') {
      qb.andWhere('u.tier = :tier', { tier: tier.toLowerCase() });
    }
    if (kyc && kyc.toLowerCase() !== 'all') {
      const mapped = kycMap[kyc.toLowerCase()] ?? kyc.toLowerCase();
      qb.andWhere('u.kyc_status = :kyc', { kyc: mapped });
    }

    const [users, total] = await qb.getManyAndCount();

    const kycDisplay: Record<string, string> = {
      [KycStatus.PENDING]:   'Pending',
      [KycStatus.SUBMITTED]: 'Reviewing',
      [KycStatus.VERIFIED]:  'Verified',
      [KycStatus.REJECTED]:  'Failed',
    };

    return {
      users: users.map((u) => ({
        id:           u.id,
        name:         u.fullName || u.username,
        username:     `@${u.username}`,
        email:        u.email,
        tier:         u.tier.charAt(0).toUpperCase() + u.tier.slice(1),
        kycStatus:    kycDisplay[u.kycStatus] ?? u.kycStatus,
        walletStatus: u.stellarWalletStatus.charAt(0).toUpperCase() + u.stellarWalletStatus.slice(1),
        isFlagged:    u.isFlagged,
        createdAt:    u.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Transfers listing ─────────────────────────────────────────────────────

  async listTransfers(query: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
    userId?: string;
  }) {
    const { page, limit, status, search, userId } = query;

    const qb = this.bankTransferRepo
      .createQueryBuilder('bt')
      .orderBy('bt.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && status !== 'all') {
      qb.andWhere('bt.status = :status', { status });
    }
    if (userId) {
      qb.andWhere('bt.user_id = :userId', { userId });
    }
    if (search) {
      // Username search uses a subquery to avoid a join on the duplicate user_id column
      qb.andWhere(
        `(LOWER(bt.reference) LIKE :q
          OR LOWER(bt.account_name) LIKE :q
          OR LOWER(bt.bank_name) LIKE :q
          OR bt.user_id IN (
            SELECT u.id FROM users u WHERE LOWER(u.username) LIKE :q
          ))`,
        { q: `%${search.toLowerCase()}%` },
      );
    }

    const [transfers, total] = await qb.getManyAndCount();

    // Fetch usernames in a single query rather than joining
    const uniqueUserIds = [...new Set(transfers.map((bt) => bt.userId))];
    const usernameMap = new Map<string, string>();
    if (uniqueUserIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(uniqueUserIds) },
        select: ['id', 'username'],
      });
      users.forEach((u) => usernameMap.set(u.id, u.username));
    }

    return {
      transfers: transfers.map((bt) => ({
        id:            bt.id,
        reference:     bt.reference,
        username:      usernameMap.get(bt.userId) ?? '—',
        userId:        bt.userId,
        bankName:      bt.bankName,
        accountName:   bt.accountName,
        accountNumber: bt.accountNumber,
        amountNgn:     bt.amountNgn,
        amountUsdc:    bt.amountUsdc,
        status:        bt.status,
        failureReason: bt.failureReason,
        createdAt:     bt.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── User detail ───────────────────────────────────────────────────────────

  async getUserDetail(id: string) {
    const user = await this.userRepo.findOne({ where: { id, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');

    const [txCount, failedTransferCount, recentTxs, recentTransfers, balances] =
      await Promise.all([
        this.txRepo.count({ where: { userId: id } }),
        this.bankTransferRepo.count({
          where: { userId: id, status: BankTransferStatus.FAILED },
        }),
        this.txRepo.find({
          where: { userId: id },
          order: { createdAt: 'DESC' },
          take: 5,
        }),
        this.bankTransferRepo.find({
          where: { userId: id },
          order: { createdAt: 'DESC' },
          take: 5,
        }),
        user.stellarPublicKey
          ? this.blockchainService.getStellarBalance(user.stellarPublicKey).catch((e: Error) => {
              this.logger.warn(`getUserDetail: balance fetch failed for ${id}: ${e.message}`);
              return null;
            })
          : Promise.resolve(null),
      ]);

    const kycDisplay: Record<string, string> = {
      [KycStatus.PENDING]:   'Pending',
      [KycStatus.SUBMITTED]: 'Reviewing',
      [KycStatus.VERIFIED]:  'Verified',
      [KycStatus.REJECTED]:  'Failed',
    };

    return {
      id:               user.id,
      name:             user.fullName || user.username,
      username:         user.username,
      email:            user.email,
      phone:            user.phone,
      tier:             user.tier.charAt(0).toUpperCase() + user.tier.slice(1),
      kycStatus:        kycDisplay[user.kycStatus] ?? user.kycStatus,
      walletStatus:     user.stellarWalletStatus.charAt(0).toUpperCase() + user.stellarWalletStatus.slice(1),
      evmWalletStatus:  user.evmWalletStatus.charAt(0).toUpperCase() + user.evmWalletStatus.slice(1),
      stellarPublicKey: user.stellarPublicKey,
      evmAddress:       user.evmAddress,
      isActive:         user.isActive,
      isFlagged:        user.isFlagged,
      emailVerified:    user.emailVerified,
      referralCode:     user.referralCode,
      points:           user.points,
      createdAt:        user.createdAt,
      usdcBalance:      balances?.usdc ?? null,
      txCount,
      failedTransferCount,
      recentTransactions: recentTxs.map((tx) => ({
        id:         tx.id,
        type:       tx.type,
        status:     tx.status,
        amountUsdc: tx.amountUsdc,
        createdAt:  tx.createdAt,
      })),
      recentTransfers: recentTransfers.map((bt) => ({
        id:            bt.id,
        bankName:      bt.bankName,
        accountName:   bt.accountName,
        amountNgn:     bt.amountNgn,
        status:        bt.status,
        failureReason: bt.failureReason,
        createdAt:     bt.createdAt,
      })),
    };
  }

  // ── User actions ──────────────────────────────────────────────────────────

  async flagUser(id: string, flag: boolean) {
    const user = await this.userRepo.findOne({ where: { id, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');
    user.isFlagged = flag;
    await this.userRepo.save(user);
    return { id: user.id, isFlagged: user.isFlagged };
  }

  async setUserActive(id: string, isActive: boolean) {
    const user = await this.userRepo.findOne({ where: { id, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = isActive;
    await this.userRepo.save(user);
    return { id: user.id, isActive: user.isActive };
  }

  async setUserKycVerified(id: string) {
    const user = await this.userRepo.findOne({ where: { id, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');
    user.kycStatus = KycStatus.VERIFIED;
    await this.userRepo.save(user);
    return { id: user.id, kycStatus: user.kycStatus };
  }

  // ── Transfer actions ──────────────────────────────────────────────────────

  async completeTransfer(id: string) {
    const transfer = await this.bankTransferRepo.findOne({ where: { id } });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status === BankTransferStatus.COMPLETED) {
      return { id, status: BankTransferStatus.COMPLETED };
    }
    await this.bankTransferRepo.update({ id }, { status: BankTransferStatus.COMPLETED });
    // Sync the linked transaction row
    const tx = await this.txRepo.findOne({ where: { reference: transfer.reference } });
    if (tx) {
      await this.txRepo.update({ id: tx.id }, { status: TxStatus.COMPLETED });
    }
    return { id, status: BankTransferStatus.COMPLETED };
  }

  // ── Transactions listing ──────────────────────────────────────────────────

  async listTransactions(query: {
    page:    number;
    limit:   number;
    status?: string;
    type?:   string;
    search?: string;
    userId?: string;
  }) {
    const { page, limit, status, type, search, userId } = query;

    const qb = this.txRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && status !== 'all') {
      qb.andWhere('t.status = :status', { status });
    }
    if (type && type !== 'all') {
      qb.andWhere('t.type = :type', { type });
    }
    if (userId) {
      qb.andWhere('t.user_id = :userId', { userId });
    }
    if (search) {
      qb.andWhere(
        `(LOWER(t.reference) LIKE :q
          OR LOWER(t.recipient_username) LIKE :q
          OR LOWER(t.bank_name) LIKE :q
          OR t.user_id IN (SELECT u.id FROM users u WHERE LOWER(u.username) LIKE :q))`,
        { q: `%${search.toLowerCase()}%` },
      );
    }

    const [transactions, total] = await qb.getManyAndCount();

    // Resolve owner usernames without a join
    const uniqueUserIds = [...new Set(transactions.map((t) => t.userId))];
    const usernameMap = new Map<string, string>();
    if (uniqueUserIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(uniqueUserIds) },
        select: ['id', 'username'],
      });
      users.forEach((u) => usernameMap.set(u.id, u.username));
    }

    return {
      transactions: transactions.map((t) => ({
        id:                t.id,
        reference:         t.reference,
        userId:            t.userId,
        username:          usernameMap.get(t.userId) ?? '—',
        type:              t.type,
        status:            t.status,
        amountUsdc:        t.amountUsdc,
        amountNgn:         t.amountNgn,
        feeUsdc:           t.feeUsdc,
        recipientUsername: t.recipientUsername,
        recipientAddress:  t.recipientAddress,
        bankName:          t.bankName,
        txHash:            t.txHash,
        failureReason:     t.failureReason,
        createdAt:         t.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Pay links listing ─────────────────────────────────────────────────────

  async listPaylinks(query: {
    page:    number;
    limit:   number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = query;

    const qb = this.paymentRequestRepo
      .createQueryBuilder('pr')
      .orderBy('pr.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && status !== 'all') {
      qb.andWhere('pr.status = :status', { status });
    }
    if (search) {
      qb.andWhere(
        `(LOWER(pr.note) LIKE :q
          OR pr.creator_id IN (SELECT u.id FROM users u WHERE LOWER(u.username) LIKE :q)
          OR pr.payer_id   IN (SELECT u.id FROM users u WHERE LOWER(u.username) LIKE :q))`,
        { q: `%${search.toLowerCase()}%` },
      );
    }

    const [paylinks, total] = await qb.getManyAndCount();

    // Resolve creator + payer usernames without a join (avoids duplicate-column metadata error)
    const allUserIds = [
      ...new Set([
        ...paylinks.map((pr) => pr.creatorId),
        ...paylinks.filter((pr) => pr.payerId).map((pr) => pr.payerId as string),
      ]),
    ];
    const usernameMap = new Map<string, string>();
    if (allUserIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(allUserIds) },
        select: ['id', 'username'],
      });
      users.forEach((u) => usernameMap.set(u.id, u.username));
    }

    return {
      paylinks: paylinks.map((pr) => ({
        id:              pr.id,
        token:           pr.token,
        creatorId:       pr.creatorId,
        creatorUsername: usernameMap.get(pr.creatorId) ?? '—',
        payerId:         pr.payerId,
        payerUsername:   pr.payerId ? (usernameMap.get(pr.payerId) ?? '—') : null,
        amountUsdc:      pr.amountUsdc,
        note:            pr.note,
        status:          pr.status,
        expiresAt:       pr.expiresAt,
        paidAt:          pr.paidAt,
        settledTxHash:   pr.settledTxHash,
        createdAt:       pr.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Health check ──────────────────────────────────────────────────────────

  getHealth() {
    const cfg = this.config;
    return {
      stellar:  !!cfg.get('STELLAR_HORIZON_URL'),
      evm:      !!(cfg.get('ARBITRUM_RPC_URL') || cfg.get('BLOCKCHAIN_RPC_URL')),
      pulsemfb: !!cfg.get('PULSE_MFB_PUBLIC_KEY'),
      database: true,
      redis:    !!cfg.get('REDIS_URL'),
    };
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
