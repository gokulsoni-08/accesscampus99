/* IIMA AccessCampus – app logic. No build step, no API keys. */
(function () {
'use strict';
const D = window.IIMA;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ac_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ac_' + k, JSON.stringify(v)); return true; } catch (e) { toast('Could not save – browser storage is full or blocked.'); return false; } }
};
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const fmtD = m => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2) + ' km';
const fmtT = s => s < 90 ? Math.round(s) + ' s' : Math.round(s / 60) + ' min';
const mapsUrl = ll => `https://maps.google.com/?q=${ll[0].toFixed(6)},${ll[1].toFixed(6)}`;
const stamp = () => new Date().toLocaleString();
const uid = p => p + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 36).toString(36);

/* ---------- state ---------- */
let verify = LS.get('verify', {}), pos = LS.get('pos', {}), added = LS.get('added', []), paths = LS.get('paths', []), reports = [];
let me = null, flt = 'all', fst = 'confirmed', fq = '', survey = false, picking = null, rec = null, watchId = null, lastLine = null, lastRoute = null;
const PL = Object.fromEntries(D.places.map(p => [p.id, p]));
const pll = id => pos[id] || (PL[id] && PL[id].ll) || null;
const placeName = id => (PL[id] ? PL[id].name : '');
function allFeatures() {
  /* Unconfirmed ('tbv') checklist items never get a position: IIMA has not said they exist. */
  return D.features.map(f => ({ ...f, ll: f.place && (f.status === 'official' || (verify[f.id] && verify[f.id].s === 'present')) ? pll(f.place) : null }))
    .concat(added.map(a => ({ ...a, status: 'user' })));
}
const effStatus = f => (verify[f.id] ? verify[f.id].s : f.status);
const tagCls = s => ({ official: 'ok', tbv: 'tbv', present: 'you', absent: 'no', user: 'tbv' }[s] || 'tbv');
const tagHtml = s => `<span class="tag ${tagCls(s)}">${esc(D.statusLabel[s])}</span>`;
const campusOf = f => (f.place && PL[f.place] ? PL[f.place].campus : null);

/* ---------- navigation (hash based so Android Back works) ---------- */
const SCREENS = ['home', 'map', 'route', 'features', 'tour', 'report', 'help', 'about'];
function show(id) {
  if (!SCREENS.includes(id)) id = 'home';
  $$('.scr').forEach(s => s.classList.toggle('on', s.id === 's-' + id));
  $$('.bnav button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  window.scrollTo(0, 0);
  if (id === 'map') { if (curTab === 'gps') { initMap(); setTimeout(() => { if (map) map.invalidateSize(); }, 60); } else offReset(); }
  if (id !== 'map' && !rec) { stopWatch(); gpsWanted = false; }
  if (id === 'route') fillRoute();
  if (id === 'features') renderFeatures();
  if (id === 'home') renderStats();
  if (id === 'report') renderReports();
}
function go(id) { if (location.hash.slice(1) === id) show(id); else location.hash = id; }
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); closeSheet(); go(g.dataset.go); } });

/* ---------- settings ---------- */
const root = document.documentElement; let fs = LS.get('fs', 17);
root.style.fontSize = fs + 'px'; if (LS.get('hc', false)) root.dataset.hc = '1';
$('#btnAup').onclick = () => { fs = Math.min(26, fs + 2); root.style.fontSize = fs + 'px'; LS.set('fs', fs); };
$('#btnAdown').onclick = () => { fs = Math.max(14, fs - 2); root.style.fontSize = fs + 'px'; LS.set('fs', fs); };
$('#btnHC').onclick = () => { const on = root.dataset.hc !== '1'; root.dataset.hc = on ? '1' : '0'; $('#btnHC').setAttribute('aria-pressed', on); LS.set('hc', on); };
$('#btnHC').setAttribute('aria-pressed', root.dataset.hc === '1');
$$('a[data-link]').forEach(a => { a.href = D.links[a.dataset.link]; });
$('#tOpen').href = D.links.tour; $('#hSec').href = D.links.security;

/* ---------- photos with honest fallback ---------- */
function mkFig(item, cap, link) {
  const srcs = typeof item === 'string' ? [[item, 'live']] : [item.file && [item.file, 'local'], item.u && [item.u, 'live']].filter(Boolean);
  const f = document.createElement('figure'), i = new Image(); let k = 0;
  i.alt = cap || 'Official IIMA photo'; i.referrerPolicy = 'no-referrer'; i.loading = 'lazy';
  const unavailable = () => { f.innerHTML = `<div class="imgfb" role="img" aria-label="${esc(cap)} – photo unavailable"><b>Photo unavailable</b><br>${esc(cap)}<br><small>Not stored in this app and could not be loaded live. Run tools/fetch_assets.py once, or <a href="${esc(link || D.links.campus)}" target="_blank" rel="noopener">open it on iima.ac.in</a>.</small></div>`; f.dataset.state = 'unavailable'; };
  const next = () => { if (k >= srcs.length) { unavailable(); return; } const [src, kind] = srcs[k++]; f.dataset.kind = kind; i.src = src; };
  i.onerror = next;
  i.onload = () => { f.dataset.state = 'ok'; if (f.querySelector('figcaption')) return; const c = document.createElement('figcaption'); c.textContent = (cap ? cap + ' · ' : '') + (f.dataset.kind === 'local' ? '✔ stored in this app (source: iima.ac.in)' : 'live from iima.ac.in – not stored locally'); f.appendChild(c); };
  next(); f.insertBefore(i, f.firstChild);
  return f;
}
$('#hero').appendChild(mkFig(D.photos[0], D.photos[0].cap, D.links.campus));
(function gallery() {
  const g = {}; D.photos.forEach(p => { (g[p.sec] = g[p.sec] || []).push(p); });
  $('#gal').innerHTML = '';
  Object.keys(g).forEach(sec => {
    const h = document.createElement('h3'); h.className = 'secH'; h.textContent = sec; $('#gal').appendChild(h);
    const row = document.createElement('div'); row.className = 'galrow';
    g[sec].forEach(p => row.appendChild(mkFig(p, p.cap, D.links[p.page] || D.links.campus)));
    $('#gal').appendChild(row);
  });
})();
$('#tFrame').src = D.links.tour;

/* ---------- stats ---------- */
function renderStats() {
  const fs_ = allFeatures(), c = s => fs_.filter(f => effStatus(f) === s).length;
  $('#stats').innerHTML = [['✅', c('official'), 'official statements'], ['⚠️', c('tbv') + c('user'), 'to verify'], ['🔵', c('present'), 'confirmed by you'], ['📷', reports.length, 'my reports'], ['🟢', paths.length, 'recorded paths']]
    .map(x => `<span class="chip s">${x[0]} ${x[1]} ${x[2]}</span>`).join('');
}

