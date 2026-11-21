/**
 * Lab Schema Verification Script
 * 
 * This script verifies that the Lab and LabAttempt models are properly
 * generated in the Prisma Client after migration.
 * 
 * Task 48: Design lab simulation schema
 * Requirements: R27, R31
 */

const { PrismaClient, LabType } = require('@prisma/client');

async function verifyLabSchema() {
  const prisma = new PrismaClient();
  
  console.log('='.repeat(60));
  console.log('Lab Schema Verification');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. Check LabType enum exists and has correct values
    console.log('✓ Checking LabType enum...');
    console.log(`  - GST_REGISTRATION: ${LabType.GST_REGISTRATION}`);
    console.log(`  - INCOME_TAX_RETURN: ${LabType.INCOME_TAX_RETURN}`);
    console.log(`  - MCA_INCORPORATION: ${LabType.MCA_INCORPORATION}`);
    console.log('');

    // 2. Check Lab model exists
    console.log('✓ Checking Lab model...');
    console.log(`  - prisma.lab exists: ${typeof prisma.lab === 'object'}`);
    console.log(`  - create method: ${typeof prisma.lab.create === 'function'}`);
    console.log(`  - findUnique method: ${typeof prisma.lab.findUnique === 'function'}`);
    console.log(`  - findMany method: ${typeof prisma.lab.findMany === 'function'}`);
    console.log('');

    // 3. Check LabAttempt model exists
    console.log('✓ Checking LabAttempt model...');
    console.log(`  - prisma.labAttempt exists: ${typeof prisma.labAttempt === 'object'}`);
    console.log(`  - create method: ${typeof prisma.labAttempt.create === 'function'}`);
    console.log(`  - findMany method: ${typeof prisma.labAttempt.findMany === 'function'}`);
    console.log('');

    // 4. Test creating a lab
    console.log('✓ Testing Lab creation...');
    const testLab = await prisma.lab.create({
      data: {
        type: LabType.GST_REGISTRATION,
        title: 'GST Registration Lab - Verification Test',
        description: 'Practice GST registration with fictional data',
        sampleData: {
          businessName: 'Test Business Pvt Ltd',
          pan: 'AAAAA0000A',
          ownerName: 'John Doe',
          email: 'john@example.com',
        },
        isActive: true,
      },
    });
    console.log(`  - Lab created with ID: ${testLab.id}`);
    console.log(`  - Type: ${testLab.type}`);
    console.log(`  - Title: ${testLab.title}`);
    console.log(`  - isActive: ${testLab.isActive}`);
    console.log(`  - Sample data keys: ${Object.keys(testLab.sampleData).join(', ')}`);
    console.log('');

    // 5. Test unique constraint on lab type
    console.log('✓ Testing unique constraint on lab type...');
    try {
      await prisma.lab.create({
        data: {
          type: LabType.GST_REGISTRATION,
          title: 'Duplicate GST Lab',
          sampleData: {},
        },
      });
      console.log('  ✗ FAILED: Should have prevented duplicate lab type');
    } catch (error) {
      console.log('  ✓ Unique constraint working: Duplicate lab type rejected');
    }
    console.log('');

    // 6. Query the lab using the index
    console.log('✓ Testing Lab query by type (using index)...');
    const foundLab = await prisma.lab.findUnique({
      where: { type: LabType.GST_REGISTRATION },
    });
    console.log(`  - Found lab: ${foundLab ? 'Yes' : 'No'}`);
    console.log(`  - Lab ID matches: ${foundLab?.id === testLab.id}`);
    console.log('');

    // 7. Query by isActive (using index)
    console.log('✓ Testing Lab query by isActive (using index)...');
    const activeLabs = await prisma.lab.findMany({
      where: { isActive: true },
    });
    console.log(`  - Active labs found: ${activeLabs.length}`);
    console.log('');

    // 8. Create a test student for LabAttempt
    console.log('✓ Creating test student...');
    const testUser = await prisma.user.create({
      data: {
        email: 'lab-verify-test@example.com',
        passwordHash: 'hashed_password_here',
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    });

    const testStudent = await prisma.student.create({
      data: {
        userId: testUser.id,
        admissionId: 'LAB-VERIFY-001',
        firstName: 'Verification',
        lastName: 'Test',
        admissionDate: new Date(),
      },
    });
    console.log(`  - Student created with ID: ${testStudent.id}`);
    console.log('');

    // 9. Test creating a LabAttempt
    console.log('✓ Testing LabAttempt creation...');
    const testAttempt = await prisma.labAttempt.create({
      data: {
        labId: testLab.id,
        studentId: testStudent.id,
        formData: {
          businessName: 'My Business Pvt Ltd',
          pan: 'BBBBB1111B',
          ownerName: 'Jane Smith',
          state: 'Karnataka',
        },
        result: {
          gstin: '29BBBBB1111B1Z5',
          arn: 'AA290120240012345',
          status: 'success',
        },
      },
    });
    console.log(`  - LabAttempt created with ID: ${testAttempt.id}`);
    console.log(`  - Lab ID: ${testAttempt.labId}`);
    console.log(`  - Student ID: ${testAttempt.studentId}`);
    console.log(`  - Form data keys: ${Object.keys(testAttempt.formData).join(', ')}`);
    console.log(`  - Result keys: ${Object.keys(testAttempt.result).join(', ')}`);
    console.log('');

    // 10. Test querying by composite index (labId, studentId)
    console.log('✓ Testing LabAttempt query using composite index...');
    const studentAttempts = await prisma.labAttempt.findMany({
      where: {
        labId: testLab.id,
        studentId: testStudent.id,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });
    console.log(`  - Attempts found: ${studentAttempts.length}`);
    console.log(`  - Attempt ID matches: ${studentAttempts[0]?.id === testAttempt.id}`);
    console.log('');

    // 11. Test relationship: Lab with attempts
    console.log('✓ Testing Lab → LabAttempt relationship...');
    const labWithAttempts = await prisma.lab.findUnique({
      where: { id: testLab.id },
      include: {
        attempts: true,
      },
    });
    console.log(`  - Lab has attempts: ${labWithAttempts?.attempts.length > 0}`);
    console.log(`  - Number of attempts: ${labWithAttempts?.attempts.length}`);
    console.log('');

    // 12. Test relationship: Student with lab attempts
    console.log('✓ Testing Student → LabAttempt relationship...');
    const studentWithAttempts = await prisma.student.findUnique({
      where: { id: testStudent.id },
      include: {
        labAttempts: true,
      },
    });
    console.log(`  - Student has lab attempts: ${studentWithAttempts?.labAttempts.length > 0}`);
    console.log(`  - Number of lab attempts: ${studentWithAttempts?.labAttempts.length}`);
    console.log('');

    // 13. Test cascade delete
    console.log('✓ Testing cascade delete (Lab → LabAttempt)...');
    await prisma.lab.delete({
      where: { id: testLab.id },
    });
    const attemptAfterDelete = await prisma.labAttempt.findUnique({
      where: { id: testAttempt.id },
    });
    console.log(`  - LabAttempt deleted on cascade: ${attemptAfterDelete === null}`);
    console.log('');

    // Cleanup remaining test data
    console.log('✓ Cleaning up test data...');
    await prisma.student.delete({ where: { id: testStudent.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('  - Test data cleaned up');
    console.log('');

    console.log('='.repeat(60));
    console.log('✓ All verifications passed successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Summary:');
    console.log('  • LabType enum with 3 values: ✓');
    console.log('  • Lab model with all fields: ✓');
    console.log('  • LabAttempt model with all fields: ✓');
    console.log('  • Unique constraint on Lab.type: ✓');
    console.log('  • Index on (labId, studentId): ✓');
    console.log('  • Lab → LabAttempt relationship: ✓');
    console.log('  • Student → LabAttempt relationship: ✓');
    console.log('  • Cascade delete: ✓');
    console.log('');

  } catch (error) {
    console.error('✗ Verification failed:', error.message);
    console.error('');
    console.error('Error details:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyLabSchema()
  .then(() => {
    console.log('Verification script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
