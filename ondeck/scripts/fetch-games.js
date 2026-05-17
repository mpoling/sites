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
 *   /apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD-YYYYMMDD
 *     — league-wide events in a date range. We use this to pick up the
 *       FUTURE events the team endpoint omits. Cached per league within
 *       a run since teams in the same league share the same scoreboard.
 *
 * For each team we merge events from both endpoints and dedupe by event.id,
 * which gives us correct coverage regardless of which league behaves which
 * way. This was added after the initial release shipped with only past
 * games for non-MLB teams — the user reported "only MLB teams have future
 * games" and probing showed the team schedule endpoint was the cause.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const TEAMS_PATH = 'teams.json';
const OUTPUT_PATH = 'data/games.json';
const USER_AGENT = 'sportsview/1.0 (+https://github.com/) personal-use';

// ─────────────────────────────────────────────────────────────────────────────
// ESPN fetch helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`ESPN returned ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function fetchTeamSchedule(team) {
  const { sport, league, teamId } = team.espn;
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`;
  const data = await fetchJSON(url);
  return {
    events: data.events ?? [],
    // Cross-check: the team name ESPN actually returned for this ID. The
    // run loop surfaces this so wrong-team-ID bugs become visible on the
    // first run (cf. the 9726-is-Seattle-Sounders-not-San-Jose-Earthquakes
    // incident — soccer IDs in particular are notoriously inconsistent).
    espnTeamName: data.team?.displayName ?? null,
  };
}

// Format a Date as YYYYMMDD in UTC. ESPN's scoreboard `dates` parameter is
// date-only; UTC vs local timezone slop here is at most one day, which is
// fine given our window is ±14 / +30 days.
function yyyymmdd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// Build the league-scoreboard URL covering the future portion of our window.
// We don't bother going into the past — the /teams/{id}/schedule endpoint
// already covers past games well for every league we use.
function buildScoreboardURL(sport, league, futureDays) {
  const now = new Date();
  const start = yyyymmdd(now);
  const end = new Date(now);
  end.setDate(now.getDate() + futureDays);
  return `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${start}-${yyyymmdd(end)}`;
}

// Cache scoreboards per (sport, league) key so leagues with multiple teams
// (e.g. MLS has both Quakes and Inter Miami) make one network call instead
// of N. Returns either the scoreboard's events[] or [] on failure (logged
// to stderr but non-fatal — we still have whatever the team endpoint gave us).
const scoreboardCache = new Map();
async function fetchLeagueScoreboard(sport, league, futureDays) {
  const key = `${sport}/${league}`;
  if (!scoreboardCache.has(key)) {
    scoreboardCache.set(key, (async () => {
      const url = buildScoreboardURL(sport, league, futureDays);
      try {
        const data = await fetchJSON(url);
        return data.events ?? [];
      } catch (err) {
        process.stderr.write(`  (scoreboard miss for ${key}: ${err.message})\n`);
        return [];
      }
    })());
  }
  return scoreboardCache.get(key);
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

  const now = new Date();
  const min = new Date(now); min.setDate(now.getDate() - window.pastDays);
  const max = new Date(now); max.setDate(now.getDate() + window.futureDays);
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
    opponentLogo: opponent.team?.logos?.[0]?.href ?? null,
    venue: comp.venue?.fullName ?? null,
    broadcasts: extractBroadcasts(comp),
    // NOTE: we intentionally do not include any score / status.type.completed
    // fields. The UI infers past vs upcoming from dateISO alone, by design.
  };
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

  const allGames = [];
  const errors = [];

  for (const team of config.teams) {
    process.stdout.write(`→ ${team.shortName.padEnd(14)}`);
    try {
      // Pull both sources in parallel:
      //   - team /schedule:  authoritative for past games; sometimes future too (MLB)
      //   - league /scoreboard for the future window: fills the gap for leagues whose
      //     team endpoint is past-only (MLS/NWSL/USL/college-softball).
      const [scheduleRes, scoreboardEvents] = await Promise.all([
        fetchTeamSchedule(team),
        fetchLeagueScoreboard(team.espn.sport, team.espn.league, window.futureDays),
      ]);
      const { events: teamEvents, espnTeamName } = scheduleRes;
      const futureForUs = scoreboardEvents.filter(e => eventInvolvesTeam(e, team.espn.teamId));

      // Dedupe: prefer the team-endpoint version when both are present.
      const merged = new Map();
      for (const e of teamEvents)  merged.set(String(e.id), e);
      for (const e of futureForUs) if (!merged.has(String(e.id))) merged.set(String(e.id), e);

      let kept = 0;
      for (const event of merged.values()) {
        const game = transformEvent(event, team, window);
        if (game) { allGames.push(game); kept++; }
      }

      // Cross-check: surface ESPN's reported team name so wrong teamIds are
      // immediately visible. Also report how many came from each source.
      const fromTeam = teamEvents.length;
      const fromSb = futureForUs.length;
      let crossCheck = '';
      if (espnTeamName) {
        const expected = team.fullName.toLowerCase();
        const actual = espnTeamName.toLowerCase();
        const ok = actual === expected
                || expected.includes(actual)
                || actual.includes(expected);
        crossCheck = `  [${ok ? '✓' : '⚠'} ESPN: ${espnTeamName}]`;
      }
      console.log(`  ${kept} in window  (schedule=${fromTeam}, scoreboard-future=${fromSb})${crossCheck}`);
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
      errors.push({ team: team.shortName, error: err.message });
    }
    // Be a polite client.
    await new Promise(r => setTimeout(r, 250));
  }

  allGames.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

  const output = {
    generatedAt: new Date().toISOString(),
    window,
    teams: config.teams,
    games: allGames,
    errors,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n✓ Wrote ${allGames.length} games to ${OUTPUT_PATH}`);
  if (errors.length) {
    console.log(`⚠ ${errors.length} team(s) failed — see errors[] in games.json`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
