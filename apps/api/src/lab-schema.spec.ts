import { PrismaClient, LabType } from '@prisma/client';

/**
 * Lab Schema Structure Test
 * 
 * This test verifies the Lab and LabAttempt models are properly defined
 * with all required fields, enums, and relationships.
 * 
 * Task 48: Design lab simulation schema
 * Requirements: R27, R31
 */

/*
 * The model tests below create and delete labs, users and students, and lab types are unique, so
 * they must never run against the development or production database. They run only when
 * TEST_DATABASE_URL points at a disposable database (migrated, with no labs), e.g.:
 *   TEST_DATABASE_URL=postgresql://.../taxbros_test pnpm --filter api test -- lab-schema
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeWithDb = TEST_DATABASE_URL ? describe : describe.skip;

describe('Lab Schema Structure', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    // Never fall back to DATABASE_URL: without a test database, only the client-shape tests run
    prisma = new PrismaClient(TEST_DATABASE_URL ? { datasources: { db: { url: TEST_DATABASE_URL } } } : undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('LabType Enum', () => {
    it('should have three lab types defined', () => {
      expect(LabType.GST_REGISTRATION).toBeDefined();
      expect(LabType.INCOME_TAX_RETURN).toBeDefined();
      expect(LabType.MCA_INCORPORATION).toBeDefined();
    });

    it('should match expected enum values', () => {
      expect(LabType.GST_REGISTRATION).toBe('GST_REGISTRATION');
      expect(LabType.INCOME_TAX_RETURN).toBe('INCOME_TAX_RETURN');
      expect(LabType.MCA_INCORPORATION).toBe('MCA_INCORPORATION');
    });
  });

  describe('Lab Model', () => {
    it('should have the correct model structure', () => {
      // This test verifies Prisma Client has generated the Lab model
      expect(prisma.lab).toBeDefined();
      expect(typeof prisma.lab.create).toBe('function');
      expect(typeof prisma.lab.findUnique).toBe('function');
      expect(typeof prisma.lab.findMany).toBe('function');
      expect(typeof prisma.lab.update).toBe('function');
      expect(typeof prisma.lab.delete).toBe('function');
    });

  });

  describeWithDb('Lab Model (database)', () => {
    it('should create a lab with all required fields', async () => {
      const sampleData = {
        businessName: 'Test Business Pvt Ltd',
        pan: 'AAAAA0000A',
        ownerName: 'John Doe',
      };

      const lab = await prisma.lab.create({
        data: {
          type: LabType.GST_REGISTRATION,
          title: 'GST Registration Lab',
          description: 'Practice GST registration with fictional data',
          sampleData: sampleData,
          isActive: true,
        },
      });

      expect(lab).toBeDefined();
      expect(lab.id).toBeDefined();
      expect(lab.type).toBe(LabType.GST_REGISTRATION);
      expect(lab.title).toBe('GST Registration Lab');
      expect(lab.isActive).toBe(true);
      expect(lab.sampleData).toEqual(sampleData);
      expect(lab.createdAt).toBeInstanceOf(Date);
      expect(lab.updatedAt).toBeInstanceOf(Date);

      // Cleanup
      await prisma.lab.delete({ where: { id: lab.id } });
    });

    it('should enforce unique constraint on lab type', async () => {
      const lab1 = await prisma.lab.create({
        data: {
          type: LabType.INCOME_TAX_RETURN,
          title: 'ITR Lab 1',
          sampleData: {},
        },
      });

      // Attempt to create another lab with the same type
      await expect(
        prisma.lab.create({
          data: {
            type: LabType.INCOME_TAX_RETURN,
            title: 'ITR Lab 2',
            sampleData: {},
          },
        }),
      ).rejects.toThrow();

      // Cleanup
      await prisma.lab.delete({ where: { id: lab1.id } });
    });

    it('should default isActive to true', async () => {
      const lab = await prisma.lab.create({
        data: {
          type: LabType.MCA_INCORPORATION,
          title: 'MCA Lab',
          sampleData: {},
        },
      });

      expect(lab.isActive).toBe(true);

      // Cleanup
      await prisma.lab.delete({ where: { id: lab.id } });
    });
  });

  describe('LabAttempt Model', () => {
    it('should have the correct model structure', () => {
      // This test verifies Prisma Client has generated the LabAttempt model
      expect(prisma.labAttempt).toBeDefined();
      expect(typeof prisma.labAttempt.create).toBe('function');
      expect(typeof prisma.labAttempt.findUnique).toBe('function');
      expect(typeof prisma.labAttempt.findMany).toBe('function');
      expect(typeof prisma.labAttempt.update).toBe('function');
      expect(typeof prisma.labAttempt.delete).toBe('function');
    });

  });

  describeWithDb('LabAttempt Model (database)', () => {
    it('should create a lab attempt with all required fields', async () => {
      // Create test lab
      const lab = await prisma.lab.create({
        data: {
          type: LabType.GST_REGISTRATION,
          title: 'Test Lab',
          sampleData: {},
        },
      });

      // Create test student
      const user = await prisma.user.create({
        data: {
          email: 'test-lab-student@test.com',
          passwordHash: 'hashed',
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          admissionId: 'LAB-TEST-001',
          firstName: 'Lab',
          lastName: 'Student',
          admissionDate: new Date(),
        },
      });

      const formData = {
        businessName: 'My Business',
        pan: 'BBBBB1111B',
      };

      const result = {
        gstin: '29BBBBB1111B1Z5',
        arn: 'AA290120240012345',
      };

      const attempt = await prisma.labAttempt.create({
        data: {
          labId: lab.id,
          studentId: student.id,
          formData: formData,
          result: result,
        },
      });

      expect(attempt).toBeDefined();
      expect(attempt.id).toBeDefined();
      expect(attempt.labId).toBe(lab.id);
      expect(attempt.studentId).toBe(student.id);
      expect(attempt.formData).toEqual(formData);
      expect(attempt.result).toEqual(result);
      expect(attempt.completedAt).toBeInstanceOf(Date);
      expect(attempt.createdAt).toBeInstanceOf(Date);
      expect(attempt.updatedAt).toBeInstanceOf(Date);

      // Cleanup
      await prisma.labAttempt.delete({ where: { id: attempt.id } });
      await prisma.student.delete({ where: { id: student.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.lab.delete({ where: { id: lab.id } });
    });

    it('should support index on (labId, studentId)', async () => {
      // Create test data
      const lab = await prisma.lab.create({
        data: {
          type: LabType.INCOME_TAX_RETURN,
          title: 'ITR Test Lab',
          sampleData: {},
        },
      });

      const user = await prisma.user.create({
        data: {
          email: 'test-index-student@test.com',
          passwordHash: 'hashed',
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          admissionId: 'LAB-TEST-002',
          firstName: 'Index',
          lastName: 'Test',
          admissionDate: new Date(),
        },
      });

      // Create multiple attempts
      await prisma.labAttempt.create({
        data: {
          labId: lab.id,
          studentId: student.id,
          formData: { attempt: 1 },
          result: { score: 85 },
        },
      });

      await prisma.labAttempt.create({
        data: {
          labId: lab.id,
          studentId: student.id,
          formData: { attempt: 2 },
          result: { score: 92 },
        },
      });

      // Query using the indexed fields - should be efficient
      const attempts = await prisma.labAttempt.findMany({
        where: {
          labId: lab.id,
          studentId: student.id,
        },
        orderBy: { completedAt: 'desc' },
      });

      expect(attempts).toHaveLength(2);
      expect(attempts[0].formData).toEqual({ attempt: 2 });

      // Cleanup
      await prisma.labAttempt.deleteMany({
        where: { studentId: student.id },
      });
      await prisma.student.delete({ where: { id: student.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.lab.delete({ where: { id: lab.id } });
    });

    it('should cascade delete attempts when lab is deleted', async () => {
      // Create test data
      const lab = await prisma.lab.create({
        data: {
          type: LabType.MCA_INCORPORATION,
          title: 'MCA Cascade Test',
          sampleData: {},
        },
      });

      const user = await prisma.user.create({
        data: {
          email: 'test-cascade-student@test.com',
          passwordHash: 'hashed',
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          admissionId: 'LAB-TEST-003',
          firstName: 'Cascade',
          lastName: 'Test',
          admissionDate: new Date(),
        },
      });

      const attempt = await prisma.labAttempt.create({
        data: {
          labId: lab.id,
          studentId: student.id,
          formData: {},
          result: {},
        },
      });

      // Delete the lab - should cascade delete attempts
      await prisma.lab.delete({ where: { id: lab.id } });

      // Verify attempt was deleted
      const foundAttempt = await prisma.labAttempt.findUnique({
        where: { id: attempt.id },
      });

      expect(foundAttempt).toBeNull();

      // Cleanup remaining test data
      await prisma.student.delete({ where: { id: student.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describeWithDb('Lab Relationships (database)', () => {
    it('should include lab attempts when querying with include', async () => {
      // Create test data
      const lab = await prisma.lab.create({
        data: {
          type: LabType.GST_REGISTRATION,
          title: 'Relationship Test Lab',
          sampleData: {},
        },
      });

      const user = await prisma.user.create({
        data: {
          email: 'test-relationship@test.com',
          passwordHash: 'hashed',
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          admissionId: 'LAB-TEST-004',
          firstName: 'Relationship',
          lastName: 'Test',
          admissionDate: new Date(),
        },
      });

      await prisma.labAttempt.create({
        data: {
          labId: lab.id,
          studentId: student.id,
          formData: {},
          result: {},
        },
      });

      // Query lab with attempts
      const labWithAttempts = await prisma.lab.findUnique({
        where: { id: lab.id },
        include: { attempts: true },
      });

      expect(labWithAttempts).toBeDefined();
      expect(labWithAttempts?.attempts).toHaveLength(1);
      expect(labWithAttempts?.attempts[0].studentId).toBe(student.id);

      // Cleanup
      await prisma.labAttempt.deleteMany({ where: { labId: lab.id } });
      await prisma.lab.delete({ where: { id: lab.id } });
      await prisma.student.delete({ where: { id: student.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should include lab attempts when querying student', async () => {
      // Create test data
      const lab = await prisma.lab.create({
        data: {
          type: LabType.INCOME_TAX_RETURN,
          title: 'Student Relationship Test',
          sampleData: {},
        },
      });

      const user = await prisma.user.create({
        data: {
          email: 'test-student-rel@test.com',
          passwordHash: 'hashed',
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          admissionId: 'LAB-TEST-005',
          firstName: 'Student',
          lastName: 'Rel',
          admissionDate: new Date(),
        },
      });

      await prisma.labAttempt.create({
        data: {
          labId: lab.id,
          studentId: student.id,
          formData: {},
          result: {},
        },
      });

      // Query student with lab attempts
      const studentWithAttempts = await prisma.student.findUnique({
        where: { id: student.id },
        include: { labAttempts: true },
      });

      expect(studentWithAttempts).toBeDefined();
      expect(studentWithAttempts?.labAttempts).toHaveLength(1);
      expect(studentWithAttempts?.labAttempts[0].labId).toBe(lab.id);

      // Cleanup
      await prisma.labAttempt.deleteMany({ where: { studentId: student.id } });
      await prisma.student.delete({ where: { id: student.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.lab.delete({ where: { id: lab.id } });
    });
  });
});
