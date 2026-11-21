# TAXBROS LMS: T1–T7 acceptance test results (task 75)

Run on 21 Nov 2026 on a development machine (Windows 11, Node 20, PostgreSQL, production builds of the
API and web app). "Automated" means Jest (API) and Vitest (web) tests that run on every
`pnpm --filter api test` / `pnpm --filter web test`. "Browser" means a manual check in the production web
build, signed in as the demo accounts. Screenshots are in `docs/manuals/images/`.

## Summary

| Area | Automated | Browser | Still to do |
|---|---|---|---|
| T1 Authentication and access | Pass | Pass | Repeat on the hosted server |
| T2 Attendance registers | Pass | Pass (screens) | Mark a full register with seeded students |
| T3 Monthly calculations | Pass | Pass (report screen) | Repeat with a month of real marks |
| T4 Learning | Pass | Pass (seeded course) | None |
| T5 Quizzes | Pass | Pass (seeded quiz) | None |
| T6 Labs | Pass | Pass | None |
| T7 Delivery | Pass (PWA, responsive) | Pass (PWA, responsive) | APK install on a phone; hosted URL |

**Totals:** API 44 suites, 757 tests passed, 0 failed (8 database tests skipped unless `TEST_DATABASE_URL`
points at a disposable database). Web 15 files, 125 tests passed, 0 failed. Both production builds and
type-checks pass.

The demo data was loaded with `pnpm --filter api exec prisma db seed` and the student flows were run as
`student01@taxbros.test`. The remaining "still to do" items need the hosted server or an Android phone.

## T1: Authentication, deactivated users, permissions, admin access

| Scenario | Evidence | Result |
|---|---|---|
| Sign in, tokens, refresh rotation, sign out | `auth/services/*.spec.ts`, `auth/controllers/auth.controller.spec.ts` (66 tests) | Pass |
| 5 failed sign-ins lock the account for 15 minutes | `auth-failed-login.integration.spec.ts`, `failed-login-tracker.service.spec.ts` | Pass |
| Rate limits (100/min per user, 5 logins per 15 min) | `common/throttling/throttling.spec.ts` | Pass |
| Forced password change, change and reset password | `auth/password-management.spec.ts`, `app/change-password/page.test.tsx` | Pass |
| Deactivated user can't sign in and is signed out everywhere | `users.service.spec.ts`, `password-management.spec.ts` | Pass |
| Role guard and staff permissions (403 without permission, revocation immediate) | `roles.guard.spec.ts`, `permissions.guard.spec.ts`, `permission-wiring.spec.ts`, `auth/staff-access.spec.ts` | Pass |
| Students can only read their own records | `students/student-profile.spec.ts`, `quizzes/attempt-history.integration.spec.ts` | Pass |
| Staff only see screens their permissions allow | `components/app-shell.test.tsx`, `lib/staff-access.test.ts` | Pass |
| Browser: admin, staff and student sign-in each land on the right home screen; staff with Manage classes saw Classes but were sent back from Courses and Settings; the API refused users, course creation, settings and self-granting with 403 | Manual check | Pass |

## T2: Registers (open, mark, reopen, correct, uniqueness)

| Scenario | Evidence | Result |
|---|---|---|
| Opening a register creates it once per class and date, with a frozen roster | `attendance/attendance.service.spec.ts` | Pass |
| Marking, re-opening and correcting keep one record per student | `attendance.service.spec.ts` | Pass |
| Future dates refused; staff need Mark attendance | `attendance.service.spec.ts`, `permission-wiring.spec.ts` | Pass |
| Register screen: status picker, unsaved-change highlighting, save | `app/staff/attendance/page.test.tsx` | Pass |
| Browser: Class Register and Staff Attendance screens load for admin and staff (`class-register.jpg`, `admin-staff-attendance.jpg`) | Manual check | Pass |

## T3: Monthly calculations

| Scenario | Evidence | Result |
|---|---|---|
| Present and late count as attended; unmarked days excluded; no marks gives N/A | `attendance-calculation.service.spec.ts` | Pass |
| **80% → 90% after a correction** (10 days, one absence corrected to present) | `attendance-calculation.service.spec.ts`, test "T3: a corrected register moves the month from 80% to 90%" | Pass |
| Month boundaries are calendar dates in any server timezone | same test; `settings/settings.spec.ts` | Pass |
| Staff monthly report | `reports/staff-attendance-reports.spec.ts` | Pass |
| Browser: Reports screen, CSV export button; average shows N/A instead of NaN when nobody has marks (fixed during this run) | Manual check, `lib/report-stats.test.ts` | Pass |

## T4: Learning

