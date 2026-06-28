# uslw — USL W League standings & head-to-head, data-inlined static site

A one-time-use static site showing the top of each USL W League division and the
head-to-head results that decide standings ties. **All data is baked into the
HTML at build time** — no runtime JavaScript, no `fetch()`, nothing loaded
dynamically — so another tool can read it straight out of the markup.

Every page carries its data twice, redundantly, so a reader can pick whichever
is easier:

- a machine-readable `<script type="application/json">` block (an inert,
  self-contained data island — not executable JS); and
- plain HTML `<table>`s whose rows carry `data-*` attributes (`data-team-id`,
  `data-match-id`, `data-home-score`, `data-lat`, …).

Files:

- **`index.html`** — links to every division page, **plus the full dataset
  inlined** as one JSON island (`id="data"`).
- **`division-<slug>.html`** — one real file per division (e.g.
  `division-chesapeake.html`), fully self-contained: that division's standings
  table + head-to-head results, with team names/crests denormalized inline so no
  registry lookup is needed. The division's data island has `id="division-data"`.
- **`build-site.py`** — generates the HTML from `standings.json`.
- **`scrape-standings.py`** — produces `standings.json` (see below).

Build (after scraping):

```bash
python3 scrape-standings.py > standings.json
python3 build-site.py            # writes index.html + division-*.html
```

The pages are static and use relative paths only, per the repo's
[architecture](../ARCHITECTURE.md); open any file directly or serve the folder.

## The scraper

`scrape-standings.py` scrapes every team's standings position and match schedule
for the [USL W League](https://www.uslwleague.com/league-standings) and writes a
single structured `standings.json`.

```bash
python3 scrape-standings.py > standings.json
```

No dependencies — Python 3 standard library only. Progress prints to stderr;
the JSON goes to stdout. It honours the standard `https_proxy` / `SSL_CERT_FILE`
environment variables, so it runs unchanged locally, in CI, or behind a proxy.

## Output shaping (size controls)

The complete dataset (all 95 teams, every fixture, indented) is ~1.7 MB. By
default the script trims it to ~130 KB via the knobs at the top of the script:

| Constant | Default | Effect |
|---|---|---|
| `TOP_N` | `3` | Keep only the top N teams of each division (`None` = all). |
| `SCHEDULE_SCOPE` | `"head_to_head"` | `"head_to_head"` keeps only matches **between the kept teams in the same division** (the results that decide standings ties); `"full"` keeps every match; `"none"` drops schedules entirely. |
| `MINIFY` | `True` | Single-line JSON vs 2-space indented. |
| `INCLUDE_MAPS_URL` | `False` | The Google-maps URL is reconstructable from `lat`/`lng`/`placeId`, so it's dropped by default. |

Two reductions are always applied and are lossless: team names + crests are
stored once in a top-level `teams` registry (matches/standings reference teams
by `teamId`), and the maps URL is omitted (see above).

## Where the data comes from

The public standings page contains **no standings markup** — it embeds an
`<iframe>` from the league's stats provider, **modular11.com**, which renders
everything client-side from a handful of XHR endpoints. The script calls those
endpoints directly (cleaner and lossless versus rendering the page). All live
under `https://www.modular11.com/public_schedule`:

| Purpose | Method & path | Key params |
|---|---|---|
| Seasons | `POST league/get_age_groups_by_league` | `UID_league=25` |
| Standings (all divisions) | `GET league/get_teams` | `tournament_type=league`, `UID_age`, `UID_event=25`, `list_type=29` |
| Per-team schedule (paginated) | `GET league/get_partial_matches_by_team` | `pagination_data=[teamId]`, `group`, `age`, `tournament=25`, `list_type=29`, `open_page` |

The constants `UID_event=25`, `tournament_type=league`, and `list_type=29` come
straight from the iframe's bootstrap JS
(`new tournamentSchedule({tournament: 25, tournamentType: 'league'})` and the
widget's `listType` default). They change roughly never; see the header comment
in the script for how to re-derive them if modular11 reorganizes.

## Output shape

Shown indented for readability; the file itself is minified by default. Teams
are referenced by `teamId` everywhere and resolved through the top-level `teams`
registry.

```jsonc
{
  "league": "USL W League",
  "sourcePage": "...", "dataProvider": "...", "scrapedAt": "<ISO8601>",
  "config": { "teamsPerDivision": 3, "scheduleScope": "head_to_head" },
  "providerIds": { "uidEvent": "25", "tournamentType": "league", "listType": "29" },
  "statColumns": { "PTS": "Points", "PPM": "Points Per Match", "...": "..." },
  "teams": {
    "8094": { "name": "Virginia Development Academy", "logo": "https://..." },
    "4898": { "name": "Virginia Beach United FC",     "logo": "https://..." }
    // ... one entry per kept team
  },
  "seasons": [
    {
      "uidAge": "44", "name": "Pre-Professional",
      "divisions": [
        {
          "groupId": "158", "name": "Chesapeake",
          "teams": [
            {
              "rank": 1, "teamId": 8094,
              "stats": { "PTS": 27, "PPM": 2.7, "MP": 10, "W": 9, "L": 1, "T": 0,
                         "GF": 24, "GA": 8, "GD": 16 },
              "headToHead": [          // "schedule" when scheduleScope = "full"
                {
                  "matchId": 117445, "dateText": "06/03/26 07:00pm",
                  "dateISO": "2026-06-03T19:00:00",
                  "competition": "League", "division": "Chesapeake",
                  "round": "1", "game": "1", "bracket": "League",
                  "home": { "teamId": 8094 }, "away": { "teamId": 4898 },
                  "score": { "home": 1, "away": 0, "played": true, "raw": "1 : 0" },
                  "venue": { "label": "...", "field": "...", "locationName": "...",
                             "address": "...", "lat": 38.63, "lng": -77.38,
                             "placeId": "..." }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Notes:

- With the default `scheduleScope: "head_to_head"`, each team's `headToHead`
  array holds only its matches **against the other kept teams in the same
  division** — the results that resolve standings ties. A given match therefore
  appears in both participants' arrays; de-duplicate on `matchId` for a flat
  fixture list.
- **Unplayed fixtures** have `score.played = false` (and `raw` is usually
  `"VS"`); `dateISO` is naive local time — the provider exposes no timezone, so
  the original `dateText` is always preserved.
- Stats are internally consistent (`GD = GF − GA`, `PTS = 3·W + T`,
  `MP = W + L + T`) for all teams, which doubles as a column-mapping check.

As of the last run (top 3 / division, head-to-head): 1 season, 16 divisions,
48 teams, ~130 KB.
