#!/usr/bin/env python3
"""
build-site.py — generate a static, data-inlined site from standings.json.

This produces a *one-time-use* site where every byte of data is baked into the
HTML at build time — no runtime JavaScript, no fetch(), nothing loaded
dynamically. The intent is that another tool can read the data straight out of
the HTML (it does not need to be pretty for humans).

There is NO <script> element of any kind on these pages — not even an inert
application/json data island. Each page carries the data twice, redundantly, so
a downstream reader can pick whichever is easiest:
  • as a <pre> JSON block (id="data" / id="division-data") — plain text, no
    script tag; read it with element.textContent (or BeautifulSoup .get_text());
    and
  • as plain HTML <table>s whose rows carry data-* attributes (data-team-id,
    data-match-id, data-home-score, data-lat, …).

Output:
  index.html              — links to every division page, plus the FULL dataset
                            inlined as one <pre> JSON block.
  division-<slug>.html    — one file per division, fully self-contained: that
                            division's standings + head-to-head results, with
                            team names/crests denormalized inline (no registry
                            lookup needed by the reader).

Run after the scraper:
    python3 scrape-standings.py > standings.json
    python3 build-site.py

Reads ./standings.json; writes the HTML files alongside it. Stdlib only.
"""

import html
import json
import re

DATA_PATH = "standings.json"

# The nine standings columns, in the league's display order, with full labels.
STAT_COLUMNS = ["PTS", "PPM", "MP", "W", "L", "T", "GF", "GA", "GD"]

# Minimal styling — just enough that the tables are legible if a human opens
# them. Inlined so each page stays a single self-contained file.
STYLE = """
body{font:14px/1.4 system-ui,Arial,sans-serif;margin:1.5rem;color:#1b1430}
h1,h2{margin:.2em 0}a{color:#582f91}
table{border-collapse:collapse;margin:.5rem 0 1.5rem;width:100%}
th,td{border:1px solid #ddd;padding:4px 8px;text-align:right}
th{background:#582f91;color:#fff}
td.team,th.team,td.match,th.match{text-align:left}
caption{text-align:left;font-weight:700;margin-bottom:.3rem}
.crest{height:18px;width:18px;object-fit:contain;vertical-align:middle}
ul{columns:3;list-style:none;padding:0}
""".strip()


def esc(s):
    """HTML-escape a value for safe inclusion in markup."""
    return html.escape("" if s is None else str(s), quote=True)


def slug(name):
    """'South Atlantic' → 'south-atlantic' for stable, predictable filenames."""
    return re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")


def team_of(data, team_id):
    """Resolve a teamId to its {name, logo} via the top-level registry."""
    return data.get("teams", {}).get(str(team_id), {"name": f"#{team_id}", "logo": None})


def maps_url(v):
    """Rebuild the Google Maps link (dropped from the JSON, derivable here)."""
    if not v or v.get("lat") is None or v.get("lng") is None:
        return None
    u = f"https://www.google.com/maps/search/?api=1&query={v['lat']},{v['lng']}"
    if v.get("placeId"):
        u += f"&query_place_id={v['placeId']}"
    return u


def crest_img(t):
    """A small crest <img>, or empty string if the team has no logo."""
    return f'<img class="crest" src="{esc(t["logo"])}" alt="">' if t.get("logo") else ""


# ── Denormalize one division into a self-contained structure ──────────────────


def division_payload(data, season, division):
    """Build a fully self-contained dict for a division: teams (with names/crests
    inlined) and the deduped, date-sorted head-to-head matches (likewise)."""
    teams = []
    for t in division.get("teams", []):
        info = team_of(data, t.get("teamId"))
        teams.append({
            "rank": t.get("rank"),
            "teamId": t.get("teamId"),
            "name": info.get("name"),
            "logo": info.get("logo"),
            "stats": t.get("stats", {}),
        })

    # Each match is stored once per participant; dedupe by matchId.
    by_id = {}
    for t in division.get("teams", []):
        for m in t.get("headToHead", t.get("schedule", [])):
            mid = m.get("matchId")
            if mid is not None and mid not in by_id:
                home = team_of(data, m.get("home", {}).get("teamId"))
                away = team_of(data, m.get("away", {}).get("teamId"))
                by_id[mid] = {
                    "matchId": mid,
                    "dateText": m.get("dateText"),
                    "dateISO": m.get("dateISO"),
                    "competition": m.get("competition"),
                    "division": m.get("division"),
                    "round": m.get("round"),
                    "game": m.get("game"),
                    "bracket": m.get("bracket"),
                    "home": {**m.get("home", {}), "name": home.get("name"), "logo": home.get("logo")},
                    "away": {**m.get("away", {}), "name": away.get("name"), "logo": away.get("logo")},
                    "score": m.get("score", {}),
                    "venue": m.get("venue", {}),
                }
    matches = sorted(by_id.values(), key=lambda m: str(m.get("dateISO") or m.get("dateText") or ""))

    return {
        "groupId": division.get("groupId"),
        "name": division.get("name"),
        "season": season.get("name"),
        "uidAge": season.get("uidAge"),
        "teams": teams,
        "headToHead": matches,
    }


# ── HTML rendering ────────────────────────────────────────────────────────────