/* ---------- bottom sheet ---------- */
function openSheet(html) { $('#shBody').innerHTML = html; $('#sheet').hidden = false; $('#shClose').focus(); }
function closeSheet() { $('#sheet').hidden = true; }
$('#shClose').onclick = closeSheet;
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ---------- GPS ---------- */
let gpsWanted = false;
function gpsErr(e) { return e && e.code === 1 ? 'Location permission was denied. Allow it in your browser settings.' : e && e.code === 3 ? 'Location timed out. Move to open sky and try again.' : 'Could not read your location.'; }
function setMe(p) { me = { ll: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy, t: Date.now() }; drawMe(); gpsInfo(); }
function locate(cb) {
  if (!navigator.geolocation) { toast('GPS is not available in this browser.'); return; }
  navigator.geolocation.getCurrentPosition(p => { setMe(p); if (cb) cb(me); }, e => toast(gpsErr(e)), { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 });
}
function startWatch() {
  if (watchId != null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(p => { setMe(p); if (rec) addRecPt(p); }, e => toast(gpsErr(e)), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}
function stopWatch() { if (watchId != null && navigator.geolocation) { navigator.geolocation.clearWatch(watchId); } watchId = null; }
function gpsInfo() {
  const b = $('#gpsInfo'); if (!me) { b.hidden = true; return; }
  const far = hav(me.ll, D.centre);
  b.hidden = false;
  b.innerHTML = `<b>Your position</b><br>${me.ll[0].toFixed(5)}, ${me.ll[1].toFixed(5)} · accuracy ±${Math.round(me.acc)} m<br>` +
    (far > 2000 ? `<span class="tag tbv">You appear to be ${fmtD(far)} from the IIMA campus</span>` : `About ${fmtD(far)} from the campus centre (approximate).`);
}

/* ---------- map ---------- */
let mapFbWant = false, map, osm, sat, gMarkers, gRoute, gPaths, gMe, satOn = false, tileErr = 0, tileOk = 0;
function mapFb(on) {
  mapFbWant = on; const b = $('#mapfb'); if (!b) return; b.hidden = !on || m3on;
  if (on && !$('#mapfbImgs').children.length) D.maps.forEach(m => $('#mapfbImgs').appendChild(mkFig(m, 'Official campus map – ' + m.cap, D.links.map)));
}
function initMap() {
  if (map) return;
  if (!window.L) { mapFb(true); return; }
  try {
    map = L.map('map', { zoomControl: true, tap: true }).setView(D.centre, 16);
    osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' });
    [osm, sat].forEach(l => { l.on('tileerror', () => { tileErr++; if (tileErr >= 4 && !tileOk) mapFb(true); }); l.on('tileload', () => { tileOk++; mapFb(false); }); });
    osm.addTo(map);
    gMarkers = L.layerGroup().addTo(map); gRoute = L.layerGroup().addTo(map); gPaths = L.layerGroup().addTo(map); gMe = L.layerGroup().addTo(map);
    map.on('click', e => { if (picking) { const fn = picking; picking = null; $('#mapPick').hidden = true; fn([e.latlng.lat, e.latlng.lng]); } });
    drawMarkers(); drawPaths(); drawMe();
    if (!navigator.onLine) mapFb(true);
  } catch (e) { map = null; mapFb(true); }
}
const icon = (cls, html) => L.divIcon({ className: '', html: `<div class="mk ${cls}" style="width:38px;height:38px">${html}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
function markerSpecs() {
  const out = [], feats = allFeatures().filter(f => f.ll && (flt === 'all' || f.type === flt));
  const grp = {}; feats.forEach(f => { (grp[f.place || f.id] = grp[f.place || f.id] || []).push(f); });
  Object.values(grp).forEach(arr => arr.forEach((f, i) => {
    const es = effStatus(f), ll = [f.ll[0], f.ll[1] + (i - (arr.length - 1) / 2) * 0.00009];
    const cls = es === 'official' ? '' : es === 'present' ? 'present' : es === 'absent' ? 'absent' : 'tbv';
    const draggable = survey && !f.place;
    out.push({ ll, cls, ico: D.types[f.type][0], title: f.name, open: () => openFeature(f.id), draggable, z: 0,
      drag: draggable ? p => { const a = added.find(x => x.id === f.id); if (a) { a.ll = p; LS.set('added', added); toast('Position saved on this device'); } } : null });
  }));
  if (flt === 'all' || flt === 'place') D.places.forEach(p => {
    const ll = pll(p.id); if (!ll) return;
    out.push({ ll, cls: 'place', ico: '🏛', title: p.name + ' (approximate position)', open: () => openPlace(p.id), draggable: survey, z: -100,
      drag: q => { pos[p.id] = q; LS.set('pos', pos); drawMarkers(); toast(p.name + ': position saved on this device'); } });
  });
  return out;
}
function drawMarkers() {
  if (map) {
    gMarkers.clearLayers();
    markerSpecs().forEach(sp => {
      const m = L.marker(sp.ll, { icon: icon(sp.cls, sp.ico), title: sp.title, alt: sp.title, keyboard: true, draggable: sp.draggable, zIndexOffset: sp.z });
      m.on('click', sp.open);
      if (sp.draggable) m.on('dragend', ev => { const q = ev.target.getLatLng(); sp.drag([q.lat, q.lng]); });
      m.addTo(gMarkers);
    });
  }
  draw3dMarkers();
}
function drawMe() {
  if (map) {
    gMe.clearLayers();
    if (me) {
      L.circle(me.ll, { radius: me.acc, color: '#1a73e8', weight: 1, fillOpacity: .12 }).addTo(gMe);
      L.marker(me.ll, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: 'You are here', alt: 'Your location' }).addTo(gMe);
    }
  }
  draw3dMe();
}
function drawPaths() {
  if (!map) { sync3dLines(); return; } gPaths.clearLayers();
  paths.forEach(p => L.polyline(p.pts, { color: '#0a8f64', weight: 6, opacity: .9 }).bindTooltip(esc(p.name) + ' – recorded by you, not verified by IIMA').addTo(gPaths));
  if (rec && rec.pts.length > 1) L.polyline(rec.pts, { color: '#e91e63', weight: 5, dashArray: '2 8' }).addTo(gPaths);
  sync3dLines();
}
function filters() {
  const types = ['all', 'ramp', 'lift', 'toilet', 'parking', 'entrance', 'pathway', 'signage', 'nearby', 'place'];
  const lab = t => t === 'all' ? 'All' : t === 'place' ? '🏛 Places' : D.types[t][0] + ' ' + D.types[t][1];
  const html = types.map(t => `<button class="chip" data-f="${t}" aria-pressed="${flt === t}">${lab(t)}</button>`).join('');
  $('#mFilters').innerHTML = html;
  $('#fFilters').innerHTML = types.filter(t => t !== 'place').map(t => `<button class="chip" data-f="${t}" aria-pressed="${flt === t}">${lab(t)}</button>`).join('');
  $('#fStatus').innerHTML = [['confirmed', 'Official & confirmed'], ['official', 'Official only'], ['tbv', 'To check on site'], ['mine', 'Mine'], ['all', 'Everything']].map(s => `<button class="chip" data-s="${s[0]}" aria-pressed="${fst === s[0]}">${s[1]}</button>`).join('');
}
['#mFilters', '#fFilters'].forEach(sel => $(sel).addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; flt = b.dataset.f; filters(); drawMarkers(); renderFeatures(); }));
$('#fStatus').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; fst = b.dataset.s; filters(); renderFeatures(); });
$('#mLocate').onclick = () => { initMap(); gpsWanted = true; locate(m => focusMap(m.ll, 17, true)); startWatch(); };
$('#mSat').onclick = () => { initMap(); if (!map) return; satOn = !satOn; if (satOn) { map.removeLayer(osm); sat.addTo(map); } else { map.removeLayer(sat); osm.addTo(map); } $('#mSat').setAttribute('aria-pressed', satOn); if (m3) m3.setStyle(style3d()); };
$('#m3d').onclick = () => set3d(!m3on);
$('#mSurvey').onclick = () => { survey = !survey; $('#mSurvey').setAttribute('aria-pressed', survey); drawMarkers(); toast(survey ? 'Survey mode: drag a marker to its true position' : 'Survey mode off'); };
$('#mFit').onclick = () => { initMap(); focusMap(D.centre, 16); };
$('#mRetry').onclick = () => { tileErr = 0; tileOk = 0; mapFb(false); if (map) { map.eachLayer(l => l.redraw && l.redraw()); } };
function pickOnMap(msg, fn) { picking = fn; $('#mapPick').textContent = msg; $('#mapPick').hidden = false; go('map'); setTab('gps'); }

/* ---------- 3D view (MapLibre) – shares markers, route, paths and your location with the 2D map ---------- */
let m3 = null, m3on = false, m3mk = [], m3me = null, m3err = 0;
const SAT_STYLE = { version: 8, sources: { sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri' } }, layers: [{ id: 'sat', type: 'raster', source: 'sat' }] };
const style3d = () => (satOn ? SAT_STYLE : (window.__AC_STYLE3D || D.style3d));
const lngLat = ll => [ll[1], ll[0]];
function fb3(on) { $('#map3dfb').hidden = !on; }
function mkEl(cls, html, title, open) {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'mk ' + cls + ' mk3'; el.innerHTML = html; el.title = title; el.setAttribute('aria-label', title);
  if (open) el.addEventListener('click', ev => { ev.stopPropagation(); open(); }); return el;
}
function init3d() {
  if (m3) return true;
  if (!window.maplibregl) { fb3(true); return false; }
  try {
    const c = map ? map.getCenter() : { lat: D.centre[0], lng: D.centre[1] };
    m3 = new maplibregl.Map({ container: 'map3d', style: style3d(), center: [c.lng, c.lat], zoom: map ? Math.max(15, map.getZoom()) : 17, pitch: 60, bearing: -20, maxPitch: 80, attributionControl: { compact: true } });
    m3.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    m3.on('error', () => { m3err++; if (m3err >= 3 && !m3.isStyleLoaded()) fb3(true); });
    m3.on('load', () => fb3(false));
    m3.on('style.load', () => { fb3(false); sync3dLines(); });
    m3.on('click', e => { if (picking) { const fn = picking; picking = null; $('#mapPick').hidden = true; fn([e.lngLat.lat, e.lngLat.lng]); } });
    draw3dMarkers(); draw3dMe(); return true;
  } catch (e) { try { m3 && m3.remove(); } catch (x) { } m3 = null; fb3(true); return false; }
}
function draw3dMarkers() {
  if (!m3) return; m3mk.forEach(m => m.remove()); m3mk = [];
  markerSpecs().forEach(sp => {
    const mk = new maplibregl.Marker({ element: mkEl(sp.cls, sp.ico, sp.title, sp.open), draggable: sp.draggable }).setLngLat(lngLat(sp.ll)).addTo(m3);
    if (sp.draggable) mk.on('dragend', () => { const q = mk.getLngLat(); sp.drag([q.lat, q.lng]); });
    m3mk.push(mk);
  });
}
function draw3dMe() {
  if (!m3) return; if (m3me) { m3me.remove(); m3me = null; } if (!me) return;
  const el = document.createElement('div'); el.className = 'me'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Your location'); el.title = 'You are here';
  m3me = new maplibregl.Marker({ element: el }).setLngLat(lngLat(me.ll)).addTo(m3);
}
function sync3dLines() {
  if (!m3 || !m3.isStyleLoaded()) { if (m3) m3.once('idle', sync3dLines); return; }
  const feats = [];
  if (lastLine && lastLine.length > 1) feats.push({ type: 'Feature', properties: { k: 'route' }, geometry: { type: 'LineString', coordinates: lastLine.map(lngLat) } });
  paths.forEach(p => { if (p.pts.length > 1) feats.push({ type: 'Feature', properties: { k: 'path' }, geometry: { type: 'LineString', coordinates: p.pts.map(lngLat) } }); });
  if (rec && rec.pts.length > 1) feats.push({ type: 'Feature', properties: { k: 'rec' }, geometry: { type: 'LineString', coordinates: rec.pts.map(lngLat) } });
  const data = { type: 'FeatureCollection', features: feats };
  try {
    if (m3.getSource('ov')) m3.getSource('ov').setData(data);
    else {
      m3.addSource('ov', { type: 'geojson', data });
      m3.addLayer({ id: 'ov-path', type: 'line', source: 'ov', filter: ['==', ['get', 'k'], 'path'], paint: { 'line-color': '#0a8f64', 'line-width': 6 } });
      m3.addLayer({ id: 'ov-rec', type: 'line', source: 'ov', filter: ['==', ['get', 'k'], 'rec'], paint: { 'line-color': '#e91e63', 'line-width': 5, 'line-dasharray': [1, 2] } });
      m3.addLayer({ id: 'ov-route', type: 'line', source: 'ov', filter: ['==', ['get', 'k'], 'route'], paint: { 'line-color': '#d98200', 'line-width': 7, 'line-dasharray': [2, 1.5] } });
    }
  } catch (e) { /* style not ready – retried on style.load */ }
}
function set3d(on) {
  if (on && !init3d()) { m3on = false; $('#m3d').setAttribute('aria-pressed', false); toast('3D view needs its library and an internet connection'); return; }
  const c = on ? (map ? map.getCenter() : null) : (m3 ? m3.getCenter() : null);
  m3on = on; $('#m3d').setAttribute('aria-pressed', on); $('#mapfb').hidden = on || !mapFbWant;
  $('#map3d').hidden = !on; $('#map').hidden = on;
  if (on) { if (c) m3.jumpTo({ center: [c.lng, c.lat] }); setTimeout(() => m3.resize(), 30); }
  else if (map && c) { map.setView([c.lat, c.lng], map.getZoom()); setTimeout(() => map.invalidateSize(), 30); }
}
function focusMap(ll, z, keepZoom) {
  if (m3on && m3) m3.easeTo({ center: lngLat(ll), zoom: Math.max(z, keepZoom ? m3.getZoom() : 0), duration: 500 });
  else if (map) map.setView(ll, keepZoom ? Math.max(map.getZoom(), z) : z);
}
function fitMap(pts) {
  if (!pts || !pts.length) return;
  if (m3on && m3) { const b = new maplibregl.LngLatBounds(); pts.forEach(p => b.extend(lngLat(p))); m3.fitBounds(b, { padding: 60, duration: 500 }); }
  else if (map) map.fitBounds(L.latLngBounds(pts).pad(0.2));
}

/* ---------- official 2D map viewer (IIMA's own map images) ---------- */
let mapPins = LS.get('mapPins', {}), offSide = 0, pinMode = null, curTab = 'off', view = { x: 0, y: 0, s: 1 };
const OV = $('#offView'), ST = $('#offStage'), IMG = $('#offImg');
function setTab(t) {
  curTab = t; $('#tabOff').setAttribute('aria-pressed', t === 'off'); $('#tabGps').setAttribute('aria-pressed', t === 'gps');
  $('#pOff').hidden = t !== 'off'; $('#pGps').hidden = t !== 'gps';
  if (t === 'gps') { initMap(); setTimeout(() => { if (map) map.invalidateSize(); }, 60); } else offReset();
}
$('#tabOff').onclick = () => setTab('off'); $('#tabGps').onclick = () => setTab('gps');
function applyView() { ST.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.s})`; ST.style.setProperty('--inv', String(1 / view.s)); }
function clampView() {
  const W = OV.clientWidth, H = OV.clientHeight, w = ST.offsetWidth * view.s, h = ST.offsetHeight * view.s;
  if (!(W > 0 && w > 0)) return;
  view.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, view.x)); view.y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, view.y));
}
function offReset() { view = { x: 0, y: 0, s: 1 }; clampView(); applyView(); }
function zoomAt(cx, cy, f) {
  const s2 = Math.min(6, Math.max(1, view.s * f)), r = OV.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, k = s2 / view.s;
  view.x = px - (px - view.x) * k; view.y = py - (py - view.y) * k; view.s = s2; clampView(); applyView();
}
const ctr = () => { const r = OV.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
$('#offIn').onclick = () => zoomAt(...ctr(), 1.5); $('#offOut').onclick = () => zoomAt(...ctr(), 1 / 1.5); $('#offReset').onclick = offReset;
const ptrs = new Map(); let lastD = 0, moved = 0, tapT = 0;
const d2 = () => { const v = [...ptrs.values()]; return Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); };
OV.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 1) { moved = 0; tapT = Date.now(); } if (ptrs.size === 2) lastD = d2(); });
OV.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), n = [e.clientX, e.clientY]; ptrs.set(e.pointerId, n);
  if (ptrs.size === 1) { view.x += n[0] - p[0]; view.y += n[1] - p[1]; moved += Math.abs(n[0] - p[0]) + Math.abs(n[1] - p[1]); clampView(); applyView(); }
  else if (ptrs.size === 2) { const d = d2(), v = [...ptrs.values()]; if (lastD) zoomAt((v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2, d / lastD); lastD = d; moved += 10; }
});
const endP = e => { const wasTap = ptrs.size === 1 && moved < 8 && Date.now() - tapT < 500 && e.type === 'pointerup'; ptrs.delete(e.pointerId); lastD = 0; if (wasTap) offTap(e); };
OV.addEventListener('pointerup', endP); OV.addEventListener('pointercancel', endP);
OV.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
function offTap(e) {
  if (!pinMode) return;
  const r = IMG.getBoundingClientRect(); if (!r.width || !r.height) return;
  const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100; if (x < 0 || x > 100 || y < 0 || y > 100) return;
  mapPins[pinMode] = { side: offSide, x: +x.toFixed(2), y: +y.toFixed(2), t: stamp() }; LS.set('mapPins', mapPins);
  pinMode = null; $('#offPick').hidden = true; drawPins(); renderPinNote(); toast('Pinned on the official map – your placement, not verified');
}
function pinMeta(k) { if (PL[k]) return { name: PL[k].name, icon: '🏛' }; const f = allFeatures().find(x => x.id === k); return f ? { name: f.name, icon: D.types[f.type][0] } : { name: k, icon: '📍' }; }
function drawPins() {
  $('#offPins').innerHTML = Object.entries(mapPins).filter(([k, p]) => p.side === offSide).map(([k, p]) => { const m = pinMeta(k);
    return `<button class="pin" data-pinkey="${esc(k)}" style="left:${p.x}%;top:${p.y}%" aria-label="${esc(m.name)} – your pin, not official">${m.icon}</button>`; }).join('');
}
function renderPinNote() { const n = Object.keys(mapPins).length; $('#offUnpin').disabled = !mapPins[$('#offItem').value]; $('#offPinBtn').textContent = '📌 Pin on this map' + (n ? ` (${n} pinned)` : ''); }
document.addEventListener('click', e => { const p = e.target.closest('[data-pinkey]'); if (!p || moved >= 8) return; const k = p.dataset.pinkey; if (PL[k]) openPlace(k); else openFeature(k); });
function startPin(key) {
  go('map'); setTab('off'); pinMode = key; const m = pinMeta(key);
  if ($('#offItem').querySelector(`[value="${key}"]`)) $('#offItem').value = key;
  $('#offPick').hidden = false; $('#offPick').textContent = `Tap the official map where "${m.name}" is…`; renderPinNote();
}
function offSideSet(i) {
  offSide = i; IMG.dataset.try = 'local'; IMG.src = D.maps[i].file; $('#offFull').href = D.maps[i].u; $('#offFbLink').href = D.maps[i].u; $('#offFb').hidden = true;
  $('#sideChips').innerHTML = D.maps.map((m, j) => `<button class="chip" data-side="${j}" aria-pressed="${j === i}">${esc(m.cap)}</button>`).join(''); drawPins(); offReset();
}
$('#sideChips').addEventListener('click', e => { const b = e.target.closest('[data-side]'); if (b) offSideSet(+b.dataset.side); });
IMG.addEventListener('error', () => { if (IMG.dataset.try === 'local') { IMG.dataset.try = 'live'; IMG.src = D.maps[offSide].u; } else { $('#offFb').hidden = false; $('#offSrc').textContent = 'Official map unavailable – not stored in this app and could not be loaded live.'; } });
IMG.addEventListener('load', () => { $('#offFb').hidden = true; $('#offSrc').textContent = IMG.dataset.try === 'local' ? '✔ Official IIMA campus map – stored in this app' : 'Official IIMA campus map – loaded live from iima.ac.in (not stored locally)'; offReset(); });
$('#offPage').href = D.links.map;
$('#offPinBtn').onclick = () => startPin($('#offItem').value);
$('#offUnpin').onclick = () => { delete mapPins[$('#offItem').value]; LS.set('mapPins', mapPins); drawPins(); renderPinNote(); };
$('#offItem').onchange = renderPinNote;
function offItems() { $('#offItem').innerHTML = '<optgroup label="Places">' + D.places.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('') + '</optgroup><optgroup label="Features">' + allFeatures().map(f => `<option value="${f.id}">${D.types[f.type][0]} ${esc(f.name)}</option>`).join('') + '</optgroup>'; }