| Scenario | Evidence | Result |
|---|---|---|
| Draft/publish: students only see published courses and lessons | `progress/progress.service.spec.ts`, `progress.integration.spec.ts` | Pass |
| Video resume from last position | `progress.service.spec.ts`, `complete-lesson.spec.ts` | Pass |
| Lesson completes at 90% watched or by Mark as complete | `complete-lesson.spec.ts` | Pass |
| Course progress % stored on the enrolment (e.g. 1 of 3 lessons = 33%, all = 100%), only active enrolments; watch position saved (e.g. 150 s) | `complete-lesson.spec.ts`, `progress.integration.spec.ts` | Pass |
| Admin course list | `app/admin/courses/page.test.tsx` | Pass |
| Browser: Courses screen and New course dialog. **Bug found and fixed:** the create-course form was always drawn over the page on a black background, hiding the course list | Manual check | Pass after fix |
| Browser (seeded): student01 sees the course (0 of 6 lessons); the lesson plays the YouTube video; Mark as Complete moves the course to 1 of 6 (17%) and "Up next" to lesson 2 | Manual check | Pass |

## T5: Quizzes

| Scenario | Evidence | Result |
|---|---|---|
| Authoring: questions, marks must add up before publishing | `quizzes/quizzes.service.spec.ts`, `lib/admin-validation.test.ts` | Pass |
| Students never receive answers or drafts | `quizzes.service.spec.ts` | Pass |
| Taking, scoring, pass/fail, attempt limits | `quizzes.service.spec.ts`, `app/student/quizzes/[quizId]/page.test.tsx` | Pass |
| Time limit: countdown and automatic submission when time runs out (added during this run) | `quizzes.service.spec.ts` (time limit), `lib/quiz-timer.test.ts`, quiz page test | Pass |
| History and answer review; admin sees a student's attempts | `attempt-history.integration.spec.ts`, results page test, `app/admin/students/[id]/page.test.tsx` | Pass |
| Browser: Quizzes screen loads | Manual check | Pass |
| Browser (seeded): both quizzes listed (course quiz and module quiz); quiz opens with a running 10-minute countdown; answered and submitted; result, pass/fail and answer review shown; dashboard shows attempt 1 of 3 | Manual check | Pass after two fixes below |
| **Bug fixed:** students could never open or submit any quiz. The controller passed the user ID where quiz records need the Student profile ID, so the enrolment check always failed and attempts couldn't be saved | `quizzes.controller.spec.ts` (profile ID tests) | Pass |
| **Bug fixed:** quizzes attached to a module or lesson never reached students, and the API sent students every course's quizzes. Each quiz now carries its owning course and students only get quizzes from courses they're enrolled in | `quizzes.service.spec.ts` (enrolled courses only) | Pass |

## T6: Labs (GST, ITR, MCA)

| Scenario | Evidence | Result |
|---|---|---|
| Validation of every field, fictional identifiers only | `lab/lab-validation.service.spec.ts` (84), `gst-lab`, `itr-lab`, `mca-lab` service specs | Pass |
| Attempts stored per student; students only see their own | `lab/lab.controller.spec.ts`, `lab.service.spec.ts` | Pass |
| Admin edits sample data and turns labs on or off | `lab.controller.spec.ts`, `lab.service.spec.ts` | Pass |
| Web form validation mirrors the API | `lib/lab-validation.test.ts` | Pass |
| Browser: labs list, GST and ITR forms with the simulation warning; admin Lab Management (`student-*.jpg`, `admin-labs.jpg`) | Manual check | Pass |

## T7: Delivery

| Scenario | Evidence | Result |
|---|---|---|
| PWA manifest, icons, service worker | Production build: `/manifest.webmanifest` served (standalone, 192 and 512 px icons), `/sw.js` served and registered | Pass |
| Responsive layout (phone, tablet, desktop) | Production build at 375px (class register, phone menu), 768px (reports table) and 1280px (all admin screens): no sideways scrolling. The admin header was fixed during this run so its 10-item menu fits at 1280px | Pass |
| Security headers, CORS, production secrets | `common/security/security.config.spec.ts` | Pass |
| Android APK builds and installs on a phone | Not run: Android SDK not installed on this machine, no phone | **Pending** |
| Same data on web, PWA and Android | The app loads the hosted site, so it shares one API and database; to confirm on a phone | **Pending** |
| Hosted URL, HTTPS, backups on the server | Needs the production server (`docs/DEPLOYMENT.md`) | **Pending** |

## How to repeat

```bash
pnpm --filter api test
pnpm --filter web test
pnpm --filter api exec prisma db seed     # demo data for the browser checks
```

Then follow the manuals in `docs/manuals/` as each demo role.
