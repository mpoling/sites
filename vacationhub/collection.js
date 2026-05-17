(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;
  renderSidebar('parks');

  // Skeleton placeholders while we wait
  $('#hero').replaceChildren(VH.el('div', { class: 'skeleton', style: 'width:100%;height:100%' }));

  const slug = params().get('slug');
  if (!slug) { renderError($('#main'), 'No collection specified.'); return; }

  let col, index;
  try {
    [col, index] = await Promise.all([
      fetchJSON(`./data/collections/${slug}.json`),
      fetchJSON('./data/index.json'),
    ]);
  } catch (err) {
    renderError($('#main'), `Could not load collection "${slug}".`);
    return;
  }

  // Load every referenced park (collection items may span parks when scope is brand).
  const parkSlugs = new Set();
  if (col.scope?.park) parkSlugs.add(col.scope.park);
  for (const r of col.rides) if (r.park) parkSlugs.add(r.park);

  let parks;
  try {
    parks = Object.fromEntries(
      await Promise.all([...parkSlugs].map(async (s) => [s, await fetchJSON(`./data/parks/${s}.json`)]))
    );
  } catch (err) {
    renderError($('#main'), 'Could not load referenced park data.');
    return;
  }

  document.title = `${col.name} · VacationHub`;
  renderHero(col, index);
  renderRides(col, parks);

  function renderHero(c, idx) {
    const scopeName =
      c.scope?.brand ? idx.brands.find((b) => b.slug === c.scope.brand)?.name :
      c.scope?.park  ? idx.parks.find((p) => p.slug === c.scope.park)?.name : '';
    $('#hero').replaceChildren(
      el('div', { class: 'hero-shade' }),
      el('div', { class: 'hero-content' }, [
        el('div', { class: 'label', text: scopeName || '' }),
        el('h1', { class: 'hero-title', text: c.name }),
        el('p', { class: 'hero-tag', text: c.intro || '' }),
      ])
    );
  }

  function renderRides(c, parksMap) {
    const ownerParkSlug = c.scope?.park;
    const root = $('#rides');

    const items = c.rides.map((entry) => {
      const pSlug = entry.park || ownerParkSlug;
      const p = parksMap[pSlug];
      const r = p?.rides?.find((rd) => rd.slug === entry.ride);
      return { entry, p, r, pSlug };
    }).filter((x) => x.r);

    root.replaceChildren(
      el('div', { class: 'col-list' },
        items.map(({ entry, p, r, pSlug }) =>
          el('a', {
            class: 'col-item',
            href: `./park.html?slug=${pSlug}#ride-${r.slug}`,
          }, [
            el('div', { class: 'col-item-main' }, [
              el('div', { class: 'col-item-park', text: p.name }),
              el('h3', { class: 'col-item-title', text: r.name }),
              el('p', { class: 'col-item-blurb', text: entry.blurb || r.blurb || '' }),
            ]),
            el('div', { class: 'col-item-meta' }, [
              r.height_min_in != null ? el('div', { class: 'meta-pill', text: `${r.height_min_in}"` }) : null,
              r.intensity ? el('div', { class: 'meta-pill', text: '★'.repeat(r.intensity) + '☆'.repeat(5 - r.intensity) }) : null,
              r.priority_access && r.priority_access !== 'none'
                ? el('div', { class: `meta-pill pa-${r.priority_access}` }, [({multipass:'MULTI',premier:'PREMIER','express-unlimited':'EXPRESS'})[r.priority_access] || r.priority_access])
                : null,
            ]),
          ])
        )
      )
    );
  }
})();
