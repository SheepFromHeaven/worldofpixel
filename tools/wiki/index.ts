import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page, PageLink } from './page.ts';
import { fingerprint, readCache, writeCache } from './cache.ts';
import { render, renderIndex, stylesheet } from './page.ts';
import { build as amphibians, LINK as amphibiansLink } from './pages/amphibians.ts';
import { build as birds, LINK as birdsLink } from './pages/birds.ts';
import { build as climbing, LINK as climbingLink } from './pages/climbing.ts';
import { build as mammals, LINK as mammalsLink } from './pages/mammals.ts';
import { build as music, LINK as musicLink } from './pages/music.ts';
import { build as ecosystem, LINK as ecosystemLink } from './pages/ecosystem.ts';
import { build as geology, LINK as geologyLink } from './pages/geology.ts';
import { build as foodWeb, LINK as foodWebLink } from './pages/foodWeb.ts';
import { build as fish, LINK as fishLink } from './pages/fish.ts';
import { build as reptiles, LINK as reptilesLink } from './pages/reptiles.ts';
import { build as insects, LINK as insectsLink } from './pages/insects.ts';
import { build as plants, LINK as plantsLink } from './pages/plants.ts';
import { build as sunAndMoon, LINK as sunAndMoonLink } from './pages/sunAndMoon.ts';
import { build as weather, LINK as weatherLink } from './pages/weather.ts';
import { build as worldGeneration, LINK as worldGenerationLink } from './pages/worldGeneration.ts';
import { bundleMusicPlayer } from './musicBundle.ts';
import { build as worldScale, LINK as worldScaleLink } from './pages/worldScale.ts';
import { OUT } from './raster.ts';

const PAGES: readonly (readonly [PageLink, () => Page, string])[] = [
  [worldGenerationLink, worldGeneration, 'worldGeneration'],
  [geologyLink, geology, 'geology'],
  [worldScaleLink, worldScale, 'worldScale'],
  [ecosystemLink, ecosystem, 'ecosystem'],
  [plantsLink, plants, 'plants'],
  [climbingLink, climbing, 'climbing'],
  [insectsLink, insects, 'insects'],
  [fishLink, fish, 'fish'],
  [amphibiansLink, amphibians, 'amphibians'],
  [reptilesLink, reptiles, 'reptiles'],
  [birdsLink, birds, 'birds'],
  [mammalsLink, mammals, 'mammals'],
  [foodWebLink, foodWeb, 'foodWeb'],
  [weatherLink, weather, 'weather'],
  [sunAndMoonLink, sunAndMoon, 'sunAndMoon'],
  [musicLink, music, 'music'],
];

const links = PAGES.map(([link]) => link);
const flags = process.argv.slice(2).filter((one) => one.startsWith('--'));
const only = process.argv.slice(2).find((one) => !one.startsWith('--'));
const force = flags.includes('--force') || process.env.WIKI_FORCE === '1';
const seed = flags.includes('--seed');

if (only && !links.some((link) => link.slug === only)) {
  console.error(`no page "${only}", pages are: ${links.map((link) => link.slug).join(', ')}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const navigation = JSON.stringify(links);
const cache = readCache();
let rebuilt = 0;
let skipped = 0;

for (const [link, build, file] of PAGES) {
  if (only && only !== link.slug) continue;
  const stamp = fingerprint(resolve(import.meta.dirname, 'pages', `${file}.ts`), navigation);
  if (seed) {
    cache[link.slug] = stamp;
    continue;
  }
  if (!only && !force && cache[link.slug] === stamp && existsSync(join(OUT, `${link.slug}.html`))) {
    skipped += 1;
    console.log(`${link.slug.padEnd(18)} unchanged`);
    continue;
  }
  const started = performance.now();
  const page = build();
  writeFileSync(join(OUT, `${link.slug}.html`), render(page, links));
  if (page.script) await bundleMusicPlayer(OUT);
  cache[link.slug] = stamp;
  rebuilt += 1;
  console.log(`${link.slug.padEnd(18)} ${(performance.now() - started).toFixed(0)}ms`);
}

writeCache(cache);
if (seed) console.log(`recorded ${links.length} pages as up to date`);
else console.log(`${rebuilt} rebuilt, ${skipped} unchanged`);

writeFileSync(join(OUT, 'index.html'), renderIndex(links));
writeFileSync(join(OUT, 'wiki.css'), stylesheet());
