#!/usr/bin/env python3
"""
scrape-standings.py — USL W League standings + schedule scraper.

Scrapes every team's standings position and full match schedule from the USL W
League site (https://www.uslwleague.com/league-standings) and writes a single
structured JSON that loses no information.

────────────────────────────────────────────────────────────────────────────
HOW THE DATA ACTUALLY FLOWS (reverse-engineered)
────────────────────────────────────────────────────────────────────────────
The public page at uslwleague.com/league-standings contains *no* standings
markup itself — it embeds an <iframe> pointing at the league's stats provider,
modular11.com, which renders everything client-side from a few XHR endpoints.
Scraping the iframe's data endpoints directly is far more reliable (and loses
no information) than trying to render the page. The endpoints (all under
https://www.modular11.com/public_schedule) are:

  1. league/get_age_groups_by_league   POST {UID_league}
       → JSON list of "seasons" the league has run. For the W League this is a
         single entry: {"UID_age": "44", "age": "Pre-Professional"}. (modular11
         models a season as an "age group"; UID_age is the season id.)

  2. league/get_teams                  GET  {tournament_type, UID_age,
                                             UID_gender, UID_event, list_type}
       → one big HTML blob containing the standings table for EVERY division at
         once. Each team row carries its division id (js-group), rank, name,
         crest, and the full stat line (PTS PPM MP W L T GF GA GD). An inline
         <script> maps each row key ("division1", "division2", …) to the team's
         numeric modular11 id, which we need for step 3.

  3. league/get_partial_matches_by_team GET {pagination_data, group, age,
                                             tournament, list_type, open_page}
       → paginated HTML with that team's complete match list: match id, kickoff,
         venue (field + name + street address + lat/long + Google place id),
         home/away teams (with ids + crests) and the score. `pagination_data`
         is a JSON array of team ids, e.g. "[8094]".

The magic constants below (UID_event=25, tournament_type='league',
list_type='29') are read straight from the iframe's bootstrap markup
(`new tournamentSchedule({tournament: 25, tournamentType: 'league'})` and the
class default `listType = "29"`). They're hard-coded with comments rather than
re-scraped on every run because they change roughly never; SOURCE_PAGE documents
where to re-derive them if modular11 ever reorganizes.

No third-party packages: standard library only (urllib + html + re). This keeps
the script trivially runnable anywhere (laptop, CI) with no install step.
"""

import dataclasses
import datetime as dt
import gzip
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import zlib

# ── Configuration ────────────────────────────────────────────────────────────

# The human-facing page (what a person would open). Documented for provenance;
# we never actually fetch it — the standings live in the iframe below.
SOURCE_PAGE = "https://www.uslwleague.com/league-standings"

# modular11 is the stats provider the iframe loads. All data endpoints hang off
# this base. The iframe URL itself is /league-standings/w-league.
M11_BASE = "https://www.modular11.com/public_schedule"
M11_IFRAME = "https://www.modular11.com/league-standings/w-league"

# modular11 ids for the USL W League, lifted from the iframe bootstrap markup.
UID_EVENT = "25"            # the league ("event") id  → tournament: 25
TOURNAMENT_TYPE = "league"  # path segment + tournament_type param
LIST_TYPE = "29"            # standings widget's listType default ("29")
UID_GENDER = ""             # the W League widget passes gender empty

# Be a polite, identifiable client.
USER_AGENT = (
    "uslw-standings-scraper/1.0 (+https://github.com/mpoling/sites) personal-use"
)

# ── HTTP ─────────────────────────────────────────────────────────────────────


