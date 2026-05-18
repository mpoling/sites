# VacationHub Sveltia CMS Adoption Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sveltia CMS as a content-authoring layer on VacationHub. After this plan ships, the owner's son can edit parks and ride collections from a browser at `vacationhub.<owner-tld>/admin/` without touching JSON, Markdown, or git.

**Architecture:** Sveltia CMS is a client-side JS bundle loaded from a CDN, configured by a single YAML file. It talks directly to the GitHub REST API using a personal access token (PAT) stored in the author's browser. No server, no Cloudflare Worker, no GitHub Action — purely two new files in `vacationhub/admin/`, a `robots.txt`, plus small adjustments to the existing renderer and one data-shape migration.

**Tech Stack:** Sveltia CMS v0.161.1 (CDN, pinned), GitHub REST API, YAML, existing vanilla HTML/CSS/JS site.

**Reference docs:**
- Design spec: [`docs/superpowers/specs/2026-05-17-vacationhub-sveltia-cms-design.md`](../specs/2026-05-17-vacationhub-sveltia-cms-design.md)
- Repo-level CMS architecture: [`CMS.md`](../../../CMS.md)
- VacationHub engine design: [`docs/superpowers/specs/2026-05-17-vacationhub-design.md`](../specs/2026-05-17-vacationhub-design.md)
- Repo conventions: [`CLAUDE.md`](../../../CLAUDE.md) and [`ARCHITECTURE.md`](../../../ARCHITECTURE.md)

**Verification approach:** No test runner in this repo. Every task ends with a manual browser verification step using a local static server. Start it once with:

```bash
cd vacationhub && python3 -m http.server 8000
```

Then open `http://localhost:8000/` (or the relevant page) and confirm the described behavior before committing. Syntax checks (`node --check`, `python3 -m json.tool`, `python3 -c 'import yaml; yaml.safe_load(open("..."))'`) are also called out where applicable.

**Commit style:** Conventional commits, scope `vacationhub`. Each task ends with one commit landing on the working branch.

**Execution isolation:** If executing this plan in a separate session, create a git worktree first using `superpowers:using-git-worktrees`. If executing inline in the same session that wrote this plan, the user can decide.

---

## File Structure Overview

By the end of this plan, the relevant slice of `vacationhub/` looks like:

```
vacationhub/
├── admin/                             # NEW
│   ├── index.html                     # NEW — Sveltia loader, pinned
│   └── config.yml                     # NEW — Parks + Ride Collections schema
├── robots.txt                         # NEW
├── README.md                          # MODIFIED — "Editing content with the CMS" section
├── app.js                             # MODIFIED — creditEl handles object OR HTML string
├── tip.js                             # MODIFIED — reads body inline from park JSON
└── data/
    └── parks/
        ├── magic-kingdom.json         # MODIFIED — tips[*].body inlined
        └── magic-kingdom/             # DELETED (and the tips/ folder inside)
            └── tips/                  # DELETED
                ├── rope-drop.md       # DELETED
                ├── lightning-lane.md  # DELETED
                └── best-time-to-visit.md # DELETED
```

---

## Task 1: Update `creditEl` to accept HTML string format

**Files:**
- Modify: `vacationhub/app.js`

The renderer change is defensive — it handles a credit shape that doesn't yet exist in the data, so it's a safe no-op until Sveltia starts producing HTML credit strings via stock-photo integration. Doing this first means the rest of the plan can land without worrying about regressing existing structured-credit handling.

- [ ] **Step 1: Find the current `VH.creditEl` definition**

Run: `grep -n "VH.creditEl\|VH.imgCredit" vacationhub/app.js`

Expected output: shows the existing definitions, currently around lines 100–115. Confirm the existing shape matches what's quoted in Step 2.

- [ ] **Step 2: Replace `VH.imgCredit` and `VH.creditEl` with versions that accept both shapes**

In `vacationhub/app.js`, find this block:

