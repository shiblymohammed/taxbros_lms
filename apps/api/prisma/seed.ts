/**
 * Demo data for TAXBROS LMS (Task 71). Safe to re-run: every record is matched by a stable key.
 *
 *   pnpm --filter api exec prisma db seed
 *
 * Creates:
 *   - 1 super admin, 2 staff (staff1 has MARK_ATTENDANCE + VIEW_REPORTS), 10 students
 *   - 2 classes with 5 students each
 *   - 1 published course: 3 modules, 6 lessons (all 10 students enrolled)
 *   - 2 published quizzes with 5 questions each
 *   - the 3 practice labs with fictional sample data
 *
 * Accounts use @taxbros.test addresses (a reserved domain that can never receive mail).
 * Password: SEED_PASSWORD (required in production, at least 12 characters);
 * development falls back to the default below.
 * Existing accounts keep their passwords unless SEED_RESET_PASSWORDS=true.
 *
 * Production runs need SEED_ALLOW_PRODUCTION=true as well, so demo data is never added by accident.
 */
import {
  LabType,
  PrismaClient,
  QuizAttachmentType,
  StaffPermissionType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEV_DEFAULT_PASSWORD = 'DemoPass#2026';
const DOMAIN = 'taxbros.test';
// Placeholder lesson video (Blender Foundation's "Big Buck Bunny", Creative Commons).
// Replace with the institute's unlisted YouTube videos from the admin course editor.
const DEMO_VIDEO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

function resolvePassword(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed demo data in production without SEED_ALLOW_PRODUCTION=true');
  }
  const password = process.env.SEED_PASSWORD;
  if (isProduction && (!password || password.length < 12)) {
    throw new Error('Set SEED_PASSWORD (at least 12 characters) to seed production demo accounts');
  }
  return password || DEV_DEFAULT_PASSWORD;
}

async function upsertUser(email: string, role: UserRole, passwordHash: string, resetPasswords: boolean) {
  return prisma.user.upsert({
    where: { email },
    update: resetPasswords
      ? { passwordHash, status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null }
      : { status: 'ACTIVE' },
    create: { email, role, passwordHash, status: 'ACTIVE', mustChangePassword: false },
  });
}

async function seedPeople(passwordHash: string, resetPasswords: boolean) {
  const superAdmin = await upsertUser(`superadmin@${DOMAIN}`, UserRole.SUPER_ADMIN, passwordHash, resetPasswords);

  const staffDefs = [
    {
      email: `staff1@${DOMAIN}`,
      staffId: 'TB-STF-001',
      firstName: 'Anita',
      lastName: 'Menon',
      designation: 'Senior Faculty',
      department: 'Taxation',
      category: 'TEACHING' as const,
      permissions: [StaffPermissionType.MARK_ATTENDANCE, StaffPermissionType.VIEW_REPORTS],
    },
    {
      email: `staff2@${DOMAIN}`,
      staffId: 'TB-STF-002',
      firstName: 'Rahul',
      lastName: 'Nair',
      designation: 'Office Administrator',
      department: 'Administration',
      category: 'NON_TEACHING' as const,
      permissions: [] as StaffPermissionType[],
    },
  ];

  for (const def of staffDefs) {
    const user = await upsertUser(def.email, UserRole.STAFF, passwordHash, resetPasswords);
    const staff = await prisma.staff.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        staffId: def.staffId,
        firstName: def.firstName,
        lastName: def.lastName,
        designation: def.designation,
        department: def.department,
        category: def.category,
        joiningDate: new Date('2026-01-05'),
      },
    });
    for (const permission of def.permissions) {
      await prisma.staffPermission.upsert({
        where: { staffId_permission: { staffId: staff.id, permission } },
        update: {},
        create: { staffId: staff.id, permission, grantedBy: superAdmin.id },
      });
    }
  }

  // Fictional names only
  const names = [
    ['Aarav', 'Pillai'], ['Diya', 'Thomas'], ['Ishaan', 'Kurian'], ['Meera', 'Varghese'], ['Rohan', 'Joseph'],
    ['Sneha', 'Iyer'], ['Arjun', 'Das'], ['Kavya', 'Krishnan'], ['Nikhil', 'Mathew'], ['Priya', 'George'],
  ];
  const students = [];
  for (let i = 0; i < names.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    const user = await upsertUser(`student${n}@${DOMAIN}`, UserRole.STUDENT, passwordHash, resetPasswords);
    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        admissionId: `TB-2026-0${n}`,
        firstName: names[i][0],
        lastName: names[i][1],
        admissionDate: new Date('2026-06-01'),
        city: 'Kochi',
        state: 'Kerala',
      },
    });
    students.push(student);
  }

  return { superAdmin, students };
}

