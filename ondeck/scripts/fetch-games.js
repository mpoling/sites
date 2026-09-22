#!/usr/bin/env node
/**
 * fetch-games.js
 *
 * Reads teams.json, queries ESPN's unofficial endpoints for each team,
 * strips out scores, and writes a clean data/games.json for the static
 * site to consume.
 *
 * Designed to run in GitHub Actions on a cron schedule. Uses native fetch
 * (Node 18+); no dependencies.
 *
 * Endpoints we use (undocumented but stable):
 *   /apis/site/v2/sports/{sport}/{league}/teams/{teamId}/schedule
 *     — past + ongoing events for the team. For MLB this also includes
 *       future events; for MLS/NWSL/USL/college-softball it only returns
 *       events up to today (the original "schedule" endpoint is more like
 *       "recent results" for those leagues).
 *   /apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMM
 *     — every league-wide event in that calendar month. We fetch one call per
 *       month the window touches and merge. Cached per (sport, league, month)
 *       within a run, since teams in the same league share the scoreboard.
 *
 * ON THE `dates` PARAMETER — READ BEFORE "SIMPLIFYING" THIS:
 * We used to ask for the whole window in one call with a date RANGE
 * (`?dates=YYYYMMDD-YYYYMMDD`). ESPN dropped support for ranges around
 * 2026-09-15: every league, every sport, every range length and every `limit`
 * value started returning 400 Bad Request. The symptom was quiet — a ranged
 * scoreboard miss is non-fatal — so future MLS/NWSL/USL/college-softball games
 * (whose team endpoint is past-only) simply stopped appearing, and games.json
 * fell from ~200 games to ~90 overnight. Month-granular `?dates=YYYYMM` and
 * single-day `?dates=YYYYMMDD` both still work. Don't go back to ranges without
 * re-probing first.
 *
 * A useful consequence: with month queries, a 400 no longer means "nothing
 * scheduled then". ESPN 400s a bad league slug on EVERY form of the request,
 * but answers 200 with `events: []` for a valid slug that simply has nothing
 * in that month. So 400 ⇒ broken config / broken ESPN, and 200-with-no-events
 * ⇒ genuinely out of season. That's how we tell a dead World Cup slug from a
 * World Cup that just isn't on right now (see `notices` in the output).
 *
 * For each team we merge events from both endpoints and dedupe by event.id,
 * which gives us correct coverage regardless of which league behaves which
 * way. This was added after the initial release shipped with only past
 * games for non-MLB teams — the user reported "only MLB teams have future
 * games" and probing showed the team schedule endpoint was the cause.
 *
 * Each team declares an array of `espn.leagues` (competition slugs). We pull
 * schedule+scoreboard for each one and dedupe by event.id — the same physical
 * match has a single id even if multiple slugs surface it. National teams
 * are the motivating case (friendlies, WCQ, Euros, Nations League, etc., all
 * live under different slugs), but clubs use it too where they play in
 * multiple competitions (e.g. PSG-W in D1 Arkema + Women's Champions League).
 *
 * Teams ESPN doesn't cover (e.g. USL W League — no ESPN/TheSportsDB presence,
 * SportsEngine's public API only returns games scheduled for streaming) can
 * instead point `static` at a hand-entered fixtures file (see data/*-fixtures.json).
 *
 * Besides `teams`, the config can declare `tournaments` — whole competitions
 * tracked without a team filter (e.g. the FIFA World Cup). Each one reads the
 * league scoreboard over the full window; every event is kept, transformed
 * into a neutral home-vs-away shape (see transformTournamentEvent).
 *
 * A tournament may also carry a `filter`, which keeps only the events falling
 * on given weekdays at or after a given hour, evaluated in a named timezone.
 * That's how the Monday/Thursday Night Football entry slices the NFL's
 * league-wide schedule down to the primetime games without naming any teams.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const TEAMS_PATH = 'teams.json';
const OUTPUT_PATH = 'data/games.json';
const USER_AGENT = 'sportsview/1.0 (+https://github.com/) personal-use';

// ─────────────────────────────────────────────────────────────────────────────
// ESPN fetch helpers
// ─────────────────────────────────────────────────────────────────────────────
// ESPN's edge occasionally throws transient 5xx errors (a one-off 502 on
// 2026-06-11 wiped a team's games for a day). Retry those — and network
// errors — a couple of times with a short backoff before giving up. 4xx
// responses are real (bad slug / bad ID) and fail immediately.
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
async function fetchJSON(url, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) {
        const err = new Error(`ESPN returned ${res.status} ${res.statusText} for ${url}`);
        err.status = res.status;
        err.retryable = RETRYABLE_STATUS.has(res.status);
        throw err;
      }
      return await res.json();
    } catch (err) {
      const retryable = err.retryable ?? true; // network-level errors: retry
      if (!retryable || attempt >= attempts) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function fetchTeamSchedule(team, league) {
  const { sport, teamId } = team.espn;
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`;
  const data = await fetchJSON(url);
  return {
    league,
    events: data.events ?? [],
    // Cross-check: the team name ESPN actually returned for this ID. The
    // run loop surfaces this so wrong-team-ID bugs become visible on the
    // first run (cf. the 9726-is-Seattle-Sounders-not-San-Jose-Earthquakes
    // incident — soccer IDs in particular are notoriously inconsistent).
    espnTeamName: data.team?.displayName ?? null,
  };
}

// Snap the window edges to calendar-day boundaries (UTC) so an event on
// the boundary day isn't excluded just because its kickoff time is earlier
// than the script's run-time-of-day. Without this, e.g. a game on
// 2026-05-17T20:05Z dropped out when the script ran at 2026-05-31T20:34Z
// because 20:05Z falls 29 minutes before the (run-time-of-day - 14d) cutoff.
function windowBounds(window) {
  const now = new Date();
  const min = new Date(now); min.setUTCDate(now.getUTCDate() - window.pastDays); min.setUTCHours(0, 0, 0, 0);
  const max = new Date(now); max.setUTCDate(now.getUTCDate() + window.futureDays); max.setUTCHours(23, 59, 59, 999);
  return { min, max };
}

// Every calendar month (YYYYMM) the window touches, inclusive of the months
// containing both edges. A ±14/+75-day window spans three or four of them.
function monthsInWindow({ min, max }) {
  const months = [];
  const cursor = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1));
  const lastKey = max.getUTCFullYear() * 12 + max.getUTCMonth();
  while (cursor.getUTCFullYear() * 12 + cursor.getUTCMonth() <= lastKey) {
    months.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

// `limit=1000` matters: the scoreboard defaults to 100 events per response,
// which would silently truncate a busy league's month.
function buildScoreboardURL(sport, league, yyyymm) {
  return `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${yyyymm}&limit=1000`;
}

// One (sport, league, month) fetch, cached for the run. Teams sharing a league
// — and a tournament sharing a league with a team — all reuse the same call.
const monthCache = new Map();
function fetchLeagueMonth(sport, league, yyyymm) {
  const key = `${sport}/${league}/${yyyymm}`;
  if (!monthCache.has(key)) {
    monthCache.set(key, (async () => {
      try {
        const data = await fetchJSON(buildScoreboardURL(sport, league, yyyymm));
        return { ok: true, events: data.events ?? [], leagueMeta: data.leagues?.[0] ?? null };
      } catch (err) {
        return { ok: false, events: [], leagueMeta: null, error: err };
      }
    })());
  }
  return monthCache.get(key);
}

// League-wide events across the whole window, month by month, deduped by id.
// Returns the per-month outcome too, so callers can tell "ESPN rejected this
// slug outright" (every month failed) from "this competition has nothing on"
// (every month answered, with no events).
async function fetchLeagueScoreboard(sport, league, bounds) {
  const months = monthsInWindow(bounds);
  const results = await Promise.all(months.map(m => fetchLeagueMonth(sport, league, m)));

  const byId = new Map();
  let leagueMeta = null;
  const failures = [];
  for (const r of results) {
    if (!r.ok) { failures.push(r.error); continue; }
    leagueMeta ??= r.leagueMeta;
    for (const e of r.events) byId.set(String(e.id), e);
  }
  return {
    events: [...byId.values()],
    leagueMeta,
    monthsRequested: months.length,
    monthsFailed: failures.length,
    // Every month rejected ⇒ the slug itself is bad (or ESPN is down). ESPN
    // answers 200 with an empty events[] for a valid-but-idle competition.
    allFailed: failures.length > 0 && failures.length === months.length,
    error: failures[0] ?? null,
  };
}

// Day-of-week / kickoff-hour filter, evaluated in a named timezone. Lets a
// tournament entry track a recurring slot in a league's schedule (MNF/TNF)
// rather than the whole league. Timezone matters: an 8:15pm ET Monday kickoff
// is already Tuesday in UTC, so filtering on UTC weekdays would miss every
// single Monday night game.
function makeEventFilter(filter) {
  if (!filter) return () => true;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: filter.timeZone ?? 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const weekdays = new Set(filter.weekdays ?? []);
  return (event) => {
    const d = new Date(event.date);
    if (Number.isNaN(d.getTime())) return false;
    const { weekday, hour } = describeInZone(fmt, d);
    if (weekdays.size && !weekdays.has(weekday)) return false;
    if (filter.minHour != null && hour < filter.minHour) return false;
    if (filter.maxHour != null && hour > filter.maxHour) return false;
    return true;
  };
}

function describeInZone(fmt, date) {
  const parts = fmt.formatToParts(date);
  return {
    weekday: parts.find(p => p.type === 'weekday')?.value ?? '',
    hour: Number(parts.find(p => p.type === 'hour')?.value ?? NaN),
  };
}

function eventInvolvesTeam(event, teamId) {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const tid = String(teamId);
  return competitors.some(c => String(c.id) === tid || String(c.team?.id) === tid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform a raw ESPN event into our clean shape.
// Crucially, we do NOT copy any score fields. We never want them in games.json.
// ─────────────────────────────────────────────────────────────────────────────
function transformEvent(event, team, window) {
  const date = new Date(event.date);
  if (Number.isNaN(date.getTime())) return null;

  const { min, max } = windowBounds(window);
  if (date < min || date > max) return null;

  const comp = event.competitions?.[0];
  if (!comp) return null;

  const competitors = comp.competitors ?? [];
  const us = competitors.find(c => String(c.id) === String(team.espn.teamId)
                              || String(c.team?.id) === String(team.espn.teamId));
  const opponent = competitors.find(c => c !== us);
  if (!us || !opponent) return null;

  return {
    id: `${team.id}-${event.id}`,
    teamId: team.id,
    dateISO: event.date,
    isHome: us.homeAway === 'home',
    opponentShort: opponent.team?.shortDisplayName
                ?? opponent.team?.name
                ?? opponent.team?.displayName
                ?? 'TBD',
    // ESPN returns logos in two shapes:
    //   - team /schedule:  competitor.team.logos  (array of {href, rel, ...})
    //   - league /scoreboard: competitor.team.logo (singular string)
    // Future MLS/NWSL events come from the scoreboard path, so without the
    // singular-string fallback their opponents render with no logo.
    opponentLogo: opponent.team?.logos?.[0]?.href ?? opponent.team?.logo ?? null,
    venue: comp.venue?.fullName ?? null,
    broadcasts: extractBroadcasts(comp),
    // NOTE: we intentionally do not include any score / status.type.completed
    // fields. The UI infers past vs upcoming from dateISO alone, by design.
  };
}

// Tournament events have no "us vs them" — both sides are kept, home first.
// The game carries `homeShort`/`awayShort` instead of `opponentShort`, which
// is also how the UI tells a tournament card from a team card.
function transformTournamentEvent(event, tournament, window) {
  const date = new Date(event.date);
  if (Number.isNaN(date.getTime())) return null;

  const { min, max } = windowBounds(window);
  if (date < min || date > max) return null;

  const comp = event.competitions?.[0];
  if (!comp) return null;

  const competitors = comp.competitors ?? [];
  const home = competitors.find(c => c.homeAway === 'home') ?? competitors[0];
  const away = competitors.find(c => c !== home);
  if (!home || !away) return null;

  const nameOf = c => c.team?.shortDisplayName ?? c.team?.name ?? c.team?.displayName ?? 'TBD';
  // `||` not `??`: unscheduled knockout slots ("SF W1") come back with
  // logo as an empty string, which should fall through to the placeholder.
  const logoOf = c => c.team?.logos?.[0]?.href || c.team?.logo || null;

  return {
    id: `${tournament.id}-${event.id}`,
    teamId: tournament.id,
    dateISO: event.date,
    homeShort: nameOf(home),
    homeLogo: logoOf(home),
    awayShort: nameOf(away),
    awayLogo: logoOf(away),
    // Stage/group annotation when ESPN provides one (e.g. "Group A").
    note: comp.notes?.[0]?.headline ?? null,
    venue: comp.venue?.fullName ?? null,
    broadcasts: extractBroadcasts(comp),
    // Same no-scores rule as transformEvent.
  };
}

// Weekday label for a filtered tournament ("Monday Night" / "Thursday Night"),
// resolved in the filter's own timezone so it agrees with what the filter matched.
function labelFor(labels, event, filter) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: filter?.timeZone ?? 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const { weekday } = describeInZone(fmt, new Date(event.date));
  return labels[weekday] ?? null;
}

// ESPN returns broadcast info in a few different shapes across endpoints/leagues.
// Normalize them all into a flat array of network names.
function extractBroadcasts(comp) {
  const names = new Set();
  for (const b of comp.broadcasts ?? []) {
    if (Array.isArray(b.names)) b.names.forEach(n => names.add(n));
    if (b.media?.shortName) names.add(b.media.shortName);
    if (b.shortName) names.add(b.shortName);
    if (b.name) names.add(b.name);
  }
  // Some leagues put it under `geoBroadcasts` instead.
  for (const b of comp.geoBroadcasts ?? []) {
    if (b.media?.shortName) names.add(b.media.shortName);
  }
  return Array.from(names);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const raw = await fs.readFile(TEAMS_PATH, 'utf-8');
  const config = JSON.parse(raw);
  const window = config.window ?? { pastDays: 14, futureDays: 30 };
  const bounds = windowBounds(window);

  const allGames = [];
  const errors = [];
  // Competitions that answered cleanly but have nothing scheduled right now.
  // Deliberately NOT errors — see the `dates` note at the top of this file.
  const notices = [];
  // ESPN event id -> the team game(s) we already kept for it, so a tournament
  // covering the same fixture can tag the existing card instead of adding a
  // duplicate one to the same day.
  const gamesByEspnId = new Map();

  for (const team of config.teams) {
    process.stdout.write(`→ ${team.shortName.padEnd(14)}`);
    try {
      let kept = 0;

      // Static fixtures: for teams ESPN doesn't cover (e.g. small / new
      // leagues like the USL W League). Hand-entered JSON keyed by team id;
      // see ondeck/data/*-fixtures.json. Filter to the same window as ESPN.
      if (team.static) {
        const staticRaw = await fs.readFile(team.static, 'utf-8');
        const staticData = JSON.parse(staticRaw);
        // Optional opponent-logo map keyed by opponentShort, so we don't have
        // to repeat the URL on every game vs the same opponent. Strip the
        // "_comment" key, which is documentation only.
        const opponentLogos = { ...(staticData.opponents ?? {}) };
        delete opponentLogos._comment;
        const { min, max } = windowBounds(window);
        let inWindow = 0;
        for (const [i, g] of (staticData.games ?? []).entries()) {
          const date = new Date(g.dateISO);
          if (Number.isNaN(date.getTime()) || date < min || date > max) continue;
          allGames.push({
            id: `${team.id}-static-${i}`,
            teamId: team.id,
            dateISO: g.dateISO,
            isHome: !!g.isHome,
            opponentShort: g.opponentShort ?? 'TBD',
            opponentLogo: g.opponentLogo ?? opponentLogos[g.opponentShort] ?? null,
            venue: g.venue ?? null,
            broadcasts: g.broadcasts ?? [],
          });
          inWindow++;
        }
        kept += inWindow;
        const total = staticData.games?.length ?? 0;
        console.log(`  ${kept} in window  (static=${total}, ${inWindow} in window) [verified ${staticData.lastVerified ?? '?'}]`);
        await new Promise(r => setTimeout(r, 50));
        continue;
      }

      const leagues = team.espn.leagues;
      // For each league this team plays in, pull both sources in parallel:
      //   - team /schedule:  authoritative for past games; sometimes future too (MLB)
      //   - league /scoreboard over the window: fills the gap for leagues whose
      //     team endpoint is past-only (MLS/NWSL/USL/college-softball).
      // Parallelize all (league × source) calls for this team. Scoreboard months
      // are de-duped across teams by the per-(sport,league,month) cache, so
      // multi-league teams only pay the schedule-call cost once per league.
      const perLeague = await Promise.all(leagues.map(async league => {
        const [scheduleRes, scoreboard] = await Promise.all([
          // A schedule failure in ONE league must not drop the whole team:
          // a transient 502 on usa.nwsl.summer.cup once wiped every Bay FC
          // game (including all the NWSL ones) from games.json for a day.
          // Record it in errors[] (so the UI pill surfaces it) and carry on
          // with the other leagues plus the scoreboard.
          fetchTeamSchedule(team, league).catch(err => {
            errors.push({ team: team.shortName, error: `${league} schedule: ${err.message}` });
            process.stderr.write(`  (schedule miss for ${league}: ${err.message})\n`);
            return { league, events: [], espnTeamName: null };
          }),
          fetchLeagueScoreboard(team.espn.sport, league, bounds),
        ]);
        // Only a wholesale rejection is worth reporting — a valid slug with
        // nothing scheduled this month is the normal off-season case.
        if (scoreboard.allFailed) {
          errors.push({ team: team.shortName, error: `${league} scoreboard: ${scoreboard.error.message}` });
          process.stderr.write(`  (scoreboard miss for ${league}: ${scoreboard.error.message})\n`);
        }
        const fromScoreboard = scoreboard.events.filter(e => eventInvolvesTeam(e, team.espn.teamId));
        return { ...scheduleRes, fromScoreboard };
      }));

      // Dedupe across all (league × source) results by event id. ESPN gives the
      // same event the same id regardless of which competition slug surfaces it.
      const merged = new Map();
      let fromTeam = 0, fromSb = 0;
      let espnTeamName = null;
      let crossCheckOk = true;
      for (const { league, events: teamEvents, espnTeamName: nm, fromScoreboard } of perLeague) {
        fromTeam += teamEvents.length;
        fromSb += fromScoreboard.length;
        for (const e of teamEvents)     merged.set(String(e.id), e);
        for (const e of fromScoreboard) if (!merged.has(String(e.id))) merged.set(String(e.id), e);
        // First non-null name wins for the summary; check every league's name
        // against the configured fullName so a wrong teamId in any one league
        // is visible.
        if (nm) {
          espnTeamName ??= nm;
          const expected = team.fullName.toLowerCase();
          const actual = nm.toLowerCase();
          const ok = actual === expected
                  || expected.includes(actual)
                  || actual.includes(expected);
          if (!ok) {
            crossCheckOk = false;
            process.stderr.write(`  (name mismatch in ${league}: expected "${team.fullName}", got "${nm}")\n`);
          }
        }
      }

      for (const [espnId, event] of merged) {
        const game = transformEvent(event, team, window);
        if (game) {
          allGames.push(game);
          gamesByEspnId.set(espnId, [...(gamesByEspnId.get(espnId) ?? []), game]);
          kept++;
        }
      }

      const crossCheck = espnTeamName ? `  [${crossCheckOk ? '✓' : '⚠'} ESPN: ${espnTeamName}]` : '';
      const leagueSuffix = leagues.length > 1 ? ` across ${leagues.length} leagues` : '';
      console.log(`  ${kept} in window  (schedule=${fromTeam}, scoreboard=${fromSb})${leagueSuffix}${crossCheck}`);
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
      errors.push({ team: team.shortName, error: err.message });
    }
    // Be a polite client.
    await new Promise(r => setTimeout(r, 250));
  }

  // Tournaments: whole-competition entries (no team filter), optionally
  // narrowed to a recurring slot by `filter` (see makeEventFilter).
  for (const tournament of config.tournaments ?? []) {
    process.stdout.write(`→ ${tournament.shortName.padEnd(14)}`);
    const { sport, league } = tournament.espn;
    const scoreboard = await fetchLeagueScoreboard(sport, league, bounds);

    // Every month rejected means ESPN doesn't recognise the slug at all (or is
    // down) — that's a real error. A competition that's simply not on right now
    // answers 200 with an empty events[], and lands in notices[] instead.
    if (scoreboard.allFailed) {
      console.log(`  ✗ ${scoreboard.error.message}`);
      errors.push({ team: tournament.shortName, error: scoreboard.error.message });
      await new Promise(r => setTimeout(r, 250));
      continue;
    }

    const matches = makeEventFilter(tournament.filter);
    const labels = tournament.filter?.labels ?? null;
    let kept = 0, linked = 0, considered = 0;
    for (const event of scoreboard.events) {
      if (!matches(event)) continue;
      considered++;
      // Already on the schedule as one of our teams' games? Tag that card with
      // this tournament instead of adding a second one for the same fixture —
      // otherwise a 49ers Monday nighter, or a USWNT World Cup match, would
      // show up twice on the same day.
      const existing = gamesByEspnId.get(String(event.id));
      if (existing?.length) {
        for (const g of existing) {
          g.extraTeamIds = [...new Set([...(g.extraTeamIds ?? []), tournament.id])];
          if (labels && !g.note) g.note = labelFor(labels, event, tournament.filter);
        }
        linked++;
        continue;
      }
      const game = transformTournamentEvent(event, tournament, window);
      if (game) {
        if (labels) game.note ??= labelFor(labels, event, tournament.filter);
        allGames.push(game);
        kept++;
      }
    }

    // Same spirit as the team-name cross-check: surface what competition
    // ESPN thinks this slug is, so a wrong slug is visible on first run.
    const espnName = scoreboard.leagueMeta?.name ?? null;
    const season = scoreboard.leagueMeta?.season?.year ?? null;
    if (kept === 0 && linked === 0) {
      // Valid slug, no fixtures in the window. Record why, so the UI can say
      // "not on right now" rather than flagging an issue.
      notices.push({
        team: tournament.shortName,
        notice: `No fixtures in the window — ESPN knows ${espnName ?? league}`
              + (season ? ` (latest season ${season})` : '')
              + ` but has nothing scheduled between now and +${window.futureDays} days.`,
      });
    }
    if (scoreboard.monthsFailed) {
      process.stderr.write(`  (${scoreboard.monthsFailed}/${scoreboard.monthsRequested} months failed for ${league})\n`);
    }
    const filterNote = tournament.filter ? `, ${considered} matched filter` : '';
    console.log(`  ${kept} in window  (scoreboard=${scoreboard.events.length}${filterNote}`
              + `${linked ? `, ${linked} linked to a team card` : ''})`
              + `${espnName ? `  [ESPN: ${espnName}]` : ''}`);
    await new Promise(r => setTimeout(r, 250));
  }

  allGames.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

  const output = {
    generatedAt: new Date().toISOString(),
    window,
    teams: config.teams,
    tournaments: config.tournaments ?? [],
    games: allGames,
    errors,
    notices,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n✓ Wrote ${allGames.length} games to ${OUTPUT_PATH}`);
  if (errors.length) {
    console.log(`⚠ ${errors.length} team(s) failed — see errors[] in games.json`);
  }
  if (notices.length) {
    console.log(`· ${notices.length} competition(s) idle — see notices[] in games.json`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