/* ---------- places & features detail ---------- */
const campusLabel = c => c === 'Heritage' ? 'Main (heritage) campus' : c === 'New' ? 'West (new) campus' : c === 'Both' ? 'Between the two campuses' : 'Campus not stated';
function openPlace(id) {
  const p = PL[id], ll = pll(id), fl = allFeatures().filter(f => f.place === id), ph = D.photos.find(x => x.place === id);
  const list = fl.map(f => `<li><span class="ic">${D.types[f.type][0]}</span><span class="tx">${esc(f.name)}${tagHtml(effStatus(f))}</span><button class="btn alt" data-open="${f.id}">Details</button></li>`).join('') || '<li>No features listed for this place.</li>';
  openSheet(`<h2 id="shTitle">🏛 ${esc(p.name)}</h2><div id="shPh"></div>
  <p>${esc(campusLabel(p.campus))} · ${ll ? 'GPS-map position approximate' : 'not placed on the GPS map yet'}</p><p class="src">${esc(p.src)}</p>
  <ul class="lst">${list}</ul>
  <div class="row"><button class="btn" data-pin="${id}">📌 Pin on official map</button>${ll ? `<button class="btn alt" data-routeto="p:${id}">Route here</button>` : ''}<button class="btn alt" data-place="${id}">${ll ? 'Fix GPS-map position' : 'Place on GPS map'}</button></div>`);
  $('#shPh').appendChild(ph ? mkFig(ph, ph.cap + ' (official IIMA photo)', D.links[ph.page]) : Object.assign(document.createElement('p'), { className: 'src', textContent: '📷 Official IIMA photo of this place: unavailable.' }));
}
function openFeature(id) {
  const f = allFeatures().find(x => x.id === id); if (!f) return;
  const es = effStatus(f), v = verify[id], canVerify = es !== 'official';
  const where = f.ll ? `<button class="btn alt" data-routeto="f:${id}">Route here</button><button class="btn alt" data-showmap="${id}">Show on GPS map</button>` : (f.place ? `<button class="btn alt" data-place="${f.place}">Place ${esc(placeName(f.place))} on GPS map</button>` : '');
  openSheet(`<h2 id="shTitle">${D.types[f.type][0]} ${esc(f.name)}</h2>
  <p>${tagHtml(es)} <span class="tag you" style="margin-left:4px">${esc(D.types[f.type][1])}</span></p>
  ${f.place ? `<p>Near: <b>${esc(placeName(f.place))}</b>${f.ll ? ' (position approximate)' : ' (position not published)'}</p>` : ''}
  ${f.note ? `<p>${esc(f.note)}</p>` : ''}
  <p class="src">📷 Official IIMA photo: <b>unavailable</b> – IIMA publishes no photo of this facility. ${v && v.photo ? 'The photo below was taken by you (not from IIMA).' : 'You can attach your own on-site photo below.'}</p>
  ${es === 'tbv' ? '<p class="note warn">IIMA has <b>not</b> said this exists – it is only a checklist item. It has no map position until you confirm it on site.</p>' : ''}
  ${v && v.photo ? `<img class="prev" alt="Your own photo (not from IIMA)" src="${v.photo}">` : ''}${v ? `<p class="src">Your check: ${esc(D.statusLabel[v.s])} · ${esc(v.t)}</p>` : ''}
  ${canVerify ? `<label for="vPhoto">Photo of what you found (optional)</label><input type="file" id="vPhoto" accept="image/*">
  <div class="row"><button class="btn" data-verify="${id}|present">✔ It is here</button><button class="btn alt" data-verify="${id}|absent">✖ Not found</button>${v ? `<button class="btn alt" data-verify="${id}|clear">Undo my check</button>` : ''}</div>` : ''}
  <div class="row"><button class="btn" data-pin="${id}">📌 Pin on official map</button>${where}
  ${String(id).startsWith('u-') ? `<button class="btn alt" data-delfeat="${id}">Delete</button>` : ''}<button class="btn alt" data-speak="${esc(f.name)}. ${esc(D.statusLabel[es])}. ${esc(f.note || '')}">🔊 Read aloud</button></div>`);
}
let vPhoto = '';
document.addEventListener('change', async e => { if (e.target.id === 'vPhoto' && e.target.files[0]) { try { vPhoto = await readImage(e.target.files[0]); toast('Photo attached'); } catch (x) { toast('Could not read that image'); } } });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-open],[data-verify],[data-routeto],[data-showmap],[data-place],[data-delfeat],[data-speak],[data-pin]'); if (!t) return;
  const d = t.dataset;
  if (d.open) openFeature(d.open);
  else if (d.verify) { const [id, s] = d.verify.split('|'); if (s === 'clear') delete verify[id]; else verify[id] = { s, t: stamp(), photo: vPhoto || undefined }; vPhoto = ''; LS.set('verify', verify); drawMarkers(); renderFeatures(); renderStats(); openFeature(id); toast('Saved on this device'); }
  else if (d.routeto) { closeSheet(); go('route'); fillRoute(); $('#rTo').value = d.routeto; if (!me && $('#rFrom').value !== 'gps' && !$('#rFrom').value) $('#rFrom').value = 'gps'; entranceChips(); toast('Destination set – choose a start (entrance or GPS)'); }
  else if (d.showmap) { const f = allFeatures().find(x => x.id === d.showmap); closeSheet(); go('map'); setTab('gps'); setTimeout(() => { initMap(); if (f && f.ll) focusMap(f.ll, 18); }, 120); }
  else if (d.place) { closeSheet(); const id = d.place; pickOnMap('Tap the map where "' + placeName(id) + '" really is…', ll => { pos[id] = ll; LS.set('pos', pos); drawMarkers(); toast('Position saved on this device'); }); }
  else if (d.delfeat) { added = added.filter(a => a.id !== d.delfeat); LS.set('added', added); closeSheet(); drawMarkers(); renderFeatures(); renderStats(); }
  else if (d.speak) speak(d.speak);
  else if (d.pin) { closeSheet(); startPin(d.pin); }
});
function speak(t) { try { if (!window.speechSynthesis) { toast('Read-aloud is not supported here'); return; } speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch (e) { toast('Read-aloud is not supported here'); } }

/* ---------- features list ---------- */
const norm = x => String(x || '').toLowerCase();
const SYN = { ramp: 'ramp ramps railing step-free wheelchair', lift: 'lift lifts elevator elevators', toilet: 'toilet toilets washroom restroom wc accessible', parking: 'parking park car', entrance: 'entrance entry gate door', pathway: 'path pathway walkway', signage: 'sign signage low vision lighting contrast', nearby: 'nearby facility facilities' };
function matchQ(hay, q) { const h = norm(hay); return norm(q).split(/\s+/).filter(Boolean).every(w => h.includes(w)); }
function featOk(f) {
  const s = effStatus(f);
  if (!(fst === 'all' || (fst === 'confirmed' && s !== 'tbv' && s !== 'absent') || (fst === 'official' && s === 'official') || (fst === 'tbv' && s === 'tbv') || (fst === 'mine' && (s === 'present' || s === 'absent' || s === 'user')))) return false;
  if (!(flt === 'all' || f.type === flt)) return false;
  return !fq || matchQ([f.name, f.note, f.place ? placeName(f.place) : '', D.types[f.type][1], SYN[f.type], D.statusLabel[s]].join(' '), fq);
}
function renderFeatures() {
  let list = allFeatures().filter(f => f.type !== undefined && featOk(f));
  if (me) list.forEach(f => { f._d = f.ll ? hav(me.ll, f.ll) : Infinity; }), list.sort((a, b) => a._d - b._d);
  $('#fList').innerHTML = list.length ? list.map(f => `<li><span class="ic">${D.types[f.type][0]}</span><span class="tx"><b>${esc(f.name)}</b>${tagHtml(effStatus(f))}<small>${f.place ? esc(placeName(f.place)) : 'Campus-wide'}${f._d != null && f._d < Infinity ? ' · ' + fmtD(f._d) + ' away (approx.)' : ''}</small></span><button class="btn alt" style="min-height:48px;padding:6px 12px" data-open="${f.id}" aria-label="Details: ${esc(f.name)}">Details</button></li>`).join('')
    : `<li>${fst === 'confirmed' && flt !== 'all' && flt !== 'nearby' ? `No ${esc(D.types[flt][1].toLowerCase())} is confirmed yet. IIMA publishes no location list. Choose <b>To check on site</b> for things worth looking for, or add one you found.` : 'Nothing matches these filters.'}</li>`;
  const pl = fq ? D.places.filter(p => matchQ(p.name + ' ' + p.campus + ' ' + p.src, fq)) : [];
  $('#fPlaces').innerHTML = pl.length ? `<div class="card"><h2>Places</h2><ul class="lst">${pl.map(p => `<li><span class="ic">🏛</span><span class="tx">${esc(p.name)}<small>${esc(campusLabel(p.campus))}</small></span><button class="btn alt" style="min-height:48px;padding:6px 12px" data-openplace="${p.id}">Details</button></li>`).join('')}</ul></div>` : '';
}
$('#fSearch').addEventListener('input', e => { fq = e.target.value; renderFeatures(); });
$('#homeSearch').addEventListener('submit', e => { e.preventDefault(); fq = $('#hq').value.trim(); $('#fSearch').value = fq; flt = 'all'; fst = 'all'; filters(); go('features'); renderFeatures(); });
document.addEventListener('click', e => { const q = e.target.closest('[data-quick]'); if (q) { const t = q.dataset.quick; fq = ''; $('#fSearch').value = ''; fst = 'all'; flt = t === 'nearby' ? 'nearby' : t; filters(); go('features'); renderFeatures(); if (t === 'nearby') setTimeout(() => $('#nearCard').scrollIntoView(), 80); }
  const o = e.target.closest('[data-openplace]'); if (o) openPlace(o.dataset.openplace); });

/* ---------- nearby facilities & entrance selection ---------- */
const entrances = () => D.places.filter(p => p.entrance);
function nearRefs() { $('#nRef').innerHTML = '<option value="gps">📍 My GPS location</option>' + entrances().map(p => `<option value="p:${p.id}">🚪 ${esc(p.name)} (approx.)</option>`).join(''); }
async function showNearby() {
  const v = $('#nRef').value, R = +$('#nRad').value, out = $('#nOut');
  if (v === 'gps' && !me) { out.textContent = 'Reading your GPS location…'; locate(() => showNearby()); setTimeout(() => { if (!me) out.textContent = 'GPS unavailable. Allow location access, or measure from an entrance.'; }, 13000); return; }
  const a = resolve(v); if (!a || !a.ll) { out.textContent = 'That starting point has no position yet.'; return; }
  const all = allFeatures().filter(f => f.type !== undefined && (effStatus(f) !== 'tbv' && effStatus(f) !== 'absent'));
  const hit = all.filter(f => f.ll).map(f => ({ f, d: hav(a.ll, f.ll) })).filter(x => x.d <= R).sort((x, y) => x.d - y.d);
  const none = all.filter(f => !f.ll);
  out.innerHTML = `<p class="src">From <b>${esc(a.name)}</b>, within ${fmtD(R)}. Positions are approximate and unverified.</p>` +
    (hit.length ? `<ul class="lst">${hit.map(x => `<li><span class="ic">${D.types[x.f.type][0]}</span><span class="tx"><b>${esc(x.f.name)}</b>${tagHtml(effStatus(x.f))}<small>${fmtD(x.d)} away</small></span><button class="btn alt" style="min-height:46px" data-routeto="f:${x.f.id}">Route</button></li>`).join('')}</ul>` : '<p>No confirmed facility with a known position within that distance.</p>') +
    (none.length ? `<p class="src">${none.length} official facilities have <b>no published position</b> and cannot be measured: ${none.slice(0, 6).map(f => esc(f.name)).join('; ')}${none.length > 6 ? '…' : ''}.</p>` : '');
}
$('#nGo').onclick = showNearby;
function entranceChips() {
  $('#entr').innerHTML = entrances().map(p => `<button class="chip" data-entr="${p.id}" aria-pressed="${$('#rFrom').value === 'p:' + p.id}">🚪 ${esc(p.name)}</button>`).join('') + '<button class="chip" data-entr="gps" aria-pressed="' + ($('#rFrom').value === 'gps') + '">📍 I am here (GPS)</button>';
}
$('#entr').addEventListener('click', e => { const b = e.target.closest('[data-entr]'); if (!b) return; $('#rFrom').value = b.dataset.entr === 'gps' ? 'gps' : 'p:' + b.dataset.entr; entranceChips(); toast('Start set: ' + (b.dataset.entr === 'gps' ? 'my GPS location' : placeName(b.dataset.entr))); });
$('#rFrom').addEventListener('change', entranceChips);
$('#fAdd').onclick = () => openAdd();
let draft = { type: 'ramp', name: '', note: '', ll: null };
function openAdd() {
  openSheet(`<h2 id="shTitle">Add a feature I found</h2>
  <label for="aType">Type</label><select id="aType">${['ramp', 'lift', 'toilet', 'parking', 'entrance', 'pathway', 'signage', 'nearby'].map(t => `<option value="${t}" ${draft.type === t ? 'selected' : ''}>${D.types[t][0]} ${D.types[t][1]}</option>`).join('')}</select>
  <label for="aName">Name / short description</label><input type="text" id="aName" maxlength="80" value="${esc(draft.name)}" placeholder="e.g. Ramp at side entrance">
  <label for="aNote">Notes (optional)</label><textarea id="aNote" rows="2" maxlength="300">${esc(draft.note)}</textarea>
  <p id="aLl" class="src">${draft.ll ? 'Location set: ' + draft.ll.map(x => x.toFixed(5)).join(', ') : 'No location yet.'}</p>
  <div class="row"><button class="btn alt" id="aGps">📍 Use my GPS</button><button class="btn alt" id="aPick">🖱️ Pick on map</button></div>
  <div class="row"><button class="btn" id="aSave">Save (unverified)</button></div>`);
  const grab = () => { draft.type = $('#aType').value; draft.name = $('#aName').value; draft.note = $('#aNote').value; };
  $('#aGps').onclick = () => { grab(); locate(m => { draft.ll = m.ll; openAdd(); }); };
  $('#aPick').onclick = () => { grab(); closeSheet(); pickOnMap('Tap the map where the feature is…', ll => { draft.ll = ll; go('features'); openAdd(); }); };
  $('#aSave').onclick = () => {
    grab(); if (draft.name.trim().length < 3) { toast('Please give it a short name'); return; } if (!draft.ll) { toast('Set a location first'); return; }
    added.push({ id: uid('u-'), type: draft.type, name: draft.name.trim(), note: draft.note.trim(), ll: draft.ll, t: stamp() }); LS.set('added', added);
    draft = { type: 'ramp', name: '', note: '', ll: null }; closeSheet(); renderFeatures(); renderStats(); drawMarkers(); toast('Added – marked as unverified');
  };
}

/* ---------- routing ---------- */
function routeTargets() {
  const o = [`<option value="gps">📍 My GPS location</option>`, '<optgroup label="Places (approximate)">'];
  D.places.forEach(p => { if (pll(p.id)) o.push(`<option value="p:${p.id}">${esc(p.name)}</option>`); });
  o.push('</optgroup><optgroup label="Features">');
  allFeatures().filter(f => f.ll).forEach(f => o.push(`<option value="f:${f.id}">${D.types[f.type][0]} ${esc(f.name)}</option>`));
  o.push('</optgroup>'); return o.join('');
}
function fillRoute() {
  const a = $('#rFrom').value, b = $('#rTo').value, h = routeTargets();
  $('#rFrom').innerHTML = h; $('#rTo').innerHTML = h.replace('<option value="gps">📍 My GPS location</option>', '');
  $('#rFrom').value = a && $('#rFrom').querySelector(`[value="${a}"]`) ? a : 'gps';
  if (b && $('#rTo').querySelector(`[value="${b}"]`)) $('#rTo').value = b; else $('#rTo').value = 'p:library';
  entranceChips(); renderPaths();
}
function resolve(v) {
  if (v === 'gps') return me ? { ll: me.ll, name: 'My location', campus: null } : null;
  const [k, id] = [v.slice(0, 1), v.slice(2)];
  if (k === 'p') return { ll: pll(id), name: placeName(id), campus: PL[id].campus };
  const f = allFeatures().find(x => x.id === id); return f && f.ll ? { ll: f.ll, name: f.name, campus: campusOf(f) } : null;
}
const realCampus = c => c === 'Heritage' || c === 'New' ? c : null;
async function findRoute() {
  const fromV = $('#rFrom').value, toV = $('#rTo').value;
  if (fromV === 'gps' && !me) { $('#rOut').textContent = 'Reading your GPS location…'; locate(() => findRoute()); setTimeout(() => { if (!me) $('#rOut').textContent = 'GPS unavailable. Choose a place as the start instead.'; }, 13000); return; }
  const a = resolve(fromV), b = resolve(toV);
  if (!a || !b) { $('#rOut').textContent = 'Both ends need a position on the map.'; return; }
  if (fromV === toV || hav(a.ll, b.ll) < 8) { $('#rOut').textContent = 'Start and destination are the same place.'; return; }
  const under = pll('underpass'), cross = realCampus(a.campus) && realCampus(b.campus) && a.campus !== b.campus;
  const wps = cross && under ? [a.ll, under, b.ll] : [a.ll, b.ll];
  $('#rOut').innerHTML = '<span aria-live="polite">Finding a walking route…</span>';
  let line = null, dist = 0, dur = 0, src = 'osrm';
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch('https://router.project-osrm.org/route/v1/foot/' + wps.map(w => w[1].toFixed(6) + ',' + w[0].toFixed(6)).join(';') + '?overview=full&geometries=geojson', { signal: ctl.signal });
    clearTimeout(to); const j = await r.json();
    if (j.code !== 'Ok' || !j.routes[0]) throw new Error('no route');
    line = j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); dist = j.routes[0].distance; dur = j.routes[0].duration;
  } catch (e) { src = 'straight'; line = wps; for (let i = 1; i < wps.length; i++) dist += hav(wps[i - 1], wps[i]); dur = dist / 1.2; }
  initMap(); lastLine = line; if (map) { gRoute.clearLayers(); L.polyline(line, { color: '#d98200', weight: 7, dashArray: '10 10', opacity: .95 }).addTo(gRoute); } sync3dLines();
  const near = allFeatures().filter(f => f.ll && effStatus(f) !== 'absent' && line.some(p => hav(p, f.ll) < 70)).slice(0, 8);
  lastRoute = { a, b, dist, dur, src, cross };
  const steps = [`Start: <b>${esc(a.name)}</b>`, cross && under ? 'Go via the <b>underpass</b> – IIMA states that elevators serve it. Check the lift is working before you set off.' : '', `Arrive: <b>${esc(b.name)}</b>`].filter(Boolean);
  $('#rOut').innerHTML = `<h2>${src === 'osrm' ? 'Walking route' : 'Straight-line estimate'}</h2><p><b>${fmtD(dist)}</b> · about ${fmtT(dur)} on foot${src === 'straight' ? ' (routing service unreachable – this is a straight line, not a path)' : ''}</p>
  <ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>
  <p><span class="tag tbv">Step-free access NOT verified</span> The route does not know about steps. Compare it with the features below and with paths recorded by people who walked them.</p>
  ${near.length ? `<h3>Features near this route</h3><ul class="lst">${near.map(f => `<li><span class="ic">${D.types[f.type][0]}</span><span class="tx">${esc(f.name)}${tagHtml(effStatus(f))}</span><button class="btn alt" style="min-height:46px" data-open="${f.id}">Details</button></li>`).join('')}</ul>` : ''}
  <div class="row"><button class="btn" id="rShow">Show on map</button><button class="btn alt" id="rSpeak">🔊 Read aloud</button></div>`;
  $('#rShow').onclick = () => { go('map'); setTab('gps'); setTimeout(() => { initMap(); if (lastLine) fitMap(lastLine); }, 150); };
  $('#rSpeak').onclick = () => speak(`Walking route from ${a.name} to ${b.name}. ${fmtD(dist)}, about ${fmtT(dur)}. ${cross ? 'Go via the underpass, which IIMA says has elevators. ' : ''}Step-free access is not verified.`);
}
$('#rGo').onclick = findRoute;
$('#rSwap').onclick = () => { const a = $('#rFrom').value, b = $('#rTo').value; if (b && $('#rFrom').querySelector(`[value="${b}"]`)) $('#rFrom').value = b; if ($('#rTo').querySelector(`[value="${a}"]`)) $('#rTo').value = a; };

