'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { adminReportRoutes } = require('./reports');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function adminRoutes({ users, guards, reports }) {
  const r = express.Router();
  r.use(rateLimit({ windowMs: 15 * 60e3, limit: 200, standardHeaders: true, legacyHeaders: false }));
  r.use(guards.requireAdmin, guards.csrf, express.json({ limit: '2kb' }));

  r.get('/users', wrap(async (req, res) => res.json({ users: await users.list(), audit: await users.recentAudit() })));

  r.post('/users/:id/role', wrap(async (req, res) => {
    const id = Number(req.params.id);
    const role = req.body && req.body.role;
    if (!Number.isInteger(id) || !['user', 'admin'].includes(role)) return res.status(400).json({ error: 'bad_request' });
    const target = await users.byId(id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'cannot_change_own_role' });
    if (users.isOwnerAdmin(target.email)) return res.status(400).json({ error: 'owner_configured', message: 'This admin is set by the server owner (ADMIN_EMAILS).' });
    if (role === 'user' && users.effectiveRole(target) === 'admin' && (await users.adminCount()) <= 1) return res.status(400).json({ error: 'last_admin' });
    const updated = await users.setRole(id, role);
    users.audit(req.user.email, 'role_change', `${target.email} -> ${role}`);
    res.json({ user: users.publicUser(updated) });
  }));
  adminReportRoutes({ reports, users }, r);
  return r;
}
module.exports = { adminRoutes };
