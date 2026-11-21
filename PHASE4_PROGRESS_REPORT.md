# Phase 4 Progress Report: Deployment & Handover (Tasks 63–77)

**Date:** 21 November 2026
**Status:** Everything that can be built inside the repository is done. The remaining tasks need the
production server, the Android SDK and signing key, a phone, or the institute's input.

## Summary

| Task | Status | Result |
|---|---|---|
| 63 PWA | Done | Manifest (`/manifest.webmanifest`), TAXBROS icons (192, 512, maskable), service worker that caches only the manifest and icons, registered in production builds. Verified on a production build: worker active, manifest linked, icons load. Install prompt not clicked through. |
| 64 Capacitor | Done | `apps/mobile`: Capacitor 8, Android project, app name, package ID `in.taxbros.lms` (placeholder), loads the hosted web app, bundled offline page, launcher icons and splash generated from the logo. |
| 65 APK | Prepared | Release signing reads a git-ignored `keystore.properties`. **Not built:** the Android SDK isn't installed on this PC. Min/target SDK are 24/36 (Capacitor 8), not the plan's 22/33. |
| 66 Production DB | Prepared | `DATABASE_URL` template with `connection_limit=10` × 2 processes = 20 connections; `prisma migrate deploy` in the deploy script. Needs the server. |
| 67 Backups | Done | `deploy/scripts/backup-db.sh` (gzip, verified archive, 30-day retention, cron at 02:00 IST) and `restore-db.sh`. **Tested** on the dev database: backup restored into a scratch database with matching row counts. |
| 68 API deployment | Prepared | PM2 cluster ×2 (`deploy/ecosystem.config.js`), `deploy/scripts/deploy.sh`, `.env.production.example`. The API now **refuses to start in production** with missing, short, example or identical JWT secrets. Needs the server. |
| 69 Web deployment | Prepared | Next.js standalone output (verified: builds and serves), Nginx site with HTTPS (`deploy/nginx/taxbros.conf`), `.env.production.example`. Needs the server and domain. |
| 70 Security | Done | API: Helmet (strict CSP, HSTS 1 year, nosniff, frame protection), CORS limited to `CORS_ORIGIN` (production refuses `*`, empty or http), Swagger off in production by default. Web: CSP allowing only the API and the YouTube player, HSTS, `X-Frame-Options: DENY`, Permissions-Policy. Verified on live servers; no CSP violations on the pages checked. |
| 71 Demo seed | Written | `prisma db seed`: 1 super admin, 2 staff (one with permissions), 10 students, 2 classes, 1 published course (3 modules, 6 lessons), 2 quizzes × 5 questions, 3 labs. Idempotent; production needs `SEED_ALLOW_PRODUCTION=true` and `SEED_PASSWORD`. **Not run** (creating accounts was blocked by the permission check). |
| 72 README | Done | Rewritten: features, architecture, setup, environment reference, database, tests, builds. |
| 73 API docs | Done | `docs/API.md` (auth flow, errors, rate limits, roles/permissions, all 88 endpoints with who can call them) and `docs/openapi.json` for Swagger/Postman import. |
| 74 User manuals | Not started | Needs screenshots of the finished screens. |
| 75–77 Acceptance, handover | Not started | Need a deployed system. |

Also added: `docs/DEPLOYMENT.md` (server setup, checklist, backups, PWA, Android) and `apps/mobile/README.md`.

## Defects found and fixed

1. **Staff permissions were never enforced.** `PermissionsGuard` and `@RequirePermission` existed but no endpoint used them, so every staff member could open and mark registers and view reports. Registers and staff attendance now require `MARK_ATTENDANCE`, and monthly reports require `VIEW_REPORTS` (admins bypass). A test pins this wiring.
2. **Student dashboard was broken.** It called `GET /auth/me`, which didn't exist, and then the admin-only `/students` list. Added `GET /api/auth/me` (identity, role, student/staff profile IDs). The dashboard uses it and was checked signed in as a student.
3. **JWT secret fallback.** With `JWT_SECRET` unset the API used `'development-secret-key'`, which would let anyone forge tokens. Production now fails at startup instead.
4. **Next.js default favicon** (Vercel logo) replaced with the TAXBROS icon.

## Class register screen (fixed, 21 Nov)

Task 22 specified `/staff/attendance` as the student register screen, but the route marked **staff**
attendance from an admin-only list, so staff got a 403 and nobody could mark class registers in the web app.

