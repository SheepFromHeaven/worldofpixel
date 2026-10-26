import { birdHabitatAt } from '../../../src/sim/fauna/habitat/birdHabitat.ts';
import type { BirdHabitatSample } from '../../../src/sim/fauna/habitat/birdHabitat.ts';
import { LIVES } from '../../../src/sim/fauna/life.ts';
import { trapezoid } from '../../../src/sim/plants/niche.ts';
import { abundance, activity, BIRD_CELL_TILES, BIRD_SLOTS, BIRDS, bodyTexels, Realm, sheltering, spanTexels, Trait } from '../../../src/sim/birds/species.ts';
import type { BirdSpecies } from '../../../src/sim/birds/species.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { mix, renderMap } from '../raster.ts';
import { legend, lineChart, samples } from '../svg.ts';
import { clockText, compendium, lifeFacts } from '../compendium.ts';
import { migrationRun, WATCHED } from '../migrationRun.ts';
import { SERIES } from '../page.ts';

const GAIT_NAMES = ['hops and flies', 'hawks on the wing', 'soars', 'swims', 'walks'];
const PATTERN_NAMES = ['plain', 'capped', 'wing tips', 'speckled', 'striped', 'spotted'];
const TRAITS: readonly (readonly [number, string])[] = [
  [Trait.Crest, 'crest'],
  [Trait.Bill, 'long bill'],
  [Trait.Neck, 'long neck'],
  [Trait.Fork, 'forked tail'],
  [Trait.Hover, 'hovers'],
  [Trait.Dive, 'dives'],
  [Trait.Flock, 'flocks'],
  [Trait.Hook, 'hooked bill'],
  [Trait.Plume, 'long tail'],
];

const rgb = (c: readonly number[]): string => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

const colourOf = (s: BirdSpecies): string => rgb(s.colour);

const range = (r: readonly number[], unit = ''): string => `${r[1]} to ${r[2]}${unit}`;

const metres = (value: number): string => (value >= 1 ? `${value.toFixed(1)} m` : `${Math.round(value * 100)} cm`);

const realmOf = (s: BirdSpecies): string =>
  [s.realm & Realm.Land ? 'land' : '', s.realm & Realm.Fresh ? 'fresh water' : '', s.realm & Realm.Sea ? 'sea' : ''].filter(Boolean).join(' + ');

const traitsOf = (s: BirdSpecies): string => TRAITS.filter(([bit]) => (s.traits & bit) !== 0).map(([, name]) => name).join(', ') || 'none';

function catalogue(): string {
  const rows = BIRDS.map((s) => [
    `<span style="display:inline-block;width:10px;height:10px;background:${colourOf(s)};border:1px solid #2a2a2a;margin-right:6px"></span>${s.name}`,
    `${GAIT_NAMES[s.gait]!}, ${PATTERN_NAMES[s.pattern]!}`,
    realmOf(s),
    `${metres(s.length)}, span ${metres(s.span)} (${bodyTexels(s).toFixed(0)} and ${spanTexels(s).toFixed(0)} texels)`,
    `${s.adults}`,
    s.likes.map((v) => v.toFixed(1)).join(' / ') + (s.bias !== 0 ? ` (+${s.bias})` : ''),
    s.nest.map((v) => v.toFixed(1)).join(' / '),
    range(s.temperature, ' C'),
    `${s.day} / ${s.night}${s.dusk > 0 ? ` (+${s.dusk} at dusk)` : ''}`,
    `${s.speed} m/s${s.skit > 0 ? `, flushed at ${s.skit} m` : ', does not flush'}`,
    traitsOf(s),
  ]);
  return table(['Bird', 'Gait', 'Lives in', 'Length', 'Slots', 'Tree / open / water / edge', 'Nest sites', 'Best temperature', 'Day / night', 'Flight', 'Traits'], rows);
}

