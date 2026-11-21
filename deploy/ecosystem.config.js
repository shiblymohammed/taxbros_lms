/**
 * PM2 process file (Tasks 68-69). From the repository root on the server:
 *   pm2 start deploy/ecosystem.config.js && pm2 save
 *
 * - API: cluster mode, 2 instances (Prisma pool of 10 each = 20 DB connections max)
 * - Web: Next.js standalone server, 1 instance
 *
 * Note: rate limits and failed-login tracking are kept in memory per API instance, so with
 * 2 instances the effective limits are up to 2x the configured values.
 */
const path = require('path');

const root = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'taxbros-api',
      cwd: path.join(root, 'apps/api'),
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' }, // everything else comes from apps/api/.env
      max_memory_restart: '512M',
      kill_timeout: 10000,
      time: true,
    },
    {
      name: 'taxbros-web',
      cwd: path.join(root, 'apps/web/.next/standalone/apps/web'),
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: '3000', HOSTNAME: '127.0.0.1' },
      max_memory_restart: '512M',
      time: true,
    },
  ],
};
