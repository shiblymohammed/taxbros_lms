import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AttendanceSource, AttendanceStatus } from '@prisma/client';
import { SelfAttendanceService } from './self-attendance.service';
import { CODE_STEP_MS, checkPlace, classCode, codeMatches, codeStep, distanceMeters, ipAllowed, placeRules } from './self-check';
import { SETTING_DEFINITIONS } from '../settings/settings.definitions';

const defaults = Object.fromEntries(Object.entries(SETTING_DEFINITIONS).map(([k, d]) => [k, d.defaultValue])) as Record<
  keyof typeof SETTING_DEFINITIONS,
  string
>;

describe('self check rules', () => {
  it('matches exact addresses and ranges ending in a dot', () => {
    expect(ipAllowed('::ffff:192.168.1.48', ['192.168.1.'])).toBe(true);
    expect(ipAllowed('103.21.4.17', ['103.21.4.17'])).toBe(true);
    expect(ipAllowed('103.21.4.170', ['103.21.4.17'])).toBe(false);
    expect(ipAllowed('', ['192.168.1.'])).toBe(false);
  });

  it('measures distance in metres', () => {
    // About 111 m per 0.001° of latitude
    const d = distanceMeters({ latitude: 9.931, longitude: 76.267 }, { latitude: 9.932, longitude: 76.267 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });

  it('needs the network or the location, and says why not', () => {
    const none = placeRules({ attendanceNetworks: '', attendanceLocation: '', attendanceRadiusMeters: '150' });
    expect(checkPlace(none, '1.2.3.4')).toEqual({ ok: false, reason: 'NOT_SET_UP' });

    const both = placeRules({ attendanceNetworks: '192.168.1.', attendanceLocation: '9.931, 76.267', attendanceRadiusMeters: '150' });
    expect(checkPlace(both, '192.168.1.9')).toEqual({ ok: true, via: 'network' });
    expect(checkPlace(both, '8.8.8.8')).toEqual({ ok: false, reason: 'NEED_LOCATION' });
    expect(checkPlace(both, '8.8.8.8', { latitude: 9.9312, longitude: 76.2671 })).toEqual({ ok: true, via: 'location' });
    expect(checkPlace(both, '8.8.8.8', { latitude: 9.95, longitude: 76.267 })).toMatchObject({ ok: false, reason: 'NOT_AT_INSTITUTE' });
  });

  it('accepts the current and previous class code only', () => {
    const now = 1_800_000_000_000;
    const step = codeStep(now);
    expect(classCode('secret', 'reg-1', step)).toMatch(/^\d{6}$/);
    expect(codeMatches('secret', 'reg-1', classCode('secret', 'reg-1', step), now)).toBe(true);
    expect(codeMatches('secret', 'reg-1', classCode('secret', 'reg-1', step - 1), now)).toBe(true);
    expect(codeMatches('secret', 'reg-1', classCode('secret', 'reg-1', step - 2), now)).toBe(false);
    expect(codeMatches('secret', 'reg-2', classCode('secret', 'reg-1', step), now)).toBe(false);
    expect(codeMatches('secret', 'reg-1', 'abc', now)).toBe(false);
  });
});

describe('SelfAttendanceService', () => {
  // 2026-11-26 04:00 UTC = 09:30 in Asia/Kolkata
  const at = (hhmmIst: string) => new Date(`2026-11-26T${hhmmIst}:00+05:30`);
  let values: Record<string, string>;
  let prisma: any;
  let service: SelfAttendanceService;

  beforeEach(() => {
    values = { ...defaults, attendanceNetworks: '192.168.1.' };
    prisma = {
      staffAttendance: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => data), update: jest.fn() },
      studentAttendanceRegister: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      studentAttendance: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => data), createMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const settings: any = {
      values: jest.fn(async () => values),
      today: jest.fn(async () => '2026-11-26'),
    };
    service = new SelfAttendanceService(prisma, settings, { openRegister: jest.fn() } as any);
  });

  const staff = { userId: 'u-staff', staffId: 'staff-1', role: 'STAFF' };
  const student = { userId: 'u-stu', studentId: 'stu-1', role: 'STUDENT' };

  describe('staff check-in', () => {
    it('marks Present on the institute network before the late time', async () => {
      const r = await service.staffCheckIn(staff, '192.168.1.20', null, at('09:00'));
      expect(r.status).toBe(AttendanceStatus.PRESENT);
      expect(r.checkInVia).toBe('network');
      expect(prisma.staffAttendance.create.mock.calls[0][0].data.source).toBe(AttendanceSource.SELF_CHECK_IN);
    });

    it('marks Late after the late time', async () => {
      const r = await service.staffCheckIn(staff, '192.168.1.20', null, at('10:15'));
      expect(r.status).toBe(AttendanceStatus.LATE);
    });

    it('refuses outside check-in hours and away from the institute', async () => {
      await expect(service.staffCheckIn(staff, '192.168.1.20', null, at('13:00'))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.staffCheckIn(staff, '8.8.8.8', null, at('09:00'))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses when an administrator already marked the day', async () => {
      prisma.staffAttendance.findUnique.mockResolvedValue({ status: 'ABSENT', checkInAt: null });
      await expect(service.staffCheckIn(staff, '192.168.1.20', null, at('09:00'))).rejects.toBeInstanceOf(ConflictException);
    });

    it('is only for staff profiles', async () => {
      await expect(service.staffCheckIn({ userId: 'a', role: 'ADMINISTRATOR' }, '192.168.1.20', null, at('09:00'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('student check-in', () => {
    const openedAt = at('09:00');
    const register = (over: Record<string, unknown> = {}) => ({
      id: 'reg-1',
      rosterSnapshot: ['stu-1', 'stu-2'],
      selfCheckInSecret: 'secret',
      selfCheckInOpenedAt: openedAt,
      selfCheckInClosedAt: null,
      class: { name: 'GST Batch A' },
      ...over,
    });
    const codeAt = (now: Date) => classCode('secret', 'reg-1', codeStep(now.getTime()));

    it('marks Present with the current code', async () => {
      prisma.studentAttendanceRegister.findMany.mockResolvedValue([register()]);
      const now = at('09:05');
      const r = await service.studentCheckIn(student, { code: codeAt(now) }, '8.8.8.8', null, now);
      expect(r).toMatchObject({ className: 'GST Batch A', status: AttendanceStatus.PRESENT, alreadyMarked: false });
      expect(prisma.studentAttendance.create.mock.calls[0][0].data.source).toBe(AttendanceSource.SELF_QR);
    });

    it('marks Late after the set minutes', async () => {
      prisma.studentAttendanceRegister.findMany.mockResolvedValue([register()]);
      const now = at('09:20');
      const r = await service.studentCheckIn(student, { code: codeAt(now) }, '8.8.8.8', null, now);
      expect(r.status).toBe(AttendanceStatus.LATE);
    });

    it('rejects an old code and blocks guessing', async () => {
      prisma.studentAttendanceRegister.findMany.mockResolvedValue([register()]);
      const now = at('09:05');
      const old = classCode('secret', 'reg-1', codeStep(now.getTime() - 3 * CODE_STEP_MS));
      await expect(service.studentCheckIn(student, { code: old }, '8.8.8.8', null, now)).rejects.toBeInstanceOf(BadRequestException);
      for (let i = 0; i < 9; i++) await service.studentCheckIn(student, { code: old }, '', null, now).catch(() => undefined);
      await expect(service.studentCheckIn(student, { code: codeAt(now) }, '', null, now)).rejects.toMatchObject({ status: 429 });
    });

    it('refuses students who are not on the register', async () => {
      prisma.studentAttendanceRegister.findMany.mockResolvedValue([register({ rosterSnapshot: ['stu-2'] })]);
      const now = at('09:05');
      await expect(service.studentCheckIn(student, { code: codeAt(now) }, '', null, now)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('keeps an existing mark', async () => {
      prisma.studentAttendanceRegister.findMany.mockResolvedValue([register()]);
      prisma.studentAttendance.findUnique.mockResolvedValue({ status: 'ABSENT', markedAt: openedAt });
      const now = at('09:05');
      const r = await service.studentCheckIn(student, { code: codeAt(now) }, '', null, now);
      expect(r).toMatchObject({ status: 'ABSENT', alreadyMarked: true });
      expect(prisma.studentAttendance.create).not.toHaveBeenCalled();
    });

    it('also checks the place when the setting is on', async () => {
      values.studentNetworkCheck = 'on';
      prisma.studentAttendanceRegister.findMany.mockResolvedValue([register()]);
      const now = at('09:05');
      await expect(service.studentCheckIn(student, { code: codeAt(now) }, '8.8.8.8', null, now)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.studentCheckIn(student, { code: codeAt(now) }, '192.168.1.7', null, now)).resolves.toMatchObject({
        status: AttendanceStatus.PRESENT,
      });
    });
  });

  it('closing check-in marks students without a mark Absent', async () => {
    prisma.studentAttendanceRegister.findUnique.mockResolvedValue({
      id: 'reg-1',
      classId: 'class-1',
      attendanceDate: new Date('2026-11-26'),
      rosterSnapshot: ['stu-1', 'stu-2'],
      class: { name: 'GST Batch A' },
      attendanceRecords: [{ studentId: 'stu-1', status: 'PRESENT', source: 'SELF_QR' }],
    });
    await service.closeClassCheckIn('reg-1', 'u-teacher', at('10:00'));
    const absent = prisma.studentAttendance.createMany.mock.calls[0][0].data;
    expect(absent).toEqual([expect.objectContaining({ studentId: 'stu-2', status: AttendanceStatus.ABSENT, markedBy: 'u-teacher' })]);
  });
});
