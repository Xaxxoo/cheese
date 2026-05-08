import { IsString, MinLength } from 'class-validator';

export class ChangeAdminPasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