```js
  // ---- Image helpers ----
  // An image field may be either a string path or { src, credit: { author, license, source } }.
  VH.imgSrc = (img) => (img == null ? '' : typeof img === 'string' ? img : img.src || '');
  VH.imgCredit = (img) => (img && typeof img === 'object' ? img.credit : null) || null;

  VH.creditEl = (img, opts) => {
    const c = VH.imgCredit(img);
    if (!c) return null;
    const text = `© ${c.author}${c.license ? ' · ' + c.license : ''}`;
    const cls = 'img-credit' + (opts && opts.subtle ? ' img-credit-subtle' : '');
    if (c.source) {
      return VH.el('a', { class: cls, href: c.source, target: '_blank', rel: 'noopener noreferrer' }, [text]);
    }
    return VH.el('span', { class: cls }, [text]);
  };
```

Replace it with:

```js
  // ---- Image helpers ----
  // An image field may be either:
  //   - a string path, OR
  //   - { src, credit: <object|string> } where credit is either:
  //       - structured: { author, license, source }
  //       - HTML string: e.g. 'Photo by <a href="...">Name</a> on <a href="...">Unsplash</a>'
  //         (the format Sveltia's stock-photo integrations produce)
  VH.imgSrc = (img) => (img == null ? '' : typeof img === 'string' ? img : img.src || '');
  VH.imgCredit = (img) => (img && typeof img === 'object' ? img.credit : null) || null;

  VH.creditEl = (img, opts) => {
    const c = VH.imgCredit(img);
    if (!c) return null;
    const cls = 'img-credit' + (opts && opts.subtle ? ' img-credit-subtle' : '');

    // Stock-photo HTML credit string (from Sveltia Unsplash/Pexels integration)
    if (typeof c === 'string') {
      return VH.el('span', { class: cls, html: c });
    }

    // Structured credit object (manual entry / Wikimedia)
    const text = `© ${c.author}${c.license ? ' · ' + c.license : ''}`;
    if (c.source) {
      return VH.el('a', { class: cls, href: c.source, target: '_blank', rel: 'noopener noreferrer' }, [text]);
    }
    return VH.el('span', { class: cls }, [text]);
  };
```

- [ ] **Step 3: Run syntax check**

Run: `node --check vacationhub/app.js`
Expected: exits 0 with no output.

- [ ] **Step 4: Smoke-test existing pages still render credits**

Run: `cd vacationhub && python3 -m http.server 8000 > /tmp/vh.log 2>&1 &`
Then: `sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/`
Expected: `200`.
Then open `http://localhost:8000/` in a browser. Expected: homepage renders, Magic Kingdom hero shows the existing credit overlay ("© Backattaxk251 · CC BY-SA 4.0"). No change in appearance; structured credits still render as before.

Stop the server: `pkill -f "http.server 8000"`

- [ ] **Step 5: Commit**

```bash
git add vacationhub/app.js
git commit -m "feat(vacationhub): creditEl accepts HTML string for stock photos"
```

---

## Task 2: Migrate tip `.md` files into the park JSON

**Files:**
- Modify: `vacationhub/data/parks/magic-kingdom.json`
- Modify: `vacationhub/tip.js`
- Delete: `vacationhub/data/parks/magic-kingdom/tips/rope-drop.md`
- Delete: `vacationhub/data/parks/magic-kingdom/tips/lightning-lane.md`
- Delete: `vacationhub/data/parks/magic-kingdom/tips/best-time-to-visit.md`
- Delete: `vacationhub/data/parks/magic-kingdom/tips/` (empty directory)
- Delete: `vacationhub/data/parks/magic-kingdom/` (empty directory)

The data shape change and the renderer change land in a single commit so the site is never broken mid-migration.

- [ ] **Step 1: Verify current state**

Run:
```bash
ls vacationhub/data/parks/magic-kingdom/tips/
python3 -c "
import json
with open('vacationhub/data/parks/magic-kingdom.json') as f:
    p = json.load(f)
print('tip slugs in manifest:', [t['slug'] for t in p['tips']])
print('any have body field?:', any('body' in t for t in p['tips']))
"
```

Expected: 3 .md files listed; tip manifest has 3 entries (`rope-drop`, `lightning-lane`, `best-time-to-visit`); no `body` field yet.

- [ ] **Step 2: Run the migration script**

Save this exact script to `/tmp/vh-inline-tips.py`:

