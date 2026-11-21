# PostgreSQL Password Reset Script
# Run this script as Administrator

$ErrorActionPreference = "Stop"

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Password Reset Utility" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'`n" -ForegroundColor Yellow
    pause
    exit 1
}

$serviceName = "postgresql-x64-18"
$pgHbaPath = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$pgBinPath = "C:\Program Files\PostgreSQL\18\bin"

# Check if service exists
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "ERROR: PostgreSQL service '$serviceName' not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Backing up pg_hba.conf..." -ForegroundColor Yellow
$backupPath = "$pgHbaPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $pgHbaPath $backupPath
Write-Host "  Backup created: $backupPath" -ForegroundColor Green

Write-Host "`nStep 2: Updating authentication settings..." -ForegroundColor Yellow
$content = Get-Content $pgHbaPath
$content = $content -replace 'scram-sha-256', 'trust' -replace 'md5', 'trust'
$content | Set-Content $pgHbaPath
Write-Host "  Authentication changed to 'trust'" -ForegroundColor Green

Write-Host "`nStep 3: Restarting PostgreSQL service..." -ForegroundColor Yellow
Restart-Service $serviceName -Force
Start-Sleep -Seconds 3
Write-Host "  Service restarted successfully" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "PostgreSQL is now accessible!" -ForegroundColor Green  
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Next, please enter a new password for the 'postgres' user:" -ForegroundColor Cyan
$newPassword = Read-Host "New Password" -AsSecureString
$confirmPassword = Read-Host "Confirm Password" -AsSecureString

$pwd1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($newPassword))
$pwd2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmPassword))

if ($pwd1 -ne $pwd2) {
    Write-Host "`nERROR: Passwords do not match!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 4: Setting new password..." -ForegroundColor Yellow
$env:PGPASSWORD = ""
& "$pgBinPath\psql.exe" -U postgres -h localhost -d postgres -c "ALTER USER postgres WITH PASSWORD '$pwd1';"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Password updated successfully!" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Failed to update password!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 5: Restoring security settings..." -ForegroundColor Yellow
$content = Get-Content $pgHbaPath
$content = $content -replace 'trust', 'scram-sha-256'
$content | Set-Content $pgHbaPath
Write-Host "  Authentication restored to 'scram-sha-256'" -ForegroundColor Green

Write-Host "`nStep 6: Restarting PostgreSQL service..." -ForegroundColor Yellow
Restart-Service $serviceName -Force
Start-Sleep -Seconds 3
Write-Host "  Service restarted successfully" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Password Reset Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Your new password has been set." -ForegroundColor Cyan
Write-Host "Update your .env file with this password:`n" -ForegroundColor Cyan
Write-Host "  DATABASE_URL=`"postgresql://postgres:$pwd1@localhost:5432/taxbros_lms?schema=public&connection_limit=10`"`n" -ForegroundColor Yellow

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
