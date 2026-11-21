# Database Setup Guide

## PostgreSQL Installation & Configuration

This project uses PostgreSQL 15+ as the database. The setup has been completed with the following configuration:

### Current Configuration

- **Database**: `taxbros_lms`
- **Host**: `127.0.0.1` (localhost)
- **Port**: `5432` (default PostgreSQL port)
- **User**: `postgres`
- **Connection Pool Limit**: 10 connections (configured for development)

### PostgreSQL Version

PostgreSQL 18.7 is currently installed and running.

## Database Connection

The database connection is managed through Prisma ORM with connection pooling enabled.

### Connection String Format

```
postgresql://username:password@host:port/database?schema=public&connection_limit=10
```

The connection limit of 10 is appropriate for development environments. For production, this should be increased to 20-50 depending on load.

## Available Scripts

### Database Management

```bash
# Verify database setup and connection
pnpm --filter api db:verify

# Create the database (if it doesn't exist)
pnpm --filter api db:setup

# Generate Prisma Client
pnpm --filter api prisma:generate

# Push schema to database (no migration files)
pnpm --filter api prisma:push

# Create and run migrations
pnpm --filter api prisma:migrate

# Open Prisma Studio (database GUI)
pnpm --filter api prisma:studio

# Seed the database
pnpm --filter api db:seed
```

### Development Workflow

```bash
# Start the API server
pnpm --filter api dev

# Build for production
pnpm --filter api build

# Start production server
pnpm --filter api start:prod
```

## Connection Pooling

Connection pooling is configured in the DATABASE_URL:

```
postgresql://postgres:password@localhost:5432/taxbros_lms?schema=public&connection_limit=10
```

### Pool Configuration

- **Development**: 10 connections (current setting)
- **Production**: 20-50 connections (recommended based on load)

The connection limit prevents database connection exhaustion and ensures efficient resource usage.

## Prisma Schema

The Prisma schema is located at `prisma/schema.prisma`. It currently has:

- PostgreSQL provider configured
- Connection pooling enabled via DATABASE_URL
- No models defined yet (will be added in Task 3)

### Schema Structure

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Models will be added in subsequent tasks
```

## Migrations

Prisma migrations will be used for schema management:

### Migration Commands

```bash
# Create a new migration
pnpm --filter api prisma:migrate

# Apply pending migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration Best Practices

1. Always review generated migrations before applying
2. Use descriptive migration names
3. Test migrations in development before production
4. Keep migrations in version control
5. Never modify applied migrations

## Database Seeding

The seed script is located at `prisma/seed.ts`.

### Current Seed Structure

```typescript
async function main() {
  console.log('🌱 Starting database seed...');
  
  // TODO: Add seed data in later tasks
  // - Task 3: User accounts and roles
  // - Task 4: Authentication setup
  // - Task 12: Classes
  // - Task 25: Courses and modules
  
  console.log('✅ Seed completed successfully');
}
```

### Running Seeds

```bash
# Run seed script
pnpm --filter api db:seed
```

## Troubleshooting

### Connection Errors

If you encounter connection errors:

1. Verify PostgreSQL is running:
   ```powershell
   Get-Service postgresql-x64-18
   ```

2. Check if the database exists:
   ```bash
   pnpm --filter api db:verify
   ```

3. Verify credentials in `.env` file

4. Test connection manually:
   ```powershell
   psql -U postgres -h localhost -d taxbros_lms
   ```

### Password Reset

If you forgot the PostgreSQL password:

1. Run the password reset script:
   ```powershell
   cd apps/api/scripts
   .\reset-postgres-password.ps1
   ```

2. Or follow the manual instructions in `RESET_POSTGRES_PASSWORD.md`

### Common Issues

#### Authentication Failed

**Error**: `FATAL: password authentication failed for user "postgres"`

**Solution**: Update the password in `.env` file to match your PostgreSQL password.

#### Database Does Not Exist

**Error**: `database "taxbros_lms" does not exist`

**Solution**: Run `pnpm --filter api db:setup` to create the database.

#### Connection Pool Exhausted

**Error**: `Too many connections`

**Solution**: Increase `connection_limit` in DATABASE_URL or close unused connections.

## Production Considerations

### Connection Pooling

For production, update the connection limit:

```
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=50"
```

### Security

1. Use strong passwords (minimum 16 characters)
2. Enable SSL/TLS connections
3. Restrict database access by IP
4. Use environment-specific credentials
5. Never commit `.env` files to version control

### Backup

Set up automated backups:

```bash
# Create backup
pg_dump -U postgres -d taxbros_lms > backup.sql

# Restore backup
psql -U postgres -d taxbros_lms < backup.sql
```

## Next Steps

1. **Task 3**: Define core Prisma models (User, Student, Staff, etc.)
2. **Task 4**: Run initial migrations
3. **Task 5**: Create seed data for development
4. **Task 6**: Test database operations with API endpoints

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Connection Pooling Guide](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
