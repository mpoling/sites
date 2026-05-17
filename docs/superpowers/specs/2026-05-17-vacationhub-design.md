# VacationHub — Design Spec

**Status:** Draft for v1 (MVP)
**Date:** 2026-05-17
**Site:** `vacationhub/`, served at `vacationhub.<owner-tld>`

## 1. Purpose

VacationHub is a static site that surfaces useful, hard-to-find information
about popular vacation destinations. V1 covers theme parks; the design
anticipates Cruises, Resorts, and Experiences as future sections.

The content value prop is two-pronged:

- **Insider strategy and tips** — editorial guidance (rope-drop routes,
  Lightning Lane priority orders, hidden photo spots, best seasons).
- **Structured reference data** — comprehensive ride lists with height
  requirements, intensity, manufacturer, opening years, priority-access
  tier, accessibility flags, single-rider availability.

Long-form "documentaries" are a planned v2 addition.

## 2. User experience

VacationHub borrows the visual language and interaction patterns of the
Disney+ streaming app, adapted for desktop and mobile web (not TV / remote).
Users browse a dark, cinematic homepage with brand chips and horizontal
content rails, then drill into park hub pages for detail.

The site is read-only. No accounts, no favorites, no comments, no live data.

## 3. Constraints

Inherited from the monorepo (`CLAUDE.md`):

- **Static only.** No bundlers, no transpilers, no build steps. Vanilla
  HTML/CSS/JS only. Third-party JS via CDN where unavoidable.
- **Relative paths only.** The Cloudflare worker rewrites subdomain to a
  subdirectory; that subdirectory must be invisible to the browser.
- **Self-contained.** All files live under `vacationhub/`. No shared assets
  across sites.
- **Modern evergreen browsers only.** No legacy polyfills.

Site-specific:

- **No build pipeline of any kind**, including for content. Author edits
  JSON and Markdown directly; no static-site generator step.
- **No external image hosting.** Park images live in the repo.
- **No web fonts.** System font stack only.

## 4. Architecture

### 4.1 File layout

```
vacationhub/
├── index.html                    # Homepage
├── park.html                     # Park hub template (?slug=...)
├── collection.html               # Collection template (?slug=...)
├── tip.html                      # Tip article template (?park=...&slug=...)
├── about.html                    # About page
├── styles.css                    # Global Disney+-Classic theme
├── app.js                        # Shared: nav, chips, rail renderer, fetch
├── home.js                       # Homepage render
├── park.js                       # Park hub render
├── collection.js                 # Collection render
├── tip.js                        # Tip article render (markdown)
├── data/
│   ├── index.json                # Master index
│   ├── parks/
│   │   ├── magic-kingdom.json    # Per-park structured data
│   │   ├── magic-kingdom/
│   │   │   └── tips/
│   │   │       ├── rope-drop.md
│   │   │       └── lightning-lane.md
│   │   └── ...
│   └── collections/
│       └── <collection-slug>.json
├── assets/
│   └── images/
│       ├── parks/                # <slug>-hero.jpg, <slug>-tile.jpg
│       └── brands/               # <slug>.svg
├── favicon.svg
├── apple-touch-icon-180x180.png
└── README.md
```

### 4.2 Routing

URLs are query-parameter-based on a small set of HTML templates. No pretty
URLs; SEO is not a v1 goal.

| URL                                              | Page         |
| ------------------------------------------------ | ------------ |
| `/`                                              | Homepage     |
| `/park.html?slug=<park>`                         | Park hub     |
| `/collection.html?slug=<collection>`             | Collection   |
| `/tip.html?park=<park>&slug=<tip>`               | Tip article  |
| `/about.html`                                    | About        |

Filter state on the homepage (`?brand=disney`) is also reflected in the URL
so chip selections are shareable and refresh-stable.

### 4.3 Loading pattern

Every page:

1. Fetch `data/index.json`. Cached after first load via HTTP cache.
2. Fetch its page-specific JSON (and any Markdown for tip pages).
3. Render. Show skeleton placeholders while loading.

Sections render independently — a single failed fetch shows an inline error
in that section without blanking the page.

### 4.4 Third-party dependencies

- **`marked`** (~30 KB minified) from a CDN, only on `tip.html`, for
  Markdown rendering.

No other runtime dependencies.

## 5. Data model

### 5.1 `data/index.json`

Master index loaded by every page. Drives homepage rails, sidebar nav, brand
chips, and v1 search.

