// src/kyc/dto/index.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, IsNotEmpty, IsIn } from 'class-validator';

export class VerifyBvnDto {
  @ApiProperty({ example: '12345678901', description: '11-digit BVN' })
  @IsString()
  @Length(11, 11, { message: 'BVN must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'BVN must contain only digits' })
  bvn: string;
}

export class VerifyNinDto {
  @ApiProperty({ example: '12345678901', description: '11-digit NIN' })
  @IsString()
  @Length(11, 11, { message: 'NIN must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'NIN must contain only digits' })
  nin: string;
}

export class VerifySelfieDto {
  @ApiProperty({
    description: 'Base64-encoded selfie image (JPEG or PNG, max 2 MB)',
    example: '/9j/4AAQSkZJRgAB...',
  })
  @IsString()
  @IsNotEmpty()
  selfieImage: string;

  @ApiProperty({
    example: '12345678901',
    description: '11-digit BVN to match against',
  })
  @IsString()
  @Length(11, 11, { message: 'BVN must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'BVN must contain only digits' })
  bvn: string;
}

export class VerifyDocumentDto {
  @ApiProperty({
    description: 'Base64-encoded document image (JPEG or PNG, max 5 MB)',
    example: '/9j/4AAQSkZJRgAB...',
  })
  @IsString()
  @IsNotEmpty()
  documentImage: string;

  @ApiProperty({
    enum: ['passport', 'drivers_license', 'nin_slip'],
    description: 'Type of identity document',
    example: 'passport',
  })
  @IsIn(['passport', 'drivers_license', 'nin_slip'])
  documentType: 'passport' | 'drivers_license' | 'nin_slip';
}

export class AdminApproveDto {
  @ApiProperty({ description: 'User ID to approve or reject' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class AdminRejectDto {
  @ApiProperty({ description: 'User ID to reject' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