async function seedClasses(students: { id: string }[]) {
  const classDefs = [
    { name: 'GST Practitioner Batch A', description: 'Morning batch', members: students.slice(0, 5) },
    { name: 'Income Tax Batch B', description: 'Evening batch', members: students.slice(5, 10) },
  ];
  for (const def of classDefs) {
    const cls = await prisma.class.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name, description: def.description },
    });
    for (const s of def.members) {
      await prisma.classEnrollment.upsert({
        where: { studentId_classId: { studentId: s.id, classId: cls.id } },
        update: {},
        create: { studentId: s.id, classId: cls.id },
      });
    }
  }
}

const COURSE_TITLE = 'Practical GST and Income Tax Foundations';

async function seedCourse(createdBy: string, students: { id: string }[]) {
  const modules = [
    {
      title: 'Introduction to GST',
      lessons: ['What GST replaced and why', 'GST registration: who must register'],
    },
    {
      title: 'Income Tax Basics',
      lessons: ['Heads of income', 'Deductions and taxable income'],
    },
    {
      title: 'Company Incorporation Overview',
      lessons: ['Company types in India', 'The incorporation workflow'],
    },
  ];

  let course = await prisma.course.findFirst({ where: { title: COURSE_TITLE } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        title: COURSE_TITLE,
        description:
          'A guided introduction to GST, income tax and company incorporation, with practice labs. Demo content: replace the videos with the institute\'s own.',
        status: 'PUBLISHED',
        createdBy,
        modules: {
          create: modules.map((m, mi) => ({
            title: m.title,
            displayOrder: mi,
            lessons: {
              create: m.lessons.map((title, li) => ({
                title,
                videoUrl: DEMO_VIDEO,
                duration: 596,
                status: 'PUBLISHED',
                displayOrder: li,
              })),
            },
          })),
        },
      },
    });
  }

  for (const s of students) {
    await prisma.courseEnrollment.upsert({
      where: { studentId_courseId: { studentId: s.id, courseId: course.id } },
      update: {},
      create: { studentId: s.id, courseId: course.id, progressPercentage: 0 },
    });
  }

  const firstModule = await prisma.courseModule.findFirst({
    where: { courseId: course.id },
    orderBy: { displayOrder: 'asc' },
  });
  return { course, firstModuleId: firstModule?.id ?? null };
}

type Q = { text: string; options: [string, string, string, string]; correct: 0 | 1 | 2 | 3 };

function toQuestions(qs: Q[]) {
  return qs.map((q, i) => {
    const options = q.options.map((text, oi) => ({ id: `opt-${oi + 1}`, text }));
    return {
      questionText: q.text,
      options,
      correctAnswer: options[q.correct].id,
      marks: 1,
      displayOrder: i,
    };
  });
}

async function seedQuizzes(courseId: string, moduleId: string | null, createdBy: string) {
  const quizzes: Array<{
    title: string;
    description: string;
    attachmentType: QuizAttachmentType;
    courseId?: string;
    moduleId?: string;
    questions: Q[];
  }> = [
    {
      title: 'GST Basics Check',
      description: 'Five quick questions on GST fundamentals.',
      attachmentType: moduleId ? QuizAttachmentType.MODULE : QuizAttachmentType.COURSE,
      ...(moduleId ? { moduleId } : { courseId }),
      questions: [
        { text: 'How many characters does a GSTIN have?', options: ['10', '12', '15', '18'], correct: 2 },
        { text: 'GST came into force in India in which year?', options: ['2014', '2016', '2017', '2019'], correct: 2 },
        { text: 'Which return reports outward supplies?', options: ['GSTR-1', 'GSTR-3B', 'GSTR-9', 'ITR-1'], correct: 0 },
        { text: 'Tax on supplies within one state is shared as:', options: ['IGST only', 'CGST + SGST', 'Customs duty', 'Cess only'], correct: 1 },
        { text: 'Which tax applies to supplies between two states?', options: ['SGST', 'UTGST', 'IGST', 'CGST'], correct: 2 },
      ],
    },
    {
      title: 'Income Tax Foundations Quiz',
      description: 'Covers the income tax basics module.',
      attachmentType: QuizAttachmentType.COURSE,
      courseId,
      questions: [
        { text: 'How many characters does a PAN have?', options: ['8', '10', '12', '15'], correct: 1 },
        { text: 'What does ITR stand for?', options: ['Income Tax Return', 'Indian Tax Register', 'Income Transfer Receipt', 'Interim Tax Rate'], correct: 0 },
        { text: 'Taxable income is:', options: ['Gross income plus deductions', 'Gross income minus allowed deductions', 'Only salary income', 'Tax paid in advance'], correct: 1 },
        { text: 'Which body administers direct taxes in India?', options: ['CBIC', 'CBDT', 'SEBI', 'RBI'], correct: 1 },
        { text: '"Salaries" is one of the:', options: ['GST rates', 'Heads of income', 'Company types', 'MCA forms'], correct: 1 },
      ],
    },
  ];

  for (const [index, q] of quizzes.entries()) {
    const existing = await prisma.quiz.findFirst({ where: { title: q.title } });
    if (existing) continue;
    await prisma.quiz.create({
      data: {
        title: q.title,
        description: q.description,
        attachmentType: q.attachmentType,
        courseId: q.courseId ?? null,
        moduleId: q.moduleId ?? null,
        passMark: 3,
        totalMarks: q.questions.length,
        timeLimit: 10,
        maxAttempts: 3,
        status: 'PUBLISHED',
        displayOrder: index,
        createdBy,
        questions: { create: toQuestions(q.questions) },
      },
    });
  }
}

