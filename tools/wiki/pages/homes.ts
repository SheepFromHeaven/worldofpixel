import { behaviourOf, MIGRATED } from '../../../src/animals/catalogue.ts';
import { BUILT_AT, HomeKind, JOIN_RADIUS_METRES } from '../../../src/sim/homes/homes.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, flow, table } from '../page.ts';

export const LINK: PageLink = {
  slug: 'homes',
  title: 'Homes',
  summary: 'A burrow, a nest or a mound is a thing in the world, built by the animals that live in it, kept in the save and drawn on the ground.',
};

const rows = (): string[][] =>
  [...MIGRATED]
    .sort()
    .flatMap((key) => {
      const home = behaviourOf(key)?.home;
      return home ? [[key, Object.entries(HomeKind).find(([, value]) => value === home.kind)?.[0] ?? '?', `${home.days} days`]] : [];
    });

export function build(): Page {
  return {
    ...LINK,
    lede: 'An animal that lives somewhere has somewhere to live. The rabbit has a warren, and the warren is a thing: it has a place, an owner species, a size and an age, it is in the save, the tile under it can be asked about, and a rabbit that finds none of its own builds one. Burrows are first. Nests and mounds come next on the same list.',
    code: ['src/sim/homes/homes.ts', 'src/sim/animals/animals.ts', 'src/render/lit/homePass.ts', 'src/render/lit/shaders/homes.vert', 'src/render/lit/shaders/homes.frag'],
    sections: [
      {
        id: 'entity',
        title: 'A home is an entity',
        html: `${flow([
          { title: 'Place', text: 'Seven numbers on a packed list (<code>Homes</code> in <code>sim/homes/homes.ts</code>, up to 4096): kind (burrow, nest, ant hill, termite mound), the species that owns it, x and y in metres, the game day it was started, the days it takes to build and how many entrances it has.' },
          { title: 'Settling', text: `When a group of an animal that has a home habit (<code>dwells({ kind, days })</code> in its behaviour) is made, it looks for a home of its own kind and species within ${JOIN_RADIUS_METRES} m of where it stands and joins it, or starts a new one at that spot. A home grows an entrance for every two animals that have settled in it, at most eight.` },
          { title: 'Building', text: `A home is not finished when it is started: its progress is the game days since then over its build days, worked out on demand, so it keeps on whether anyone is looking or not. Below ${BUILT_AT} it is a scrape of loosened earth, then the hole opens and the mound rises. An animal that is startled runs for its home and hides only if it is built, otherwise it just runs.` },
          { title: 'Saved and mirrored', text: 'The list is in the save (<code>WorldState.homes</code>) and goes to the main thread with the world delta whenever it changes, like the fires and the plans.' },
        ])}
${callout('<p><b>Not done yet:</b> nests (a bird builds in a tree for days before the eggs), ant hills and termite mounds (still drawn from the habitat, not from a home), a home limiting how many animals a patch can hold, abandoning and digging out, the tile sheet and what people can do to a home.</p>')}`,
      },
      {
        id: 'drawn',
        title: 'How it is drawn',
        html: `<p>A home is a model like any animal (<code>src/animals/burrow/</code>, the <code>home</code> group): a terraced earth dome with a flat scrape under it, drawn by a pass of its own (<code>HomePass</code>, <code>homes.vert</code> and <code>homes.frag</code>) in the same three-quarter view as the mammals and snapped to the pixel grid. The build progress is the model's <code>grow</code>: below 0.15 only the scrape, then the dome rises in three steps, and from half built each entrance is a dark hole with a rim on its slope, one per entrance up to eight (the entrance count is the model's state). The mammal pass no longer draws its own mound in the game (the sheet and the zoo, which have no world, still do). <code>npm run animal -- homes</code> draws a chart of built against entrances; the nest, the ant hill and the termite mound will be a model each.</p>`,
      },
      {
        id: 'table',
        title: 'Who has a home',
        html: `${table(['Animal', 'Kind', 'Builds in'], rows())}`,
      },
    ],
  };
}
