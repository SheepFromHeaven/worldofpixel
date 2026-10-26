import { buildDiet, flowSlot } from '../../../src/sim/fauna/diet.ts';
import { DEFAULT_TUNING, FEED_MAX, FISH_FORAGE_SHARE, MAX_RANGE_GAIN, REFUGE } from '../../../src/sim/fauna/fauna.ts';
import type { Life } from '../../../src/sim/fauna/life.ts';
import { FAUNA_YEAR_DAYS, LIFE_COUNT, LIVES, needOf, NEED_EXPONENT, PATCH_AREA, PATCH_TILES, Stage, STAGE_NAMES } from '../../../src/sim/fauna/life.ts';
import { FISH } from '../../../src/sim/fish/species.ts';
import { world } from '../context.ts';
import { foodWebRun, YEARS } from '../foodWebRun.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, SERIES, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { mix, renderMap } from '../raster.ts';
import { legend, lineChart, samples } from '../svg.ts';

const CLASSES: readonly { name: string; colour: string; pick: (life: Life) => boolean }[] = [
  { name: 'insects', colour: SERIES.gold, pick: (l) => l.group === 'insect' },
  { name: 'amphibians', colour: SERIES.green, pick: (l) => l.group === 'amphibian' },
  { name: 'lizards and chameleons', colour: SERIES.red, pick: (l) => l.group === 'reptile' && l.mass[Stage.Adult]! < 5 && l.eats !== 0 && l.key !== 'pondturtle' && l.key !== 'snapper' && l.key !== 'boxturtle' && !/snake|cobra|mamba|python|anaconda|boa|adder|worm|rattle|winder/.test(l.key) },
  { name: 'snakes', colour: SERIES.violet, pick: (l) => /snake|cobra|mamba|python|anaconda|boa|adder|worm|rattle|winder/.test(l.key) },
  { name: 'turtles and tortoises', colour: '#8a6a3c', pick: (l) => ['pondturtle', 'snapper', 'boxturtle', 'tortoise', 'deserttortoise', 'seaturtle', 'iguana', 'marineiguana'].includes(l.key) },
  { name: 'small birds', colour: SERIES.blue, pick: (l) => l.group === 'bird' && l.mass[Stage.Adult]! < 0.5 },
  { name: 'big birds and raptors', colour: '#2a2a6a', pick: (l) => l.group === 'bird' && l.mass[Stage.Adult]! >= 0.5 },
  { name: 'big reptiles', colour: '#4a4a4a', pick: (l) => ['komodo', 'monitor', 'alligator', 'nilecroc', 'saltcroc', 'caiman', 'gharial'].includes(l.key) },
];

const kg = (value: number): string => (value >= 100 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value >= 0.01 ? value.toFixed(2) : value.toExponential(0));

const count = (value: number): string => (value >= 100 ? Math.round(value).toLocaleString('en') : value >= 1 ? value.toFixed(1) : value.toFixed(2));

const logTick = (value: number): string => `10^${value}`;

function stageTable(): string {
  const rows = LIVES.filter((life) => life.group !== 'game').map((life) => [
    life.name,
    life.group,
    life.live ? 'live young' : `${kg(life.mass[Stage.Egg]!)} kg`,
    `${kg(life.mass[Stage.Hatchling]!)} kg`,
    life.stages === 4 ? `${kg(life.mass[Stage.Juvenile]!)} kg` : 'none',
    `${kg(life.mass[Stage.Adult]!)} kg`,
    life.live ? 'born' : `${life.incubation.toFixed(2)} yr`,
    `${life.mature.toFixed(2)} yr`,
    `${life.lifespan.toFixed(1)} yr`,
    `${Math.round(life.clutch * 0.5)}`,
  ]);
  return table(['Species', 'Group', 'Egg', 'Hatchling', 'Juvenile', 'Adult', 'Incubation', 'Adulthood at', 'Lifespan', 'Eggs per year per female at best'], rows);
}