- **`/staff/attendance` is now the Class Register:** pick a class and date (no future dates); the register opens with the roster frozen at first opening; Present/Absent/Late per student (44px controls, P/A/L on phones), optional remarks, "Mark rest Present", unsaved/unmarked counts; saving sends only new or changed marks. A saved register shows "Save corrections" and sends only the corrected rows. Staff without `MARK_ATTENDANCE` see an explanation instead of an error.
- **Staff attendance moved to `/admin/staff-attendance`** (same behaviour), using the same shared controls (`components/attendance/status-picker.tsx`).
- **Navigation:** staff see "Class Register"; admins see Class Register, Staff Attendance and Reports.
- **Also fixed:** `classesApi.getAll()` returned the paginated wrapper instead of the list, so the monthly report's class filter never had any classes. It now lists active classes.
- **Tests:** 5 new (helper + page: open and save, correction sends only the changed row, missing-permission message, no classes).
- **Browser:** demo staff opened a register (API 201, permission check passed) and saw the empty-roster message (dev classes have no enrolled students, so marking rows was covered by the tests, not the browser); demo admin used Staff Attendance at the new route, kept the admin menu on the register screen, and the report's class filter listed all 3 classes.

## Full task and requirement audit (21 Nov)

Every task in `tasks.md` was checked against the code, and the 40 requirements were checked for anything no
task covered. Tasks 1–64, 67, 70, 72 and 73 have their code. The audit found these gaps, now fixed:

| Gap | Requirement | Fix |
|---|---|---|
| No way to change a password; admin reset missing; "must change password" ignored | R36 | `POST /api/auth/change-password` (current password, policy: 8+ chars, uppercase, number, special; signs out other sessions). `POST /api/users/{id}/reset-password` (one-time temporary password). Until changed, the API returns 403 `PASSWORD_CHANGE_REQUIRED` for everything except `/auth/me`, change-password and logout. Web: `/change-password` page with a live rules checklist, redirect after login and from every area, "Change password" in the header. |
| Deactivation left sessions renewable | R2.10 | Deactivating deletes the user's refresh tokens. |
| No admin screen for accounts or staff permissions | R1, R3 | `/admin/users`: search, role/status filters, paging, create student/staff/administrator with a generated temporary password shown once, edit, activate/deactivate, reset password, staff permissions dialog. |
| No admin screen for classes | R4 | `/admin/classes`: create, rename, archive/restore, roster with student search, remove (keeps history). |
| No way to enrol students in courses | R5 | "Enrolled students" card on each course page: enrol (published courses), progress %, remove (sets DROPPED, keeps progress; re-adding reactivates). |
| No quiz authoring screen | R23, R24 | `/admin/quizzes` and `/admin/quizzes/{id}`: create attached to a course/module/lesson, questions with 2–6 options and a marked correct answer, edit/delete, publish/unpublish, delete quiz. |
| Publishing allowed with no questions or mismatched marks | R24.8 | Publishing now requires at least one question and question marks equal to the quiz total. |
| **Quiz answer keys sent to students** | R25.2 | `GET /api/quizzes` returned every question's `correctAnswer` to students, and `?status=DRAFT` showed them drafts. Students now always get published quizzes only, without answers. |
| Admin course list and report class filter were empty | — | Both read the API's paginated `{ data, meta }` response as a plain list. Fixed in `coursesApi.getAllCourses` and `classesApi.getAll`. |
| Swagger and mapped-types built for NestJS 12 on a NestJS 10 app | — | Pinned to the NestJS 10 releases (`@nestjs/swagger` 8, `@nestjs/mapped-types` 2). The Jest stub is gone, and the API no longer depends on Node loading ESM-only packages. |
| Quiz submit response type wrong in the web app | — | `QuizSubmissionResponse` now matches the API (`attemptId`, not `id`). |

### Earlier failing tests, now fixed

All 7 failing API suites and the 5 failing web tests were test problems, not app bugs. Causes: mocks in the
wrong order, missing mock fields, a plain object where Prisma throws a typed error, guards not stubbed in an
HTTP test, the wrong button clicked in a dialog, and specs written for an older lockout design. The failed-login
suite also wrote users into the development database; it now runs in memory. `lab-schema.spec` only touches a
database when `TEST_DATABASE_URL` is set.

- **API:** 41 suites, 713 tests pass, 8 database tests skipped by design, 0 failing (was 28 failing).
- **Web:** 8 files, 96 tests pass, 0 failing (was 5 failing).
- **Builds and type-checks:** API and web pass.
- **Browser (demo admin, production build):** Users, Classes (with roster picker), Quizzes (with New quiz dialog), Courses and Change password screens load and work read-only. Creating an account from the browser was blocked by the permission check, so account creation, reset and the forced-change flow are covered by automated tests rather than a browser run.

### Closed after the audit (21 Nov, second pass)

