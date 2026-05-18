(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;
  renderSidebar('parks');

  // Skeleton placeholders while we wait
  $('#article').replaceChildren(
    VH.el('div', { class: 'skeleton', style: 'height:36px;width:60%;margin-bottom:24px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;margin-bottom:8px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;width:80%;margin-bottom:8px' }),
    VH.el('div', { class: 'skeleton', style: 'height:18px;width:90%;margin-bottom:8px' }),
  );

  const parkSlug = params().get('park');
  const tipSlug = params().get('slug');
  if (!parkSlug || !tipSlug) { renderError($('#main'), 'Missing park or tip slug.'); return; }

  let park;
  try {
    park = await fetchJSON(`./data/parks/${parkSlug}.json`);
  } catch (err) {
    renderError($('#main'), 'Could not load tip.');
    return;
  }

  const tipMeta = (park.tips || []).find((t) => t.slug === tipSlug);
  if (!tipMeta) { renderError($('#main'), `Tip "${tipSlug}" not listed in park manifest.`); return; }

  document.title = `${tipMeta.title} · ${park.name} · VacationHub`;

  const body = el('div', { class: 'article-body' });
  body.innerHTML = window.marked.parse(tipMeta.body || '');

  $('#article').replaceChildren(
    el('header', { class: 'article-header' }, [
      el('a', { class: 'article-back', href: `./park.html?slug=${park.slug}` }, [`← ${park.name}`]),
      el('h1', { class: 'article-title', text: tipMeta.title }),
      el('div', { class: 'article-meta', text: tipMeta.updated ? `Updated ${tipMeta.updated}` : '' }),
    ]),
    body,
    el('footer', { class: 'article-footer' }, [
      el('a', { class: 'btn-text', href: `./park.html?slug=${park.slug}` }, [`More about ${park.name} →`]),
    ]),
  );
})();
