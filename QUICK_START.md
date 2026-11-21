# 🚀 TAXBROS LMS - Quick Start Guide

## First Time Setup (5 minutes)

### 1. Install Prerequisites
```bash
# Verify Node.js (v20+)
node --version

# Verify pnpm (v8+)
pnpm --version

# If pnpm not installed:
npm install -g pnpm
```

### 2. Install Dependencies
```bash
cd taxbros-lms
pnpm install
```

### 3. Configure Environment
```bash
# Backend configuration
cd apps/api
cp .env.example .env
# Edit .env with your database credentials

# Frontend configuration
cd ../web
cp .env.local.example .env.local
# Default values should work for development
```

### 4. Start Development
```bash
# From project root
cd ../..
pnpm dev
```

**That's it!** You should see:
- 🌐 Frontend: http://localhost:3000
- 🚀 Backend: http://localhost:4000/api/health

## Common Commands

```bash
# Development
pnpm dev                    # Start both frontend and backend
pnpm --filter web dev       # Start only frontend
pnpm --filter api dev       # Start only backend

# Code Quality
pnpm lint                   # Run linters
pnpm format                 # Format code
pnpm format:check           # Check formatting
pnpm type-check             # TypeScript validation

# Build
pnpm build                  # Build all apps
```

## Development Ports

| Service        | Port | URL                              |
|----------------|------|----------------------------------|
| Next.js Web    | 3000 | http://localhost:3000            |
| NestJS API     | 4000 | http://localhost:4000/api        |
| API Health     | 4000 | http://localhost:4000/api/health |

## IDE Setup (Recommended)

### VS Code Extensions
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- Prisma (for Phase 2)

### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Kill process on port 4000
npx kill-port 4000
```

### Dependencies Out of Sync
```bash
pnpm install
```

### Build Errors
```bash
# Clean and rebuild
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

## Project Structure

```
taxbros-lms/
├── apps/
│   ├── web/          # Frontend (Next.js)
│   ├── api/          # Backend (NestJS)
│   └── mobile/       # Mobile (Phase 4)
├── packages/
│   └── types/        # Shared types
└── package.json      # Root config
```

## Git Workflow

```bash
# Stage changes
git add .

# Pre-commit hooks will run automatically
# - ESLint
# - Prettier

# Commit with conventional commits
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update README"
```

## Need Help?

1. Check the full [README.md](./README.md)
2. Review [SETUP_VERIFICATION.md](./SETUP_VERIFICATION.md)
3. Contact the development team

---

**Ready to code!** 🎉
