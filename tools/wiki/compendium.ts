import { buildDiet, flowSlot } from '../../src/sim/fauna/diet.ts';
import { LIVES, Stage, STAGE_NAMES } from '../../src/sim/fauna/life.ts';
import type { Life } from '../../src/sim/fauna/life.ts';
import { FISH } from '../../src/sim/fish/species.ts';
import type { FishSpecies } from '../../src/sim/fish/species.ts';
import { ANIMALS } from './animals.ts';
import { foodWebRun, YEARS } from './foodWebRun.ts';

export type Fact = readonly [label: string, value: string];

export interface Entry {
  key: string;
  name: string;
  facts: readonly Fact[];
}

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const compendium = (entries: readonly Entry[]): string =>
  `<div class="cards">${entries
    .map((entry) => {
      const [latin, blurb] = ANIMALS[entry.key] ?? ['', ''];
      return `<article class="card" id="animal-${entry.key}">
<div class="plate"><img src="img/animals/${entry.key}.png" alt="${escape(entry.name)}" loading="lazy"></div>
<div class="body"><h3>${escape(entry.name)}${latin ? ` <i>${escape(latin)}</i>` : ''}</h3><p>${escape(blurb)}</p>
<dl>${entry.facts.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}</dl></div></article>`;
    })
    .join('')}</div>`;

const kg = (value: number): string => (value >= 100 ? `${Math.round(value)} kg` : value >= 1 ? `${value.toFixed(1)} kg` : value >= 0.01 ? `${(value * 1000).toFixed(0)} g` : `${(value * 1e6).toFixed(0)} mg`);

const metres = (value: number): string => (value >= 1 ? `${value.toFixed(1)} m` : `${Math.round(value * 100)} cm`);

const count = (value: number): string => (value >= 100 ? Math.round(value).toLocaleString('en') : value >= 1 ? value.toFixed(1) : value.toFixed(2));

const list = (names: readonly string[]): string => (names.length > 0 ? names.join(', ') : 'nothing in the model');

const CLOCK = (day: number, night: number, dusk: number): string => {
  const parts: string[] = [];
  if (day >= 0.6 && night < 0.4) parts.push('by day');
  else if (night >= 0.6 && day < 0.4) parts.push('by night');
  else if (day >= 0.4 && night >= 0.4) parts.push('day and night');
  else parts.push('mostly hidden');
  if (dusk >= 0.5) parts.push('best at dusk');
  return parts.join(', ');
};

export const clockText = CLOCK;

export const range = (r: readonly number[], unit = ' C'): string => `${r[1]} to ${r[2]}${unit}`;

interface Links {
  eats: Map<number, { name: string; weight: number }[]>;
  eatenBy: Map<number, { name: string; weight: number }[]>;
  fishEats: Map<number, { name: string; weight: number }[]>;
  fishEatenBy: Map<number, { name: string; weight: number }[]>;
}

let links: Links | null = null;

