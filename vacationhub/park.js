(async function () {
  'use strict';
  const { $, el, fetchJSON, renderError, renderSidebar, params } = VH;

  renderSidebar('parks');

  // Skeleton placeholders while we wait
  $('#hero').replaceChildren(VH.el('div', { class: 'skeleton', style: 'width:100%;height:100%' }));
  $('#quick-facts').replaceChildren(
    ...Array.from({ length: 4 }, () => VH.el('div', { class: 'skeleton', style: 'height:62px' }))
  );

  const slug = params().get('slug');
  if (!slug) {
    renderError($('#main'), 'No park specified.');
    return;
  }

  let park, index;
  try {
    [park, index] = await Promise.all([
      fetchJSON(`./data/parks/${slug}.json`),
      fetchJSON('./data/index.json'),
    ]);
  } catch (err) {
    renderError($('#main'), `Could not load park "${slug}".`);
    return;
  }

  document.title = `${park.name} · VacationHub`;
  renderHero(park);
  renderQuickFacts(park);
  renderTips(park);

  const rideFilter = { land: 'all', type: 'all', height: 'all' };
  renderRidesSection(park);
  renderCollections(park, index);

  function renderRidesSection(p) {
    const root = $('#rides');
    if (!p.rides || p.rides.length === 0) { root.replaceChildren(); return; }

    const lands = ['all', ...new Set(p.rides.map((r) => r.land).filter(Boolean))];
    const types = ['all', ...new Set(p.rides.map((r) => r.type).filter(Boolean))];
    const heights = ['all', 'no-min', '<40', '40-47', '48+'];

    const chipBar = (key, options) =>
      el('div', { class: 'filter-bar', role: 'group', 'aria-label': key }, options.map((o) =>
        el('button', {
          class: 'chip-sm' + (rideFilter[key] === o ? ' active' : ''),
          'aria-pressed': rideFilter[key] === o ? 'true' : 'false',
          onclick: () => { rideFilter[key] = o; renderRidesSection(p); },
        }, [o === 'all' ? `All ${key}s` : o])
      ));

    const grid = el('div', { class: 'ride-grid' },
      p.rides.filter(matchesFilter).map(rideCard)
    );

    root.replaceChildren(
      el('h2', {}, ['Rides ', el('span', { class: 'section-meta', text: `· ${p.rides.length}` })]),
      el('div', { class: 'ride-filters' }, [
        chipBar('land', lands),
        chipBar('type', types),
        chipBar('height', heights),
      ]),
      grid,
    );
  }

  function matchesFilter(r) {
    if (rideFilter.land !== 'all' && r.land !== rideFilter.land) return false;
    if (rideFilter.type !== 'all' && r.type !== rideFilter.type) return false;
    if (rideFilter.height !== 'all') {
      const h = r.height_min_in;
      if (rideFilter.height === 'no-min' && h != null) return false;
      if (rideFilter.height === '<40' && !(h != null && h < 40)) return false;
      if (rideFilter.height === '40-47' && !(h != null && h >= 40 && h <= 47)) return false;
      if (rideFilter.height === '48+' && !(h != null && h >= 48)) return false;
    }
    return true;
  }

  function rideCard(r) {
    const meta = [
      r.type ? prettyType(r.type) : null,
      r.height_min_in != null ? `${r.height_min_in}"` : null,
      r.intensity ? '★'.repeat(r.intensity) + '☆'.repeat(5 - r.intensity) : null,
    ].filter(Boolean).join(' · ');

    const photoSrc = VH.imgSrc(r.photo);
    const headStyle = photoSrc ? `background-image:url('${photoSrc}')` : '';
    return el('article', { class: 'ride-card', id: `ride-${r.slug}` }, [
      el('div', { class: 'ride-card-head' + (photoSrc ? ' has-photo' : ''), style: headStyle }, [
        photoSrc ? el('div', { class: 'ride-card-shade' }) : null,
        el('div', { class: 'ride-card-land', text: r.land || '' }),
        priorityBadge(r.priority_access),
        VH.creditEl(r.photo, { subtle: true }),
      ]),
      el('div', { class: 'ride-card-body' }, [
        el('h3', { class: 'ride-card-title', text: r.name }),
        el('div', { class: 'ride-card-meta', text: meta }),
        r.blurb ? el('p', { class: 'ride-card-blurb', text: `"${r.blurb}"` }) : null,
      ]),
    ]);
  }

  function priorityBadge(pa) {
    if (!pa || pa === 'none') return null;
    const label = { multipass: 'MULTI', premier: 'PREMIER', 'express-unlimited': 'EXPRESS' }[pa] || pa.toUpperCase();
    return el('span', { class: `pa-badge pa-${pa}`, text: label });
  }

  function prettyType(t) {
    return ({
      'roller-coaster': 'Coaster',
      'dark-ride': 'Dark Ride',
      'water': 'Water',
      'show': 'Show',
      'flat': 'Flat',
      'boat': 'Boat',
      'transport': 'Transport',
      'other': 'Other',
    })[t] || t;
  }

  function renderHero(p) {
    $('#hero').replaceChildren(
      el('div', { class: 'hero-bg', style: `background-image:url('${VH.imgSrc(p.hero)}')` }),
      el('div', { class: 'hero-shade' }),
      el('div', { class: 'hero-content' }, [
        el('div', { class: 'label', text: p.resort || p.brand }),
        el('h1', { class: 'hero-title', text: p.name }),
        el('p', { class: 'hero-tag', text: p.summary || '' }),
      ]),
      VH.creditEl(p.hero),
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

  function renderTips(p) {
    const root = $('#tips');
    if (!p.tips || p.tips.length === 0) { root.replaceChildren(); return; }
    root.replaceChildren(
      el('h2', {}, ['Tips ', el('span', { class: 'section-meta', text: `· ${p.tips.length}` })]),
      el('div', { class: 'tip-grid' },
        p.tips.map((t) =>
          el('a', { class: 'tip-card', href: `./tip.html?park=${p.slug}&slug=${t.slug}` }, [
            el('div', { class: 'tip-card-body' }, [
              el('div', { class: 'tip-card-title', text: t.title }),
              el('p', { class: 'tip-card-summary', text: t.summary || '' }),
              el('div', { class: 'tip-card-meta', text: t.updated ? `Updated ${t.updated}` : '' }),
            ]),
          ])
        )
      )
    );
  }

  function renderCollections(p, idx) {
    const root = $('#collections');
    const scoped = idx.collections.filter((c) => c.scope?.park === p.slug);
    if (scoped.length === 0) { root.replaceChildren(); return; }
    root.replaceChildren(
      el('h2', {}, ['Collections']),
      el('div', { class: 'tip-grid' },
        scoped.map((c) =>
          el('a', { class: 'tip-card', href: `./collection.html?slug=${c.slug}` }, [
            el('div', { class: 'tip-card-body' }, [
              el('div', { class: 'tip-card-title', text: c.name }),
              el('div', { class: 'tip-card-meta', text: 'Curated list' }),
            ]),
          ])
        )
      )
    );
  }
})();
