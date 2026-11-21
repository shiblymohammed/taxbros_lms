/**
 * Development-only demo accounts, one per role, for trying the web app locally.
 *
 *   pnpm --filter api seed:demo-users
 *
 * Accounts (all share DEMO_USER_PASSWORD, default below):
 *   demo-admin@taxbros.test    ADMINISTRATOR
 *   demo-staff@taxbros.test    STAFF (MARK_ATTENDANCE, VIEW_REPORTS)
 *   demo-student@taxbros.test  STUDENT
 *
 * Re-running resets these three accounts' passwords and unlocks them. It never touches other users.
 * Refuses to run when NODE_ENV=production.
 */
import { PrismaClient, StaffPermissionType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const DEFAULT_DEMO_PASSWORD = 'DemoPass#2026';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo-users is for development only (NODE_ENV=production)');
  }

  const prisma = new PrismaClient();
  const password = process.env.DEMO_USER_PASSWORD || DEFAULT_DEMO_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  const account = (email: string, role: UserRole) => ({
    where: { email },
    update: {
      passwordHash,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: { email, role, passwordHash, status: 'ACTIVE' as const, mustChangePassword: false },
  });

  try {
    const admin = await prisma.user.upsert(account('demo-admin@taxbros.test', UserRole.ADMINISTRATOR));

    const staffUser = await prisma.user.upsert(account('demo-staff@taxbros.test', UserRole.STAFF));
    const staff = await prisma.staff.upsert({
      where: { userId: staffUser.id },
      update: {},
      create: {
        userId: staffUser.id,
        staffId: 'DEMO-STAFF-001',
        firstName: 'Demo',
        lastName: 'Staff',
        designation: 'Faculty',
        department: 'Taxation',
        category: 'TEACHING',
        joiningDate: new Date('2026-01-01'),
      },
    });
    for (const permission of [StaffPermissionType.MARK_ATTENDANCE, StaffPermissionType.VIEW_REPORTS]) {
      await prisma.staffPermission.upsert({
        where: { staffId_permission: { staffId: staff.id, permission } },
        update: {},
        create: { staffId: staff.id, permission, grantedBy: admin.id },
      });
    }

    const studentUser = await prisma.user.upsert(account('demo-student@taxbros.test', UserRole.STUDENT));
    await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: {
        userId: studentUser.id,
        admissionId: 'DEMO-STU-001',
        firstName: 'Demo',
        lastName: 'Student',
        admissionDate: new Date('2026-01-01'),
      },
    });

    console.log('Demo accounts ready: demo-admin@, demo-staff@, demo-student@taxbros.test');
    console.log(
      process.env.DEMO_USER_PASSWORD
        ? 'Password: the value of DEMO_USER_PASSWORD'
        : 'Password: the default in apps/api/scripts/seed-demo-users.ts',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('seed-demo-users failed:', e.message ?? e);
  process.exit(1);
});