function web(): Links {
  if (links) return links;
  const diet = buildDiet();
  const run = foodWebRun();
  const last = run.samples[run.samples.length - 1]!;
  const eats = new Map<number, { name: string; weight: number }[]>();
  const eatenBy = new Map<number, { name: string; weight: number }[]>();
  const fishEats = new Map<number, { name: string; weight: number }[]>();
  const fishEatenBy = new Map<number, { name: string; weight: number }[]>();
  const push = (map: Map<number, { name: string; weight: number }[]>, key: number, name: string, weight: number): void => {
    const row = map.get(key) ?? [];
    row.push({ name, weight });
    map.set(key, row);
  };

  for (const life of LIVES) {
    const slot = flowSlot(life.index, Stage.Adult);
    for (let e = diet.flows.start[slot]!; e < diet.flows.start[slot + 1]!; e += 1) {
      const prey = LIVES[diet.flows.prey[e]!]!;
      const stage = diet.flows.stage[e]!;
      const label = stage === Stage.Adult ? prey.name : `${prey.name} ${STAGE_NAMES[stage]}s`;
      const weight = diet.flows.weight[e]!;
      const there = [last.eggs, last.hatchlings, last.juveniles, last.adults][stage]![prey.index]!;
      push(eats, life.index, label, weight * Math.log10(1 + there));
      if (stage === Stage.Adult && last.adults[life.index]! > 0.05) push(eatenBy, prey.index, life.name, weight * Math.log10(2 + last.adults[life.index]!));
    }
    for (let e = diet.fish.start[slot]!; e < diet.fish.start[slot + 1]!; e += 1) {
      const fish = FISH[diet.fish.prey[e]!]!;
      const weight = diet.fish.weight[e]!;
      push(eats, life.index, fish.name, weight * Math.log10(1 + last.fish[diet.fish.prey[e]!]!));
      if (last.adults[life.index]! > 0.05) push(fishEatenBy, diet.fish.prey[e]!, life.name, weight * Math.log10(2 + last.adults[life.index]!));
    }
  }
  FISH.forEach((species, id) => {
    for (const name of species.prey) {
      const prey = FISH.findIndex((other) => other.key === name);
      if (prey >= 0) {
        push(fishEats, id, FISH[prey]!.name, Math.log10(2 + last.fish[prey]!));
        push(fishEatenBy, prey, species.name, Math.log10(2 + last.fish[id]!));
      }
    }
    for (let e = diet.forage.start[id]!; e < diet.forage.start[id + 1]!; e += 1) {
      const prey = LIVES[diet.forage.prey[e]!]!;
      const stage = diet.forage.stage[e]!;
      const label = stage === Stage.Adult ? prey.name : `${prey.name} ${STAGE_NAMES[stage]}s`;
      const there = [last.eggs, last.hatchlings, last.juveniles, last.adults][stage]![prey.index]!;
      push(fishEats, id, label, diet.forage.weight[e]! * Math.log10(1 + there));
      if (stage !== Stage.Egg) push(eatenBy, prey.index, species.name, diet.forage.weight[e]! * Math.log10(2 + last.fish[id]!));
    }
  });
  links = { eats, eatenBy, fishEats, fishEatenBy };
  return links;
}

const top = (rows: readonly { name: string; weight: number }[] | undefined, n = 5): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of [...(rows ?? [])].sort((a, b) => b.weight - a.weight)) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    out.push(row.name);
    if (out.length >= n) break;
  }
  return out;
};

export function lifeFacts(life: Life): Fact[] {
  const { eats, eatenBy } = web();
  const run = foodWebRun();
  const last = run.samples[run.samples.length - 1]!;
  const plants = life.plant[2]!;
  const facts: Fact[] = [
    ['Mass', `${kg(life.mass[Stage.Adult]!)} (hatchling ${kg(life.mass[Stage.Hatchling]!)})`],
    ['Eats', list(top(eats.get(life.index))) + (plants > 0 ? `${eats.get(life.index)?.length ? ' and ' : ''}plants (${Math.round(plants * 100)}%)` : '')],
    ['Eaten by', list(top(eatenBy.get(life.index), 4))],
    [
      'Life cycle',
      `${life.live ? 'born live' : `egg ${kg(life.mass[Stage.Egg]!)}, hatches in ${life.incubation.toFixed(2)} yr`}; grown at ${life.mature.toFixed(2)} yr; lives about ${life.lifespan.toFixed(1)} yr; up to ${Math.max(1, Math.round(life.clutch * 0.5))} young a year a female`,
    ],
    ['Territory', `${Math.round(1 / life.density).toLocaleString('en')} m<sup>2</sup> an adult`],
    ['In this world', `${count(last.adults[life.index]!)} adults, ${count(last.juveniles[life.index]!)} juveniles, ${count(last.hatchlings[life.index]!)} hatchlings after ${YEARS} years`],
  ];
  return facts;
}

export function fishFacts(species: FishSpecies): Fact[] {
  const { fishEats, fishEatenBy } = web();
  const run = foodWebRun();
  const last = run.samples[run.samples.length - 1]!;
  const id = FISH.indexOf(species);
  return [
    ['Water', `${species.water === 'salt' ? 'sea' : 'fresh water'}, ${range(species.temperature)}, ${species.depth[1]} to ${species.depth[2]} m deep`],
    ['Size', `${metres(species.length)}, ${kg(species.mass)}, in schools of up to ${species.school}`],
    ['Eats', list(top(fishEats.get(id))) + (species.prey.length === 0 && species.forage.eats === 0 ? ' (plankton and what the water carries)' : '')],
    ['Eaten by', list(top(fishEatenBy.get(id), 5))],
    ['Spawns', `in water of ${range(species.spawn)}, eggs hatch into fry that grow up with the school`],
    ['In this world', `${count(last.fish[id]!)} fish after ${YEARS} years`],
  ];
}