def json_block(obj, block_id):
    """A machine-readable data block with NO <script> element — the JSON lives in
    a hidden <pre> as plain text. Only the three text-significant characters are
    entity-escaped; a reader gets clean JSON back via textContent / .get_text()."""
    blob = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    text = blob.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<pre id="{block_id}" hidden>{text}</pre>'


def standings_table(payload):
    head = "".join(f'<th>{c}</th>' for c in STAT_COLUMNS)
    rows = []
    for t in payload["teams"]:
        cells = "".join(f'<td data-stat="{c}">{esc(t["stats"].get(c))}</td>' for c in STAT_COLUMNS)
        rows.append(
            f'<tr data-team-id="{esc(t["teamId"])}" data-rank="{esc(t["rank"])}">'
            f'<td>{esc(t["rank"])}</td>'
            f'<td class="team">{crest_img(t)} {esc(t["name"])}</td>'
            f"{cells}</tr>"
        )
    return (
        '<table class="standings">'
        f'<caption>Standings — {esc(payload["name"])} ({esc(payload["season"])})</caption>'
        f'<thead><tr><th>#</th><th class="team">Team</th>{head}</tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table>'
    )


def head_to_head_table(payload):
    if not payload["headToHead"]:
        return "<p>No head-to-head matches.</p>"
    rows = []
    for m in payload["headToHead"]:
        sc = m.get("score", {})
        played = sc.get("played")
        result = f'{esc(sc.get("home"))}–{esc(sc.get("away"))}' if played else "vs"
        v = m.get("venue", {})
        venue_name = v.get("label") or " — ".join(x for x in (v.get("field"), v.get("locationName")) if x)
        url = maps_url(v)
        venue_cell = f'<a href="{esc(url)}">{esc(venue_name)}</a>' if (url and venue_name) else esc(venue_name)
        rows.append(
            f'<tr data-match-id="{esc(m.get("matchId"))}"'
            f' data-home-id="{esc(m["home"].get("teamId"))}" data-away-id="{esc(m["away"].get("teamId"))}"'
            f' data-home-score="{esc(sc.get("home"))}" data-away-score="{esc(sc.get("away"))}"'
            f' data-played="{esc(bool(played)).lower()}" data-date="{esc(m.get("dateISO"))}"'
            f' data-lat="{esc(v.get("lat"))}" data-lng="{esc(v.get("lng"))}" data-place-id="{esc(v.get("placeId"))}">'
            f'<td class="match">{esc(m.get("dateText"))}</td>'
            f'<td class="match">{crest_img(m["home"])} {esc(m["home"].get("name"))}</td>'
            f'<td>{result}</td>'
            f'<td class="match">{crest_img(m["away"])} {esc(m["away"].get("name"))}</td>'
            f'<td class="match">{venue_cell}</td>'
            f'<td class="match">{esc(v.get("address"))}</td></tr>'
        )
    return (
        '<table class="h2h">'
        f'<caption>Head-to-head — {esc(payload["name"])}</caption>'
        "<thead><tr><th class=\"match\">Date</th><th class=\"match\">Home</th><th>Score</th>"
        "<th class=\"match\">Away</th><th class=\"match\">Venue</th><th class=\"match\">Address</th></tr></thead>"
        f'<tbody>{"".join(rows)}</tbody></table>'
    )


def page(title, body):
    return (
        "<!DOCTYPE html>\n<html lang=\"en-us\">\n<head>\n"
        "<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>{esc(title)}</title>\n"
        '<link rel="icon" href="./favicon.svg" type="image/svg+xml">\n'
        f"<style>{STYLE}</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n"
    )


def write(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  wrote {path} ({len(text):,} bytes)")


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    # Build each division page and collect index entries.
    divisions = []
    for season in data.get("seasons", []):
        for division in season.get("divisions", []):
            payload = division_payload(data, season, division)
            divisions.append(payload)

    divisions.sort(key=lambda p: str(p["name"]))

    for payload in divisions:
        fname = f"division-{slug(payload['name'])}.html"
        body = (
            f'<p><a href="./index.html">← All divisions</a></p>\n'
            f'<h1>{esc(payload["name"])} Division</h1>\n'
            f'<p>USL W League · {esc(payload["season"])} · groupId {esc(payload["groupId"])}</p>\n'
            f"{standings_table(payload)}\n"
            f"{head_to_head_table(payload)}\n"
            f"{json_block(payload, 'division-data')}\n"
        )
        payload["_file"] = fname
        write(fname, page(f'{payload["name"]} — USL W League', body))

    # Index: links to each division + the FULL dataset inlined for convenience.
    links = "".join(
        f'<li><a href="./{esc(p["_file"])}">{esc(p["name"])}</a> '
        f'({len(p["teams"])} teams, {len(p["headToHead"])} matches)</li>'
        for p in divisions
    )
    index_body = (
        "<h1>USL W League</h1>\n"
        f'<p>Top {len(divisions[0]["teams"]) if divisions else 0} of each division &amp; head-to-head results · '
        f'scraped {esc(data.get("scrapedAt"))}</p>\n'
        f"<ul>{links}</ul>\n"
        "<p>The complete dataset is inlined below as JSON in "
        '<code>&lt;pre id="data" hidden&gt;</code> (no script tag).</p>\n'
        f"{json_block(data, 'data')}\n"
    )
    write("index.html", page("USL W League — Divisions", index_body))


if __name__ == "__main__":
    main()