- **R6 institute settings:** new `institute_settings` table (migration `20261121120000_add_institute_settings`, seeded with `timezone = Asia/Kolkata` and `instituteName`). `GET /api/settings` for anyone signed in, `PATCH /api/settings/{key}` for administrators only (staff and students get 403). Values are validated (IANA timezone, 2–100 character name) and the updater and time are recorded. New **Settings** screen in the admin menu. `INSTITUTE_TIMEZONE` in `.env` is no longer read.
- **R6.6 timezone applied:** the admin dashboard's "today" used UTC (wrong before 05:30 IST); it now uses the institute timezone. Monthly attendance reports built month ranges in server-local time, which shifts them a day on an IST machine; they now use UTC calendar dates. The class register and staff attendance screens default to today in the institute timezone instead of the device's.
- **R3.2 permission names:** enum now `MARK_ATTENDANCE`, `VIEW_REPORTS`, `MANAGE_COURSES`, `MANAGE_STUDENTS`, `MANAGE_STAFF`, `MANAGE_CLASSES` (plus `MANAGE_LABS`). Migration `20261121130000_align_staff_permission_types` turns any `MANAGE_USERS` grant into `MANAGE_STUDENTS` + `MANAGE_STAFF`. Still only `MARK_ATTENDANCE` and `VIEW_REPORTS` open endpoints to staff.
- **R1.11 / R1.12 search:** the Users screen shows admission ID, class and admission date range filters for students, and staff ID, department, designation and category for staff. The class filter on `GET /api/students` had been commented out; it now works.
- **R5.4 / R26.5 student profile:** new admin page `/admin/students/{id}` (Profile button on the Users screen) with course progress, current and past classes, and every quiz attempt; each attempt opens with chosen and correct answers.
- **Security (R2.5):** `GET /api/students/{id}` let any student read any other student's profile (the ownership check was a TODO). Students now get 403 for anyone but themselves. Password reset tokens are no longer returned with the profile.

### Staff admin powers (21 Nov, third pass)

- **Wired up:** each `MANAGE_*` permission now opens the matching admin screens and endpoints to staff (table in `docs/API.md`). Staff see a menu built from their permissions; any other `/admin` screen sends them back to the class register. Dashboard, Settings and Staff Attendance stay admin-only.
- **Safety rules:** staff can't manage their own account, administrators, or staff holding permissions they lack (so a password reset can't be used to take over a more powerful account), and can't grant permissions. Permissions are re-read on every request and whenever a staff member opens a screen.
- **Existing gaps closed:** because roles are hierarchical, routes open to students were also open to all staff. Any staff member could enrol or unenrol any student in a course and read any student's profile and attendance. These now need `MANAGE_COURSES`, `MANAGE_STUDENTS` (or `VIEW_REPORTS` for attendance). Students can no longer list another student's course enrolments.

### Remaining tasks (21 Nov, fourth pass)

- **Task 62 (T6 checkpoint):** done; all lab tests pass and the labs were checked in the browser.
- **Task 74 (user manuals):** done. `docs/manuals/` has administrator, staff and student manuals with 20 screenshots from the production build, and PDFs (`python docs/manuals/build-pdf.py`).
- **Task 75 (T1–T7):** T1–T6 pass and were browser-checked; results in `docs/ACCEPTANCE_TESTS.md`. Added an explicit T3 test (80% → 90% after a correction). T7 APK install and hosted checks remain.
- **Task 76 (handover):** `docs/HANDOVER.md` assembled, with example env files for web and mobile, a training video script and a go-live checklist. Hosted URL, APK, first production backup, video, contacts and a git repository remain.
- **Task 71 (seed):** done; run on the local database at your request. Running the student flows on the seeded data found two more bugs, both fixed:
  - **Students could never open or submit a quiz.** The quiz controller passed the user ID where quiz records use the Student profile ID, so every enrolment check failed (403) and attempts couldn't be saved. Students now go through their profile ID (as the labs already did).
  - **Module and lesson quizzes never reached students**, and the quiz list sent students the published quizzes of every course. The API now works out each quiz's course (directly or via its module or lesson) and only returns quizzes from the student's active courses.
- **Bugs found while taking screenshots, all fixed:**
  - The **Courses** screen drew its "create course" form permanently over the page on a black background, so the course list couldn't be used. Now a proper dialog.
  - Tailwind v4 ignores `bg-opacity-*`, so every modal backdrop on the course editor and the inactive-lab overlay were solid black. Switched to `bg-black/50`.
  - Reports showed **"NaN%"** average attendance when no student had marked days; now "N/A".
  - The 10-item admin menu pushed "Change password" off-screen at 1280px; the header now fits.
  - **Quiz time limits were only displayed, never enforced.** Added a countdown that survives reloads and submits automatically at zero; the API accepts a timed-out attempt with unanswered questions (scored 0) and records the real start time.
  - The root `.gitignore` excluded the whole Android project (signing setup, icons, Gradle config); it now keeps the project and ignores only keystores and their passwords.

### Health check (21 Nov, fifth pass)

