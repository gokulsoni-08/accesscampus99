'use strict';
const session = require('express-session');

class DbStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.timer = setInterval(() => this.db.run('DELETE FROM sessions WHERE expires < ?', [Date.now()]).catch(() => {}), 10 * 60e3);
    this.timer.unref();
  }
  get(sid, cb) {
    this.db.get('SELECT data, expires FROM sessions WHERE sid = ?', [sid]).then((row) => {
      if (!row || row.expires < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.data));
    }, cb);
  }
  set(sid, sess, cb) {
    this.db.run('INSERT INTO sessions (sid, data, expires) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data, expires=excluded.expires',
      [sid, JSON.stringify(sess), this._exp(sess)]).then(() => cb && cb(null), (e) => cb && cb(e));
  }
  destroy(sid, cb) { this.db.run('DELETE FROM sessions WHERE sid = ?', [sid]).then(() => cb && cb(null), (e) => cb && cb(e)); }
  touch(sid, sess, cb) { this.db.run('UPDATE sessions SET expires = ? WHERE sid = ?', [this._exp(sess), sid]).then(() => cb && cb(null), (e) => cb && cb(e)); }
  _exp(sess) { return sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 864e5; }
}
module.exports = { DbStore };
