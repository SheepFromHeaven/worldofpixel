import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, PageLink } from './page.ts';
import { render, renderIndex, stylesheet } from './page.ts';
import { build as amphibians, LINK as amphibiansLink } from './pages/amphibians.ts';
import { build as birds, LINK as birdsLink } from './pages/birds.ts';
import { build as mammals, LINK as mammalsLink } from './pages/mammals.ts';
import { build as ecosystem, LINK as ecosystemLink } from './pages/ecosystem.ts';
import { build as foodWeb, LINK as foodWebLink } from './pages/foodWeb.ts';
import { build as fish, LINK as fishLink } from './pages/fish.ts';
import { build as reptiles, LINK as reptilesLink } from './pages/reptiles.ts';
import { build as insects, LINK as insectsLink } from './pages/insects.ts';
import { build as plants, LINK as plantsLink } from './pages/plants.ts';
import { build as sunAndMoon, LINK as sunAndMoonLink } from './pages/sunAndMoon.ts';
import { build as weather, LINK as weatherLink } from './pages/weather.ts';
import { build as worldGeneration, LINK as worldGenerationLink } from './pages/worldGeneration.ts';
import { OUT } from './raster.ts';

const PAGES: readonly (readonly [PageLink, () => Page])[] = [
  [worldGenerationLink, worldGeneration],
  [ecosystemLink, ecosystem],
  [plantsLink, plants],
  [insectsLink, insects],
  [fishLink, fish],
  [amphibiansLink, amphibians],
  [reptilesLink, reptiles],
  [birdsLink, birds],
  [mammalsLink, mammals],
  [foodWebLink, foodWeb],
  [weatherLink, weather],
  [sunAndMoonLink, sunAndMoon],
];

const links = PAGES.map(([link]) => link);
const only = process.argv[2];

if (only && !links.some((link) => link.slug === only)) {
  console.error(`no page "${only}", pages are: ${links.map((link) => link.slug).join(', ')}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

for (const [link, build] of PAGES) {
  if (only && only !== link.slug) continue;
  const started = performance.now();
  writeFileSync(join(OUT, `${link.slug}.html`), render(build(), links));
  console.log(`${link.slug.padEnd(18)} ${(performance.now() - started).toFixed(0)}ms`);
}

writeFileSync(join(OUT, 'index.html'), renderIndex(links));
writeFileSync(join(OUT, 'wiki.css'), stylesheet());