/* ---------- path recording ---------- */
function addRecPt(p) {
  if (p.coords.accuracy > 40) return; const ll = [p.coords.latitude, p.coords.longitude], last = rec.pts[rec.pts.length - 1];
  if (last && hav(last, ll) < 3) return; rec.pts.push(ll); if (last) rec.d += hav(last, ll);
  $('#pStat').textContent = `Recording… ${rec.pts.length} points · ${fmtD(rec.d)}`; drawPaths();
}
$('#pRec').onclick = () => {
  if (!navigator.geolocation) { toast('GPS is not available in this browser.'); return; }
  rec = { pts: [], d: 0, t0: stamp() }; startWatch(); $('#pRec').disabled = true; $('#pStop').disabled = false; $('#pStat').textContent = 'Recording… walk the step-free route slowly.';
};
$('#pStop').onclick = () => {
  const r = rec; rec = null; $('#pRec').disabled = false; $('#pStop').disabled = true; if (!gpsWanted) stopWatch();
  if (!r || r.pts.length < 2) { $('#pStat').textContent = 'Not enough GPS points to save a path.'; drawPaths(); return; }
  paths.push({ id: uid('p-'), name: 'Path ' + (paths.length + 1) + ' · ' + r.t0, pts: r.pts, d: r.d }); LS.set('paths', paths);
  $('#pStat').textContent = 'Saved on this device.'; drawPaths(); renderPaths(); renderStats();
};
function renderPaths() {
  $('#pList').innerHTML = paths.length ? paths.map(p => `<li><span class="ic">🟢</span><span class="tx">${esc(p.name)}<small>${fmtD(p.d)} · recorded by you, not verified by IIMA</small></span><button class="btn alt" style="min-height:46px" data-pshow="${p.id}">Show</button><button class="btn alt" style="min-height:46px" data-pdel="${p.id}" aria-label="Delete ${esc(p.name)}">🗑</button></li>`).join('') : '<li class="src">No recorded paths yet.</li>';
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-pshow]'), d = e.target.closest('[data-pdel]');
  if (s) { const p = paths.find(x => x.id === s.dataset.pshow); go('map'); setTab('gps'); setTimeout(() => { initMap(); if (p) fitMap(p.pts); }, 150); }
  if (d) { paths = paths.filter(x => x.id !== d.dataset.pdel); LS.set('paths', paths); drawPaths(); renderPaths(); renderStats(); }
});

