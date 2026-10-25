import { BIOME_COLORS, INK, INK_FAINT, PAPER, PAPER_SHADE, PAPER_WARM, RED_PENCIL } from '../../src/render/palette.ts';

export interface Section {
  id: string;
  title: string;
  html: string;
}

export interface PageLink {
  slug: string;
  title: string;
  summary: string;
}

export interface Page extends PageLink {
  lede: string;
  sections: readonly Section[];
  code?: readonly string[];
}

export const FORM_COLOURS = {
  tree: BIOME_COLORS[1]!,
  bush: BIOME_COLORS[3]!,
  scrub: BIOME_COLORS[5]!,
  boulder: BIOME_COLORS[2]!,
  grass: BIOME_COLORS[0]!,
} as const;

export const SERIES = {
  ink: INK,
  red: RED_PENCIL,
  blue: '#3f6e8a',
  gold: '#c1953d',
  green: BIOME_COLORS[1]!,
  grey: INK_FAINT,
  violet: '#7a5c8a',
} as const;

export const figure = (inner: string, caption: string, wide = false): string =>
  `<figure class="${wide ? 'wide' : ''}">${inner}<figcaption>${caption}</figcaption></figure>`;

export const img = (src: string, alt: string, width?: number): string =>
  `<img src="${src}" alt="${alt}"${width ? ` width="${width}"` : ''} loading="lazy">`;

export const grid = (...cells: string[]): string => `<div class="grid-${cells.length}">${cells.join('')}</div>`;

export const callout = (html: string): string => `<aside class="callout">${html}</aside>`;

