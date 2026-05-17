# VacationHub Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete VacationHub static-site engine — every page template, component, style, and behavior described in the v1 spec — and seed it with Magic Kingdom as a complete reference park so every template is exercised by real data. The remaining 14 parks are content-seeding work that follows in a separate plan.

**Architecture:** Vanilla HTML/CSS/JS, no build step. Five HTML templates (`index`, `park`, `collection`, `tip`, `about`) hydrate from JSON files under `data/` at runtime. Shared JS modules (`app.js`, page-specific `home.js`/`park.js`/`collection.js`/`tip.js`) live in flat files. Markdown for tip prose, rendered client-side via `marked` from a CDN. All paths relative (Cloudflare worker constraint). Disney+-Classic dark theme with system fonts.

**Tech Stack:** HTML5, CSS3 (custom properties, grid, flexbox), vanilla ES2022 JS, `marked` 12.x via jsDelivr CDN.

**Reference docs:**
- Spec: [`docs/superpowers/specs/2026-05-17-vacationhub-design.md`](../specs/2026-05-17-vacationhub-design.md)
- Repo conventions: [`CLAUDE.md`](../../../CLAUDE.md)
- Pattern reference: [`ondeck/`](../../../ondeck/) (existing site to mirror conventions)

**Verification approach:** No test runner. Every task ends with a manual browser verification step using a local static server. Start it once with:

```bash
cd vacationhub && python3 -m http.server 8000
```

Then open `http://localhost:8000/` (or the relevant page) and confirm the described behavior before committing.

**Commit style:** Conventional commits, scope `vacationhub`. Example: `feat(vacationhub): add brand chip filter`. Each task ends with one commit.

---

## File Structure Overview

By the end of this plan, `vacationhub/` contains:

```
vacationhub/
├── index.html              # Homepage shell
├── park.html               # Park hub shell
├── collection.html         # Collection shell
├── tip.html                # Tip article shell
├── about.html              # About page (mostly static content)
├── styles.css              # All site styles (single file)
├── app.js                  # Shared: fetch, sidebar, rail, chips, search, errors
├── home.js                 # Homepage render
├── park.js                 # Park hub render
├── collection.js           # Collection render
├── tip.js                  # Tip article render
├── data/
│   ├── index.json          # Master index (seeded with Magic Kingdom + brands)
│   ├── parks/
│   │   ├── magic-kingdom.json
│   │   └── magic-kingdom/tips/{rope-drop,lightning-lane,best-time-to-visit}.md
│   └── collections/
│       └── magic-kingdom-coasters.json
├── assets/
│   └── images/
│       ├── parks/magic-kingdom-hero.jpg
│       ├── parks/magic-kingdom-tile.jpg
│       ├── collections/magic-kingdom-coasters.jpg
│       └── brands/{disney,universal,legoland,cedar-fair,six-flags,dollywood}.svg
├── favicon.svg
├── apple-touch-icon-180x180.png
└── README.md
```

---

## Task 1: Site scaffolding

**Files:**
- Create: `vacationhub/README.md`
- Create: `vacationhub/index.html`
- Create: `vacationhub/styles.css`
- Create: `vacationhub/favicon.svg`

- [ ] **Step 1: Create the directory and README**

`vacationhub/README.md`:

```markdown
# VacationHub

A static site at `vacationhub.<owner-tld>` that surfaces useful,
hard-to-find information about popular vacation destinations.
V1 covers theme parks; cruises, resorts, and experiences are
planned for future versions.

## Architecture

Vanilla HTML/CSS/JS, no build step. Per-page HTML shells
(`index.html`, `park.html`, `collection.html`, `tip.html`,
`about.html`) hydrate from JSON files under `data/` at runtime.
Tip prose lives in Markdown files rendered client-side via
`marked` from a CDN.

See `docs/superpowers/specs/2026-05-17-vacationhub-design.md`
for the full design.

## Local development

```bash
cd vacationhub
python3 -m http.server 8000
# open http://localhost:8000
```

## Content authoring

- Parks: `data/parks/<slug>.json`
- Tips: `data/parks/<slug>/tips/<tip-slug>.md` + matching entry in
  the park's `tips` manifest
- Collections: `data/collections/<slug>.json`
- Images: `assets/images/parks/<slug>-{hero,tile}.jpg`

## Conventions

All paths in HTML/JS are **relative** — the Cloudflare worker
rewrites `vacationhub.<owner-tld>` to `/sites/vacationhub/`
under the hood, so absolute paths break.
```

- [ ] **Step 2: Create the favicon**

`vacationhub/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b1220"/>
  <path d="M16 44 L32 20 L48 44 Z" fill="#1d6fe0"/>
  <circle cx="32" cy="42" r="3" fill="#7eb0ff"/>
</svg>
```

- [ ] **Step 3: Create the empty homepage shell**

`vacationhub/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1220">
  <meta name="description" content="VacationHub — useful, hard-to-find information about popular vacation destinations.">
  <title>VacationHub</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="app">
    <nav id="sidebar" class="sidebar" aria-label="Primary"></nav>
    <main id="main" class="main">
      <section id="hero" class="hero"></section>
      <section id="chips" class="chips" aria-label="Filter by brand"></section>
      <section id="rails" class="rails"></section>
    </main>
  </div>
  <div id="search-overlay" class="search-overlay" hidden></div>
  <script src="./app.js"></script>
  <script src="./home.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create the empty styles.css with the theme tokens**

`vacationhub/styles.css`:

```css
/* === Tokens === */
:root {
  --bg: #0b1220;
  --bg-elev: #0e1729;
  --bg-elev-2: #172236;
  --border: #1a2338;
  --text: #e6edf7;
  --text-dim: #9fb0cf;
  --text-mute: #6e85ad;
  --accent: #1d6fe0;
  --accent-hi: #7eb0ff;
  --premier: #7e3ae0;
  --error: #e05a5a;
  --success: #3aa974;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --sidebar-w: 56px;
  --content-max: 1400px;

  --ease: cubic-bezier(.2, .8, .2, 1);
}

/* === Reset === */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font: 400 15px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
img { display: block; max-width: 100%; }

/* === Focus === */
:focus-visible {
  outline: 2px solid var(--accent-hi);
  outline-offset: 2px;
  border-radius: 4px;
}

/* === Layout === */
.app {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  min-height: 100vh;
}
.main {
  min-width: 0;        /* allow children to overflow-scroll */
  padding-bottom: 64px;
}

/* === Reduced motion === */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Verify in browser**

Run: `cd vacationhub && python3 -m http.server 8000`
Open: `http://localhost:8000`
Expected: dark page background, no console errors. Sidebar slot empty, main empty.

- [ ] **Step 6: Commit**

```bash
git add vacationhub/
git commit -m "feat(vacationhub): scaffold site shell and theme tokens"
```

---

## Task 2: Shared `app.js` foundation (fetch + errors)

**Files:**
- Create: `vacationhub/app.js`

- [ ] **Step 1: Write `app.js` with fetch helpers, error helpers, and a small DOM helper**

`vacationhub/app.js`:

```js
/* eslint-disable no-undef */
// Shared utilities for every VacationHub page.
// Exposes a single global `VH` namespace; no module system, no build step.

(function () {
  'use strict';

  const VH = {};

  // ---- DOM helpers ----
  VH.$ = (sel, root) => (root || document).querySelector(sel);
  VH.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  VH.el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v === false || v == null) { /* skip */ }
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  };

  // ---- Fetch with JSON + small cache ----
  const cache = new Map();
  VH.fetchJSON = async (path) => {
    if (cache.has(path)) return cache.get(path);
    const p = fetch(path, { cache: 'default' }).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
      return res.json();
    });
    cache.set(path, p);
    try { return await p; }
    catch (err) { cache.delete(path); throw err; }
  };

  VH.fetchText = async (path) => {
    const res = await fetch(path, { cache: 'default' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  };

  // ---- Error rendering ----
  VH.renderError = (root, message) => {
    root.replaceChildren(
      VH.el('div', { class: 'error' }, [
        VH.el('p', { text: message }),
        VH.el('button', { class: 'btn-text', onclick: () => location.reload() }, ['Reload']),
      ])
    );
  };

  // ---- URL params helper ----
  VH.params = () => new URLSearchParams(location.search);

  window.VH = VH;
})();
```

- [ ] **Step 2: Add error styles to `styles.css`**

Append to `vacationhub/styles.css`:

```css
/* === Error / loading === */
.error {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 16px;
  border-radius: var(--radius-md);
  margin: 16px 0;
}
.error p { margin: 0 0 8px; }
.btn-text {
  color: var(--accent-hi);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-elev) 0%, var(--bg-elev-2) 50%, var(--bg-elev) 100%);
  background-size: 200% 100%;
  animation: skeleton 1.4s ease-in-out infinite;
  border-radius: var(--radius-md);
}
@keyframes skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 3: Verify in browser console**

Reload `http://localhost:8000` and in DevTools console run:

```js
VH.fetchJSON('./does-not-exist.json').catch(e => console.log('OK:', e.message))
```

Expected: logs `OK: Failed to load ./does-not-exist.json: 404`.

- [ ] **Step 4: Commit**

```bash
git add vacationhub/app.js vacationhub/styles.css
git commit -m "feat(vacationhub): add shared fetch and DOM helpers"
```

---

## Task 3: Sidebar nav component

