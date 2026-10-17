(function () {
  'use strict';
  var csrf = '';
  var meId = null;
  var status = document.getElementById('status');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function when(ms) { return ms ? new Date(ms).toLocaleString() : '–'; }

  async function api(path, opts) {
    var r = await fetch(path, Object.assign({ credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf } }, opts));
    if (r.status === 401) { location.href = '/login'; throw new Error('unauthenticated'); }
    var body = await r.json().catch(function () { return {}; });
    if (!r.ok) throw Object.assign(new Error(body.message || body.error || 'Request failed'), { code: body.error });
    return body;
  }

  function render(data) {
    var rows = document.getElementById('rows'); rows.textContent = '';
    data.users.forEach(function (u) {
      var tr = el('tr');
      var c1 = el('td'), box = el('div', 'u');
      if (u.picture) { var img = el('img', 'av'); img.src = u.picture; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.width = 36; img.height = 36; box.appendChild(img); }
      else box.appendChild(el('span', 'av', (u.name || u.email).charAt(0).toUpperCase()));
      var t = el('div'); t.appendChild(el('span', '', u.name || u.email)); t.appendChild(el('small', '', u.email)); box.appendChild(t); c1.appendChild(box);
      var c2 = el('td'); c2.appendChild(el('span', 'badge ' + u.role, u.role === 'admin' ? 'Admin' : 'User')); if (u.ownerConfigured) c2.appendChild(el('small', '', ' owner-configured'));
      var c3 = el('td', '', when(u.lastLogin));
      var c4 = el('td'); var b = el('button', '', u.role === 'admin' ? 'Remove admin' : 'Make admin');
      if (u.id === meId) { b.disabled = true; b.title = 'You cannot change your own role'; }
      else if (u.ownerConfigured) { b.disabled = true; b.title = 'Set by the server owner'; }
      else b.addEventListener('click', function () { change(u); });
      c4.appendChild(b); tr.append(c1, c2, c3, c4); rows.appendChild(tr);
    });
    var au = document.getElementById('audit'); au.textContent = '';
    data.audit.forEach(function (a) { au.appendChild(el('li', '', when(a.ts) + ' – ' + a.actor + ' – ' + a.event + (a.detail ? ' (' + a.detail + ')' : ''))); });
    document.getElementById('tbl').hidden = false;
    status.textContent = data.users.length + ' user' + (data.users.length === 1 ? '' : 's');
  }

  async function change(u) {
    var to = u.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm((to === 'admin' ? 'Give administrator access to ' : 'Remove administrator access from ') + u.email + '?')) return;
    try { await api('/api/admin/users/' + u.id + '/role', { method: 'POST', body: JSON.stringify({ role: to }) }); await load(); }
    catch (e) { status.textContent = e.message === 'last_admin' ? 'There must be at least one administrator.' : 'Could not change the role: ' + e.message; }
  }
  var STATUS = { under_review: 'Under Review', in_progress: 'In Progress', resolved: 'Resolved' };
  var PLACES = {}; ((window.IIMA && window.IIMA.places) || []).forEach(function (p) { PLACES[p.id] = p.name; });
  var rstatus = document.getElementById('rstatus');

  function renderReports(list) {
    var rows = document.getElementById('rrows'); rows.textContent = '';
    list.forEach(function (r) {
      var tr = el('tr');
      var c1 = el('td'); c1.appendChild(el('b', '', r.ref)); c1.appendChild(el('small', '', new Date(r.createdAt).toLocaleString()));
      var c2 = el('td', 'rd'); c2.appendChild(el('b', '', r.category));
      var where = r.placeId ? (PLACES[r.placeId] || r.placeId) : 'Map pin';
      var w = el('small', '', where); if (r.lat != null) { w.appendChild(document.createTextNode(' · ')); var a = el('a', '', 'location'); a.href = 'https://maps.google.com/?q=' + Number(r.lat).toFixed(6) + ',' + Number(r.lng).toFixed(6); a.target = '_blank'; a.rel = 'noopener'; w.appendChild(a); }
      c2.appendChild(w); c2.appendChild(el('p', '', r.description));
      if (r.hasPhoto) { var pa = el('a'); pa.href = '/api/reports/' + r.id + '/photo'; pa.target = '_blank'; pa.rel = 'noopener'; var im = el('img', 'thumb'); im.src = pa.href; im.alt = 'Photo for ' + r.ref; im.loading = 'lazy'; pa.appendChild(im); c2.appendChild(pa); }
      var c3 = el('td', 'rd'); c3.appendChild(el('span', '', r.reporter.name || r.reporter.email)); c3.appendChild(el('small', '', r.reporter.email));
      var c4 = el('td'); var sel = el('select'); sel.setAttribute('aria-label', 'Status of ' + r.ref);
      Object.keys(STATUS).forEach(function (k) { var o = el('option', '', STATUS[k]); o.value = k; if (k === r.status) o.selected = true; sel.appendChild(o); });
      var saved = el('span', 'saved'); saved.setAttribute('role', 'status');
      sel.addEventListener('change', async function () {
        var prev = r.status; sel.disabled = true; saved.textContent = '';
        try { var out = await api('/api/admin/reports/' + r.id + '/status', { method: 'POST', body: JSON.stringify({ status: sel.value }) }); r.status = out.report.status; saved.textContent = 'Saved'; }
        catch (e) { sel.value = prev; saved.textContent = ''; rstatus.textContent = 'Could not update ' + r.ref + ': ' + e.message; }
        sel.disabled = false;
      });
      c4.appendChild(sel); c4.appendChild(saved); tr.append(c1, c2, c3, c4); rows.appendChild(tr);
    });
    document.getElementById('rtbl').hidden = !list.length;
    rstatus.textContent = list.length ? list.length + ' report' + (list.length === 1 ? '' : 's') : 'No reports.';
  }
  async function loadReports() {
    var f = document.getElementById('rfilter').value;
    renderReports((await api('/api/admin/reports' + (f ? '?status=' + encodeURIComponent(f) : ''), { method: 'GET' })).reports);
  }
  document.getElementById('rfilter').addEventListener('change', function () { loadReports().catch(function () { rstatus.textContent = 'Could not load reports.'; }); });

  async function load() { render(await api('/api/admin/users', { method: 'GET' })); }

  (async function init() {
    try {
      var me = await (await fetch('/api/me', { credentials: 'same-origin' })).json();
      csrf = me.csrfToken; meId = me.user.id;
      await Promise.all([load(), loadReports()]);
    } catch (e) { status.textContent = 'Could not load users.'; }
  })();
})();
