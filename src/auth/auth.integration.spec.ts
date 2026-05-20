import { randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User, WalletStatus } from './entities/user.entity';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { Device } from '../devices/entities/device.entity';
import { OtpService } from '../otp/otp.service';
import { Otp, OtpType } from '../otp/entities/otp.entity';
import { EmailService } from '../email/email.service';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { ReferralEvent } from '../waitlist/entities/referral-event.entity';

type Where<T> = Partial<Record<keyof T, unknown>>;

class InMemoryRepository<T extends { id?: string }> {
  readonly items: T[] = [];

  constructor(
    private readonly EntityClass: new () => T,
    private readonly defaults: Partial<T> = {},
    private readonly relationResolvers: Record<
      string,
      (item: T) => unknown | Promise<unknown>
    > = {},
  ) {}

  create(partial: Partial<T>): T {
    return Object.assign(new this.EntityClass(), partial);
  }

  async save(entity: T): Promise<T> {
    const record = Object.assign(new this.EntityClass(), this.defaults, entity);
    if (!record.id) {
      record.id = randomUUID();
    }
    this.applyDefaults(record);
    this.runHooks(record);

    const existingIndex = this.items.findIndex((item) => item.id === record.id);
    const createdAt =
      (existingIndex >= 0
        ? (this.items[existingIndex] as { createdAt?: Date }).createdAt
        : undefined) ?? new Date();

    Object.assign(record as object, {
      createdAt,
      updatedAt: new Date(),
    });

    Object.assign(entity as object, record);

    if (existingIndex >= 0) {
      this.items[existingIndex] = entity;
    } else {
      this.items.push(entity);
    }

    return entity;
  }

  async findOne(options: {
    where?: Where<T> | Array<Where<T>>;
    order?: Partial<Record<keyof T, 'ASC' | 'DESC'>>;
    relations?: string[];
  }): Promise<T | null> {
    const where = options.where;
    let matches = this.items.filter((item) =>
      Array.isArray(where)
        ? where.some((criteria) => this.matches(item, criteria))
        : this.matches(item, where),
    );

    if (options.order) {
      const [field, direction] = Object.entries(options.order)[0] as [
        keyof T,
        'ASC' | 'DESC',
      ];
      matches = matches.sort((left, right) => {
        const leftValue = this.sortValue(left[field]);
        const rightValue = this.sortValue(right[field]);
        if (leftValue === rightValue) return 0;
        const result = leftValue > rightValue ? 1 : -1;
        return direction === 'DESC' ? -result : result;
      });
    }

    const match = matches[0];
    if (!match) return null;

    return this.hydrate(match, options.relations);
  }

  async update(
    criteria: Where<T> | string,
    partial: Partial<T>,
  ): Promise<void> {
    for (const item of this.items) {
      if (!this.matchesCriteria(item, criteria)) continue;
      Object.assign(item, partial, { updatedAt: new Date() });
      this.runHooks(item);
    }
  }

  async increment(
    criteria: Where<T> | string,
    field: keyof T & string,
    amount: number,
  ): Promise<void> {
    for (const item of this.items) {
      if (!this.matchesCriteria(item, criteria)) continue;
      const current = Number((item as Record<string, unknown>)[field] ?? 0);
      Object.assign(item as object, {
        [field]: current + amount,
        updatedAt: new Date(),
      });
    }
  }

  private applyDefaults(record: T): void {
    if ((record as { isUsed?: boolean }).isUsed === undefined) {
      Object.assign(record as object, { isUsed: false });
    }
    if ((record as { attempts?: number }).attempts === undefined) {
      Object.assign(record as object, { attempts: 0 });
    }
    if ((record as { isActive?: boolean }).isActive === undefined) {
      Object.assign(record as object, { isActive: true });
    }
    if ((record as { isRevoked?: boolean }).isRevoked === undefined) {
      Object.assign(record as object, { isRevoked: false });
    }
    if ((record as { emailVerified?: boolean }).emailVerified === undefined) {
      Object.assign(record as object, { emailVerified: false });
    }
    if ((record as { phoneVerified?: boolean }).phoneVerified === undefined) {
      Object.assign(record as object, { phoneVerified: false });
    }
    if (
      (record as { stellarWalletStatus?: WalletStatus }).stellarWalletStatus ===
      undefined
    ) {
      Object.assign(record as object, {
        stellarWalletStatus: WalletStatus.PENDING,
      });
    }
    if (
      (record as { evmWalletStatus?: WalletStatus }).evmWalletStatus ===
      undefined
    ) {
      Object.assign(record as object, {
        evmWalletStatus: WalletStatus.PENDING,
      });
    }
  }