**Files:**
- Modify: `vacationhub/app.js` (add `VH.renderSidebar`)
- Modify: `vacationhub/styles.css` (add sidebar styles)
- Modify: `vacationhub/index.html` (call `VH.renderSidebar` is done in `home.js` later — here we add it to `app.js`'s autoboot)

- [ ] **Step 1: Add sidebar render function to `app.js`**

Append inside the IIFE in `vacationhub/app.js`, just before `window.VH = VH;`:

```js
  // ---- Sidebar nav ----
  const SIDEBAR_ITEMS = [
    { id: 'home', label: 'Home', href: './index.html', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
    { id: 'search', label: 'Search', href: '#search', icon: 'M10 3a7 7 0 1 1-4.95 11.95l-3.55 3.55-1.41-1.41 3.55-3.55A7 7 0 0 1 10 3zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 10 5z' },
    { id: 'parks', label: 'Theme Parks', href: './index.html', icon: 'M2 20h20v2H2zm10-18l4 6h-3v4h-2v-4H8zM4 14h2v6H4zm14 0h2v6h-2zM9 14h6v6H9z' },
    { id: 'about', label: 'About', href: './about.html', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z' },
  ];

  const DEFERRED_ITEMS = [
    { id: 'cruises', label: 'Cruises (coming soon)', icon: 'M2 21l2-7h16l2 7zm2-9l8-9 8 9z' },
    { id: 'resorts', label: 'Resorts (coming soon)', icon: 'M3 21V10l9-7 9 7v11h-6v-7h-6v7z' },
    { id: 'experiences', label: 'Experiences (coming soon)', icon: 'M12 2l2.39 7.36H22l-6.18 4.49L18.21 22 12 17.27 5.79 22l2.39-8.15L2 9.36h7.61z' },
  ];

  VH.renderSidebar = (activeId) => {
    const sidebar = VH.$('#sidebar');
    if (!sidebar) return;
    const icon = (path) =>
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

    const itemEl = (item, { deferred } = {}) => {
      const tag = deferred ? 'span' : 'a';
      const attrs = {
        class: 'side-item' + (item.id === activeId ? ' active' : '') + (deferred ? ' deferred' : ''),
        'aria-label': item.label,
        title: item.label,
        html: icon(item.icon),
      };
      if (!deferred) attrs.href = item.href;
      if (item.id === 'search' && !deferred) {
        attrs.onclick = (e) => { e.preventDefault(); VH.openSearch && VH.openSearch(); };
      }
      return VH.el(tag, attrs);
    };

    sidebar.replaceChildren(
      VH.el('a', { href: './index.html', class: 'side-logo', 'aria-label': 'VacationHub home' }, [
        VH.el('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19l9-14 9 14z" fill="currentColor"/></svg>' }),
      ]),
      ...SIDEBAR_ITEMS.map((i) => itemEl(i)),
      VH.el('div', { class: 'side-divider', 'aria-hidden': 'true' }),
      ...DEFERRED_ITEMS.map((i) => itemEl(i, { deferred: true })),
    );
  };
```

- [ ] **Step 2: Add sidebar styles**

Append to `vacationhub/styles.css`:

```css
/* === Sidebar === */
.sidebar {
  background: #070d18;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0;
  gap: 8px;
  position: sticky;
  top: 0;
  height: 100vh;
}
.side-logo {
  color: var(--accent);
  width: 36px; height: 36px;
  display: grid; place-items: center;
  margin-bottom: 8px;
}
.side-logo svg { width: 22px; height: 22px; }
.side-item {
  width: 36px; height: 36px;
  display: grid; place-items: center;
  border-radius: var(--radius-sm);
  color: var(--text-mute);
  position: relative;
  transition: color 120ms var(--ease), background-color 120ms var(--ease);
}
.side-item:hover { color: var(--text); background: var(--bg-elev-2); }
.side-item svg { width: 18px; height: 18px; fill: currentColor; }
.side-item.active { color: var(--accent-hi); }
.side-item.active::before {
  content: '';
  position: absolute; left: -10px; top: 8px; bottom: 8px;
  width: 2px; background: var(--accent); border-radius: 2px;
}
.side-item.deferred {
  opacity: 0.35;
  cursor: not-allowed;
}
.side-divider {
  width: 24px; height: 1px; background: var(--border);
  margin: 6px 0;
}
```

- [ ] **Step 3: Auto-render sidebar from page-specific scripts**

Each page's script will call `VH.renderSidebar('<id>')` on load. Add the call to a new file we'll create in the next task. For now, manually verify by running this in DevTools console:

```js
VH.renderSidebar('home')
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:8000`, run `VH.renderSidebar('home')` in console.
Expected: sidebar shows logo + 4 active icons + divider + 3 dimmed deferred icons. "Home" has the accent bar on its left edge. Hovering deferred items shows tooltip but no nav.

- [ ] **Step 5: Commit**

```bash
git add vacationhub/app.js vacationhub/styles.css
git commit -m "feat(vacationhub): add persistent sidebar nav"
```

---

## Task 4: Seed `data/index.json` with brands + Magic Kingdom

**Files:**
- Create: `vacationhub/data/index.json`
- Create: `vacationhub/assets/images/brands/disney.svg` (and 5 others)
- Create: `vacationhub/assets/images/parks/magic-kingdom-tile.jpg` (placeholder)
- Create: `vacationhub/assets/images/parks/magic-kingdom-hero.jpg` (placeholder)
- Create: `vacationhub/assets/images/collections/magic-kingdom-coasters.jpg` (placeholder)

- [ ] **Step 1: Create placeholder images**

For each of these paths, drop in a placeholder JPG (any solid-color or stock image; the seed-content task at the end of this plan will replace them with real ones):

```bash
mkdir -p vacationhub/assets/images/parks vacationhub/assets/images/brands vacationhub/assets/images/collections
# Generate flat-color placeholder JPGs via ImageMagick (install if needed)
convert -size 2400x1000 xc:'#1a3a6b' vacationhub/assets/images/parks/magic-kingdom-hero.jpg
convert -size 800x450  xc:'#1a3a6b' vacationhub/assets/images/parks/magic-kingdom-tile.jpg
convert -size 800x450  xc:'#2a4a8b' vacationhub/assets/images/collections/magic-kingdom-coasters.jpg
```

If ImageMagick isn't available, any small JPG at those paths will do (download from `https://placehold.co/2400x1000/1a3a6b/ffffff.jpg` etc. and save locally — do not hotlink in HTML).

- [ ] **Step 2: Create brand logo SVGs**

For each brand, save a simple text SVG. Example `vacationhub/assets/images/brands/disney.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32">
  <text x="60" y="22" text-anchor="middle" font-family="-apple-system, sans-serif" font-weight="800" font-size="18" fill="#e6edf7">Disney</text>
</svg>
```

Repeat for: `universal.svg` (text "Universal"), `legoland.svg` ("LEGOLAND"), `cedar-fair.svg` ("Cedar Fair"), `six-flags.svg` ("Six Flags"), `dollywood.svg` ("Dollywood"). The seed-content plan will replace these with real wordmarks where licensing permits.

- [ ] **Step 3: Create the master index**

`vacationhub/data/index.json`:

```json
{
  "brands": [
    { "slug": "disney",     "name": "Disney",     "logo": "./assets/images/brands/disney.svg" },
    { "slug": "universal",  "name": "Universal",  "logo": "./assets/images/brands/universal.svg" },
    { "slug": "legoland",   "name": "LEGOLAND",   "logo": "./assets/images/brands/legoland.svg" },
    { "slug": "cedar-fair", "name": "Cedar Fair", "logo": "./assets/images/brands/cedar-fair.svg" },
    { "slug": "six-flags",  "name": "Six Flags",  "logo": "./assets/images/brands/six-flags.svg" },
    { "slug": "dollywood",  "name": "Dollywood",  "logo": "./assets/images/brands/dollywood.svg" }
  ],
  "parks": [
    {
      "slug": "magic-kingdom",
      "name": "Magic Kingdom",
      "brand": "disney",
      "resort": "Walt Disney World",
      "location": { "city": "Orlando", "state": "FL", "country": "US" },
      "tile": "./assets/images/parks/magic-kingdom-tile.jpg",
      "hero": "./assets/images/parks/magic-kingdom-hero.jpg",
      "tagline": "The original Disney park east of California."
    }
  ],
  "collections": [
    {
      "slug": "magic-kingdom-coasters",
      "name": "Magic Kingdom Coasters",
      "scope": { "park": "magic-kingdom" },
      "tile": "./assets/images/collections/magic-kingdom-coasters.jpg"
    }
  ],
  "home": {
    "featured": "magic-kingdom",
    "rails": [
      { "title": "Featured",         "type": "park",       "items": ["magic-kingdom"] },
      { "title": "New Openings",     "type": "park",       "items": ["magic-kingdom"] },
      { "title": "Ride Collections", "type": "collection", "items": ["magic-kingdom-coasters"] }
    ]
  }
}
```

(Yes, Magic Kingdom appears in every rail at this point — that's intentional for engine testing. Real content seeding fills the rails properly.)

- [ ] **Step 4: Verify in browser console**

Reload, then:

```js
VH.fetchJSON('./data/index.json').then(d => console.log(d.parks[0].name))
```

Expected: logs `Magic Kingdom`.

- [ ] **Step 5: Commit**

```bash
git add vacationhub/data/index.json vacationhub/assets/
git commit -m "feat(vacationhub): seed master index and placeholder assets"
```

---

## Task 5: Homepage hero band

**Files:**
- Create: `vacationhub/home.js`
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Create `home.js` with hero render**

`vacationhub/home.js`:

```js
(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar } = VH;

  renderSidebar('home');

  let index;
  try {
    index = await fetchJSON('./data/index.json');
  } catch (err) {
    renderError($('#hero'), 'Could not load site index.');
    return;
  }

  renderHero(index);

  function renderHero(idx) {
    const featuredSlug = idx.home.featured;
    const park = idx.parks.find((p) => p.slug === featuredSlug);
    const hero = $('#hero');
    if (!park) { hero.replaceChildren(); return; }

    hero.replaceChildren(
      el('div', { class: 'hero-bg', style: `background-image:url('${park.hero}')` }),
      el('div', { class: 'hero-shade' }),
      el('div', { class: 'hero-content' }, [
        el('div', { class: 'label', text: 'Featured Park' }),
        el('h1', { class: 'hero-title', text: park.name }),
        el('p', { class: 'hero-tag', text: park.tagline || '' }),
        el('a', {
          class: 'btn-primary',
          href: `./park.html?slug=${park.slug}`,
        }, ['Explore →']),
      ])
    );
  }
})();
```

- [ ] **Step 2: Add hero styles**

Append to `vacationhub/styles.css`:

```css
/* === Hero === */
.hero {
  position: relative;
  height: 56vh;
  min-height: 360px;
  max-height: 560px;
  overflow: hidden;
  margin-bottom: 32px;
}
.hero-bg {
  position: absolute; inset: 0;
  background-size: cover;
  background-position: center;
}
.hero-shade {
  position: absolute; inset: 0;
  background:
    linear-gradient(to top, var(--bg) 0%, transparent 50%),
    linear-gradient(to right, rgba(11,18,32,0.85) 0%, rgba(11,18,32,0.2) 50%, transparent 100%);
}
.hero-content {
  position: relative;
  max-width: var(--content-max);
  padding: 48px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.label {
  font: 700 11px/14px inherit;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-hi);
}
.hero-title {
  font: 800 48px/52px inherit;
  letter-spacing: -0.02em;
  margin: 6px 0 8px;
}
.hero-tag {
  color: var(--text-dim);
  max-width: 560px;
  margin: 0 0 18px;
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--accent);
  color: #fff;
  padding: 10px 18px;
  border-radius: var(--radius-sm);
  font-weight: 700;
  align-self: flex-start;
  transition: background-color 120ms var(--ease), transform 120ms var(--ease);
}
.btn-primary:hover { background: var(--accent-hi); transform: translateY(-1px); }
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:8000/`.
Expected: hero band shows the Magic Kingdom placeholder image with "FEATURED PARK" label, "Magic Kingdom" title, tagline, and a blue "Explore →" button linking to `park.html?slug=magic-kingdom`. Sidebar shows the home icon active.

- [ ] **Step 4: Commit**

```bash
git add vacationhub/home.js vacationhub/styles.css
git commit -m "feat(vacationhub): render homepage hero band"
```

---

## Task 6: Brand chips with URL-state filter

**Files:**
- Modify: `vacationhub/home.js`
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Add chip rendering and URL-state to `home.js`**

Add inside the IIFE in `vacationhub/home.js`, after the `renderHero(index);` call:

```js
  let currentBrand = VH.params().get('brand') || 'all';
  renderChips(index, currentBrand);

  function renderChips(idx, active) {
    const chips = $('#chips');
    const make = (slug, label) =>
      el('button', {
        class: 'chip' + (slug === active ? ' active' : ''),
        'data-brand': slug,
        'aria-pressed': slug === active ? 'true' : 'false',
        onclick: () => selectBrand(slug),
      }, [label]);

    chips.replaceChildren(
      make('all', 'All'),
      ...idx.brands.map((b) => make(b.slug, b.name)),
    );
  }

  function selectBrand(slug) {
    currentBrand = slug;
    const url = new URL(location.href);
    if (slug === 'all') url.searchParams.delete('brand');
    else url.searchParams.set('brand', slug);
    history.replaceState(null, '', url);
    renderChips(index, slug);
    if (VH.refilterRails) VH.refilterRails(slug);   // Task 8 will define this
  }
```

- [ ] **Step 2: Add chip styles**

Append to `vacationhub/styles.css`:

```css
/* === Brand chips === */
.chips {
  display: flex;
  gap: 8px;
  padding: 0 48px;
  margin-bottom: 24px;
  overflow-x: auto;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar { display: none; }
.chip {
  flex: 0 0 auto;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--bg-elev-2);
  color: var(--text-dim);
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  transition: background-color 120ms var(--ease), color 120ms var(--ease);
}
.chip:hover { color: var(--text); }
.chip.active { background: var(--accent); color: #fff; }
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:8000/`.
Expected: chip row appears under hero with "All" + 6 brand chips. Clicking a chip highlights it and updates the URL to `?brand=<slug>`. Refreshing the page preserves the selection. (Rails don't yet exist to be filtered — that's Task 8.)

- [ ] **Step 4: Commit**

```bash
git add vacationhub/home.js vacationhub/styles.css
git commit -m "feat(vacationhub): add brand chip filter with URL state"
```

---

## Task 7: Generic rail component

**Files:**
- Modify: `vacationhub/app.js` (add `VH.renderRail`)
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Add `renderRail` to `app.js`**

Append inside the IIFE in `vacationhub/app.js`, before `window.VH = VH;`:

```js
  // ---- Tile builders ----
  VH.parkTile = (park) =>
    VH.el('a', {
      class: 'tile tile-park',
      href: `./park.html?slug=${park.slug}`,
      'data-brand': park.brand,
      'aria-label': `${park.name} — ${park.resort || ''}`,
    }, [
      VH.el('div', { class: 'tile-img', style: `background-image:url('${park.tile}')` }),
      VH.el('div', { class: 'tile-shade' }),
      VH.el('div', { class: 'tile-body' }, [
        VH.el('div', { class: 'tile-title', text: park.name }),
        VH.el('div', { class: 'tile-meta', text: park.resort || park.location?.city || '' }),
      ]),
    ]);

  VH.collectionTile = (col, parksByBrand) => {
    const brand = col.scope?.brand;
    const park = col.scope?.park;
    const meta = brand ? brand : park ? park : '';
    return VH.el('a', {
      class: 'tile tile-collection',
      href: `./collection.html?slug=${col.slug}`,
      'data-brand': brand || (parksByBrand && parksByBrand[park]) || '',
    }, [
      VH.el('div', { class: 'tile-img', style: `background-image:url('${col.tile}')` }),
      VH.el('div', { class: 'tile-shade' }),
      VH.el('div', { class: 'tile-body' }, [
        VH.el('div', { class: 'tile-title', text: col.name }),
        VH.el('div', { class: 'tile-meta', text: meta }),
      ]),
    ]);
  };

  // ---- Rail (horizontal scrolling strip) ----
  VH.renderRail = (root, title, tiles) => {
    if (tiles.length === 0) { root.replaceChildren(); return; }
    const strip = VH.el('div', { class: 'rail-strip' }, tiles);

    const scroll = (dir) => {
      const step = strip.clientWidth * 0.8;
      strip.scrollBy({ left: dir * step, behavior: 'smooth' });
    };

    root.replaceChildren(
      VH.el('div', { class: 'rail-header' }, [
        VH.el('h2', { class: 'rail-title', text: title }),
        VH.el('div', { class: 'rail-controls' }, [
          VH.el('button', { class: 'rail-arrow', 'aria-label': 'Scroll left', onclick: () => scroll(-1) }, ['‹']),
          VH.el('button', { class: 'rail-arrow', 'aria-label': 'Scroll right', onclick: () => scroll(1) }, ['›']),
        ]),
      ]),
      strip,
    );
  };
```

- [ ] **Step 2: Add rail + tile styles**

Append to `vacationhub/styles.css`:

```css
/* === Rails === */
.rails { display: flex; flex-direction: column; gap: 32px; }
.rail { padding: 0 48px; }
.rail-header {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 12px;
}
.rail-title { font: 700 18px/24px inherit; margin: 0; }
.rail-controls { display: flex; gap: 6px; opacity: 0; transition: opacity 200ms var(--ease); }
.rail:hover .rail-controls, .rail:focus-within .rail-controls { opacity: 1; }
.rail-arrow {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--bg-elev-2);
  color: var(--text-dim);
  font-size: 18px;
  display: grid; place-items: center;
  transition: background-color 120ms var(--ease), color 120ms var(--ease);
}
.rail-arrow:hover { background: var(--accent); color: #fff; }

.rail-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(260px, 1fr);
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding-bottom: 8px;
}
.rail-strip::-webkit-scrollbar { display: none; }

/* === Tiles === */
.tile {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elev);
  scroll-snap-align: start;
  transition: transform 200ms var(--ease), box-shadow 200ms var(--ease);
}
.tile:hover { transform: scale(1.05); box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 1; }
.tile-img { position: absolute; inset: 0; background-size: cover; background-position: center; }
.tile-shade {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%);
}
.tile-body { position: absolute; left: 12px; right: 12px; bottom: 10px; }
.tile-title { font: 700 14px/18px inherit; color: #fff; }
.tile-meta { font: 500 11px/14px inherit; color: var(--text-dim); margin-top: 2px; }
.tile[data-hidden="true"] { display: none; }
```

- [ ] **Step 3: Verify in browser console**

Reload, then run in console:

```js
VH.fetchJSON('./data/index.json').then(idx => {
  const root = document.createElement('div');
  root.className = 'rail';
  document.querySelector('#rails').appendChild(root);
  VH.renderRail(root, 'Test Rail', [VH.parkTile(idx.parks[0]), VH.parkTile(idx.parks[0])]);
});
```

Expected: a "Test Rail" appears with two Magic Kingdom tiles side by side; hovering a tile scales it up; hovering the rail header shows two ‹ › arrow buttons that scroll the strip.

- [ ] **Step 4: Commit**

```bash
git add vacationhub/app.js vacationhub/styles.css
git commit -m "feat(vacationhub): add reusable rail and tile components"
```

---

## Task 8: Homepage rails wired to brand filter

**Files:**
- Modify: `vacationhub/home.js`

- [ ] **Step 1: Render the rails and implement the brand refilter**

Append inside the IIFE in `vacationhub/home.js`, after the `renderChips` and `selectBrand` definitions:

```js
  renderRails(index);
  VH.refilterRails = (brand) => applyBrandFilter(brand);
  applyBrandFilter(currentBrand);

  function renderRails(idx) {
    const root = $('#rails');
    const parksBySlug = Object.fromEntries(idx.parks.map((p) => [p.slug, p]));
    const colsBySlug = Object.fromEntries(idx.collections.map((c) => [c.slug, c]));
    const parkBrand = Object.fromEntries(idx.parks.map((p) => [p.slug, p.brand]));

    root.replaceChildren(
      ...idx.home.rails.map((rail) => {
        const wrap = el('section', { class: 'rail', 'data-rail-type': rail.type });
        let tiles;
        if (rail.type === 'park') {
          tiles = rail.items.map((s) => parksBySlug[s]).filter(Boolean).map(VH.parkTile);
        } else if (rail.type === 'collection') {
          tiles = rail.items.map((s) => colsBySlug[s]).filter(Boolean).map((c) => VH.collectionTile(c, parkBrand));
        } else {
          tiles = [];
        }
        VH.renderRail(wrap, rail.title, tiles);
        return wrap;
      })
    );
  }

  function applyBrandFilter(brand) {
    const all = brand === 'all';
    VH.$$('#rails .tile').forEach((tile) => {
      const tb = tile.dataset.brand;
      tile.dataset.hidden = all || tb === brand ? 'false' : 'true';
    });
    // Hide rails that have no visible tiles.
    VH.$$('#rails .rail').forEach((rail) => {
      const anyVisible = VH.$$('.tile', rail).some((t) => t.dataset.hidden !== 'true');
      rail.style.display = anyVisible ? '' : 'none';
    });
  }
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:8000/`.
Expected:
- Three rails ("Featured", "New Openings", "Ride Collections"), each with one tile (Magic Kingdom).
- Clicking the "Universal" chip hides all three rails (no Universal content yet). URL updates to `?brand=universal`.
- Clicking "All" restores all rails. URL drops the param.
- Clicking the Magic Kingdom tile navigates to `park.html?slug=magic-kingdom` (which will 404 until Task 10).

- [ ] **Step 3: Commit**

```bash
git add vacationhub/home.js
git commit -m "feat(vacationhub): render homepage rails with brand filtering"
```

---

## Task 9: Seed `data/parks/magic-kingdom.json`

**Files:**
- Create: `vacationhub/data/parks/magic-kingdom.json`

- [ ] **Step 1: Write the park JSON**

`vacationhub/data/parks/magic-kingdom.json`:

```json
{
  "slug": "magic-kingdom",
  "name": "Magic Kingdom",
  "brand": "disney",
  "resort": "Walt Disney World",
  "location": { "city": "Orlando", "state": "FL", "country": "US", "lat": 28.4177, "lng": -81.5812 },
  "opened": 1971,
  "size_acres": 142,
  "official_url": "https://disneyworld.disney.go.com/destinations/magic-kingdom/",
  "hero": "./assets/images/parks/magic-kingdom-hero.jpg",
  "summary": "The flagship park of the Walt Disney World Resort and the most-visited theme park in the world. Six themed lands radiate from Cinderella Castle.",
  "rides": [
    {
      "slug": "space-mountain",
      "name": "Space Mountain",
      "land": "Tomorrowland",
      "type": "roller-coaster",
      "subtype": "indoor-dark",
      "manufacturer": "WED Enterprises",
      "opened": 1975,
      "duration_sec": 165,
      "length_ft": 3196,
      "top_speed_mph": 28,
      "height_min_in": 44,
      "single_rider": false,
      "priority_access": "multipass",
      "accessibility": { "wheelchair_transfer": false, "must_transfer": true, "service_animal_ok": false },
      "intensity": 3,
      "blurb": "Ride at night for the full effect.",
      "collections": ["magic-kingdom-coasters"]
    },
    {
      "slug": "big-thunder-mountain",
      "name": "Big Thunder Mountain Railroad",
      "land": "Frontierland",
      "type": "roller-coaster",
      "subtype": "mine-train",
      "manufacturer": "Arrow Dynamics",
      "opened": 1980,
      "duration_sec": 210,
      "length_ft": 2780,
      "top_speed_mph": 35,
      "height_min_in": 40,
      "single_rider": false,
      "priority_access": "multipass",
      "accessibility": { "wheelchair_transfer": false, "must_transfer": true, "service_animal_ok": false },
      "intensity": 2,
      "blurb": "The wildest ride in the wilderness.",
      "collections": ["magic-kingdom-coasters"]
    },
    {
      "slug": "tron-lightcycle-run",
      "name": "TRON Lightcycle / Run",
      "land": "Tomorrowland",
      "type": "roller-coaster",
      "subtype": "launched",
      "manufacturer": "Vekoma",
      "opened": 2023,
      "duration_sec": 60,
      "top_speed_mph": 59,
      "height_min_in": 48,
      "single_rider": false,
      "priority_access": "premier",
      "accessibility": { "wheelchair_transfer": false, "must_transfer": true, "service_animal_ok": false },
      "intensity": 4,
      "blurb": "Worth the Premier upgrade — but only just.",
      "collections": ["magic-kingdom-coasters"]
    },
    {
      "slug": "seven-dwarfs-mine-train",
      "name": "Seven Dwarfs Mine Train",
      "land": "Fantasyland",
      "type": "roller-coaster",
      "subtype": "family",
      "manufacturer": "Vekoma",
      "opened": 2014,
      "duration_sec": 150,
      "height_min_in": 38,
      "single_rider": false,
      "priority_access": "multipass",
      "accessibility": { "wheelchair_transfer": false, "must_transfer": true, "service_animal_ok": false },
      "intensity": 2,
      "blurb": "Long line. Skip unless you have Lightning Lane.",
      "collections": ["magic-kingdom-coasters"]
    },
    {
      "slug": "pirates-of-the-caribbean",
      "name": "Pirates of the Caribbean",
      "land": "Adventureland",
      "type": "boat",
      "subtype": "dark-ride",
      "opened": 1973,
      "duration_sec": 510,
      "single_rider": false,
      "priority_access": "none",
      "accessibility": { "wheelchair_transfer": false, "must_transfer": true, "service_animal_ok": false },
      "intensity": 1,
      "blurb": "Classic. Never a long wait."
    },
    {
      "slug": "haunted-mansion",
      "name": "Haunted Mansion",
      "land": "Liberty Square",
      "type": "dark-ride",
      "subtype": "omnimover",
      "opened": 1971,
      "duration_sec": 525,
      "single_rider": false,
      "priority_access": "multipass",
      "accessibility": { "wheelchair_transfer": true, "must_transfer": false, "service_animal_ok": true },
      "intensity": 2,
      "blurb": "Ride in the front Doom Buggy for the best effects."
    },
    {
      "slug": "jungle-cruise",
      "name": "Jungle Cruise",
      "land": "Adventureland",
      "type": "boat",
      "opened": 1971,
      "duration_sec": 600,
      "single_rider": false,
      "priority_access": "multipass",
      "accessibility": { "wheelchair_transfer": false, "must_transfer": true, "service_animal_ok": false },
      "intensity": 1,
      "blurb": "Skipper jokes are the whole point."
    },
    {
      "slug": "its-a-small-world",
      "name": "it's a small world",
      "land": "Fantasyland",
      "type": "boat",
      "opened": 1971,
      "duration_sec": 600,
      "single_rider": false,
      "priority_access": "none",
      "accessibility": { "wheelchair_transfer": true, "must_transfer": false, "service_animal_ok": true },
      "intensity": 1,
      "blurb": "Either you love it or you can't escape the song."
    }
  ],
  "tips": [
    { "slug": "rope-drop", "title": "Rope-drop strategy", "summary": "Hit Space Mountain before 9:30am to skip the worst lines.", "updated": "2026-04-12" },
    { "slug": "lightning-lane", "title": "Lightning Lane priority order", "summary": "What to book at 7am and in what order.", "updated": "2026-04-12" },
    { "slug": "best-time-to-visit", "title": "Best time of year to visit", "summary": "Mid-January and late August have the shortest waits.", "updated": "2026-04-12" }
  ]
}
```

- [ ] **Step 2: Verify**

```bash
python3 -m json.tool vacationhub/data/parks/magic-kingdom.json > /dev/null && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add vacationhub/data/parks/magic-kingdom.json
git commit -m "feat(vacationhub): seed Magic Kingdom park data"
```

---

## Task 10: Park hub — hero + quick facts

**Files:**
- Create: `vacationhub/park.html`
- Create: `vacationhub/park.js`
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Create the park HTML shell**

`vacationhub/park.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1220">
  <title>Park · VacationHub</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="app">
    <nav id="sidebar" class="sidebar" aria-label="Primary"></nav>
    <main id="main" class="main">
      <section id="hero" class="hero"></section>
      <section id="quick-facts" class="quick-facts"></section>
      <section id="tips" class="park-section"></section>
      <section id="rides" class="park-section"></section>
      <section id="collections" class="park-section"></section>
    </main>
  </div>
  <script src="./app.js"></script>
  <script src="./park.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `park.js` with hero + quick-facts render**

`vacationhub/park.js`:

```js
(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;

  renderSidebar('parks');

  const slug = params().get('slug');
  if (!slug) {
    renderError($('#main'), 'No park specified.');
    return;
  }

  let park;
  try {
    park = await fetchJSON(`./data/parks/${slug}.json`);
  } catch (err) {
    renderError($('#main'), `Could not load park "${slug}".`);
    return;
  }

  document.title = `${park.name} · VacationHub`;
  renderHero(park);
  renderQuickFacts(park);

  function renderHero(p) {
    $('#hero').replaceChildren(
      el('div', { class: 'hero-bg', style: `background-image:url('${p.hero}')` }),
      el('div', { class: 'hero-shade' }),
      el('div', { class: 'hero-content' }, [
        el('div', { class: 'label', text: p.resort || p.brand }),
        el('h1', { class: 'hero-title', text: p.name }),
        el('p', { class: 'hero-tag', text: p.summary || '' }),
      ])
    );
  }

  function renderQuickFacts(p) {
    const facts = [];
    if (p.opened) facts.push({ k: 'Opened', v: String(p.opened) });
    if (p.size_acres) facts.push({ k: 'Size', v: `${p.size_acres} acres` });
    if (p.resort) facts.push({ k: 'Resort', v: p.resort });
    if (p.location) facts.push({ k: 'Location', v: [p.location.city, p.location.state, p.location.country].filter(Boolean).join(', ') });
    if (p.official_url) facts.push({ k: 'Official site', v: 'Visit ↗', link: p.official_url });

    $('#quick-facts').replaceChildren(
      ...facts.map((f) =>
        el('div', { class: 'fact' }, [
          el('div', { class: 'fact-key', text: f.k }),
          f.link
            ? el('a', { class: 'fact-val', href: f.link, target: '_blank', rel: 'noopener', text: f.v })
            : el('div', { class: 'fact-val', text: f.v }),
        ])
      )
    );
  }
})();
```

- [ ] **Step 3: Add quick-facts + park-section styles**

Append to `vacationhub/styles.css`:

```css
/* === Quick facts === */
.quick-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  max-width: var(--content-max);
  padding: 0 48px;
  margin: -8px 0 40px;
}
.fact {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
}
.fact-key {
  font: 700 11px/14px inherit;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-mute);
  margin-bottom: 4px;
}
.fact-val { font: 600 14px/20px inherit; color: var(--text); }
a.fact-val { color: var(--accent-hi); }

