import { GUARDS_METADATA } from '@nestjs/common/constants';
import { StaffPermissionType } from '@prisma/client';
import { AttendanceController } from '../../attendance/attendance.controller';
import { ReportsController } from '../../reports/reports.controller';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsGuard } from './permissions.guard';

/**
 * Staff permissions must be enforced on these endpoints (R3, T1): a STAFF user without the
 * permission gets 403. PermissionsGuard's own behaviour is covered in permissions.guard.spec.ts.
 */
describe('Staff permission wiring', () => {
  const cases: Array<[string, object, string, StaffPermissionType]> = [
    ['open register', AttendanceController.prototype, 'openRegister', StaffPermissionType.MARK_ATTENDANCE],
    ['mark register', AttendanceController.prototype, 'markStudentAttendance', StaffPermissionType.MARK_ATTENDANCE],
    ['mark staff attendance', AttendanceController.prototype, 'markStaffAttendance', StaffPermissionType.MARK_ATTENDANCE],
    ['monthly student report', AttendanceController.prototype, 'getMonthlyStudentAttendance', StaffPermissionType.VIEW_REPORTS],
    ['reports: monthly student', ReportsController.prototype, 'getMonthlyStudentAttendanceReport', StaffPermissionType.VIEW_REPORTS],
    ['reports: monthly staff', ReportsController.prototype, 'getMonthlyStaffAttendanceReport', StaffPermissionType.VIEW_REPORTS],
  ];

  it.each(cases)('%s requires the permission', (_label, proto, method, permission) => {
    const handler = (proto as Record<string, unknown>)[method] as object;
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toBe(permission);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(PermissionsGuard);
  });
});
