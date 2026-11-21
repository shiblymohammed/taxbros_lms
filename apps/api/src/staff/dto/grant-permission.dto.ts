import { IsEnum } from 'class-validator';
import { StaffPermissionType } from '@prisma/client';

export class GrantPermissionDto {
  @IsEnum(StaffPermissionType)
  permission: StaffPermissionType;
}
