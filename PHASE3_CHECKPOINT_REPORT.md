# Phase 3 Checkpoint Report: Labs & Polish (Tasks 48–62)

**Date:** 20 November 2026
**Status:** Tasks 48–61 complete. Both checkpoint blockers are fixed (web build, login). Checkpoint 62 needs one last step: a signed-in T6 walkthrough (see "Open items").

## Summary

| Task | Result |
|---|---|
| 53 Lab endpoints | Done. Fixed three defects that broke submissions (below). Added `PATCH /labs/:type/status` (activate/deactivate) |
| 54 GST lab UI | Updated: server-matching PAN rule, dummy document checklist, shared simulation warning, readable errors |
| 55 ITR lab UI | New `/student/labs/itr`: live illustrative tax preview, simulated acknowledgement |
| 56 MCA lab UI | New `/student/labs/mca`: add/remove directors, checklist, field-level errors, simulated certificate and CIN |
| 57 Admin lab UI | New `/admin/labs`: active toggle (optimistic), JSON sample-data editor with validation preview |
| 58 Responsive | 44px touch targets on mobile (Button/Input/Select), role navigation that collapses on mobile, responsive lab and attendance layouts |
| 59 Performance & loading | Route `loading.tsx` Suspense boundaries, `next/image` for course covers, skeletons, optimistic attendance save |
| 60 Errors & logging | Winston JSON logs (`combined-*.log`, `error-*.log`, daily rotation, 90 days), secret masking, global exception filter, request logging, React error boundaries |
| 61 Rate limiting | 100/min per user, 500/min per IP, 5 logins/15 min per IP, 429 with `Retry-After` |

## Defects found and fixed

1. **Authenticated user shape (affects all modules).** `JwtStrategy` returned `id` but every controller reads `req.user.userId`, and `PermissionsGuard` reads `req.user.staffId`. Both were `undefined`, so staff with `MARK_ATTENDANCE` were always denied and user IDs passed to services were missing. The strategy now returns `userId`, `studentId` and `staffId` (`id` kept).
2. **Lab attempts stored against the wrong ID.** `LabAttempt.studentId` references `Student.id`, but the user ID was passed. The controller now uses the Student profile ID and returns 403 if there is none. Before this, the student history filter was `studentId: undefined`, which matches **all** attempts.
3. **MCA submissions always failed.** `McaLabService.submitMcaForm` returns the result object, but `LabService` read `.formData` from it, so a required column was null. Submissions are now normalised per lab type.
4. **ITR calculation was discarded.** Only the acknowledgement was stored. The calculation is now saved with it (R29).
5. **Lab validation field names** were always `"Unknown"`. **GST ARNs** could repeat when two submissions landed in the same millisecond.
6. **Rate limiting was configured but never applied** (no `ThrottlerGuard`).
7. **Staff attendance page carried marks between dates.** Changing the date merged the new date's records into the previous date's marks, which could then be saved.
8. **Course cover images 404'd.** Paths are `/uploads/...` on the API origin. They are now proxied by Next.js (`next.config.ts` rewrite).
9. **Test runner broken.** The `ts-jest` and `ts-node` installs were incomplete (no `dist/`) and were reinstalled. `@nestjs/swagger@12` is ESM-only, so unit tests now map it to `test/stubs/nestjs-swagger.stub.ts`.

10. **Web production build failed** on `react-player/youtube` (removed in react-player v3). The lesson player now uses the v3 API: `src` prop, media-element ref (`currentTime`), `onTimeUpdate` for the 10-second position saves, and resume-from-last-position on ready.
11. **No way to sign in.** Added `/login`, session handling (`src/lib/auth.ts`), automatic access-token refresh on 401 using the httpOnly refresh cookie (one shared request, then retry), role guards in each area's layout, role-based landing pages, safe `?next=` return links, and Sign out. `/` now redirects to the user's area or `/login`.
12. **Theme colours never applied.** `globals.css` gave Tailwind v4 bare HSL channels (`0 0% 9%`), which are not valid colours, so `bg-primary`, `text-muted-foreground` and similar rendered as nothing: primary buttons had no background anywhere. Following the OS dark setting also turned text near-white on the app's white pages. Colours are now real `hsl()` values, light theme only.
13. **Web app called the wrong API URL.** The local `apps/web/.env.local` had `NEXT_PUBLIC_API_URL=http://localhost:4000` (no `/api`), so every request returned 404. Fixed to match `.env.local.example`.
14. **Test-file typings** broke `next build`: added jest-dom matcher types for vitest, made `Course.coverImage` nullable (as the API returns it), and typed two mocks.

