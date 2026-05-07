import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../../auth/entities/user.entity';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@cheese.app' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'securepass123' })
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  adminRole: AdminRole;
}
