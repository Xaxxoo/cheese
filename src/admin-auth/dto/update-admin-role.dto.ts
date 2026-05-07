import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../../auth/entities/user.entity';

export class UpdateAdminRoleDto {
  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  adminRole: AdminRole;
}
