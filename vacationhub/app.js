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

  window.VH = VH;
})();
