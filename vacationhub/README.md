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
- Images: `assets/images/parks/<slug>-{hero,tile}.jpg`,
  `assets/images/rides/<park>/<ride>.jpg`,
  `assets/images/collections/<slug>.jpg`

Every image field accepts either a path string OR an object
`{ src, credit: { author, license, source } }` — see §5.6 of the
design spec. Use CC BY, CC BY-SA, CC0, or Public Domain only;
no press-kit photos.

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