async function seedLabs(createdBy: string) {
  const labs = [
    {
      type: LabType.GST_REGISTRATION,
      title: 'GST Registration Practice Lab',
      description:
        'Practice GST registration procedures with fictional data. Learn how to complete the GST registration form and understand the process.',
      sampleData: {
        businessName: 'Test Business Pvt Ltd',
        businessType: 'Private Limited',
        pan: 'TEST12345T',
        address: '123 Fictional Street, Test City, Test State - 123456',
        signatory: 'John Doe Test',
      },
    },
    {
      type: LabType.INCOME_TAX_RETURN,
      title: 'Income Tax Return Filing Practice Lab',
      description:
        'Practice filing income tax returns with sample taxpayer data. Learn the ITR filing process and tax calculation.',
      sampleData: {
        taxpayerName: 'Jane Doe Test',
        pan: 'DEMO98765D',
        incomeSource: 'Salary',
        grossIncome: 500000,
        deductions: 50000,
        financialYear: '2025-26',
      },
    },
    {
      type: LabType.MCA_INCORPORATION,
      title: 'MCA Company Incorporation Practice Lab',
      description:
        'Practice company incorporation procedures through the MCA portal. Learn the steps to register a company.',
      sampleData: {
        companyName: 'Test Innovations Private Limited',
        directors: [
          { name: 'Director One Test', din: 'TEST0001', email: 'director1@example.com' },
          { name: 'Director Two Test', din: 'TEST0002', email: 'director2@example.com' },
        ],
        registeredAddress: '456 Example Avenue, Sample City, Demo State - 789012',
        authorizedCapital: 100000,
        paidUpCapital: 25000,
      },
    },
  ];
  for (const lab of labs) {
    // Existing labs are left alone: admins may have edited their sample data
    await prisma.lab.upsert({
      where: { type: lab.type },
      update: {},
      create: { ...lab, isActive: true, createdBy },
    });
  }
}

async function main() {
  const password = resolvePassword();
  const resetPasswords = process.env.SEED_RESET_PASSWORDS === 'true';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('Seeding demo data...');
  const { superAdmin, students } = await seedPeople(passwordHash, resetPasswords);
  await seedClasses(students);
  const { course, firstModuleId } = await seedCourse(superAdmin.id, students);
  await seedQuizzes(course.id, firstModuleId, superAdmin.id);
  await seedLabs(superAdmin.id);

  console.log('Seed complete.');
  console.log(`  Super admin: superadmin@${DOMAIN}`);
  console.log(`  Staff:       staff1@${DOMAIN} (marks attendance), staff2@${DOMAIN}`);
  console.log(`  Students:    student01@${DOMAIN} ... student10@${DOMAIN}`);
  console.log(
    process.env.SEED_PASSWORD
      ? '  Password:    the value of SEED_PASSWORD'
      : '  Password:    the development default in apps/api/prisma/seed.ts',
  );
  if (!resetPasswords) console.log('  (Existing accounts kept their passwords; SEED_RESET_PASSWORDS=true resets them.)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
