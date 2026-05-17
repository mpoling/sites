# CLAUDE.md

`sites` is a multi-site monorepo for personal static websites. Each top-level
directory is an independent site, deployed as-is by GitHub Pages and routed
to a custom subdomain by a Cloudflare Worker on the owner's TLD.

For the full system architecture (routing, deployment, repo layout, site
conventions, GitHub Actions conventions, data pipeline pattern), see
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

For the content-management layer (Sveltia CMS — chosen but not yet adopted),
see [`CMS.md`](./CMS.md).

This file covers the **operational rules** that AI agents working in the
repo need to follow.

## Existing sites

| Site         | Subdomain                 | Purpose                                       |
|--------------|---------------------------|-----------------------------------------------|
| `ondeck`     | `ondeck.<owner-tld>`      | Personal sports schedule, no scores           |
| `dc-2026`    | `dc-2026.<owner-tld>`     | Itinerary page for an April 2026 DC trip      |
| `re`         | `re.<owner-tld>`          | Brand direction explorations for Natalie Nagel Poling |
| `vacationhub`| `vacationhub.<owner-tld>` | Disney+-styled hub for hard-to-find vacation info (theme parks first) |

See each site's `README.md` for full details on purpose, data sources, and
operational quirks. (Note: `dc-2026` and `re` predate the conventions
codified in `ARCHITECTURE.md` and may not follow every rule — match each
one's existing patterns when editing it.)

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
- **Respect the static-only, relative-paths-only rules** documented in
  [`ARCHITECTURE.md`](./ARCHITECTURE.md#5-site-conventions). They are
  load-bearing for the Cloudflare-Worker-to-GitHub-Pages routing model.
- **Follow the GitHub Actions conventions** in
  [`ARCHITECTURE.md`](./ARCHITECTURE.md#7-github-actions-conventions)
  when adding or editing workflows: site-prefixed filenames,
  per-site working directory, scoped trigger paths, site-scoped
  concurrency groups, `[skip ci]` on bot commits, the `github-actions[bot]`
  identity.
- **Match the site's existing aesthetic.** Each site has its own design
  language; pick it up from what's already there rather than imposing a
  default.
- **Personal scale.** These are personal projects. Prefer the simple,
  slightly scrappy solution over the scalable enterprise one. Unofficial
  APIs are fine where the alternative is paying or building auth flows.
- **`origin` uses SSH.** The remote is
  `git@github.com:mpoling/sites.git`. HTTPS pushes will fail in
  non-interactive sessions (no TTY for the keychain prompt). The owner's
  SSH key in `~/.ssh/id_ed25519` is authorized — `git push` should just
  work.
