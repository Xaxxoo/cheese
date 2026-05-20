// src/auth/dto/index.ts
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpType } from '../../otp/entities/otp.entity';

export class SignupDto {
  @ApiProperty({
    example: 'Tunde Okafor',
    description: 'Full legal name of the user',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  fullName: string;

  @ApiProperty({
    example: 'tunde@example.com',
    description: 'Email address — used for OTP verification',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '+2348012345678',
    description: 'Phone number in E.164 format',
  })
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'Invalid phone number' })
  phone: string;

  @ApiProperty({
    example: 'tunde_ok',
    description:
      'Unique username (3–20 chars, letters/numbers/underscores only)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers and underscores',
  })
  username: string;

  @ApiProperty({
    example: 'MyStr0ngPass!',
    description: 'Password (8–64 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9]).{8,64}$/, {
    message: 'Password must contain at least one uppercase letter and one number',
  })
  password: string;

  @ApiProperty({
    example: 'MFkwEwYHKoZIzj0CAQY...',
    description:
      'ECDSA P-256 public key in base64url or PEM format — used to verify future device signatures',
  })
  @IsString()
  @IsNotEmpty()
  devicePublicKey: string;

  @ApiProperty({
    example: 'device-uuid-v4-here',
    description: 'Unique identifier for this device installation',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({
    example: 'TUNDE_OK',
    description:
      "Optional referral code from a friend's share link. Links this account to the referrer so they earn a reward on your first transaction.",
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    example: 'tunde@example.com',
    description: 'Email address the OTP was sent to',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482910',
    description: '6-digit OTP code from email',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @ApiProperty({
    enum: OtpType,
    example: OtpType.EMAIL_VERIFY,
    description: 'Type of OTP being verified',
  })
  @IsEnum(OtpType)
  type: OtpType;

  @ApiPropertyOptional({
    example: 'device-uuid-v4-here',
    description:
      'Device ID from signup — required for EMAIL_VERIFY to bind the session token to the device',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'MFkwEwYHKoZIzj0CAQY...',
    description:
      'ECDSA P-256 public key — when provided alongside deviceId during EMAIL_VERIFY, ' +
      're-upserts the device record so the key is confirmed even if the signup request timed out',
  })
  @IsOptional()
  @IsString()
  devicePublicKey?: string;
}

export class ResendOtpDto {
  @ApiProperty({
    example: 'tunde@example.com',
    description: 'Email address to resend OTP to',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: OtpType,
    example: OtpType.EMAIL_VERIFY,
    description: 'Type of OTP to resend',
  })
  @IsEnum(OtpType)
  type: OtpType;
}

export class LoginDto {
  @ApiProperty({
    example: 'tunde@example.com',
    description: 'Email address or username',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'MyStr0ngPass!', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'base64-ecdsa-signature-here',
    description:
      'ECDSA P-256 signature of SHA256(timestamp) in base64, proving device ownership',
  })
  @IsString()
  @IsNotEmpty()
  deviceSignature: string;

  @ApiProperty({
    example: 'device-uuid-v4-here',
    description: 'Device ID matching the registered public key',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'tunde@example.com',
    description: 'Email address to send reset OTP to',
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'tunde@example.com',
    description: 'Email address the reset OTP was sent to',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '391847',
    description: '6-digit OTP from password reset email',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @ApiProperty({
    example: 'NewStr0ngPass!',
    description: 'New password (8–64 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9]).{8,64}$/, {
    message: 'Password must contain at least one uppercase letter and one number',
  })
  newPassword: string;
}

export class VerifyPinDto {
  @ApiProperty({
    example: 'hmac-sha256-base64url-here',
    description:
      'Client-computed HMAC-SHA256(pin, userId) in base64url — raw PIN never leaves the device',
  })
  @IsString()
  @IsNotEmpty()
  pinHash: string;

  @ApiProperty({
    example: 'device-uuid-v4-here',
    description: 'Device ID used as the HMAC key',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class SetPinDto {
  @ApiProperty({
    example: 'hmac-sha256-base64url-here',
    description:
      'HMAC-SHA256(pin, userId) — the PIN hash to set. Only valid when no PIN exists yet.',
  })
  @IsString()
  @IsNotEmpty()
  pinHash: string;

  @ApiProperty({
    example: 'device-uuid-v4-here',
    description: 'Device ID (legacy field — ignored by the server, kept for compatibility)',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class RequestDeviceRegistrationDto {
  @ApiProperty({ example: 'tunde@example.com' })
  @IsEmail()
  email: string;
}

export class CompleteDeviceRegistrationDto {
  @ApiProperty({ example: 'tunde@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '482910', description: '6-digit OTP from email' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @ApiProperty({ example: 'device-uuid-v4', description: 'New device UUID generated on the device' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 'MFkwEwYHKoZI...', description: 'ECDSA P-256 public key in base64url' })
  @IsString()
  @IsNotEmpty()
  publicKey: string;
}

export class CompleteDeviceRegistrationByLinkDto {
  @ApiProperty({
    example: 'eyJhbGci...',
    description: 'Signed token from the magic-link URL (?token=...)',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'device-uuid-v4', description: 'New device UUID generated on this device' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 'MFkwEwYHKoZI...', description: 'ECDSA P-256 public key in base64url' })
  @IsString()
  @IsNotEmpty()
  publicKey: string;
}

export class ChangePinDto {
  @ApiProperty({
    example: 'hmac-sha256-old-pin-base64url',
    description:
      'HMAC-SHA256(currentPin, userId) — verifies ownership of existing PIN',
  })
  @IsString()
  @IsNotEmpty()
  currentPinHash: string;

  @ApiProperty({
    example: 'hmac-sha256-new-pin-base64url',
    description: 'HMAC-SHA256(newPin, userId) — the new PIN hash to store',
  })
  @IsString()
  @IsNotEmpty()
  newPinHash: string;

  @ApiProperty({
    example: 'device-uuid-v4-here',
    description: 'Device ID used as the HMAC key',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({
    example: 'base64-ecdsa-signature-here',
    description: 'ECDSA P-256 device signature authorising the PIN change',
  })
  @IsString()
  @IsNotEmpty()
  deviceSignature: string;
}
