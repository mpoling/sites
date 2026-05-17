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