function curves(pick: (s: BirdSpecies, x: number) => number, domain: [number, number], label: string, ticks?: number[], only?: (s: BirdSpecies) => boolean): string {
  const shown = BIRDS.filter((s) => (only ? only(s) : true));
  return (
    lineChart({
      width: 560,
      height: 250,
      x: { label, domain, ...(ticks ? { ticks } : {}) },
      y: { label: 'factor', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: shown.map((s) => ({ name: s.name, colour: colourOf(s), points: samples(domain[0], domain[1], 160, (x) => pick(s, x)) })),
      legend: false,
      label,
    }) + legend(shown.map((s) => ({ name: s.name, colour: colourOf(s) })))
  );
}

const STEP = 4;

function habitatSamples(): { cache: Float32Array; columns: number } {
  const w = world();
  const { grid: g } = w;
  const sample: BirdHabitatSample = [0, 0, 0, 0];
  const columns = Math.ceil(g.columns / STEP);
  const cache = new Float32Array(columns * Math.ceil(g.rows / STEP) * 4);
  for (let r = 0; r < g.rows; r += STEP) {
    for (let c = 0; c < g.columns; c += STEP) {
      birdHabitatAt(w, c, r, sample);
      const at = ((r / STEP) * columns + c / STEP) * 4;
      for (let k = 0; k < 4; k += 1) cache[at + k] = sample[k]!;
    }
  }
  return { cache, columns };
}

function channelMaps(): string {
  const w = world();
  const { grid: g } = w;
  const { cache, columns } = habitatSamples();
  const names = ['tree', 'open', 'water', 'edge'];
  const tones: Rgb[] = [[40, 110, 50], [190, 170, 70], [50, 120, 160], [150, 120, 60]];
  const maps = names.map((name, k) =>
    renderMap(`birds-${name}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => mix([244, 241, 234], tones[k]!, Math.min(1, cache[((r / STEP) * columns + c / STEP) * 4 + k]!)),
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Tree'), '<b>Tree.</b> Somewhere to perch and nest: a tree tile is 1, a bush 0.6, scrub and a fallen trunk a little, and a tile with trees four tiles away borrows 0.6 of them, so the edge of a wood counts.'),
    figure(img(maps[1]!, 'Open'), '<b>Open.</b> Ground to feed on from the air or on foot: grass 1, bare and scrub less, trees almost none. Trodden ground gains a little.'),
  ) + grid(
    figure(img(maps[2]!, 'Water'), '<b>Water.</b> Zero on land. Fresh water carries its stillness (0.1 up to 1), the sea a fixed 0.05, so the shader knows the medium; reeds and lilies hold it high for ducks.'),
    figure(img(maps[3]!, 'Edge'), '<b>Edge.</b> The margin: on land, water within three and six tiles; on water, land within the same reach. Kingfishers, herons and gulls live on it.'),
  );
}

function abundanceMaps(): string {
  const w = world();
  const { grid: g } = w;
  const { cache, columns } = habitatSamples();
  const picks = ['sparrow', 'parrot', 'eagle', 'gull', 'mallard', 'swallow'].map((key) => BIRDS.find((s) => s.key === key)!);
  const maps = picks.map((s) =>
    renderMap(`birds-${s.key}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => {
        const tile = r * g.columns + c;
        const base: Rgb = BIOME_RGB[w.biome[tile]!] ?? [200, 200, 200];
        const at = ((r / STEP) * columns + c / STEP) * 4;
        const habitat: BirdHabitatSample = [cache[at]!, cache[at + 1]!, cache[at + 2]!, cache[at + 3]!];
        const value = abundance(s, habitat, { celsius: w.field.temperature[tile]!, year: 0.4, daylight: 0.8, wet: 0, snow: 0 });
        return mix(mix(base, [244, 241, 234], 0.55), [200, 60, 40], Math.min(1, value * 3));
      },
    }),
  );
  return grid(
    figure(img(maps[0]!, 'House sparrows'), '<b>House sparrows</b>, a summer day. Open ground with a tree nearby almost everywhere that is not frozen or desert.'),
    figure(img(maps[1]!, 'Scarlet macaws'), '<b>Scarlet macaws</b>. Hot, wet forest only.'),
  ) + grid(
    figure(img(maps[2]!, 'Golden eagles'), '<b>Golden eagles</b>. Wild ground from cold to warm, along lakes and rivers as well; and rare wherever the food web puts them.'),
    figure(img(maps[3]!, 'Herring gulls'), '<b>Herring gulls</b>. The coast, the sea near it, and lake shores.'),
  ) + grid(
    figure(img(maps[4]!, 'Mallards'), '<b>Mallards</b>. Lakes and slow rivers with reeds, and their banks.'),
    figure(img(maps[5]!, 'Barn swallows'), '<b>Barn swallows</b>, a summer day. Open ground and water in the warm zones; the cold ones are empty until the animals disperse there.'),
  );
}