```json
{
  "brands": [
    {
      "slug": "disney",
      "name": "Disney",
      "logo": "assets/images/brands/disney.svg"
    }
  ],
  "parks": [
    {
      "slug": "magic-kingdom",
      "name": "Magic Kingdom",
      "brand": "disney",
      "resort": "Walt Disney World",
      "location": { "city": "Orlando", "state": "FL", "country": "US" },
      "tile": "assets/images/parks/magic-kingdom-tile.jpg",
      "hero": "assets/images/parks/magic-kingdom-hero.jpg",
      "tagline": "The original Disney park east of California."
    }
  ],
  "collections": [
    {
      "slug": "magic-kingdom-coasters",
      "name": "Magic Kingdom Coasters",
      "scope": { "park": "magic-kingdom" },
      "tile": "assets/images/collections/magic-kingdom-coasters.jpg"
    }
  ],
  "home": {
    "featured": "magic-kingdom",
    "rails": [
      {
        "title": "Featured",
        "type": "park",
        "items": ["magic-kingdom", "epic-universe", "..."]
      },
      {
        "title": "New Openings",
        "type": "park",
        "items": ["epic-universe", "..."]
      },
      {
        "title": "Ride Collections",
        "type": "collection",
        "items": ["magic-kingdom-coasters", "..."]
      }
    ]
  }
}
```

### 5.2 Park file: `data/parks/<slug>.json`

```json
{
  "slug": "magic-kingdom",
  "name": "Magic Kingdom",
  "brand": "disney",
  "resort": "Walt Disney World",
  "location": {
    "city": "Orlando",
    "state": "FL",
    "country": "US",
    "lat": 28.4177,
    "lng": -81.5812
  },
  "opened": 1971,
  "size_acres": 142,
  "official_url": "https://disneyworld.disney.go.com/...",
  "hero": "assets/images/parks/magic-kingdom-hero.jpg",
  "summary": "Short editorial blurb shown under the hero.",
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
      "accessibility": {
        "wheelchair_transfer": false,
        "must_transfer": true,
        "service_animal_ok": false
      },
      "intensity": 3,
      "blurb": "Ride at night for the full effect.",
      "collections": ["magic-kingdom-coasters"]
    }
  ],
  "tips": [
    {
      "slug": "rope-drop",
      "title": "Rope-drop strategy",
      "summary": "Hit Space Mountain before 9:30am.",
      "updated": "2026-04-12"
    }
  ]
}
```

#### 5.2.1 Ride field reference (v1)

| Field             | Type                       | Notes                                                    |
| ----------------- | -------------------------- | -------------------------------------------------------- |
| `slug`            | string                     | Unique within the park. Stable across versions.          |
| `name`            | string                     |                                                          |
| `land`            | string                     | E.g., "Tomorrowland".                                    |
| `type`            | enum                       | `roller-coaster`, `dark-ride`, `water`, `show`, `flat`, `boat`, `transport`, `other` |
| `subtype`         | string                     | Free-form. E.g., `indoor-dark`, `spinning-coaster`.      |
| `manufacturer`    | string                     | Optional.                                                |
| `opened`          | integer (year)             | Optional.                                                |
| `duration_sec`    | integer                    | Optional.                                                |
| `length_ft`       | integer                    | Optional.                                                |
| `top_speed_mph`   | integer                    | Optional.                                                |
| `height_min_in`   | integer                    | Omit if no minimum.                                      |
| `single_rider`    | boolean                    |                                                          |
| `priority_access` | enum                       | `multipass`, `premier`, `express-unlimited`, `none`      |
| `accessibility`   | object                     | See 5.2.                                                 |
| `intensity`       | integer (1–5)              | Editorial judgment.                                      |
| `blurb`           | string                     | One-line take. Shown on ride cards and collection items. |
| `collections`     | array of collection slugs  | The collections this ride belongs to.                    |

Explicitly excluded from v1: `height_max_in`, `rider_swap`, `closed`,
`max_g`, photos, video URLs, live wait times.

### 5.3 Tip file: `data/parks/<park>/tips/<slug>.md`

Plain Markdown, no front-matter. All metadata (title, summary, updated)
lives in the park JSON's `tips` array. The file contains only prose.

### 5.4 Collection file: `data/collections/<slug>.json`

Collections are always scoped to one brand or one park — never cross-brand.

```json
{
  "slug": "magic-kingdom-coasters",
  "name": "Magic Kingdom Coasters",
  "scope": { "park": "magic-kingdom" },
  "intro": "Every coaster at Magic Kingdom, ranked.",
  "rides": [
    { "ride": "space-mountain", "blurb": "The icon." },
    { "ride": "big-thunder-mountain", "blurb": "The wildest ride in the wilderness." }
  ]
}
```

If `scope` is `{ "brand": "disney" }`, each ride entry must include both
`park` and `ride` slugs. If `scope` is `{ "park": "<slug>" }`, the `park`
field is omitted from each entry (always implied).