def _request(path, params, method="GET"):
    """Fetch a modular11 endpoint and return the decoded text body.

    GET params go in the query string; POST params go in the body. We advertise
    gzip/deflate (modular11 compresses responses) and transparently inflate the
    result. urllib honours the standard http(s)_proxy / SSL_CERT_FILE env vars,
    so this works unchanged behind a corporate/CI proxy or on the open net.
    """
    url = f"{M11_BASE}/{path}"
    data = None
    headers = {
        "User-Agent": USER_AGENT,
        # The endpoints are AJAX routes; without this header some return 405.
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "text/html, application/json, */*; q=0.01",
        "Accept-Encoding": "gzip, deflate",
        "Referer": M11_IFRAME,
    }

    if method == "GET":
        url = f"{url}?{urllib.parse.urlencode(params)}"
    else:
        data = urllib.parse.urlencode(params).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        enc = (resp.headers.get("Content-Encoding") or "").lower()

    # Inflate if the server compressed the body (it usually does).
    if enc == "gzip" or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    elif enc == "deflate":
        # Try raw-deflate first, then zlib-wrapped — servers disagree.
        try:
            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
        except zlib.error:
            raw = zlib.decompress(raw)

    return raw.decode("utf-8", errors="replace")


# ── Tiny HTML helpers ────────────────────────────────────────────────────────


def _text(s):
    """Strip tags, unescape entities, collapse whitespace → clean string."""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    # &nbsp; survives as \xa0 after unescape; normalise it too.
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def _int(s):
    """Parse an int, tolerating surrounding whitespace; None if not a number."""
    s = (s or "").strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else None


def _num(s):
    """Parse an int or float (for PPM like '2.70'); None if not numeric."""
    s = (s or "").strip()
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    if re.fullmatch(r"-?\d*\.\d+", s):
        return float(s)
    return None


def _parse_date(text):
    """'05/15/26 07:00pm' → ISO 8601 'YYYY-MM-DDTHH:MM:00'. None if unparseable.

    The provider has no timezone in the markup (times are local to each venue),
    so the ISO string is intentionally naive — we keep the original string in
    `dateText` so nothing is lost.
    """
    if not text:
        return None
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*([ap]m)", text, re.I)
    if not m:
        return None
    mo, da, yr, hh, mm, ap = m.groups()
    yr = int(yr)
    if yr < 100:
        yr += 2000
    hh = int(hh) % 12
    if ap.lower() == "pm":
        hh += 12
    try:
        return dt.datetime(yr, int(mo), int(da), hh, int(mm)).isoformat()
    except ValueError:
        return None


# ── Data model ───────────────────────────────────────────────────────────────
# Plain dataclasses so the JSON shape is obvious and self-documenting.


@dataclasses.dataclass
class Match:
    matchId: int | None
    dateText: str | None
    dateISO: str | None
    competition: str | None      # e.g. "League"
    division: str | None         # e.g. "Chesapeake"
    round: str | None
    game: str | None
    bracket: str | None
    home: dict                   # {teamId, name, logo}
    away: dict                   # {teamId, name, logo}
    score: dict                  # {home, away, played, raw}
    venue: dict                  # {label, field, locationName, address, lat, lng, placeId, mapsUrl}


@dataclasses.dataclass
class Team:
    rank: int | None
    teamId: int | None
    name: str | None
    logo: str | None
    stats: dict                  # {PTS, PPM, MP, W, L, T, GF, GA, GD}
    schedule: list               # list[Match]


@dataclasses.dataclass
class Division:
    groupId: str
    name: str
    teams: list                  # list[Team]


# ── Standings parsing (get_teams) ────────────────────────────────────────────

# The 9 stat columns, in the exact left-to-right order modular11 renders them.
STAT_COLUMNS = ["PTS", "PPM", "MP", "W", "L", "T", "GF", "GA", "GD"]


