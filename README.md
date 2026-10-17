# IIMA AccessCampus (student prototype – not an official IIMA app)

> **Sign-in (new):** the app now sits behind Google sign-in with User / Admin roles. Run it with `npm install && npm start` and follow **[SETUP-AUTH.md](SETUP-AUTH.md)**. Opening `index.html` directly or serving the folder with a plain static server no longer works – it must run through the Node server (`npm start`) so the login is enforced. The Windows `.bat` scripts only download assets; start the app with `npm start`.

## Windows setup (about 2 minutes)
1. **Unzip** the folder anywhere (e.g. Desktop). Do not run it from inside the zip.
2. **Double-click `SETUP-WINDOWS.bat`** (once, needs internet). It downloads the official IIMA photos and campus map from iima.ac.in into `assets\`, checks every file, and lists anything it could not get.
3. **Double-click `START-APP.bat`**. Your browser opens at `http://localhost:8000/`. Keep the black window open while you use the app; close it to stop.
4. Allow **location** when the browser asks (My location, nearby, emergency message).

No install is needed: both scripts use Python if you have it, otherwise the PowerShell that ships with Windows 10/11. Open the page in Chrome or Edge. Use the app on your phone: open `http://<your-PC-IP>:8000/` is *not* supported (GPS needs https); instead host the folder on GitHub Pages / Netlify (free, https).

> Even **before** step 2 the photos and map show if you are online: the app tries the stored file first, then loads the official image live from iima.ac.in (labelled "live – not stored locally"). If neither works the slot says **"Photo unavailable"**. Nothing is ever substituted or faked.

If you already downloaded the 16 files yourself, put them in these exact names (then skip step 2):
`assets/photos/` hero-campus, rjm-auditorium, academic-block-auditorium, jsw-auditorium, classroom-corridor, academic-block-ab1, administrative-building, student-housing-1, student-housing-2, imdc, faculty-housing, restoration, sustainability, solar (all `.jpg`) · `assets/map/` campus-map-front.jpg, campus-map-back.jpg.

## What works
| Feature | How |
|---|---|
| Real campus photo on home | `hero-campus.jpg` (IIMA Campus page) |
| Official campus map | IIMA's own front/back map images, pinch/drag/zoom, pins you place yourself |
| Interactive 2D map | Leaflet + OpenStreetMap, markers, filters |
| Satellite | Esri World Imagery tiles |
| **3D view** | MapLibre, tilted camera + OpenStreetMap 3D buildings. Same facility markers, route, recorded paths and your GPS dot as 2D |
| My location | Browser GPS (localhost / https only) |
| Search | Home + Features: text search over facilities and places |
| Ramps / lifts / toilets / parking | Quick buttons + filters |
| Entrance selection | Route screen: Main Gate, New Campus Gate, or GPS |
| Nearby facilities | From GPS or an entrance, radius 150 m–1 km |
| Route planning | OSRM foot routing; straight-line estimate if offline; underpass used between campuses |
| Report + photo + status | Saved on this device; Submitted → Acknowledged → In progress → Resolved (changed by hand) |
| Emergency | Call 112 / 108, location message by SMS / WhatsApp / share / copy |
| Official 360° tour | iima.ac.in/v-tour/ embedded, plus "open full-screen" button |

## Data honesty (what is verified and what is not)
* **Official** = stated on an iima.ac.in page (underpass elevators, ramps & railings, low-vision signage, dispensary, bank, post office, pharmacy, cafés, sports, library). IIMA publishes **no locations** for these.
* Ramps / lifts / toilets / parking *at named buildings* are **not** published by IIMA. They are kept only as a **checklist** ("To check on site"): hidden from the default list, **never given a map marker**, never counted as nearby. They become real entries only when you mark "It is here" on site.
* **No place coordinate is surveyed.** Only the campus centre (Wikipedia) is sourced; the other building/gate positions are approximate and labelled so. Use *Survey mode* (drag markers) or pin on the official map to correct them – saved on your device.
* No photo of a ramp/lift/toilet/parking exists on IIMA's site, so those show "Official IIMA photo: unavailable". You can attach your own photo (labelled "Your own photo").

## Needs verified campus data, internet, keys or a backend
| Needs | What |
|---|---|
| **Verified campus data (from IIMA / an on-site survey)** | Surveyed coordinates of gates, buildings, ramps, lifts, accessible toilets, accessible parking; which entrances are step-free; emergency / security phone numbers (none are invented – only 112 and 108); dispensary hours |
| **Internet** | First-time asset download; live photo fallback; OpenStreetMap / Esri / 3D tiles; OSRM routing; the 360° tour |
| **API keys** | **None.** OpenStreetMap tiles are for light use; for a public launch use your own tile provider (Esri imagery likewise). OpenFreeMap (3D) is keyless |
| **A backend** | Reports are **not** sent anywhere and status is **not** updated by IIMA – there is no server. Real tracking needs an IIMA-run report system/API. Use Share to send a report yourself |
| **IIMA permission** | The photos and map belong to IIMA – get permission before publishing the app publicly |
| **HTTPS hosting** | Needed for GPS on phones (GitHub Pages / Netlify are free) |

## Tests
* `npm i jsdom && node tests/test.js` – 109 checks (logic, labels, search, nearby, entrances, routing, reports, help, tour, fallbacks).
* `pip install playwright && playwright install chromium && python tests/e2e.py` – 34 checks in a real phone-size Chromium: Leaflet 2D, MapLibre 3D with synced markers/GPS, no horizontal scroll on any screen, no JavaScript errors. Network is blocked on purpose, so it tests the offline paths; the test uses throw-away fixture images in a temp copy, never in your assets.

## Files
`SETUP-WINDOWS.bat` · `START-APP.bat` · `index.html` · `css/` · `js/data.js` (all data) · `js/app.js` · `vendor/leaflet/` · `vendor/maplibre/` · `assets/` · `tools/` (fetch_assets.py / .ps1, serve.ps1, build_single.py) · `tests/`
Optional single offline file: `python tools/build_single.py` → `iima-accesscampus-single.html`.