### 5.5 Identity guarantees

Rides are identified by the pair `(park-slug, ride-slug)`. This identity
must remain stable across the v2 promotion of rides to first-class detail
pages — no schema migration required, only addition.

## 6. Pages

### 6.1 Homepage (`index.html`)

- **Hero band** — featured park (`home.featured`). Full-bleed image, name,
  tagline, "Explore →" CTA linking to the park hub.
- **Brand chip row** — pill chips: "All" + one per brand from `index.json`.
  Active chip filters all rails below client-side. Selection reflects in
  the URL (`?brand=<slug>`).
- **Rails** — rendered from `home.rails`. Each rail: title + horizontal
  scrollable strip of tiles. Three rails in v1: Featured, New Openings,
  Ride Collections. Tiles for parks click to `park.html`; tiles for
  collections click to `collection.html`.

### 6.2 Park hub (`park.html?slug=<park>`)

- **Hero** — park hero image, name, brand badge, location, tagline.
- **Quick-facts strip** — opened year · size in acres · resort name ·
  official site link.
- **Tips section** — cards rendered from the park's `tips` manifest. Click
  opens `tip.html`.
- **Rides section** — **card** view (not table). Filter chips for Land,
  Type, Min Height. Cards show: land label, ride name, type / height /
  intensity meta line, editorial blurb. Priority-access badge in the corner
  when set.
- **Collections section** — tiles for collections scoped to this park.

### 6.3 Collection (`collection.html?slug=<collection>`)

- **Hero strip** — collection name, intro blurb, scope badge ("Disney" or
  the park name).
- **Ride list** — vertical list of ride cards. Each card: ride name, parent
  park (linked), the curator's blurb (from the collection), the ride's
  structured fields (height, intensity, priority access).
- Each card deep-links to its row in the park hub:
  `park.html?slug=<park>#ride-<slug>`.

### 6.4 Tip article (`tip.html?park=<park>&slug=<tip>`)

- Header: tip title, parent park (linked), "Updated <date>".
- Body: Markdown rendered with `marked`.
- Footer: link back to the park hub.

### 6.5 About (`about.html`)

Short page: what VacationHub is, what's covered, how content is sourced,
how to suggest a correction (mailto or GitHub issue link).

## 7. Components

### 7.1 Sidebar nav

Persistent left rail, ~56px wide on desktop/tablet. Collapses to a top
hamburger menu below 640px.

V1 icons (top to bottom):

- **Home** → `index.html`
- **Search** → opens search overlay
- **Theme Parks** → currently `index.html`; reserved as the section landing
  when other sections are added.
- **About** → `about.html`

Reserved/greyed-out (v2): Cruises, Resorts, Experiences.

Active state: 2px accent bar on the left edge of the active icon, brighter
icon fill.

### 7.2 Search overlay

- **V1 scope:** searches `index.json` only — parks (by name, tagline,
  resort) and collections (by name). No ride or tip content search.
- **Keyboard:** `/` opens, `Esc` closes, arrow keys navigate results, Enter
  selects.
- **V2:** prebuilt `data/search.json` index with all rides + tip titles for
  full-content search. Still 100% client-side.

### 7.3 Rails

Reusable component. Horizontal scrollable strip; tile aspect ratio 16:9.

- Snap scrolling, native scroll/swipe on touch.
- Left/right arrow buttons appear on hover for mouse users.
- Tile hover: scale to 1.05, subtle shadow rise, reveal one-line
  description below the title.
- Keyboard: arrow keys navigate between tiles when focus is inside a rail.

### 7.4 Tiles

- **Park tile** — 16:9 hero image, gradient overlay, park name, brand
  badge.
- **Collection tile** — gradient background, collection name, ride count.

### 7.5 Cards

- **Tip card** — image header (or gradient placeholder), title, summary,
  "Updated" meta.
- **Ride card** — image-or-gradient header with land label and priority-
  access badge, ride name, type/height/intensity meta line, editorial
  blurb.

### 7.6 Header bar

None. The sidebar provides global nav; the hero of each page provides
contextual title and identity.

## 8. Visual system — Disney+ Classic

### 8.1 Color tokens

| Token           | Value     | Usage                                    |
| --------------- | --------- | ---------------------------------------- |
| `--bg`          | `#0b1220` | Page background                          |
| `--bg-elev`     | `#0e1729` | Cards                                    |
| `--bg-elev-2`   | `#172236` | Inactive chips, nested elevated surfaces |
| `--border`      | `#1a2338` | Card/table borders                       |
| `--text`        | `#e6edf7` | Body text                                |
| `--text-dim`    | `#9fb0cf` | Secondary text                           |
| `--text-mute`   | `#6e85ad` | Meta / placeholder text                  |
| `--accent`      | `#1d6fe0` | Active states, primary CTA               |
| `--accent-hi`   | `#7eb0ff` | Hover/focus highlight                    |
| `--premier`     | `#7e3ae0` | Lightning Lane Premier badge             |
| `--error`       | `#e05a5a` | Error states                             |
| `--success`     | `#3aa974` | Confirmation states                      |