  private runHooks(record: T): void {
    if (
      typeof (record as { normalizeIdentityFields?: () => void })
        .normalizeIdentityFields === 'function'
    ) {
      (
        record as unknown as { normalizeIdentityFields: () => void }
      ).normalizeIdentityFields();
    }
  }

  private matches(item: T, criteria?: Where<T>): boolean {
    if (!criteria) return true;

    return Object.entries(criteria).every(([key, value]) => {
      if (value === undefined) return true;
      return (item as Record<string, unknown>)[key] === value;
    });
  }

  private matchesCriteria(item: T, criteria: Where<T> | string): boolean {
    if (typeof criteria === 'string') {
      return item.id === criteria;
    }
    return this.matches(item, criteria);
  }

  private async hydrate(item: T, relations?: string[]): Promise<T> {
    const record = Object.assign(new this.EntityClass(), item);
    for (const relation of relations ?? []) {
      const resolver = this.relationResolvers[relation];
      if (!resolver) continue;
      Object.assign(record as object, {
        [relation]: await resolver(item),
      });
    }
    return record;
  }

  private sortValue(value: unknown): number | string {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    return 0;
  }
}

class FakeConfigService {
  private readonly values = new Map<string, unknown>([
    ['app.frontendUrl', 'http://localhost:3000'],
    ['app.nodeEnv', 'test'],
    ['app.allowInsecureDeviceSignatures', false],
    ['jwt.accessSecret', 'access-secret'],
    ['jwt.accessExpires', '15m'],
    ['jwt.refreshSecret', 'refresh-secret'],
    ['jwt.refreshExpires', '30d'],
    ['otp.ttlSeconds', 900],
  ]);

  get<T>(key: string, defaultValue?: T): T {
    return (this.values.has(key) ? this.values.get(key) : defaultValue) as T;
  }
}

class FakeEmailService {
  readonly signupOtps: Array<{ to: string; otp: string }> = [];
  readonly signupSuccesses: Array<{ to: string; appUrl: string }> = [];

  sendSignupOtp = jest.fn(
    async (params: { to: string; otp: string }): Promise<void> => {
      this.signupOtps.push(params);
    },
  );

  sendPasswordResetOtp = jest.fn(async (): Promise<void> => undefined);
  sendDeviceRegistrationOtp = jest.fn(async (): Promise<void> => undefined);
  sendDeviceRegistrationLink = jest.fn(async (): Promise<void> => undefined);
  sendPasswordChanged = jest.fn(async (): Promise<void> => undefined);

  sendSignupSuccess = jest.fn(
    async (params: { to: string; appUrl: string }): Promise<void> => {
      this.signupSuccesses.push(params);
    },
  );

  latestSignupOtp(email: string): string {
    const match = [...this.signupOtps]
      .reverse()
      .find((item) => item.to === email);
    if (!match) {
      throw new Error(`No signup OTP found for ${email}`);
    }
    return match.otp;
  }
}

class FakeBlockchainService {
  isEvmReady = false;
  private walletCounter = 0;

  async createStellarWallet() {
    this.walletCounter += 1;
    return {
      publicKey: `stellar-${this.walletCounter}`,
      secretKeyEnc: `enc-${this.walletCounter}`,
    };
  }

  verifyDeviceSignature(params: { signature: string }): boolean {
    return params.signature === 'valid-signature';
  }
}

type MockResponse = {
  cookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }>;
  clearedCookies: Array<{ name: string; options: Record<string, unknown> }>;
  cookie: (
    name: string,
    value: string,
    options: Record<string, unknown>,
  ) => MockResponse;
  clearCookie: (name: string, options: Record<string, unknown>) => MockResponse;
};