function dietTable(): string {
  const diet = buildDiet();
  const rows = LIVES.filter((life) => life.eats !== 0 || life.plant[2]! > 0).map((life) => {
    const slot = flowSlot(life.index, Stage.Adult);
    const edges: { name: string; weight: number }[] = [];
    for (let e = diet.flows.start[slot]!; e < diet.flows.start[slot + 1]!; e += 1) {
      const prey = LIVES[diet.flows.prey[e]!]!;
      const stage = diet.flows.stage[e]!;
      edges.push({ name: `${prey.name}${stage === Stage.Adult ? '' : ` ${STAGE_NAMES[stage]}`}`, weight: diet.flows.weight[e]! });
    }
    for (let e = diet.fish.start[slot]!; e < diet.fish.start[slot + 1]!; e += 1) edges.push({ name: FISH[diet.fish.prey[e]!]!.name, weight: diet.fish.weight[e]! });
    const top = edges.sort((a, b) => b.weight - a.weight).slice(0, 5).map((edge) => edge.name);
    const plant = life.plant[2]!;
    return [
      life.name,
      `${kg(needOf(life.mass[Stage.Adult]!, life.group) * life.appetite * DEFAULT_TUNING.hunger)} kg`,
      `${Math.round(1e6 / (life.density * 1e6))} m<sup>2</sup>`,
      top.length > 0 ? top.join(', ') : '<i>nothing, only plants</i>',
      plant > 0 ? `${Math.round(plant * 100)}%` : '',
    ];
  });
  return table(['Species', 'Needs a year', 'Territory', 'Eats most readily (adult)', 'Plants'], rows);
}

function sizeChart(): string {
  const masses = samples(-3, 3, 60, (x) => x);
  return (
    lineChart({
      width: 560,
      height: 260,
      x: { label: 'adult mass, kg (log10)', domain: [-3, 3], ticks: [-3, -2, -1, 0, 1, 2, 3], format: (v) => `10^${v}` },
      y: { label: 'food needed a year, kg (log10)', domain: [-3, 3], ticks: [-3, -2, -1, 0, 1, 2, 3], format: (v) => `10^${v}` },
      series: [
        { name: 'amphibians', colour: SERIES.green, points: masses.map(([x]) => [x, Math.log10(needOf(10 ** x, 'amphibian') * DEFAULT_TUNING.hunger)] as const) },
        { name: 'reptiles at full appetite', colour: SERIES.red, points: masses.map(([x]) => [x, Math.log10(needOf(10 ** x, 'reptile') * DEFAULT_TUNING.hunger)] as const) },
        { name: 'snakes and crocodiles (0.3 to 0.35 of that)', colour: SERIES.violet, dashed: true, points: masses.map(([x]) => [x, Math.log10(needOf(10 ** x, 'reptile') * 0.32 * DEFAULT_TUNING.hunger)] as const) },
        { name: 'insects', colour: SERIES.gold, points: masses.map(([x]) => [x, Math.log10(needOf(10 ** x, 'insect') * DEFAULT_TUNING.hunger)] as const) },
      ],
      legend: false,
      label: 'food need against body mass',
    }) + legend([{ name: 'amphibians', colour: SERIES.green }, { name: 'reptiles at full appetite', colour: SERIES.red }, { name: 'snakes and crocodiles', colour: SERIES.violet }, { name: 'insects', colour: SERIES.gold }])
  );
}

function territoryChart(): string {
  const shown = LIVES.filter((life) => life.group !== 'game');
  return (
    lineChart({
      width: 560,
      height: 260,
      x: { label: 'adult mass, kg (log10)', domain: [-6, 3], ticks: [-6, -4, -2, 0, 2], format: (v) => `10^${v}` },
      y: { label: 'most animals a patch can hold (log10)', domain: [-3, 6], ticks: [-3, 0, 3, 6], format: (v) => `10^${v}` },
      series: [
        {
          name: 'territory limit',
          colour: SERIES.ink,
          points: shown
            .map((life) => [Math.log10(life.mass[Stage.Adult]!), Math.log10(Math.max(1e-3, life.density * PATCH_AREA))] as const)
            .sort((a, b) => a[0] - b[0]),
        },
      ],
      legend: false,
      label: 'territory against body mass',
    })
  );
}