function birdCards(): string {
  return compendium(
    BIRDS.map((s) => ({
      key: s.key,
      name: s.name,
      facts: [
        ['Kind', `${GAIT_NAMES[s.gait]!}, ${PATTERN_NAMES[s.pattern]!}; ${traitsOf(s)}`],
        ['Lives in', realmOf(s)],
        ['Size', `${metres(s.length)} long, ${metres(s.span)} across the wings; drawn ${bodyTexels(s).toFixed(0)} texels long`],
        ['Out', `${clockText(s.day, s.night, s.dusk)}, ${range(s.temperature, ' C')}`],
        ['Flight', `${s.speed} m/s${s.skit > 0 ? `, takes off from a click within ${s.skit} m` : ', ignores a click'}`],
        ...lifeFacts(LIVES.find((life) => life.key === s.key)!),
      ],
    })),
  );
}


const MIGRANT_COLOURS: Record<string, string> = { swallow: SERIES.gold, stork: SERIES.red, goose: SERIES.blue, crane: SERIES.violet, hummingbird: SERIES.green, starling: '#8a6a3c', sparrow: SERIES.grey };

function migrationCharts(): string {
  const run = migrationRun();
  const series = (band: 'north' | 'south') =>
    WATCHED.map((key) => ({ name: BIRDS.find((s) => s.key === key)!.name, colour: MIGRANT_COLOURS[key]!, points: run.phase.map((phase, i) => [phase, run[band][key]![i]!] as const) }));
  const chart = (band: 'north' | 'south', label: string): string =>
    lineChart({ width: 560, height: 250, x: { label: 'year, 0 is the first of March', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] }, y: { label, domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] }, series: series(band), legend: false, label }) +
    legend(series(band).map((entry) => ({ name: entry.name, colour: entry.colour })));
  const w = world();
  const maps = ['swallow', 'stork'].flatMap((key) =>
    [0.4, 0.9].map((phase) => {
      const snapshot = run.snapshots[key]![phase]!;
      let peak = 1e-9;
      for (const value of snapshot) peak = Math.max(peak, value);
      const name = renderMap(`birds-migration-${key}-${phase}.png`, {
        columns: run.columns,
        rows: run.rows,
        step: 1,
        zoom: 4,
        colourAt: (c, r) => {
          const column = Math.min(w.grid.columns - 1, c * 16 + 8);
          const row = Math.min(w.grid.rows - 1, r * 16 + 8);
          const base: Rgb = BIOME_RGB[w.biome[row * w.grid.columns + column]!] ?? [200, 200, 200];
          return mix(mix(base, [244, 241, 234], 0.55), [200, 60, 40], Math.min(1, Math.sqrt(snapshot[r * run.columns + c]! / peak) * 1.3));
        },
      });
      return figure(img(name, `${key} at ${phase}`), `<b>${BIRDS.find((s) => s.key === key)!.name}s</b>, ${phase < 0.5 ? 'northern midsummer' : 'northern midwinter'}.`);
    }),
  );
  return `${figure(chart('north', 'share of all adults in the northern third'), '<b>North.</b> Swallows, storks, geese and cranes leave the northern third of the map for the winter and come back in spring; the sparrow, which does not migrate, stays put. The hummingbird and starling move less because their temperature range is wider.')}
${figure(chart('south', 'share of all adults in the southern third'), '<b>South.</b> The same animals seen from the other hemisphere: the southern third fills when it is summer there. They cross the tropics in between.')}
${grid(maps[0]!, maps[1]!)}${grid(maps[2]!, maps[3]!)}`;
}

export const LINK: PageLink = {
  slug: 'birds',
  title: 'Birds',
  summary: 'Songbirds, raptors, waterfowl, sea birds and flightless runners that perch, soar, swim, dive, migrate and take off when startled.',
};