def parse_standings(html_text):
    """Parse the get_teams HTML into ordered divisions of ranked teams.

    Three things have to be stitched together from the same blob:
      • division name  — from each "<Name> Division" section header
      • per-team stat row — the .main_row blocks (carry js-group = division id)
      • team id        — from the inline `matchLists['divisionN'] = {paginationData:[id]}`
                         script, keyed by the row's `row="divisionN"` attribute
    """
    # rowKey ("division1") → numeric team id, from the bootstrap <script>.
    rowkey_to_id = {
        k: int(v)
        for k, v in re.findall(
            r"matchLists\['(\w+)'\]\s*=\s*\{\s*paginationData:\s*\[(\d+)\]", html_text
        )
    }

    # Locate each division's name header and remember where it sits, so we can
    # attribute each team row to the division header immediately above it.
    headers = [
        (m.start(), m.group(1).strip())
        for m in re.finditer(r"([A-Za-z][A-Za-z .&/'-]+?)\s+Division\b", _detag_keep_pos(html_text))
    ]

    # Each team row, with its byte offset (to find the governing header) and the
    # raw block (to pull stats out of). A .main_row runs until the next .main_row
    # or the matches sub-block that follows it.
    divisions = {}              # groupId → Division (preserves first-seen order)
    order = []                  # groupId order of appearance

    row_iter = list(re.finditer(
        r'<div class="form_row row main_row"\s+js-group="(\d+)"\s+row="(\w+)">(.*?)'
        r'(?=<div class="row marg-0 evt-matches")',
        html_text,
        re.S,
    ))

    for rm in row_iter:
        group_id, row_key, block = rm.group(1), rm.group(2), rm.group(3)
        pos = rm.start()

        # Division name = the nearest "<Name> Division" header before this row.
        name = _nearest_header(headers, pos) or f"Division {group_id}"

        if group_id not in divisions:
            divisions[group_id] = Division(groupId=group_id, name=name, teams=[])
            order.append(group_id)

        rank = _int(_first(block, r'container-rank[^>]*>\s*([0-9]+)'))
        team_name = _first(block, r'<p data-title="([^"]*)"') or _first(block, r'<p[^>]*>\s*([^<]+?)\s*</p>')
        team_name = html.unescape(team_name.strip()) if team_name else None
        logo = _first(block, r'<img[^>]+src="([^"]+)"')

        # The 9 stat cells live in the right-hand ".row subrow pad-left" group.
        stats = _parse_stat_cells(block)

        divisions[group_id].teams.append(
            Team(
                rank=rank,
                teamId=rowkey_to_id.get(row_key),
                name=team_name,
                logo=logo,
                stats=stats,
                schedule=[],
            )
        )

    return [divisions[g] for g in order]


def _parse_stat_cells(row_block):
    """Pull the 9 numeric stat cells (PTS PPM MP W L T GF GA GD) from a row."""
    # The stats sub-block is the second ".row subrow" (class "...pad-left") and
    # it's the last thing in the row, so match greedily to the end — a
    # non-greedy boundary would swallow the final cell's own closing </div> and
    # silently drop GD (the 9th column).
    m = re.search(r'<div class="row subrow pad-left">(.*)', row_block, re.S)
    segment = m.group(1) if m else row_block
    # Each value is the text of a leaf <div>. Grab them in order.
    cells = [
        _text(c) for c in re.findall(r'<div class="col-[^"]*">(.*?)</div>', segment, re.S)
    ]
    cells = [c for c in cells if c != ""]
    stats = {}
    for i, col in enumerate(STAT_COLUMNS):
        stats[col] = _num(cells[i]) if i < len(cells) else None
    return stats


# ── Schedule parsing (get_partial_matches_by_team) ───────────────────────────


