/* IIMA AccessCampus – data.
   STATUS MODEL
   official : stated on an official iima.ac.in page (the page does NOT give a precise location)
   tbv      : "to be verified" – plausible feature, NOT confirmed by IIMA; needs an on-site check
   Coordinates of places are APPROXIMATE (campus centre from Wikipedia 23.031661, 72.536325; the rest are
   rough offsets). Use Survey mode in the app to drag a marker onto its true position. */
window.IIMA = {
  centre: [23.031661, 72.536325],
  /* 3D view style (keyless, community-run vector tiles with OpenStreetMap 3D buildings). Needs internet.
     IIMA publishes no 3D model, so building shapes come from OpenStreetMap and may be missing or flat. */
  style3d: 'https://tiles.openfreemap.org/styles/liberty',
  links: {
    campus: 'https://www.iima.ac.in/the-institute/campus',
    map: 'https://www.iima.ac.in/the-institute/campus/campus-map',
    tour: 'https://www.iima.ac.in/v-tour/',
    tourPage: 'https://www.iima.ac.in/the-institute/about-iima/virtual-tour',
    access: 'https://www.iima.ac.in/the-institute/campus/community-services#accessibility-for-the-differently-abled',
    community: 'https://www.iima.ac.in/the-institute/campus/community-services',
    architecture: 'https://www.iima.ac.in/the-institute/campus/campus-architecture',
    sports: 'https://www.iima.ac.in/the-institute/campus/iima-sports',
    security: 'https://www.iima.ac.in/the-institute/administration/Security-Department',
    facility: 'https://www.iima.ac.in/the-institute/administration/Facility-Office',
    screen: 'https://www.iima.ac.in/the-institute/screen-reader-access',
    connect: 'https://www.iima.ac.in/the-institute/campus/connect-with-us'
  },
  /* Only image URLs that appear on official iima.ac.in pages (campus, campus-architecture, campus-map).
     sec = the section heading on the official page; place = linked place when the file name/section names it. */
  photos: [
    { slot: 'hero-campus', file: 'assets/photos/hero-campus.jpg', u: 'https://iima.ac.in/sites/default/files/2022-10/article_543_cover_en_US_3.jpg', cap: 'Campus – cover image', sec: 'Campus', page: 'campus' },
    { slot: 'rjm-auditorium', file: 'assets/photos/rjm-auditorium.jpg', u: 'https://iima.ac.in/sites/default/files/2026-06/RJMAuditorium_1.jpg', cap: 'R.J. Matthai Auditorium', sec: 'Auditoriums', page: 'architecture', place: 'rjm' },
    { slot: 'academic-block-auditorium', file: 'assets/photos/academic-block-auditorium.jpg', u: 'https://iima.ac.in/sites/default/files/2026-06/AB2Auditorium_1.jpg', cap: 'Academic Block auditorium (AB2)', sec: 'Auditoriums', page: 'architecture' },
    { slot: 'jsw-auditorium', file: 'assets/photos/jsw-auditorium.jpg', u: 'https://iima.ac.in/sites/default/files/2026-06/JSWAuditorium_1.jpg', cap: 'JSW-SPP auditorium', sec: 'Auditoriums', page: 'architecture', place: 'jsw' },
    { slot: 'classroom-corridor', file: 'assets/photos/classroom-corridor.jpg', u: 'https://iima.ac.in/sites/default/files/2022-10/Classroom%20Corridor.jpg', cap: 'Classroom corridor', sec: 'Academic Block', page: 'architecture' },
    { slot: 'academic-block-ab1', file: 'assets/photos/academic-block-ab1.jpg', u: 'https://iima.ac.in/sites/default/files/2026-06/AcademicBlock-AB1_1.jpg', cap: 'Academic Block AB1', sec: 'Academic Block', page: 'architecture' },
    { slot: 'administrative-building', file: 'assets/photos/administrative-building.jpg', u: 'https://iima.ac.in/sites/default/files/2026-06/Administrative%20Building%20-%20RJM_11zon.jpg', cap: 'Administrative Building – RJM', sec: 'Administrative Buildings', page: 'architecture' },
    { slot: 'student-housing-1', file: 'assets/photos/student-housing-1.jpg', u: 'https://iima.ac.in/sites/default/files/2022-10/IIM%20Sept%20Remaining%20DJI-0067_0.jpg', cap: 'Student Housing (photo 1)', sec: 'Student Housing', page: 'architecture' },
    { slot: 'student-housing-2', file: 'assets/photos/student-housing-2.jpg', u: 'https://iima.ac.in/sites/default/files/2022-10/_IBS4464.jpg', cap: 'Student Housing (photo 2)', sec: 'Student Housing', page: 'architecture' },
    { slot: 'imdc', file: 'assets/photos/imdc.jpg', u: 'https://iima.ac.in/sites/default/files/2026-06/IMDC-IIMA_11zon.jpg', cap: 'IMDC', sec: 'IMDC', page: 'architecture', place: 'imdc' },
    { slot: 'faculty-housing', file: 'assets/photos/faculty-housing.jpg', u: 'https://iima.ac.in/sites/default/files/2022-10/residential-buildings-1_0.jpg', cap: 'Faculty Housing', sec: 'Faculty Housing', page: 'campus' },
    { slot: 'restoration', file: 'assets/photos/restoration.jpg', u: 'https://iima.ac.in/sites/default/files/2022-10/Restoration.jpg', cap: 'IIMA Restoration (Louis Kahn buildings)', sec: 'IIMA Restoration', page: 'campus' },
    { slot: 'sustainability', file: 'assets/photos/sustainability.jpg', u: 'https://iima.ac.in/sites/default/files/2026-03/_IAP8738~1%20%281%29.jpg', cap: 'Sustainability reports', sec: 'Sustainability & Initiatives', page: 'campus' },
    { slot: 'solar', file: 'assets/photos/solar.jpg', u: 'https://iima.ac.in/sites/default/files/2026-03/Solar_1%20%281%29%20%281%29.jpg', cap: 'Notable initiatives – solar power', sec: 'Sustainability & Initiatives', page: 'campus' }
  ],
  /* Facility photos: IIMA's public pages do not label any photo as a ramp, lift, accessible toilet,
     accessible entrance, pathway or parking bay. These stay UNAVAILABLE until a genuine photo exists
     (the user can attach their own on-site photo in the app, which is labelled as user-provided). */
  noOfficialPhoto: ['ramp', 'lift', 'toilet', 'parking', 'signage', 'entrance', 'pathway'],
  maps: [
    { slot: 'map-front', file: 'assets/map/campus-map-front.jpg', u: 'https://www.iima.ac.in/sites/default/files/inline-images/Frontside%20IIMA%20Map-03.jpg', cap: 'Front side' },
    { slot: 'map-back', file: 'assets/map/campus-map-back.jpg', u: 'https://www.iima.ac.in/sites/default/files/inline-images/Backside%20IIMA%20Map-02.jpg', cap: 'Back side' }
  ],
  /* Places named on official IIMA pages. ll = approximate; omitted = not placed yet (use "Place on map"). */
  places: [
    { id: 'gate-main', name: 'Main Campus Gate', entrance: true, campus: 'Heritage', ll: [23.0303, 72.5372], src: 'Named on iima.ac.in/connect-with-us-IIMA' },
    { id: 'gate-new', name: 'New Campus Gate', entrance: true, campus: 'New', ll: [23.0316, 72.5338], src: 'Named on iima.ac.in/connect-with-us-IIMA' },
    { id: 'underpass', name: 'Underpass (heritage ↔ new campus)', campus: 'Both', ll: [23.0311, 72.5352], src: 'Official accessibility statement' },
    { id: 'library', name: 'Vikram Sarabhai Library', campus: 'Heritage', ll: [23.0318, 72.5366], src: 'Named on iima.ac.in' },
    { id: 'classroom', name: 'Classroom Complex', campus: 'Heritage', ll: [23.0321, 72.5360], src: 'Named on iima.ac.in/campus (restoration)' },
    { id: 'rjm', name: 'R.J. Matthai Auditorium (RJMCEI)', campus: 'Heritage', ll: [23.0314, 72.5360], src: 'Official: 500-seat auditorium at the heart of the main (heritage) campus' },
    { id: 'dorms', name: 'Dormitories (heritage)', campus: 'Heritage', ll: [23.0327, 72.5372], src: 'Named on iima.ac.in/campus (architecture)' },
    { id: 'imdc', name: 'IMDC (guest house & conference centre)', campus: 'Heritage', ll: [23.0300, 72.5360], src: 'Named on iima.ac.in/campus (architecture)' },
    { id: 'jsw', name: 'JSW-SPP building (new campus auditoriums)', campus: 'New', ll: [23.0318, 72.5330], src: 'Named on iima.ac.in/campus (architecture)' },
    { id: 'sports', name: 'Sports facilities', campus: 'Heritage', ll: [23.0335, 72.5358], src: 'iima.ac.in/the-institute/campus/iima-sports' },
    { id: 'dispensary', name: 'On-campus dispensary', campus: '?', src: 'Official: full-time residential doctors' },
    { id: 'bank', name: 'Bank branch & ATM', campus: '?', src: 'Official: community services page' },
    { id: 'post', name: 'Post Office & courier', campus: '?', src: 'Official: community services page' },
    { id: 'pharmacy', name: 'Pharmacy & All-Needs Store', campus: '?', src: 'Official: community services page' },
    { id: 'cafes', name: 'Campus cafés', campus: '?', src: 'Official: campus overview' }
  ],
  /* Features. status official | tbv. 'place' links to a place for position.
     status 'tbv' entries are a CHECKLIST of things worth looking for at a named building. IIMA has NOT said they exist.
     They are hidden from the default list, never get a map marker, never count as nearby, and only become
     real entries when a person marks them "It is here" on site. To add VERIFIED data: add an entry with status 'official'
     (only if an iima.ac.in page states it) and, for a surveyed spot, put exact coordinates in a place's `ll` with `verified: true` and `src`. */
  features: [
    { id: 'f-underpass-lift', type: 'lift', place: 'underpass', name: 'Elevators at the underpass', status: 'official', note: 'IIMA states elevators help differently-abled students use the underpass connecting the heritage and new campuses. Exact elevator positions are not published.' },
    { id: 'f-ramps', type: 'ramp', name: 'Ramps and railings (campus-wide)', status: 'official', note: 'IIMA states it has built ramps and railings. Which entrances have them is not published.' },
    { id: 'f-signage', type: 'signage', name: 'High-contrast signage & high-power lighting', status: 'official', note: 'IIMA states these are provided to help students with low vision. Locations are not published.' },
    { id: 'f-lib-ramp', type: 'ramp', place: 'library', name: 'Entrance ramp – Library', status: 'tbv' },
    { id: 'f-lib-lift', type: 'lift', place: 'library', name: 'Lift – Library', status: 'tbv' },
    { id: 'f-lib-wc', type: 'toilet', place: 'library', name: 'Accessible toilet – Library', status: 'tbv' },
    { id: 'f-cls-ramp', type: 'ramp', place: 'classroom', name: 'Entrance ramp – Classroom Complex', status: 'tbv' },
    { id: 'f-cls-wc', type: 'toilet', place: 'classroom', name: 'Accessible toilet – Classroom Complex', status: 'tbv' },
    { id: 'f-rjm-ramp', type: 'ramp', place: 'rjm', name: 'Ramp – R.J. Matthai Auditorium', status: 'tbv' },
    { id: 'f-rjm-wc', type: 'toilet', place: 'rjm', name: 'Accessible toilet – R.J. Matthai Auditorium', status: 'tbv' },
    { id: 'f-jsw-lift', type: 'lift', place: 'jsw', name: 'Lift – JSW-SPP building', status: 'tbv' },
    { id: 'f-jsw-wc', type: 'toilet', place: 'jsw', name: 'Accessible toilet – JSW-SPP building', status: 'tbv' },
    { id: 'f-imdc-wc', type: 'toilet', place: 'imdc', name: 'Accessible toilet – IMDC', status: 'tbv' },
    { id: 'f-gm-park', type: 'parking', place: 'gate-main', name: 'Accessible parking – Main Gate', status: 'tbv' },
    { id: 'f-gn-park', type: 'parking', place: 'gate-new', name: 'Accessible parking – New Campus Gate', status: 'tbv' },
    { id: 'f-disp', type: 'nearby', place: 'dispensary', name: 'On-campus dispensary', status: 'official', note: 'Full-time residential doctors; basic treatment and referrals (per IIMA). Opening hours and phone not published on the pages used.' },
    { id: 'f-bank', type: 'nearby', place: 'bank', name: 'Bank branch & ATM', status: 'official', note: 'Listed by IIMA community services. Position not published.' },
    { id: 'f-post', type: 'nearby', place: 'post', name: 'Post Office & courier', status: 'official', note: 'Listed by IIMA community services. Position not published.' },
    { id: 'f-pharm', type: 'nearby', place: 'pharmacy', name: 'Pharmacy & All-Needs Store', status: 'official', note: 'Listed by IIMA community services. Position not published.' },
    { id: 'f-cafe', type: 'nearby', place: 'cafes', name: 'Campus cafés', status: 'official', note: 'Mentioned on the IIMA campus overview. Positions not published.' },
    { id: 'f-sports', type: 'nearby', place: 'sports', name: 'Sports facilities', status: 'official', note: 'Outdoor courts, fields, pool, gyms and yoga rooms listed by IIMA. Step-free access is not stated.' },
    { id: 'f-lib', type: 'nearby', place: 'library', name: 'Vikram Sarabhai Library', status: 'official', note: 'Named on the IIMA site. Step-free access is not stated.' }
  ],
  types: {
    ramp: ['♿', 'Ramp'], lift: ['🛗', 'Lift'], toilet: ['🚻', 'Accessible toilet'], parking: ['🅿️', 'Accessible parking'],
    entrance: ['🚪', 'Accessible entrance'], pathway: ['🛤️', 'Step-free pathway'], signage: ['👁️', 'Low-vision aids'], nearby: ['📍', 'Nearby facility']
  },
  statusLabel: { official: 'Official statement', tbv: 'Not confirmed – check on site', present: 'Confirmed by you', absent: 'Not found (your check)', user: 'Added by you – unverified' },
  reportCats: ['Lift not working', 'Ramp blocked or damaged', 'Accessible toilet problem', 'Accessible parking problem', 'Missing or unclear signage', 'Uneven path / obstacle', 'Other barrier'],
  reportSteps: ['Submitted', 'Acknowledged', 'In progress', 'Resolved']
};
