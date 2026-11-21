# PostgreSQL Setup Guide for TAXBROS LMS

## Option 1: Docker Setup (Recommended for Development)

### Step 1: Install Docker Desktop for Windows

1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Install Docker Desktop
3. Restart your computer
4. Open Docker Desktop and ensure it's running

### Step 2: Run PostgreSQL Container

Open PowerShell in the project root and run:

```powershell
docker run --name taxbros-postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_DB=taxbros_lms `
  -p 5432:5432 `
  -d postgres:15
```

### Step 3: Verify PostgreSQL is Running

```powershell
docker ps
```

You should see the `taxbros-postgres` container running.

### Step 4: Connect to PostgreSQL

```powershell
docker exec -it taxbros-postgres psql -U postgres -d taxbros_lms
```

To exit the PostgreSQL shell, type: `\q`

### Useful Docker Commands

```powershell
# Start the container
docker start taxbros-postgres

# Stop the container
docker stop taxbros-postgres

# View logs
docker logs taxbros-postgres

# Remove container (WARNING: This deletes all data)
docker rm -f taxbros-postgres
```

---

## Option 2: Native PostgreSQL Installation

### Step 1: Download PostgreSQL

1. Visit: https://www.postgresql.org/download/windows/
2. Download PostgreSQL 15 or later installer
3. Run the installer

### Step 2: Installation Settings

- **Password**: Choose a strong password for the `postgres` user (remember this!)
- **Port**: Use default 5432
- **Locale**: Default
- Install pgAdmin 4 (GUI tool - optional but helpful)

### Step 3: Add PostgreSQL to PATH

1. Open System Properties → Environment Variables
2. Edit the `Path` variable
3. Add: `C:\Program Files\PostgreSQL\15\bin`
4. Click OK and restart PowerShell

### Step 4: Create Database

Open PowerShell and run:

```powershell
# Connect to PostgreSQL
psql -U postgres

# Create database (inside psql)
CREATE DATABASE taxbros_lms;

# Verify database
\l

# Exit psql
\q
```

---

## Next Steps After PostgreSQL Installation

1. **Update Environment Variables**:
   Edit `apps/api/.env` and set:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/taxbros_lms?schema=public&connection_limit=10"
   ```

2. **Install Prisma Dependencies**:
   ```powershell
   cd apps/api
   pnpm add prisma @prisma/client
   ```

3. **Initialize Prisma**:
   ```powershell
   npx prisma init
   ```

4. **Test Connection**:
   ```powershell
   npx prisma db push
   ```

5. **Generate Prisma Client**:
   ```powershell
   npx prisma generate
   ```

---

## Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public&connection_limit=10
```

**Example with Docker defaults**:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taxbros_lms?schema=public&connection_limit=10"
```

**Example with custom password**:
```
DATABASE_URL="postgresql://postgres:MySecurePassword123@localhost:5432/taxbros_lms?schema=public&connection_limit=10"
```

---

## Troubleshooting

### Port 5432 Already in Use

```powershell
# Check what's using port 5432
netstat -ano | findstr :5432

# Stop any existing PostgreSQL service
net stop postgresql-x64-15
```

### Docker Container Won't Start

```powershell
# Check container logs
docker logs taxbros-postgres

# Remove and recreate container
docker rm -f taxbros-postgres
# Then run the docker run command again
```

### Connection Refused Error

1. Ensure PostgreSQL is running (`docker ps` or check Windows Services)
2. Verify the port is 5432
3. Check your DATABASE_URL is correct
4. Verify the database exists

---

## Security Notes

- **Never commit `.env` files** - These contain sensitive credentials
- The `.env.example` file should have placeholder values only
- For production, use strong passwords and environment-specific credentials
- Connection pooling limit of 10 is appropriate for development
