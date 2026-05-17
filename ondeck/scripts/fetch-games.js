#!/usr/bin/env node
/**
 * fetch-games.js
 *
 * Reads teams.json, hits ESPN's unofficial schedule endpoint for each team,
 * strips out scores, and writes a clean data/games.json for the static site
 * to consume.
 *
 * Designed to run in GitHub Actions on a cron schedule. Uses native fetch
 * (Node 18+); no dependencies.
 *
 * Endpoint shape (undocumented but stable):
 *   https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}/schedule
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const TEAMS_PATH = 'teams.json';
const OUTPUT_PATH = 'data/games.json';
const USER_AGENT = 'sportsview/1.0 (+https://github.com/) personal-use';

// ─────────────────────────────────────────────────────────────────────────────
// ESPN fetch
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTeamSchedule(team) {
  const { sport, league, teamId } = team.espn;
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`ESPN returned ${res.status} ${res.statusText} for ${url}`);
  }

  const data = await res.json();
  return {
    events: data.events ?? [],
    // Cross-check: the team name ESPN actually returned for this ID. The
    // run loop surfaces this so wrong-team-ID bugs become visible on the
    // first run (cf. the 9726-is-Seattle-Sounders-not-San-Jose-Earthquakes
    // incident — soccer IDs in particular are notoriously inconsistent).
    espnTeamName: data.team?.displayName ?? null,
  };
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
      const { events, espnTeamName } = await fetchTeamSchedule(team);
      let kept = 0;
      for (const event of events) {
        const game = transformEvent(event, team, window);
        if (game) { allGames.push(game); kept++; }
      }
      // Surface ESPN's reported team name so a wrong teamId in teams.json
      // is immediately visible in the run log. ✓ when the names match
      // (substring either direction is fine for cases like "Stanford
      // Cardinal" vs "Stanford Cardinal Softball"), ⚠ otherwise.
      let crossCheck = '';
      if (espnTeamName) {
        const expected = team.fullName.toLowerCase();
        const actual = espnTeamName.toLowerCase();
        const ok = actual === expected
                || expected.includes(actual)
                || actual.includes(expected);
        crossCheck = `  [${ok ? '✓' : '⚠'} ESPN: ${espnTeamName}]`;
      }
      console.log(`  ${kept} games in window (of ${events.length} returned)${crossCheck}`);
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
