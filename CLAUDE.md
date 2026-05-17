# CLAUDE.md

`sites` is a multi-site monorepo for personal static websites. Each top-level
directory is an independent site, deployed as-is by GitHub Pages and routed
to a custom subdomain by a Cloudflare Worker on the owner's TLD.

## Architecture

```
<subdomain>.<owner-tld>   ──Cloudflare Worker──▶   github.io/sites/<subdomain>/...
```

The worker reads the subdomain portion of the request hostname and rewrites
the path to the matching top-level directory in this repo. So a request to
`ondeck.<owner-tld>/data/games.json` is served from
`sites/ondeck/data/games.json`.

The worker is configured outside this repo. Nothing in here references it
directly, but its behavior shapes several rules below — most importantly,
the subdirectory must be invisible to the browser.

## Deployment

GitHub Pages serves the **entire repo root** from the `main` branch
(Settings → Pages → Source: `main` / `/`). Every site directory is
published at `https://<owner>.github.io/sites/<site>/`, and the
Cloudflare Worker rewrites `<site>.<owner-tld>` → that path. There's no
per-site Pages config — adding a new top-level directory and pushing to
`main` is the whole deploy.

Two practical consequences:

- **A push to `main` ships every site at once.** There is no per-site
  staging. Keep changes scoped (see "When working in this repo" below).
- **`.nojekyll` at the repo root** disables Jekyll processing so files or
  directories starting with `_` are served as-is. Don't remove it.

Nothing on the Cloudflare side is unusual — no custom cache rules, no
fallbacks. If a site stops resolving, suspect Pages (build status, source
branch) before the worker.

## Repo layout

```
sites/
├── CLAUDE.md
├── .github/workflows/             # All workflow YAMLs (see conventions)
├── ondeck/                        # One directory = one site
│   ├── index.html
│   ├── ...
│   └── README.md
└── <future-site>/
```

Each site directory is its own project root, with its own assets, scripts,
and README.

## Site conventions

**Static only.** No bundlers, no transpilers, no build steps. These deploy
as-is. Prefer vanilla HTML/CSS/JS, fonts from a CDN, libraries from a CDN.
If a task seems to need a build pipeline, surface that question before
adding one.

**Relative paths only.** Because the Cloudflare worker rewrites the
subdomain to a subdirectory, the directory must be invisible to the browser.
Use `./styles.css`, not `/styles.css` or `/sites/<site>/styles.css`. Same
for `fetch()` calls, `<img src>`, anchor hrefs, and everywhere else.

**Self-contained.** A site's files live entirely within its directory. No
shared CSS, shared JS, or shared assets across sites. If two sites
genuinely want the same thing, that's a future refactor conversation — not
the default.

**One README per site.** Each site directory has a `README.md` covering
purpose, layout, setup, and operational quirks.

**Modern evergreen browsers** are the only target. No IE, no legacy
polyfills, no transpilation for older runtimes.

## GitHub Actions conventions

GitHub Actions only discovers workflow files placed *directly* in
`.github/workflows/` — nesting into `.github/workflows/<site>/` is invisible
to the runner. To keep workflows logically scoped to a single site despite
this constraint:

- **Filename**: prefix with site name. `<site>-<purpose>.yml`. Example:
  `ondeck-update-games.yml`.
- **Working directory**: declare the site as the default working directory
  so scripts can use relative paths.
  ```yaml
  defaults:
    run:
      working-directory: ./<site>
  ```
- **Push trigger paths**: scope to the site's files plus its own workflow.
  ```yaml
  on:
    push:
      paths:
        - '<site>/**'
        - '.github/workflows/<site>-*.yml'
  ```
- **Concurrency group**: site-scoped, so per-site workflows can't trip over
  each other.
  ```yaml
  concurrency:
    group: <purpose>-<site>
  ```
- **Bot commits**: workflows that commit back to the repo use Conventional
  Commits with site scope and the `[skip ci]` token to prevent the bot's
  push from re-triggering its own workflow.
  ```
  chore(<site>): <message> [skip ci]
  ```
- **Permissions**: workflows that push need `permissions: { contents: write }`.
- **Bot identity**: commits use the github-actions bot
  (`github-actions[bot]`, email
  `41898282+github-actions[bot]@users.noreply.github.com`).
- **Cron times**: default to early-morning Pacific (the owner's timezone)
  and use off-round minutes to be polite to upstream APIs.

## Data pipeline pattern

Several sites need data that updates on a schedule (sports schedules,
feeds, etc.). The pattern is: a workflow runs a fetch script on cron,
writes a clean JSON file under `<site>/data/`, and commits it back to
`main`. The static page reads that JSON at runtime via relative `fetch()`.

This keeps the site truly static — no CORS issues, no API keys in the
client, instant page loads — and trades immediacy for simplicity.
Refreshes are bound to the cron cadence, which is fine for slow-moving
data. Default to daily; faster only when the data warrants it.

## Existing sites

| Site      | Subdomain              | Purpose                                       |
|-----------|------------------------|-----------------------------------------------|
| `ondeck`  | `ondeck.<owner-tld>`   | Personal sports schedule, no scores           |
| `dc-2026` | `dc-2026.<owner-tld>`  | Itinerary page for an April 2026 DC trip      |
| `re`      | `re.<owner-tld>`       | Brand direction explorations for Natalie Nagel Poling |

See each site's `README.md` for full details on purpose, data sources, and
operational quirks. (Note: `dc-2026` and `re` predate the conventions
codified above and may not follow every rule — match each one's existing
patterns when editing it.)

## When working in this repo

- **Commit straight to `main`. No PRs.** This is a single-developer
  repo — the owner is the only human contributor and uses Claude as the
  reviewer (typically via the `/superpowers:requesting-code-review`
  workflow before commits). Don't open pull requests, don't suggest a
  feature-branch flow, don't `gh pr create`. Review happens in-session,
  then commit lands directly on `main`.
- **Stay scoped.** When asked to work on one site, change only files in
  that site's directory and (if relevant) its workflow YAML. Don't touch
  other sites' files even tangentially.
- **Match the site's existing aesthetic.** Each site has its own design
  language; pick it up from what's already there rather than imposing a
  default.
- **Personal scale.** These are personal projects. Prefer the simple,
  slightly scrappy solution over the scalable enterprise one. Unofficial
  APIs are fine where the alternative is paying or building auth flows.
