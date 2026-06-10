# orlando-2026

Itinerary site for the June 2026 Orlando theme-park trip — the Polings and
their best friends, the De Bertis — plus the Polings' St. Petersburg
family leg afterward. Served at `orlando-2026.<owner-tld>` (see
[`ARCHITECTURE.md`](../ARCHITECTURE.md) for routing).

Modeled on [`dc-2026`](../dc-2026/) (single-page, day-tab itinerary that
snaps to "today" during the trip) but intentionally lighter on detail, and
with a playful Florida/Disney/Universal look instead of dc-2026's federal
navy-and-gold.

## Layout

```
orlando-2026/
├── index.html                    # The whole site: inline CSS + JS, one page
├── favicon.svg                   # Passport-stamp style mark (matches dc-2026's convention)
├── apple-touch-icon-180x180.png  # Generated sunset/castle icon
├── assets/
│   ├── badge-*.svg               # Original flat-art park/day badges used in day headers
│   └── photos/                   # One "postcard" photo per park/destination day
│       └── SOURCES.md            # Source URL + license for every photo
└── README.md
```

## Content notes

- **Trip dates:** June 7–14, 2026 (Orlando), then St. Pete from June 14.
  Day 1 = June 7. The nav snaps to "Today" (Eastern Time) during the trip
  window, same mechanism as dc-2026.
- **Door code is partially redacted on purpose.** The site is publicly
  reachable, so the first three digits are shown as `✱✱✱` — the full code
  lives in the Florida Premier Rentals booking email. Don't "fix" this.
- **Family names:** the site refers to "the Polings" and "the De Bertis"
  collectively (no first names for the traveling families, by request).
  The St. Pete relatives are named because that's the itinerary content.
- **Art is a mix of original SVG badges and real photos.** The day-header
  badges are original flat art, not official logos. Each park/destination
  day (1, 3, 4, 6, 7, and St. Pete) opens with a tilted "postcard" photo
  from Wikimedia Commons — CC-licensed, downscaled to ≤1200px, attributed
  in the on-page caption and in
  [`assets/photos/SOURCES.md`](./assets/photos/SOURCES.md). After the
  trip, family photos can replace them (update caption + SOURCES.md).
- External links (queue-times.com wait pages, Disney/Universal app and
  planning pages, Google Maps directions) are convenience shortcuts and
  may rot after the trip; that's fine — this becomes a journal afterward.

## Ideas backlog (nothing committed to)

- **Post-trip journal mode** — as days pass, rewrite schedule items in past
  tense with what actually happened (dc-2026 did this); swap in family
  photos once they exist.
- **Height-requirement cheat sheet** per park day (collapsible).
- **Dining ideas per park** (kept light by request — candidates: Satu'li
  Canteen, Three Broomsticks, Ronto Roasters, Les Halles, Toothsome,
  Dole Whip stands).
- **Per-day weather chip** linking to the forecast for the park's zip.
- **Lightning Lane / virtual-queue reminders** pinned on park days
  (partially there).
- **PNG favicon fallback** (`favicon.png`) if older in-app browsers
  misrender the SVG.

## Conventions

Follows the repo rules in [`ARCHITECTURE.md`](../ARCHITECTURE.md): static
only, relative paths only, self-contained, no build step. The Fredoka
display font loads from Google Fonts at runtime (allowed per §9).
