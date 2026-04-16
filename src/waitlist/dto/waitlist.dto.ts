import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SharePlatform } from '../entities/share-event.entity';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(20, { message: 'Username must be at most 20 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  username: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim() || undefined)
  referralCode?: string;
}

export class ShareDto {
  @IsUUID(4, { message: 'sharerId must be a valid UUID' })
  userId: string;

  @IsEnum(SharePlatform, {
    message:
      'platform must be one of: twitter, linkedin, whatsapp, telegram, facebook',
  })
  platform: SharePlatform;
}

export class CheckUsernameDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/)
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  username: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim() || undefined)
  referralCode?: string;
}