/* === Park sections === */
.park-section { padding: 0 48px; margin-bottom: 48px; max-width: var(--content-max); }
.park-section h2 { font: 700 22px/28px inherit; margin: 0 0 16px; letter-spacing: -0.01em; }
.section-meta { color: var(--text-mute); font-weight: 500; margin-left: 8px; }
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8000/park.html?slug=magic-kingdom`.
Expected: hero with park name, summary, and "Walt Disney World" label. Below: 5 quick-fact cards (Opened, Size, Resort, Location, Official site). The empty Tips/Rides/Collections sections take no visible space yet.

- [ ] **Step 5: Commit**

```bash
git add vacationhub/park.html vacationhub/park.js vacationhub/styles.css
git commit -m "feat(vacationhub): add park hub hero and quick facts"
```

---

## Task 11: Park hub — tips section

**Files:**
- Modify: `vacationhub/park.js`
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Render tips after quick facts**

In `vacationhub/park.js`, after the `renderQuickFacts(park);` call, add:

```js
  renderTips(park);

  function renderTips(p) {
    const root = $('#tips');
    if (!p.tips || p.tips.length === 0) { root.replaceChildren(); return; }
    root.replaceChildren(
      el('h2', {}, ['Tips ', el('span', { class: 'section-meta', text: `· ${p.tips.length}` })]),
      el('div', { class: 'tip-grid' },
        p.tips.map((t) =>
          el('a', { class: 'tip-card', href: `./tip.html?park=${p.slug}&slug=${t.slug}` }, [
            el('div', { class: 'tip-card-body' }, [
              el('div', { class: 'tip-card-title', text: t.title }),
              el('p', { class: 'tip-card-summary', text: t.summary || '' }),
              el('div', { class: 'tip-card-meta', text: t.updated ? `Updated ${t.updated}` : '' }),
            ]),
          ])
        )
      )
    );
  }
