import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, AdminRole, KycStatus, Tier, WalletStatus } from '../auth/entities/user.entity';
import { NotificationType } from '../notifications/entities/notification.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Transaction, TxStatus, TxType } from '../transactions/entities/transaction.entity';
import { Referral } from '../referral/entities/referral.entity';
import { BankTransfer, BankTransferStatus } from '../banks/entities/bank-transfer.entity';
import { PaymentRequest } from '../paylink/entities/payment-request.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { VirtualCard } from '../cards/entities/virtual-card.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { WalletService as BlockchainWalletService } from '../blockchain/services/wallet.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

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

    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,

    @InjectRepository(VirtualCard)
    private readonly cardRepo: Repository<VirtualCard>,

    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,

    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
    private readonly blockchainWalletService: BlockchainWalletService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Read combined EVM + Stellar balances in small batches to avoid saturating providers. */
  private async getLiveAccountBalances(userIds: string[]): Promise<(string | null)[]> {
    const balances: (string | null)[] = [];
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      balances.push(
        ...(await Promise.all(
          batch.map(async (userId) => {
            try {
              const result = await this.blockchainWalletService.getBalance(userId);
              return result.totalBalance;
            } catch (err) {
              this.logger.warn(`account balance fetch failed [userId=${userId}]: ${(err as Error).message}`);
              return null;
            }
          }),
        )),
      );
    }

    return balances;
  }

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

  async getVolumeChart(days: number): Promise<{ date: string; volume: number }[]> {
    // Build UTC midnight for `days` days ago — avoids local-TZ drift in setDate/getDate
    const now = new Date();
    const since = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1,
    ));

    const rows = await this.txRepo
      .createQueryBuilder('t')
      // TO_CHAR always returns a string 'YYYY-MM-DD'; avoids pg-driver Date-object
      // ambiguity and PostgreSQL session-timezone interference from DATE(timestamptz)
      .select("TO_CHAR(t.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('SUM(CAST(t.amount_usdc AS DECIMAL(20,6)))', 'volume')
      .where('t.status = :s', { s: TxStatus.COMPLETED })
      .andWhere('t.created_at >= :since', { since })
      .groupBy("TO_CHAR(t.created_at, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(t.created_at, 'YYYY-MM-DD')", 'ASC')
      .getRawMany<{ day: string; volume: string }>();

    const map = new Map(rows.map((r) => [r.day, parseFloat(r.volume) || 0]));

    return Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i); // UTC arithmetic — no local-TZ shift
      const key = d.toISOString().slice(0, 10);
      return { date: key, volume: map.get(key) ?? 0 };
    });
  }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      verifiedUsers,
      premiumUsers,
      pendingKyc,
      pendingBlackCount,
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
      inResult,
      outResult,
      totalBalanceUsers,
    ] = await Promise.all([
      this.userRepo.count({ where: { isAdmin: false } }),
      this.userRepo.count({ where: { isAdmin: false, kycStatus: KycStatus.VERIFIED } }),
      this.userRepo.count({ where: { isAdmin: false, tier: In([Tier.GOLD, Tier.BLACK]) } }),
      this.userRepo.count({ where: { isAdmin: false, kycStatus: KycStatus.SUBMITTED } }),
      this.userRepo.count({ where: { isAdmin: false, pendingBlackApproval: true } }),
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
      // Inbound: deposits, yield credits, referral bonuses, trivia rewards
      this.txRepo
        .createQueryBuilder('t')
        .select('COALESCE(SUM(CAST(t.amount_usdc AS DECIMAL(20,6))), 0)', 'total')
        .where('t.status = :s', { s: TxStatus.COMPLETED })
        .andWhere('t.type IN (:...types)', { types: [TxType.DEPOSIT, TxType.YIELD_CREDIT, TxType.REFERRAL_BONUS, TxType.TRIVIA_REWARD] })
        .getRawOne<{ total: string }>(),
      // Outbound: sends, bank transfers, bills, cards, pay requests, withdrawals (+ fee_usdc for non-bank_transfer)
      this.txRepo
        .createQueryBuilder('t')
        .select(
          `COALESCE(SUM(CAST(t.amount_usdc AS DECIMAL(20,6))
            + CASE WHEN t.type != 'bank_transfer'
                   THEN COALESCE(CAST(t.fee_usdc AS DECIMAL(20,6)), 0)
                   ELSE 0 END), 0)`,
          'total',
        )
        .where('t.status = :s', { s: TxStatus.COMPLETED })
        .andWhere('t.type IN (:...types)', { types: [TxType.SEND_USERNAME, TxType.SEND_ADDRESS, TxType.BANK_TRANSFER, TxType.BILL_PAYMENT, TxType.CARD_PAYMENT, TxType.PAY_REQUEST, TxType.WITHDRAWAL] })
        .getRawOne<{ total: string }>(),
      // EVM + Stellar account balances are read live below; this query only supplies IDs.
      this.userRepo
        .find({ where: { isAdmin: false }, select: ['id'] }),
    ]);

    const liveAccountBalances = await this.getLiveAccountBalances(
      totalBalanceUsers.map((user) => user.id),
    );

    return {
      totalUsers,
      verifiedUsers,
      premiumUsers,
      pendingKyc,
      pendingBlackCount,
      totalTransactions,
      activeWallets,
      pendingWallets,
      failedWallets,
      activeEvmWallets,
      pendingEvmWallets,
      failedEvmWallets,
      failedBankTransfersToday,
      flaggedUsers,
      totalVolumeUsdc:    parseFloat(volumeResult?.total ?? '0') || 0,
      totalInUsdc:        parseFloat(inResult?.total  ?? '0') || 0,
      totalOutUsdc:       parseFloat(outResult?.total ?? '0') || 0,
      totalBalanceUsdc:   liveAccountBalances.reduce(
        (sum, balance) => sum + (parseFloat(balance ?? '0') || 0),
        0,
      ),
    };
  }

  // ── Public stats (safe subset — no PII, no sensitive counts) ─────────────

  async getPublicStats() {
    const [
      totalUsers,
      verifiedUsers,
      totalTransactions,
      activeWallets,
      silverCount,
      goldCount,
      blackCount,
      volumeResult,
    ] = await Promise.all([
      this.userRepo.count({ where: { isAdmin: false } }),
      this.userRepo.count({ where: { isAdmin: false, kycStatus: KycStatus.VERIFIED } }),
      this.txRepo.count(),
      this.userRepo.count({ where: { isAdmin: false, stellarWalletStatus: WalletStatus.ACTIVE } }),
      this.userRepo.count({ where: { isAdmin: false, tier: Tier.SILVER } }),
      this.userRepo.count({ where: { isAdmin: false, tier: Tier.GOLD } }),
      this.userRepo.count({ where: { isAdmin: false, tier: Tier.BLACK } }),
      this.txRepo
        .createQueryBuilder('t')
        .select('SUM(CAST(t.amount_usdc AS DECIMAL(20,6)))', 'total')
        .where('t.status = :s', { s: TxStatus.COMPLETED })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      totalTransactions,
      activeWallets,
      totalVolumeUsdc: parseFloat(volumeResult?.total ?? '0') || 0,
      tierDistribution: {
        silver: silverCount,
        gold: goldCount,
        black: blackCount,
      },
    };
  }

  // ── User listing ──────────────────────────────────────────────────────────

  async listUsers(query: {
    page: number;
    limit: number;
    search?: string;
    tier?: string;
    kyc?: string;
    wallet?: string;
    flagged?: boolean;
    sortBy?: string;
    sortDir?: string;
  }) {
    const { page, limit, search, tier, kyc, wallet, flagged, sortBy, sortDir } = query;
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const kycMap: Record<string, string> = {
      reviewing: KycStatus.SUBMITTED,
      failed:    KycStatus.REJECTED,
    };

    const qb = this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.cachedBalanceUsdc', 'u_balance_usdc')
      .addSelect(`(
        SELECT COALESCE(SUM(CAST(t.amount_usdc AS DECIMAL)), 0)
        FROM transactions t
        WHERE t.user_id = u.id AND t.status = 'completed'
      )`, 'u_tx_volume')
      .where('u.is_admin = :isAdmin', { isAdmin: false });

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
    if (wallet && wallet.toLowerCase() !== 'all') {
      qb.andWhere('u.stellar_wallet_status = :wallet', { wallet: wallet.toLowerCase() });
    }
    if (flagged !== undefined) {
      qb.andWhere('u.is_flagged = :flagged', { flagged });
    }

    if (sortBy === 'balance') {
      qb.orderBy('u_balance_usdc', dir);
    } else if (sortBy === 'volume') {
      qb.orderBy('u_tx_volume', dir);
    } else {
      qb.orderBy('u.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [{ entities, raw }, total] = await Promise.all([
      qb.getRawAndEntities(),
      qb.getCount(),
    ]);

    const kycDisplay: Record<string, string> = {
      [KycStatus.PENDING]:   'Pending',
      [KycStatus.SUBMITTED]: 'Reviewing',
      [KycStatus.VERIFIED]:  'Verified',
      [KycStatus.REJECTED]:  'Failed',
    };

    const liveBalances = await this.getLiveAccountBalances(
      entities.map((user) => user.id),
    );

    return {
      users: entities.map((u, i) => ({
        id:           u.id,
        name:         u.fullName || u.username,
        username:     `@${u.username}`,
        email:        u.email,
        tier:         u.tier.charAt(0).toUpperCase() + u.tier.slice(1),
        kycStatus:    kycDisplay[u.kycStatus] ?? u.kycStatus,
        walletStatus: u.stellarWalletStatus.charAt(0).toUpperCase() + u.stellarWalletStatus.slice(1),
        isFlagged:    u.isFlagged,
        createdAt:    u.createdAt,
        balanceUsdc:  liveBalances[i],
        txVolume:     parseFloat(raw[i]?.u_tx_volume ?? '0').toFixed(2),
      })),
      total,
      page,
      limit,
    };
  }

  // ── KYC listing ───────────────────────────────────────────────────────────

  async listKycUsers(query: {
    page: number;
    limit: number;
    search?: string;
    tier?: string;
    kyc?: string;
    pendingBlack?: boolean;
  }) {
    const { page, limit, search, tier, kyc, pendingBlack } = query;

    const kycMap: Record<string, string> = {
      reviewing: KycStatus.SUBMITTED,
      failed:    KycStatus.REJECTED,
    };

    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.is_admin = :isAdmin', { isAdmin: false })
      .orderBy('u.pending_black_approval', 'DESC')
      .addOrderBy('u.createdAt', 'DESC')
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
    if (pendingBlack) {
      qb.andWhere('u.pending_black_approval = :pba', { pba: true });
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
        id:                   u.id,
        name:                 u.fullName || u.username,
        username:             `@${u.username}`,
        email:                u.email,
        tier:                 u.tier.charAt(0).toUpperCase() + u.tier.slice(1),
        kycStatus:            kycDisplay[u.kycStatus] ?? u.kycStatus,
        pendingBlackApproval: u.pendingBlackApproval,
        updatedAt:            u.updatedAt,
        createdAt:            u.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── KYC actions ───────────────────────────────────────────────────────────

  async approveBlackTier(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.pendingBlackApproval) {
      throw new BadRequestException('No pending Black tier request for this user');
    }

    user.tier = Tier.BLACK;
    user.pendingBlackApproval = false;
    await this.userRepo.save(user);

    void this.notificationsService
      .notifyKycVerified(user.id, 'black')
      .catch((err: Error) =>
        this.logger.error(`Black tier notification failed [userId=${userId}]: ${err.message}`),
      );

    if (user.email) {
      this.emailService
        .sendKycApproved({
          to: user.email,
          fullName: user.fullName ?? user.username,
          tier: 'black',
        })
        .catch((err: Error) =>
          this.logger.error(`Black tier email failed [userId=${userId}]: ${err.message}`),
        );
    }

    this.logger.log(`Black tier approved [userId=${userId}]`);
    return { id: user.id, tier: user.tier };
  }

  async rejectBlackTier(userId: string, reason: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.pendingBlackApproval) {
      throw new BadRequestException('No pending Black tier request for this user');
    }

    user.pendingBlackApproval = false;
    await this.userRepo.save(user);

    void this.notificationsService
      .create({
        userId: user.id,
        type: NotificationType.KYC_VERIFIED,
        title: 'Black Tier Request Declined',
        body: reason
          ? `Your Black tier upgrade was not approved: ${reason}`
          : 'Your Black tier upgrade request was not approved. You may resubmit.',
        deepLink: '/profile',
      })
      .catch((err: Error) =>
        this.logger.error(`Black tier rejection notification failed [userId=${userId}]: ${err.message}`),
      );

    this.logger.log(`Black tier rejected [userId=${userId}]: ${reason}`);
    return { id: user.id, rejected: true };
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

    const [txCount, failedTransferCount, recentTxs, recentTransfers, balances, evmBalance, inResult, outResult] =
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
          ? (async () => {
              let sorobanFailed = false;
              if (this.blockchainService.isSorobanReady && user.username) {
                try {
                  const sorobanRaw = await this.blockchainService.getSorobanBalance(user.username);
                  if (parseFloat(sorobanRaw) > 0) return { usdc: sorobanRaw, balanceError: null };
                } catch (e: unknown) {
                  this.logger.warn(`getUserDetail: Soroban balance failed for ${id}: ${(e as Error).message}`);
                  sorobanFailed = true;
                }
              }
              try {
                const horizonRaw = await this.blockchainService.getStellarUsdcBalance(user.stellarPublicKey!);
                if (sorobanFailed && parseFloat(horizonRaw) === 0) {
                  return { usdc: null, balanceError: 'Soroban balance fetch failed — funds may be in the contract' };
                }
                return { usdc: horizonRaw, balanceError: null };
              } catch (e: unknown) {
                this.logger.warn(`getUserDetail: Horizon balance failed for ${id}: ${(e as Error).message}`);
                return { usdc: null, balanceError: sorobanFailed ? 'Both Soroban and Horizon balance fetches failed' : 'Horizon balance fetch failed' };
              }
            })()
          : Promise.resolve(null),
        // Celo (EVM) balance — query USDC + USDT across all configured chains
        user.evmAddress && this.blockchainService.isEvmReady
          ? (async () => {
              let total = 0;
              for (const { chainId } of this.blockchainService.getConfiguredEvmChains()) {
                try {
                  const usdc = await this.blockchainService.getEvmBalance(user.evmAddress!, undefined, chainId);
                  total += parseFloat(usdc);
                } catch { /* chain not deployed */ }
                const usdtAddr = this.blockchainService.getEvmUsdtAddress(chainId);
                if (usdtAddr) {
                  try {
                    const usdt = await this.blockchainService.getEvmBalance(user.evmAddress!, usdtAddr, chainId);
                    total += parseFloat(usdt);
                  } catch { /* skip */ }
                }
              }
              return total > 0 ? total.toFixed(6) : null;
            })()
          : Promise.resolve(null),
        // Per-user inbound total (completed deposits, yield, referrals, trivia)
        this.txRepo
          .createQueryBuilder('t')
          .select('COALESCE(SUM(CAST(t.amount_usdc AS DECIMAL(20,6))), 0)', 'total')
          .where('t.user_id = :id', { id })
          .andWhere('t.status = :s', { s: TxStatus.COMPLETED })
          .andWhere('t.type IN (:...types)', { types: [TxType.DEPOSIT, TxType.YIELD_CREDIT, TxType.REFERRAL_BONUS, TxType.TRIVIA_REWARD] })
          .getRawOne<{ total: string }>(),
        // Per-user outbound total (completed sends, transfers, bills, etc.)
        // Note: for bank_transfer the fee is already baked into amount_usdc,
        // but for sends/cards/bills the fee is stored separately in fee_usdc.
        // Sum amount_usdc + fee_usdc, then subtract the double-counted bank_transfer fees.
        this.txRepo
          .createQueryBuilder('t')
          .select(
            `COALESCE(SUM(CAST(t.amount_usdc AS DECIMAL(20,6))
              + CASE WHEN t.type != 'bank_transfer'
                     THEN COALESCE(CAST(t.fee_usdc AS DECIMAL(20,6)), 0)
                     ELSE 0 END), 0)`,
            'total',
          )
          .where('t.user_id = :id', { id })
          .andWhere('t.status = :s', { s: TxStatus.COMPLETED })
          .andWhere('t.type IN (:...types)', { types: [TxType.SEND_USERNAME, TxType.SEND_ADDRESS, TxType.BANK_TRANSFER, TxType.BILL_PAYMENT, TxType.CARD_PAYMENT, TxType.PAY_REQUEST, TxType.WITHDRAWAL] })
          .getRawOne<{ total: string }>(),
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
      evmBalance:       evmBalance ?? null,
      balanceError:     balances?.balanceError ?? null,
      txCount,
      failedTransferCount,
      totalInUsdc:  parseFloat(inResult?.total  ?? '0') || 0,
      totalOutUsdc: parseFloat(outResult?.total ?? '0') || 0,
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

  async provisionUserWallet(id: string) {
    const user = await this.userRepo.findOne({ where: { id, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.username) throw new BadRequestException('User has no username');
    if (!this.blockchainService.isEvmReady) {
      throw new ServiceUnavailableException(
        'EVM not ready — check backend Celo configuration',
      );
    }

    await this.blockchainWalletService.createWallet(id, user.username);

    const depositChains = this.blockchainService.getConfiguredEvmDepositChains();
    const configuredChains = depositChains.length > 0
      ? depositChains
      : this.blockchainService.getConfiguredEvmChainsWithTokens();
    const configuredChainIds = new Set(
      configuredChains.map((chain) => chain.chainId),
    );
    const chainNameMap = new Map(
      configuredChains.map((chain) => [chain.chainId, chain.name]),
    );
    const wallets = (await this.blockchainWalletService.getWalletsForUser(id))
      .filter(
        (wallet) =>
          configuredChainIds.size === 0 || configuredChainIds.has(wallet.chainId),
      );
    const activeWallets = wallets.filter((wallet) => wallet.isReady);
    const evmAddress = activeWallets[0]?.walletAddress ?? user.evmAddress ?? null;
    const evmWalletStatus =
      wallets.length > 0 && activeWallets.length === wallets.length
        ? WalletStatus.ACTIVE
        : WalletStatus.PENDING;

    if (wallets.length > 0) {
      await this.userRepo.update(
        { id },
        { evmAddress, evmWalletStatus },
      );
    }

    return {
      id,
      evmAddress,
      evmWalletStatus:
        evmWalletStatus.charAt(0).toUpperCase() +
        evmWalletStatus.slice(1),
      evmWallets: wallets.map((wallet) => ({
        address: wallet.walletAddress,
        chainId: wallet.chainId,
        chainName: chainNameMap.get(wallet.chainId) ?? `chain-${wallet.chainId}`,
        status: wallet.status,
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
    // Fire-and-forget — in-app notification
    void this.notificationsService
      .notifyKycVerified(user.id, user.tier)
      .catch((err: Error) =>
        this.logger.error(
          `KYC notification failed [userId=${id}]: ${err.message}`,
        ),
      );

    // Fire-and-forget — same email the automatic KYC path sends
    if (user.email) {
      this.emailService
        .sendKycApproved({
          to: user.email,
          fullName: user.fullName ?? user.username,
          tier: user.tier,
        })
        .catch((err: Error) =>
          this.logger.error(
            `KYC approval email failed [userId=${id}]: ${err.message}`,
          ),
        );
    }
    return { id: user.id, kycStatus: user.kycStatus };
  }

  /**
   * Permanently delete a user and all associated data.
   * Restricted to super_admin only.
   *
   * Deletion order:
   *   1. blockchain_wallets rows (no FK back to users — manual delete required)
   *   2. The user row itself (DB cascades handle transactions, devices, tokens, etc.)
   */
  async deleteUser(id: string, requester: User): Promise<void> {
    if (requester.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can permanently delete users');
    }

    const user = await this.userRepo.findOne({ where: { id, isAdmin: false } });
    if (!user) throw new NotFoundException('User not found');

    // Delete tables whose DB-level FK constraint is RESTRICT (not CASCADE),
    // so they must be cleared manually before the user row is removed.
    await this.userRepo.manager.query(`DELETE FROM "blockchain_wallets" WHERE "userId" = $1`, [id]);
    await this.userRepo.manager.query(`DELETE FROM "transactions" WHERE "user_id" = $1`, [id]);

    await this.userRepo.remove(user);
    this.logger.warn(`User permanently deleted [id=${id}] by admin [id=${requester.id}]`);
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

    // Fire-and-forget notifications
    const user = await this.userRepo.findOne({
      where: { id: transfer.userId },
      select: ['id', 'email', 'fullName', 'username'],
    });
    if (user) {
      void this.notificationsService
        .notifyTransactionComplete(user.id, transfer.reference, transfer.amountUsdc)
        .catch((e: Error) =>
          this.logger.error(`Admin complete-transfer notification failed [ref=${transfer.reference}]: ${e.message}`),
        );
      if (user.email) {
        this.emailService
          .sendMoneySent({
            to: user.email,
            fullName: user.fullName ?? user.username,
            amountUsdc: transfer.amountUsdc,
            amountNgn: transfer.amountNgn,
            recipientName: `${transfer.accountName} · ${transfer.bankName}`,
            reference: transfer.reference,
            fee: transfer.feeUsdc ?? '0',
            appUrl: this.config.get<string>('app.frontendUrl', 'https://cheesepay.xyz'),
          })
          .catch((e: Error) =>
            this.logger.error(`Admin complete-transfer email failed [ref=${transfer.reference}]: ${e.message}`),
          );
      }
    }

    return { id, status: BankTransferStatus.COMPLETED };
  }

  /**
   * Mark any transaction as COMPLETED by its transaction UUID.
   * Also syncs the linked bank_transfer row when applicable.
   */
  async completeTransactionById(id: string) {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.status === TxStatus.COMPLETED) {
      return { id, status: TxStatus.COMPLETED };
    }

    await this.txRepo.update({ id }, { status: TxStatus.COMPLETED });

    if (tx.type === TxType.BANK_TRANSFER) {
      await this.bankTransferRepo.update(
        { reference: tx.reference },
        { status: BankTransferStatus.COMPLETED },
      );
    }

    return { id, status: TxStatus.COMPLETED };
  }

  /** Resolve a failed/pending transaction according to an admin decision. */
  async resolveTransaction(id: string, resolution: 'refund_user' | 'treasury') {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (tx.status !== TxStatus.PENDING && tx.status !== TxStatus.FAILED) {
      throw new BadRequestException(
        `Only pending or failed transactions can be resolved (current status: ${tx.status})`,
      );
    }

    if (resolution === 'treasury') {
      await this.txRepo.update({ id }, { status: TxStatus.COMPLETED });
      if (tx.type === TxType.BANK_TRANSFER) {
        await this.bankTransferRepo.update(
          { reference: tx.reference },
          { status: BankTransferStatus.COMPLETED },
        );
      }
      this.logger.log(
        `Admin resolution: ${tx.amountUsdc} USDC retained in treasury [original tx=${id}]`,
      );
      return { id, status: TxStatus.COMPLETED, resolution: 'treasury', amountUsdc: tx.amountUsdc };
    }

    const user = await this.userRepo.findOne({
      where: { id: tx.userId },
      select: ['id', 'stellarPublicKey', 'email', 'fullName', 'username'],
    });
    if (!user?.stellarPublicKey) {
      throw new BadRequestException('User wallet not initialised');
    }

    // Send USDC from platform treasury → user's Stellar wallet
    const txHash = await this.blockchainService.platformDepositUsdc(
      user.stellarPublicKey,
      tx.amountUsdc,
    );

    // Mark original transaction as reversed
    await this.txRepo.update({ id }, { status: TxStatus.REVERSED });

    // Keep bank_transfer in sync
    if (tx.type === TxType.BANK_TRANSFER) {
      await this.bankTransferRepo.update(
        { reference: tx.reference },
        { status: BankTransferStatus.REVERSED },
      );
    }

    // Create a DEPOSIT record so the refund appears in the user's history
    const refundRef = `CW-REFUND-${randomBytes(8).toString('hex').toUpperCase()}`;
    await this.txRepo.save(
      this.txRepo.create({
        userId: user.id,
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amountUsdc: tx.amountUsdc,
        amountNgn: tx.amountNgn,
        feeUsdc: '0.000000',
        txHash,
        network: 'stellar',
        reference: refundRef,
        description: `Refund for ${tx.reference}`,
      }),
    );

    // Notify the user (fire-and-forget)
    void this.notificationsService
      .notifyMoneyReceived(user.id, tx.amountUsdc, 'CheesePay (refund)')
      .catch((e: Error) =>
        this.logger.error(`Refund notification failed [tx=${id}]: ${e.message}`),
      );

    if (user.email) {
      void this.emailService
        .sendMoneyReceived({
          to: user.email,
          fullName: user.fullName ?? user.username,
          amountUsdc: tx.amountUsdc,
          senderName: 'CheesePay (refund)',
          appUrl: this.config.get<string>('app.frontendUrl', 'https://cheesepay.xyz'),
        })
        .catch((e: Error) =>
          this.logger.error(`Refund email failed [tx=${id}]: ${e.message}`),
        );
    }

    this.logger.log(
      `Admin resolution: ${tx.amountUsdc} USDC returned to @${user.username} [original tx=${id}] [txHash=${txHash}]`,
    );

    return { txHash, amountUsdc: tx.amountUsdc, toAddress: user.stellarPublicKey, resolution: 'refund_user' };
  }

  // ── Transactions listing ──────────────────────────────────────────────────

  async listTransactions(query: {
    page:       number;
    limit:      number;
    status?:    string;
    type?:      string;
    search?:    string;
    userId?:    string;
    direction?: string;
  }) {
    const { page, limit, status, type, search, userId, direction } = query;

    const IN_TYPES  = ['deposit', 'yield_credit', 'referral_bonus', 'trivia_reward'];
    const OUT_TYPES = ['withdrawal', 'send_username', 'send_address', 'bank_transfer', 'card_payment', 'pay_request', 'bill_payment', 'fee'];

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
    if (direction === 'in') {
      qb.andWhere('t.type IN (:...dirTypes)', { dirTypes: IN_TYPES });
    } else if (direction === 'out') {
      qb.andWhere('t.type IN (:...dirTypes)', { dirTypes: OUT_TYPES });
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

  // ── Referrals listing ────────────────────────────────────────────────────

  async listReferrals(query: { page: number; limit: number; status?: string; search?: string }) {
    const { page, limit, status, search } = query;

    const qb = this.referralRepo
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && status !== 'all') {
      qb.andWhere('r.status = :status', { status });
    }
    if (search) {
      qb.andWhere(
        `(r.referrer_id IN (SELECT u.id FROM users u WHERE LOWER(u.username) LIKE :q)
          OR r.referee_id IN (SELECT u.id FROM users u WHERE LOWER(u.username) LIKE :q))`,
        { q: `%${search.toLowerCase()}%` },
      );
    }

    const [referrals, total] = await qb.getManyAndCount();

    const userIds = [...new Set([
      ...referrals.map((r) => r.referrerId),
      ...referrals.map((r) => r.refereeId),
    ])];

    const usernameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const users = await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'username'] });
      users.forEach((u) => usernameMap.set(u.id, u.username));
    }

    return {
      referrals: referrals.map((r) => ({
        id:              r.id,
        referrerId:      r.referrerId,
        referrerUsername: usernameMap.get(r.referrerId) ?? '—',
        refereeId:       r.refereeId,
        refereeUsername: usernameMap.get(r.refereeId)  ?? '—',
        status:          r.status,
        rewardUsdc:      r.rewardUsdc,
        rewardedAt:      r.rewardedAt,
        createdAt:       r.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Single transaction detail ─────────────────────────────────────────────

  async getTransaction(id: string) {
    const t = await this.txRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Transaction not found');

    const user = await this.userRepo.findOne({
      where: { id: t.userId },
      select: ['id', 'username'],
    });

    return {
      id:                t.id,
      reference:         t.reference,
      userId:            t.userId,
      username:          user?.username ?? '—',
      type:              t.type,
      status:            t.status,
      amountUsdc:        t.amountUsdc,
      amountNgn:         t.amountNgn,
      feeUsdc:           t.feeUsdc,
      rateApplied:       t.rateApplied,
      recipientUsername: t.recipientUsername,
      recipientAddress:  t.recipientAddress,
      recipientName:     t.recipientName,
      bankName:          t.bankName,
      accountNumber:     t.accountNumber,
      network:           t.network,
      txHash:            t.txHash,
      description:       t.description,
      failureReason:     t.failureReason,
      createdAt:         t.createdAt,
      updatedAt:         t.updatedAt,
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

  // ── Waitlist listing ──────────────────────────────────────────────────────

  async listWaitlistEntries(query: {
    page:    number;
    limit:   number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = query;

    const qb = this.waitlistRepo
      .createQueryBuilder('w')
      .orderBy('w.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && status !== 'all') {
      qb.andWhere('w.status = :status', { status });
    }
    if (search) {
      qb.andWhere(
        '(LOWER(w.username) LIKE :q OR LOWER(w.email) LIKE :q OR LOWER(w.referral_code) LIKE :q)',
        { q: `%${search.toLowerCase()}%` },
      );
    }

    const [entries, total] = await qb.getManyAndCount();

    return {
      entries: entries.map((w) => ({
        id:           w.id,
        email:        w.email,
        username:     w.username,
        status:       w.status,
        position:     w.position,
        points:       w.points,
        referralCode: w.referralCode,
        referrerId:   w.referrerId,
        notifiedAt:   w.notifiedAt,
        convertedAt:  w.convertedAt,
        createdAt:    w.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Virtual cards listing ─────────────────────────────────────────────────

  async listAdminCards(query: {
    page:    number;
    limit:   number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = query;

    const qb = this.cardRepo
      .createQueryBuilder('vc')
      .orderBy('vc.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && status !== 'all') {
      qb.andWhere('vc.status = :status', { status });
    }
    if (search) {
      qb.andWhere(
        `(vc.last4 LIKE :q
          OR LOWER(vc.holder_name) LIKE :q
          OR vc.user_id IN (SELECT u.id FROM users u WHERE LOWER(u.username) LIKE :q OR LOWER(u.email) LIKE :q))`,
        { q: `%${search.toLowerCase()}%` },
      );
    }

    const [cards, total] = await qb.getManyAndCount();

    const uniqueUserIds = [...new Set(cards.map((c) => c.userId))];
    const userMap = new Map<string, { username: string; email: string }>();
    if (uniqueUserIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(uniqueUserIds) },
        select: ['id', 'username', 'email'],
      });
      users.forEach((u) => userMap.set(u.id, { username: u.username, email: u.email }));
    }

    return {
      cards: cards.map((vc) => ({
        id:               vc.id,
        userId:           vc.userId,
        username:         userMap.get(vc.userId)?.username ?? '—',
        email:            userMap.get(vc.userId)?.email    ?? '—',
        last4:            vc.last4,
        network:          vc.network,
        holderName:       vc.holderName,
        status:           vc.status,
        availableBalance: vc.availableBalance,
        spendLimit:       vc.spendLimit,
        monthlySpend:     vc.monthlySpend,
        expiryMonth:      vc.expiryMonth,
        expiryYear:       vc.expiryYear,
        createdAt:        vc.createdAt,
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

  // ── Fee revenue stats ─────────────────────────────────────────────────────

  async getFeeStats(query: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = query;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Aggregate totals — only completed transfers carry real fee revenue
    const [allTimeResult, todayResult, monthResult] = await Promise.all([
      this.bankTransferRepo
        .createQueryBuilder('bt')
        .select('SUM(CAST(bt.fee_usdc AS DECIMAL(20,6)))', 'total')
        .addSelect('COUNT(*)', 'count')
        .where('bt.status = :s', { s: BankTransferStatus.COMPLETED })
        .getRawOne<{ total: string; count: string }>(),

      this.bankTransferRepo
        .createQueryBuilder('bt')
        .select('SUM(CAST(bt.fee_usdc AS DECIMAL(20,6)))', 'total')
        .where('bt.status = :s', { s: BankTransferStatus.COMPLETED })
        .andWhere('bt.created_at >= :d', { d: todayStart })
        .getRawOne<{ total: string }>(),

      this.bankTransferRepo
        .createQueryBuilder('bt')
        .select('SUM(CAST(bt.fee_usdc AS DECIMAL(20,6)))', 'total')
        .where('bt.status = :s', { s: BankTransferStatus.COMPLETED })
        .andWhere('bt.created_at >= :d', { d: monthStart })
        .getRawOne<{ total: string }>(),
    ]);

    // Paginated list — all completed bank transfers with their fee
    const qb = this.bankTransferRepo
      .createQueryBuilder('bt')
      .where('bt.status = :s', { s: BankTransferStatus.COMPLETED })
      .orderBy('bt.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere(
        `(LOWER(bt.reference) LIKE :q
          OR LOWER(bt.account_name) LIKE :q
          OR LOWER(bt.bank_name) LIKE :q
          OR bt.account_number LIKE :q)`,
        { q: `%${search.toLowerCase()}%` },
      );
    }

    const [transfers, total] = await qb.getManyAndCount();

    // Resolve owner usernames
    const uniqueUserIds = [...new Set(transfers.map((t) => t.userId))];
    const usernameMap = new Map<string, string>();
    if (uniqueUserIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(uniqueUserIds) },
        select: ['id', 'username'],
      });
      users.forEach((u) => usernameMap.set(u.id, u.username));
    }

    return {
      summary: {
        totalFeesUsdc:       parseFloat(allTimeResult?.total ?? '0') || 0,
        totalCompletedCount: parseInt(allTimeResult?.count  ?? '0', 10) || 0,
        todayFeesUsdc:       parseFloat(todayResult?.total  ?? '0') || 0,
        monthFeesUsdc:       parseFloat(monthResult?.total  ?? '0') || 0,
      },
      transfers: transfers.map((t) => ({
        id:            t.id,
        reference:     t.reference,
        userId:        t.userId,
        username:      usernameMap.get(t.userId) ?? '—',
        accountName:   t.accountName,
        bankName:      t.bankName,
        accountNumber: t.accountNumber,
        amountNgn:     t.amountNgn,
        amountUsdc:    t.amountUsdc,
        feeUsdc:       t.feeUsdc,
        rateApplied:   t.rateApplied,
        status:        t.status,
        createdAt:     t.createdAt,
      })),
      total,
      page,
      limit,
    };
  }
}
