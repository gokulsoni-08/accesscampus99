'use strict';
const crypto = require('node:crypto');
const express = require('express');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const rateLimit = require('express-rate-limit');

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// Only same-site relative paths are accepted as a post-login destination (no open redirect).
function safeNext(v) {
  if (typeof v !== 'string' || v.length > 200) return '/';
  if (!/^\/[A-Za-z0-9_\-./?=&%]*$/.test(v)) return '/';
  if (v.startsWith('//') || v.includes('..')) return '/';
  if (v.startsWith('/auth/') || v.startsWith('/login')) return '/';
  return v;
}

function authRoutes({ cfg, users }) {
  const r = express.Router();
  const jwks = createRemoteJWKSet(new URL(cfg.google.jwksUrl));
  const redirectUri = () => cfg.baseUrl + '/auth/google/callback';
  const limiter = rateLimit({ windowMs: 15 * 60e3, limit: 60, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => res.redirect('/login?error=rate_limited') });

  const fail = (req, res, code, why) => {
    users.audit('anonymous', 'login_failed', why || code);
    // Drop any half-finished OAuth state, then show a friendly (non-reflective) message.
    if (req.session) { delete req.session.oauth; }
    res.redirect('/login?error=' + encodeURIComponent(code));
  };

  r.get('/auth/google', limiter, (req, res) => {
    const state = b64url(crypto.randomBytes(32));
    const nonce = b64url(crypto.randomBytes(32));
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    req.session.oauth = { state, nonce, verifier, next: safeNext(req.query.next), at: Date.now() };
    const u = new URL(cfg.google.authUrl);
    u.search = new URLSearchParams({
      client_id: cfg.google.clientId, redirect_uri: redirectUri(), response_type: 'code',
      scope: 'openid email profile', state, nonce,
      code_challenge: challenge, code_challenge_method: 'S256',
      prompt: 'select_account', access_type: 'online',
    }).toString();
    req.session.save(() => res.redirect(u.toString()));
  });

  r.get('/auth/google/callback', limiter, async (req, res) => {
    const o = req.session && req.session.oauth;
    if (req.query.error) return fail(req, res, 'cancelled', 'google_error:' + String(req.query.error).slice(0, 40));
    if (!o || Date.now() - o.at > 10 * 60e3) return fail(req, res, 'expired', 'no_oauth_state');
    const { code, state } = req.query;
    if (typeof code !== 'string' || typeof state !== 'string') return fail(req, res, 'failed', 'missing_params');
    const a = Buffer.from(state), b = Buffer.from(o.state);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail(req, res, 'failed', 'state_mismatch');
    delete req.session.oauth; // one-time use: replaying the callback fails

    let claims;
    try {
      const tr = await fetch(cfg.google.tokenUrl, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: cfg.google.clientId, client_secret: cfg.google.clientSecret,
          redirect_uri: redirectUri(), grant_type: 'authorization_code', code_verifier: o.verifier,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!tr.ok) return fail(req, res, 'failed', 'token_exchange_' + tr.status);
      const tok = await tr.json();
      ({ payload: claims } = await jwtVerify(tok.id_token, jwks, {
        issuer: cfg.google.issuers, audience: cfg.google.clientId, algorithms: ['RS256'], clockTolerance: 30,
      }));
    } catch (e) { return fail(req, res, 'failed', 'token_verify:' + (e.code || e.name)); }

    if (claims.nonce !== o.nonce) return fail(req, res, 'failed', 'nonce_mismatch');
    if (!claims.sub || !claims.email || claims.email_verified !== true) return fail(req, res, 'unverified', 'email_not_verified');
    const email = String(claims.email).toLowerCase();
    if (cfg.allowedDomains.length && !cfg.allowedDomains.includes(email.split('@')[1])) {
      return fail(req, res, 'domain', 'domain_blocked:' + email.split('@')[1]);
    }

    let user;
    try { user = await users.upsertFromGoogle({
      sub: String(claims.sub), email, name: String(claims.name || email.split('@')[0]).slice(0, 120),
      picture: /^https:\/\//.test(claims.picture || '') ? String(claims.picture).slice(0, 500) : '',
    }); } catch (e) { return fail(req, res, 'failed', 'db:' + e.message); }
    const next = o.next;
    // New session id on login prevents session fixation.
    req.session.regenerate((err) => {
      if (err) return fail(req, res, 'failed', 'regenerate');
      req.session.userId = user.id;
      req.session.createdAt = Date.now();
      req.session.csrf = b64url(crypto.randomBytes(32));
      users.audit(email, 'login', users.effectiveRole(user));
      req.session.save(() => res.redirect(next));
    });
  });

  return r;
}
module.exports = { authRoutes, safeNext };
