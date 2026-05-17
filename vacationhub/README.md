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