```

- [ ] **Step 2: Add tip-card styles**

Append to `vacationhub/styles.css`:

```css
/* === Tip cards === */
.tip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.tip-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  transition: transform 180ms var(--ease), border-color 180ms var(--ease);
}
.tip-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.tip-card-title { font: 700 16px/22px inherit; margin-bottom: 6px; }
.tip-card-summary { color: var(--text-dim); margin: 0 0 10px; font-size: 14px; line-height: 20px; }
.tip-card-meta { font: 500 11px/14px inherit; color: var(--text-mute); text-transform: uppercase; letter-spacing: 0.06em; }
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:8000/park.html?slug=magic-kingdom`.
Expected: a "Tips · 3" section with three cards (Rope-drop strategy, Lightning Lane priority order, Best time of year to visit). Each links to a `tip.html?...` URL that 404s until Task 14.

- [ ] **Step 4: Commit**

```bash
git add vacationhub/park.js vacationhub/styles.css
git commit -m "feat(vacationhub): add park tips section"
```

---

## Task 12: Park hub — rides section (cards + filter chips)

**Files:**
- Modify: `vacationhub/park.js`
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Render the rides section with filter state**

In `vacationhub/park.js`, after the `renderTips(park);` call, add:

```js
  const rideFilter = { land: 'all', type: 'all', height: 'all' };
  renderRidesSection(park);

  function renderRidesSection(p) {
    const root = $('#rides');
    if (!p.rides || p.rides.length === 0) { root.replaceChildren(); return; }

    const lands = ['all', ...new Set(p.rides.map((r) => r.land).filter(Boolean))];
    const types = ['all', ...new Set(p.rides.map((r) => r.type).filter(Boolean))];
    const heights = ['all', 'no-min', '<40', '40-47', '48+'];

    const chipBar = (key, options) =>
      el('div', { class: 'filter-bar', role: 'group', 'aria-label': key }, options.map((o) =>
        el('button', {
          class: 'chip-sm' + (rideFilter[key] === o ? ' active' : ''),
          'aria-pressed': rideFilter[key] === o ? 'true' : 'false',
          onclick: () => { rideFilter[key] = o; renderRidesSection(p); },
        }, [o === 'all' ? `All ${key}s` : o])
      ));

    const grid = el('div', { class: 'ride-grid' },
      p.rides.filter(matchesFilter).map(rideCard)
    );

    root.replaceChildren(
      el('h2', {}, ['Rides ', el('span', { class: 'section-meta', text: `· ${p.rides.length}` })]),
      el('div', { class: 'ride-filters' }, [
        chipBar('land', lands),
        chipBar('type', types),
        chipBar('height', heights),
      ]),
      grid,
    );
  }

  function matchesFilter(r) {
    if (rideFilter.land !== 'all' && r.land !== rideFilter.land) return false;
    if (rideFilter.type !== 'all' && r.type !== rideFilter.type) return false;
    if (rideFilter.height !== 'all') {
      const h = r.height_min_in;
      if (rideFilter.height === 'no-min' && h != null) return false;
      if (rideFilter.height === '<40' && !(h != null && h < 40)) return false;
      if (rideFilter.height === '40-47' && !(h != null && h >= 40 && h <= 47)) return false;
      if (rideFilter.height === '48+' && !(h != null && h >= 48)) return false;
    }
    return true;
  }

  function rideCard(r) {
    const meta = [
      r.type ? prettyType(r.type) : null,
      r.height_min_in != null ? `${r.height_min_in}"` : null,
      r.intensity ? '★'.repeat(r.intensity) + '☆'.repeat(5 - r.intensity) : null,
    ].filter(Boolean).join(' · ');

    return el('article', { class: 'ride-card', id: `ride-${r.slug}` }, [
      el('div', { class: 'ride-card-head' }, [
        el('div', { class: 'ride-card-land', text: r.land || '' }),
        priorityBadge(r.priority_access),
      ]),
      el('div', { class: 'ride-card-body' }, [
        el('h3', { class: 'ride-card-title', text: r.name }),
        el('div', { class: 'ride-card-meta', text: meta }),
        r.blurb ? el('p', { class: 'ride-card-blurb', text: `"${r.blurb}"` }) : null,
      ]),
    ]);
  }

  function priorityBadge(pa) {
    if (!pa || pa === 'none') return null;
    const label = { multipass: 'MULTI', premier: 'PREMIER', 'express-unlimited': 'EXPRESS' }[pa] || pa.toUpperCase();
    return el('span', { class: `pa-badge pa-${pa}`, text: label });
  }

  function prettyType(t) {
    return ({
      'roller-coaster': 'Coaster',
      'dark-ride': 'Dark Ride',
      'water': 'Water',
      'show': 'Show',
      'flat': 'Flat',
      'boat': 'Boat',
      'transport': 'Transport',
      'other': 'Other',
    })[t] || t;
  }
