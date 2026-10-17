'use strict';

function makeUsers(db, cfg) {
  const isOwnerAdmin = (email) => cfg.adminEmails.includes(String(email).toLowerCase());
  // The role is ALWAYS recomputed from the server-side record; the browser never supplies it.
  const effectiveRole = (u) => (isOwnerAdmin(u.email) || u.role === 'admin' ? 'admin' : 'user');
  const publicUser = (u) => ({
    id: u.id, email: u.email, name: u.name, picture: u.picture,
    role: effectiveRole(u), ownerConfigured: isOwnerAdmin(u.email),
    createdAt: u.created_at, lastLogin: u.last_login,
  });
  const audit = (actor, event, detail = '') =>
    db.run('INSERT INTO audit_log (ts,actor,event,detail) VALUES (?,?,?,?)', [Date.now(), actor, event, String(detail).slice(0, 300)]).catch((e) => console.error('[audit]', e.message));

  return {
    audit, effectiveRole, isOwnerAdmin, publicUser,
    // New accounts are ALWAYS created as 'user'. The conflict branch never touches the role column.
    upsertFromGoogle: ({ sub, email, name, picture }) => db.get(
      `INSERT INTO users (google_sub,email,name,picture,role,created_at,last_login) VALUES (?,?,?,?, 'user', ?, ?)
       ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email, name=excluded.name, picture=excluded.picture, last_login=excluded.last_login
       RETURNING *`, [sub, email, name, picture, Date.now(), Date.now()]),
    byId: (id) => db.get('SELECT * FROM users WHERE id = ?', [id]),
    list: async () => (await db.all('SELECT * FROM users ORDER BY last_login DESC')).map(publicUser),
    recentAudit: () => db.all('SELECT ts, actor, event, detail FROM audit_log ORDER BY id DESC LIMIT 25'),
    adminCount: async () => (await db.all('SELECT * FROM users')).filter((u) => effectiveRole(u) === 'admin').length,
    setRole: async (id, role) => { await db.run('UPDATE users SET role=? WHERE id=?', [role, id]); return db.get('SELECT * FROM users WHERE id = ?', [id]); },
  };
}
module.exports = { makeUsers };
