// src/otp/otp.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { Otp, OtpType } from './entities/otp.entity';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ttl: number;

  constructor(
    @InjectRepository(Otp) private readonly otpRepo: Repository<Otp>,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.ttl = config.get<number>('otp.ttlSeconds', 300);
  }

  async sendOtp(
    email: string,
    type: OtpType,
    meta?: { fullName?: string },
  ): Promise<string> {
    await this.otpRepo.update({ email, type, isUsed: false }, { isUsed: true });

    const code = String(randomInt(100_000, 999_999));
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + this.ttl * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({ email, codeHash, type, expiresAt }),
    );

    const expiresIn = `${Math.round(this.ttl / 60)} minutes`;
    const fullName = meta?.fullName || 'there';

    if (
      [OtpType.EMAIL_VERIFY, OtpType.PHONE_VERIFY, OtpType.LOGIN_2FA].includes(
        type,
      )
    ) {
      await this.emailService.sendSignupOtp({
        to: email,
        fullName,
        otp: code,
        expiresIn,
      });
    } else if (type === OtpType.PASSWORD_RESET) {
      await this.emailService.sendPasswordResetOtp({
        to: email,
        fullName,
        otp: code,
        expiresIn,
      });
    } else if (type === OtpType.DEVICE_REGISTER) {
      await this.emailService.sendDeviceRegistrationOtp({
        to: email,
        fullName,
        otp: code,
        expiresIn,
      });
    }

    return code;
  }

  async verifyOtp(
    email: string,
    code: string,
    type: OtpType,
  ): Promise<boolean> {
    // Find the active OTP record without filtering by code first,
    // so that failed attempts can be tracked against the right record.
    const otp = await this.otpRepo.findOne({
      where: { email, type, isUsed: false },
      order: { createdAt: 'DESC' },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');
    if (otp.expiresAt < new Date())
      throw new BadRequestException('OTP has expired');
    if (otp.attempts >= 5)
      throw new BadRequestException(
        'Too many failed attempts. Request a new OTP.',
      );

    const codeHash = this.hashCode(code);
    if (otp.codeHash !== codeHash) {
      await this.otpRepo.increment({ id: otp.id }, 'attempts', 1);
      throw new BadRequestException('Invalid OTP');
    }

    await this.otpRepo.update(otp.id, { isUsed: true });
    return true;
  }

  async checkOtp(email: string, code: string, type: OtpType): Promise<Otp> {
    const codeHash = this.hashCode(code);
    const otp = await this.otpRepo.findOne({
      where: { email, codeHash, type, isUsed: false },
      order: { createdAt: 'DESC' },
    });
    if (!otp || otp.expiresAt < new Date())
      throw new BadRequestException('Invalid or expired OTP');
    await this.otpRepo.increment({ id: otp.id }, 'attempts', 1);
    return otp;
  }

  async consumeOtp(id: string): Promise<void> {
    await this.otpRepo.update(id, { isUsed: true });
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
