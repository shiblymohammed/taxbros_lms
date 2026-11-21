import { ItrLabService } from './itr-lab.service';

/**
 * Manual test script for ITR Lab Service
 * 
 * Run with: npx ts-node src/lab/itr-lab-manual-test.ts
 */

const service = new ItrLabService();

console.log('=== ITR Lab Service Manual Test ===\n');

// Test 1: Get sample data
console.log('Test 1: Get Sample Data');
const sampleData = service.getSampleData();
console.log('Sample Data:', JSON.stringify(sampleData, null, 2));
console.log('✓ Sample data retrieved\n');

// Test 2: Validate valid form
console.log('Test 2: Validate Valid Form');
try {
  service.validateItrForm({
    taxpayerName: 'John Doe',
    pan: 'TEST00000T',
    incomeSource: 'Salary',
    grossIncome: 600000,
    deductions: 50000,
  });
  console.log('✓ Valid form accepted\n');
} catch (error) {
  console.error('✗ Valid form rejected:', error.message, '\n');
}

// Test 3: Reject realistic PAN
console.log('Test 3: Reject Realistic PAN');
try {
  service.validateItrForm({
    taxpayerName: 'John Doe',
    pan: 'ABCDE1234F',
    incomeSource: 'Salary',
    grossIncome: 600000,
    deductions: 50000,
  });
  console.error('✗ Realistic PAN was accepted (should reject)\n');
} catch (error) {
  console.log('✓ Realistic PAN rejected:', error.message, '\n');
}

// Test 4: Accept fictional PAN patterns
console.log('Test 4: Accept Fictional PAN Patterns');
const fictionalPANs = ['TEST00000T', 'DEMO00000D', 'TRAIN0000R', 'LEARN0000L'];
for (const pan of fictionalPANs) {
  try {
    service.validateItrForm({
      taxpayerName: 'Test User',
      pan,
      incomeSource: 'Salary',
      grossIncome: 500000,
      deductions: 50000,
    });
    console.log(`✓ Fictional PAN accepted: ${pan}`);
  } catch (error) {
    console.error(`✗ Fictional PAN rejected: ${pan}`, error.message);
  }
}
console.log();

// Test 5: Calculate tax for different income levels
console.log('Test 5: Tax Calculation');
const testCases = [
  { grossIncome: 300000, deductions: 100000, expectedTax: 0, description: 'Below 2.5L (no tax)' },
  { grossIncome: 400000, deductions: 50000, expectedTax: 5000, description: '2.5L-5L bracket (5%)' },
  { grossIncome: 600000, deductions: 50000, expectedTax: 22500, description: 'Multiple brackets' },
  { grossIncome: 1500000, deductions: 100000, expectedTax: 232500, description: 'High income (all brackets)' },
];

for (const testCase of testCases) {
  const calculation = service.calculateTax({
    taxpayerName: 'Test',
    pan: 'TEST00000T',
    incomeSource: 'Salary',
    grossIncome: testCase.grossIncome,
    deductions: testCase.deductions,
  });
  
  const match = calculation.taxAmount === testCase.expectedTax;
  const symbol = match ? '✓' : '✗';
  console.log(`${symbol} ${testCase.description}`);
  console.log(`  Taxable: ₹${calculation.taxableIncome}, Tax: ₹${calculation.taxAmount} (expected: ₹${testCase.expectedTax})`);
  
  if (!match) {
    console.log(`  Tax brackets:`, calculation.taxBrackets);
  }
}
console.log();

// Test 6: Generate acknowledgement number
console.log('Test 6: Generate Acknowledgement Number');
const ackNumber = service.generateAcknowledgementNumber();
const isValid = /^\d{15}$/.test(ackNumber);
console.log(`Acknowledgement Number: ${ackNumber}`);
console.log(isValid ? '✓ Valid 15-digit format\n' : '✗ Invalid format\n');

// Test 7: Submit complete form
console.log('Test 7: Submit Complete ITR Form');
try {
  const result = service.submitItrForm({
    taxpayerName: 'Test Taxpayer',
    pan: 'TEST00000T',
    incomeSource: 'Salary',
    grossIncome: 800000,
    deductions: 150000,
  });
  
  console.log('Form Data:', JSON.stringify(result.formData, null, 2));
  console.log('Calculation:', JSON.stringify(result.calculation, null, 2));
  console.log('Result:', JSON.stringify(result.result, null, 2));
  console.log('✓ Form submitted successfully\n');
} catch (error) {
  console.error('✗ Form submission failed:', error.message, '\n');
}

// Test 8: Reject deductions exceeding gross income
console.log('Test 8: Reject Deductions Exceeding Gross Income');
try {
  service.validateItrForm({
    taxpayerName: 'Test',
    pan: 'TEST00000T',
    incomeSource: 'Salary',
    grossIncome: 100000,
    deductions: 150000,
  });
  console.error('✗ Excessive deductions were accepted (should reject)\n');
} catch (error) {
  console.log('✓ Excessive deductions rejected:', error.message, '\n');
}

console.log('=== All Manual Tests Completed ===');