```

- [ ] **Step 2: Add ride-card and small-chip styles**

Append to `vacationhub/styles.css`:

```css
/* === Ride filters === */
.ride-filters {
  display: flex; flex-wrap: wrap; gap: 12px;
  margin-bottom: 16px;
}
.filter-bar { display: flex; flex-wrap: wrap; gap: 4px; }
.chip-sm {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-elev-2);
  color: var(--text-dim);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.04em;
  transition: background-color 120ms var(--ease), color 120ms var(--ease);
}
.chip-sm:hover { color: var(--text); }
.chip-sm.active { background: var(--accent); color: #fff; }

/* === Ride cards === */
.ride-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.ride-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.ride-card-head {
  position: relative;
  height: 80px;
  background: linear-gradient(135deg, var(--bg-elev-2), var(--bg-elev));
  display: flex; align-items: flex-end; padding: 10px 12px;
}
.ride-card-land {
  font: 700 10px/13px inherit;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
}
.pa-badge {
  position: absolute; top: 8px; right: 8px;
  background: var(--accent);
  color: #fff;
  font: 700 9px/12px inherit;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
}
.pa-badge.pa-premier { background: var(--premier); }

.ride-card-body { padding: 12px 14px 14px; }
.ride-card-title { font: 700 15px/19px inherit; margin: 0 0 4px; }
.ride-card-meta { font-size: 12px; color: var(--text-dim); margin-bottom: 8px; }
.ride-card-blurb { font-size: 13px; line-height: 18px; color: var(--text-dim); font-style: italic; margin: 0; }
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:8000/park.html?slug=magic-kingdom`.
Expected:
- "Rides · 8" section.
- Three filter rows: lands (All + 6), types (All + 3), heights (All / no-min / <40 / 40-47 / 48+).
- 8 ride cards. Coasters show MULTI or PREMIER badge. Pirates/Small World show no badge.
- Clicking "Tomorrowland" filters to 2 cards (Space Mountain, TRON).
- Clicking "48+" filters to TRON only.
- Selecting "All lands" + "All types" + "All heights" restores everything.

- [ ] **Step 4: Commit**

```bash
git add vacationhub/park.js vacationhub/styles.css
git commit -m "feat(vacationhub): add filterable ride cards on park hub"
```

---

## Task 13: Park hub — collections section

**Files:**
- Modify: `vacationhub/park.js`

- [ ] **Step 1: Fetch index and render park-scoped collections**

Replace the top of `vacationhub/park.js` with a version that loads both the park file and the index in parallel:

```js
(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;

  renderSidebar('parks');

  const slug = params().get('slug');
  if (!slug) {
    renderError($('#main'), 'No park specified.');
    return;
  }

  let park, index;
  try {
    [park, index] = await Promise.all([
      fetchJSON(`./data/parks/${slug}.json`),
      fetchJSON('./data/index.json'),
    ]);
  } catch (err) {
    renderError($('#main'), `Could not load park "${slug}".`);
    return;
  }

  document.title = `${park.name} · VacationHub`;
  renderHero(park);
  renderQuickFacts(park);
  renderTips(park);

  // (rideFilter declaration + renderRidesSection + matchesFilter + rideCard + priorityBadge + prettyType remain as in Task 12)
```

(Keep all the existing render functions defined after this block.)

Then at the very end of the file's main flow — after `renderRidesSection(park);` — add:

```js
  renderCollections(park, index);

  function renderCollections(p, idx) {
    const root = $('#collections');
    const scoped = idx.collections.filter((c) => c.scope?.park === p.slug);
    if (scoped.length === 0) { root.replaceChildren(); return; }
    root.replaceChildren(
      el('h2', {}, ['Collections']),
      el('div', { class: 'tip-grid' },
        scoped.map((c) =>
          el('a', { class: 'tip-card', href: `./collection.html?slug=${c.slug}` }, [
            el('div', { class: 'tip-card-body' }, [
              el('div', { class: 'tip-card-title', text: c.name }),
              el('div', { class: 'tip-card-meta', text: 'Curated list' }),
            ]),
          ])
        )
      )
    );
  }
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:8000/park.html?slug=magic-kingdom`.
Expected: a "Collections" section after the rides, with one card linking to `collection.html?slug=magic-kingdom-coasters` (which 404s until Task 14).

- [ ] **Step 3: Commit**

```bash
git add vacationhub/park.js
git commit -m "feat(vacationhub): show park-scoped collections on park hub"
```

---

## Task 14: Collection page

**Files:**
- Create: `vacationhub/collection.html`
- Create: `vacationhub/collection.js`
- Create: `vacationhub/data/collections/magic-kingdom-coasters.json`
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Create the collection data**

`vacationhub/data/collections/magic-kingdom-coasters.json`:

```json
{
  "slug": "magic-kingdom-coasters",
  "name": "Magic Kingdom Coasters",
  "scope": { "park": "magic-kingdom" },
  "intro": "Every roller coaster at the Magic Kingdom, ranked by what's worth your time.",
  "rides": [
    { "ride": "tron-lightcycle-run",    "blurb": "Modern Disney's best coaster, even at a short 60 seconds." },
    { "ride": "space-mountain",         "blurb": "The classic. Ride at night with the lights low." },
    { "ride": "big-thunder-mountain",   "blurb": "Family-friendly thrills with the best theming in the park." },
    { "ride": "seven-dwarfs-mine-train","blurb": "Skip unless you have Lightning Lane — the wait isn't worth it." }
  ]
}
```

- [ ] **Step 2: Create the HTML shell**

`vacationhub/collection.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1220">
  <title>Collection · VacationHub</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="app">
    <nav id="sidebar" class="sidebar" aria-label="Primary"></nav>
    <main id="main" class="main">
      <section id="hero" class="hero hero-collection"></section>
      <section id="rides" class="park-section"></section>
    </main>
  </div>
  <script src="./app.js"></script>
  <script src="./collection.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create the collection render script**

`vacationhub/collection.js`:

```js
(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;
  renderSidebar('parks');

  const slug = params().get('slug');
  if (!slug) { renderError($('#main'), 'No collection specified.'); return; }

  let col, index;
  try {
    [col, index] = await Promise.all([
      fetchJSON(`./data/collections/${slug}.json`),
      fetchJSON('./data/index.json'),
    ]);
  } catch (err) {
    renderError($('#main'), `Could not load collection "${slug}".`);
    return;
  }

  // Load every referenced park (collection items may span parks when scope is brand).
  const parkSlugs = new Set();
  if (col.scope?.park) parkSlugs.add(col.scope.park);
  for (const r of col.rides) if (r.park) parkSlugs.add(r.park);

  let parks;
  try {
    parks = Object.fromEntries(
      await Promise.all([...parkSlugs].map(async (s) => [s, await fetchJSON(`./data/parks/${s}.json`)]))
    );
  } catch (err) {
    renderError($('#main'), 'Could not load referenced park data.');
    return;
  }

  document.title = `${col.name} · VacationHub`;
  renderHero(col, index);
  renderRides(col, parks);

  function renderHero(c, idx) {
    const scopeName =
      c.scope?.brand ? idx.brands.find((b) => b.slug === c.scope.brand)?.name :
      c.scope?.park  ? idx.parks.find((p) => p.slug === c.scope.park)?.name : '';
    $('#hero').replaceChildren(
      el('div', { class: 'hero-shade' }),
      el('div', { class: 'hero-content' }, [
        el('div', { class: 'label', text: scopeName || '' }),
        el('h1', { class: 'hero-title', text: c.name }),
        el('p', { class: 'hero-tag', text: c.intro || '' }),
      ])
    );
  }

  function renderRides(c, parksMap) {
    const ownerParkSlug = c.scope?.park;
    const root = $('#rides');

    const items = c.rides.map((entry) => {
      const pSlug = entry.park || ownerParkSlug;
      const p = parksMap[pSlug];
      const r = p?.rides?.find((rd) => rd.slug === entry.ride);
      return { entry, p, r, pSlug };
    }).filter((x) => x.r);

    root.replaceChildren(
      el('div', { class: 'col-list' },
        items.map(({ entry, p, r, pSlug }) =>
          el('a', {
            class: 'col-item',
            href: `./park.html?slug=${pSlug}#ride-${r.slug}`,
          }, [
            el('div', { class: 'col-item-main' }, [
              el('div', { class: 'col-item-park', text: p.name }),
              el('h3', { class: 'col-item-title', text: r.name }),
              el('p', { class: 'col-item-blurb', text: entry.blurb || r.blurb || '' }),
            ]),
            el('div', { class: 'col-item-meta' }, [
              r.height_min_in != null ? el('div', { class: 'meta-pill', text: `${r.height_min_in}"` }) : null,
              r.intensity ? el('div', { class: 'meta-pill', text: '★'.repeat(r.intensity) + '☆'.repeat(5 - r.intensity) }) : null,
              r.priority_access && r.priority_access !== 'none'
                ? el('div', { class: `meta-pill pa-${r.priority_access}` }, [({multipass:'MULTI',premier:'PREMIER','express-unlimited':'EXPRESS'})[r.priority_access] || r.priority_access])
                : null,
            ]),
          ])
        )
      )
    );
  }
})();
```

- [ ] **Step 4: Add collection styles**

Append to `vacationhub/styles.css`:

```css
/* === Collection page === */
.hero-collection { height: 32vh; min-height: 220px; background: linear-gradient(135deg, #0e2a55, #1d6fe0); }
.col-list { display: flex; flex-direction: column; gap: 10px; }
.col-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 18px;
  transition: transform 180ms var(--ease), border-color 180ms var(--ease);
}
.col-item:hover { transform: translateX(4px); border-color: var(--accent); }
.col-item-park {
  font: 700 11px/14px inherit; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-mute); margin-bottom: 4px;
}
.col-item-title { font: 700 17px/22px inherit; margin: 0 0 4px; }
.col-item-blurb { color: var(--text-dim); margin: 0; font-size: 14px; line-height: 20px; font-style: italic; }
.col-item-meta { display: flex; gap: 6px; flex-shrink: 0; }
.meta-pill {
  font: 700 10px/14px inherit;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-elev-2);
  color: var(--text-dim);
  white-space: nowrap;
}
.meta-pill.pa-multipass { background: var(--accent); color: #fff; }
.meta-pill.pa-premier { background: var(--premier); color: #fff; }
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:8000/collection.html?slug=magic-kingdom-coasters`.
Expected: hero with "MAGIC KINGDOM" label, "Magic Kingdom Coasters" title, intro text. Below: 4 list items in the configured order (TRON first, then Space Mountain, Big Thunder, Seven Dwarfs). Each shows height pill, intensity stars, and Lightning Lane badge. Clicking an item navigates to `park.html?slug=magic-kingdom#ride-<slug>`.

Also confirm the deep link: scroll the park page should land on the named ride card (its `id="ride-<slug>"` was set in Task 12).

- [ ] **Step 6: Commit**

```bash
git add vacationhub/collection.html vacationhub/collection.js vacationhub/data/collections/ vacationhub/styles.css
git commit -m "feat(vacationhub): add collection page with deep links to park rides"
```

---

## Task 15: Tip article page (markdown)

**Files:**
- Create: `vacationhub/tip.html`
- Create: `vacationhub/tip.js`
- Create: `vacationhub/data/parks/magic-kingdom/tips/rope-drop.md`
- Create: `vacationhub/data/parks/magic-kingdom/tips/lightning-lane.md`
- Create: `vacationhub/data/parks/magic-kingdom/tips/best-time-to-visit.md`
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Write the three tip markdown files**

`vacationhub/data/parks/magic-kingdom/tips/rope-drop.md`:

```markdown
## Why rope drop matters

The first 60–90 minutes of operation at Magic Kingdom are
*massively* under-utilized. Most guests roll in around 10am,
which means the first ~90 minutes can clear several headliners
that otherwise have 60+ minute waits.

## The route

1. Be at the tap stiles 30 minutes before posted opening.
2. Head straight to **Space Mountain** — the queue forms long
   before the ride opens but moves fast on early entry.
3. From Space Mountain, cross to **TRON Lightcycle / Run** if
   you have a virtual queue boarding pass.
4. End the rope-drop sprint at **Seven Dwarfs Mine Train**,
   which posts its longest wait of the day starting at 10am.

By 9:30am you can have three of the park's longest-wait rides
done before most guests have entered.
```

`vacationhub/data/parks/magic-kingdom/tips/lightning-lane.md`:

```markdown
## Lightning Lane priority order

Disney's paid Lightning Lane system lets you skip the standby
line for select rides. At Magic Kingdom, the best use of your
allotments — in priority order:

1. **Seven Dwarfs Mine Train** — almost always the longest
   standby in the park.
2. **TRON Lightcycle / Run** — requires the Premier (single
   ride) tier; only worth it if you don't snag a virtual queue.
3. **Peter Pan's Flight** — short ride, perpetually long line.
4. **Space Mountain** — only if you couldn't rope-drop it.

Avoid burning a slot on Big Thunder Mountain or Pirates —
those rarely exceed 30 minutes outside peak season.
```

`vacationhub/data/parks/magic-kingdom/tips/best-time-to-visit.md`:

```markdown
## Best weeks to visit Magic Kingdom

The two genuinely-low-crowd windows each year:

- **Mid-January** (the week after Martin Luther King Jr. Day,
  through the end of the month). School is back in session
  everywhere; weather is mild; refurbishments are common but
  manageable.
- **Late August** (the two weeks before Labor Day). Florida is
  miserably hot but lines are at yearly lows.

Avoid: Thanksgiving week, the entire month of December after
the 18th, Easter week, and the second half of June through
mid-July.
```

- [ ] **Step 2: Create the HTML shell**

`vacationhub/tip.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1220">
  <title>Tip · VacationHub</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="app">
    <nav id="sidebar" class="sidebar" aria-label="Primary"></nav>
    <main id="main" class="main">
      <article id="article" class="article"></article>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  <script src="./app.js"></script>
  <script src="./tip.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create the tip render script**

`vacationhub/tip.js`:

```js
(async function () {
  'use strict';
  const { $, el, fetchJSON, fetchText, renderError, renderSidebar, params } = VH;
  renderSidebar('parks');

  const parkSlug = params().get('park');
  const tipSlug = params().get('slug');
  if (!parkSlug || !tipSlug) { renderError($('#main'), 'Missing park or tip slug.'); return; }

  let park, md;
  try {
    [park, md] = await Promise.all([
      fetchJSON(`./data/parks/${parkSlug}.json`),
      fetchText(`./data/parks/${parkSlug}/tips/${tipSlug}.md`),
    ]);
  } catch (err) {
    renderError($('#main'), 'Could not load tip.');
    return;
  }

  const tipMeta = (park.tips || []).find((t) => t.slug === tipSlug);
  if (!tipMeta) { renderError($('#main'), `Tip "${tipSlug}" not listed in park manifest.`); return; }

  document.title = `${tipMeta.title} · ${park.name} · VacationHub`;

  const body = el('div', { class: 'article-body' });
  body.innerHTML = window.marked.parse(md, { mangle: false, headerIds: false });

  $('#article').replaceChildren(
    el('header', { class: 'article-header' }, [
      el('a', { class: 'article-back', href: `./park.html?slug=${park.slug}` }, [`← ${park.name}`]),
      el('h1', { class: 'article-title', text: tipMeta.title }),
      el('div', { class: 'article-meta', text: tipMeta.updated ? `Updated ${tipMeta.updated}` : '' }),
    ]),
    body,
    el('footer', { class: 'article-footer' }, [
      el('a', { class: 'btn-text', href: `./park.html?slug=${park.slug}` }, [`More about ${park.name} →`]),
    ]),
  );
})();
```

- [ ] **Step 4: Add article styles**

Append to `vacationhub/styles.css`:

```css
/* === Article (tip) === */
.article {
  max-width: 720px;
  padding: 48px;
  margin: 0 auto;
}
.article-header { margin-bottom: 24px; }
.article-back {
  font: 600 13px/16px inherit;
  color: var(--accent-hi);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.article-title {
  font: 800 36px/42px inherit;
  letter-spacing: -0.01em;
  margin: 12px 0 8px;
}
.article-meta { color: var(--text-mute); font-size: 13px; }
.article-body { font-size: 16px; line-height: 26px; color: var(--text); }
.article-body h2 { font-size: 22px; line-height: 28px; font-weight: 700; margin: 32px 0 12px; letter-spacing: -0.01em; }
.article-body h3 { font-size: 18px; line-height: 24px; font-weight: 700; margin: 24px 0 8px; }
.article-body p, .article-body ul, .article-body ol { margin: 0 0 16px; }
.article-body ul, .article-body ol { padding-left: 24px; }
.article-body li { margin-bottom: 6px; }
.article-body strong { color: var(--accent-hi); font-weight: 700; }
.article-body em { color: var(--text-dim); }
.article-body code {
  background: var(--bg-elev);
  padding: 1px 6px;
  border-radius: 4px;
  font: 13px/18px ui-monospace, SFMono-Regular, Menlo, monospace;
}
.article-footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); }
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:8000/tip.html?park=magic-kingdom&slug=rope-drop`.
Expected: article page with "← Magic Kingdom" back link, "Rope-drop strategy" title, "Updated 2026-04-12" meta, then the rendered markdown with H2s and an ordered list. Bold text appears in the accent-blue color. Footer has a link back to the park hub.

Repeat for `?slug=lightning-lane` and `?slug=best-time-to-visit` — both should render correctly.

- [ ] **Step 6: Commit**

```bash
git add vacationhub/tip.html vacationhub/tip.js vacationhub/data/parks/magic-kingdom/tips/ vacationhub/styles.css
git commit -m "feat(vacationhub): add tip article page rendered from markdown"
```

---

## Task 16: About page

**Files:**
- Create: `vacationhub/about.html`

- [ ] **Step 1: Write the about page**

`vacationhub/about.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1220">
  <title>About · VacationHub</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="app">
    <nav id="sidebar" class="sidebar" aria-label="Primary"></nav>
    <main id="main" class="main">
      <article class="article">
        <header class="article-header">
          <h1 class="article-title">About VacationHub</h1>
        </header>
        <div class="article-body">
          <p>VacationHub is a personal project that collects useful,
          hard-to-find information about popular vacation destinations.
          V1 focuses on US theme parks. Future versions will cover
          cruises, resorts, and curated experiences.</p>

          <h2>What you'll find here</h2>
          <ul>
            <li><strong>Insider tips</strong> — editorial guidance on rope-drop
              routes, Lightning Lane priority orders, the best times of year
              to visit, and other things that take years of going to figure out.</li>
            <li><strong>Structured ride data</strong> — height requirements,
              intensity, manufacturer, opening year, priority-access tier,
              and accessibility flags for every major attraction.</li>
          </ul>

          <h2>What you won't find here</h2>
          <ul>
            <li>Live wait times or crowd predictions.</li>
            <li>User accounts, ratings, or comments.</li>
            <li>Affiliate links or sponsored content.</li>
          </ul>

          <h2>Corrections</h2>
          <p>Spotted an error? Open an issue on
            <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a>.</p>
        </div>
      </article>
    </main>
  </div>
  <script src="./app.js"></script>
  <script>VH.renderSidebar('about');</script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:8000/about.html`.
Expected: about page renders with the styled article layout; sidebar shows "About" icon active.

- [ ] **Step 3: Commit**

```bash
git add vacationhub/about.html
git commit -m "feat(vacationhub): add about page"
```

---

## Task 17: Search overlay (parks + collections)

**Files:**
- Modify: `vacationhub/app.js` (add `VH.openSearch`)
- Modify: `vacationhub/styles.css`
- Modify: `vacationhub/index.html`, `vacationhub/park.html`, `vacationhub/collection.html`, `vacationhub/tip.html`, `vacationhub/about.html` (add `<div id="search-overlay" class="search-overlay" hidden></div>` if missing)

- [ ] **Step 1: Ensure every page has the search overlay slot**

`index.html` already has it (from Task 1). Add to each of the other four pages, immediately before the `<script src="./app.js"></script>` line:

```html
<div id="search-overlay" class="search-overlay" hidden></div>
```

- [ ] **Step 2: Add search behavior to `app.js`**

Append inside the IIFE in `vacationhub/app.js`, before `window.VH = VH;`:

```js
  // ---- Search overlay ----
  let searchIndex = null;
  let searchOpen = false;

  async function ensureSearchIndex() {
    if (searchIndex) return searchIndex;
    const idx = await VH.fetchJSON('./data/index.json');
    searchIndex = [
      ...idx.parks.map((p) => ({
        kind: 'Park',
        title: p.name,
        subtitle: [p.resort, p.location?.city].filter(Boolean).join(' · '),
        haystack: [p.name, p.resort, p.tagline, p.location?.city, p.location?.state].filter(Boolean).join(' ').toLowerCase(),
        href: `./park.html?slug=${p.slug}`,
      })),
      ...idx.collections.map((c) => ({
        kind: 'Collection',
        title: c.name,
        subtitle: c.scope?.brand ? `Brand · ${c.scope.brand}` : c.scope?.park ? `Park · ${c.scope.park}` : '',
        haystack: c.name.toLowerCase(),
        href: `./collection.html?slug=${c.slug}`,
      })),
    ];
    return searchIndex;
  }

  function renderResults(root, query, items) {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.haystack.includes(q)).slice(0, 30) : [];
    root.replaceChildren(
      ...(filtered.length === 0
        ? [VH.el('div', { class: 'search-empty', text: q ? 'No matches.' : 'Start typing to search parks and collections.' })]
        : filtered.map((r, i) =>
            VH.el('a', { class: 'search-result', href: r.href, 'data-idx': String(i) }, [
              VH.el('div', { class: 'search-result-kind', text: r.kind }),
              VH.el('div', { class: 'search-result-title', text: r.title }),
              VH.el('div', { class: 'search-result-sub', text: r.subtitle }),
            ])
          ))
    );
  }

  VH.openSearch = async () => {
    const overlay = VH.$('#search-overlay');
    if (!overlay) return;
    searchOpen = true;
    overlay.hidden = false;
    overlay.replaceChildren(
      VH.el('div', { class: 'search-panel', onclick: (e) => e.stopPropagation() }, [
        VH.el('input', {
          class: 'search-input', type: 'text', placeholder: 'Search parks and collections',
          'aria-label': 'Search', autofocus: true,
          oninput: (e) => renderResults(resultsEl, e.target.value, items),
          onkeydown: (e) => { if (e.key === 'Escape') VH.closeSearch(); },
        }),
        VH.el('div', { class: 'search-results', id: 'search-results' }),
      ])
    );
    overlay.addEventListener('click', closeOnBackdrop, { once: true });
    const items = await ensureSearchIndex();
    const resultsEl = VH.$('#search-results');
    renderResults(resultsEl, '', items);
    VH.$('.search-input').focus();
  };

  VH.closeSearch = () => {
    const overlay = VH.$('#search-overlay');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.replaceChildren();
    searchOpen = false;
  };

  function closeOnBackdrop(e) {
    if (e.target.id === 'search-overlay') VH.closeSearch();
  }

  // Keyboard: '/' to open, Esc to close
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && !searchOpen && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault(); VH.openSearch();
    } else if (e.key === 'Escape' && searchOpen) {
      VH.closeSearch();
    }
  });
