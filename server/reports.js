'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const rateLimit = require('express-rate-limit');

const STATUSES = ['under_review', 'in_progress', 'resolved'];
const MAX_PHOTO_CHARS = 450000; // ~330 KB image; the app already shrinks photos to 900px JPEG
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// The categories and place ids come from the SAME js/data.js the app uses, so the server validates against real data.
function loadCatalog(appRoot) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(appRoot, 'js', 'data.js'), 'utf8'), sandbox, { timeout: 2000 });
  const D = sandbox.window.IIMA;
  return { cats: new Set(D.reportCats), places: new Set(D.places.map((p) => p.id)) };
}

function makeReports(db, cfg) {
  const catalog = loadCatalog(cfg.appRoot);
  const shape = (r, withReporter) => ({
    id: Number(r.id), ref: 'R-' + r.id, category: r.category, placeId: r.place_id,
    lat: r.lat, lng: r.lng, description: r.description, status: r.status, hasPhoto: !!r.has_photo,
    createdAt: r.created_at, statusUpdatedAt: r.status_updated_at,
    ...(withReporter ? { reporter: { name: r.user_name, email: r.user_email }, statusUpdatedBy: r.status_updated_by } : {}),
  });
  const COLS = 'r.id, r.category, r.place_id, r.lat, r.lng, r.description, r.status, r.created_at, r.status_updated_at, r.status_updated_by, (r.photo IS NOT NULL) AS has_photo';

  function validate(b) {
    if (!b || typeof b !== 'object') return { error: 'Invalid request.' };
    const category = b.category, place = b.placeId == null ? '' : b.placeId;
    const description = typeof b.description === 'string' ? b.description.trim() : '';
    if (typeof category !== 'string' || !catalog.cats.has(category)) return { error: 'Choose a valid problem type.' };
    if (description.length < 3 || description.length > 600) return { error: 'Describe the problem in 3 to 600 characters.' };
    if (typeof place !== 'string' || (place && !catalog.places.has(place))) return { error: 'Choose a valid place.' };
    let lat = null, lng = null;
    if (b.lat != null || b.lng != null) {
      lat = Number(b.lat); lng = Number(b.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: 'Invalid location.' };
    }
    if (!place && lat == null) return { error: 'Choose a place, use GPS, or pick on the map.' };
    let photo = null;
    if (b.photo) {
      if (typeof b.photo !== 'string' || b.photo.length > MAX_PHOTO_CHARS || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.photo)) return { error: 'The photo must be a JPEG under about 300 KB.' };
      const head = Buffer.from(b.photo.slice(23, 23 + 8), 'base64');
      if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) return { error: 'The photo is not a valid JPEG.' };
      photo = b.photo;
    }
    return { value: { category, place, lat, lng, description, photo } };
  }

  return {
    STATUSES, validate,
    async create(userId, v) {
      const row = await db.get(
        'INSERT INTO reports (user_id,category,place_id,lat,lng,description,photo,status,created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id',
        [userId, v.category, v.place, v.lat, v.lng, v.description, v.photo, 'under_review', Date.now()]);
      return Number(row.id);
    },
    async mine(userId) { return (await db.all(`SELECT ${COLS} FROM reports r WHERE r.user_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 200`, [userId])).map((r) => shape(r, false)); },
    async all(status) {
      const where = status ? 'WHERE r.status = ?' : '';
      return (await db.all(`SELECT ${COLS}, u.name AS user_name, u.email AS user_email FROM reports r JOIN users u ON u.id = r.user_id ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT 500`, status ? [status] : [])).map((r) => shape(r, true));
    },
    byId: (id) => db.get('SELECT id, user_id, status FROM reports WHERE id = ?', [id]),
    photo: async (id) => (await db.get('SELECT user_id, photo FROM reports WHERE id = ?', [id])),
    async setStatus(id, status, by) {
      await db.run('UPDATE reports SET status=?, status_updated_at=?, status_updated_by=? WHERE id=?', [status, Date.now(), by, id]);
    },
  };
}

// Signed-in users: submit a report, read back ONLY their own. There is no edit or delete.
function userRoutes({ reports, guards }) {
  const r = express.Router();
  r.use(guards.requireAuth);
  const byUser = (req) => 'u' + req.user.id;
  const tooMany = (req, res) => res.status(429).json({ error: 'rate_limited', message: 'You have sent several reports recently. Please try again later.' });
  // 10 accepted reports per hour per user; rejected (invalid) requests do not use that quota ...
  const submitLimit = rateLimit({ windowMs: 60 * 60e3, limit: 10, skipFailedRequests: true, standardHeaders: true, legacyHeaders: false, keyGenerator: byUser, validate: false, handler: tooMany });
  // ... but total attempts are capped too, so invalid requests cannot be spammed.
  const attemptLimit = rateLimit({ windowMs: 60 * 60e3, limit: 60, standardHeaders: false, legacyHeaders: false, keyGenerator: (req) => 'a' + req.user.id, validate: false, handler: tooMany });

  r.get('/', wrap(async (req, res) => { res.set('Cache-Control', 'private, no-store').json({ reports: await reports.mine(req.user.id) }); }));

  r.post('/', guards.csrf, attemptLimit, submitLimit, express.json({ limit: '700kb' }), wrap(async (req, res) => {
    const { error, value } = reports.validate(req.body);
    if (error) return res.status(400).json({ error: 'invalid', message: error });
    const id = await reports.create(req.user.id, value);
    res.status(201).json({ report: (await reports.mine(req.user.id)).find((x) => x.id === id) });
  }));

  r.get('/:id/photo', wrap(async (req, res) => {
    const id = Number(req.params.id); const row = Number.isInteger(id) ? await reports.photo(id) : null;
    // Only the reporter or an admin may see a photo; everyone else gets the same "not found".
    if (!row || !row.photo || (Number(row.user_id) !== req.user.id && req.user.role !== 'admin')) return res.status(404).end();
    res.set({ 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'" });
    res.send(Buffer.from(row.photo.slice(23), 'base64'));
  }));
  return r;
}

// Admin-only (mounted under /api/admin, which already enforces role + CSRF).
function adminReportRoutes({ reports, users }, r) {
  r.get('/reports', wrap(async (req, res) => {
    const st = req.query.status;
    if (st !== undefined && !reports.STATUSES.includes(st)) return res.status(400).json({ error: 'bad_request' });
    res.json({ reports: await reports.all(st) });
  }));
  r.post('/reports/:id/status', wrap(async (req, res) => {
    const id = Number(req.params.id); const status = req.body && req.body.status;
    if (!Number.isInteger(id) || !reports.STATUSES.includes(status)) return res.status(400).json({ error: 'bad_request' });
    const row = await reports.byId(id); if (!row) return res.status(404).json({ error: 'not_found' });
    if (row.status !== status) {
      await reports.setStatus(id, status, req.user.email);
      users.audit(req.user.email, 'report_status', `R-${id}: ${row.status} -> ${status}`);
    }
    res.json({ report: (await reports.all()).find((x) => x.id === id) });
  }));
}
module.exports = { makeReports, userRoutes, adminReportRoutes, STATUSES };
