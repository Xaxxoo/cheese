// src/waitlist/dto/index.ts
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinWaitlistDto {
  @ApiProperty({
    example: 'tunde@example.com',
    description:
      'Email address to receive launch notification and waitlist updates',
  })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'tunde_ok',
    description:
      'Desired username to reserve (3–20 chars, letters/numbers/underscores). Checked against existing users and waitlist.',
    minLength: 3,
    maxLength: 20,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers and underscores',
  })
  @Transform(({ value }: { value: string }) =>
    value?.toLowerCase().trim().replace(/^@/, ''),
  )
  username: string;

  @ApiPropertyOptional({
    example: 'twitter',
    description:
      'Where the user heard about Cheese Pay — used for marketing attribution',
  })
  @IsOptional()
  @IsString()
  referralSource?: string;
}
