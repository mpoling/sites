(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;

  renderSidebar('parks');

  const slug = params().get('slug');
  if (!slug) {
    renderError($('#main'), 'No park specified.');
    return;
  }

  let park;
  try {
    park = await fetchJSON(`./data/parks/${slug}.json`);
  } catch (err) {
    renderError($('#main'), `Could not load park "${slug}".`);
    return;
  }

  document.title = `${park.name} · VacationHub`;
  renderHero(park);
  renderQuickFacts(park);

  function renderHero(p) {
    $('#hero').replaceChildren(
      el('div', { class: 'hero-bg', style: `background-image:url('${p.hero}')` }),
      el('div', { class: 'hero-shade' }),
      el('div', { class: 'hero-content' }, [
        el('div', { class: 'label', text: p.resort || p.brand }),
        el('h1', { class: 'hero-title', text: p.name }),
        el('p', { class: 'hero-tag', text: p.summary || '' }),
      ])
    );
  }

  function renderQuickFacts(p) {
    const facts = [];
    if (p.opened) facts.push({ k: 'Opened', v: String(p.opened) });
    if (p.size_acres) facts.push({ k: 'Size', v: `${p.size_acres} acres` });
    if (p.resort) facts.push({ k: 'Resort', v: p.resort });
    if (p.location) facts.push({ k: 'Location', v: [p.location.city, p.location.state, p.location.country].filter(Boolean).join(', ') });
    if (p.official_url) facts.push({ k: 'Official site', v: 'Visit ↗', link: p.official_url });

    $('#quick-facts').replaceChildren(
      ...facts.map((f) =>
        el('div', { class: 'fact' }, [
          el('div', { class: 'fact-key', text: f.k }),
          f.link
            ? el('a', { class: 'fact-val', href: f.link, target: '_blank', rel: 'noopener', text: f.v })
            : el('div', { class: 'fact-val', text: f.v }),
        ])
      )
    );
  }
})();