/* ---------- photos ---------- */
function readImage(file, max = 900, q = 0.7) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', q)); };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad image')); }; im.src = u;
  });
}

/* ---------- reports ---------- */
let rpLL = null, rpPhoto = '';
function fillReport() {
  $('#rpCat').innerHTML = D.reportCats.map(c => `<option>${esc(c)}</option>`).join('');
  $('#rpLoc').innerHTML = '<option value="">– choose a place, or use GPS / map –</option>' + D.places.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
}
const rpSetLl = (ll, why) => { rpLL = ll; $('#rpLl').textContent = ll ? `${why}: ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}` : ''; };
$('#rpGps').onclick = () => { locate(m => { $('#rpLoc').value = ''; rpSetLl(m.ll, 'GPS'); }); };
$('#rpPick').onclick = () => pickOnMap('Tap the map where the problem is…', ll => { $('#rpLoc').value = ''; rpSetLl(ll, 'Map pin'); go('report'); });
$('#rpLoc').onchange = () => { const v = $('#rpLoc').value; if (v) { rpSetLl(pll(v), 'Place (approximate)'); if (!pll(v)) $('#rpLl').textContent = 'Place selected (no map position yet).'; } };
$('#rpPhoto').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { rpPhoto = await readImage(f); $('#rpPrev').src = rpPhoto; $('#rpPrev').hidden = false; } catch (x) { toast('Could not read that image'); } };
/* Reports are saved on the server. Users can submit and read their own; only admins change the status. */
const RP = { under_review: ['Under Review', 'Your report has been received and is being reviewed.'], in_progress: ['In Progress', 'An administrator is working on this.'], resolved: ['Resolved', 'This problem has been marked as resolved.'] };
let csrfTok = '', rpBusy = false;
async function api(path, opt = {}) {
  if (opt.method && opt.method !== 'GET' && !csrfTok) { const m = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' }); if (m.status === 401) { location.replace('/login'); throw new Error('signed out'); } csrfTok = (await m.json()).csrfToken; }
  const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'content-type': 'application/json', 'x-csrf-token': csrfTok, ...(opt.headers || {}) } });
  if (r.status === 401) { location.replace('/login'); throw new Error('signed out'); }
  if (r.status === 403) csrfTok = '';
  return r;
}
$('#rpSub').onclick = async () => {
  if (rpBusy) return;
  const desc = $('#rpDesc').value.trim(), place = $('#rpLoc').value;
  if (desc.length < 3) { toast('Please describe the problem'); return; }
  if (!place && !rpLL) { toast('Choose a place, use GPS, or pick on the map'); return; }
  rpBusy = true; $('#rpSub').disabled = true; $('#rpSub').textContent = 'Sending…';
  try {
    const res = await api('/api/reports', { method: 'POST', body: JSON.stringify({ category: $('#rpCat').value, placeId: place, lat: rpLL ? rpLL[0] : null, lng: rpLL ? rpLL[1] : null, description: desc, photo: rpPhoto || null }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast(data.message || 'Could not send the report. Please try again.'); return; }
    $('#rpDesc').value = ''; $('#rpPhoto').value = ''; $('#rpPrev').hidden = true; rpPhoto = ''; rpSetLl(null); $('#rpLoc').value = '';
    const done = $('#rpDone'); done.textContent = `Report ${data.report.ref} submitted. Status: Under Review.`; done.hidden = false;
    await renderReports(); renderStats(); toast('Report submitted – Under Review');
  } catch (x) { if (x.message !== 'signed out') toast('Could not reach the server. Your report was not sent – check your connection and try again.'); }
  finally { rpBusy = false; $('#rpSub').disabled = false; $('#rpSub').textContent = 'Submit report'; }
};
async function renderReports() {
  const box = $('#rpList');
  try {
    const res = await api('/api/reports'); if (!res.ok) throw new Error('bad');
    reports = (await res.json()).reports;
  } catch (x) { if (x.message === 'signed out') return; box.innerHTML = '<div class="card">Could not load your reports. Check your connection and open this screen again.</div>'; return; }
  box.innerHTML = reports.length ? reports.map(r => {
    const st = RP[r.status] || RP.under_review, idx = Object.keys(RP).indexOf(r.status);
    return `<div class="card"><div style="display:flex;gap:10px">${r.hasPhoto ? `<img class="thumb" src="/api/reports/${r.id}/photo" loading="lazy" alt="Photo for report ${esc(r.ref)}">` : ''}<div style="flex:1"><b>${esc(r.ref)} · ${esc(r.category)}</b><br>${esc(r.placeId ? placeName(r.placeId) : 'Map pin')}${r.lat != null ? ` · <a href="${mapsUrl([r.lat, r.lng])}" target="_blank" rel="noopener">view location</a>` : ''}<p style="margin:4px 0">${esc(r.description)}</p></div></div>
  <div class="steps" role="img" aria-label="Status: ${esc(st[0])}">${Object.values(RP).map((v, i) => `<span class="${i <= idx ? 'd' : ''}">${esc(v[0])}</span>`).join('')}</div>
  <div class="rline"><b>${esc(st[0])}</b> – ${esc(st[1])}<br>Submitted ${esc(new Date(r.createdAt).toLocaleString())}</div></div>`;
  }).join('') : '<div class="card">You have not sent any reports yet.</div>';
  renderStats();
}
function download(name, obj) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
$('#rpExport').onclick = () => { if (!reports.length) { toast('No reports to export'); return; } download('iima-accesscampus-reports.json', reports.map(r => ({ ...r, photo: r.photo ? '(photo omitted – share from the report card)' : '' }))); };

/* ---------- emergency ---------- */
function helpMsg() {
  let t = 'Help needed at IIM Ahmedabad.';
  if (me) { let best = null; D.places.forEach(p => { const l = pll(p.id); if (l) { const d = hav(me.ll, l); if (!best || d < best.d) best = { d, p }; } });
    t += ` My location: ${mapsUrl(me.ll)} (accuracy ±${Math.round(me.acc)} m).` + (best && best.d < 600 ? ` Closest named place (approximate): ${best.p.name}.` : ''); }
  else t += ' (Location not shared yet.)';
  return t;
}
function helpLinks() { const m = $('#hMsg').value; $('#hSms').href = 'sms:?&body=' + encodeURIComponent(m); $('#hWa').href = 'https://wa.me/?text=' + encodeURIComponent(m); }
function helpFill() { $('#hMsg').value = helpMsg(); $('#hGps').textContent = me ? `Location read: ${me.ll[0].toFixed(5)}, ${me.ll[1].toFixed(5)} (±${Math.round(me.acc)} m)` : 'Location not read yet.'; helpLinks(); }
$('#hLoc').onclick = () => { $('#hGps').textContent = 'Reading location…'; locate(helpFill); setTimeout(() => { if (!me) $('#hGps').textContent = 'Location not available. You can still call 112 or 108.'; }, 13000); };
$('#hMsg').oninput = helpLinks;
$('#hShare').onclick = async () => { const t = $('#hMsg').value; try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast('Message copied'); } } catch (e) { if (e && e.name !== 'AbortError') toast('Could not share – use Copy'); } };
$('#hCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#hMsg').value); toast('Message copied'); } catch (e) { $('#hMsg').select(); toast('Select and copy the text'); } };
helpFill();

