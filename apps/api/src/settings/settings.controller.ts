import { Body, Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

/**
 * Institute settings (R6).
 * - GET /settings: any signed-in user (the app needs the timezone and name to show dates).
 * - PATCH /settings/:key: administrators only; staff and students get 403 (R6.4, R6.5).
 */
@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  findAll() {
    return this.settings.findAll();
  }

  @Patch(':key')
  @Roles(UserRole.ADMINISTRATOR)
  update(@Param('key') key: string, @Body() dto: UpdateSettingDto, @Request() req: any) {
    return this.settings.update(key, dto.value, req.user.userId);
  }
}
