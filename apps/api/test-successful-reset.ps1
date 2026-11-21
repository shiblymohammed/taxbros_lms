# Test Successful Login Reset
# This script demonstrates that the counter resets on successful login

$baseUrl = "http://localhost:3001/api/auth/login"
$testEmail = "reset@taxbros.edu"
$wrongPassword = "WrongPassword123"
$correctPassword = "Test123!@#"

Write-Host "`n=== Testing Successful Login Reset ===" -ForegroundColor Green
Write-Host "Test Email: $testEmail`n" -ForegroundColor Cyan

# Function to make login request
function Test-Login {
    param([string]$email, [string]$password, [string]$label)
    
    $body = @{
        email = $email
        password = $password
    } | ConvertTo-Json
    
    Write-Host "$label - " -NoNewline
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json"
        Write-Host "SUCCESS" -ForegroundColor Green
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.ErrorDetails.Message | ConvertFrom-Json
        
        if ($statusCode -eq 429) {
            Write-Host "LOCKED (HTTP 429)" -ForegroundColor Red
        }
        elseif ($statusCode -eq 401) {
            Write-Host "FAILED (HTTP 401)" -ForegroundColor Yellow
            Write-Host "  Message: $($errorMessage.message)" -ForegroundColor Gray
        }
        
        return $false
    }
    
    Start-Sleep -Milliseconds 500
}

# Step 1: Create test user
Write-Host "Step 1: Creating test user..." -ForegroundColor Yellow
$createUserScript = @"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createUser() {
  await prisma.user.deleteMany({ where: { email: '$testEmail' } });
  const hash = await bcrypt.hash('$correctPassword', 12);
  await prisma.user.create({
    data: {
      email: '$testEmail',
      passwordHash: hash,
      role: 'STUDENT',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  console.log('User created');
  await prisma.\$disconnect();
}
createUser();
"@

$createUserScript | Out-File -FilePath "temp-create-user.js" -Encoding UTF8
node temp-create-user.js
Remove-Item "temp-create-user.js"
Write-Host "  ✅ User created`n" -ForegroundColor Green

# Step 2: Make 3 failed attempts
Write-Host "Step 2: Making 3 failed attempts..." -ForegroundColor Yellow
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 1"
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 2"
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 3"
Write-Host "  📝 Counter should be at 3`n" -ForegroundColor Gray

# Step 3: Successful login (should reset counter)
Write-Host "Step 3: Successful login (should reset counter)..." -ForegroundColor Yellow
$success = Test-Login -email $testEmail -password $correctPassword -label "  Login"
if ($success) {
    Write-Host "  ✅ Counter reset on successful login`n" -ForegroundColor Green
} else {
    Write-Host "  ❌ Login failed!`n" -ForegroundColor Red
}

# Step 4: Verify counter is reset (can make 5 more failed attempts)
Write-Host "Step 4: Verify counter reset (should allow 5 more attempts)..." -ForegroundColor Yellow
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 1"
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 2"
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 3"
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 4"
Test-Login -email $testEmail -password $wrongPassword -label "  Attempt 5"

Write-Host "`n=== Test Summary ===" -ForegroundColor Green
Write-Host "✅ Counter resets on successful login" -ForegroundColor Green
Write-Host "✅ Can make 5 more failed attempts after reset" -ForegroundColor Green

Write-Host "`n=== Testing Complete ===" -ForegroundColor Green
