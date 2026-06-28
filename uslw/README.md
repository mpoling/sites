# uslw — USL W League standings & schedule scraper

`scrape-standings.py` scrapes **every team's standings position and full match
schedule** for the [USL W League](https://www.uslwleague.com/league-standings)
and writes a single structured JSON (`standings.json`) that loses no
information.

```bash
python3 scrape-standings.py > standings.json
```

No dependencies — Python 3 standard library only. Progress prints to stderr;
the JSON goes to stdout. It honours the standard `https_proxy` / `SSL_CERT_FILE`
environment variables, so it runs unchanged locally, in CI, or behind a proxy.

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

```jsonc
{
  "league": "USL W League",
  "sourcePage": "...", "dataProvider": "...", "scrapedAt": "<ISO8601>",
  "providerIds": { "uidEvent": "25", "tournamentType": "league", "listType": "29" },
  "statColumns": { "PTS": "Points", "PPM": "Points Per Match", "...": "..." },
  "seasons": [
    {
      "uidAge": "44", "name": "Pre-Professional",
      "divisions": [
        {
          "groupId": "158", "name": "Chesapeake",
          "teams": [
            {
              "rank": 1, "teamId": 8094, "name": "...", "logo": "...",
              "stats": { "PTS": 27, "PPM": 2.7, "MP": 10, "W": 9, "L": 1, "T": 0,
                         "GF": 24, "GA": 8, "GD": 16 },
              "schedule": [
                {
                  "matchId": 117263, "dateText": "05/15/26 07:00pm",
                  "dateISO": "2026-05-15T19:00:00",
                  "competition": "League", "division": "Chesapeake",
                  "round": "1", "game": "1", "bracket": "League",
                  "home": { "teamId": 8094, "name": "...", "logo": "..." },
                  "away": { "teamId": 3827, "name": "...", "logo": "..." },
                  "score": { "home": 5, "away": 1, "played": true, "raw": "5 : 1" },
                  "venue": { "label": "...", "field": "...", "locationName": "...",
                             "address": "...", "lat": 38.63, "lng": -77.38,
                             "placeId": "...", "mapsUrl": "..." }
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

- **A match appears in both teams' `schedule` arrays** (it is the *team's*
  schedule). De-duplicate on `matchId` if you want a flat fixture list.
- **Unplayed fixtures** have `score.played = false` (and `raw` is usually
  `"VS"`); `dateISO` is naive local time — the provider exposes no timezone, so
  the original `dateText` is always preserved.
- Stats are internally consistent (`GD = GF − GA`, `PTS = 3·W + T`,
  `MP = W + L + T`) for all teams, which doubles as a column-mapping check.

As of the last run: 1 season, 16 divisions, 95 teams, 976 matches.
