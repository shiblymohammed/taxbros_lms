const { execSync } = require('child_process');
const path = require('path');

// Build the TypeScript test file first
console.log('Compiling TypeScript files...');
try {
  execSync('npx tsc test/phase1-acceptance.e2e-spec.ts --outDir test/compiled --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule --declaration false', {
    cwd: __dirname,
    stdio: 'inherit'
  });
  console.log('Compilation successful!\n');
  
  // Run the compiled test
  console.log('Running E2E tests...\n');
  execSync('npx jest test/compiled/phase1-acceptance.e2e-spec.js --testEnvironment=node --testTimeout=30000', {
    cwd: __dirname,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Test execution failed');
  process.exit(1);
}
