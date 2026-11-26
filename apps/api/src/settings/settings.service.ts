import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { todayInTimezone } from '../common/dates/institute-dates';
import { SETTING_DEFINITIONS, SettingKey, isSettingKey } from './settings.definitions';

export interface SettingView {
  key: SettingKey;
  label: string;
  description: string;
  value: string;
  isDefault: boolean;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: Date | null;
}

/**
 * Institute settings (R6). Values live in the institute_settings table; a key with no row
 * uses its default. The timezone is cached briefly because attendance code reads it often.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private timezoneCache: { value: string; expires: number } | null = null;
  private static readonly CACHE_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SettingView[]> {
    const rows = await this.prisma.instituteSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const updaterIds = [...new Set(rows.map((r) => r.updatedBy).filter((id): id is string => !!id))];
    const names = await this.userNames(updaterIds);

    return (Object.keys(SETTING_DEFINITIONS) as SettingKey[]).map((key) => {
      const def = SETTING_DEFINITIONS[key];
      const row = byKey.get(key);
      return {
        key,
        label: def.label,
        description: def.description,
        value: row?.value ?? def.defaultValue,
        isDefault: !row || row.value === def.defaultValue,
        updatedBy: row?.updatedBy ?? null,
        updatedByName: row?.updatedBy ? names.get(row.updatedBy) ?? null : null,
        updatedAt: row?.updatedBy ? row.updatedAt : null,
      };
    });
  }

  async get(key: SettingKey): Promise<string> {
    const row = await this.prisma.instituteSetting.findUnique({ where: { key } });
    return row?.value ?? SETTING_DEFINITIONS[key].defaultValue;
  }

  /** Every setting's current value (defaults filled in), in one query. */
  async values(): Promise<Record<SettingKey, string>> {
    const rows = await this.prisma.instituteSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return Object.fromEntries(
      (Object.keys(SETTING_DEFINITIONS) as SettingKey[]).map((key) => [key, byKey.get(key) ?? SETTING_DEFINITIONS[key].defaultValue]),
    ) as Record<SettingKey, string>;
  }

  /** Validates against the setting's rules and records who changed it (R6.2, R6.3). */
  async update(key: string, rawValue: string, userId: string): Promise<SettingView> {
    if (!isSettingKey(key)) {
      throw new BadRequestException(`Unknown setting "${key}"`);
    }
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    const error = SETTING_DEFINITIONS[key].validate(value);
    if (error) throw new BadRequestException(error);

    await this.prisma.instituteSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: userId },
      update: { value, updatedBy: userId },
    });
    if (key === 'timezone') this.timezoneCache = null;
    this.logger.log(`Setting ${key} changed by ${userId}`);

    return (await this.findAll()).find((s) => s.key === key)!;
  }

  /** Institute timezone, falling back to the default if the table can't be read (R6.1). */
  async getTimezone(): Promise<string> {
    const now = Date.now();
    if (this.timezoneCache && this.timezoneCache.expires > now) return this.timezoneCache.value;
    let value: string = SETTING_DEFINITIONS.timezone.defaultValue;
    try {
      value = await this.get('timezone');
    } catch (err) {
      this.logger.warn(`Could not read timezone setting, using ${value}: ${(err as Error).message}`);
    }
    this.timezoneCache = { value, expires: now + SettingsService.CACHE_MS };
    return value;
  }

  /** Today's date (YYYY-MM-DD) in the institute timezone (R6.6). */
  async today(now: Date = new Date()): Promise<string> {
    return todayInTimezone(await this.getTimezone(), now);
  }

  private async userNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, staffProfile: { select: { firstName: true, lastName: true } } },
    });
    return new Map(
      users.map((u) => [u.id, u.staffProfile ? `${u.staffProfile.firstName} ${u.staffProfile.lastName}` : u.email]),
    );
  }
}
