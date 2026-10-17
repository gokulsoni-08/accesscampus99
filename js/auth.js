/* AccessCampus – account menu (session check, role badge, sign out). Does not touch app.js. */
(function () {
  'use strict';
  var btn = document.getElementById('btnAcct'), menu = document.getElementById('acctMenu');
  if (!btn || !menu) return;
  var csrf = '';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toLogin(code) { location.replace('/login' + (code ? '?notice=' + code : '')); }
  function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  function open() { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); var f = menu.querySelector('a,button'); if (f) f.focus(); }

  btn.addEventListener('click', function () { menu.hidden ? open() : close(); });
  document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });

  async function signOut(b) {
    b.disabled = true; b.textContent = 'Signing out…';
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'x-csrf-token': csrf } }); } catch (e) { /* fall through to login */ }
    toLogin('signed_out');
  }

  function paint(u) {
    btn.textContent = '';
    if (u.picture) { var img = el('img'); img.src = u.picture; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', function () { btn.textContent = (u.name || u.email).charAt(0).toUpperCase(); }); btn.appendChild(img); }
    else btn.textContent = (u.name || u.email).charAt(0).toUpperCase();
    btn.setAttribute('aria-label', 'Account menu for ' + (u.name || u.email));
    if (btn.parentNode) btn.parentNode.setAttribute('data-name', u.name || u.email); // shown as “Welcome <name>” by the header CSS
    menu.textContent = '';
    menu.appendChild(el('div', 'acct-name', u.name || u.email));
    menu.appendChild(el('div', 'acct-mail', u.email));
    menu.appendChild(el('span', 'acct-role ' + u.role, u.role === 'admin' ? 'Administrator' : 'User'));
    if (u.role === 'admin') { var a = el('a', 'acct-item', 'Admin panel'); a.href = '/admin'; menu.appendChild(a); }
    var out = el('button', 'acct-item', 'Sign out'); out.type = 'button'; out.addEventListener('click', function () { signOut(out); }); menu.appendChild(out);
    btn.hidden = false;
  }

  async function check() {
    try {
      var r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
      if (r.status === 401) return toLogin();
      if (!r.ok) return;
      var d = await r.json(); csrf = d.csrfToken; paint(d.user);
    } catch (e) { /* offline: the app keeps working, the server re-checks on the next load */ }
  }
  check();
  // Re-check when returning to the tab or restoring from the back/forward cache, so a signed-out page never lingers.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });
})();
