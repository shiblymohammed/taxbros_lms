import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../password-policy';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: PASSWORD_POLICY_MESSAGE, example: 'N3w#Password' })
  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  newPassword: string;
}