export function build(): Page {
  return {
    ...LINK,
    lede: `Birds are the first animals here that leave the ground. They are populations of the <a href="food-web.html">food web</a> like the reptiles: every patch holds eggs, nestlings, fledglings and adults, birds eat insects, seeds, fruit, frogs, lizards, fish and each other's eggs, and are eaten in turn by raptors, snakes, crows and gulls. What the map shows is that population: a few of each patch's birds, perched, hopping, circling or paddling, each with a shadow on the ground that separates from it as it climbs.`,
    code: ['src/sim/birds/species.ts', 'src/sim/fauna/habitat/birdHabitat.ts', 'src/sim/fauna/life.ts', 'src/render/lit/birdPass.ts', 'src/render/lit/shaders/birds.vert', 'src/render/lit/shaders/birds.frag', 'tools/birdPlates.js'],
    sections: [
      {
        id: 'compendium',
        title: 'The birds',
        html: `<p>All ${BIRDS.length} species, drawn by the same shader as on the map, perched on the left and in flight on the right, with how each lives and what the food web makes of it.</p>${birdCards()}`,
      },
      {
        id: 'how',
        title: 'Habitat, the food web, and what is drawn',
        html: `${flow([
          { title: 'Habitat', text: 'Four numbers per tile: tree, open, water, edge. Land, fresh water and the sea fill them differently, so one table of tastes serves all three media. A bird flies over any of them but lives and lands only in its realm.' },
          { title: 'Nests', text: 'Each species also has a taste for nest sites over the same four numbers: tit and woodpecker want trees, pheasants open ground, mallards reed banks, kingfishers a bank. Eggs and nestlings live only on land and are as many as the nest sites in the patch allow.' },
          { title: 'Population', text: 'The food web keeps the eggs, nestlings, fledglings and adults of each species in each patch. Birds that eat insects compete with frogs and lizards; raptors take frogs, lizards and small birds; crows, gulls and snakes take eggs. Migrants are not scripted: the swallow and the stork cannot stand the cold, so they die back in a cold patch and the animals that disperse from the warm south refill it.' },
          { title: 'Slots', text: `The ground is cut into ${BIRD_CELL_TILES} m cells with ${BIRD_SLOTS} slots in each, the species' slot counts laid end to end (one for the eagle, four for the sparrow). A slot wakes when its fixed random number is under the density the patch holds, spread over the places the species like. A fledgling is drawn at 62% of adult size, nestlings are not drawn.` },
          { title: 'Flocks', text: 'Starlings, gulls and macaws carry the flock trait: the slots of one cell share their timing and their destinations, offset by a few metres, so they take off, cross and land together.' },
        ])}
${callout('<p><b>A click is a scare, not a hunt.</b> A startled bird takes off and flies away, stays away for about half a minute and flies back. The food web holds no individual birds, so one that flees has not been eaten or fed.</p>')}`,
      },
      {
        id: 'catalogue',
        title: 'The species',
        html: `<p>The four tastes are, in order, <b>tree</b>, <b>open</b>, <b>water</b> and <b>edge</b>. A body is drawn at 3 texels plus 16 per metre of length and its wings at 2 plus 16 per metre of span: an eagle is 17 texels long and 36 across, a sparrow 5 and 6.</p>${catalogue()}`,
      },
      {
        id: 'habitat',
        title: 'Habitat: four maps of the world',
        html: `<p>Built by <code>birdHabitatAt</code> into an RGBA texture a band of sixteen rows a frame, by the same <code>HabitatTexture</code> as the reptiles, with no smoothing.</p>${channelMaps()}`,
      },
      {
        id: 'clock',
        title: 'The clock: when each species is out',
        html: `${figure(curves((s, x) => trapezoid(s.temperature, x), [-25, 46], 'air temperature, C'), '<b>Temperature.</b> Birds stay out in far colder air than reptiles. The migrants (swallow, stork, hummingbird, macaw) need warmth, and the food web empties a patch of them when it is cold.')}
${figure(curves((s, x) => activity(s, x), [0, 1], 'daylight, 0 night to 1 noon', [0, 0.25, 0.5, 0.75, 1]), '<b>Time of day.</b> Songbirds are out by day; the owl hunts in the dark and at dusk; herons and mallards keep some hours at night; gulls and cormorants hardly rest.')}
${figure(curves((s, x) => sheltering(s, x), [0, 0.5], 'wetness (rain or wet ground)', [0, 0.1, 0.2, 0.3, 0.4, 0.5], (s) => s.shy > 0.2), '<b>Rain.</b> Small perching birds sit tight in rain; eagles, gulls, herons and cormorants do not mind.')}
<p>Snow cover over 10% sends ground birds into hiding, melting away by 40%.</p>`,
      },
      {
        id: 'world',
        title: 'Where they could live on this seed',
        html: `<p>Suitability times the climate for six species on this seed, from <code>abundance</code>, with nobody eating anybody. The birds actually kept there are on the <a href="food-web.html">food web</a> page.</p>${abundanceMaps()}`,
      },
      {
        id: 'migration',
        title: 'Migration',
        html: `<p>Migration is a movement of the stocks in the food web, not an animation. A migratory species has a strength from 0 to 1 (<code>migrant</code>: swallow, stork, goose and crane 1, hummingbird 0.8, swan 0.6, starling, pelican and snowy owl 0.5, mallard and hawk 0.4, eagle, kestrel, gull, flamingo, cormorant 0.3). Each step, when adults and fledglings drift between two neighbouring patches, a migrant weights each patch's attraction by how comfortable its air is <i>now</i> (<code>(0.02 + comfort)^3</code>, mixed in by the strength) and moves faster the bigger the difference in comfort (up to six times). The climate the food web reads includes the season, so when the north cools the animals flow toward the warmer patches and when it warms again they flow back, and a stock that stays behind is killed by the cold. The breeding range follows because nests and food are in the patch, not the animal.</p>
${migrationCharts()}
<p><b>On the map</b> the migrants also fly past. In the weeks around spring (poleward) and autumn (toward the equator) of each hemisphere, a share of the awake slots of a migratory species, in proportion to its strength, leaves its home and flies a straight, high, fast track along the meridian in a loose V, wrapping through the cell so that a stream of flocks crosses the screen. The shadows are far from the birds, and nothing is stored: where a flock is and how it is spread is a function of the clock, the cell and the season.</p>`,
      },
      {
        id: 'motion',
        title: 'How each bird moves and looks',
        html: `<ul>
<li><b>Hops and flies</b> (sparrow, robin, tit, starling, woodpecker, macaw, hummingbird, kingfisher, gull, cormorant, owl): sits for its rest time, then flies in a gentle bow to a new spot inside its reach and sits again. Altitude is an arc over the flight, so the shadow slides away from the bird and back.</li>
<li><b>Hawks on the wing</b> (swallow): almost always in flight, short flights with hardly a pause, at a low steady height.</li>
<li><b>Soars</b> (kestrel, hawk, eagle, vulture): circles a drifting centre at height, never landing, wings held out and barely moving, the shadow far down the screen.</li>
<li><b>Swims</b> (mallard, swan, pelican, penguin): paddles slowly on water or walks on land, leaving a ripple ring behind it; a bird that lands on water, any species, throws a ring.</li>
<li><b>Walks</b> (pigeon, crow, turkey, peacock, chicken, goose, crane, flamingo, heron, pheasant, stork): moves a few metres at a time on foot and flies only when startled.</li>
<li><b>Flightless</b> (emu, ostrich, penguin): never leaves the ground, wings folded; startled, it runs at its own run speed instead of taking off, and the penguin swims and dives from sea ice and the coast.</li>
<li><b>Display</b> (peacock, turkey): now and then, standing still, the tail opens into a fan of eyespots.</li>
<li><b>Hovering</b> (hummingbird): hangs in the air with its wings blurred through a dither for most of the time between perches.</li>
<li><b>Startled</b>: a click throws a ripple and every bird inside its flush distance takes off a moment apart, flies 2.6 times that far away, waits, and flies back. Raptors and big waders flush from far, swallows never.</li>
</ul>
<p>Every bird is a distance field on the world's own texel grid, not a sprite: a body ellipse, a head, a bill, a tail (fan, fork or plume) and two wings. In flight the wings sweep and beat (the beat rate is the species'; big birds beat in bursts between glides) and are foreshortened by the cosine of the beat angle, as they would be seen from above. Lit from the top-left in steps, with an inked edge and a Bayer dither fade. Shadows are drawn in the ground layer and never over water; bodies are drawn after the plants, so a bird is seen over the canopy. Nothing is drawn below strip zoom 10.</p>`,
      },
    ],
  };
}
