# Data sources for OnDeck

ESPN's unofficial site API is the default and covers everything from the
majors down to D1 Arkema and the Women's Champions League. But it doesn't
cover small, new, or regional leagues — and when it doesn't, the alternatives
range from "narrow but real" to "we tried and you don't want to repeat it."

This doc exists so we don't relearn the dead ends. The Monterey Bay Sirens
(USL W League) is the worked example throughout; future small-league teams
should follow the same decision tree.

## Decision tree

1. **ESPN site API** — try first. If the team and league are there, use it.
   (See the README's "Common league slugs" table for the usual paths.)
2. **TheSportsDB** — useful for a few global sports DBs missing from ESPN,
   but spotty for small US leagues. Beware its fallback behavior (below).
3. **SportsEngine / modular11 / SE Play** — covered in depth below. Often a
   partial answer at best.
4. **Hand-entered `static` fixtures** — the reliable last resort. See
   "The `static` data source" at the bottom.

## ESPN — what it covers, what it doesn't

ESPN's site API (`site.api.espn.com`) is undocumented but stable. It covers
all the major US pro leagues, the top European club soccer leagues, all
international women's competitions of any prominence (friendlies via
`fifa.friendly.w`, WCQ groups like `fifa.wworldq.uefa`, Nations Leagues,
Euros, World Cups, Olympics), the top women's club leagues (NWSL, D1 Arkema,
Women's Champions League), and most NCAA sports.

It does **not** cover the lower-tier US pro/semi-pro pyramid: USL W League,
USL League Two, NPSL Men's or Women's, MLS Next Pro, NISA, etc.

**Discovering league slugs**: there's no "list all leagues" endpoint we
could find. The reliable methods are:

- Hit `/apis/site/v2/sports/{sport}/{slug}/teams` with candidate slugs. A
  200 with a populated list means the league exists; 400 means it doesn't.
- Or, find a fixture on the team's espn.com page and look at the "Table"
  link — the slug is in the URL. This is how `fifa.wworldq.uefa` was found.

The team-page schedule (`/teams/{id}/schedule`) under a given league slug is
the canonical "does this competition show data for this team" check.

## TheSportsDB

Free, no auth, covers some global sports databases ESPN misses. But for the
specific case of small US leagues, it doesn't help — the USL W League and
its clubs aren't in there.

**Footgun**: `searchteams.php?t={name}` returns a 200 with `teams: [Arsenal]`
when no match is found, instead of `teams: null`. Always verify the returned
team name actually matches what you asked for before believing the result.

## The SportsEngine ecosystem

SportsEngine is three separate stacks under one brand, and they don't share
APIs. Knowing which is which saved real time on the Sirens investigation.

### `sportngin.com` — the league/club CMS