def parse_schedule(html_text):
    """Parse one page of get_partial_matches_by_team into a list of Match.

    We parse the desktop rows (they carry team ids, crests, score and map
    coordinates) and enrich each with the street address / split field-vs-place
    names from that match's detail panel, joined on match id.
    """
    addr_by_id = _parse_detail_panels(html_text)
    matches = []

    # Each desktop match row. The js-match-* attributes ride on the opening tag;
    # the body (up to the mobile-version marker) holds everything else.
    for rm in re.finditer(
        r'<div class="row table-content-row table-content-row-uls "(.*?)>(.*?)<!-- mobile version -->',
        html_text,
        re.S,
    ):
        attrs, body = rm.group(1), rm.group(2)

        match_id = _int(_first(body, r'uid-mobile-style">\s*([0-9]+)'))
        date_text = _first(body, r'col-xs-2">\s*([0-9/]+\s+[0-9:]+[ap]m)')

        # Teams: ids, names and crest urls in document order = [home, away].
        team_ids = _uniq(re.findall(r'/league-schedule/teams/(\d+)', body))
        names = [html.unescape(n) for n in re.findall(r'public-match-team-link[^>]*>\s*<p data-title="([^"]*)"', body)]
        if not names:
            names = [html.unescape(n) for n in re.findall(r'<p data-title="([^"]*)"', body)]
        logos = re.findall(r"club-photo\"[^>]*background-image:\s*url\('([^']+)'\)", body)

        # Score "H : A"; absent digits ⇒ not yet played.
        raw_score = _first(body, r'js-score-block>(.*?)</div>\s*<!--Score-->')
        score = _parse_score(raw_score)

        # Venue: combined label + Google-maps coordinates from the row, plus the
        # split field/place/address from the detail panel (joined on match id).
        maps_url = _first(body, r'href="(https://www\.google\.com/maps/search/[^"]+)"')
        lat = lng = place_id = None
        if maps_url:
            mm = re.search(r"query=([-\d.]+),([-\d.]+)", html.unescape(maps_url))
            if mm:
                lat, lng = float(mm.group(1)), float(mm.group(2))
            pid = re.search(r"query_place_id=([^&\"]+)", html.unescape(maps_url))
            place_id = pid.group(1) if pid else None
        label = _first(body, r'container-location">\s*<p data-title="([^"]*)"')
        detail = addr_by_id.get(match_id, {})

        venue = {
            "label": html.unescape(label) if label else None,
            "field": detail.get("Field Identifier"),
            "locationName": detail.get("Location Name"),
            "address": detail.get("Location Address"),
            "lat": lat,
            "lng": lng,
            "placeId": place_id,
            "mapsUrl": html.unescape(maps_url) if maps_url else None,
        }

        matches.append(
            Match(
                matchId=match_id,
                dateText=date_text,
                dateISO=_parse_date(date_text),
                competition=detail.get("Competition") or _attr(attrs, "js-match-bracket"),
                division=_attr(attrs, "js-match-group") or detail.get("Division"),
                round=_attr(attrs, "js-match-round"),
                game=_attr(attrs, "js-match-game"),
                bracket=_attr(attrs, "js-match-bracket"),
                home=_side(team_ids, names, logos, 0),
                away=_side(team_ids, names, logos, 1),
                score=score,
                venue=venue,
            )
        )

    return matches


def _parse_detail_panels(html_text):
    """Map match id → {label: value} from the per-match detail panels.

    The panels render clean label/value pairs (Match ID, Date, Field Identifier,
    Competition, Division, Location Name, Location Address). We walk them in
    order, starting a fresh record at every "Match ID" label.
    """
    pairs = re.findall(
        r'row-heading-mobile">\s*([^<]+?)\s*</div>\s*'
        r'<div class="row row-content-mobile">\s*(.*?)\s*</div>',
        html_text,
        re.S,
    )
    records = {}
    current = None
    for label, value in pairs:
        label = _text(label)
        value = _text(value)
        if label == "Match ID":
            current = _int(value)
            if current is not None:
                records[current] = {}
        elif current is not None:
            records[current][label] = value or None
    return records


def _parse_score(raw):
    """'5&nbsp:&nbsp1' → {home, away, played, raw}. Unplayed ⇒ played False."""
    text = _text(raw or "")
    m = re.search(r"(\d+)\s*:\s*(\d+)", text)
    if m:
        return {"home": int(m.group(1)), "away": int(m.group(2)), "played": True, "raw": text}
    return {"home": None, "away": None, "played": False, "raw": text or None}


def _side(team_ids, names, logos, i):
    """Build a {teamId, name, logo} dict for home (i=0) / away (i=1)."""
    return {
        "teamId": int(team_ids[i]) if i < len(team_ids) else None,
        "name": names[i] if i < len(names) else None,
        "logo": logos[i] if i < len(logos) else None,
    }


# ── Small regex utilities ────────────────────────────────────────────────────


