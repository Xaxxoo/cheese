// src/kyc/dto/index.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Length,
  Matches,
  IsNotEmpty,
} from 'class-validator';

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

  @ApiProperty({ example: '12345678901', description: '11-digit BVN to match against' })
  @IsString()
  @Length(11, 11, { message: 'BVN must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'BVN must contain only digits' })
  bvn: string;
}
