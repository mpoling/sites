(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar } = VH;

  renderSidebar('home');

  // Skeleton placeholders while we wait
  $('#hero').replaceChildren(VH.el('div', { class: 'skeleton', style: 'width:100%;height:100%' }));
  $('#rails').replaceChildren(
    ...Array.from({ length: 2 }, () =>
      VH.el('section', { class: 'rail' }, [
        VH.el('div', { class: 'rail-header' }, [VH.el('div', { class: 'skeleton', style: 'width:160px;height:24px' })]),
        VH.el('div', { class: 'rail-strip' },
          Array.from({ length: 5 }, () => VH.el('div', { class: 'skeleton', style: 'aspect-ratio:16/9' }))),
      ])
    )
  );

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
    if (VH.refilterRails) VH.refilterRails(slug);
  }

  renderRails(index);
  VH.refilterRails = (brand) => applyBrandFilter(brand);
  applyBrandFilter(currentBrand);

  function renderRails(idx) {
    const root = $('#rails');
    const parksBySlug = Object.fromEntries(idx.parks.map((p) => [p.slug, p]));
    const colsBySlug = Object.fromEntries(idx.collections.map((c) => [c.slug, c]));
    const parkBrand = Object.fromEntries(idx.parks.map((p) => [p.slug, p.brand]));

    root.replaceChildren(
      ...idx.home.rails.map((rail) => {
        const wrap = el('section', { class: 'rail', 'data-rail-type': rail.type });
        let tiles;
        if (rail.type === 'park') {
          tiles = rail.items.map((s) => parksBySlug[s]).filter(Boolean).map(VH.parkTile);
        } else if (rail.type === 'collection') {
          tiles = rail.items.map((s) => colsBySlug[s]).filter(Boolean).map((c) => VH.collectionTile(c, parkBrand));
        } else {
          tiles = [];
        }
        VH.renderRail(wrap, rail.title, tiles);
        return wrap;
      })
    );
  }

  function applyBrandFilter(brand) {
    const all = brand === 'all';
    VH.$$('#rails .tile').forEach((tile) => {
      const tb = tile.dataset.brand;
      tile.dataset.hidden = all || tb === brand ? 'false' : 'true';
    });
    // Hide rails that have no visible tiles.
    VH.$$('#rails .rail').forEach((rail) => {
      const anyVisible = VH.$$('.tile', rail).some((t) => t.dataset.hidden !== 'true');
      rail.style.display = anyVisible ? '' : 'none';
    });
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
