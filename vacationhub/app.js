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

  window.VH = VH;
})();
