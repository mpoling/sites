/* uslw — shared rendering for the index and division pages.
 *
 * Both pages load the same ./standings.json (produced by scrape-standings.py)
 * and render entirely client-side. Relative paths only, so this works behind
 * the Cloudflare-Worker → GitHub-Pages routing without leaking the subdirectory.
 */

// Fetch the dataset once. Cache-bust lightly so a fresh data push shows up
// without a hard reload, but still allow normal HTTP caching within a session.
async function loadData() {
  const res = await fetch("./standings.json");
  if (!res.ok) throw new Error(`Could not load standings.json (${res.status})`);
  return res.json();
}

// Flatten every (season, division) pair — the data is grouped by season, but
// for this league there's a single season ("Pre-Professional").
function eachDivision(data) {
  const out = [];
  for (const season of data.seasons ?? []) {
    for (const division of season.divisions ?? []) {
      out.push({ season, division });
    }
  }
  return out;
}

// Resolve a teamId to its {name, logo} via the top-level registry.
function team(data, id) {
  return data.teams?.[String(id)] ?? { name: `#${id}`, logo: null };
}

// A small crest <img> (or a neutral placeholder if the team has no logo).
function crest(t) {
  if (!t.logo) return `<span class="crest" aria-hidden="true"></span>`;
  return `<img class="crest" src="${esc(t.logo)}" alt="" loading="lazy">`;
}

// Reconstruct the Google Maps link we deliberately dropped from the JSON
// (it's derivable from lat/lng + placeId, so we rebuild it only when rendering).
function mapsUrl(v) {
  if (v?.lat == null || v?.lng == null) return null;
  let u = `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`;
  if (v.placeId) u += `&query_place_id=${encodeURIComponent(v.placeId)}`;
  return u;
}

// Minimal HTML-escape for any string we drop into markup.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ── Index page ───────────────────────────────────────────────────────────────

async function renderIndex(root) {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    root.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }

  const divisions = eachDivision(data).sort((a, b) =>
    a.division.name.localeCompare(b.division.name)
  );

  if (!divisions.length) {
    root.innerHTML = `<p class="empty">No divisions found.</p>`;
    return;
  }

  const cards = divisions.map(({ season, division }) => {
    const teams = division.teams ?? [];
    const leader = teams[0];
    const leaderTeam = leader ? team(data, leader.teamId) : null;
    const leaderHtml = leaderTeam
      ? `<div class="leader">${crest(leaderTeam)}<span>${esc(leaderTeam.name)}</span></div>`
      : "";
    return `
      <a class="div-card" href="./division.html?d=${encodeURIComponent(division.groupId)}">
        <div class="name">${esc(division.name)}</div>
        <div class="meta">${teams.length} team${teams.length === 1 ? "" : "s"} · ${esc(season.name ?? "")}</div>
        ${leaderHtml}
      </a>`;
  });

  root.innerHTML = `<div class="grid">${cards.join("")}</div>`;
  setUpdated(data);
}

// ── Division page ─────────────────────────────────────────────────────────────

async function renderDivision(root, titleEl) {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    root.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }

  const id = new URLSearchParams(location.search).get("d");
  const found = eachDivision(data).find((x) => String(x.division.groupId) === String(id));

  if (!found) {
    root.innerHTML = `<p class="error">Division not found. <a href="./">Back to all divisions</a>.</p>`;
    return;
  }

  const { season, division } = found;
  document.title = `${division.name} — USL W League`;
  if (titleEl) titleEl.textContent = `${division.name} Division`;

  root.innerHTML =
    standingsTable(data, division) + headToHeadSection(data, division);
  setUpdated(data);
}

// Standings table: rank, crest+name, then the nine stat columns in order.
function standingsTable(data, division) {
  const cols = ["PTS", "PPM", "MP", "W", "L", "T", "GF", "GA", "GD"];
  const titles = data.statColumns ?? {};
  const head = cols
    .map((c) => `<th><abbr title="${esc(titles[c] ?? c)}">${c}</abbr></th>`)
    .join("");

  const rows = (division.teams ?? [])
    .map((t) => {
      const info = team(data, t.teamId);
      const cells = cols
        .map((c) => `<td class="${c === "PTS" ? "pts" : ""}">${fmt(t.stats?.[c])}</td>`)
        .join("");
      return `
        <tr>
          <td class="rank">${fmt(t.rank)}</td>
          <td class="team"><div class="team-cell">${crest(info)}<span>${esc(info.name)}</span></div></td>
          ${cells}
        </tr>`;
    })
    .join("");

  return `
    <h2 class="section">Standings</h2>
    <div class="card">
      <table class="standings">
        <thead><tr><th class="rank">#</th><th class="team">Team</th>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Head-to-head: the matches among the kept teams, deduped across the two teams'
// arrays (each match is stored once per participant) and sorted by date.
function headToHeadSection(data, division) {
  const byId = new Map();
  for (const t of division.teams ?? []) {
    for (const m of t.headToHead ?? t.schedule ?? []) {
      if (m.matchId != null && !byId.has(m.matchId)) byId.set(m.matchId, m);
    }
  }
  const matches = [...byId.values()].sort((a, b) =>
    String(a.dateISO ?? a.dateText).localeCompare(String(b.dateISO ?? b.dateText))
  );

  if (!matches.length) {
    return `<h2 class="section">Head-to-head</h2><div class="card"><p class="empty">No head-to-head matches.</p></div>`;
  }

  const items = matches
    .map((m) => {
      const home = team(data, m.home?.teamId);
      const away = team(data, m.away?.teamId);
      const played = m.score?.played;
      const score = played
        ? `<span class="score">${fmt(m.score.home)}–${fmt(m.score.away)}</span>`
        : `<span class="score unplayed">vs</span>`;

      const v = m.venue ?? {};
      const venueName = v.label || [v.field, v.locationName].filter(Boolean).join(" — ");
      const url = mapsUrl(v);
      const venueText = venueName
        ? (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(venueName)}</a>` : esc(venueName))
        : "";
      const addr = v.address ? ` · ${esc(v.address)}` : "";

      return `
        <li>
          <div class="match-top">
            <span class="match-date">${esc(m.dateText ?? "")}</span>
            <span class="match-teams">
              <span class="side home"><span>${esc(home.name)}</span>${crest(home)}</span>
              ${score}
              <span class="side away">${crest(away)}<span>${esc(away.name)}</span></span>
            </span>
          </div>
          ${venueText ? `<div class="match-venue">${venueText}${addr}</div>` : ""}
        </li>`;
    })
    .join("");

  return `<h2 class="section">Head-to-head</h2><div class="card"><ul class="matches">${items}</ul></div>`;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

// Format a stat value; show 0 (don't blank it), em-dash for genuinely missing.
function fmt(v) {
  return v === null || v === undefined || v === "" ? "—" : esc(v);
}

// Stamp the "data updated" line in the footer, if present.
function setUpdated(data) {
  const el = document.getElementById("updated");
  if (el && data.scrapedAt) {
    const d = new Date(data.scrapedAt);
    el.textContent = isNaN(d) ? data.scrapedAt : d.toLocaleString();
  }
}