```

- [ ] **Step 3: Add search styles**

Append to `vacationhub/styles.css`:

```css
/* === Search overlay === */
.search-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  z-index: 100;
  display: grid;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
}
.search-overlay[hidden] { display: none; }
.search-panel {
  width: min(640px, 92vw);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
.search-input {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font: 600 18px/24px inherit;
  padding: 18px 20px;
  outline: none;
}
.search-input::placeholder { color: var(--text-mute); }
.search-results { max-height: 60vh; overflow-y: auto; }
.search-result {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
}
.search-result:hover { background: var(--bg-elev-2); }
.search-result-kind {
  font: 700 10px/14px inherit;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-mute);
}
.search-result-title { font-weight: 700; }
.search-result-sub { color: var(--text-dim); font-size: 13px; }
.search-empty { padding: 20px; color: var(--text-mute); text-align: center; }
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:8000/`.
Expected:
- Press `/` → overlay opens with an autofocused input.
- Type "magic" → "Magic Kingdom" and "Magic Kingdom Coasters" both appear.
- Type "xyz" → "No matches."
- Press `Esc` → overlay closes.
- Click outside the panel → overlay closes.
- Click the search icon in the sidebar → overlay opens.
- Repeat the test on `park.html?slug=magic-kingdom` to confirm the overlay also works from other pages.

- [ ] **Step 5: Commit**

```bash
git add vacationhub/app.js vacationhub/styles.css vacationhub/park.html vacationhub/collection.html vacationhub/tip.html vacationhub/about.html
git commit -m "feat(vacationhub): add search overlay across all pages"
```

---

## Task 18: Loading skeletons

**Files:**
- Modify: `vacationhub/home.js`, `vacationhub/park.js`, `vacationhub/collection.js`, `vacationhub/tip.js`

- [ ] **Step 1: Add skeleton render before fetch in `home.js`**

At the top of the IIFE in `home.js`, immediately after `renderSidebar('home');` and before the fetch, add:

```js
  // Skeleton placeholders while we wait
  $('#hero').replaceChildren(VH.el('div', { class: 'skeleton', style: 'width:100%;height:100%' }));
  $('#rails').replaceChildren(
    ...Array.from({ length: 2 }, () =>
      VH.el('section', { class: 'rail' }, [
        VH.el('div', { class: 'rail-header' }, [VH.el('div', { class: 'skeleton', style: 'width:160px;height:24px' })]),
        VH.el('div', { class: 'rail-strip' },
          Array.from({ length: 5 }, () => VH.el('div', { class: 'skeleton', style: 'aspect-ratio:16/9' }))),
      ])
    )
  );
