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

  let currentBrand = VH.params().get('brand') || 'all';
  renderChips(index, currentBrand);

  function renderChips(idx, active) {
    const chips = $('#chips');
    const make = (slug, label) =>
      el('button', {
        class: 'chip' + (slug === active ? ' active' : ''),
        'data-brand': slug,
        'aria-pressed': slug === active ? 'true' : 'false',
        onclick: () => selectBrand(slug),
      }, [label]);

    chips.replaceChildren(
      make('all', 'All'),
      ...idx.brands.map((b) => make(b.slug, b.name)),
    );
  }

  function selectBrand(slug) {
    currentBrand = slug;
    const url = new URL(location.href);
    if (slug === 'all') url.searchParams.delete('brand');
    else url.searchParams.set('brand', slug);
    history.replaceState(null, '', url);
    renderChips(index, slug);
    if (VH.refilterRails) VH.refilterRails(slug);   // Task 8 will define this
  }

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