function biomassChart(): string {
  const run = foodWebRun();
  const series = CLASSES.map((cls) => ({
    name: cls.name,
    colour: cls.colour,
    points: run.samples.map((s) => {
      let total = 0;
      for (const life of LIVES) if (cls.pick(life)) total += s.adults[life.index]! * life.mass[Stage.Adult]!;
      return [s.year, Math.log10(Math.max(1e-3, total))] as const;
    }),
  }));
  return (
    lineChart({
      width: 600,
      height: 280,
      x: { label: 'years since the start (one year is one game day)', domain: [0, YEARS], ticks: [0, 4, 8, 12, 16] },
      y: { label: 'adult biomass, kg (log10)', domain: [0, 6], ticks: [0, 1, 2, 3, 4, 5, 6], format: logTick },
      series,
      legend: false,
      label: 'biomass by group over the run',
    }) + legend(series.map((s) => ({ name: s.name, colour: s.colour })))
  );
}

function populationChart(keys: readonly string[], domain: [number, number], label: string): string {
  const run = foodWebRun();
  const picked = keys.map((key) => LIVES.find((life) => life.key === key)!);
  const series = picked.map((life, i) => ({
    name: life.name,
    colour: [SERIES.red, SERIES.green, SERIES.blue, SERIES.gold, SERIES.violet, SERIES.grey, SERIES.ink][i % 7]!,
    points: run.samples.map((s) => [s.year, Math.log10(Math.max(0.01, s.adults[life.index]!))] as const),
  }));
  return (
    lineChart({
      width: 560,
      height: 260,
      x: { label: 'years since the start', domain: [0, YEARS], ticks: [0, 4, 8, 12, 16] },
      y: { label, domain, ticks: Array.from({ length: domain[1] - domain[0] + 1 }, (_, i) => domain[0] + i), format: logTick },
      series,
      legend: false,
      label,
    }) + legend(series.map((s) => ({ name: s.name, colour: s.colour })))
  );
}

function stageShares(): string {
  const run = foodWebRun();
  const last = run.samples[run.samples.length - 1]!;
  const keys = ['frog', 'walllizard', 'adder', 'pondturtle', 'komodo', 'nilecroc', 'seaturtle'];
  const rows = keys.map((key) => {
    const life = LIVES.find((l) => l.key === key)!;
    const e = last.eggs[life.index]!;
    const h = last.hatchlings[life.index]!;
    const j = last.juveniles[life.index]!;
    const a = last.adults[life.index]!;
    const total = Math.max(1e-9, e + h + j + a);
    const bar = (value: number, colour: string): string => `<span style="display:inline-block;height:12px;width:${Math.round((value / total) * 140)}px;background:${colour}"></span>`;
    return [life.name, `${bar(e, '#d8cfa8')}${bar(h, '#9bb46a')}${bar(j, '#5f9a5a')}${bar(a, '#2f6a4a')}`, count(a), count(j), count(h), count(e)];
  });
  return table(['Species', 'Eggs, hatchlings, juveniles, adults', 'Adults', 'Juveniles', 'Hatchlings', 'Eggs'], rows);
}

function densityMaps(): string {
  const run = foodWebRun();
  const { fauna } = run;
  const { columns, rows } = fauna.patches;
  const w = world();
  const picks: readonly (readonly [string, string, string])[] = [
    ['frog', 'Common frogs', '<b>Common frogs</b> gather round ponds and rivers in the temperate belt.'],
    ['walllizard', 'Wall lizards', '<b>Wall lizards</b> are everywhere that is warm and open, the most numerous reptile.'],
    ['python', 'Reticulated pythons', '<b>Reticulated pythons</b> are rare, tied to warm forest with plenty to eat, and set a very low density.'],
    ['komodo', 'Komodo dragons', '<b>Komodo dragons</b> are rarer still: the food they need would feed hundreds of lizards.'],
    ['nilecroc', 'Nile crocodiles', '<b>Nile crocodiles</b> follow warm rivers and lakes where fish are plentiful.'],
    ['seaturtle', 'Green sea turtles', '<b>Green sea turtles</b> cruise the warm shallows over seagrass.'],
  ];
  const figures = picks.map(([key, alt, caption]) => {
    const life = LIVES.find((l) => l.key === key)!;
    let peak = 1e-9;
    for (let patch = 0; patch < fauna.patches.count; patch += 1) peak = Math.max(peak, fauna.stockOf(patch, life.index, Stage.Adult));
    const name = renderMap(`foodweb-${key}.png`, {
      columns,
      rows,
      step: 1,
      zoom: 4,
      colourAt: (c, r) => {
        const patch = r * columns + c;
        const column = Math.min(w.grid.columns - 1, c * PATCH_TILES + PATCH_TILES / 2);
        const row = Math.min(w.grid.rows - 1, r * PATCH_TILES + PATCH_TILES / 2);
        const base: Rgb = BIOME_RGB[w.biome[row * w.grid.columns + column]!] ?? [200, 200, 200];
        const level = Math.sqrt(fauna.stockOf(patch, life.index, Stage.Adult) / peak);
        return mix(mix(base, [244, 241, 234], 0.55), [200, 60, 40], Math.min(1, level * 1.3));
      },
    });
    return figure(img(name, alt), caption);
  });
  return grid(figures[0]!, figures[1]!) + grid(figures[2]!, figures[3]!) + grid(figures[4]!, figures[5]!);
}