/* ---------- about / data ---------- */
$('#aExport').onclick = () => download('iima-accesscampus-my-data.json', { exported: stamp(), verify, movedPlaces: pos, officialMapPins: mapPins, addedFeatures: added, recordedPaths: paths, reports: reports.map(r => ({ ...r, photo: r.photo ? '(omitted)' : '' })) });
$('#aReset').onclick = () => { let ok = true; try { ok = confirm('Delete ALL AccessCampus data stored on this device (checks, paths, moved markers)? Submitted reports are kept on the server.'); } catch (e) { } if (!ok) return;
  ['verify', 'pos', 'added', 'paths', 'reports', 'mapPins'].forEach(k => { try { localStorage.removeItem('ac_' + k); } catch (e) { } }); verify = {}; pos = {}; added = []; paths = []; reports = []; mapPins = {};
  drawPins(); renderPinNote(); drawMarkers(); drawPaths(); renderReports(); renderStats(); renderFeatures(); renderPaths(); toast('Local data deleted'); };
$('#aPos').onclick = () => { pos = {}; LS.set('pos', pos); drawMarkers(); toast('Markers reset to approximate positions'); };

/* ---------- init ---------- */
nearRefs(); offItems(); offSideSet(0); renderPinNote(); filters(); fillReport(); renderReports(); renderPaths(); renderStats(); renderFeatures();
window.addEventListener('online', () => { if (map) { tileErr = 0; mapFb(false); } });
show(location.hash.slice(1) || 'home');
window.__AC = { show, allFeatures, effStatus, findRoute, hav, showNearby, set3d, get m3() { return m3; }, get map() { return map; } };
})();