Checked type-checks, both test suites, lint, migrations, dependencies, API routes and every web-to-API call.

- **Course cover upload never worked:** the web app posted to `/upload/course-cover` (no course ID; the API route is `/upload/course-cover/:courseId`) and read a `url` field the API doesn't return, so saving a course with a new cover failed. Fixed and covered by a test; checked against the running API (upload, served via `/uploads`, delete).
- **R27.4 gap:** who changed a lab's sample data was received but thrown away. New `labs.updatedBy` column (migration `20261121140000_lab_updated_by`) now stores it.
- **Dependencies:** 37 advisories (1 critical, 20 high) reduced to 1 moderate. `bcrypt` 5 → 6 (drops the vulnerable `tar`; existing password hashes still verify) and patched `multer`, `body-parser`, `qs`, `lodash`, `js-yaml`, `file-type` via overrides (`package.json` for pnpm 8, mirrored in `pnpm-workspace.yaml` for newer pnpm). Remaining: `@nestjs/core` advisory, fixed only in NestJS 11. `@types/node` in the web app raised to 22 to satisfy `vitest`'s peer requirement.
- **Lint:** the web `lint` script used `next lint`, which Next.js 16 removed, and the API `lint` script rewrote files (`--fix`). Both now check only (`lint:fix` added). Fixed 79 web and 54 API lint errors (unused code, fetch functions used before declaration, a ref written during render, a `module` variable, an expression statement). `pnpm -r lint` passes with 0 errors; `any` and effect-setState remain as warnings.
- **Reports race:** quickly changing report filters could let an older response overwrite the newer table; only the latest request now updates it.
- **Verified clean:** all 11 migrations replay on an empty database with no drift; lockfile matches; no duplicate API routes; every web API call matches a route; end-to-end test files compile.

### Tasks 65–77 (21 Nov, sixth pass)

- **Task 76:** the source is now in a local git repository (`e14b017` initial commit, `c94830d` line-ending fix so `gradlew` and the husky hook keep Unix line endings). No secrets or build output are committed; there is no remote yet.
- **Tasks 66, 68, 69:** no production server exists yet. Deployment scripts and `docs/DEPLOYMENT.md` are ready for when one does.
- **Task 65:** the owner will install the Android SDK (open Android Studio once); then the APK can be built.
- **Tasks 75 and 77:** everything checkable locally passes; the hosted and APK checks wait on the two items above.

### Still open

- **Tasks 65, 66, 68, 69:** need the production server and domain, the Android SDK (Android Studio is installed; open it once to install the SDK), the signing key and a phone.
- **Task 71 on the server:** run the seed there with `SEED_PASSWORD` and `SEED_ALLOW_PRODUCTION=true`.
- **Task 77:** the final checkpoint; go-live checklist in `docs/HANDOVER.md` section 8.

## Verification

- **API tests (latest):** 44/44 suites, 757 passed, 8 database tests skipped by design, 0 failing.
- **Web tests (latest):** 16 files, 126/126 passed. Lint: 0 errors in both apps.
- **Browser (third pass):** demo staff given `MANAGE_CLASSES` saw Class Register, Classes and Reports; Classes opened, Courses and Settings redirected; the API refused users, course creation, settings and self-granting (403). The test permission was removed afterwards. Web and API builds and both type-checks pass.
- **Database:** both new migrations applied to the local database; `prisma migrate diff` against the schema shows no difference.
- **Browser (second pass, read-only as demo admin):** Settings screen loads the stored defaults; student filters narrow the user list (admission ID "demo" → 1 of 2); a student profile loads with sign-in time shown in IST.
- **Browser, production build:** PWA checks above; headers present; demo student signed in and the dashboard loaded; sign out cleared the session; demo staff signed in and was routed to `/staff/attendance`.

## What needs you

1. **Decide:** package ID (`in.taxbros.lms` is a placeholder) and final domain (configs use `DOMAIN` / the planning note's `taxbros.acharyaprofessionalaccountants.in`).
2. **Server** (tasks 66, 68, 69): follow `docs/DEPLOYMENT.md`.
3. **Android** (task 65): install the Android SDK and a JDK 21, create the keystore, build, install on a phone (`apps/mobile/README.md`).
4. **Seed:** `pnpm --filter api exec prisma db seed` locally to get the full demo data set.

## New configuration

API: `SWAGGER_ENABLED`; production now requires strong `JWT_SECRET`/`JWT_REFRESH_SECRET` and an https `CORS_ORIGIN`.
Seed: `SEED_PASSWORD`, `SEED_ALLOW_PRODUCTION`, `SEED_RESET_PASSWORDS`. Mobile: `CAP_SERVER_URL`, `CAP_APP_ID`.
Web: `NEXT_PUBLIC_ENABLE_SW` (service worker under `next dev`).
