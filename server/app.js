'use strict';
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { open } = require('./db');
const { DbStore } = require('./sessionStore');
const { makeUsers } = require('./users');
const { makeGuards } = require('./guards');
const { authRoutes } = require('./authRoutes');
const { adminRoutes } = require('./adminRoutes');
const { makeReports, userRoutes } = require('./reports');

async function createApp(cfg) {
  const db = await open(cfg);
  const users = makeUsers(db, cfg);
  const reports = makeReports(db, cfg);
  const guards = makeGuards({ cfg, users });
  const app = express();
  app.disable('x-powered-by');
  if (cfg.isProd || process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

  // Security headers. Referrer is kept for cross-origin so OpenStreetMap/Esri tiles keep working.
  app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
  const strictCsp = helmet.contentSecurityPolicy({ directives: {
    defaultSrc: ["'none'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
    connectSrc: ["'self'"], formAction: ["'self'"], baseUri: ["'none'"], frameAncestors: ["'none'"],
  } });

  const secureCookie = cfg.isProd || cfg.baseUrl.startsWith('https://');
  app.use(session({
    name: secureCookie ? '__Host-ac.sid' : 'ac.sid',
    secret: cfg.sessionSecret,
    store: new DbStore(db),
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: cfg.sessionIdleMs },
  }));
  app.use(guards.loadUser);

  const noStore = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
  const file = (...p) => path.join(cfg.appRoot, ...p);
  const staticOpts = { dotfiles: 'deny', index: false, redirect: false };

  /* ---------- public: login page + its assets ---------- */
  app.get('/login', noStore, strictCsp, (req, res) => {
    if (req.user) return res.redirect('/');
    res.sendFile(file('auth-public', 'login.html'));
  });
  app.use('/auth-assets', express.static(file('auth-public'), { ...staticOpts, setHeaders: (r) => r.set('Cache-Control', 'public, max-age=300') }));
  app.use(authRoutes({ cfg, users }));
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  /* ---------- session endpoints ---------- */
  app.get('/api/me', guards.requireAuth, (req, res) => {
    const { _row, ...u } = req.user;
    res.json({ user: u, csrfToken: req.session.csrf });
  });
  app.post('/auth/logout', rateLimit({ windowMs: 15 * 60e3, limit: 60 }), guards.csrf, (req, res) => {
    const email = req.user ? req.user.email : 'unknown';
    req.session.destroy(() => {
      users.audit(email, 'logout');
      res.clearCookie(secureCookie ? '__Host-ac.sid' : 'ac.sid', { path: '/', httpOnly: true, secure: secureCookie, sameSite: 'lax' });
      res.set('Cache-Control', 'no-store').json({ ok: true });
    });
  });

  /* ---------- reports: signed-in users submit and read their own ---------- */
  app.use('/api/reports', userRoutes({ reports, guards }));

  /* ---------- admin (role enforced on the server) ---------- */
  app.use('/api/admin', adminRoutes({ users, guards, reports }));
  app.get('/admin', guards.requireAdmin, strictCsp, (req, res) => res.sendFile(file('admin', 'admin.html')));
  app.use('/admin', guards.requireAdmin, express.static(file('admin'), { ...staticOpts, index: false }));

  /* ---------- the existing app: only whitelisted folders, only when signed in ---------- */
  const app_ = express.Router();
  app_.use(guards.requireAuth);
  app_.get(['/', '/index.html'], (req, res) => res.sendFile(file('index.html')));
  for (const dir of ['css', 'js', 'vendor', 'assets']) app_.use('/' + dir, express.static(file(dir), staticOpts));
  app.use(app_);

  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err && Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error('[error]', err && err.message);
    res.status(status).json({ error: status === 500 ? 'server_error' : status === 413 ? 'too_large' : 'invalid', message: status === 500 ? 'Something went wrong. Please try again.' : status === 413 ? 'That request is too large.' : 'Invalid request.' });
  });
  return { app, db, users, reports };
}
module.exports = { createApp };