function fishNumbers(): string {
  const run = foodWebRun();
  const first = run.samples[0]!;
  const last = run.samples[run.samples.length - 1]!;
  const rows = FISH.map((species, i) => [species.name, species.water, count(first.fish[i]!), count(last.fish[i]!)]);
  return table(['Fish', 'Water', 'Fish at the start', `Fish after ${YEARS} years`], rows) + `<p>At the end the shoals carry ${count(last.fishEggs)} eggs and ${count(last.fishFry)} fry between them.</p>`;
}

export const LINK: PageLink = {
  slug: 'food-web',
  title: 'The food web',
  summary: 'Every animal eats, breeds, is eaten and grows up: insects, fish, amphibians, reptiles and birds in one balance.',
};

export function build(): Page {
  return {
    ...LINK,
    lede: `The insects, amphibians, reptiles, birds and fish are no longer scenery drawn from a habitat map. They are populations that live in the world's patches (${PATCH_TILES} by ${PATCH_TILES} tiles), eat each other and the plants, lay eggs, hatch, grow up and die, and the numbers you see are the ones this simulation keeps. A year in it is ${FAUNA_YEAR_DAYS} game day, so a game minute is a good part of a season. Nothing is a fixed quota: a big lizard is rare because it needs a great deal of food and a great deal of ground, and a fish is eaten in numbers its own breeding can bear.`,
    code: ['src/sim/fauna/life.ts', 'src/sim/fauna/patches.ts', 'src/sim/fauna/diet.ts', 'src/sim/fauna/fauna.ts', 'src/sim/fauna/pack.ts', 'src/sim/fish/fish.ts', 'tools/foodweb.ts'],
    sections: [
      {
        id: 'how',
        title: 'How it works',
        html: `${flow([
          { title: 'Patches', text: `The world is cut into ${PATCH_TILES} tile patches, the same cells as the weather. Each keeps, for every species, how many eggs, hatchlings, juveniles and adults are in it. Habitat is read once from the world (water, shelter, open warm ground, banks) and averaged over a patch, water-bound stages from an exact count of the pond tiles.` },
          { title: 'Climate', text: 'Each tick the patch takes its temperature from the yearly climate without the daily swing (animals shelter from the day\'s extremes), and its snow cover from the weather. A cold or hot patch slows feeding and development, and an extreme one kills.' },
          { title: 'Diet', text: `Who can eat whom is not typed in. A species names the kinds it eats (insects, amphibians, reptiles, fish, game, plants) and a window of prey size relative to its own, and every stage of every species that fits, in the same medium (land, fresh water, sea), is on the menu with a weight that peaks at the middle of the window. A hatchling's window is relative to its own small mass, and a young carnivore also takes insects.` },
          { title: 'Eating', text: `A predator's supply is the prey it can reach (each stock times how easily that kind is caught, less a refuge of ${REFUGE * 100}% of its territory capacity that nobody takes, and less again when it is scarce, so a predator does not hunt the last of anything). Intake is ${FEED_MAX} x supply / (supply + need), so it is the supply per mouth that decides: full below one, a feast above.` },
          { title: 'Breeding and growth', text: 'Surplus intake becomes eggs, up to a clutch a female can lay, only when the patch is warm enough and has a nest site. Eggs hatch with warmth, hatchlings and juveniles grow at a pace set by how well they eat, and an adult dies of old age, hunger, crowding, or what eats it.' },
          { title: 'Moving', text: 'Adults and juveniles drift toward neighbouring patches that offer more (suitable and well fed), so a booming patch spills over and an empty one fills.' },
        ])}
${callout(`<p><b>Why big animals are rare.</b> Food need grows with mass to the ${NEED_EXPONENT}, so a body ten times heavier needs about five times the food, not ten, but the ground it holds as a territory grows nearly as fast, and a predator's prey is itself a small, scarce stock. A crocodile's territory is hundreds of patches' worth of prey on one animal, and where prey is thinner than that it simply does not breed enough to stay. A predator also ranges over several patches, so its supply is the food around it (up to ${MAX_RANGE_GAIN} times a patch's worth, by territory size) while what it removes comes from this patch alone.</p>`)}`,
      },
      {
        id: 'size',
        title: 'Size is the rule: need, territory, and appetite',
        html: `<p>An animal's food need is <code>c x mass^${NEED_EXPONENT}</code> kilograms a year (c is 9 for amphibians, 8 for birds, 5 for reptiles, 4 for insects), times an appetite for how it lives: snakes and chameleons wait and eat little (0.3 to 0.4), crocodiles 0.35, big lizards 0.5, small lizards a full 1. The territory it needs is <code>300 x mass^0.6</code> square metres. Insects are plant eaters with a fixed biomass a square metre, scaled by the habitat.</p>
${figure(sizeChart(), '<b>Need.</b> A frog eats tens of times its own weight in a year, a snake only a few times its own. The step down between the solid reptile line and the dashed one is how sit and wait hunters get by on little.', true)}
${figure(territoryChart(), '<b>Territory.</b> How many adults a patch can hold at the most, whatever the food. A mosquito-sized animal is limited by food, never by room; a crocodile is limited by room.', true)}`,
      },
      {
        id: 'stages',
        title: 'Eggs, hatchlings, juveniles, adults',
        html: `<p>Every species but the live-bearers (adders, sidewinders, tree boas, anacondas, sea snakes, slow worms, and the game animals) lays eggs, and each stage is a stock of its own in every patch. Eggs are eaten by animals that eat eggs (snakes, monitors, snapping turtles, newts, ants and beetles). The young are fed by what a small animal can take, and amphibian eggs and tadpoles, and the larvae of dragonflies and midges, live in the calm water of the patch, so they need a pond. Turtles and crocodilians lay on the bank, and a sea turtle on a warm beach.</p>
<p>The numbers below are chosen so that a population with plenty of food and room grows by about a factor of four to eight a generation, and the rest is the world: food, crowding, heat and cold, and being eaten. Insects take a larval stage and no juvenile, amphibians have tadpoles and froglets, the big reptiles take years to grow up.</p>${stageTable()}`,
      },
      {
        id: 'diets',
        title: 'Who eats what',
        html: `<p>The first five prey each species takes most readily as an adult, from the size window and the medium, with what it needs, and how much ground. The game animal is a stand-in for the grazing mammals the world does not have yet: a grazer of 15 kg on the plants, at 800 square metres a head, who feeds the big hunters until real mammals replace it.</p>${dietTable()}`,
      },
      {
        id: 'run',
        title: 'What the sim does when left alone',
        html: `<p>This is the real thing run headless on this seed for ${YEARS} years (${YEARS} game days) in steps of a quarter year, starting from a seed population sized from the food each patch has, with the yearly average climate and no one disturbing it. It is also what <code>npm run foodweb</code> prints.</p>
${figure(biomassChart(), '<b>Biomass by group.</b> Insects (and the insect eaters on them) settle within a year or two; the reptiles that eat reptiles take longest and are an order of magnitude lighter than what they eat each time up the chain.', true)}
${figure(populationChart(['frog', 'treefrog', 'dartfrog', 'woodfrog', 'toad'], [0, 4], 'adult frogs in the world, log10'), '<b>Amphibians</b> settle to a steady level with a dip and recovery as their prey and predators take their turns.', true)}
${figure(populationChart(['walllizard', 'gecko', 'komodo', 'monitor', 'python', 'nilecroc'], [0, 5], 'adults in the world, log10'), '<b>Reptiles of every size</b> on one scale. The small ones are in the tens of thousands; the big ones are a handful in the world and finding their level slowly.', true)}
<p>The age structure at the end is that of a stable population: many eggs and hatchlings, fewer and fewer of each older stage.</p>${stageShares()}`,
      },
      {
        id: 'where',
        title: 'Where they live on this seed',
        html: `<p>Adult density after the run, scaled to the busiest patch for each species, over the biomes.</p>${densityMaps()}`,
      },
      {
        id: 'fish',
        title: 'The fish are in it too',
        html: `<p>Fish keep their shoals (see the fish page) and now take part. Every shoal also carries eggs and fry: a spawning shoal lays eggs when the water is warm enough, they hatch, the fry grow and join the adults, and the fry are prey for the hunting fish. The fish are also fed and eaten from the patch's side: perch, trout, minnows and carp take tadpoles, frog spawn and insect larvae from the water's patch (up to ${FISH_FORAGE_SHARE * 100}% of what is there in a tick, so they never clear a pond), and every reptile that eats fish takes some from the shoals in its patch. A visible shoal stands for the many fish of the water around it, so what a predator removes is scaled up by ${DEFAULT_TUNING.fishScale} from what the shoal loses. The fish are not saved; like every animal here they regrow from the seed.</p>${fishNumbers()}`,
      },
      {
        id: 'birds',
        title: 'The birds are in it too',
        html: `<p>The birds (see the <a href="birds.html">birds page</a>) are rows of the same table: four stages, an egg that is a nest (so nest sites limit them), nestlings that eat insects, adults that eat insects, seed and fruit, or frogs, lizards, fish and other birds, at a metabolic rate of 8 against a reptile's 5 (<code>needOf</code>). Taxon <code>Bird</code> is a prey kind like any other, so raptors, crows, gulls, storks and big snakes and crocodiles can eat them, and crows, gulls and the egg-eating snakes take their eggs. Migrants (see the birds page) also move between patches by the season's temperature. Adding the first twenty moved the rest of the web: wall lizards fell to a tenth of what they were (kestrels, crows and storks), frogs and toads rose (fewer insects left for the lizards) and the big snakes, now with birds to eat, grew by two to four times.</p>`,
      },
      {
        id: 'limits',
        title: 'What is tuned, and what is not true yet',
        html: `<ul>
<li><b>Nothing of this is saved.</b> A saved game rebuilds the animals from the seed and settles them for a couple of years before the first frame, so a long game does not keep its own history.</li>
<li><b>Mammals do not exist.</b> The <i>game</i> stand-in and the insect predators that are not drawn (spiders) are folded into base rates. Birds do not migrate on a schedule: the cold removes them and dispersal refills the patch.</li>
<li><b>Constants that set the balance</b> are in <code>DEFAULT_TUNING</code>: how hungry animals are (${DEFAULT_TUNING.hunger}), how much of what is eaten becomes young (${DEFAULT_TUNING.efficiency}), how many plants there are for the small and the large (${DEFAULT_TUNING.plantSmall} and ${DEFAULT_TUNING.plantLarge} kg a patch a year), the insect density multiplier (${DEFAULT_TUNING.insectDensity}). <code>npm run foodweb</code> runs the model headless and prints every species' trend, <code>TUNE='{"hunger":0.7}'</code> overrides them, and <code>DIAG=komodo</code> prints what the best patches offer a species.</li>
<li><b>Small prey and large predators are limited by different things</b>: small animals by food (their numbers follow the insects), big ones by ground (a crocodile's territory), and the middle by who eats them. Seeing a rare animal is meant to take looking.</li>
<li><b>A patch is ${PATCH_TILES} by ${PATCH_TILES} tiles.</b> What is drawn inside it is the patch's density spread over the places each species likes, so a frog sits by the water even though the patch holds a pond and a forest.</li>
</ul>
<p>${LIFE_COUNT} species are in the model.</p>`,
      },
    ],
  };
}
