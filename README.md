# TAXBROS LMS

Learning management system for the TAXBROS institute: attendance, courses with YouTube lessons,
quizzes, and practice labs that simulate the GST, Income Tax and MCA portals with fictional data.
One backend serves the web app, the installable PWA and the Android app.

## Features

| Area | What it does |
|---|---|
| Accounts | Admin screens for users (search with student and staff filters, create, edit, activate/deactivate, reset password), student profiles (courses, classes, quiz attempts), staff permissions and classes; forced password change on first sign-in; lockout after failed logins |
| Settings | Institute timezone and name, changed by administrators at `/admin/settings`; attendance dates and displayed times use the institute timezone |
| Attendance | Daily class registers (open, mark, correct) at `/staff/attendance`, staff attendance marked by administrators at `/admin/staff-attendance`, monthly reports with CSV export |
| Learning | Courses → modules → lessons (unlisted YouTube), draft/publish, student enrolment from the course page, resume where you left off, progress tracking |
| Quizzes | Admin quiz builder (course, module or lesson; marks must add up before publishing); students take quizzes with time and attempt limits and see their history |
| Practice labs | GST registration, ITR filing (with an illustrative tax calculation) and MCA incorporation simulations; fictional data only, never connected to government systems |
| Delivery | Responsive web app, installable PWA, Android APK (Capacitor) |

## Architecture

```
 Browser / PWA / Android app (Capacitor WebView)
                 │ HTTPS
              Nginx ── /        → Next.js 16 web app (apps/web, port 3000)
                    └─ /api/    → NestJS 10 API     (apps/api, port 4000) ── PostgreSQL 15+
                    └─ /uploads → NestJS (course covers)
```

- `apps/api`: NestJS, Prisma, PostgreSQL. JWT access tokens (15 min) and rotating httpOnly refresh cookies (7 days). Winston JSON logs, rate limiting, Helmet security headers.
- `apps/web`: Next.js (App Router, React 19, Tailwind v4). Client-side pages call the API with Axios.
- `apps/mobile`: Capacitor 8 Android wrapper that loads the hosted web app. See [apps/mobile/README.md](apps/mobile/README.md).
- `packages/types`: shared TypeScript types.
- `deploy/`: PM2, Nginx, deployment and backup scripts. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Prerequisites

- Node.js 20 or newer (developed on Node 24)
- pnpm 8 or newer (`npm install -g pnpm`)
- PostgreSQL 15 or newer
- For Android builds only: Android Studio with the Android SDK, and JDK 21

## Development setup

```bash
pnpm install

# API configuration
cp apps/api/.env.example apps/api/.env          # set DATABASE_URL and the JWT secrets
# Web configuration
cp apps/web/.env.local.example apps/web/.env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api

# Database
pnpm --filter api exec prisma migrate dev       # create tables
pnpm --filter api exec prisma db seed           # demo accounts, classes, course, quizzes, labs

# Run both apps
pnpm dev
```

- Web app: http://localhost:3000 (sign in at `/login`)
- API: http://localhost:4000/api, Swagger UI at http://localhost:4000/api/docs

Demo accounts from the seed (password: `SEED_PASSWORD`, or the development default in
[`apps/api/prisma/seed.ts`](apps/api/prisma/seed.ts)):

| Role | Email |
|---|---|
| Super admin | `superadmin@taxbros.test` |
| Staff with attendance and report permissions | `staff1@taxbros.test` |
| Staff without permissions | `staff2@taxbros.test` |
| Students | `student01@taxbros.test` … `student10@taxbros.test` |

`pnpm --filter api seed:demo-users` creates three extra accounts (`demo-admin@`, `demo-staff@`, `demo-student@taxbros.test`) for quick local testing.

## Environment variables

### API (`apps/api/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (add `connection_limit=10` in production) | required |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Two different 256-bit random secrets; production refuses weak ones | required in production |
| `JWT_EXPIRY`, `REFRESH_TOKEN_EXPIRY` | Token lifetimes | `15m`, `7d` |
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT`, `API_PREFIX` | Listen port and route prefix | `4000`, `api` |
| `CORS_ORIGIN` | Comma-separated web origins; https only in production | `http://localhost:3000` |
| `TRUST_PROXY` | Set to `1` behind Nginx so limits and logs see real client IPs | unset |
| `USER_RATE_LIMIT`, `IP_RATE_LIMIT` | Requests per minute per user / per IP | `100`, `500` |
| `LOGIN_RATE_LIMIT`, `LOGIN_RATE_WINDOW_MINUTES` | Login attempts per IP per window | `5`, `15` |
| `LOG_DIR`, `LOG_LEVEL`, `LOG_RETENTION`, `LOG_TO_FILES` | JSON log files (daily rotation) | `./logs`, `info`, `90d`, on |
| `SWAGGER_ENABLED` | Serve `/api/docs` | on in development, off in production |
| `MAX_FILE_SIZE`, `UPLOAD_PATH` | Course cover uploads | 2 MB, `./uploads` |

Full production template: [`apps/api/.env.production.example`](apps/api/.env.production.example).

### Web (`apps/web/.env.local`, `.env.production`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL including `/api`, e.g. `https://DOMAIN/api`. Baked in at build time |
| `NEXT_PUBLIC_ENABLE_SW` | `true` to register the service worker under `next dev` (it is always on in production builds) |

## Database

```bash
pnpm --filter api exec prisma migrate dev --name <change>   # create a migration (development)
pnpm --filter api exec prisma migrate deploy                # apply migrations (production)
pnpm --filter api exec prisma studio                        # browse data
pnpm --filter api exec prisma db seed                       # demo data (safe to re-run)
```

Backups: `deploy/scripts/backup-db.sh` (daily, gzip, 30-day retention) and `deploy/scripts/restore-db.sh`.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#backups).

## Tests

```bash
pnpm --filter api test        # Jest unit and integration tests
pnpm --filter web test        # Vitest component and library tests
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
```

All suites pass. The database tests in `src/lab-schema.spec.ts` write data, so they run only when
`TEST_DATABASE_URL` points at a disposable, migrated database; otherwise they are skipped.

## Production build

```bash
pnpm --filter api build       # → apps/api/dist
pnpm --filter web build       # → apps/web/.next/standalone (self-contained Node server)
```

The full server procedure (PM2, Nginx, HTTPS, backups, Android) is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): server setup, deployment checklist, backups, PWA and Android
- [docs/API.md](docs/API.md): authentication, errors, rate limits, roles and every endpoint
- [apps/mobile/README.md](apps/mobile/README.md): building and signing the Android APK
- [docs/manuals/](docs/manuals/): administrator, staff and student manuals with screenshots (PDFs in `docs/manuals/pdf/`)
- [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md): T1–T7 acceptance results
- [docs/HANDOVER.md](docs/HANDOVER.md): handover package, training video script and go-live checklist
- `PHASE*_CHECKPOINT_REPORT.md`: what each milestone delivered and what is still open
