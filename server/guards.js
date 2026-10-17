'use strict';
const crypto = require('node:crypto');

function makeGuards({ cfg, users }) {
  // Attaches req.user from the server-side session; enforces absolute session lifetime.
  function loadUser(req, res, next) {
    req.user = null;
    const s = req.session;
    if (!s || !s.userId) return next();
    if (Date.now() - (s.createdAt || 0) > cfg.sessionMaxMs) return s.destroy(() => next());
    users.byId(s.userId).then((row) => {
      if (row) req.user = { ...users.publicUser(row), _row: row };
      else delete s.userId;
      next();
    }, next);
  }
  const wantsHtml = (req) => req.method === 'GET' && (req.accepts(['html', 'json']) === 'html') && !req.path.startsWith('/api/');

  function requireAuth(req, res, next) {
    if (req.user) { res.set('Cache-Control', 'private, no-store'); return next(); }
    if (wantsHtml(req)) {
      const nx = req.originalUrl && req.originalUrl !== '/' ? '?next=' + encodeURIComponent(req.originalUrl) : '';
      return res.redirect('/login' + nx);
    }
    res.status(401).json({ error: 'unauthenticated' });
  }
  function requireAdmin(req, res, next) {
    if (!req.user) return requireAuth(req, res, next);
    if (req.user.role !== 'admin') {
      users.audit(req.user.email, 'forbidden', req.method + ' ' + req.path);
      if (wantsHtml(req)) return res.status(403).type('html').send(forbiddenPage);
      return res.status(403).json({ error: 'forbidden' });
    }
    res.set('Cache-Control', 'private, no-store');
    next();
  }
  // CSRF: every state-changing request needs the per-session token AND a same-origin Origin header.
  function csrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== cfg.baseUrl) return res.status(403).json({ error: 'bad_origin' });
    const sent = req.get('x-csrf-token') || '';
    const want = (req.session && req.session.csrf) || '';
    const a = Buffer.from(sent), b = Buffer.from(want);
    if (!want || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'bad_csrf' });
    next();
  }
  return { loadUser, requireAuth, requireAdmin, csrf };
}

const forbiddenPage = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access denied</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5"><h1>Access denied</h1>
<p>This page is only for administrators. Your account has the <b>User</b> role.</p><p><a href="/">Back to AccessCampus</a></p></body></html>`;

module.exports = { makeGuards };