export const table = (head: readonly string[], rows: readonly (readonly string[])[]): string =>
  `<div class="tablewrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;

export const stylesheet = (): string => `
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: 16px; margin: 18px 0; }
.card { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 14px; padding: 12px; background: var(--warm); border: 1px solid var(--shade); border-radius: 8px; }
.card .plate { display: flex; align-items: center; justify-content: center; background: #ece4d0; border-radius: 6px; overflow: hidden; min-height: 110px; }
.card .plate img { width: 100%; height: auto; image-rendering: pixelated; display: block; }
.card h3 { margin: 0 0 4px; font-size: 16px; }
.card h3 i { font-weight: 400; color: var(--faint); font-size: 13px; margin-left: 4px; }
.card p { margin: 0 0 8px; font-size: 14px; line-height: 1.45; }
.card dl { margin: 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 10px; font: 12.5px/1.4 ui-sans-serif, system-ui, sans-serif; }
.card dt { color: var(--faint); }
.card dd { margin: 0; }
@media (max-width: 760px) { .card { grid-template-columns: 1fr; } }

:root {
  --paper: ${PAPER};
  --warm: ${PAPER_WARM};
  --shade: ${PAPER_SHADE};
  --ink: ${INK};
  --faint: ${INK_FAINT};
  --red: ${RED_PENCIL};
  --tree: ${FORM_COLOURS.tree};
  --grass: ${FORM_COLOURS.grass};
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.6 Georgia, 'Iowan Old Style', serif; }
a { color: var(--red); text-underline-offset: 2px; }
code { font: 0.86em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--warm); padding: 0.08em 0.3em; border-radius: 3px; }
.shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
nav.side { position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto; padding: 28px 20px; background: var(--warm); border-right: 1px solid var(--shade); font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; }
nav.side .brand { font: 700 15px/1.2 Georgia, serif; margin-bottom: 4px; }
nav.side .brand a { color: var(--ink); text-decoration: none; }
nav.side .tag { color: var(--faint); margin-bottom: 22px; }
nav.side h4 { margin: 20px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--faint); }
nav.side ul { list-style: none; margin: 0; padding: 0; }
nav.side li a { display: block; padding: 3px 8px; margin: 0 -8px; border-radius: 4px; color: var(--ink); text-decoration: none; }
nav.side li a:hover { background: var(--shade); }
nav.side li a.here { background: var(--ink); color: var(--paper); }
nav.side ul.sub { margin: 2px 0 6px 10px; border-left: 1px solid var(--shade); }
nav.side ul.sub a { font-size: 13px; color: #6b6354; padding: 1px 8px; }
main { max-width: 920px; padding: 48px 40px 120px; }
.eyebrow { font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.14em; color: var(--red); }
h1 { font-size: 44px; line-height: 1.08; margin: 12px 0 14px; letter-spacing: -0.01em; }
.lede { font-size: 19px; color: #4a4338; max-width: 680px; }
h2 { margin: 64px 0 8px; font-size: 28px; border-top: 2px solid var(--ink); padding-top: 14px; }
h2 .sn { color: var(--red); margin-right: 10px; font-variant-numeric: tabular-nums; }
h3 { margin: 32px 0 4px; font-size: 19px; }
p { max-width: 700px; }
figure { margin: 24px 0; }
figcaption { font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; color: #6b6354; margin-top: 8px; max-width: 700px; }
figcaption b { color: var(--ink); }
figure img { width: 100%; height: auto; image-rendering: pixelated; border: 1px solid var(--shade); display: block; background: var(--warm); }
.grid-2, .grid-3, .grid-4 { display: grid; gap: 18px; margin: 24px 0; }
.grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-2 figure, .grid-3 figure, .grid-4 figure { margin: 0; }
svg.chart { width: 100%; max-width: 560px; height: auto; display: block; font-family: ui-sans-serif, system-ui, sans-serif; }
svg.chart .gridline { stroke: var(--ink); stroke-width: 1; }
svg.chart .grid { stroke: var(--shade); stroke-width: 1; }
svg.chart .frame { fill: none; stroke: var(--faint); stroke-width: 1; }
svg.chart .tick { font-size: 11px; fill: #6b6354; }
svg.chart .axis { font-size: 12px; fill: var(--ink); }
svg.chart .note { font-size: 11px; fill: #6b6354; font-style: italic; }
svg.chart .line { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
svg.chart .line.dashed { stroke-dasharray: 5 4; }
svg.chart .guide { stroke: var(--red); stroke-width: 1; stroke-dasharray: 3 3; }
svg.chart .band { fill: var(--warm); }
svg.chart .area { opacity: 0.85; }
svg.chart .edge { fill: none; stroke-width: 1.2; }
svg.chart .box { fill: var(--warm); stroke: var(--ink); stroke-width: 1.2; }
svg.chart .box.hot { fill: var(--ink); }
svg.chart .box.hot text { fill: var(--paper); }
svg.chart .label { font-size: 12.5px; fill: var(--ink); }
svg.chart .arrow { stroke: var(--ink); stroke-width: 1.4; fill: none; }
.key { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 4px 0 0 52px; padding: 0; font: 12.5px ui-sans-serif, system-ui, sans-serif; }
.key .swatch { display: inline-block; width: 18px; height: 0; border-top: 3px solid var(--c); margin-right: 6px; vertical-align: middle; }

.key .chip { display: inline-block; width: 12px; height: 12px; background: var(--c); margin-right: 6px; vertical-align: -1px; border: 1px solid rgba(0,0,0,0.25); }
.key .swatch.dashed { border-top-style: dashed; }
.bars { font: 13px ui-sans-serif, system-ui, sans-serif; }
.bar { display: grid; grid-template-columns: 78px 1fr 48px; gap: 8px; align-items: center; margin: 2px 0; }
.bar .track { background: var(--shade); height: 9px; border-radius: 2px; overflow: hidden; }
.bar .track i { display: block; height: 100%; }
.bar .val { color: #6b6354; text-align: right; font-variant-numeric: tabular-nums; }
.tablewrap { overflow-x: auto; margin: 22px 0; }
table { border-collapse: collapse; font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; width: 100%; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--shade); vertical-align: top; }
th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); border-bottom: 2px solid var(--ink); }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.callout { margin: 24px 0; padding: 14px 18px; background: var(--warm); border-left: 4px solid var(--red); font-size: 15px; max-width: 700px; }
.callout p { margin: 0 0 8px; } .callout p:last-child { margin: 0; }
.muted { color: var(--faint); }
th small { text-transform: none; letter-spacing: 0; font-weight: 400; }
.where { font: 12.5px/1.6 ui-sans-serif, system-ui, sans-serif; color: #6b6354; margin: 10px 0 0; }
.where code { background: transparent; padding: 0; color: var(--ink); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; margin: 20px 0; }
.card { background: var(--warm); border: 1px solid var(--shade); border-radius: 6px; padding: 14px; font: 13px/1.45 ui-sans-serif, system-ui, sans-serif; display: flex; flex-direction: column; gap: 8px; }
.card h4 { margin: 0; font: 700 15px/1.2 Georgia, serif; }
.card .id { color: var(--faint); font-size: 11.5px; font-family: ui-monospace, Menlo, monospace; }
.card .row { display: flex; gap: 10px; align-items: flex-start; }
.card .row img { flex: none; width: 96px; height: 96px; }
.card .row dl { flex: 1; }
.card .sprites { display: flex; gap: 10px; align-items: flex-end; min-height: 72px; padding: 8px; background: var(--paper); border: 1px solid var(--shade); border-radius: 4px; flex-wrap: wrap; }
.sprite { image-rendering: pixelated; background-repeat: no-repeat; flex: none; }
.card dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.card dt { color: var(--faint); } .card dd { margin: 0; }
.card svg.chart .tick { font-size: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.chips li { padding: 1px 8px; border-radius: 10px; background: var(--shade); font-size: 12px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 0; font: 13px ui-sans-serif, system-ui, sans-serif; }
.filters button { border: 1px solid var(--ink); background: var(--paper); color: var(--ink); padding: 4px 12px; border-radius: 14px; cursor: pointer; font: inherit; }
.filters button[aria-pressed=true] { background: var(--ink); color: var(--paper); }
.index { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 28px; }
.index a { display: block; padding: 16px 18px; background: var(--warm); border: 1px solid var(--shade); border-radius: 6px; color: var(--ink); text-decoration: none; }
.index a:hover { border-color: var(--ink); }
.index b { display: block; font-size: 18px; margin-bottom: 4px; }
.index span { font: 14px/1.4 ui-sans-serif, system-ui, sans-serif; color: #6b6354; }
${FLOW_CSS}
@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }
  nav.side { position: static; height: auto; }
  main { padding: 28px 20px 80px; }
  .grid-3, .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

const nav = (page: Page | null, links: readonly PageLink[]): string =>
  `<nav class="side"><div class="brand"><a href="index.html">The Systems Wiki</a></div><div class="tag">Scribble Empire</div>
<h4>Systems</h4><ul>${links
    .map(
      (p) =>
        `<li><a href="${p.slug}.html"${p.slug === page?.slug ? ' class="here"' : ''}>${p.title}</a>${
          page && p.slug === page.slug
            ? `<ul class="sub">${page.sections.map((s) => `<li><a href="#${s.id}">${s.title}</a></li>`).join('')}</ul>`
            : ''
        }</li>`,
    )
    .join('')}</ul>
<h4>Elsewhere</h4><ul><li><a href="../methods.html">Book of Methods</a></li></ul></nav>`;

export function render(page: Page, links: readonly PageLink[]): string {
  const sections = page.sections
    .map((s, i) => `<section id="${s.id}"><h2><span class="sn">${i + 1}</span>${s.title}</h2>${s.html}</section>`)
    .join('\n');
  const where = page.code?.length
    ? `<p class="where">Source: ${page.code.map((c) => `<code>${c}</code>`).join(', ')}</p>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} · Scribble Empire systems wiki</title><link rel="stylesheet" href="wiki.css"></head>
<body><div class="shell">${nav(page, links)}<main>
<div class="eyebrow">Systems wiki</div><h1>${page.title}</h1><p class="lede">${page.lede}</p>${where}
${sections}
</main></div></body></html>`;
}

export function renderIndex(links: readonly PageLink[]): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scribble Empire systems wiki</title><link rel="stylesheet" href="wiki.css"></head>
<body><div class="shell">${nav(null, links)}<main>
<div class="eyebrow">Systems wiki</div><h1>How the world works</h1>
<p class="lede">One page per system. Every graph and every map on these pages is drawn by running the game's own code, so what you read here is what the simulation does. Regenerate with <code>npm run wiki</code> after changing a system and the pictures follow.</p>
<div class="index">${links.map((p) => `<a href="${p.slug}.html"><b>${p.title}</b><span>${p.summary}</span></a>`).join('')}</div>
<h2 style="border:0;margin-top:48px">Adding a page</h2>
<p>A page is one file in <code>tools/wiki/pages/</code> exporting a <code>Page</code>: a title, a lede and a list of sections. Import the sim's functions and call them, never copy a constant, so a chart cannot drift from the code it explains. Numbers quoted in the prose are typed by hand and are the part that can go stale, so re-read them when a system changes. Register the page in <code>tools/wiki/index.ts</code>.</p>
</main></div></body></html>`;
}

export const flow = (steps: readonly { title: string; text: string }[]): string =>
  `<ol class="flow">${steps.map((s) => `<li><b>${s.title}</b><span>${s.text}</span></li>`).join('')}</ol>`;

export const FLOW_CSS = `
.flow { list-style: none; display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0; padding: 0; counter-reset: step; }
.flow li { flex: 1 1 28%; position: relative; padding: 10px 12px 12px; background: var(--warm); border: 1.5px solid var(--ink); border-radius: 6px; font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; counter-increment: step; }
.flow li::before { content: counter(step); position: absolute; top: -10px; left: 10px; background: var(--ink); color: var(--paper); width: 20px; height: 20px; border-radius: 10px; text-align: center; font-size: 11px; line-height: 20px; }
.flow b { display: block; font: 700 14px/1.2 Georgia, serif; margin-bottom: 3px; }
.flow span { color: #6b6354; }
`;
