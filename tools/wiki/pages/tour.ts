import { INK, INK_FAINT, PAPER_SHADE, PAPER_WARM } from '../../../src/render/palette.ts';
import { GAME_MODULES } from '../../../src/modules/index.ts';
import type { SimModule } from '../../../src/modules/index.ts';
import { SERIES, figure, grid, img } from '../page.ts';
import type { Page, PageLink } from '../page.ts';

export const LINK: PageLink = {
  slug: 'tour',
  title: 'The tour',
  summary: 'The whole codebase as pictures: one diagram a stop, a line under each.',
};

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const { red, blue, gold, green, violet } = SERIES;

const svg = (w: number, h: number, inner: string): string =>
  `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" font-family="${FONT}" font-size="13" style="max-width:${w}px">${inner}<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="${INK}"/></marker></defs></svg>`;

const box = (x: number, y: number, w: number, h: number, title: string, sub = '', fill: string = PAPER_WARM, stroke: string = INK): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
  `<text x="${x + w / 2}" y="${y + h / 2 + (sub ? -2 : 5)}" text-anchor="middle" font-weight="600" fill="${INK}">${title}</text>` +
  (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" font-size="11.5" fill="${INK_FAINT}">${sub}</text>` : '');

const arrow = (x1: number, y1: number, x2: number, y2: number, dash = false): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.6" marker-end="url(#ar)"${dash ? ' stroke-dasharray="5 4"' : ''}/>`;

const label = (x: number, y: number, text: string, colour: string = INK_FAINT, anchor = 'middle', size = 12): string =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${colour}">${text}</text>`;

const tint = (colour: string): string => `${colour}33`;

const ideas = (): string => {
  const tiles = Array.from({ length: 36 }, (_, i) => {
    const x = 30 + (i % 6) * 22;
    const y = 50 + Math.floor(i / 6) * 22;
    const shade = [green, '#9bb06a', blue, gold][(i * 7 + (i % 5)) % 4]!;
    return `<rect x="${x}" y="${y}" width="22" height="22" fill="${tint(shade)}" stroke="${PAPER_SHADE}"/>`;
  }).join('');
  return svg(
    900,
    240,
    `${label(110, 28, '1  The world is a grid', INK, 'middle', 15)}${tiles}` +
      `<rect x="96" y="94" width="22" height="22" fill="none" stroke="${red}" stroke-width="2.5"/>` +
      `${label(110, 200, '1 tile = 1 m = 16 pixels', INK_FAINT)}` +
      `${label(450, 28, '2  The sim never draws', INK, 'middle', 15)}` +
      box(340, 70, 110, 70, 'Sim', 'runs headless', tint(blue), blue) +
      box(490, 70, 110, 70, 'Screen', 'reads it', tint(gold), gold) +
      arrow(450, 105, 488, 105) +
      `${label(450, 175, 'same sim in a worker,', INK_FAINT)}${label(450, 192, 'in Node, in the wiki', INK_FAINT)}` +
      `${label(770, 28, '3  A feature is a folder', INK, 'middle', 15)}` +
      box(700, 60, 140, 34, 'modules/fire', '', tint(red), red) +
      box(700, 100, 140, 34, 'modules/mammals', '', tint(green), green) +
      box(700, 140, 140, 34, 'modules/weather', '', tint(violet), violet) +
      `<path d="M690 62L850 172M850 62L690 172" stroke="${red}" stroke-width="3" opacity="0.0"/>` +
      `${label(770, 205, 'delete one, nothing else breaks', INK_FAINT)}`,
  );
};

const layers = (): string =>
  svg(
    900,
    300,
    box(30, 30, 250, 56, 'ui/', 'React, HUD, Game', tint(gold), gold) +
      box(30, 118, 250, 56, 'render/', 'WebGL, ground painter', tint(blue), blue) +
      box(30, 206, 250, 56, 'sim/ + modules/', 'the world and its rules', tint(green), green) +
      arrow(155, 118, 155, 88) +
      arrow(155, 206, 155, 176) +
      label(300, 150, 'depends on', INK_FAINT, 'start') +
      label(155, 285, 'arrows point at what is read; sim reads nothing above it', INK_FAINT) +
      `<line x1="400" y1="20" x2="400" y2="280" stroke="${PAPER_SHADE}" stroke-width="2" stroke-dasharray="6 5"/>` +
      label(660, 28, 'Two threads', INK, 'middle', 15) +
      box(440, 60, 190, 200, 'Worker', '', tint(green), green) +
      label(535, 120, 'sim runs here', INK) +
      label(535, 140, 'kernel + modules', INK_FAINT) +
      box(690, 60, 190, 200, 'Main thread', '', tint(gold), gold) +
      label(785, 120, 'Replica (a mirror)', INK) +
      label(785, 140, 'renderer, UI', INK_FAINT) +
      arrow(632, 150, 688, 150) +
      label(660, 140, 'frames', INK_FAINT) +
      arrow(688, 190, 632, 190, true) +
      label(660, 210, 'commands', INK_FAINT),
  );

const world = (): string => {
  const steps = [
    ['seed', 'a number'],
    ['height', 'plates + noise'],
    ['water', 'sea, lakes, rivers'],
    ['climate', 'heat, wind, rain'],
    ['biome', 'one per tile'],
    ['geology', 'rock, ore, caves'],
  ] as const;
  const colours = [INK_FAINT, '#8a7a5a', blue, violet, green, red];
  const row = steps
    .map(([t, s], i) => box(20 + i * 148, 30, 128, 60, t, s, tint(colours[i]!), colours[i]!) + (i < steps.length - 1 ? arrow(148 + i * 148, 60, 168 + i * 148, 60) : ''))
    .join('');
  const names = ['terrain (never changes)', 'plants', 'trails', 'structures', 'items', 'homes'];
  const fills = [PAPER_SHADE, tint(green), tint(gold), tint(red), tint(blue), tint(violet)];
  const stack = names.map((n, i) => `<rect x="330" y="${300 - i * 34}" width="240" height="30" rx="5" fill="${fills[i]}" stroke="${INK}"/>${label(450, 320 - i * 34, n, INK)}`).join('');
  return svg(
    900,
    345,
    row +
      stack +
      label(210, 150, 'built once from the seed', INK_FAINT) +
      label(210, 168, 'same seed, same planet', INK_FAINT) +
      label(740, 150, 'layers sit on the terrain', INK_FAINT) +
      label(740, 168, 'each owns its sync and save', INK_FAINT),
  );
};

const kernel = (): string => {
  const mods = GAME_MODULES.map((m) => m.id).filter((id) => ['world', 'clock', 'weather', 'flora', 'fauna', 'fish', 'mammals', 'birds', 'people', 'mind', 'fire', 'light', 'construction', 'items'].includes(id));
  const cx = 450;
  const cy = 190;
  const chips = mods
    .map((m, i) => {
      const a = (i / mods.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 300;
      const y = cy + Math.sin(a) * 140;
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${PAPER_SHADE}" stroke-width="1.5"/>` + box(x - 48, y - 15, 96, 30, m, '', tint(blue), blue);
    })
    .join('');
  return svg(900, 380, chips + box(cx - 60, cy - 32, 120, 64, 'Kernel', 'wires them up', tint(red), red));
};

interface Band {
  readonly title: string;
  readonly from: number;
  readonly colour: string;
}

const BANDS: readonly Band[] = [
  { title: 'set up', from: 0, colour: INK_FAINT },
  { title: 'people act', from: 30, colour: gold },
  { title: 'animals', from: 120, colour: green },
  { title: 'afterwards', from: 200, colour: violet },
  { title: 'nature', from: 240, colour: blue },
];

const bandOf = (m: SimModule): number => BANDS.reduce((found, band, i) => (m.order >= band.from ? i : found), 0);

const tagsOf = (m: SimModule): readonly string[] => [...new Set(m.systems.flatMap((s) => s.tags ?? []))];

const tickOrder = (): string => {
  const columns = BANDS.map((_, i) => GAME_MODULES.filter((m) => bandOf(m) === i));
  const rows = Math.max(...columns.map((c) => c.length));
  const top = 70;
  const step = 36;
  const width = 164;
  const gap = 12;
  const body = columns
    .map((column, i) => {
      const band = BANDS[i]!;
      const x = 14 + i * (width + gap);
      const head = `<rect x="${x}" y="22" width="${width}" height="30" rx="6" fill="${band.colour}"/>${label(x + width / 2, 42, band.title, PAPER_WARM, 'middle', 13)}`;
      const chips = column
        .map((m, j) => {
          const y = top + j * step;
          const tags = tagsOf(m);
          return (
            `<rect x="${x}" y="${y}" width="${width}" height="28" rx="6" fill="${tint(band.colour)}" stroke="${band.colour}" stroke-width="1.5"${m.heavy ? ' stroke-dasharray="4 3"' : ''}/>` +
            label(x + 10, y + 19, String(m.order), INK_FAINT, 'start', 11) +
            label(x + 40, y + 19, m.id, INK, 'start', 13) +
            (tags.length > 0 ? label(x + width - 8, y + 19, tags.join(' '), band.colour === blue ? blue : INK_FAINT, 'end', 10.5) : '')
          );
        })
        .join('');
      const next = i < BANDS.length - 1 ? arrow(x + width + 1, 37, x + width + gap - 1, 37) : '';
      return head + chips + next;
    })
    .join('');
  const bottom = top + rows * step + 14;
  return svg(
    900,
    bottom + 40,
    body +
      `<rect x="14" y="${bottom}" width="34" height="16" rx="4" fill="none" stroke="${INK}" stroke-dasharray="4 3"/>` +
      label(56, bottom + 12, 'heavy: left out of scenarios and quick tools', INK_FAINT, 'start') +
      label(420, bottom + 12, 'small number on the left is the module\'s order', INK_FAINT, 'start'),
  );
};

const createThenRun = (): string => {
  const left = 30;
  const right = 500;
  return svg(
    900,
    270,
    label(left + 170, 26, '1  Create, once: follow needs', INK, 'middle', 15) +
      box(left + 110, 50, 120, 40, 'fauna', 'provides FAUNA', tint(green), green) +
      box(left, 170, 100, 40, 'fish', 'needs FAUNA', tint(green), green) +
      box(left + 120, 170, 100, 40, 'snares', 'needs FAUNA', tint(green), green) +
      box(left + 240, 170, 100, 40, 'mammals', 'needs FAUNA', tint(green), green) +
      arrow(left + 150, 92, left + 50, 168) +
      arrow(left + 170, 92, left + 170, 168) +
      arrow(left + 190, 92, left + 290, 168) +
      label(left + 170, 240, 'missing provider: the kernel throws', INK_FAINT) +
      `<line x1="450" y1="20" x2="450" y2="250" stroke="${PAPER_SHADE}" stroke-width="2" stroke-dasharray="6 5"/>` +
      label(right + 190, 26, '2  Run, every tick: follow order', INK, 'middle', 15) +
      box(right, 60, 120, 40, 'update(tick)', '', PAPER_WARM) +
      arrow(right + 122, 80, right + 158, 80) +
      box(right + 160, 60, 220, 40, '10 world  …  270 weather', '', tint(gold), gold) +
      label(right + 190, 140, 'tick = { seconds, scaled }', INK) +
      label(right + 190, 162, 'scaled = seconds × game speed', INK_FAINT) +
      label(right + 190, 200, 'registration order never matters:', INK_FAINT) +
      label(right + 190, 218, 'needs decide creation, order decides running', INK_FAINT),
  );
};

const tagFilter = (): string => {
  const tags = ['nature', 'fauna', 'weather'];
  const body = tags
    .map((tag, i) => {
      const y = 30 + i * 52;
      const hits = GAME_MODULES.filter((m) => tagsOf(m).includes(tag));
      return (
        `<rect x="14" y="${y}" width="230" height="36" rx="6" fill="${PAPER_WARM}" stroke="${INK}"/>` +
        `<text x="129" y="${y + 23}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" fill="${INK}">update(tick, '${tag}')</text>` +
        arrow(246, y + 18, 282, y + 18) +
        hits.map((m, j) => box(286 + j * 112, y + 3, 104, 30, m.id, '', tint(BANDS[bandOf(m)]!.colour), BANDS[bandOf(m)]!.colour)).join('')
      );
    })
    .join('');
  return svg(900, 200, body);
};

const person = (): string => {
  const needs = [
    ['hunger', '48 h', red, 0.55],
    ['thirst', '24 h', blue, 0.35],
    ['tired', '17 h', violet, 0.7],
    ['heat', 'no clothes', gold, 0.25],
  ] as const;
  const bars = needs
    .map(([n, s, c, v], i) => `${label(20, 50 + i * 40, n, INK, 'start', 14)}<rect x="90" y="${36 + i * 40}" width="200" height="16" rx="3" fill="${PAPER_SHADE}"/><rect x="90" y="${36 + i * 40}" width="${200 * v}" height="16" rx="3" fill="${c}"/>${label(300, 50 + i * 40, s, INK_FAINT, 'start')}`)
    .join('');
  const ladder = ['drink', 'eat', 'sleep', 'feed fire', 'gather', 'fish', 'wonder', 'build', 'scavenge', 'haul']
    .map((n, i) => box(470, 12 + i * 31, 150, 26, `${i + 1}  ${n}`, '', i < 3 ? tint(red) : PAPER_WARM))
    .join('');
  return svg(
    900,
    330,
    label(150, 20, 'Needs, 0 = fine, 1 = worst', INK, 'middle', 14) +
      bars +
      label(150, 230, 'a person is a row', INK_FAINT) +
      label(150, 248, 'across typed arrays, not an object', INK_FAINT) +
      label(545, 6, '', INK_FAINT) +
      ladder +
      label(760, 120, 'first one that says yes wins', INK_FAINT, 'middle') +
      arrow(700, 70, 700, 200) +
      label(745, 140, 'idle:', INK_FAINT, 'start'),
  );
};

const mind = (): string => {
  const n = (x: number, y: number, t: string, c: string): string => `<circle cx="${x}" cy="${y}" r="30" fill="${tint(c)}" stroke="${c}" stroke-width="2"/>${label(x, y + 5, t, INK, 'middle', 12)}`;
  const e = (x1: number, y1: number, x2: number, y2: number): string => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK_FAINT}" stroke-width="1.6"/>`;
  return svg(
    900,
    300,
    e(70, 60, 190, 100) + e(70, 140, 190, 100) + e(70, 220, 190, 240) + e(70, 260, 190, 240) + e(250, 100, 360, 170) + e(250, 240, 360, 170) + e(430, 170, 540, 170) + e(430, 60, 540, 170) +
      n(50, 60, 'flint', INK_FAINT) + n(50, 140, 'stone', INK_FAINT) + n(50, 230, 'branch', INK_FAINT) + n(50, 280, 'fibre', INK_FAINT) +
      n(220, 100, 'sharp', gold) + n(220, 240, 'binding', gold) + n(390, 170, 'tool', green) + n(390, 60, 'kindling', INK_FAINT) + n(570, 170, 'flame', red) +
      label(700, 110, 'You pick two neurons.', INK, 'start', 14) +
      label(700, 135, 'If a recipe fits, someone', INK_FAINT, 'start') +
      label(700, 153, 'walks over and tries it.', INK_FAINT, 'start') +
      label(740, 150, 'Success: the whole group', INK_FAINT, 'start') +
      label(740, 168, 'now knows it.', INK_FAINT, 'start'),
  );
};

const web = (): string => {
  const chain = [
    ['plants', green],
    ['insects', gold],
    ['frogs', blue],
    ['snakes', violet],
    ['hawks', red],
  ] as const;
  const row = chain.map(([t, c], i) => box(20 + i * 130, 40, 110, 46, t, '', tint(c), c) + (i < 4 ? arrow(130 + i * 130, 63, 148 + i * 130, 63) : '')).join('');
  const cells = Array.from({ length: 40 }, (_, i) => {
    const x = 700 + (i % 8) * 24;
    const y = 30 + Math.floor(i / 8) * 24;
    const v = ((i * 37) % 10) / 10;
    return `<rect x="${x}" y="${y}" width="22" height="22" fill="${green}" fill-opacity="${0.15 + v * 0.7}" stroke="${PAPER_SHADE}"/>`;
  }).join('');
  return svg(
    900,
    200,
    row +
      label(330, 120, 'who eats whom comes from body size and diet, not a hand-written list', INK_FAINT) +
      cells +
      label(792, 168, 'world cut into 16-tile patches', INK_FAINT) +
      label(792, 186, 'each holds 4 counts a species', INK_FAINT) +
      label(330, 160, 'egg, young, juvenile, adult', INK_FAINT),
  );
};

const draw = (): string => {
  const passes = ['ground', 'shadows', 'water', 'fish', 'props + animals', 'weather', 'night grade', 'fog'];
  const cols = [PAPER_SHADE, '#8a7a5a', blue, blue, green, violet, INK_FAINT, INK];
  return svg(
    900,
    300,
    passes.map((p, i) => `<g transform="translate(${20 + i * 9},${240 - i * 28})">${box(0, 0, 200, 30, p, '', tint(cols[i]!), cols[i]!)}</g>`).join('') +
      label(330, 30, 'drawn bottom to top, one pass each', INK, 'start', 14) +
      label(330, 52, 'ground is painted once and cached', INK_FAINT, 'start') +
      label(330, 72, 'everything standing on it is lit every frame', INK_FAINT, 'start') +
      label(330, 92, 'animals are sorted with trees by height', INK_FAINT, 'start'),
  );
};

const checks = (): string =>
  svg(
    900,
    130,
    box(20, 30, 180, 60, 'typecheck', 'strict + module rules', tint(blue), blue) +
      arrow(200, 60, 240, 60) +
      box(240, 30, 180, 60, 'scenario', 'scripted player', tint(green), green) +
      arrow(420, 60, 460, 60) +
      box(460, 30, 180, 60, 'hash', 'refactor changed nothing?', tint(gold), gold) +
      arrow(640, 60, 680, 60) +
      box(680, 30, 200, 60, 'look at it', 'screenshot, zoo, wiki', tint(red), red),
  );

export function build(): Page {
  return {
    ...LINK,
    lede: 'Scribble Empire at a glance. Read the pictures top to bottom; each has one line under it. CLAUDE.md has the words when you want them.',
    code: ['tools/wiki/pages/tour.ts'],
    sections: [
      { id: 'idea', title: 'The three ideas', html: figure(ideas(), 'A metre-scale grid. A sim that never draws. Features you can delete.', true) },
      { id: 'building', title: 'The building', html: figure(layers(), 'Dependencies run one way. The sim lives in a worker and mirrors itself to the screen.', true) },
      {
        id: 'world',
        title: 'The world',
        html:
          figure(world(), 'One pass from a seed, then layers for everything that changes.', true) +
          grid(figure(img('img/eco-map.png', 'How well things grow on each tile'), 'What the map looks like: how well things grow, tile by tile.'), figure(img('img/geo-slice-10.png', 'A slice of the underground'), 'Underneath: rock, ore and caves, cut at one level.')),
      },
      { id: 'kernel', title: 'Kernel and modules', html: figure(kernel(), 'Every feature is a module. The kernel wires them together.', true) },
      {
        id: 'tick',
        title: 'One tick',
        html:
          figure(createThenRun(), 'Two different orders: needs at start-up, the order number every tick.', true) +
          figure(tickOrder(), 'Every game module in the order it runs, read from the code. Down each column, then the next column.', true) +
          figure(tagFilter(), 'Passing a tag runs only the systems that carry it. Headless tools use this to skip people and fast-forward nature.', true),
      },
      { id: 'people', title: 'People', html: figure(person(), 'Needs rise, and when idle a person works down the list of things to do.', true) },
      { id: 'mind', title: 'Discovery', html: figure(mind(), 'Ideas combine. A proven idea becomes something the group can do.', true) },
      {
        id: 'life',
        title: 'The living world',
        html: figure(web(), 'Every animal species is a row of data in one shared food web.', true) + grid(figure(img('img/fish-shoals.png', 'Shoals of fish'), 'Fish are shoals.'), figure(img('img/birds-eagle.png', 'An eagle'), 'Birds are drawn from the counts.')),
      },
      { id: 'draw', title: 'Drawing it', html: figure(draw(), 'A stack of passes, each one small.', true) },
      { id: 'works', title: 'How you know it works', html: figure(checks(), 'No test framework. These four are the safety net.', true) },
    ],
  };
}
