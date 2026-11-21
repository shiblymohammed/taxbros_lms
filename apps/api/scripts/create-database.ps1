# PowerShell script to create PostgreSQL database
# This script manually creates the database using psql

$ErrorActionPreference = "Stop"

$POSTGRES_USER = "postgres"
$POSTGRES_PASSWORD = "78DC"
$DATABASE_NAME = "taxbros_lms"
$PGHOST = "localhost"
$PGPORT = "5432"

Write-Host "Creating database: $DATABASE_NAME" -ForegroundColor Cyan

# Set environment variables for psql
$env:PGPASSWORD = $POSTGRES_PASSWORD

try {
    # Try to find psql in common locations
    $psqlPaths = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe"
    )
    
    $psqlExe = $null
    foreach ($path in $psqlPaths) {
        if (Test-Path $path) {
            $psqlExe = $path
            Write-Host "Found psql at: $psqlExe" -ForegroundColor Green
            break
        }
    }
    
    if ($null -eq $psqlExe) {
        # Try to use psql from PATH
        try {
            $psqlExe = (Get-Command psql -ErrorAction Stop).Source
        } catch {
            Write-Host "Error: Could not find psql.exe" -ForegroundColor Red
            Write-Host "Please ensure PostgreSQL is properly installed" -ForegroundColor Yellow
            exit 1
        }
    }
    
    # Check if database exists
    Write-Host "Checking if database exists..." -ForegroundColor Yellow
    $checkCmd = "SELECT 1 FROM pg_database WHERE datname='$DATABASE_NAME'"
    $result = & $psqlExe -h $PGHOST -p $PGPORT -U $POSTGRES_USER -d postgres -t -c $checkCmd
    
    if ($result -match "1") {
        Write-Host "[OK] Database '$DATABASE_NAME' already exists" -ForegroundColor Green
    } else {
        # Create database
        Write-Host "Creating database..." -ForegroundColor Yellow
        & $psqlExe -h $PGHOST -p $PGPORT -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $DATABASE_NAME;"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Database '$DATABASE_NAME' created successfully!" -ForegroundColor Green
        } else {
            throw "Failed to create database"
        }
    }
    
    Write-Host "`n[SUCCESS] Database setup complete!" -ForegroundColor Green
    $connStr = "postgresql://$POSTGRES_USER`:****@$PGHOST`:$PGPORT/$DATABASE_NAME"
    Write-Host "  Connection string: $connStr" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