```python
#!/usr/bin/env python3
"""Inline tip .md bodies into magic-kingdom.json's tips[] manifest."""
import json
from pathlib import Path

PARK_JSON = Path("vacationhub/data/parks/magic-kingdom.json")
TIPS_DIR = Path("vacationhub/data/parks/magic-kingdom/tips")

with PARK_JSON.open() as f:
    park = json.load(f)

for tip in park["tips"]:
    md_path = TIPS_DIR / f"{tip['slug']}.md"
    if not md_path.exists():
        raise SystemExit(f"Missing tip file: {md_path}")
    tip["body"] = md_path.read_text()

with PARK_JSON.open("w") as f:
    json.dump(park, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"Inlined {len(park['tips'])} tip bodies into {PARK_JSON}")
```

Then run it from the repo root:

```bash
python3 /tmp/vh-inline-tips.py
```

Expected: `Inlined 3 tip bodies into vacationhub/data/parks/magic-kingdom.json`

- [ ] **Step 3: Verify the JSON is valid and bodies are present**

Run:
```bash
python3 -m json.tool vacationhub/data/parks/magic-kingdom.json > /dev/null && echo "JSON OK"
python3 -c "
import json
with open('vacationhub/data/parks/magic-kingdom.json') as f: p = json.load(f)
for t in p['tips']:
    print(f\"  {t['slug']}: body={len(t['body'])} chars\")
"
```

Expected: "JSON OK", three lines showing each tip slug with a non-zero body length (around 400–800 chars each).

- [ ] **Step 4: Delete the now-orphaned .md files and empty directories**

Run:
```bash
rm vacationhub/data/parks/magic-kingdom/tips/rope-drop.md
rm vacationhub/data/parks/magic-kingdom/tips/lightning-lane.md
rm vacationhub/data/parks/magic-kingdom/tips/best-time-to-visit.md
rmdir vacationhub/data/parks/magic-kingdom/tips
rmdir vacationhub/data/parks/magic-kingdom
ls vacationhub/data/parks/
```

Expected: `magic-kingdom.json` only (no `magic-kingdom/` directory).

- [ ] **Step 5: Update `tip.js` to read body inline**

Find the current top of `vacationhub/tip.js` (the destructure + fetch block near the top of the IIFE). It looks like:

```js
(async function () {
  'use strict';
  const { $, el, fetchJSON, fetchText, renderError, renderSidebar, params } = VH;
  renderSidebar('parks');

  // Skeleton placeholders while we wait
  $('#article').replaceChildren(
    VH.el('div', { class: 'skeleton', style: 'height:36px;width:60%;margin-bottom:24px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;margin-bottom:8px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;width:80%;margin-bottom:8px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;width:90%;margin-bottom:8px' }),
  );

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
  body.innerHTML = window.marked.parse(md);
```

Replace the block from `let park, md;` through `body.innerHTML = window.marked.parse(md);` with:

```js
  let park;
  try {
    park = await fetchJSON(`./data/parks/${parkSlug}.json`);
  } catch (err) {
    renderError($('#main'), 'Could not load tip.');
    return;
  }

  const tipMeta = (park.tips || []).find((t) => t.slug === tipSlug);
  if (!tipMeta) { renderError($('#main'), `Tip "${tipSlug}" not listed in park manifest.`); return; }

  document.title = `${tipMeta.title} · ${park.name} · VacationHub`;

  const body = el('div', { class: 'article-body' });
  body.innerHTML = window.marked.parse(tipMeta.body || '');
```

Also remove `fetchText` from the destructure at the top — change:

```js
  const { $, el, fetchJSON, fetchText, renderError, renderSidebar, params } = VH;
```

to:

```js
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;
```

- [ ] **Step 6: Syntax check**

Run: `node --check vacationhub/tip.js`
Expected: exits 0 with no output.

- [ ] **Step 7: Smoke-test all three tip pages**

Run:
```bash
cd vacationhub && python3 -m http.server 8000 > /tmp/vh.log 2>&1 &
sleep 1
for slug in rope-drop lightning-lane best-time-to-visit; do
  printf "  %-30s " "$slug"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/tip.html?park=magic-kingdom&slug=$slug"
done
pkill -f "http.server 8000"
```

Expected: all three return `200`.

Now open each tip in a browser (`http://localhost:8000/tip.html?park=magic-kingdom&slug=rope-drop` etc.) and confirm the article renders with headings, paragraphs, and lists — same content as before the migration, just sourced from the inlined `body` field.

- [ ] **Step 8: Commit**

