const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🌱 Creating test data for staff attendance reports...');

    // Clean up existing test data
    await prisma.staffAttendance.deleteMany({
      where: {
        staff: {
          staffId: {
            in: ['STF001', 'STF002']
          }
        }
      }
    });
    
    await prisma.staff.deleteMany({
      where: {
        staffId: {
          in: ['STF001', 'STF002']
        }
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['teacher1@taxbros.edu', 'staff2@taxbros.edu']
        }
      }
    });

    console.log('✅ Cleaned up existing test data');

    // Create staff users
    const staff1Password = await bcrypt.hash('Staff123!', 12);
    const staff2Password = await bcrypt.hash('Staff456!', 12);

    // Create staff user 1
    const user1 = await prisma.user.create({
      data: {
        email: 'teacher1@taxbros.edu',
        passwordHash: staff1Password,
        role: 'STAFF',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });

    const staff1 = await prisma.staff.create({
      data: {
        userId: user1.id,
        staffId: 'STF001',
        firstName: 'John',
        lastName: 'Doe',
        designation: 'Senior Teacher',
        department: 'Taxation',
        category: 'TEACHING',
        joiningDate: new Date('2020-01-15'),
      },
    });

    console.log('✅ Created staff member: John Doe (STF001)');

    // Create staff user 2
    const user2 = await prisma.user.create({
      data: {
        email: 'staff2@taxbros.edu',
        passwordHash: staff2Password,
        role: 'STAFF',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });

    const staff2 = await prisma.staff.create({
      data: {
        userId: user2.id,
        staffId: 'STF002',
        firstName: 'Jane',
        lastName: 'Smith',
        designation: 'Administrative Officer',
        department: 'Administration',
        category: 'NON_TEACHING',
        joiningDate: new Date('2021-03-10'),
      },
    });

    console.log('✅ Created staff member: Jane Smith (STF002)');

    // Create attendance records for November 2026
    const attendanceRecords = [];

    // Staff 1 attendance (mostly present)
    for (let day = 1; day <= 15; day++) {
      attendanceRecords.push({
        staffId: staff1.id,
        attendanceDate: new Date(2026, 10, day), // November 2026 (month is 0-indexed)
        status: day % 10 === 0 ? 'LATE' : day % 7 === 0 ? 'ABSENT' : 'PRESENT',
        markedBy: user1.id,
        markedAt: new Date(),
      });
    }

    // Staff 2 attendance (some absences)
    for (let day = 1; day <= 15; day++) {
      attendanceRecords.push({
        staffId: staff2.id,
        attendanceDate: new Date(2026, 10, day),
        status: day % 5 === 0 ? 'ABSENT' : day % 8 === 0 ? 'LATE' : 'PRESENT',
        markedBy: user2.id,
        markedAt: new Date(),
      });
    }

    await prisma.staffAttendance.createMany({
      data: attendanceRecords,
    });

    console.log('✅ Created attendance records for November 2026');
    console.log(`   - Total records created: ${attendanceRecords.length}`);
    console.log('   - Date range: 1-15 November 2026');

    // Calculate expected results
    const staff1Present = attendanceRecords.filter(
      (r) => r.staffId === staff1.id && r.status === 'PRESENT'
    ).length;
    const staff1Late = attendanceRecords.filter(
      (r) => r.staffId === staff1.id && r.status === 'LATE'
    ).length;
    const staff1Absent = attendanceRecords.filter(
      (r) => r.staffId === staff1.id && r.status === 'ABSENT'
    ).length;
    const staff1Percentage = Math.round(
      (100 * (staff1Present + staff1Late)) / (staff1Present + staff1Late + staff1Absent)
    );

    console.log('\n📊 Expected Report for John Doe (STF001):');
    console.log(`   Present: ${staff1Present}, Late: ${staff1Late}, Absent: ${staff1Absent}`);
    console.log(`   Expected Percentage: ${staff1Percentage}%`);

    const staff2Present = attendanceRecords.filter(
      (r) => r.staffId === staff2.id && r.status === 'PRESENT'
    ).length;
    const staff2Late = attendanceRecords.filter(
      (r) => r.staffId === staff2.id && r.status === 'LATE'
    ).length;
    const staff2Absent = attendanceRecords.filter(
      (r) => r.staffId === staff2.id && r.status === 'ABSENT'
    ).length;
    const staff2Percentage = Math.round(
      (100 * (staff2Present + staff2Late)) / (staff2Present + staff2Late + staff2Absent)
    );

    console.log('\n📊 Expected Report for Jane Smith (STF002):');
    console.log(`   Present: ${staff2Present}, Late: ${staff2Late}, Absent: ${staff2Absent}`);
    console.log(`   Expected Percentage: ${staff2Percentage}%`);

    console.log('\n✅ Test data creation completed successfully!');
    console.log('\n🔍 Test the endpoint with:');
    console.log('   GET /api/attendance/reports/staff/monthly?year=2026&month=11');
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
