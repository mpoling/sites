/* ─────────────────────────────────────────────────────────────────────────
   Uncorked — app.js
   Renders data/wines.json grouped by verdict, with an in-page editor that
   commits back to GitHub. No build step.

   Editing model: edits are kept as a small set of pending operations
   (upserts by id, deletes by id) layered over the last-loaded file. The
   pending set is mirrored to localStorage so an accidental refresh doesn't
   lose it, and on save it's re-applied onto a fresh copy of the file so two
   people editing different wines don't clobber each other.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────
  const REPO      = 'mpoling/sites';
  const BRANCH    = 'main';
  const FILE_PATH = 'wine/data/wines.json';   // repo-relative, for the API
  const LOCAL_URL = './data/wines.json';       // site-relative, for viewing

  const LS = {
    token:    'uncorked:token',
    pending:  'uncorked:pending',
    varietal: 'uncorked:varietal',
  };

  // Pseudo-tiers that aren't in the data file. "Revisit" is a flag on a
  // wine (it can carry a verdict too); "Unrated" catches wines with no
  // verdict and no revisit flag.
  const REVISIT = { id: 'revisit', label: 'Revisit', blurb: 'Worth another pour before we commit to a verdict', accent: '#60a5fa' };
  const UNRATED = { id: 'unrated', label: 'Unrated', blurb: 'On the list, no verdict yet', accent: '#78716c' };

  // ─── Inline icons (lucide) ──────────────────────────────────────────────
  const ICONS = {
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    plus:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    search:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    x:       '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    alert:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
    cloud:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/></svg>',
  };

  // ─── State ──────────────────────────────────────────────────────────────
  const state = {
    base: null,          // last-loaded file: { updatedAt, tiers, wines }
    sha: null,           // blob sha of `base` when loaded via the API
    pending: { upserts: {}, deletes: [] },  // id → wine, [id]
    error: null,         // load error message
    tokenError: null,    // API rejected the stored token
    varietal: null,      // chip filter; null = all
    query: '',
    refreshing: false,
    saving: false,
    saveError: null,
    showAbsoluteTime: false,
    editingId: null,     // id of the wine open in the editor (null = new)
    afterToken: null,    // callback to run once a token has been entered
  };

  const headerEl  = document.getElementById('header');
  const mainEl    = document.getElementById('main');
  const footerEl  = document.getElementById('footer');
  const savebarEl = document.getElementById('savebar');
  const editorEl  = document.getElementById('editor');
  const editorForm = document.getElementById('editor-form');
  const tokenEl   = document.getElementById('token-dialog');
  const tokenForm = document.getElementById('token-form');

  // ─── Utils ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'wine';
  }

  function timeAgo(iso) {
    if (!iso) return null;
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return null;
    const diffSec = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
    if (diffSec < 45)   return 'just now';
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    const diffDay = Math.round(diffSec / 86400);
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7)   return `${diffDay}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatFullTimestamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function lsGet(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  }
  function lsSet(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch { /* private mode etc. — edits still work for this page load */ }
  }

  // UTF-8-safe base64 for the Contents API.
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // ─── Data model ─────────────────────────────────────────────────────────
  function normalizeWine(w) {
    return {
      id:       String(w.id ?? ''),
      producer: String(w.producer ?? '').trim(),
      bottling: String(w.bottling ?? '').trim(),
      varietal: String(w.varietal ?? '').trim(),
      tier:     w.tier ? String(w.tier) : null,
      revisit:  Boolean(w.revisit),
      notes:    String(w.notes ?? '').trim(),
    };
  }

  function normalizeData(raw) {
    return {
      updatedAt: raw?.updatedAt ?? null,
      tiers: Array.isArray(raw?.tiers) ? raw.tiers : [],
      wines: Array.isArray(raw?.wines) ? raw.wines.map(normalizeWine) : [],
    };
  }

  // Layer the pending ops onto a base list. Used both for rendering (over
  // `state.base`) and for saving (over a freshly fetched file).
  function applyPending(wines, pending) {
    const deletes = new Set(pending.deletes);
    const out = wines.filter(w => !deletes.has(w.id)).map(w => pending.upserts[w.id] ?? w);
    const present = new Set(out.map(w => w.id));
    for (const w of Object.values(pending.upserts)) {
      if (!present.has(w.id) && !deletes.has(w.id)) out.push(w);
    }
    return out;
  }

  function wines() {
    return state.base ? applyPending(state.base.wines, state.pending) : [];
  }

  function tiers() {
    return state.base?.tiers ?? [];
  }

  function pendingCount() {
    return Object.keys(state.pending.upserts).length + state.pending.deletes.length;
  }

  function isDirty(id) {
    return id in state.pending.upserts;
  }

  function isNew(id) {
    return isDirty(id) && !state.base.wines.some(w => w.id === id);
  }

  function persistPending() {
    lsSet(LS.pending, pendingCount() > 0 ? state.pending : null);
    document.body.classList.toggle('has-savebar', pendingCount() > 0);
  }

  function upsertWine(wine) {
    // Editing a wine you'd deleted this session brings it back.
    state.pending.deletes = state.pending.deletes.filter(id => id !== wine.id);
    const original = state.base.wines.find(w => w.id === wine.id);
    if (original && JSON.stringify(original) === JSON.stringify(wine)) {
      delete state.pending.upserts[wine.id];  // edited back to what's saved
    } else {
      state.pending.upserts[wine.id] = wine;
    }
    persistPending();
  }

  function deleteWine(id) {
    delete state.pending.upserts[id];
    if (state.base.wines.some(w => w.id === id) && !state.pending.deletes.includes(id)) {
      state.pending.deletes.push(id);
    }
    persistPending();
  }

  function discardPending() {
    state.pending = { upserts: {}, deletes: [] };
    state.saveError = null;
    persistPending();
  }

  function uniqueId(producer, bottling) {
    const base = slugify(`${producer} ${bottling}`);
    const taken = new Set(wines().map(w => w.id));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  // Distinct varietals, most-populated first, then alphabetical.
  function varietals() {
    const counts = new Map();
    for (const w of wines()) {
      const v = w.varietal || 'Unknown';
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count }));
  }

  function visibleWines() {
    const q = state.query.trim().toLowerCase();
    return wines().filter(w => {
      if (state.varietal && (w.varietal || 'Unknown') !== state.varietal) return false;
      if (!q) return true;
      return [w.producer, w.bottling, w.varietal, w.notes, tierLabel(w.tier)]
        .join(' ').toLowerCase().includes(q);
    });
  }

  function tierLabel(id) {
    return tiers().find(t => t.id === id)?.label ?? '';
  }

  function sortWines(list) {
    return [...list].sort((a, b) =>
      a.producer.localeCompare(b.producer, 'en', { sensitivity: 'base' }) ||
      a.bottling.localeCompare(b.bottling, 'en', { sensitivity: 'base' })
    );
  }

  // ─── GitHub ─────────────────────────────────────────────────────────────
  function getToken() {
    return lsGet(LS.token) || null;
  }

  function apiUrl() {
    return `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`;
  }

  async function ghFetchFile(token) {
    const res = await fetch(apiUrl(), {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      const err = new Error(`GitHub ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const body = await res.json();
    return { sha: body.sha, data: normalizeData(JSON.parse(b64decode(body.content))) };
  }

  async function ghPutFile(token, sha, content, message) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, content: b64encode(content), sha, branch: BRANCH }),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message ?? ''; } catch { /* ignore */ }
      const err = new Error(`GitHub ${res.status}${detail ? ` — ${detail}` : ''}`);
      err.status = res.status;
      throw err;
    }
    const body = await res.json();
    return body.content?.sha ?? null;
  }

  // Stable, diff-friendly serialization: one wine per line.
  function serialize(data) {
    const lines = [];
    lines.push('{');
    lines.push(`  "updatedAt": ${JSON.stringify(data.updatedAt)},`);
    lines.push('  "tiers": [');
    data.tiers.forEach((t, i) => {
      lines.push(`    ${JSON.stringify(t)}${i < data.tiers.length - 1 ? ',' : ''}`);
    });
    lines.push('  ],');
    lines.push('  "wines": [');
    data.wines.forEach((w, i) => {
      lines.push(`    ${JSON.stringify(w)}${i < data.wines.length - 1 ? ',' : ''}`);
    });
    lines.push('  ]');
    lines.push('}');
    return lines.join('\n') + '\n';
  }

  function describePending(pending, base) {
    const baseIds = new Set(base.wines.map(w => w.id));
    const added   = Object.keys(pending.upserts).filter(id => !baseIds.has(id)).length;
    const changed = Object.keys(pending.upserts).length - added;
    const removed = pending.deletes.length;
    const parts = [];
    if (added)   parts.push(`add ${added}`);
    if (changed) parts.push(`update ${changed}`);
    if (removed) parts.push(`remove ${removed}`);
    return parts.join(', ');
  }

  async function save() {
    if (state.saving || pendingCount() === 0) return;
    const token = getToken();
    if (!token) {
      state.afterToken = save;
      openTokenDialog();
      return;
    }

    state.saving = true;
    state.saveError = null;
    renderSavebar();

    try {
      // Re-fetch so we layer our edits onto whatever's there now, not onto
      // what we loaded an hour ago.
      const fresh = await ghFetchFile(token);
      const pending = state.pending;
      const merged = {
        updatedAt: new Date().toISOString(),
        tiers: fresh.data.tiers.length ? fresh.data.tiers : tiers(),
        wines: sortWines(applyPending(fresh.data.wines, pending)),
      };
      const summary = describePending(pending, fresh.data);
      const message = `chore(wine): ${summary || 'update wine list'} (via Uncorked)`;
      const newSha = await ghPutFile(token, fresh.sha, serialize(merged), message);

      state.base = merged;
      state.sha = newSha;
      state.tokenError = null;
      discardPending();
    } catch (err) {
      if (err.status === 401) {
        state.saveError = 'GitHub rejected the token. Sign in again from the footer.';
        state.tokenError = err.message;
      } else if (err.status === 409) {
        state.saveError = 'GitHub was mid-update. Try Save again.';
      } else {
        state.saveError = err.message || 'Save failed';
      }
    } finally {
      state.saving = false;
      render();
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  async function loadLocal() {
    const res = await fetch(LOCAL_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return normalizeData(await res.json());
  }

  async function loadData() {
    state.error = null;
    const token = getToken();
    if (token) {
      // The API is authoritative and immediate; GitHub Pages can lag a
      // minute behind a save. Fall back to the static file if it fails.
      try {
        const { sha, data } = await ghFetchFile(token);
        state.base = data;
        state.sha = sha;
        state.tokenError = null;
        return;
      } catch (err) {
        state.tokenError = err.status === 401 ? 'Token rejected' : err.message;
      }
    }
    try {
      state.base = await loadLocal();
      state.sha = null;
    } catch (err) {
      state.error = err.message;
    }
  }

  async function refresh() {
    if (state.refreshing) return;
    state.refreshing = true;
    render();
    await Promise.all([loadData(), new Promise(r => setTimeout(r, 600))]);
    state.refreshing = false;
    render();
  }

  // ─── Renderers ──────────────────────────────────────────────────────────
  function renderHeader() {
    const updatedAgo  = timeAgo(state.base?.updatedAt);
    const updatedFull = formatFullTimestamp(state.base?.updatedAt);
    const updatedTag = updatedAgo
      ? `<span class="muted-3">·</span> Updated <button type="button" class="updated-label"
            data-action="toggle-time" title="${esc(updatedFull)}"
            aria-label="Toggle absolute time (${esc(updatedFull)})">${esc(state.showAbsoluteTime ? updatedFull : updatedAgo)}</button>`
      : '';

    const tokenPill = state.tokenError ? `
      <span class="error-pill" title="${esc(state.tokenError)}">${ICONS.alert}<span>Token</span></span>
    ` : '';

    const vs = varietals();
    const total = wines().length;
    const chipsHtml = vs.length > 0 ? `
      <div class="chips-row"><div class="chips">
        <button class="chip" data-action="filter" data-varietal="" aria-pressed="${state.varietal ? 'false' : 'true'}">
          <span>All</span><span class="chip-count">${total}</span>
        </button>
        ${vs.map(v => `
          <button class="chip" data-action="filter" data-varietal="${esc(v.label)}"
                  aria-pressed="${state.varietal === v.label ? 'true' : 'false'}">
            <span>${esc(v.label)}</span><span class="chip-count">${v.count}</span>
          </button>
        `).join('')}
      </div></div>
    ` : '';

    return `
      <div class="container header-inner">
        <div class="header-main">
          <div>
            <div class="mono caps muted-2">Wine List${updatedTag}</div>
            <h1 class="serif title">Un<em>corked</em></h1>
          </div>
          <div class="header-actions">
            ${tokenPill}
            <button class="icon-btn icon-btn-outlined ${state.refreshing ? 'spinning' : ''}"
                    data-action="refresh" aria-label="Refresh list" ${state.refreshing ? 'disabled' : ''}>
              ${ICONS.refresh}
            </button>
            <button class="icon-btn icon-btn-outlined icon-btn-accent"
                    data-action="add" aria-label="Add a wine" ${state.base ? '' : 'disabled'}>
              ${ICONS.plus}
            </button>
          </div>
        </div>
        <div class="search">
          ${ICONS.search}
          <input id="search" type="search" placeholder="Search producer, bottling, notes…"
                 value="${esc(state.query)}" autocomplete="off" autocorrect="off" autocapitalize="off"
                 aria-label="Search wines">
          ${state.query ? `<button class="icon-btn search-clear" data-action="clear-search" aria-label="Clear search">${ICONS.x}</button>` : ''}
        </div>
        ${chipsHtml}
      </div>
    `;
  }

  function renderEmpty(headline, sub) {
    return `
      <div class="empty">
        <p class="serif empty-headline">${esc(headline)}</p>
        ${sub ? `<p class="empty-sub">${sub}</p>` : ''}
      </div>
    `;
  }

  function renderList() {
    if (state.error) {
      return renderEmpty('Couldn’t open the cellar.',
        `${esc(state.error)} while loading <code>data/wines.json</code>.`);
    }
    if (!state.base) return '';

    const visible = visibleWines();
    if (wines().length === 0) {
      return renderEmpty('Nothing on the list yet.', 'Tap + to add the first bottle.');
    }
    if (visible.length === 0) {
      return renderEmpty('No matches.', 'Try a different search, or add it with +.');
    }

    // Revisit first (any wine flagged, regardless of verdict), then the
    // verdict tiers in data order, then anything with neither.
    const sections = [];
    const revisit = visible.filter(w => w.revisit);
    if (revisit.length) sections.push({ tier: REVISIT, wines: revisit, showTier: true });
    for (const t of tiers()) {
      const list = visible.filter(w => w.tier === t.id);
      if (list.length) sections.push({ tier: t, wines: list, showTier: false });
    }
    const unrated = visible.filter(w => !w.tier && !w.revisit);
    if (unrated.length) sections.push({ tier: UNRATED, wines: unrated, showTier: false });

    return sections.map(renderSection).join('');
  }

  function renderSection({ tier, wines: list, showTier }) {
    return `
      <section class="tier-section" data-tier="${esc(tier.id)}">
        <div class="tier-header">
          <span class="tier-dot" style="background:${esc(tier.accent)}"></span>
          <span class="serif tier-label">${esc(tier.label)}</span>
          <span class="serif tier-count">${list.length}</span>
          ${tier.blurb ? `<span class="tier-blurb">${esc(tier.blurb)}</span>` : ''}
        </div>
        <div class="cards">${sortWines(list).map(w => renderCard(w, tier, showTier)).join('')}</div>
      </section>
    `;
  }

  function renderCard(w, sectionTier, showTier) {
    const verdict = tiers().find(t => t.id === w.tier);
    const stripe = sectionTier.id === 'revisit' && verdict ? verdict.accent : sectionTier.accent;
    const dirty = isDirty(w.id);

    const badges = [];
    if (showTier && verdict) badges.push(`<span class="badge" style="color:${esc(verdict.accent)}">${esc(verdict.label)}</span>`);
    if (!showTier && w.revisit) badges.push('<span class="badge badge-revisit">Revisit</span>');
    if (dirty) badges.push(`<span class="badge badge-new">${isNew(w.id) ? 'New' : 'Edited'}</span>`);

    return `
      <button class="card ${dirty ? 'is-dirty' : ''}" data-action="edit" data-id="${esc(w.id)}" type="button">
        <span class="card-stripe" style="background:${esc(stripe)}"></span>
        <div class="card-meta mono">
          <div class="card-meta-left">
            <span class="card-varietal">${esc(w.varietal || 'Unknown')}</span>
          </div>
          <div class="card-meta-left">${badges.join('')}</div>
        </div>
        <div class="card-name">
          <span class="serif card-producer">${esc(w.producer)}</span>
          ${w.bottling ? `<span class="serif card-bottling">${esc(w.bottling)}</span>` : ''}
        </div>
        ${w.notes ? `<p class="card-notes">${esc(w.notes)}</p>` : ''}
      </button>
    `;
  }

  function renderFooter() {
    if (!state.base && !state.error) return '';
    const n = wines().length;
    const signedIn = Boolean(getToken());
    return `
      <div class="container footer-inner">
        <span>${n} ${n === 1 ? 'wine' : 'wines'} · Tap a card to edit</span>
        <span class="spacer"></span>
        ${signedIn
          ? `<span>Signed in</span><button class="link-btn" data-action="sign-out">Forget token</button>`
          : `<button class="link-btn" data-action="sign-in">Sign in to save</button>`}
      </div>
    `;
  }

  function renderSavebar() {
    const n = pendingCount();
    if (n === 0 && !state.saveError) {
      savebarEl.hidden = true;
      savebarEl.innerHTML = '';
      document.body.classList.remove('has-savebar');
      return;
    }
    document.body.classList.add('has-savebar');
    savebarEl.hidden = false;
    const summary = state.base ? describePending(state.pending, state.base) : '';
    savebarEl.innerHTML = `
      <div class="savebar-inner">
        <div class="savebar-status">
          <strong>${n} unsaved ${n === 1 ? 'change' : 'changes'}</strong>${summary ? ` · ${esc(summary)}` : ''}
          ${state.saveError ? `<span class="savebar-error">${esc(state.saveError)}</span>` : ''}
        </div>
        <button class="btn" data-action="discard" ${state.saving ? 'disabled' : ''}>Discard</button>
        <button class="btn btn-primary ${state.saving ? 'spinning' : ''}" data-action="save" ${state.saving ? 'disabled' : ''}>
          ${state.saving ? ICONS.refresh : ICONS.cloud}<span>${state.saving ? 'Saving…' : 'Save'}</span>
        </button>
      </div>
    `;
  }

  function render() {
    // Preserve search focus/caret across a full re-render.
    const searchEl = document.getElementById('search');
    const hadFocus = searchEl && document.activeElement === searchEl;
    const caret = hadFocus ? searchEl.selectionStart : null;

    headerEl.innerHTML = renderHeader();
    mainEl.innerHTML   = `<div class="container">${renderList()}</div>`;
    footerEl.innerHTML = renderFooter();
    renderSavebar();

    if (hadFocus) {
      const el = document.getElementById('search');
      el.focus({ preventScroll: true });
      if (caret != null) el.setSelectionRange(caret, caret);
    }
  }

  function renderMainOnly() {
    mainEl.innerHTML = `<div class="container">${renderList()}</div>`;
    // The clear-search button lives in the header; toggle it without a
    // full header re-render so the input keeps focus.
    const existing = headerEl.querySelector('.search-clear');
    if (state.query && !existing) {
      const btn = document.createElement('button');
      btn.className = 'icon-btn search-clear';
      btn.dataset.action = 'clear-search';
      btn.setAttribute('aria-label', 'Clear search');
      btn.innerHTML = ICONS.x;
      headerEl.querySelector('.search').appendChild(btn);
    } else if (!state.query && existing) {
      existing.remove();
    }
  }

  // ─── Editor dialog ──────────────────────────────────────────────────────
  function openEditor(id) {
    state.editingId = id;
    const wine = id ? wines().find(w => w.id === id) : null;
    const f = editorForm.elements;

    document.getElementById('editor-kicker').textContent = wine ? 'Edit wine' : 'New wine';
    document.getElementById('editor-delete').hidden = !wine;

    f.producer.value = wine?.producer ?? '';
    f.bottling.value = wine?.bottling ?? '';
    f.varietal.value = wine?.varietal ?? (state.varietal || varietals()[0]?.label || 'Chardonnay');
    f.revisit.checked = wine?.revisit ?? false;
    f.notes.value = wine?.notes ?? '';

    // Verdict radios: one per tier from the data file, plus "none".
    const tierHtml = tiers().map(t => `
      <label style="--seg-accent:${esc(t.accent)}">
        <input type="radio" name="tier" value="${esc(t.id)}" ${wine?.tier === t.id ? 'checked' : ''}>
        <span class="tier-dot" style="background:${esc(t.accent)}"></span>
        <span>${esc(t.label)}</span>
      </label>
    `).join('') + `
      <label style="--seg-accent:${UNRATED.accent}">
        <input type="radio" name="tier" value="" ${!wine?.tier ? 'checked' : ''}>
        <span class="tier-dot" style="background:${UNRATED.accent}"></span>
        <span>No verdict yet</span>
      </label>
    `;
    document.getElementById('editor-tiers').innerHTML = tierHtml;

    document.getElementById('varietal-options').innerHTML =
      varietals().map(v => `<option value="${esc(v.label)}"></option>`).join('');

    editorEl.showModal();
    if (!wine) f.producer.focus();
  }

  function closeEditor() {
    state.editingId = null;
    if (editorEl.open) editorEl.close();
  }

  function submitEditor() {
    const f = editorForm.elements;
    const producer = f.producer.value.trim();
    const varietal = f.varietal.value.trim();
    if (!producer) { f.producer.focus(); f.producer.reportValidity(); return; }
    if (!varietal) { f.varietal.focus(); f.varietal.reportValidity(); return; }

    const bottling = f.bottling.value.trim();
    const existing = state.editingId ? wines().find(w => w.id === state.editingId) : null;
    const wine = normalizeWine({
      id: existing?.id ?? uniqueId(producer, bottling),
      producer,
      bottling,
      varietal,
      tier: f.tier.value || null,
      revisit: f.revisit.checked,
      notes: f.notes.value,
    });

    upsertWine(wine);
    closeEditor();
    render();
  }

  // ─── Token dialog ───────────────────────────────────────────────────────
  function openTokenDialog() {
    tokenForm.elements.token.value = '';
    tokenEl.showModal();
    tokenForm.elements.token.focus();
  }

  function closeTokenDialog() {
    state.afterToken = null;
    if (tokenEl.open) tokenEl.close();
  }

  function submitToken() {
    const token = tokenForm.elements.token.value.trim();
    if (!token) { tokenForm.elements.token.reportValidity(); return; }
    lsSet(LS.token, token);
    state.tokenError = null;
    const next = state.afterToken;
    state.afterToken = null;
    if (tokenEl.open) tokenEl.close();
    render();
    if (next) next();
  }

  function signOut() {
    lsSet(LS.token, null);
    state.tokenError = null;
    render();
  }

  // ─── Events ─────────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    switch (target.dataset.action) {
      case 'filter':
        state.varietal = target.dataset.varietal || null;
        lsSet(LS.varietal, state.varietal);
        render();
        break;
      case 'clear-search':
        state.query = '';
        render();
        document.getElementById('search')?.focus();
        break;
      case 'refresh':       refresh(); break;
      case 'add':           openEditor(null); break;
      case 'edit':          openEditor(target.dataset.id); break;
      case 'close-editor':  closeEditor(); break;
      case 'delete-wine':
        if (state.editingId) {
          deleteWine(state.editingId);
          closeEditor();
          render();
        }
        break;
      case 'save':          save(); break;
      case 'discard':
        discardPending();
        render();
        break;
      case 'sign-in':
        state.afterToken = () => refresh();
        openTokenDialog();
        break;
      case 'sign-out':      signOut(); break;
      case 'close-token':   closeTokenDialog(); break;
      case 'toggle-time':
        state.showAbsoluteTime = !state.showAbsoluteTime;
        headerEl.innerHTML = renderHeader();
        break;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'search') {
      state.query = e.target.value;
      renderMainOnly();
    }
  });

  editorForm.addEventListener('submit', (e) => { e.preventDefault(); submitEditor(); });
  tokenForm.addEventListener('submit',  (e) => { e.preventDefault(); submitToken(); });
  editorEl.addEventListener('close', () => { state.editingId = null; });
  tokenEl.addEventListener('close',  () => { state.afterToken = null; });

  // ─── Init ───────────────────────────────────────────────────────────────
  state.varietal = lsGet(LS.varietal) || null;
  const savedPending = lsGet(LS.pending);
  if (savedPending && typeof savedPending === 'object') {
    state.pending = {
      upserts: savedPending.upserts && typeof savedPending.upserts === 'object' ? savedPending.upserts : {},
      deletes: Array.isArray(savedPending.deletes) ? savedPending.deletes : [],
    };
    for (const id of Object.keys(state.pending.upserts)) {
      state.pending.upserts[id] = normalizeWine({ ...state.pending.upserts[id], id });
    }
  }

  loadData().then(() => {
    // A filter for a varietal that no longer exists just shows everything.
    if (state.varietal && !varietals().some(v => v.label === state.varietal)) state.varietal = null;
    render();
  });

  setInterval(() => {
    if (state.base) headerEl.innerHTML = renderHeader();
  }, 60_000);
})();
