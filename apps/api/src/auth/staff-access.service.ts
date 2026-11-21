import { ForbiddenException, Global, Injectable, Module } from '@nestjs/common';
import { StaffPermissionType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** The parts of the signed-in user (from JwtStrategy) that access checks need. */
export interface AccessUser {
  userId: string;
  role: UserRole;
  staffId?: string | null;
}

const isAdmin = (role: UserRole) => role === UserRole.ADMINISTRATOR || role === UserRole.SUPER_ADMIN;

/**
 * Staff access to administrator features (R2.7, R2.8, R3).
 *
 * Administrators can do everything. Staff can do an admin task only with the matching permission:
 * - MANAGE_STUDENTS: student accounts and profiles
 * - MANAGE_STAFF: staff accounts, but only staff whose permissions are a subset of their own,
 *   so nobody can take over a more powerful account (e.g. by resetting its password)
 * Staff never act on their own account here, never touch administrators and never grant
 * permissions. Checks run on every request, so a revoked permission stops working at once (R3.5).
 */
@Injectable()
export class StaffAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async permissionsOf(user: AccessUser): Promise<StaffPermissionType[]> {
    if (isAdmin(user.role)) return Object.values(StaffPermissionType);
    if (user.role !== UserRole.STAFF || !user.staffId) return [];
    const rows = await this.prisma.staffPermission.findMany({
      where: { staffId: user.staffId },
      select: { permission: true },
    });
    return rows.map((r) => r.permission);
  }

  async has(user: AccessUser, permission: StaffPermissionType): Promise<boolean> {
    return (await this.permissionsOf(user)).includes(permission);
  }

  /** Throws 403 unless the user is an administrator or staff holding at least one of the permissions. */
  async assertAny(user: AccessUser, permissions: StaffPermissionType[]): Promise<void> {
    if (isAdmin(user.role)) return;
    const held = await this.permissionsOf(user);
    if (!permissions.some((p) => held.includes(p))) {
      throw new ForbiddenException(`Access denied. Required permission: ${permissions.join(' or ')}`);
    }
  }

  /** Roles whose accounts this user may manage; null means any role (administrators). */
  async manageableRoles(user: AccessUser): Promise<UserRole[] | null> {
    if (isAdmin(user.role)) return null;
    const held = await this.permissionsOf(user);
    const roles: UserRole[] = [];
    if (held.includes(StaffPermissionType.MANAGE_STUDENTS)) roles.push(UserRole.STUDENT);
    if (held.includes(StaffPermissionType.MANAGE_STAFF)) roles.push(UserRole.STAFF);
    return roles;
  }

  /** Creating an account: staff may create students (MANAGE_STUDENTS) or staff (MANAGE_STAFF) only. */
  async assertCanCreate(user: AccessUser, role: UserRole): Promise<void> {
    const roles = await this.manageableRoles(user);
    if (roles === null) return;
    if (!roles.includes(role)) {
      throw new ForbiddenException(
        role === UserRole.STUDENT || role === UserRole.STAFF
          ? `Access denied. Required permission: ${role === UserRole.STUDENT ? 'MANAGE_STUDENTS' : 'MANAGE_STAFF'}`
          : 'Only administrators can create administrator accounts',
      );
    }
  }

  /** Viewing or changing an existing account. */
  async assertCanManageUser(user: AccessUser, targetUserId: string): Promise<void> {
    if (isAdmin(user.role)) return;
    if (targetUserId === user.userId) {
      throw new ForbiddenException('Use Change password to manage your own account');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, staffProfile: { select: { permissions: { select: { permission: true } } } } },
    });
    // Unknown users fall through to the service's 404
    if (!target) return;

    const roles = (await this.manageableRoles(user)) ?? [];
    if (!roles.includes(target.role)) {
      throw new ForbiddenException(
        target.role === UserRole.STUDENT
          ? 'Access denied. Required permission: MANAGE_STUDENTS'
          : target.role === UserRole.STAFF
            ? 'Access denied. Required permission: MANAGE_STAFF'
            : 'Only administrators can manage administrator accounts',
      );
    }

    if (target.role === UserRole.STAFF) {
      const held = await this.permissionsOf(user);
      const theirs = target.staffProfile?.permissions.map((p) => p.permission) ?? [];
      const extra = theirs.filter((p) => !held.includes(p));
      if (extra.length > 0) {
        throw new ForbiddenException(
          `This staff member has permissions you don't have (${extra.join(', ')}); ask an administrator`,
        );
      }
    }
  }

  /** Same check, starting from a Student or Staff profile ID. */
  async assertCanManageProfile(user: AccessUser, kind: 'student' | 'staff', profileId: string): Promise<void> {
    if (isAdmin(user.role)) return;
    const profile =
      kind === 'student'
        ? await this.prisma.student.findUnique({ where: { id: profileId }, select: { userId: true } })
        : await this.prisma.staff.findUnique({ where: { id: profileId }, select: { userId: true } });
    if (!profile) {
      // Still require the permission, so unknown IDs don't reveal anything
      await this.assertAny(user, [kind === 'student' ? StaffPermissionType.MANAGE_STUDENTS : StaffPermissionType.MANAGE_STAFF]);
      return;
    }
    await this.assertCanManageUser(user, profile.userId);
  }
}

/** Global so any controller can inject StaffAccessService. */
@Global()
@Module({
  providers: [StaffAccessService],
  exports: [StaffAccessService],
})
export class StaffAccessModule {}
