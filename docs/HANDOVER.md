# TAXBROS LMS: Handover package (task 76)

Everything the institute needs to run, use and maintain the system. Items marked **To supply** can only be
completed once the production server, the Android signing key and the institute's contacts exist.

## Package contents

| # | Item | Where | Status |
|---|---|---|---|
| 1 | Hosted URL with sign-in details for all three roles | Section 1 | **To supply** after deployment |
| 2 | PWA installation instructions (Chrome/Edge) | Section 2 | Ready |
| 3 | Android APK and installation guide | `apps/mobile/README.md`, section 3 | Guide ready; **APK to build** |
| 4 | Source code | Git repository in `taxbros-lms/` (local, 2 commits) | Ready; **push to a private remote** (section 4) |
| 5 | Database backup file | `deploy/scripts/backup-db.sh` | **To supply**: first backup after go-live |
| 6 | Environment configuration templates | `apps/api/.env.example`, `apps/web/.env.example`, `apps/mobile/.env.example` | Ready |
| 7 | Build and deployment scripts | `deploy/` (PM2, Nginx, deploy, backup, restore), `docs/DEPLOYMENT.md` | Ready |
| 8 | Training video | Script in section 6 | **To record** |
| 9 | Support contact information | Section 7 | **To fill in** |
| 10 | User manuals (admin, staff, student) with screenshots, PDF | `docs/manuals/` and `docs/manuals/pdf/` | Ready |
| 11 | API reference and OpenAPI/Postman file | `docs/API.md`, `docs/openapi.json` | Ready |
| 12 | Acceptance test results (T1–T7) | `docs/ACCEPTANCE_TESTS.md` | Ready (APK and hosted checks pending) |

## 1. Hosted URL and sign-in details

After following `docs/DEPLOYMENT.md`:

- **Web address:** `https://<your domain>` (the configs use `taxbros.acharyaprofessionalaccountants.in` as a
  placeholder).
- **Demo accounts:** `pnpm --filter api exec prisma db seed` with `SEED_PASSWORD` set (at least 12
  characters) creates:
  - Super admin: `superadmin@taxbros.test`
  - Staff: `staff1@taxbros.test` (Mark attendance and View reports), `staff2@taxbros.test`
  - Students: `student01@taxbros.test` … `student10@taxbros.test`
  - Plus 2 classes, a published course with 3 modules and 6 lessons, 2 quizzes and 3 labs.
- Give the password to the institute in person or through a password manager. Don't put it in email or
  in this repository. Every account is asked to choose its own password at first sign-in.
- Replace the demo accounts with real ones (Users screen) before students start; deactivate the demo
  accounts afterwards.

## 2. Installing as an app on computers and phones (PWA)

- **Chrome or Edge on Windows/macOS:** open the site, then the install icon at the right of the address bar
  (or menu → **Apps** → **Install TAXBROS LMS**).
- **Chrome on Android:** menu (three dots) → **Install app** or **Add to Home screen**.
- **Safari on iPhone/iPad:** Share → **Add to Home Screen**.

The installed app opens in its own window and always uses the live site, so data is the same everywhere.

## 3. Android APK

Follow `apps/mobile/README.md`. On the development PC, Android Studio and its JDK are installed but the
Android SDK isn't: open Android Studio once, let it install the SDK (accepting Google's licence), then:

1. Decide the package ID (`CAP_APP_ID`, `in.taxbros.lms` is a placeholder) and the hosted URL
   (`CAP_SERVER_URL`).
2. Create the release keystore once and keep it and its passwords safe: losing it means the app can
   never be updated.
3. Build the APK and install it on a phone; sign in as each role and check that data matches the web app.

## 4. Source code

The project is a git repository (first commit `e14b017`, 21 Nov 2026) with no remote yet. Create a
private repository the institute owns, then:

```bash
git remote add origin <repository URL>
git push -u origin master
```

Every commit runs both test suites first (husky pre-commit hook). `.gitignore` leaves out `node_modules`, build
output, `.env` files, uploads and signing keys. Never commit `.env`, the keystore or `keystore.properties`.

## 5. Backups

`deploy/scripts/backup-db.sh` makes a compressed daily `pg_dump` (cron at 02:00 IST) and keeps 30 days.
`deploy/scripts/restore-db.sh` restores one. After go-live, take the first backup, copy it off the server,
and test a restore on a spare database (`docs/DEPLOYMENT.md`, section 6).

## 6. Training video script (about 20 minutes)

Record the screen of the hosted site with the demo data loaded, one part per role:

1. **Introduction (1 min):** what the system does; web, installed app and Android share one account.
2. **Signing in (2 min):** first sign-in with a temporary password, choosing a password, Change password,
   lockout after 5 tries.
3. **Administrator (8 min):** Dashboard; Users (add a student and a staff member, temporary password,
   filters, profile, reset password, deactivate); staff permissions; Classes (create, add students);
   Courses (course, module, lesson with an unlisted YouTube link, publish, enrol students); Quizzes (create,
   questions, publish); Labs (sample data, on/off); Staff Attendance; Reports and CSV; Settings.
4. **Staff (3 min):** Class Register (choose class and date, mark, save, correct); Reports; how extra
   permissions add menu items.
5. **Student (5 min):** Dashboard; watching a lesson (resume, completion at 90%); taking a timed quiz and
   reviewing answers; GST, ITR and MCA labs with the "fictional data only" rule.
6. **Wrap-up (1 min):** where the manuals are, who to contact for help.

## 7. Support contacts (fill in)

| Role | Name | Phone / email | Hours |
|---|---|---|---|
| System administrator at the institute | | | |
| Developer / maintainer | | | |
| Hosting provider | | | |

## 8. Final checks before go-live (task 77)

- [ ] Server deployed per `docs/DEPLOYMENT.md`, HTTPS working, `JWT_SECRET` and `JWT_REFRESH_SECRET` strong
- [ ] `pnpm --filter api test` and `pnpm --filter web test` pass on the release build
- [ ] Demo data loaded, each role signed in on the hosted URL
- [ ] PWA installs from the hosted URL; APK installs on a phone and shows the same data
- [ ] First backup taken and a restore tested
- [ ] Manuals and this handover note given to the institute; training video recorded
- [ ] Demo accounts replaced by real accounts
