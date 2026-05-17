(async function () {
  'use strict';
  const { $, el, fetchJSON, fetchText, renderError, renderSidebar, params } = VH;
  renderSidebar('parks');

  const parkSlug = params().get('park');
  const tipSlug = params().get('slug');
  if (!parkSlug || !tipSlug) { renderError($('#main'), 'Missing park or tip slug.'); return; }

  let park, md;
  try {
    [park, md] = await Promise.all([
      fetchJSON(`./data/parks/${parkSlug}.json`),
      fetchText(`./data/parks/${parkSlug}/tips/${tipSlug}.md`),
    ]);
  } catch (err) {
    renderError($('#main'), 'Could not load tip.');
    return;
  }

  const tipMeta = (park.tips || []).find((t) => t.slug === tipSlug);
  if (!tipMeta) { renderError($('#main'), `Tip "${tipSlug}" not listed in park manifest.`); return; }

  document.title = `${tipMeta.title} · ${park.name} · VacationHub`;

  const body = el('div', { class: 'article-body' });
  body.innerHTML = window.marked.parse(md, { mangle: false, headerIds: false });

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
