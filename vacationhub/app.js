/* eslint-disable no-undef */
// Shared utilities for every VacationHub page.
// Exposes a single global `VH` namespace; no module system, no build step.

(function () {
  'use strict';

  const VH = {};

  // ---- DOM helpers ----
  VH.$ = (sel, root) => (root || document).querySelector(sel);
  VH.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  VH.el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v === false || v == null) { /* skip */ }
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  };

  // ---- Fetch with JSON + small cache ----
  const cache = new Map();
  VH.fetchJSON = async (path) => {
    if (cache.has(path)) return cache.get(path);
    const p = fetch(path, { cache: 'default' }).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
      return res.json();
    });
    cache.set(path, p);
    try { return await p; }
    catch (err) { cache.delete(path); throw err; }
  };

  VH.fetchText = async (path) => {
    const res = await fetch(path, { cache: 'default' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  };

  // ---- Error rendering ----
  VH.renderError = (root, message) => {
    root.replaceChildren(
      VH.el('div', { class: 'error' }, [
        VH.el('p', { text: message }),
        VH.el('button', { class: 'btn-text', onclick: () => location.reload() }, ['Reload']),
      ])
    );
  };

  // ---- URL params helper ----
  VH.params = () => new URLSearchParams(location.search);

  // ---- Sidebar nav ----
  const SIDEBAR_ITEMS = [
    { id: 'home', label: 'Home', href: './index.html', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
    { id: 'search', label: 'Search', href: '#search', icon: 'M10 3a7 7 0 1 1-4.95 11.95l-3.55 3.55-1.41-1.41 3.55-3.55A7 7 0 0 1 10 3zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 10 5z' },
    { id: 'parks', label: 'Theme Parks', href: './index.html', icon: 'M2 20h20v2H2zm10-18l4 6h-3v4h-2v-4H8zM4 14h2v6H4zm14 0h2v6h-2zM9 14h6v6H9z' },
    { id: 'about', label: 'About', href: './about.html', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z' },
  ];

  const DEFERRED_ITEMS = [
    { id: 'cruises', label: 'Cruises (coming soon)', icon: 'M2 21l2-7h16l2 7zm2-9l8-9 8 9z' },
    { id: 'resorts', label: 'Resorts (coming soon)', icon: 'M3 21V10l9-7 9 7v11h-6v-7h-6v7z' },
    { id: 'experiences', label: 'Experiences (coming soon)', icon: 'M12 2l2.39 7.36H22l-6.18 4.49L18.21 22 12 17.27 5.79 22l2.39-8.15L2 9.36h7.61z' },
  ];

  VH.renderSidebar = (activeId) => {
    const sidebar = VH.$('#sidebar');
    if (!sidebar) return;
    const icon = (path) =>
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

    const itemEl = (item, { deferred } = {}) => {
      const tag = deferred ? 'span' : 'a';
      const attrs = {
        class: 'side-item' + (item.id === activeId ? ' active' : '') + (deferred ? ' deferred' : ''),
        'aria-label': item.label,
        title: item.label,
        html: icon(item.icon),
      };
      if (!deferred) attrs.href = item.href;
      if (item.id === 'search' && !deferred) {
        attrs.onclick = (e) => { e.preventDefault(); VH.openSearch && VH.openSearch(); };
      }
      return VH.el(tag, attrs);
    };

    sidebar.replaceChildren(
      VH.el('a', { href: './index.html', class: 'side-logo', 'aria-label': 'VacationHub home' }, [
        VH.el('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19l9-14 9 14z" fill="currentColor"/></svg>' }),
      ]),
      ...SIDEBAR_ITEMS.map((i) => itemEl(i)),
      VH.el('div', { class: 'side-divider', 'aria-hidden': 'true' }),
      ...DEFERRED_ITEMS.map((i) => itemEl(i, { deferred: true })),
    );
  };

  // ---- Image helpers ----
  // An image field may be either:
  //   - a string path, OR
  //   - { src, credit: <object|string> } where credit is either:
  //       - structured: { author, license, source }
  //       - HTML string: e.g. 'Photo by <a href="...">Name</a> on <a href="...">Unsplash</a>'
  //         (the format Sveltia's stock-photo integrations produce)
  VH.imgSrc = (img) => (img == null ? '' : typeof img === 'string' ? img : img.src || '');
  VH.imgCredit = (img) => (img && typeof img === 'object' ? img.credit : null) || null;

  VH.creditEl = (img, opts) => {
    const c = VH.imgCredit(img);
    if (!c) return null;
    const cls = 'img-credit' + (opts && opts.subtle ? ' img-credit-subtle' : '');

    // Stock-photo HTML credit string (from Sveltia Unsplash/Pexels integration)
    if (typeof c === 'string') {
      return VH.el('span', { class: cls, html: c });
    }

    // Structured credit object (manual entry / Wikimedia)
    const text = `© ${c.author}${c.license ? ' · ' + c.license : ''}`;
    if (c.source) {
      return VH.el('a', { class: cls, href: c.source, target: '_blank', rel: 'noopener noreferrer' }, [text]);
    }
    return VH.el('span', { class: cls }, [text]);
  };

  // ---- Tile builders ----
  VH.parkTile = (park) =>
    VH.el('a', {
      class: 'tile tile-park',
      href: `./park.html?slug=${park.slug}`,
      'data-brand': park.brand,
      'aria-label': `${park.name} — ${park.resort || ''}`,
    }, [
      VH.el('div', { class: 'tile-img', style: `background-image:url('${VH.imgSrc(park.tile)}')` }),
      VH.el('div', { class: 'tile-shade' }),
      VH.el('div', { class: 'tile-body' }, [
        VH.el('div', { class: 'tile-title', text: park.name }),
        VH.el('div', { class: 'tile-meta', text: park.resort || park.location?.city || '' }),
      ]),
      VH.creditEl(park.tile, { subtle: true }),
    ]);

  VH.collectionTile = (col, parksByBrand) => {
    const brand = col.scope?.brand;
    const park = col.scope?.park;
    const meta = brand ? brand : park ? park : '';
    return VH.el('a', {
      class: 'tile tile-collection',
      href: `./collection.html?slug=${col.slug}`,
      'data-brand': brand || (parksByBrand && parksByBrand[park]) || '',
    }, [
      VH.el('div', { class: 'tile-img', style: `background-image:url('${VH.imgSrc(col.tile)}')` }),
      VH.el('div', { class: 'tile-shade' }),
      VH.el('div', { class: 'tile-body' }, [
        VH.el('div', { class: 'tile-title', text: col.name }),
        VH.el('div', { class: 'tile-meta', text: meta }),
      ]),
      VH.creditEl(col.tile, { subtle: true }),
    ]);
  };

  // ---- Rail (horizontal scrolling strip) ----
  VH.renderRail = (root, title, tiles) => {
    if (tiles.length === 0) { root.replaceChildren(); return; }
    const strip = VH.el('div', { class: 'rail-strip' }, tiles);

    const scroll = (dir) => {
      const step = strip.clientWidth * 0.8;
      strip.scrollBy({ left: dir * step, behavior: 'smooth' });
    };

    root.replaceChildren(
      VH.el('div', { class: 'rail-header' }, [
        VH.el('h2', { class: 'rail-title', text: title }),
        VH.el('div', { class: 'rail-controls' }, [
          VH.el('button', { class: 'rail-arrow', 'aria-label': 'Scroll left', onclick: () => scroll(-1) }, ['‹']),
          VH.el('button', { class: 'rail-arrow', 'aria-label': 'Scroll right', onclick: () => scroll(1) }, ['›']),
        ]),
      ]),
      strip,
    );
  };

  // ---- Search overlay ----
  let searchIndex = null;
  let searchOpen = false;

  async function ensureSearchIndex() {
    if (searchIndex) return searchIndex;
    const idx = await VH.fetchJSON('./data/index.json');

    // Lazy-load every park JSON so rides can be searchable too. Failures
    // for individual parks degrade gracefully — that park's rides just
    // won't show up in results.
    const parkJsons = await Promise.all(
      idx.parks.map((p) => VH.fetchJSON(`./data/parks/${p.slug}.json`).catch(() => null))
    );

    searchIndex = [
      ...idx.parks.map((p) => ({
        kind: 'Park',
        title: p.name,
        subtitle: [p.resort, p.location?.city].filter(Boolean).join(' · '),
        haystack: [p.name, p.resort, p.tagline, p.location?.city, p.location?.state].filter(Boolean).join(' ').toLowerCase(),
        href: `./park.html?slug=${p.slug}`,
      })),
      ...idx.collections.map((c) => ({
        kind: 'Collection',
        title: c.name,
        subtitle: c.scope?.brand ? `Brand · ${c.scope.brand}` : c.scope?.park ? `Park · ${c.scope.park}` : '',
        haystack: c.name.toLowerCase(),
        href: `./collection.html?slug=${c.slug}`,
      })),
    ];

    for (let i = 0; i < idx.parks.length; i++) {
      const park = idx.parks[i];
      const pj = parkJsons[i];
      if (!pj || !Array.isArray(pj.rides)) continue;
      for (const ride of pj.rides) {
        if (!ride || !ride.slug || !ride.name) continue;
        searchIndex.push({
          kind: 'Ride',
          title: ride.name,
          subtitle: [park.name, ride.land].filter(Boolean).join(' · '),
          haystack: [ride.name, ride.land, ride.subtype, ride.blurb, park.name].filter(Boolean).join(' ').toLowerCase(),
          href: `./park.html?slug=${park.slug}#ride-${ride.slug}`,
        });
      }
    }

    return searchIndex;
  }

  function renderResults(root, query, items) {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.haystack.includes(q)).slice(0, 30) : [];
    root.replaceChildren(
      ...(filtered.length === 0
        ? [VH.el('div', { class: 'search-empty', text: q ? 'No matches.' : 'Start typing to search parks, rides, and collections.' })]
        : filtered.map((r, i) =>
            VH.el('a', { class: 'search-result', href: r.href, 'data-idx': String(i) }, [
              VH.el('div', { class: 'search-result-kind', text: r.kind }),
              VH.el('div', { class: 'search-result-title', text: r.title }),
              VH.el('div', { class: 'search-result-sub', text: r.subtitle }),
            ])
          ))
    );
  }

  VH.openSearch = async () => {
    const overlay = VH.$('#search-overlay');
    if (!overlay) return;
    searchOpen = true;
    overlay.hidden = false;
    let items = null;
    let resultsEl = null;
    overlay.replaceChildren(
      VH.el('div', { class: 'search-panel', onclick: (e) => e.stopPropagation() }, [
        VH.el('input', {
          class: 'search-input', type: 'text', placeholder: 'Search parks and collections',
          'aria-label': 'Search', autofocus: true,
          oninput: (e) => { if (items && resultsEl) renderResults(resultsEl, e.target.value, items); },
          onkeydown: (e) => { if (e.key === 'Escape') VH.closeSearch(); },
        }),
        VH.el('div', { class: 'search-results', id: 'search-results' }),
      ])
    );
    overlay.addEventListener('click', closeOnBackdrop, { once: true });
    resultsEl = VH.$('#search-results');
    items = await ensureSearchIndex();
    if (!searchOpen) return;   // user closed during fetch
    renderResults(resultsEl, VH.$('.search-input')?.value || '', items);
    VH.$('.search-input')?.focus();
  };

  VH.closeSearch = () => {
    const overlay = VH.$('#search-overlay');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.replaceChildren();
    searchOpen = false;
  };

  function closeOnBackdrop(e) {
    if (e.target.id === 'search-overlay') VH.closeSearch();
  }

  // Keyboard: '/' to open, Esc to close
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && !searchOpen && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault(); VH.openSearch();
    } else if (e.key === 'Escape' && searchOpen) {
      VH.closeSearch();
    }
  });

  window.VH = VH;
})();