Powers the **public-facing sites** of many leagues and clubs — including
[uslwleague.com](https://www.uslwleague.com/). These sites are server-rendered
via SportsEngine's site templates.

**The API at `api.sportngin.com` is gated.** All of these returned 401/403/404
without authenticated session cookies during the Sirens probe:

```
GET https://api.sportngin.com/v2/teams/{id}.json                          → 404
GET https://api.sportngin.com/v2/teams/{id}/games.json                    → 404
GET https://api.sportngin.com/v2/teams/{id}/schedule.json                 → 404
GET https://api.sportngin.com/v3/calendar/team/{id}                       → 401
GET https://api.sportngin.com/v3/calendar/team/{id}/games                 → 403
GET https://api.sportngin.com/v3/sites/search?query=...                   → 404
```

The IDs we found in the league site HTML (e.g. `/teams/8128` on
uslwleague.com) are real sportngin team IDs, but reading them publicly
isn't possible.

There is no exposed ICS/iCal feed on either the org site or per-team pages.

### `modular11.com` — the scheduling/scoring backend

The USL W League site embeds `https://www.modular11.com/league-schedule/teams/{id}`
in an iframe for each team page. modular11 is the actual scheduling system
behind multiple USL competitions.

It's a Next.js SPA. The HTML response (~240 KB) includes hydration data with
team names and Google Maps venue coordinates, but the actual game records
live in a JS-side data structure that doesn't pair dates with matchups in a
way that's cleanly grep-able. There's no public JSON endpoint:

```
GET https://www.modular11.com/api/teams/{id}                              → 404
GET https://www.modular11.com/api/teams/{id}/games                        → 404
GET https://www.modular11.com/teams/{id}.json                             → 404
GET https://www.modular11.com/league-schedule/teams/{id}.json             → 404
```

Skip modular11 unless you're willing to use a headless browser.

### `sportsengineplay.com` — the NBC streaming product

A **completely separate** consumer app, not a sportngin site. Built on
Next.js + Apollo, backed by a public GraphQL endpoint at
`https://api.sportsengineplay.com/graphql`.

**It works without authentication** for read queries, as long as you send
`Origin: https://sportsengineplay.com` and `Referer: https://sportsengineplay.com/`.
Introspection is disabled, but query strings are inlined in the page's JS
bundle (`/_next/static/chunks/pages/_app-*.js`). Grep that file for
`query GetXxx` to find the operations the site uses; `GetEvents` and
`GetTeam` are the relevant ones.

**Finding a team's channel ID**: load the team's Play page (e.g.
`https://sportsengineplay.com/USL/.../Monterey-Bay-Sirens?follow=...`),
parse the `<script id="__NEXT_DATA__">` JSON, and pluck
`props.pageProps.channel.id`. The teamId is at `channel.teamId`.

Minimal `GetEvents` query that returns useful data:

```graphql
query GetEvents($channelId: ID, $limit: Int) {
  events(channelId: $channelId, limit: $limit, sort: {eventDate: 1}) {
    totalRecords
    data {
      id
      name
      eventDate         # milliseconds since epoch, as a string
      homeTeamChannel { team { name } }
      awayTeamChannel { team { name } }
    }
  }
}
```

**The catch**: SE Play only indexes games scheduled for **streaming**, not
full team schedules. For the Sirens' 10-game inaugural season, only 2 games
came back (and each appeared twice — once as the parent stream, once as a
child stream — so `totalRecords: 4`).

So SE Play is useful for picking up broadcast/stream URLs to enrich games
you already know about, but not as a primary schedule source for a team
whose games mostly aren't streamed.

### Sirens: full investigation trail

For the record, the path that landed on hand-entered fixtures:

1. ESPN — no team, no league. Probed ~10 slug variants for USL W.
2. TheSportsDB — searchteams returned the Arsenal fallback; no USL W
   league in `search_all_leagues.php?c=United States&s=Soccer`.
3. uslwleague.com — SE-hosted, embeds modular11 iframe at `/teams/8128`.
4. modular11.com — SPA, no public JSON, hydration data not cleanly parseable.
5. `api.sportngin.com` — all probed endpoints gated.
6. ICS/iCal — none exposed on any host above.
7. sportsengineplay.com — public GraphQL works, but only 2 of 10 games.
8. mbfcsirens.com (team's own WordPress site) — full 10-game schedule
   rendered server-side in HTML. Scrapable but bespoke to their theme.
9. **Decision**: hand-enter the 10 fixtures once, mark `lastVerified`,
   accept the small maintenance burden over the brittleness of either
   scraping bespoke HTML or stitching together two partial sources.

## The `static` data source

For teams without a usable API, omit `espn` and add `static` pointing at
a JSON file under `ondeck/data/`:

```jsonc
// ondeck/teams.json
{
  "id":        "mb-sirens",
  "shortName": "Sirens",
  "fullName":  "Monterey Bay Sirens",
  "league":    "USL W",
  "sport":     "Soccer",
  "static":    "data/sirens-fixtures.json",
  "accent":    "#006C5B",
  "logo":      "https://..."
}
```

```jsonc
// ondeck/data/sirens-fixtures.json
{
  "teamId":       "mb-sirens",
  "source":       "https://www.mbfcsirens.com/schedule/",
  "lastVerified": "2026-05-23",
  "games": [
    {
      "dateISO":       "2026-05-09T19:00:00-07:00",  // full ISO with offset
      "isHome":        true,
      "opponentShort": "Stockton Cargo SC",
      "venue":         "Cardinale Stadium"
    }
    // optional per-game fields: opponentLogo, broadcasts: []
  ]
}
```

The fetch script reads `team.static`, filters games to the same
`pastDays`/`futureDays` window ESPN games use, and merges them into
`games.json` with stable IDs like `mb-sirens-static-0`.

**Time zones**: use full ISO 8601 with a UTC offset (`-07:00` for PDT,
`-08:00` for PST). The UI renders in the visitor's local time. Schedules
that straddle the PDT/PST changeover need per-game offsets, not a blanket one.

**Maintenance**: bump `lastVerified` whenever you re-confirm the schedule
against the upstream source. The script prints it on every run as a
freshness signal:

```
→ Sirens          9 in window  (static=10, 9 in window) [verified 2026-05-23]
```

**Workflow trigger**: `.github/workflows/ondeck-update-games.yml` includes
`ondeck/data/*-fixtures.json` in its `paths:` filter, so editing the
fixtures file triggers a `games.json` refresh on push.

## Dead ends we already checked

So you don't redo them on the next team:

- **ICS/iCal feeds**: looked at uslwleague.com, modular11.com, mbfcsirens.com,
  and guessed common endpoints (`/calendar.ics`, `/schedule.ics`,
  `/api/teams/{id}/calendar.ics`, etc.). None exist publicly.
- **WordPress RSS** (`/feed/`, `/schedule/feed/`): returns blog posts only,
  not schedule data, regardless of theme.
- **sportsengine.com site search**: the corporate marketing site, doesn't
  search across all SE-hosted teams.
- **GraphQL introspection on `api.sportsengineplay.com`**: disabled. Pull
  query strings from the JS bundle instead.