## Verification

- **API unit tests:** 629 / 665 pass. All lab suites and the new `common/` suites (masking, exception filter, throttling) pass. The 36 failures are in Phase 1–2 suites (see below).
- **Web unit tests:** 73 / 78 pass, including `lab-validation.test.ts` and the new `auth.test.ts` (role routing, open-redirect protection, single-flight refresh). The 5 quiz-page failures also occur with this phase's changes reverted.
- **Web production build:** passes (`pnpm --filter web build`), type-check included.
- **Type-checks:** API and web both clean, test files included.
- **Live API check:** 5 bad logins returned 401, the 6th returned 429 with `Retry-After: 899`. Logs were written as JSON to both files, with no password in them.
- **Browser (signed out):** `/` and protected pages redirect to `/login` (with `?next=`), the login page renders correctly, and a wrong password shows "Incorrect email or password" from a real 401.
- **Browser (signed in, demo student, 21 Nov):** sign-in returned to the requested page; Practice Labs list loads; the ITR lab filed a mock return and showed the acknowledgement and tax breakdown (API 201).
- **Defect found:** the student dashboard (Task 41 code) calls `GET /api/auth/me`, which does not exist, so the dashboard shows "Cannot GET /api/auth/me". It also looks up the student via `/students?userId=`. **Fixed in Phase 4:** `GET /api/auth/me` added and the dashboard now loads (see PHASE4_PROGRESS_REPORT.md).
- **Not done yet:** GST and MCA submissions, staff attendance and the admin labs page, signed in. Paused to start Phase 4.

## Open items before Milestone 3 sign-off

1. **Finish the signed-in T6 walkthrough** (demo accounts now exist) (the student dashboard's `/auth/me` is fixed). The class register screen now exists at `/staff/attendance` (see PHASE4_PROGRESS_REPORT.md). Create demo accounts with `pnpm --filter api seed:demo-users` (dev only; creates `demo-admin@`, `demo-staff@` and `demo-student@taxbros.test`, password in the script or `DEMO_USER_PASSWORD`), then sign in as each role and run the lab, attendance and admin lab checks.
2. **Forced password change.** The API returns `mustChangePassword`, but there is no change-password endpoint, so the web app cannot enforce it yet.
3. **Cross-domain deployment.** The refresh cookie is `SameSite=Strict`. That works while web and API share a site (localhost, or app/api subdomains of one domain). If they will be on different domains, the cookie settings need revisiting.
4. **Pre-existing failing suites:** `attendance.service`, `auth.service`, `auth-failed-login.integration`, `classes.service`, `complete-lesson`, `quizzes.controller` (`@nestjs/mapped-types@12` is ESM-only), `attempt-history.integration` (TS errors), and `lab-schema.spec` (writes to the real dev database and collides with the seeded labs; should use a separate test DB).
5. **Version mismatch:** `@nestjs/swagger@12` and `@nestjs/mapped-types@12` expect NestJS 12; the app uses NestJS 10.
6. **Shared classroom IP:** the login limit (5 per 15 min per IP) can block a class signing in from one network. Tune `LOGIN_RATE_LIMIT` and set `TRUST_PROXY` behind Nginx.
7. **Existing lab sample data:** `seed-labs.ts` now gives MCA directors emails, but its `upsert` won't update existing rows. Add emails through `/admin/labs`.
8. **SRS input still outstanding:** one institute-supplied sample case and expected result per portal.

## New configuration and scripts (`apps/api/.env.example`, `apps/api/package.json`)

`USER_RATE_LIMIT`, `IP_RATE_LIMIT`, `LOGIN_RATE_LIMIT`, `LOGIN_RATE_WINDOW_MINUTES`, `TRUST_PROXY`, `LOG_DIR`, `LOG_LEVEL`, `LOG_RETENTION`, `LOG_TO_FILES`.

`seed:demo-users` script (development only).