```bash
git add vacationhub/data/parks/magic-kingdom.json vacationhub/tip.js
git add -u vacationhub/data/parks/magic-kingdom/  # picks up the deletions
git commit -m "feat(vacationhub): inline tip bodies into park JSON, drop .md files"
```

Verify the commit dropped the .md files:

```bash
git show --stat HEAD | grep "magic-kingdom"
```

Expected: shows the JSON modification plus three .md deletions.

---

## Task 3: Create the Sveltia loader HTML

**Files:**
- Create: `vacationhub/admin/index.html`

- [ ] **Step 1: Create the admin directory**

Run: `mkdir -p vacationhub/admin`

- [ ] **Step 2: Write the loader HTML**

Create `vacationhub/admin/index.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1220">
  <meta name="robots" content="noindex,nofollow">
  <title>VacationHub · Admin</title>
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">
</head>
<body>
  <script type="module"
          src="https://unpkg.com/@sveltia/cms@0.161.1/dist/sveltia-cms.js"></script>
</body>
</html>
```

Notes for the implementer:
- The version is **pinned** to `0.161.1`. Do NOT use `@latest`.
- `<meta name="robots" content="noindex,nofollow">` is belt-and-suspenders alongside the `robots.txt` we add in Task 5.
- The favicon path is `../favicon.svg` because we're one directory deeper than the site root.

- [ ] **Step 3: Verify the file**

Run:
```bash
python3 -c "from html.parser import HTMLParser; HTMLParser().feed(open('vacationhub/admin/index.html').read()); print('HTML OK')"
```

Expected: `HTML OK`.

- [ ] **Step 4: Smoke-test the route serves**

Run:
```bash
cd vacationhub && python3 -m http.server 8000 > /tmp/vh.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "/admin/         HTTP %{http_code}\n" "http://localhost:8000/admin/"
curl -s -o /dev/null -w "/admin/index.html HTTP %{http_code}\n" "http://localhost:8000/admin/index.html"
pkill -f "http.server 8000"
```

Expected: both return `200`.

