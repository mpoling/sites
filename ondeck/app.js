/* ─────────────────────────────────────────────────────────────────────────
   OnDeck — app.js
   Renders past + upcoming games from data/games.json. No build step.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ─── Inline icons (lucide) ──────────────────────────────────────────────
  const ICONS = {
    refresh:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    tv:        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
    today:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/></svg>',
    alert:     '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
  };

  // ─── State ──────────────────────────────────────────────────────────────
  const state = {
    data: null,         // { generatedAt, teams, games, errors }
    error: null,
    selectedTeamId: null,
    refreshing: false,
    didInitialScroll: false,
    errorsPanelOpen: false,
  };

  const headerEl = document.getElementById('header');
  const mainEl   = document.getElementById('main');
  const footerEl = document.getElementById('footer');

  // ─── Utils ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function groupByDay(games) {
    const groups = new Map();
    for (const g of games) {
      const d = new Date(g.dateISO);
      const key = dayKey(d);
      if (!groups.has(key)) groups.set(key, { date: startOfDay(d), games: [] });
      groups.get(key).games.push(g);
    }
    return [...groups.values()];
  }

  function formatTime(dateISO) {
    const d = new Date(dateISO);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    // Use formatToParts so we extract the timezone name reliably regardless
    // of locale ordering / abbreviation format ("PDT" vs "GMT-7" vs commas).
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d);
    const tz = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    return tz ? `${time} ${tz}` : time;
  }

  // ─── Data loading ───────────────────────────────────────────────────────
  async function loadData() {
    try {
      const res = await fetch('./data/games.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      state.error = null;
    } catch (err) {
      state.error = err.message;
    }
  }

  async function refresh() {
    if (state.refreshing) return;
    state.refreshing = true;
    render();

    // Minimum spin time so the action feels intentional rather than flickery.
    await Promise.all([loadData(), new Promise(r => setTimeout(r, 600))]);

    state.refreshing = false;
    render();
  }

  function selectTeam(id) {
    state.selectedTeamId = id;
    render();
    // Jump to today within the new view rather than to the top — the user
    // almost always wants to see what's next, not the oldest entry.
    scrollToToday('smooth');
  }

  // Small breathing room below the sticky header when we land on a day.
  const STICKY_SCROLL_BUFFER = 8;

  // Scroll the day-section matching today (or the nearest future day, or
  // failing that the most recent past day) into view, offset for the
  // sticky header. Called on first render and on navigation; the refresh
  // button intentionally does not call this — refresh should not move you.
  // Returns true if a target was found and scrolled to, false otherwise
  // (e.g. before data has loaded or in an empty filter).
  function scrollToToday(behavior = 'smooth') {
    const todayKey = dayKey(new Date());
    const all = [...document.querySelectorAll('[data-day-key]')];
    if (all.length === 0) return false;
    // Lex comparison is fine here: dayKey emits YYYY-MM-DD, which sorts
    // chronologically as a string.
    const target = all.find(el => el.dataset.dayKey === todayKey)
                || all.find(el => el.dataset.dayKey > todayKey)
                || all[all.length - 1];
    if (!target) return false;
    const headerH = headerEl.getBoundingClientRect().height;
    const top = target.getBoundingClientRect().top + window.scrollY
              - headerH - STICKY_SCROLL_BUFFER;
    window.scrollTo({ top: Math.max(0, top), behavior });
    return true;
  }

  // ─── Renderers ──────────────────────────────────────────────────────────
  function renderHeader() {
    const team = state.selectedTeamId && state.data
      ? state.data.teams.find(t => t.id === state.selectedTeamId)
      : null;

    if (team) {
      return `
        <div class="container header-inner">
          <div class="header-team">
            <button class="icon-btn" data-action="back" aria-label="Back to all teams">${ICONS.arrowLeft}</button>
            <img src="${esc(team.logo)}" class="team-logo-lg" alt="" loading="lazy">
            <div class="team-meta">
              <div class="mono caps muted-2">${esc(team.league)} · ${esc(team.sport)}</div>
              <h1 class="serif team-name">${esc(team.fullName)}</h1>
            </div>
          </div>
        </div>
      `;
    }

    // Split teams into "in-season" (any games in window) and "off-season"
    // (no games). Off-season teams sort to the end and get visually dimmed,
    // so they don't compete for attention with teams actually playing now.
    const teams = state.data?.teams ?? [];
    const games = state.data?.games ?? [];
    const hasGames = (id) => games.some(g => g.teamId === id);
    const orderedTeams = [
      ...teams.filter(t => hasGames(t.id)),
      ...teams.filter(t => !hasGames(t.id)),
    ];

    const chipsHtml = orderedTeams.map(t => {
      const off = !hasGames(t.id);
      return `
        <button class="chip ${off ? 'chip--off' : ''}"
                data-action="select-team" data-team-id="${esc(t.id)}"
                ${off ? 'title="Off-season — no games in window"' : ''}>
          <span class="chip-dot" style="background:${esc(t.accent)}"></span>
          <img src="${esc(t.logo)}" class="chip-logo" alt="" loading="lazy">
          <span>${esc(t.shortName)}</span>
        </button>
      `;
    }).join('');

    // Surface fetch errors as a clickable pill in the action row. The pill
    // toggles a panel underneath the chips that lists each failure.
    const fetchErrors = state.data?.errors ?? [];
    const errorPillHtml = fetchErrors.length > 0 ? `
      <button class="error-pill"
              data-action="toggle-errors"
              aria-expanded="${state.errorsPanelOpen ? 'true' : 'false'}"
              aria-controls="errors-panel"
              aria-label="${fetchErrors.length} fetch ${fetchErrors.length === 1 ? 'issue' : 'issues'} — click for details">
        ${ICONS.alert}
        <span>${fetchErrors.length} ${fetchErrors.length === 1 ? 'issue' : 'issues'}</span>
      </button>
    ` : '';

    const errorsPanelHtml = (fetchErrors.length > 0 && state.errorsPanelOpen) ? `
      <div id="errors-panel" class="errors-panel" role="region" aria-label="Fetch issues">
        <p class="mono caps muted-2 errors-panel-title">From last refresh</p>
        <ul>
          ${fetchErrors.map(e => `
            <li>
              <span class="serif errors-team">${esc(e.team)}</span>
              <span class="errors-msg muted">${esc(e.error)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

    return `
      <div class="container header-inner">
        <div class="header-main">
          <div>
            <div class="mono caps muted-2">Personal Sports Desk</div>
            <h1 class="serif title">On<em>Deck</em></h1>
          </div>
          <div class="header-actions">
            ${errorPillHtml}
            <button class="icon-btn icon-btn-outlined"
                    data-action="today" aria-label="Jump to today">
              ${ICONS.today}
            </button>
            <button class="icon-btn icon-btn-outlined ${state.refreshing ? 'spinning' : ''}"
                    data-action="refresh" aria-label="Refresh schedule"
                    ${state.refreshing ? 'disabled' : ''}>
              ${ICONS.refresh}
            </button>
          </div>
        </div>
        ${chipsHtml ? `<div class="chips-row"><div class="chips">${chipsHtml}</div></div>` : ''}
        ${errorsPanelHtml}
      </div>
    `;
  }

  function renderEmpty(headline, sub) {
    return `
      <div class="empty">
        <p class="serif empty-headline">${esc(headline)}</p>
        ${sub ? `<p class="empty-sub">${esc(sub)}</p>` : ''}
      </div>
    `;
  }

  function renderSchedule() {
    if (state.error) {
      return renderEmpty(
        'No schedule data yet.',
        'Run the update-games workflow to populate data/games.json.'
      );
    }
    if (!state.data) return '';

    const games = state.selectedTeamId
      ? state.data.games.filter(g => g.teamId === state.selectedTeamId)
      : state.data.games;

    if (games.length === 0) {
      return renderEmpty(
        'Quiet on the wire.',
        'No games in the window. The season may be in its off-cycle.'
      );
    }

    const sorted = [...games].sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
    return groupByDay(sorted).map(renderDaySection).join('');
  }

  function renderDaySection({ date, games }) {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const isToday    = +date === +today;
    const isTomorrow = +date === +tomorrow;
    const isPast     = date < today;

    const dayLabel   = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const monthLabel = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

    const badge =
      isToday    ? '<span class="badge badge-today mono">Today</span>' :
      isTomorrow ? '<span class="badge mono">Tomorrow</span>' : '';

    return `
      <section class="day-section" data-day-key="${esc(dayKey(date))}">
        <div class="day-header ${isPast ? 'is-past' : ''}">
          <span class="mono caps muted-2">${esc(dayLabel)}</span>
          <span class="serif day-num">${date.getDate()}</span>
          <span class="serif day-month">${esc(monthLabel)}</span>
          ${badge}
        </div>
        <div class="cards">${games.map(g => renderGameCard(g, isPast)).join('')}</div>
      </section>
    `;
  }

  function renderGameCard(game, isPast) {
    const team = state.data.teams.find(t => t.id === game.teamId);
    if (!team) return '';

    const broadcasts = (game.broadcasts || []).filter(Boolean).join('  ·  ') || 'Check listings';

    return `
      <article class="card ${isPast ? 'is-past' : ''}">
        <span class="card-stripe" style="background:${esc(team.accent)}"></span>
        <div class="card-meta mono">
          <div class="card-meta-left">
            <span class="card-league">${esc(team.league)}</span>
            <span class="card-sep">·</span>
            <span class="muted">${esc(formatTime(game.dateISO))}</span>
          </div>
          ${isPast ? '<span class="badge badge-past mono">Aired</span>' : ''}
        </div>
        <div class="card-matchup">
          <img src="${esc(team.logo)}" class="card-logo" alt="" loading="lazy">
          <span class="serif card-team">${esc(team.shortName)}</span>
          <span class="mono card-vs">${game.isHome ? 'vs' : '@'}</span>
          ${game.opponentLogo
            ? `<img src="${esc(game.opponentLogo)}" class="card-logo" alt="" loading="lazy">`
            : '<span class="card-logo-placeholder"></span>'}
          <span class="serif card-opp">${esc(game.opponentShort)}</span>
        </div>
        <div class="card-broadcast">${ICONS.tv}<span>${esc(broadcasts)}</span></div>
      </article>
    `;
  }

  function renderFooter() {
    if (!state.data && !state.error) return '';
    const dt = state.data?.generatedAt
      ? new Date(state.data.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'never';
    return `
      <div class="container footer-inner">
        <p>Schedule last refreshed · ${esc(dt)}</p>
        <p class="muted-3">Source: ESPN unofficial JSON · Built without scores by design</p>
      </div>
    `;
  }

  function render() {
    headerEl.innerHTML = renderHeader();
    mainEl.innerHTML   = `<div class="container">${renderSchedule()}</div>`;
    footerEl.innerHTML = renderFooter();
  }

  // ─── Event delegation ───────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    switch (target.dataset.action) {
      case 'select-team':   selectTeam(target.dataset.teamId);   break;
      case 'back':          selectTeam(null);                    break;
      case 'refresh':       refresh();                           break;
      case 'today':         scrollToToday('smooth');             break;
      case 'toggle-errors':
        state.errorsPanelOpen = !state.errorsPanelOpen;
        render();
        break;
    }
  });

  // ─── Init ───────────────────────────────────────────────────────────────
  loadData().then(() => {
    render();
    // Land the user on (or near) today on first paint. Use 'auto' so the
    // page doesn't animate from top-to-today on initial load — that's
    // jarring. Subsequent navigations use smooth.
    // Only mark "did initial scroll" if the scroll actually succeeded —
    // otherwise an early failed load (empty/error state) would suppress
    // future first-render scrolls if the user later navigates.
    if (!state.didInitialScroll && scrollToToday('auto')) {
      state.didInitialScroll = true;
    }
  });
})();
