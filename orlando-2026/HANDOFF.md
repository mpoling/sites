# HANDOFF — temporary session-resume notes

**This file is temporary.** It exists to hand context to a fresh
Claude Code session (started after widening the environment's network
access). Delete it once the follow-up work lands.

## Where things stand (as of June 10, 2026 — mid-trip, Day 4)

The site is live on `main`: single-page itinerary (`index.html`, inline
CSS/JS) modeled on `dc-2026`, playful Florida theme, day tabs that snap
to "Today" (ET; Day 1 = June 7, St. Pete tab covers June 15–18).
Original SVG badges in `assets/`, stamp-style `favicon.svg`, generated
`apple-touch-icon-180x180.png` (drawn with a throwaway Pillow script,
not committed — regenerate by hand or replace with a real photo crop).

Decisions already made with the owner (don't relitigate):

- **Door code is partially redacted on purpose** (`✱✱✱754 + ✓`). Never
  commit the full code.
- **Traveling families are collective only** — "the Polings," "the
  De Bertis," no first names. St. Pete relatives (Aunt Susan, Cousin
  Bryan & Emily, Katie Mae; Aunt Denise, Cousins Michelle & Kristina)
  are named because that's itinerary content.
- **Commit straight to `main`** per `CLAUDE.md` (owner confirmed).
- Owner wants **a mix of original SVG art and real/official images,
  committed to the repo** — the real-image half is the unfinished part.

## Primary task for the new session: real photos

The prior session's network allowlist 403'd everything except package
registries. With wider access, pull **Wikimedia Commons** photography
(CC-licensed, scriptable; official Disney/Universal CDNs often block
scripted downloads) into `assets/photos/`, then wire it into the page.

Suggested shots (one strong photo per day section):

| Day | Subject ideas |
|-----|---------------|
| 1 | Universal globe fountain; Gringotts fire-breathing dragon; Hogwarts Express |
| 3 | Tower of Terror; Spaceship Earth (classic low-angle) |
| 4 | Tree of Life; Kilimanjaro Safaris giraffes; Everest peak |
| 6 | Epic Universe — Celestial Park / Chronos gate / Stardust Racers (Commons coverage is newer, check what exists) |
| 7 | Cinderella Castle (day or fireworks) |
| 9 | St. Pete Pier; Fort De Soto beach |

Wiring ideas (pick what looks good, keep relative paths):

- Photo banner inside each `.day-header` under the badge, or as a
  `background-image` behind the gradient (add a dark overlay for text).
- Or a small rounded "postcard" image at the top of each
  `.schedule-container`.
- Downscale to ~1200px wide, JPEG ~80 quality — keep repo lean.
- Record source URL + license per file in `assets/photos/SOURCES.md`.

## Backlog of other ideas (none committed to; owner may want some)

- **Post-trip journal mode**: as days pass, edit schedule items to past
  tense with what actually happened (dc-2026 did this — see its Day 6
  gelato note). The site's afterlife is a keepsake; family photos in
  `assets/photos/` beat stock shots once they exist.
- **Rain plan card** on Home Base: June = daily ~2–4 PM thunderstorms;
  indoor-ride lists per park, poncho note.
- **Height-requirement cheat sheet** per park day (collapsible), for
  quick "can the kids ride" checks.
- **Dining ideas per park** (kept light by request, but candidates:
  Satu'li Canteen, Three Broomsticks, Ronto Roasters, Les Halles,
  Toothsome Chocolate Emporium, Dole Whip stands).
- **Per-day weather chip** linking to forecast for the park's zip.
- **Lightning Lane / virtual-queue reminders** as a pinned note on park
  days (7 AM TRON/Cosmic Rewind virtual queue, etc.) — partially there.
- **PNG favicon fallback** (`favicon.png`) alongside the SVG if older
  in-app browsers misrender it.

## Conventions reminder

Static only, relative paths only, site-scoped changes only, no build
step (`ARCHITECTURE.md`). The page loads Fredoka from Google Fonts at
runtime — that's the allowed CDN pattern, not a violation.
