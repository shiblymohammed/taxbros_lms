import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceSource, AttendanceStatus, RegisterStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { minutesOfDayInTimezone } from '../common/dates/institute-dates';
import { parseTime, parseTimeWindow } from '../settings/settings.definitions';
import { AttendanceService } from './attendance.service';
import {
  CODE_STEP_MS,
  checkPlace,
  classCode,
  codeMatches,
  codeStep,
  newCheckInSecret,
  placeRules,
  type Coordinates,
  type PlaceCheck,
} from './self-check';

/** "07:30" from minutes after midnight. */
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** YYYY-MM-DD of a @db.Date column. */
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

const WRONG_CODE_LIMIT = 10;
const WRONG_CODE_WINDOW_MS = 10 * 60_000;

/**
 * Self attendance:
 * - Staff check in and out themselves, on the institute network or at its location, within set hours.
 * - A teacher starts self check-in on today's class register; students type or scan the rotating
 *   six-digit code shown on the teacher's screen. Closing check-in marks everyone else Absent.
 * Teachers and administrators can still correct any mark in the register.
 */
@Injectable()
export class SelfAttendanceService {
  /** Wrong class codes per student, to stop guessing (in memory; resets on restart). */
  private readonly wrongCodes = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly attendance: AttendanceService,
  ) {}

  // ---------------------------------------------------------------- place

  private placeError(check: Exclude<PlaceCheck, { ok: true }>): HttpException {
    switch (check.reason) {
      case 'NOT_SET_UP':
        return new ForbiddenException({
          statusCode: 403,
          code: 'SELF_CHECK_IN_NOT_SET_UP',
          message: 'Self check-in is not set up yet. An administrator needs to add the institute network or location in Settings.',
        });
      case 'NEED_LOCATION':
        return new BadRequestException({
          statusCode: 400,
          code: 'LOCATION_REQUIRED',
          message: 'Allow location access, or connect to the institute Wi-Fi, to check in.',
        });
      default:
        return new ForbiddenException({
          statusCode: 403,
          code: 'NOT_AT_INSTITUTE',
          message:
            check.distanceMeters !== undefined
              ? `You seem to be about ${check.distanceMeters} m from the institute. Check in when you are there, or connect to the institute Wi-Fi.`
              : 'Connect to the institute Wi-Fi to check in.',
        });
    }
  }

  /** What the app needs to know before asking for location. */
  private async rules() {
    const values = await this.settings.values();
    const place = placeRules(values);
    return { values, place, timezone: values.timezone };
  }

  // ---------------------------------------------------------------- staff

  private async staffIdOf(user: { staffId?: string; role: string }): Promise<string> {
    if (!user.staffId) {
      throw new ForbiddenException('Only staff accounts check in. Administrators without a staff profile have no attendance.');
    }
    return user.staffId;
  }

  /** Today's record and the check-in rules (staff "My attendance" screen). */
  async staffToday(user: { staffId?: string; role: string }, ip: string, now = new Date()) {
    const staffId = await this.staffIdOf(user);
    const { values, place, timezone } = await this.rules();
    const date = await this.settings.today(now);
    const record = await this.prisma.staffAttendance.findUnique({
      where: { staffId_attendanceDate: { staffId, attendanceDate: new Date(date) } },
    });
    const window = parseTimeWindow(values.staffCheckInWindow)!;
    const minute = minutesOfDayInTimezone(timezone, now);
    return {
      date,
      record: record && this.staffRecordView(record),
      window: { start: clock(window.start), end: clock(window.end) },
      lateAfter: values.staffLateAfter,
      open: minute >= window.start && minute <= window.end,
      setUp: place.networks.length > 0 || !!place.location,
      usesLocation: !!place.location,
      onInstituteNetwork: checkPlace({ ...place, location: null }, ip).ok,
    };
  }

  async staffCheckIn(user: { userId: string; staffId?: string; role: string }, ip: string, coords?: Coordinates | null, now = new Date()) {
    const staffId = await this.staffIdOf(user);
    const { values, place, timezone } = await this.rules();
    const date = await this.settings.today(now);
    const attendanceDate = new Date(date);

    const existing = await this.prisma.staffAttendance.findUnique({
      where: { staffId_attendanceDate: { staffId, attendanceDate } },
    });
    if (existing?.checkInAt) return this.staffRecordView(existing);
    if (existing) {
      throw new ConflictException('Your attendance for today was already marked by an administrator.');
    }

    if (place.networks.length === 0 && !place.location) throw this.placeError({ ok: false, reason: 'NOT_SET_UP' });

    const window = parseTimeWindow(values.staffCheckInWindow)!;
    const minute = minutesOfDayInTimezone(timezone, now);
    if (minute < window.start || minute > window.end) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'OUTSIDE_CHECK_IN_HOURS',
        message: `Check-in is open from ${clock(window.start)} to ${clock(window.end)}. Ask an administrator to mark you if you missed it.`,
      });
    }

    const check = checkPlace(place, ip, coords);
    if (!check.ok) throw this.placeError(check);

    const lateAfter = parseTime(values.staffLateAfter) ?? window.end;
    const record = await this.prisma.staffAttendance.create({
      data: {
        staffId,
        attendanceDate,
        status: minute > lateAfter ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        markedBy: user.userId,
        markedAt: now,
        source: AttendanceSource.SELF_CHECK_IN,
        checkInAt: now,
        checkInVia: check.via,
      },
    });
    return this.staffRecordView(record);
  }

  async staffCheckOut(user: { userId: string; staffId?: string; role: string }, ip: string, coords?: Coordinates | null, now = new Date()) {
    const staffId = await this.staffIdOf(user);
    const { place } = await this.rules();
    const date = await this.settings.today(now);
    const record = await this.prisma.staffAttendance.findUnique({
      where: { staffId_attendanceDate: { staffId, attendanceDate: new Date(date) } },
    });
    if (!record?.checkInAt) throw new BadRequestException('Check in first.');
    if (record.checkOutAt) return this.staffRecordView(record);

    const check = checkPlace(place, ip, coords);
    if (!check.ok) throw this.placeError(check);

    const updated = await this.prisma.staffAttendance.update({ where: { id: record.id }, data: { checkOutAt: now } });
    return this.staffRecordView(updated);
  }

  private staffRecordView(r: {
    attendanceDate: Date;
    status: AttendanceStatus;
    source: AttendanceSource;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    checkInVia: string | null;
    remarks: string | null;
  }) {
    return {
      date: dateOnly(r.attendanceDate),
      status: r.status,
      source: r.source,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      checkInVia: r.checkInVia,
      remarks: r.remarks,
    };
  }

  // ---------------------------------------------------------------- teacher: class QR

  private async todaysRegister(registerId: string, now = new Date()) {
    const register = await this.prisma.studentAttendanceRegister.findUnique({
      where: { id: registerId },
      include: { class: { select: { name: true } }, attendanceRecords: { select: { studentId: true, status: true, markedAt: true, source: true } } },
    });
    if (!register) throw new NotFoundException(`Register with ID ${registerId} not found`);
    const today = await this.settings.today(now);
    return { register, today, isToday: dateOnly(register.attendanceDate) === today };
  }

  /** Start (or restart) student self check-in on today's register. */
  async startClassCheckIn(registerId: string, now = new Date()) {
    const { register, isToday } = await this.todaysRegister(registerId, now);
    if (!isToday) throw new BadRequestException("Self check-in only works on today's register.");
    const reopening = !register.selfCheckInOpenedAt || !!register.selfCheckInClosedAt;
    await this.prisma.studentAttendanceRegister.update({
      where: { id: registerId },
      data: {
        selfCheckInSecret: register.selfCheckInSecret ?? newCheckInSecret(),
        ...(reopening && { selfCheckInOpenedAt: now }),
        selfCheckInClosedAt: null,
      },
    });
    return this.classCheckInState(registerId, now);
  }

  /** The teacher's screen: current code, how long it lasts, and who has checked in. */
  async classCheckInState(registerId: string, now = new Date()) {
    const { register } = await this.todaysRegister(registerId, now);
    const open = !!register.selfCheckInOpenedAt && !register.selfCheckInClosedAt && !!register.selfCheckInSecret;
    const roster = register.rosterSnapshot as string[];
    const step = codeStep(now.getTime());
    const values = await this.settings.values();
    return {
      registerId,
      className: register.class.name,
      date: dateOnly(register.attendanceDate),
      open,
      openedAt: register.selfCheckInOpenedAt,
      closedAt: register.selfCheckInClosedAt,
      code: open ? classCode(register.selfCheckInSecret!, registerId, step) : null,
      /** Milliseconds until the code changes */
      expiresInMs: open ? (step + 1) * CODE_STEP_MS - now.getTime() : null,
      lateAfterMinutes: Number(values.studentLateAfterMinutes),
      total: roster.length,
      checkedIn: register.attendanceRecords.filter((r) => r.source === AttendanceSource.SELF_QR).length,
      marked: register.attendanceRecords.length,
    };
  }

  /** Stop check-in; students who have no mark yet become Absent. Returns the register. */
  async closeClassCheckIn(registerId: string, closedByUserId: string, now = new Date()) {
    const { register } = await this.todaysRegister(registerId, now);
    const roster = register.rosterSnapshot as string[];
    const marked = new Set(register.attendanceRecords.map((r) => r.studentId));
    const missing = roster.filter((id) => !marked.has(id));

    await this.prisma.$transaction([
      this.prisma.studentAttendanceRegister.update({
        where: { id: registerId },
        data: { selfCheckInClosedAt: now, status: RegisterStatus.SAVED },
      }),
      ...(missing.length > 0
        ? [
            this.prisma.studentAttendance.createMany({
              data: missing.map((studentId) => ({
                registerId,
                studentId,
                status: AttendanceStatus.ABSENT,
                remarks: 'Did not check in',
                markedBy: closedByUserId,
                markedAt: now,
                source: AttendanceSource.MARKED,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return this.attendance.openRegister({ classId: register.classId, attendanceDate: dateOnly(register.attendanceDate) });
  }

  // ---------------------------------------------------------------- student

  private studentIdOf(user: { studentId?: string; role: string }): string {
    if (user.role !== 'STUDENT' || !user.studentId) throw new ForbiddenException('Only students check in to classes.');
    return user.studentId;
  }

  /** Today's registers for this student's classes, with their own mark (student check-in screen). */
  async studentToday(user: { studentId?: string; role: string }, now = new Date()) {
    const studentId = this.studentIdOf(user);
    const today = await this.settings.today(now);
    const values = await this.settings.values();
    const registers = await this.prisma.studentAttendanceRegister.findMany({
      where: { attendanceDate: new Date(today) },
      include: { class: { select: { name: true } }, attendanceRecords: { where: { studentId }, select: { status: true, markedAt: true, source: true } } },
    });
    const mine = registers.filter((r) => (r.rosterSnapshot as string[]).includes(studentId));
    return {
      date: today,
      requiresPlace: values.studentNetworkCheck === 'on',
      usesLocation: values.studentNetworkCheck === 'on' && !!placeRules(values).location,
      classes: mine.map((r) => ({
        registerId: r.id,
        className: r.class.name,
        open: !!r.selfCheckInOpenedAt && !r.selfCheckInClosedAt,
        status: r.attendanceRecords[0]?.status ?? null,
        markedAt: r.attendanceRecords[0]?.markedAt ?? null,
        selfMarked: r.attendanceRecords[0]?.source === AttendanceSource.SELF_QR,
      })),
    };
  }

  private noteWrongCode(studentId: string, now: number) {
    const entry = this.wrongCodes.get(studentId);
    if (!entry || entry.resetAt < now) this.wrongCodes.set(studentId, { count: 1, resetAt: now + WRONG_CODE_WINDOW_MS });
    else entry.count += 1;
  }

  async studentCheckIn(
    user: { userId: string; studentId?: string; role: string },
    input: { code: string; registerId?: string },
    ip: string,
    coords?: Coordinates | null,
    now = new Date(),
  ) {
    const studentId = this.studentIdOf(user);
    const nowMs = now.getTime();
    const tries = this.wrongCodes.get(studentId);
    if (tries && tries.resetAt > nowMs && tries.count >= WRONG_CODE_LIMIT) {
      throw new HttpException('Too many wrong codes. Wait a few minutes, then scan the code on the screen.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const today = await this.settings.today(now);
    const open = await this.prisma.studentAttendanceRegister.findMany({
      where: {
        attendanceDate: new Date(today),
        selfCheckInOpenedAt: { not: null },
        selfCheckInClosedAt: null,
        ...(input.registerId && { id: input.registerId }),
      },
      include: { class: { select: { name: true } } },
    });
    const register = open.find((r) => r.selfCheckInSecret && codeMatches(r.selfCheckInSecret, r.id, input.code, nowMs));
    if (!register) {
      this.noteWrongCode(studentId, nowMs);
      throw new BadRequestException({
        statusCode: 400,
        code: 'WRONG_CODE',
        message: 'That code is wrong or has expired. Use the code on the screen right now.',
      });
    }
    if (!(register.rosterSnapshot as string[]).includes(studentId)) {
      throw new ForbiddenException(`You are not on the register for ${register.class.name}.`);
    }

    const existing = await this.prisma.studentAttendance.findUnique({
      where: { registerId_studentId: { registerId: register.id, studentId } },
    });
    if (existing) {
      return { className: register.class.name, date: today, status: existing.status, markedAt: existing.markedAt, alreadyMarked: true };
    }

    const values = await this.settings.values();
    if (values.studentNetworkCheck === 'on') {
      const check = checkPlace(placeRules(values), ip, coords);
      if (!check.ok) throw this.placeError(check);
    }

    const lateAfterMs = Number(values.studentLateAfterMinutes) * 60_000;
    const late = nowMs - register.selfCheckInOpenedAt!.getTime() > lateAfterMs;
    let record;
    try {
      record = await this.prisma.studentAttendance.create({
        data: {
          registerId: register.id,
          studentId,
          status: late ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
          markedBy: user.userId,
          markedAt: now,
          source: AttendanceSource.SELF_QR,
        },
      });
    } catch (err) {
      // Marked at the same moment (the teacher closed check-in or saved the register): keep that mark
      if ((err as { code?: string }).code !== 'P2002') throw err;
      const marked = await this.prisma.studentAttendance.findUnique({
        where: { registerId_studentId: { registerId: register.id, studentId } },
      });
      return { className: register.class.name, date: today, status: marked!.status, markedAt: marked!.markedAt, alreadyMarked: true };
    }
    this.wrongCodes.delete(studentId);
    return { className: register.class.name, date: today, status: record.status, markedAt: record.markedAt, alreadyMarked: false };
  }
}
