# Rising Stars — Sotheby's International Realty

A one-page landing page for **Natalie Nagel Poling, Ryan Keenan and Laura
Warren**, Sotheby's International Realty Rising Star award winners on the
Monterey Peninsula. It's the web version of a printed bookmark handed out
as a gift at an event; the bookmark's QR code points here.

## How people get here

```
QR code on bookmark → sirrisingstars.com → (DNS alias) → sirrisingstars.polings.net
                                                        → Cloudflare Worker → /sites/sirrisingstars/
```

`sirrisingstars.com` is aliased to `sirrisingstars.polings.net` outside the
repo (DNS + the Cloudflare Worker). The canonical/OG tags in `index.html`
use `https://sirrisingstars.com/` because that's the address people share.

## Design

Follows the bookmark, which follows Sotheby's International Realty
branding: deep navy, brushed gold, a Caslon-style serif for the
"Sotheby's" wordmark and prose, and tracked caps in a gothic sans for
labels. Fonts are Libre Caslon Text and Libre Franklin from Google Fonts
(free stand-ins for SIR's Benton Modern / Benton Sans).

The bookmark is tall and skinny (2.5 × 7 in), so the layout is re-flowed:

- **Phone** (< 900px): reads top to bottom like the bookmark — brand block
  floating in the sky over the cypress and coastline, then the three
  agents, then the closing line.
- **Desktop / tablet landscape** (≥ 900px): split in two — the painting and
  brand block as a sticky left panel, the agents on the right.

Below the fold is the **bookmark's back**, on a cream "card stock"
section: the Clint Eastwood quote, the nine Monterey Peninsula
communities with their icons (one column on phones, a 3 × 3 grid on
desktop), and the closing note to referring agents with a link back up
to the contacts.

Each agent has tap-to-call, tap-to-email, website, and a **Save contact**
button that downloads a vCard from `contacts/`.

## Layout

```
sirrisingstars/
├── index.html                 # the whole page (static, no JS)
├── styles.css
├── favicon.svg                # gold star on navy
├── assets/
│   ├── cypress-coast.jpg      # the bookmark's painting, text removed
│   └── icons/                 # community icons + ornaments from the bookmark back
├── contacts/                  # vCards behind the "Save contact" buttons
│   ├── natalie-nagel-poling.vcf
│   ├── ryan-keenan.vcf
│   └── laura-warren.vcf
└── README.md
```

## Editing

- **After changing `styles.css`, bump the `?v=` on its `<link>` in
  `index.html`.** Cloudflare sends `.css` with a 4-hour browser cache but
  HTML with 10 minutes, so without the bump returning visitors get the new
  page with the old stylesheet (which is how the cream section once showed
  up unstyled, with a giant black star).

- **Contact details** live in two places: the agent list in `index.html`
  and the matching `.vcf` in `contacts/`. Change both.
- **`assets/cypress-coast.jpg`** was extracted from the bookmark PDF (a
  single 451 × 1377 raster), cropped to the scene, had the baked-in brand
  text painted out of the sky, and was upscaled 2×. If a higher-resolution
  original of the artwork turns up, drop it in at the same path — the CSS
  crops with `object-fit: cover` anchored bottom-left, so any portrait
  crop with the cypress on the left will work.
- **`assets/icons/*.svg`** were traced (potrace) from the bookmark back's
  raster artwork, so they're vector and stay sharp at any size. The fill
  color (`#a8783f`) is baked into each file.