(The CMS itself won't successfully load against `localhost` because Sveltia needs to hit the live `mpoling/sites` repo via GitHub API and PAT, which doesn't make sense for local files. That's verified in the human smoke test at the end. For now we just confirm the file serves.)

- [ ] **Step 5: Commit**

```bash
git add vacationhub/admin/index.html
git commit -m "feat(vacationhub): add Sveltia CMS loader at /admin/"
```

---

## Task 4: Write the Sveltia config

**Files:**
- Create: `vacationhub/admin/config.yml`

This is the largest single file in the plan. It declares the two collections (Parks and Ride Collections) with all their fields, exactly matching the schema in spec §6.

- [ ] **Step 1: Create the config file**

Create `vacationhub/admin/config.yml` with this exact content:

```yaml
backend:
  name: github
  repo: mpoling/sites
  branch: main
  auth_type: pat

site_url: https://vacationhub.<owner-tld>

media_folder: vacationhub/assets/images/uploads
public_folder: ./assets/images/uploads

media_library:
  config:
    slugify_filename: true

collections:
  # ============================== PARKS ==============================
  - name: parks
    label: Parks
    label_singular: Park
    folder: vacationhub/data/parks
    create: true
    delete: true
    slug: '{{slug}}'
    format: json
    identifier_field: slug
    summary: '{{name}} ({{brand}})'
    fields:
      # --- Identity ---
      - { name: slug, label: Slug, widget: string,
          hint: "URL slug — lowercase, hyphens only (e.g. magic-kingdom)" }
      - { name: name, label: Park name, widget: string }
      - name: brand
        label: Brand
        widget: select
        options: [disney, universal, legoland, cedar-fair, six-flags, dollywood]
      - { name: resort, label: Resort name, widget: string, required: false }

      # --- Location ---
      - name: location
        label: Location
        widget: object
        fields:
          - { name: city, label: City, widget: string }
          - { name: state, label: State / Province, widget: string }
          - { name: country, label: Country, widget: string, default: US }
          - { name: lat, label: Latitude, widget: number, required: false, value_type: float }
          - { name: lng, label: Longitude, widget: number, required: false, value_type: float }

      # --- Basics ---
      - { name: opened, label: Year opened, widget: number, required: false, value_type: int }
      - { name: size_acres, label: Size (acres), widget: number, required: false, value_type: int }
      - { name: official_url, label: Official site URL, widget: string, required: false }
      - { name: summary, label: Editorial summary, widget: text }

      # --- Hero image ---
      - name: hero
        label: Hero image (2400×1000)
        widget: object
        fields:
          - name: src
            label: Image
            widget: image
            media_folder: /vacationhub/assets/images/parks
            public_folder: ./assets/images/parks
            choose_url: false
          - name: credit
            label: Credit
            widget: object
            fields:
              - { name: author, label: Photographer, widget: string }
              - { name: license, label: License, widget: string,
                  hint: "e.g. CC BY-SA 4.0, CC0, Self" }
              - { name: source, label: Source URL, widget: string, required: false }

      # --- Rides ---
      - name: rides
        label: Rides
        widget: list
        label_singular: Ride
        summary: '{{fields.name}} ({{fields.land}})'
        fields:
          - { name: slug, label: Slug, widget: string }
          - { name: name, label: Name, widget: string }
          - { name: land, label: Land, widget: string }
          - name: type
            label: Type
            widget: select
            options: [roller-coaster, dark-ride, water, show, flat, boat, transport, other]
          - { name: subtype, label: Subtype, widget: string, required: false,
              hint: "Free-form — e.g. indoor-dark, mine-train, launched" }
          - { name: manufacturer, label: Manufacturer, widget: string, required: false }
          - { name: opened, label: Year opened, widget: number, required: false, value_type: int }
          - { name: duration_sec, label: Duration (sec), widget: number, required: false, value_type: int }
          - { name: length_ft, label: Length (ft), widget: number, required: false, value_type: int }
          - { name: top_speed_mph, label: Top speed (mph), widget: number, required: false, value_type: int }
          - { name: height_min_in, label: Min height (in), widget: number, required: false, value_type: int }
          - { name: single_rider, label: Single rider lane, widget: boolean, default: false }
          - name: priority_access
            label: Priority access tier
            widget: select
            options: [none, multipass, premier, express-unlimited]
            default: none
          - name: accessibility
            label: Accessibility
            widget: object
            fields:
              - { name: wheelchair_transfer, label: Wheelchair transfer, widget: boolean, default: false }
              - { name: must_transfer, label: Must transfer, widget: boolean, default: false }
              - { name: service_animal_ok, label: Service animals OK, widget: boolean, default: false }
          - name: intensity
            label: Intensity (1–5)
            widget: number
            value_type: int
            min: 1
            max: 5
          - { name: blurb, label: One-line take, widget: string }
          - name: collections
            label: Member of collections
            widget: relation
            collection: collections
            multiple: true
            search_fields: [name]
            value_field: slug
            display_fields: [name]
            required: false
          - name: photo
            label: Photo (800×450)
            widget: object
            required: false
            fields:
              - name: src
                label: Image
                widget: image
                media_folder: /vacationhub/assets/images/rides/{{fields.slug}}
                public_folder: ./assets/images/rides/{{fields.slug}}
              - name: credit
                label: Credit
                widget: object
                fields:
                  - { name: author, label: Photographer, widget: string, required: false }
                  - { name: license, label: License, widget: string, required: false }
                  - { name: source, label: Source URL, widget: string, required: false }

      # --- Tips (with inlined body) ---
      - name: tips
        label: Tips
        widget: list
        label_singular: Tip
        summary: '{{fields.title}}'
        fields:
          - { name: slug, label: Slug, widget: string,
              hint: "URL slug — e.g. rope-drop" }
          - { name: title, label: Title, widget: string }
          - { name: summary, label: Summary (one sentence), widget: string }
          - { name: updated, label: Last updated, widget: datetime,
              format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: false }
          - name: body
            label: Body
            widget: markdown
            modes: [raw]
            hint: "Markdown. Headings use ## and ###. Lists with -. Bold with **text**."

  # ============================== COLLECTIONS ==============================
  - name: collections
    label: Ride collections
    label_singular: Collection
    folder: vacationhub/data/collections
    create: true
    delete: true
    slug: '{{slug}}'
    format: json
    identifier_field: slug
    summary: '{{name}}'
    fields:
      - { name: slug, label: Slug, widget: string }
      - { name: name, label: Name, widget: string }
      - name: scope
        label: Scope
        widget: object
        hint: "Fill EITHER park OR brand, never both."
        fields:
          - name: park
            label: Park (if park-scoped)
            widget: relation
            collection: parks
            search_fields: [name]
            value_field: slug
            display_fields: [name]
            required: false
          - { name: brand, label: Brand (if brand-scoped), widget: string, required: false,
              hint: "e.g. disney, universal" }
      - { name: intro, label: Intro blurb, widget: text }
      - name: tile
        label: Tile image (800×450)
        widget: object
        required: false
        fields:
          - name: src
            label: Image
            widget: image
            media_folder: /vacationhub/assets/images/collections
            public_folder: ./assets/images/collections
          - name: credit
            label: Credit
            widget: object
            fields:
              - { name: author, label: Photographer, widget: string, required: false }
              - { name: license, label: License, widget: string, required: false }
              - { name: source, label: Source URL, widget: string, required: false }
      - name: rides
        label: Rides in this collection
        widget: list
        summary: '{{fields.ride}}'
        fields:
          - name: park
            label: Park (only for cross-park / brand-scoped collections)
            widget: relation
            collection: parks
            value_field: slug
            display_fields: [name]
            required: false
            hint: "Leave blank when the collection's scope is a single park."
          - { name: ride, label: Ride slug, widget: string }
          - { name: blurb, label: Curator blurb, widget: string }
```

- [ ] **Step 2: Verify YAML parses**

Run:
```bash
python3 -c "
import yaml
with open('vacationhub/admin/config.yml') as f:
    cfg = yaml.safe_load(f)
print('YAML OK')
print('  backend:', cfg['backend']['name'], '/', cfg['backend']['auth_type'])
print('  collections:', [c['name'] for c in cfg['collections']])
parks = next(c for c in cfg['collections'] if c['name'] == 'parks')
print('  parks fields (top-level):', [f.get('name') for f in parks['fields']])
"
```

Expected: `YAML OK`, then lines confirming backend is `github / pat`, collections are `['parks', 'collections']`, and parks fields include `slug, name, brand, resort, location, opened, size_acres, official_url, summary, hero, rides, tips`.

- [ ] **Step 3: Verify the route serves the config**

Run:
```bash
cd vacationhub && python3 -m http.server 8000 > /tmp/vh.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "/admin/config.yml HTTP %{http_code}, %{size_download}b\n" "http://localhost:8000/admin/config.yml"
pkill -f "http.server 8000"
```

Expected: HTTP 200, byte count in the ~9000–12000 range.

- [ ] **Step 4: Commit**

```bash
git add vacationhub/admin/config.yml
git commit -m "feat(vacationhub): add Sveltia config for parks + ride collections"
```

---

## Task 5: Add `robots.txt`

**Files:**
- Create: `vacationhub/robots.txt`

- [ ] **Step 1: Write the file**

Create `vacationhub/robots.txt` with this exact content:

```
User-agent: *
Disallow: /admin/
```

- [ ] **Step 2: Verify the route serves it**

Run:
```bash
cd vacationhub && python3 -m http.server 8000 > /tmp/vh.log 2>&1 &
sleep 1
curl -s "http://localhost:8000/robots.txt"
pkill -f "http.server 8000"
```

Expected: the two lines above printed back.

- [ ] **Step 3: Commit**

```bash
git add vacationhub/robots.txt
git commit -m "feat(vacationhub): add robots.txt disallowing /admin/"
```

---

## Task 6: Author-facing README section

**Files:**
- Modify: `vacationhub/README.md`

- [ ] **Step 1: Find the insertion point**

Run: `grep -n "^## " vacationhub/README.md`

Expected: lists existing section headings. The new section goes between "Conventions" and "Status".

- [ ] **Step 2: Add the section**

In `vacationhub/README.md`, find this block:

```markdown
## Conventions

All paths in HTML/JS are **relative** — the Cloudflare worker
rewrites `vacationhub.<owner-tld>` to `/sites/vacationhub/`
under the hood, so absolute paths break.

## Status
```

Insert this new section between them, so the file reads:

```markdown
## Conventions

All paths in HTML/JS are **relative** — the Cloudflare worker
rewrites `vacationhub.<owner-tld>` to `/sites/vacationhub/`
under the hood, so absolute paths break.

## Editing content with the CMS

VacationHub uses [Sveltia CMS](https://github.com/sveltia/sveltia-cms) for
content authoring. You don't need to touch JSON files or use a terminal.

### One-time setup

1. Sign in to GitHub with the account that's a collaborator on
   `mpoling/sites`.
2. Go to https://github.com/settings/personal-access-tokens/new
3. Create a fine-grained token:
   - **Resource owner**: your GitHub account
   - **Repository access**: Only select repositories → `mpoling/sites`
   - **Permissions** → Repository permissions:
     - **Contents**: Read and write
     - **Metadata**: Read-only (auto-selected)
   - **Expiration**: 1 year (renew when it expires)
4. Click Generate token. **Copy the token now** — GitHub only shows it
   once.
5. Treat the token like a password. Don't paste it into chat, email,
   or any file.

### Logging in

1. Open https://vacationhub.<owner-tld>/admin/
2. Choose "Log in with Personal Access Token"
3. Paste the token. Sveltia stores it in your browser only.

### Editing a park

1. Click **Parks** in the sidebar.
2. Pick a park to edit, or click **New Park**.
3. Fill out the fields. Image uploads land in the right repo path
   automatically.
4. Click **Save**. The change commits to `main` and goes live on the
   site in about a minute.

### Editing a collection

1. Click **Ride collections** in the sidebar.
2. Same flow: edit existing or create new, save when done.

### When something looks wrong

- The site cached an old version → hard refresh (Cmd/Ctrl+Shift+R).
- The save failed silently → refresh the editor and try again.
- You added a field that doesn't show up on the site → ping the
  developer; the renderer might need an update.

## Status
```

- [ ] **Step 3: Verify it's in place**

Run: `grep -n "Editing content with the CMS\|Status" vacationhub/README.md`

Expected: shows the new heading appearing before "Status".

- [ ] **Step 4: Commit**

```bash
git add vacationhub/README.md
git commit -m "docs(vacationhub): README section on editing with the CMS"
```

---

## Task 7: Human smoke test (browser + live deploy)

**Files:** none modified.

This task requires a human in a real browser running against the live deploy on `vacationhub.<owner-tld>` (not localhost). Sveltia needs to authenticate against GitHub's REST API, which requires a real domain and a real PAT against the real `mpoling/sites` repo.

The implementer should hand off to the user with the test checklist below. The user runs through it and reports back.

- [ ] **Step 1: Confirm the branch is pushed to GitHub**

If this plan was executed on a branch, push it to GitHub first so the live deploy includes the new files. (If executed on `main`, the GitHub Pages deploy is already in flight.)

Wait ~2 minutes after the push for GitHub Pages to publish, then verify:

```bash
curl -s -o /dev/null -w "/admin/         %{http_code}\n" "https://vacationhub.<owner-tld>/admin/"
curl -s -o /dev/null -w "/admin/config.yml %{http_code}\n" "https://vacationhub.<owner-tld>/admin/config.yml"
curl -s -o /dev/null -w "/robots.txt     %{http_code}\n" "https://vacationhub.<owner-tld>/robots.txt"
```

Expected: all three return `200`.

- [ ] **Step 2: Create a fine-grained PAT**

Follow the steps in `vacationhub/README.md` § "Editing content with the CMS" → "One-time setup". Copy the token (you'll only see it once).

- [ ] **Step 3: Load the admin page**

Open `https://vacationhub.<owner-tld>/admin/` in a desktop browser.

Expected:
- Sveltia login screen renders (the page is a dark UI with a "Log in" button).
- Browser console (DevTools) shows no fatal errors.

- [ ] **Step 4: Log in with the PAT**

Click "Log in with Personal Access Token" (or equivalent). Paste the PAT. Click Log In.

Expected: editor loads, showing **Parks** and **Ride collections** in the left sidebar.

- [ ] **Step 5: Verify the parks collection**

Click **Parks**.

Expected:
- Magic Kingdom appears as the single entry, with summary "Magic Kingdom (disney)".
- Clicking it opens the editor showing all fields populated: slug, name, brand (Disney), resort, location, opened, size, summary, hero (image + credit), 8 rides, 3 tips.
- The rides list shows summaries like "Space Mountain (Tomorrowland)".
- The tips list shows the three tip titles. Clicking a tip expands its sub-fields including the inline `body` Markdown.

- [ ] **Step 6: Verify the collections collection**

Click **Ride collections**.

Expected:
- "Magic Kingdom Coasters" appears as the single entry.
- Opens with scope.park populated as a dropdown showing "Magic Kingdom", intro blurb, tile image+credit, and 4 ride entries.

- [ ] **Step 7: Edit, save, and verify it goes live**

In Magic Kingdom, append a single dot to the editorial summary (`. → ..`). Click **Save**.

Expected:
- Save completes without errors.
- A new commit appears on `main` at https://github.com/mpoling/sites/commits/main (attributed to the PAT holder).
- Within ~60 seconds, `https://vacationhub.<owner-tld>/park.html?slug=magic-kingdom` shows the updated summary.

Revert the change in the editor (remove the extra dot, save again) so the content goes back to its intended state.

- [ ] **Step 8: Verify the tip pages still render**

Open `https://vacationhub.<owner-tld>/tip.html?park=magic-kingdom&slug=rope-drop` in a browser.

Expected: the article renders with headings, ordered list, paragraphs — same as before the migration, but now sourced from the inlined `body` field in the park JSON.

Repeat for `?slug=lightning-lane` and `?slug=best-time-to-visit`.

- [ ] **Step 9: Verify robots.txt**

Run: `curl -s "https://vacationhub.<owner-tld>/robots.txt"`

Expected:
```
User-agent: *
Disallow: /admin/
```

- [ ] **Step 10: Verify image credit overlays still render**

Open `https://vacationhub.<owner-tld>/` and confirm the Magic Kingdom hero shows the credit overlay ("© Backattaxk251 · CC BY-SA 4.0"). Hover over a ride card on the park page and confirm ride photo credits fade in.

- [ ] **Step 11: Confirm the rest of the site is unchanged**

Walk the engine smoke-test journey to confirm the CMS adoption didn't regress anything:

1. Open `https://vacationhub.<owner-tld>/` — hero, brand chips, three rails (Featured, New Openings, Ride Collections) all render.
2. Click the Magic Kingdom tile → park hub loads with hero, quick facts, tips, rides, collections.
3. From the park page, open the Magic Kingdom Coasters collection → list of ride cards with deep links back to the park page.
4. Click a ride in the collection (e.g. TRON) → lands on the park page scrolled to the named ride card.
5. Open Search (press `/`), type "magic" → both "Magic Kingdom" and "Magic Kingdom Coasters" appear in results.
6. Navigate to About via the sidebar → about page renders.

Any regression here is a blocker; report it in Step 12.

- [ ] **Step 12: Report back**

If all the above pass, the CMS adoption is complete. If any step fails, capture:
- The step number
- The exact symptom (screenshot if it's a UI issue, error message text if it's a console error)
- What you expected vs. what happened

Common failure modes and where to look:

| Symptom | Likely cause | First place to check |
|---|---|---|
| /admin/ returns 404 | branch not pushed, or GitHub Pages still building | Wait, then `curl` to confirm |
| Sveltia login screen never appears | CDN script failed to load | Browser DevTools → Network tab → look for sveltia-cms.js |
| Login fails with "401" or "403" | PAT scope wrong | Recreate PAT with Contents: Read+Write, Metadata: Read |
| Parks list is empty | repo/branch in config.yml wrong | Check `vacationhub/admin/config.yml` backend.repo and backend.branch |
| Save fails silently | known Sveltia bug class | Refresh editor, try again |
| Tip pages show blank body | body field missing on a tip | Check `magic-kingdom.json` tips[i].body |

---

## Done

When all 7 tasks are complete and the smoke test passes:

- `vacationhub.<owner-tld>/admin/` is a working content editor for the owner's son.
- Parks and Ride collections are editable through forms.
- Image uploads land in the correct repo paths with browser-side resize and EXIF handling.
- Saves commit to `main` and go live within ~1 minute.
- Tip bodies are inlined into park JSON; the old per-tip `.md` files are gone.
- The renderer accepts credit as either structured object or HTML string, so future Sveltia stock-photo selections work without further code changes.
- `/admin/` is gated by PAT login and disallowed in `robots.txt`.
- The author has a README to walk them through one-time setup and day-to-day editing.

The adoption is data-preserving and reversible per the rollback plan in the design spec §10.