### 8.2 Typography

System font stack:
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. No web
fonts.

| Style            | Size/Line | Weight | Letter spacing |
| ---------------- | --------- | ------ | -------------- |
| Hero title       | 48/52     | 800    | -0.02em        |
| Page title       | 32/36     | 800    | -0.01em        |
| Section heading  | 18/24     | 700    | normal         |
| Body             | 15/22     | 400    | normal         |
| Meta / dim       | 13/18     | 500    | normal         |
| Label / chip     | 11/14     | 700    | 0.08em UPPER   |

### 8.3 Spacing and radius

- 4px base. Steps: 8, 12, 16, 24, 32, 48, 64.
- Radius: 6 (chips, badges, tiles), 8 (cards), 12 (hero).

### 8.4 Motion

- Tile hover: 200ms ease, `scale(1.05)` + shadow rise.
- Chip select: 120ms color transition.
- Page-load skeleton: 1.4s loop, low amplitude.
- All motion respects `prefers-reduced-motion`: hover scale removed,
  skeleton pulse disabled.

### 8.5 Imagery

Every park needs:

- `<slug>-hero.jpg` — 2400×1000, JPEG, ~200 KB target
- `<slug>-tile.jpg` — 800×450, JPEG, ~60 KB target

Sources: Unsplash, official press kits, owner's own photos. All images
committed to the repo under `assets/images/parks/`.

### 8.6 Accessibility

- All body text passes WCAG AA contrast against `--bg`.
- All interactive elements show a visible focus ring (2px `--accent-hi`
  outline).
- All images carry alt text from JSON (`alt` field on image references).
- Sidebar icons carry `aria-label`s.
- Rails support arrow-key navigation between tiles when focused.

## 9. Responsive behavior

- **Desktop ≥1024px** — sidebar visible; rails show 5–6 tiles.
- **Tablet 640–1023px** — sidebar visible; rails show 3–4 tiles.
- **Mobile <640px** — sidebar collapses to a top hamburger; rails show ~1.5
  tiles (peek of next); chip row scrolls horizontally.

## 10. Loading, errors, and empty states

- **Skeleton tiles** (grey gradient pulse) appear while JSON loads.
- **Per-section errors** — if a JSON fetch fails, that section renders a
  small inline error ("Couldn't load rides — try refreshing") without
  blanking the rest of the page.
- **Empty states** — if a brand filter narrows a rail to zero items, the
  rail is hidden rather than rendered empty.

## 11. v1 launch content

Fifteen parks seeded at launch:

- **Walt Disney World (4)** — Magic Kingdom, Epcot, Hollywood Studios,
  Animal Kingdom
- **Disneyland Resort (2)** — Disneyland, California Adventure
- **Universal Orlando (3)** — Universal Studios FL, Islands of Adventure,
  Epic Universe
- **Universal Hollywood (1)** — Universal Studios Hollywood
- **LEGOLAND (2)** — LEGOLAND California, LEGOLAND Florida
- **Cedar Fair (1)** — Cedar Point
- **Six Flags (1)** — Six Flags Magic Mountain
- **Independent (1)** — Dollywood

Each park ships with: full ride list (all major attractions), 3–5
tip articles, hero and tile images, at least one park-scoped collection.

## 12. Roadmap (post-v1)

Designed-for, not built:

- **Ride detail pages** — promote individual rides to their own
  `ride.html?park=<park>&slug=<ride>` pages. Data model already keys
  rides by `(park-slug, ride-slug)`; this is additive.
- **Documentaries rail** — long-form editorial articles.
- **Full-content search** — prebuilt `data/search.json` index covering
  rides and tip titles.
- **Cruises, Resorts, Experiences** — new top-level sections, each its own
  `<section>.html` template + `data/<section>/` tree, surfaced via the
  sidebar nav.
- **Optional table view toggle** for the rides section.
- **Brand-scoped collections** — currently the data model supports them,
  but no v1 brand-scoped collections are seeded; add when there's enough
  cross-park material per brand to populate one.

## 13. Explicitly out of scope

- Live data of any kind (wait times, crowd predictions, weather, refurb
  status).
- Build pipeline of any kind, including for content.
- User accounts, favorites, saved trips.
- Comments, ratings, community.
- Web fonts.
- SEO / server rendering.
- TV / D-pad ergonomics.
