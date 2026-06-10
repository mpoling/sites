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
│   └── photos/                   # Drop-in spot for real trip photos (empty for now)
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
- **Park art is original SVG**, not official logos/photos. This session's
  network allowlist blocked downloading real imagery (Wikimedia, park
  sites all 403). To add real photos later: drop files in
  `assets/photos/` and reference them with relative paths from
  `index.html`.
- External links (queue-times.com wait pages, Disney/Universal app and
  planning pages, Google Maps directions) are convenience shortcuts and
  may rot after the trip; that's fine — this becomes a journal afterward.

## Conventions

Follows the repo rules in [`ARCHITECTURE.md`](../ARCHITECTURE.md): static
only, relative paths only, self-contained, no build step. The Fredoka
display font loads from Google Fonts at runtime (allowed per §9).