def _first(s, pattern, flags=re.S):
    m = re.search(pattern, s, flags)
    return m.group(1) if m else None


def _attr(attrs, name):
    return _first(attrs, rf'{name}="([^"]*)"', re.S)


def _uniq(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _detag_keep_pos(s):
    """Replace each tag with same-length spaces so offsets stay aligned with the
    original HTML — lets us match header text yet reuse positions against it."""
    return re.sub(r"<[^>]+>", lambda m: " " * len(m.group(0)), s)


def _nearest_header(headers, pos):
    """The name of the last division header occurring before byte offset `pos`."""
    name = None
    for hpos, hname in headers:
        if hpos <= pos:
            name = hname
        else:
            break
    return name


# ── Orchestration ────────────────────────────────────────────────────────────


def fetch_seasons():
    """All seasons ("age groups") the league has run, newest-first as returned."""
    body = _request(
        f"{TOURNAMENT_TYPE}/get_age_groups_by_league",
        {"UID_league": UID_EVENT},
        method="POST",
    )
    return json.loads(body)


def fetch_standings(uid_age):
    """The full standings HTML for one season."""
    return _request(
        f"{TOURNAMENT_TYPE}/get_teams",
        {
            "tournament_type": TOURNAMENT_TYPE,
            "UID_age": uid_age,
            "UID_gender": UID_GENDER,
            "UID_event": UID_EVENT,
            "list_type": LIST_TYPE,
        },
        method="GET",
    )


def fetch_team_schedule(team_id, group_id, uid_age):
    """Every match for one team, following pagination to the last page."""
    matches = []
    page = 1
    while True:
        body = _request(
            f"{TOURNAMENT_TYPE}/get_partial_matches_by_team",
            {
                "open_page": page,
                "pagination_data": json.dumps([team_id]),  # e.g. "[8094]"
                "bracket": "",
                "age": uid_age,
                "tournament": UID_EVENT,
                "group": group_id,
                "list_type": LIST_TYPE,
            },
            method="GET",
        )
        matches.extend(parse_schedule(body))

        # Pagination footer reads "N page(s) out of M"; stop at the last page.
        m = re.search(r"(\d+)\s+pages?\s+out\s+of\s+(\d+)", _text(body), re.I)
        total = int(m.group(2)) if m else 1
        if page >= total:
            break
        page += 1
    return matches


def main():
    seasons = fetch_seasons()
    out_seasons = []

    for season in seasons:
        uid_age = season["UID_age"]
        sys.stderr.write(f"→ season {uid_age} ({season.get('age')})\n")

        divisions = parse_standings(fetch_standings(uid_age))
        team_count = sum(len(d.teams) for d in divisions)
        sys.stderr.write(f"  {len(divisions)} divisions, {team_count} teams\n")

        # Pull each team's full schedule.
        for d in divisions:
            for t in d.teams:
                if t.teamId is None:
                    sys.stderr.write(f"    ! no id for {t.name!r}; skipping schedule\n")
                    continue
                t.schedule = fetch_team_schedule(t.teamId, d.groupId, uid_age)
                sys.stderr.write(
                    f"    · {t.name:<34} {len(t.schedule):>2} matches\n"
                )

        out_seasons.append(
            {
                "uidAge": uid_age,
                "name": season.get("age"),
                "divisions": [dataclasses.asdict(d) for d in divisions],
            }
        )

    document = {
        "league": "USL W League",
        "sourcePage": SOURCE_PAGE,
        "dataProvider": M11_IFRAME,
        "scrapedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "providerIds": {
            "uidEvent": UID_EVENT,
            "tournamentType": TOURNAMENT_TYPE,
            "listType": LIST_TYPE,
        },
        "statColumns": {
            "PTS": "Points",
            "PPM": "Points Per Match",
            "MP": "Matches Played",
            "W": "Won",
            "L": "Loss",
            "T": "Tie",
            "GF": "Goals For",
            "GA": "Goals Against",
            "GD": "Goal Difference",
        },
        "seasons": out_seasons,
    }

    json.dump(document, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
