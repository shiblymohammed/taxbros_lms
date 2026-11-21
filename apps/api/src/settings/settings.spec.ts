import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { daysInMonth, isValidTimezone, monthRange, todayInTimezone } from '../common/dates/institute-dates';

/** Institute settings (R6) and institute-date helpers (R6.6, R6.7). */
describe('institute dates', () => {
  it('builds month ranges as UTC calendar dates, whatever the server timezone', () => {
    const { startDate, endDate } = monthRange(2026, 11);
    expect(startDate.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(endDate.toISOString()).toBe('2026-11-30T00:00:00.000Z');
    expect(monthRange(2028, 2).endDate.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('gives today in the institute timezone, not UTC', () => {
    // 21 Nov 20:00 UTC is already 22 Nov 01:30 in India
    const now = new Date('2026-11-21T20:00:00Z');
    expect(todayInTimezone('Asia/Kolkata', now)).toBe('2026-11-22');
    expect(todayInTimezone('UTC', now)).toBe('2026-11-21');
  });

  it('validates IANA timezone names', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});

describe('SettingsService', () => {
  const prisma = {
    instituteSetting: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    user: { findMany: jest.fn() },
  };
  let service: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettingsService(prisma as any);
    prisma.instituteSetting.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('falls back to defaults, with Asia/Kolkata as the timezone (R6.1)', async () => {
    const all = await service.findAll();
    expect(all.find((s) => s.key === 'timezone')).toMatchObject({ value: 'Asia/Kolkata', isDefault: true, updatedBy: null });
    prisma.instituteSetting.findUnique.mockResolvedValue(null);
    await expect(service.getTimezone()).resolves.toBe('Asia/Kolkata');
  });

  it('shows who last changed a setting and when (R6.3)', async () => {
    const updatedAt = new Date('2026-11-21T09:00:00Z');
    prisma.instituteSetting.findMany.mockResolvedValue([{ key: 'timezone', value: 'Asia/Dubai', updatedBy: 'admin-1', updatedAt }]);
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1', email: 'admin@taxbros.test', staffProfile: null }]);

    const tz = (await service.findAll()).find((s) => s.key === 'timezone');
    expect(tz).toMatchObject({ value: 'Asia/Dubai', isDefault: false, updatedByName: 'admin@taxbros.test', updatedAt });
  });

  it('validates values and records the updater (R6.2, R6.3)', async () => {
    await service.update('timezone', ' Asia/Dubai ', 'admin-1');
    expect(prisma.instituteSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'timezone' },
      create: { key: 'timezone', value: 'Asia/Dubai', updatedBy: 'admin-1' },
      update: { value: 'Asia/Dubai', updatedBy: 'admin-1' },
    });

    await expect(service.update('timezone', 'Nowhere/City', 'admin-1')).rejects.toThrow(BadRequestException);
    await expect(service.update('instituteName', 'x', 'admin-1')).rejects.toThrow(BadRequestException);
    await expect(service.update('maxStudents', '10', 'admin-1')).rejects.toThrow('Unknown setting');
    expect(prisma.instituteSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it('caches the timezone and refreshes it after a change', async () => {
    prisma.instituteSetting.findUnique.mockResolvedValue({ key: 'timezone', value: 'Asia/Kolkata' });
    await service.getTimezone();
    await service.getTimezone();
    expect(prisma.instituteSetting.findUnique).toHaveBeenCalledTimes(1);

    await service.update('timezone', 'Asia/Dubai', 'admin-1');
    prisma.instituteSetting.findUnique.mockResolvedValue({ key: 'timezone', value: 'Asia/Dubai' });
    await expect(service.getTimezone()).resolves.toBe('Asia/Dubai');
  });

  it('uses the default timezone if the table cannot be read', async () => {
    prisma.instituteSetting.findUnique.mockRejectedValue(new Error('relation does not exist'));
    await expect(service.today(new Date('2026-11-21T20:00:00Z'))).resolves.toBe('2026-11-22');
  });
});

describe('SettingsController access (R6.4, R6.5)', () => {
  it('lets only administrators change settings; anyone signed in can read them', () => {
    const update = Reflect.getMetadata(ROLES_KEY, SettingsController.prototype.update);
    const read = Reflect.getMetadata(ROLES_KEY, SettingsController.prototype.findAll);
    expect(update).toEqual([UserRole.ADMINISTRATOR]);
    expect(read).toBeUndefined();
  });
});
