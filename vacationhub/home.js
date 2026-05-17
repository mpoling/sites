(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar } = VH;

  renderSidebar('home');

  let index;
  try {
    index = await fetchJSON('./data/index.json');
  } catch (err) {
    renderError($('#hero'), 'Could not load site index.');
    return;
  }

  renderHero(index);

  function renderHero(idx) {
    const featuredSlug = idx.home.featured;
    const park = idx.parks.find((p) => p.slug === featuredSlug);
    const hero = $('#hero');
    if (!park) { hero.replaceChildren(); return; }

    hero.replaceChildren(
      el('div', { class: 'hero-bg', style: `background-image:url('${park.hero}')` }),
      el('div', { class: 'hero-shade' }),
      el('div', { class: 'hero-content' }, [
        el('div', { class: 'label', text: 'Featured Park' }),
        el('h1', { class: 'hero-title', text: park.name }),
        el('p', { class: 'hero-tag', text: park.tagline || '' }),
        el('a', {
          class: 'btn-primary',
          href: `./park.html?slug=${park.slug}`,
        }, ['Explore →']),
      ])
    );
  }
})();
