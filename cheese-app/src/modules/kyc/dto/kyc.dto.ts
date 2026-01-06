import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsPhoneNumber,
  Length,
  IsISO31661Alpha3,
  Matches,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KycLevel, KycStatus } from '../entities/kyc.entity';

export class InitiateKycDto {
  @ApiProperty({ description: 'User ID initiating KYC' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: KycLevel, default: KycLevel.BASIC })
  @IsEnum(KycLevel)
  @IsOptional()
  level?: KycLevel = KycLevel.BASIC;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsPhoneNumber()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsISO31661Alpha3()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateKycDto {
  @ApiPropertyOptional({ example: '123 Main St' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'passport' })
  @IsString()
  @IsOptional()
  documentType?: string;

  @ApiPropertyOptional({ example: 'AB1234567' })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class KycWebhookDto {
  @ApiProperty({ description: 'Verification ID from external provider' })
  @IsString()
  @IsNotEmpty()
  verificationId: string;

  @ApiProperty({ enum: KycStatus })
  @IsEnum(KycStatus)
  @IsNotEmpty()
  status: KycStatus;

  @ApiPropertyOptional({ description: 'Rejection reason if status is rejected' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Risk assessment data' })
  @IsObject()
  @IsOptional()
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
    flags: string[];
  };

  @ApiPropertyOptional({ description: 'Additional provider data' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Webhook signature for verification' })
  @IsString()
  @IsOptional()
  signature?: string;

  @ApiPropertyOptional({ description: 'Timestamp of the event' })
  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class ManualReviewDto {
  @ApiProperty({ enum: KycStatus })
  @IsEnum(KycStatus)
  @IsNotEmpty()
  status: KycStatus;

  @ApiProperty({ description: 'Review notes' })
  @IsString()
  @IsNotEmpty()
  reviewNotes: string;

  @ApiProperty({ description: 'Admin user performing review' })
  @IsString()
  @IsNotEmpty()
  reviewedBy: string;
}

export class KycResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  verificationId: string;

  @ApiProperty({ enum: KycStatus })
  status: KycStatus;

  @ApiProperty({ enum: KycLevel })
  level: KycLevel;

  @ApiProperty()
  verificationUrl: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  rejectionReason?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  expiresAt?: Date;
}

export class KycStatusResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: KycStatus })
  status: KycStatus;

  @ApiProperty({ enum: KycLevel })
  level: KycLevel;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  canTransact: boolean;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiPropertyOptional()
  rejectionReason?: string;
}

export class QueryKycDto {
  @ApiPropertyOptional({ enum: KycStatus })
  @IsEnum(KycStatus)
  @IsOptional()
  status?: KycStatus;

  @ApiPropertyOptional({ enum: KycLevel })
  @IsEnum(KycLevel)
  @IsOptional()
  level?: KycLevel;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}