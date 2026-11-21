import { PrismaClient, LabType } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLabs() {
  console.log('🌱 Seeding labs...');

  try {
    // GST Registration Lab
    const gstLab = await prisma.lab.upsert({
      where: { type: LabType.GST_REGISTRATION },
      update: {},
      create: {
        type: LabType.GST_REGISTRATION,
        title: 'GST Registration Practice Lab',
        description:
          'Practice GST registration procedures with fictional data. Learn how to complete the GST registration form and understand the process.',
        isActive: true,
        sampleData: {
          businessName: 'Test Business Pvt Ltd',
          businessType: 'Private Limited',
          pan: 'TEST12345T',
          address: '123 Fictional Street, Test City, Test State - 123456',
          signatory: 'John Doe Test',
        },
      },
    });
    console.log('✅ Created/Updated GST Registration Lab:', gstLab.id);

    // Income Tax Return Lab
    const itrLab = await prisma.lab.upsert({
      where: { type: LabType.INCOME_TAX_RETURN },
      update: {},
      create: {
        type: LabType.INCOME_TAX_RETURN,
        title: 'Income Tax Return Filing Practice Lab',
        description:
          'Practice filing income tax returns with sample taxpayer data. Learn the ITR filing process and tax calculation.',
        isActive: true,
        sampleData: {
          taxpayerName: 'Jane Doe Test',
          pan: 'DEMO98765D',
          incomeSource: 'Salary',
          grossIncome: 500000,
          deductions: 50000,
          financialYear: '2023-24',
        },
      },
    });
    console.log('✅ Created/Updated Income Tax Return Lab:', itrLab.id);

    // MCA Incorporation Lab
    const mcaLab = await prisma.lab.upsert({
      where: { type: LabType.MCA_INCORPORATION },
      update: {},
      create: {
        type: LabType.MCA_INCORPORATION,
        title: 'MCA Company Incorporation Practice Lab',
        description:
          'Practice company incorporation procedures through the MCA portal. Learn the steps to register a company.',
        isActive: true,
        sampleData: {
          companyName: 'Test Innovations Private Limited',
          directors: [
            {
              name: 'Director One Test',
              din: 'TEST0001',
              email: 'director1@example.com',
            },
            {
              name: 'Director Two Test',
              din: 'TEST0002',
              email: 'director2@example.com',
            },
          ],
          registeredAddress:
            '456 Example Avenue, Sample City, Demo State - 789012',
          authorizedCapital: 100000,
          paidUpCapital: 25000,
        },
      },
    });
    console.log('✅ Created/Updated MCA Incorporation Lab:', mcaLab.id);

    console.log('✅ Lab seeding completed successfully');
  } catch (error) {
    console.error('❌ Error seeding labs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedLabs()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
