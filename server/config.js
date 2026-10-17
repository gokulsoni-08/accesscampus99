'use strict';
const crypto = require('node:crypto');
const path = require('node:path');

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function load() {
  const problems = [];
  const port = Number(env.PORT || 8000);
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  if (isProd && !/^https:\/\//.test(baseUrl)) problems.push('BASE_URL must start with https:// in production.');

  let sessionSecret = env.SESSION_SECRET || '';
  if (!sessionSecret) {
    if (isProd) problems.push('SESSION_SECRET is required in production (use: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").');
    sessionSecret = crypto.randomBytes(48).toString('hex');
    console.warn('[config] SESSION_SECRET not set: using a random one. Sessions will reset on every restart.');
  } else if (sessionSecret.length < 32) {
    problems.push('SESSION_SECRET must be at least 32 characters.');
  }

  const googleClientId = env.GOOGLE_CLIENT_ID || '';
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET || '';
  if (!googleClientId || !googleClientSecret) problems.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required (see SETUP-AUTH.md).');

  // Google endpoints can only be overridden outside production (used by the automated tests).
  const g = {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  };
  if (!isProd && env.GOOGLE_TEST_ISSUER_BASE) {
    const b = env.GOOGLE_TEST_ISSUER_BASE.replace(/\/+$/, '');
    g.authUrl = b + '/authorize'; g.tokenUrl = b + '/token'; g.jwksUrl = b + '/jwks'; g.issuers = [b];
  }

  if (problems.length) {
    console.error('\nConfiguration problems:\n - ' + problems.join('\n - ') + '\n');
    if (!env.ALLOW_START_WITHOUT_GOOGLE || isProd) process.exit(1);
  }

  return {
    isProd, port, baseUrl,
    sessionSecret,
    google: { clientId: googleClientId, clientSecret: googleClientSecret, ...g },
    adminEmails: list(env.ADMIN_EMAILS),
    allowedDomains: list(env.ALLOWED_EMAIL_DOMAINS),
    databaseUrl: env.DATABASE_URL || '',
    databaseAuthToken: env.DATABASE_AUTH_TOKEN || '',
    dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data')),
    sessionIdleMs: Number(env.SESSION_IDLE_HOURS || 8) * 3600e3,
    sessionMaxMs: Number(env.SESSION_MAX_DAYS || 7) * 86400e3,
    appRoot: path.resolve(__dirname, '..'),
  };
}
module.exports = { load };
