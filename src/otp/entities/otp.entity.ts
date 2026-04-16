// src/otp/entities/otp.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OtpType {
  EMAIL_VERIFY = 'email_verify',
  PHONE_VERIFY = 'phone_verify',
  PASSWORD_RESET = 'password_reset',
  LOGIN_2FA = 'login_2fa',
}

@Entity('otps')
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ name: 'code_hash' })
  codeHash: string;

  @Column({ type: 'varchar' })
  type: OtpType;

  @Column({
    name: 'expires_at',
    type: 'bigint',
    transformer: {
      from: (value: number) => new Date(Number(value)),
      to: (value: Date) => value.getTime(),
    },
  })
  expiresAt: Date;

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @Column({ name: 'attempts', default: 0 })
  attempts: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