describe('Auth integration flows', () => {
  let moduleFixture: TestingModule;
  let authService: AuthService;
  let authController: AuthController;
  let accessStrategy: JwtAccessStrategy;
  let refreshStrategy: JwtRefreshStrategy;
  let emailService: FakeEmailService;
  let userRepo: InMemoryRepository<User>;
  let sequence: number;

  beforeEach(async () => {
    process.env.SIGNUP_OPEN = 'true';

    emailService = new FakeEmailService();
    const configService = new FakeConfigService();
    const blockchainService = new FakeBlockchainService();
    userRepo = new InMemoryRepository(User);
    const deviceRepo = new InMemoryRepository(Device);
    const refreshTokenRepo = new InMemoryRepository(
      RefreshToken,
      {},
      {
        user: (token) =>
          userRepo.items.find((user) => user.id === token.userId) ?? null,
      },
    );
    const otpRepo = new InMemoryRepository(Otp);
    const waitlistRepo = new InMemoryRepository(WaitlistEntry);
    const referralEventRepo = new InMemoryRepository(ReferralEvent);

    moduleFixture = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        AuthService,
        OtpService,
        JwtAccessStrategy,
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: BlockchainService,
          useValue: blockchainService,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: getQueueToken('wallet-creation'),
          useValue: null,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepo,
        },
        {
          provide: getRepositoryToken(Device),
          useValue: deviceRepo,
        },
        {
          provide: getRepositoryToken(Otp),
          useValue: otpRepo,
        },
        {
          provide: getRepositoryToken(WaitlistEntry),
          useValue: waitlistRepo,
        },
        {
          provide: getRepositoryToken(ReferralEvent),
          useValue: referralEventRepo,
        },
      ],
    }).compile();

    authService = moduleFixture.get(AuthService);
    authController = moduleFixture.get(AuthController);
    accessStrategy = moduleFixture.get(JwtAccessStrategy);
    refreshStrategy = moduleFixture.get(JwtRefreshStrategy);
    sequence = 0;
  });

  afterEach(async () => {
    delete process.env.SIGNUP_OPEN;
    await moduleFixture.close();
  });

  async function createVerifiedSession(
    overrides: {
      email?: string;
      username?: string;
      password?: string;
      phone?: string;
      deviceId?: string;
      devicePublicKey?: string;
      fullName?: string;
    } = {},
  ) {
    sequence += 1;
    const session = {
      email: overrides.email ?? `user${sequence}@example.com`,
      username: overrides.username ?? `user_${sequence}`,
      password: overrides.password ?? 'Passw0rd!',
      phone: overrides.phone ?? `+23480${String(sequence).padStart(8, '0')}`,
      deviceId: overrides.deviceId ?? `device-${sequence}`,
      devicePublicKey: overrides.devicePublicKey ?? `pub-key-${sequence}`,
      fullName: overrides.fullName ?? `User ${sequence}`,
    };

    await authService.signup(session);

    const verifyRes = createMockResponse();
    await authController.verifyOtp(
      {
        email: session.email,
        otp: emailService.latestSignupOtp(session.email),
        type: OtpType.EMAIL_VERIFY,
        deviceId: session.deviceId,
        devicePublicKey: session.devicePublicKey,
      },
      createRequest(),
      verifyRes as never,
    );

    const loginRes = createMockResponse();
    const loginResult = await authController.login(
      {
        identifier: session.email,
        password: session.password,
        deviceId: session.deviceId,
        deviceSignature: 'valid-signature',
      },
      createRequest(),
      loginRes as never,
    );

    return {
      ...session,
      accessToken: loginResult.tokens.accessToken,
      refreshToken: loginRes.cookies[0].value,
      cookieOptions: loginRes.cookies[0].options,
    };
  }

  function createRequest(overrides: Record<string, unknown> = {}): Request {
    return {
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1',
      cookies: {},
      ...overrides,
    } as unknown as Request;
  }

  function createMockResponse(): MockResponse {
    return {
      cookies: [],
      clearedCookies: [],
      cookie(name, value, options) {
        this.cookies.push({ name, value, options });
        return this;
      },
      clearCookie(name, options) {
        this.clearedCookies.push({ name, options });
        return this;
      },
    };
  }

  async function expectForbidden<T>(promise: Promise<T>) {
    try {
      await promise;
      throw new Error('Expected promise to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      return error as ForbiddenException;
    }
  }

  async function expectUnauthorized<T>(promise: Promise<T>) {
    try {
      await promise;
      throw new Error('Expected promise to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      return error as UnauthorizedException;
    }
  }

  it('rejects unverified login, then verifies OTP and issues a session', async () => {
    const signupEmail = 'ada@example.com';
    const deviceId = 'device-login-1';

    await authService.signup({
      fullName: 'Ada Lovelace',
      email: signupEmail,
      phone: '+2348011111111',
      username: 'ada_user',
      password: 'Passw0rd!',
      deviceId,
      devicePublicKey: 'pub-key-1',
    });

    const error = await expectForbidden(
      authService.login(
        {
          identifier: signupEmail,
          password: 'Passw0rd!',
          deviceId,
          deviceSignature: 'valid-signature',
        },
        { userAgent: 'jest', ip: '127.0.0.1' },
      ),
    );

    expect(error.getResponse()).toMatchObject({
      message: 'Email not verified. Verify your email to continue.',
      error: 'EMAIL_NOT_VERIFIED',
      code: 'EMAIL_NOT_VERIFIED',
      email: signupEmail,
    });

    const verifyRes = createMockResponse();
    const verifyResult = (await authController.verifyOtp(
      {
        email: signupEmail,
        otp: emailService.latestSignupOtp(signupEmail),
        type: OtpType.EMAIL_VERIFY,
        deviceId,
        devicePublicKey: 'pub-key-1',
      },
      createRequest(),
      verifyRes as never,
    )) as {
      user: { emailVerified: boolean };
      tokens: { accessToken: string };
    };

    expect(verifyResult.user.emailVerified).toBe(true);
    expect(verifyResult.tokens.accessToken).toEqual(expect.any(String));
    expect(verifyRes.cookies[0]).toMatchObject({
      name: 'refresh_token',
      options: expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      }),
    });
    expect(verifyRes.cookies[0].options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    expect(emailService.signupSuccesses[0].appUrl).toBe(
      'http://localhost:3000/dashboard',
    );
  });

  it('rotates refresh cookies and allows sequential refresh cycles', async () => {
    const session = await createVerifiedSession();

    const firstRotation = await rotateRefreshToken(session.refreshToken);
    expect(firstRotation.result.accessToken).toEqual(expect.any(String));
    expect(firstRotation.token).not.toBe(session.refreshToken);
    expect(firstRotation.response.cookies[0].options).toMatchObject(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      }),
    );

    const secondRotation = await rotateRefreshToken(firstRotation.token);
    expect(secondRotation.result.accessToken).toEqual(expect.any(String));
    expect(secondRotation.token).not.toBe(firstRotation.token);

    const thirdRotation = await rotateRefreshToken(secondRotation.token);
    expect(thirdRotation.result.accessToken).toEqual(expect.any(String));
    expect(thirdRotation.token).not.toBe(secondRotation.token);
  });

  it('rejects reuse of a revoked refresh token', async () => {
    const session = await createVerifiedSession();

    await rotateRefreshToken(session.refreshToken);

    const error = await expectUnauthorized(
      refreshStrategy.validate(
        createRequest({
          cookies: { refresh_token: session.refreshToken },
        }) as never,
        { sub: 'ignored' },
      ),
    );

    expect(error.message).toBe('Refresh token expired or revoked');
  });

  it('allows mixed-case login and blocks case-variant duplicates', async () => {
    const session = await createVerifiedSession({
      email: 'casey@example.com',
      username: 'case_user',
      phone: '+2348055555555',
      deviceId: 'device-case-1',
      devicePublicKey: 'pub-key-case-1',
    });

    await expect(
      authService.login(
        {
          identifier: 'CASEY@EXAMPLE.COM',
          password: session.password,
          deviceId: session.deviceId,
          deviceSignature: 'valid-signature',
        },
        { userAgent: 'jest', ip: '127.0.0.1' },
      ),
    ).resolves.toMatchObject({
      user: expect.objectContaining({ username: 'case_user' }),
    });

    await expect(
      authService.login(
        {
          identifier: 'CASE_USER',
          password: session.password,
          deviceId: session.deviceId,
          deviceSignature: 'valid-signature',
        },
        { userAgent: 'jest', ip: '127.0.0.1' },
      ),
    ).resolves.toMatchObject({
      user: expect.objectContaining({ username: 'case_user' }),
    });

    await expect(
      authService.signup({
        fullName: 'Duplicate Email',
        email: 'CASEY@EXAMPLE.COM',
        phone: '+2348066666666',
        username: 'other_user',
        password: 'Passw0rd!',
        deviceId: 'device-case-2',
        devicePublicKey: 'pub-key-case-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      authService.signup({
        fullName: 'Duplicate Username',
        email: 'other@example.com',
        phone: '+2348077777777',
        username: 'CASE_USER',
        password: 'Passw0rd!',
        deviceId: 'device-case-3',
        devicePublicKey: 'pub-key-case-3',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates mutable fields when an unverified user retries signup', async () => {
    const signupEmail = 'retry@example.com';
    const deviceId = 'device-retry-1';

    await authService.signup({
      fullName: 'Initial Name',
      email: signupEmail,
      phone: '+2348022222222',
      username: 'retry_user',
      password: 'OldPassw0rd!',
      deviceId,
      devicePublicKey: 'pub-key-old',
    });

    await authService.signup({
      fullName: 'Updated Name',
      email: 'RETRY@example.com',
      phone: '+2348033333333',
      username: 'updated_user',
      password: 'NewPassw0rd!',
      deviceId,
      devicePublicKey: 'pub-key-new',
    });

    const verifyRes = createMockResponse();
    await authController.verifyOtp(
      {
        email: signupEmail,
        otp: emailService.latestSignupOtp(signupEmail),
        type: OtpType.EMAIL_VERIFY,
        deviceId,
        devicePublicKey: 'pub-key-new',
      },
      createRequest(),
      verifyRes as never,
    );

    await expectUnauthorized(
      authService.login(
        {
          identifier: 'updated_user',
          password: 'OldPassw0rd!',
          deviceId,
          deviceSignature: 'valid-signature',
        },
        { userAgent: 'jest', ip: '127.0.0.1' },
      ),
    );

    await expect(
      authService.login(
        {
          identifier: 'UPDATED_USER',
          password: 'NewPassw0rd!',
          deviceId,
          deviceSignature: 'valid-signature',
        },
        { userAgent: 'jest', ip: '127.0.0.1' },
      ),
    ).resolves.toMatchObject({
      user: expect.objectContaining({
        fullName: 'Updated Name',
        phone: '+2348033333333',
        username: 'updated_user',
      }),
    });
  });

  it('enforces device signatures outside production too', async () => {
    const session = await createVerifiedSession({
      email: 'devicecheck@example.com',
      username: 'device_check',
      phone: '+2348088888888',
      deviceId: 'device-check-1',
      devicePublicKey: 'pub-key-check-1',
    });

    await expectUnauthorized(
      authService.login(
        {
          identifier: session.email,
          password: session.password,
          deviceId: session.deviceId,
          deviceSignature: 'invalid-signature',
        },
        { userAgent: 'jest', ip: '127.0.0.1' },
      ),
    );
  });

  it('rejects legacy unverified access tokens on protected routes', async () => {
    const passwordHash = await bcrypt.hash('Passw0rd!', 12);
    const user = await userRepo.save(
      userRepo.create({
        email: 'legacy@example.com',
        username: 'legacy_user',
        fullName: 'Legacy User',
        phone: '+2348044444444',
        passwordHash,
        emailVerified: false,
        isActive: true,
      }),
    );

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    await expectUnauthorized(accessStrategy.validate(payload));
  });

  async function rotateRefreshToken(refreshToken: string) {
    const validated = await refreshStrategy.validate(
      createRequest({
        cookies: { refresh_token: refreshToken },
      }) as never,
      { sub: 'ignored' },
    );

    const response = createMockResponse();
    const result = await authController.refresh(
      createRequest({
        cookies: { refresh_token: refreshToken },
        user: validated,
      }) as never,
      response as never,
    );

    return {
      result,
      response,
      token: response.cookies[0].value,
    };
  }
});
