'use strict';
const { load } = require('./config');
const { createApp } = require('./app');
(async () => {
  const cfg = load();
  const { app, db } = await createApp(cfg);
  if (cfg.isProd && db.url.startsWith('file:')) console.warn('[db] Using a local database file. On hosts with a temporary disk (e.g. Render free) reports are lost on restart - set DATABASE_URL to a free hosted database (see SETUP-AUTH.md).');
  app.listen(cfg.port, () => console.log(`AccessCampus running at ${cfg.baseUrl} (port ${cfg.port})`));
})().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