```

- [ ] **Step 2: Add equivalent skeletons to `park.js`**

After `renderSidebar('parks');` and before the fetch:

```js
  $('#hero').replaceChildren(VH.el('div', { class: 'skeleton', style: 'width:100%;height:100%' }));
  $('#quick-facts').replaceChildren(
    ...Array.from({ length: 4 }, () => VH.el('div', { class: 'skeleton', style: 'height:62px' }))
  );
```

- [ ] **Step 3: Add to `collection.js` and `tip.js`**

In `collection.js`, after `renderSidebar('parks');`:

```js
  $('#hero').replaceChildren(VH.el('div', { class: 'skeleton', style: 'width:100%;height:100%' }));
```

In `tip.js`, after `renderSidebar('parks');`:

```js
  $('#article').replaceChildren(
    VH.el('div', { class: 'skeleton', style: 'height:36px;width:60%;margin-bottom:24px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;margin-bottom:8px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;width:80%;margin-bottom:8px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;width:90%;margin-bottom:8px' }),
  );
```

- [ ] **Step 4: Verify by throttling network in DevTools**

Open DevTools → Network tab → set throttling to "Slow 3G". Reload each page. Expected: skeleton placeholders appear for ~1–2 seconds, then real content swaps in.

- [ ] **Step 5: Commit**

```bash
git add vacationhub/home.js vacationhub/park.js vacationhub/collection.js vacationhub/tip.js
git commit -m "feat(vacationhub): add loading skeletons across pages"
```

---

## Task 19: Responsive behavior

**Files:**
- Modify: `vacationhub/styles.css`

- [ ] **Step 1: Add media-query overrides**

Append to `vacationhub/styles.css`:

```css
/* === Responsive: tablet === */
@media (max-width: 1023px) {
  .hero-content, .quick-facts, .chips, .rail, .park-section { padding-left: 24px; padding-right: 24px; }
  .hero-title { font-size: 40px; line-height: 44px; }
  .article { padding: 32px 24px; }
  .rail-strip { grid-auto-columns: minmax(220px, 1fr); }
}

