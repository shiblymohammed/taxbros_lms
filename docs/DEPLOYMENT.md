# Deploying TAXBROS LMS

Target: one Linux server (Ubuntu 22.04/24.04 LTS or similar) running Nginx, PostgreSQL, Node.js and PM2.
Web app and API share one domain (`https://DOMAIN/` and `https://DOMAIN/api/`), which keeps the refresh
cookie same-site. Replace `DOMAIN` with the real host name everywhere below.

## 1. Server preparation (once)

```bash
# Node.js 20+ (NodeSource or nvm), pnpm and PM2
npm install -g pnpm pm2
pm2 startup systemd            # follow the printed command so PM2 restarts on boot

# Nginx, Certbot, PostgreSQL 15+ client tools
sudo apt install nginx certbot python3-certbot-nginx postgresql-client
```

Point the domain's DNS `A` record at the server before requesting the certificate.

## 2. Database (Task 66)

On a managed PostgreSQL service, create the database and user in its console. On the same server:

```bash
sudo -u postgres psql
CREATE USER taxbros WITH PASSWORD '<strong password>';
CREATE DATABASE taxbros OWNER taxbros;
\q
```

Connection pooling: each API process uses Prisma's pool. `connection_limit=10` in `DATABASE_URL` with
2 PM2 instances gives at most 20 connections; make sure PostgreSQL's `max_connections` leaves headroom.

## 3. Configuration

```bash
git clone <repository> /srv/taxbros-lms && cd /srv/taxbros-lms
cp apps/api/.env.production.example apps/api/.env
cp apps/web/.env.production.example apps/web/.env.production
```

In `apps/api/.env`:

- `DATABASE_URL`: the database from step 2.
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: two different values, each from
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
  The API will not start with missing, short, example or identical secrets.
- `CORS_ORIGIN=https://DOMAIN`.

In `apps/web/.env.production`: `NEXT_PUBLIC_API_URL=https://DOMAIN/api`.

Keep both files readable only by the deploy user: `chmod 600 apps/api/.env apps/web/.env.production`.

## 4. Build and start (Tasks 68-69)

```bash
SKIP_BACKUP=1 bash deploy/scripts/deploy.sh    # first install: nothing to back up yet
```

The script installs dependencies, backs up the database (later runs), applies Prisma migrations,
builds the API and the standalone web server, starts or reloads both under PM2
([`deploy/ecosystem.config.js`](../deploy/ecosystem.config.js): API in cluster mode with 2 instances, web with 1),
and checks `/api/health` and `/login`.

Demo data for the handover (optional, Task 71):

```bash
cd apps/api
NODE_ENV=production SEED_ALLOW_PRODUCTION=true SEED_PASSWORD='<12+ characters>' pnpm exec prisma db seed
```

## 5. Nginx and HTTPS

```bash
sudo cp deploy/nginx/taxbros.conf /etc/nginx/sites-available/taxbros
sudo sed -i 's/DOMAIN/lms.example.com/g' /etc/nginx/sites-available/taxbros
sudo ln -s /etc/nginx/sites-available/taxbros /etc/nginx/sites-enabled/
```

The config references the certificate, so get it first: comment out the `listen 443` server block, run
`sudo nginx -t && sudo systemctl reload nginx`, then `sudo certbot --nginx -d lms.example.com`, restore the block,
and reload again. Certbot renews automatically (`systemctl list-timers | grep certbot`).

Security headers come from the apps (Task 70):

- API (Helmet): strict CSP, HSTS for 1 year, `nosniff`, frame protection, referrer policy. CORS allows only `CORS_ORIGIN`, with credentials.
- Web (Next.js): CSP that allows only the API origin and the YouTube player, HSTS for 1 year, `X-Frame-Options: DENY`, Permissions-Policy.

Check after deploying:

```bash
curl -sI https://DOMAIN/login | grep -iE 'strict-transport|content-security|x-frame'
curl -sI https://DOMAIN/api/health | grep -iE 'strict-transport|content-security'
```

## 6. Backups (Task 67)

[`deploy/scripts/backup-db.sh`](../deploy/scripts/backup-db.sh) writes `taxbros_YYYY-MM-DD_HHMM.sql.gz` to
`/var/backups/taxbros` (override with `BACKUP_DIR`), verifies the archive, and deletes backups older than
30 days (`BACKUP_RETENTION_DAYS`). Schedule it daily at 02:00 India time with `crontab -e`:

```
CRON_TZ=Asia/Kolkata
0 2 * * * /bin/bash /srv/taxbros-lms/deploy/scripts/backup-db.sh >> /var/log/taxbros-backup.log 2>&1
```

Copy backups off the server too (another machine or cloud storage): a disk failure takes local backups with it.

### Restoring

1. Create an empty database: `sudo -u postgres createdb -O taxbros taxbros_restore`.
2. `bash deploy/scripts/restore-db.sh /var/backups/taxbros/<file>.sql.gz postgresql://taxbros:<password>@127.0.0.1:5432/taxbros_restore`
   and type `RESTORE` when asked.
3. Check row counts (users, attendance, lab attempts) against the live database.
4. To replace the live database: `pm2 stop taxbros-api`, rename or drop the old database, rename
   `taxbros_restore` to `taxbros`, then `pm2 start taxbros-api`.

Test a restore at least once after go-live and after major changes. (Tested on 21 Nov 2026 against the
development database: backup and restore row counts matched.)

## 7. PWA (Task 63)

Nothing to configure: the manifest (`/manifest.webmanifest`), icons and service worker (`/sw.js`) ship
with the web build. The service worker caches only the manifest and icons; pages and API calls always use
the network. To check: open the site in Chrome or Edge, then DevTools → Application → Manifest
(no errors) and the install icon in the address bar.

## 8. Android app (Tasks 64-65)

The app loads `https://DOMAIN`, so deploy the web app first. Build steps are in
[apps/mobile/README.md](../apps/mobile/README.md).

## Deployment checklist

- [ ] DNS points to the server; HTTPS certificate issued; HTTP redirects to HTTPS
- [ ] `apps/api/.env`: strong distinct JWT secrets, `NODE_ENV=production`, `CORS_ORIGIN=https://DOMAIN`, `TRUST_PROXY=1`
- [ ] `apps/web/.env.production`: `NEXT_PUBLIC_API_URL=https://DOMAIN/api`
- [ ] `deploy.sh` finished with `API 200` and `Web 200`; `pm2 status` shows 2 API and 1 web process online
- [ ] Sign in as each role; mark a register; play a lesson; take a quiz; submit each lab
- [ ] Security headers present (step 5); `/api/docs` returns 404 unless `SWAGGER_ENABLED=true`
- [ ] Backup cron installed; one backup restored successfully into a scratch database
- [ ] PWA installs from Chrome/Edge; APK installs on an Android phone and signs in
- [ ] Demo or initial accounts' passwords handed over securely and changed by their owners

## Updating

```bash
cd /srv/taxbros-lms && git pull && bash deploy/scripts/deploy.sh
```

Logs: `pm2 logs`, and the API's JSON logs in `apps/api/logs/` (`combined-*.log`, `error-*.log`, kept 90 days).
