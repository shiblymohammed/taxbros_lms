# How to Reset PostgreSQL Password on Windows

## Method 1: Using pg_hba.conf (Recommended)

### Step 1: Locate pg_hba.conf
The file is typically located at:
```
C:\Program Files\PostgreSQL\18\data\pg_hba.conf
```

### Step 2: Edit pg_hba.conf
1. Open File Explorer and navigate to `C:\Program Files\PostgreSQL\18\data\`
2. Right-click on `pg_hba.conf` and select "Open with" → Notepad (run as Administrator)
3. Find the line that looks like:
   ```
   # IPv4 local connections:
   host    all             all             127.0.0.1/32            scram-sha-256
   ```
4. Change `scram-sha-256` to `trust`:
   ```
   host    all             all             127.0.0.1/32            trust
   ```
5. Also change the IPv6 line:
   ```
   host    all             all             ::1/128                 trust
   ```
6. Save the file

### Step 3: Restart PostgreSQL Service
1. Press `Win + R` and type: `services.msc`
2. Find "postgresql-x64-18" in the list
3. Right-click and select "Restart"

### Step 4: Connect and Reset Password
Open PowerShell or Command Prompt and run:
```powershell
cd "C:\Program Files\PostgreSQL\18\bin"
.\psql.exe -U postgres -h localhost -d postgres
```

You should now be able to connect without a password. Then run:
```sql
ALTER USER postgres WITH PASSWORD 'your_new_password_here';
```

### Step 5: Restore Security Settings
1. Open `pg_hba.conf` again
2. Change `trust` back to `scram-sha-256` for both lines
3. Save the file
4. Restart the PostgreSQL service again

---

## Method 2: Using Windows GUI (Alternative)

If you have pgAdmin 4 installed:

1. Stop the PostgreSQL service:
   ```powershell
   Stop-Service postgresql-x64-18
   ```

2. Start PostgreSQL in single-user mode (requires Administrator PowerShell):
   ```powershell
   cd "C:\Program Files\PostgreSQL\18\bin"
   .\postgres.exe --single -D "C:\Program Files\PostgreSQL\18\data" postgres
   ```

3. In the prompt that appears, type:
   ```sql
   ALTER USER postgres WITH PASSWORD 'your_new_password';
   \q
   ```

4. Start the service again:
   ```powershell
   Start-Service postgresql-x64-18
   ```

---

## Quick Script (Run in PowerShell as Administrator)

Save this as `reset-postgres.ps1`:

```powershell
# Stop service
Write-Host "Stopping PostgreSQL service..." -ForegroundColor Yellow
Stop-Service postgresql-x64-18

# Backup original pg_hba.conf
$pgHbaPath = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
Copy-Item $pgHbaPath "$pgHbaPath.backup"

# Replace authentication methods
Write-Host "Updating authentication settings..." -ForegroundColor Yellow
$content = Get-Content $pgHbaPath
$content = $content -replace 'scram-sha-256', 'trust'
$content | Set-Content $pgHbaPath

# Restart service
Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow
Start-Service postgresql-x64-18

Write-Host "`nPostgreSQL is now accessible without password!" -ForegroundColor Green
Write-Host "Connect using: psql -U postgres -h localhost -d postgres" -ForegroundColor Cyan
Write-Host "`nAfter resetting password, restore security:" -ForegroundColor Yellow
Write-Host "1. Edit pg_hba.conf and change 'trust' back to 'scram-sha-256'" -ForegroundColor Yellow
Write-Host "2. Restart the service" -ForegroundColor Yellow
```

---

## After Resetting

Once you've reset the password, update the `.env` file in `apps/api/` with:
```
DATABASE_URL="postgresql://postgres:your_new_password@localhost:5432/taxbros_lms?schema=public&connection_limit=10"
```

Then run:
```bash
npm run db:setup
npm run prisma:push
```