/* === Responsive: mobile === */
@media (max-width: 639px) {
  .app { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 56px; width: 100%;
    flex-direction: row;
    padding: 0 12px;
    gap: 4px;
    overflow-x: auto;
    z-index: 50;
  }
  .sidebar::-webkit-scrollbar { display: none; }
  .side-logo { margin: 0 8px 0 0; }
  .side-item.active::before { left: 6px; right: 6px; top: auto; bottom: -2px; width: auto; height: 2px; }
  .side-divider { display: none; }
  .main { padding-top: 56px; }

  .hero { height: 48vh; min-height: 280px; }
  .hero-title { font-size: 32px; line-height: 36px; }
  .hero-content, .quick-facts, .chips, .rail, .park-section { padding-left: 16px; padding-right: 16px; }
  .rail-strip { grid-auto-columns: 80%; }
  .ride-grid, .tip-grid { grid-template-columns: 1fr; }
  .col-item { grid-template-columns: 1fr; }
  .col-item-meta { justify-content: flex-start; flex-wrap: wrap; }
  .article-title { font-size: 28px; line-height: 32px; }
}
```

- [ ] **Step 2: Verify in browser**

Open DevTools → Device toolbar.
- **iPad (768×1024)**: sidebar still visible on left; padding reduced; rails show ~3 tiles.
- **iPhone (390×844)**: sidebar collapses to a top horizontal bar; rails show one tile with a peek of the next; ride/tip cards stack one per row.

- [ ] **Step 3: Commit**

```bash
git add vacationhub/styles.css
git commit -m "feat(vacationhub): responsive tablet and mobile layouts"
```

---

## Task 20: Accessibility polish and final smoke test

**Files:**
- Modify: `vacationhub/styles.css` (if any contrast gaps surface)
- Modify: per-page scripts (alt text)

- [ ] **Step 1: Verify keyboard navigation across the homepage**

On the homepage, press `Tab` repeatedly. Confirm:
- Focus moves through: logo → sidebar items → chips → rail arrows → tiles.
- Every focused element has a visible 2px blue outline.
- Pressing `Enter` on a focused tile navigates to the park page.
- `/` opens search even when nothing is focused.

- [ ] **Step 2: Verify aria-labels with a screen-reader inspector**

In DevTools → Accessibility tab, inspect:
- Sidebar items announce their full label ("Home", "Search", "Theme Parks", "About").
- Brand chips announce "Disney, button, not pressed" / "All, button, pressed".
- Tiles announce their park name and resort.

- [ ] **Step 3: Run a Lighthouse accessibility audit**

DevTools → Lighthouse → Accessibility only → run on `index.html`, `park.html?slug=magic-kingdom`, `collection.html?slug=magic-kingdom-coasters`, `tip.html?park=magic-kingdom&slug=rope-drop`.
Expected: each scores ≥ 95. Fix any color-contrast or missing-name issues by adjusting `styles.css` or adding `aria-label` attributes.

- [ ] **Step 4: Test `prefers-reduced-motion`**

DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce". Reload. Confirm tiles no longer scale on hover and skeleton pulse stops animating.

- [ ] **Step 5: Smoke test the entire user journey**

Walk through manually:
1. Land on `/` — hero, chips, rails render with real content.
2. Click the Magic Kingdom tile → park hub loads.
3. Open a tip from the park page → tip article renders with markdown.
4. Back-link returns to the park.
5. Open the Magic Kingdom Coasters collection from the park's Collections section.
6. Click TRON in the collection → lands on the park page scrolled to the TRON ride card.
7. Open Search (`/`), search "magic", select Magic Kingdom Coasters.
8. Navigate to About via the sidebar.
9. Hover deferred Cruises/Resorts/Experiences icons — they show tooltip but do not navigate.
10. Refresh `index.html?brand=disney` — chip stays active and rails stay filtered.

If anything in this list fails, fix it and re-run the affected steps before committing.

- [ ] **Step 6: Update README with verified-working notes**

Append to `vacationhub/README.md`:

```markdown
## Status

V1 engine complete with Magic Kingdom as the seed park. The
remaining 14 parks from the design spec are seeded in a
follow-up pass.

## Adding a new park

1. Add the park to `data/index.json` under `parks` (and to
   the relevant home rail under `home.rails`).
2. Create `data/parks/<slug>.json` matching the schema in the
   design spec (see "Ride field reference").
3. Drop `assets/images/parks/<slug>-hero.jpg` (2400×1000) and
   `<slug>-tile.jpg` (800×450).
4. (Optional) Add tip files under
   `data/parks/<slug>/tips/<tip-slug>.md` and matching manifest
   entries in the park JSON's `tips` array.
5. (Optional) Add a collection JSON under
   `data/collections/` and register it in `data/index.json`.
```

- [ ] **Step 7: Commit**

```bash
git add vacationhub/
git commit -m "feat(vacationhub): a11y polish, smoke-test fixes, README status"
```

---

## Done

When all 20 tasks are complete, VacationHub v1 has:

- Five working page templates (`index`, `park`, `collection`, `tip`, `about`).
- The full Disney+-Classic visual system.
- Sidebar nav, brand chips, rails, tiles, tip cards, ride cards, collection items, search overlay.
- Responsive desktop/tablet/mobile.
- Accessibility floor (Lighthouse ≥ 95, full keyboard nav, reduced-motion support).
- Magic Kingdom fully seeded as the reference park, exercising every template and component.

The follow-up plan to seed the remaining 14 parks (Disney WDW + Disneyland, Universal Orlando + Hollywood, LEGOLAND ×2, Cedar Point, Six Flags Magic Mountain, Dollywood) is mostly authoring work using the patterns this plan established — no new engineering.
