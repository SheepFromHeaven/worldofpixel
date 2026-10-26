# Scribble Empire — working notes

This is the **foundation branch**. The settlement game — buildings, carriers, recipes, the book,
the chapter, claims, dispatch, needs — was taken out whole and lives on `main` at `c18a294`. What
is here is the ground it will be rebuilt on: a square metre-scale tile world, generated from a
seed, painted in pixels, and inspectable a tile at a time. `README.md` still describes the old
design and has not been rewritten; trust this file over it until it is.

## Commands

```
npm run typecheck      # tsc --noEmit, strict, covers .ts and .tsx
npm run sprites        # bakes sprite tiles into public/tiles
npm run ui             # bakes the HUD's font, icons and plates into public/ui
npm run ground         # bakes the ground's textures, masks and decals into public/ground
npm run props          # bakes every lit prop's albedo and normal sheets into public/props
npm run ground:preview -- <textures|decals|scene|seams> <out.png>
npm run terrain [seed] [x] [y] [span]   # every rung over one patch of ground, to /tmp/tiers.png
npm run wiki [page]    # the systems wiki: docs/wiki/*.html, graphs and maps drawn by running the sim (about 20 s)
npm run dev            # the game at http://localhost:5173
npm run build          # typecheck + vite build
```

Both `package-lock.json` and `pnpm-lock.yaml` are committed; the scripts run the same either way.


## Where the code lives

**`tools/wiki/`** writes the systems wiki into `docs/wiki/` (committed, open `index.html`): one file per page in `pages/` (`worldGeneration`, `ecosystem`, `plants` with the species encyclopedia from `encyclopedia.ts`, `insects`, `fish`, `amphibians`, `reptiles`, `birds` (each with a compendium of its animals: cards from `compendium.ts`, text in `animals.ts`, pictures in `docs/wiki/img/animals/`, which `npm run wiki` does not draw: run `tools/animalPlates.js` (birds: `tools/birdPlates.js`, perched and in flight) through the dev page's `import()` in a visible browser tab, it renders amphibians and reptiles with the real fragment shaders and the insects and fish as pixel art, returns every plate as a data URL, and the tight crop is done afterwards), `foodWeb` (runs the food web headless, `foodWebRun.ts`), `weather`, `sunAndMoon`), `svg.ts` for charts, `raster.ts` and `maps.ts` for maps, `page.ts` for layout and theme. A page calls the sim's own functions, so a changed curve changes its chart; rerun `npm run wiki` after touching a system it covers. **The wiki is part of the change, not a follow-up.** Every addition or change to a system a page covers (a new species or plant, a curve, a rule, a constant, a new per-tile array, a view mode) is written into that page in the same piece of work: a section, a chart or a line of prose that says what it is and why, and the wiki is regenerated before the work is called done. A system with no page yet gets one (`pages/`, then `LINK` and `build` and a line in `tools/wiki/index.ts`).

Look for the thing by its name; each is one class or one small module.

**`src/sim/weather/`**, one file per piece of weather, all driven by `Sky` (`sky.ts`):
`temperature.ts` (`Temperature`: heat by place, hour and season), `winds.ts` (`Winds`: the pressure field, the wind it
blows, gale), `pressureCentres.ts` (the highs and lows the wind map draws), `clouds.ts` (`Clouds`: vapour, cloud water,
lift, the kinds of cloud, how they form, rain out and are carried by the wind), `precipitation.ts` (`Precipitation`: rain,
snow, thunder, dust), `groundSurface.ts` (`GroundSurface`: wet ground and snow cover), `stormDamage.ts` (`StormDamage`:
trees felled), `lightning.ts` (`Lightning`: charge, bolts, strikes), `forcedWeather.ts` (what the sky panel forces),
`weatherTextures.ts` (the bytes the renderer reads), `weatherGrid.ts` and `weatherMath.ts` (shared helpers).

**`src/sim/fauna/`** is the food web (`life.ts` the species, `patches.ts` the habitat, `diet.ts` who eats whom, `fauna.ts` the model, `pack.ts` the wire format, `habitat/` the tile habitat for insects, amphibians and reptiles); `tools/foodweb.ts` and `tools/faunaWhere.ts` run it headless.

**`src/sim/`** besides: `astro.ts` (where the sun and the moon are, the date, the hemisphere's season), `calendar.ts`
(`Calendar`: time of day, days run, the season and the moon's phase), `seasons/` (`SeasonalPlant` and its subclasses:
`trees.ts`, `groundPlants.ts`; `seasonalRegistry.ts` builds the shader table).

**`src/render/lit/`**, one pass per file, all made by `createLitLayer` (`litLayer.ts`): `propPass.ts` (trees, bushes, marks
and their shadows, placed by `propPlacementCache.ts`), `groundGradePass.ts` (night, snow, fog, leaf litter over the
ground), `waterPass.ts` (lakes, sea and rivers, with `riverMesh.ts`), `fallingLeavesPass.ts`, `precipitationPass.ts`,
`cloudPass.ts` (clouds and lightning), `mapViewPass.ts` (height, heat, wind, zones, seasons). `weatherDataTextures.ts`
owns every texture the weather puts on the GPU and binds them for any pass; `lightningFlash.ts` follows the bolts;
`lighting.ts` and `skyGrid.ts` are the light of each place; GLSL lives in `shaders/` as real `.vert`, `.frag` and `.glsl` files (`weatherLibrary.glsl` is the part every pass
shares: the weather textures, the Bayer matrix and the noise; `skyPlaces.glsl` the light of each place). They are imported
as text (`?raw`) and put together by `shaders/shaderSources.ts`, which expands `#include "name.glsl"` lines and adds a
`#define` for every constant the TypeScript and the GLSL share (`MAX_POINTS`, `SKY_COLUMNS`, the texture ranges), so a number
is written once.

## Verification

There is no test framework and no test runner: `npm run typecheck` is the only automated check, and everything else is
looked at. The bake and preview scripts live in `tools/`. Changing a simulated system also means updating its wiki page and running `npm run wiki`; see `tools/wiki/` above.

**Look at what you change.** `npm run terrain` draws the
same patch of ground at all nine rungs side by side, magnified to one size; framed that way the
jumps between rungs are the only thing on the page, which is the whole point. A rung drawn at its
own extent is a pretty picture of somewhere else and hides exactly the bugs you are looking for.
For anything else, start the dev server and screenshot the layer you touched.

## The tile is the whole idea

**One tile is one square metre, and it is sixteen pixels across** (`TEXELS_PER_TILE`). Everything
else falls out of that: `TILE` is 1, a texel is 1/16 m, and a world is 2048 x 1408 tiles with a
64-tile skirt round it — about 3.3 million tiles.

**The terrain field *is* the tile grid.** There is no second resolution and no resampling: the
heightmap, the flow routing, the climate and the biome table are all computed at one cell per
tile, and `world.biome[i]` is the answer for tile `i` with nothing in between. The Voronoi
parcel lattice that used to sit on top of the field is gone, and with it `cellsIn`, `siteOf`,
`parcelOf` and the whole business of two views of the same ground agreeing only approximately
where they met.

`TileGrid` (`sim/grid.ts`) is the one way in: `at(column,row)`, `atPoint(p)`, `centre(i)`,
`bounds(i)`, `within(bounds)`. Asking off the grid gives `NOWHERE` (-1) rather than clamping, so a
caller that forgot to check gets a visible wrong answer instead of a silent edge tile.

## Data-oriented, with handles over the top

**The data is flat typed arrays; the readable API is a lightweight proxy that owns no data.**
`World` (`sim/world.ts`) holds `biome`, `cover` and `wear` as parallel `Uint8Array`s indexed by
tile. `Tile` (`sim/tile.ts`) is a handle — a world reference and an index, nothing else — whose
getters and methods read and write straight through to those arrays. `tile.wear` *is*
`world.wear[i]`; there is no copy to fall out of step.

**Hot loops read the arrays; call sites use the handle.** The proxy exists so that code about
one tile reads as code about one tile. It is not for per-texel work: the painter walks
`world.biome` directly, because allocating a handle per texel would be millions of objects a
frame. If you find yourself constructing handles inside two nested loops, you want the array.

**A new per-tile fact is a new array on `World`, not a field on `Tile`.** Add the array, add a
getter to the handle.

## What a tile remembers

`cover` is what stands on it — bare, grass, scrub, bush, tree, boulder, fallen — derived from the plants on the tile (below). At generation the tile's eco score and the biome's affinity for each form decide what a tile *wants* (`sim/cover.ts`: `densitiesAt`, `placeOf`, clumped by noise so woods come out as woods). Nothing grows with its foot in water.

**`eco` is how well things grow on a tile** (`World.eco`, `Tile.eco`, 0 to 255, `sim/eco.ts`, derived from the field on every load and never saved): warmth, rain, a water table that decays over `WATER_TABLE_TILES` from fresh water, slope read over `SLOPE_REACH` 16 tiles (the field is too rough for anything shorter), a rock penalty at altitude and a soil noise, zero on water. `placeOf` takes it at generation: each form (tree, bush, scrub, boulder, grass) has a density curve over eco, scaled by the biome's `AFFINITY` for it, so a forest on poor ground thins out and a river runs a grove through a meadow or desert. **What stands on a tile is up to three plants with an age and a height** (`sim/plants/`, `Plants` on `World.plants`, parallel typed arrays per layer: `canopy`, `under`, `herb` species ids u8, age u16 in game days, height u8 stored as `(b/255)^2 * 64` m with stochastic rounding; `World.cover` is derived from them by `formOf` and only Boulder and Fallen are cover alone). **The catalogue is data** (`species.ts`, `SPECIES`, 46 entries: oak, birch, chestnut, apple, willow, pine, spruce, fir, cypress, olive, acacia, baobab, coconut and date palm, kapok, rainforest tree, fig; hawthorn, bramble, hazel, thorn scrub, maquis, heather, crowberry, juniper, sea buckthorn, saltbush, sage, tree fern, banana, grapevine, liana, bamboo, prickly pear, fern; meadow, savanna, steppe, tundra, dune, desert grass, moss, jungle floor, woodland herbs, sedge; a dead-tree snag): real height, years to 90% (`yearsTo90`), lifespan, mature age, shade tolerance, thirst, dispersal kernel and reach, and an optional fruit (kcal, ripe window). **Where it can live is a niche** (`niche.ts`): five trapezoids over temperature, rain (`field.wet`), altitude, salt spray (`exp(-distance to ocean / 5)`) and damp, multiplied into a fitness from lookup tables. **Growth is logistic in real units** (`growth.ts`, rate from `yearsTo90`, vigour `sqrt(fit) * min(lightResponse, waterFactor)`), the sprite stage follows height (`sapling`, `young`, `low`, `mid`, `high` at 15/35/60/100%+ of the species height). **Plants compete**: light is taken by taller crowns in a 5 x 5 patch (`SHADE_K`), water is a carrying capacity the stand shares (`WATER_CAPACITY`, drought hazard below `DROUGHT_BELOW`), hazards are `1 - exp(-h dt)`. **Seed comes from parents**: a tile is only seeded by a mature parent within its dispersal reach (gravity, wind biased by `bandStep`, animal, water) and only where the generator's `wants` form (`PlantEnvironment.wants`, from the old `cover.ts` roll) allows it, so the world relaxes toward its generated pattern. A dead tree may stand as a snag then rot. Each tile is swept once per `SWEEP_DAYS` 2 (`Plants.advance`, called by `Simulation`); **plants run `GROWTH_SPEED` 100 times faster than the calendar (`plants.ts`: a plant year is 0.32 game days, about 6 real minutes at 1x; `grown` is the exact logistic so a long sweep step is stable), since real-time growth was too slow for a game; fruit ripeness and seasons stay on the calendar**. **Fruit is food**: a mature plant has a crop in kcal ripe in a window of the local year (`Plants.ripeness`, southern flip), `fruitKcal` and `pick`, and an idle hungry person walks to the nearest ripe crop and eats up to `FULL_STOMACH_KCAL` 650 (`beginForage`, `Task.Forage`, `EntityState.Foraging`, `KCAL_PER_HUNGER` 6000). **Persistence**: only disturbed tiles are saved (`WorldState.plants`, 11-number tuples); natural drift is not saved and regenerates from the seed. A new per-tile plant array must be in `Ground`, `WorldDelta`, `drain`, `apply` and `link/transfer.ts`, since the sim runs in a worker and the main thread holds a mirror. **Art**: sprites are `tree.<art>.v<k>.<stage>` and `bush.<art>.v<k>.<stage>` (`Species.art`, `snowArt`), generated by `pixel/ground/flora.ts` (`TREE_ARTS`: parametrised `oak` for broadleaves, `pine` for conifers, `acacia` for flat crowns, `fronds` for palms; bushes in `pixel/ground/plants.ts`: `bush`, `vine`, `fronds`, `cactus`, `fern`), ground herbs as `herb.<art>` marks placed from `speciesAt(tile,'herb')` (`herbMarksOn`). A new species is a `make({...})` line and, if it needs a new look, a `TREE_ARTS` or `BUSHES` entry; `STOREYS` has five stages and `tools/props.ts` packs a 1024 wide sheet (keep its height under 4096). `describePlants` feeds the tile sheet. The wiki page is `tools/wiki/pages/plants.ts`.
**Water has plants too, and the current sorts them** (`sim/aquatic.ts`, `World.aqua` the kind on a water tile, `World.flow` the current of a river tile, both derived on every load and never saved, `Tile.aqua`, `Tile.flow`): `suitability` scores six plants (`Aqua`: reeds, lily, algae, seagrass, kelp, weed) from depth, `shore` distance (`sim/distance.ts`, `distanceFrom`, also what eco's water table uses), temperature, salt and current, the best one wins the tile through a per-plant patch noise and a roll against its score. Depth is a shelf profile (`SHELF_METRES_PER_TILE` from the shore) capped by the real depth, because the field is too rough tile to tile. **The current is the speed the river mesh draws** (`flowSpeedFor`, shared with `riverMesh.ts`, from how steeply a reach falls, stored as a byte on every river tile): still water takes lilies and algae, a gentle bank takes reeds, a moving river takes streaming weed, and rapids take nothing. Reeds and lilies are fresh-water plants; seagrass takes the warm shelf and kelp the colder, deeper water. They are `aqua.<kind>.v<n>` marks with no density (`aquaticIn` in `render/groundSprites.ts` places them from `world.aqua`, `propPlacementCache` adds them to the ground marks), lilies and algae use the flower season so they are only in leaf in the warm half of the year, and reeds and weed dry like grass. View 6 **eco** draws it, and `tools/ecoPreview.ts` dumps a whole map. **Wear fades on the same clock** (`World.fade(days)`, one sweep every `FADE_SWEEP_DAYS` 0.25, minus one wear a sweep, skipping storage, floors, fires, embers and torches, and stamping the block when the path art would change), so a trodden path grows over once people stop using it, and `World.tread` turns grass and scrub to bare at `PATH_WEAR` 64. `wear` is how trodden the ground is,
0 to 255.

**Fish are shoals, not individuals** (`sim/fish/`, `Fish` on `Simulation.fish`, wiki page `tools/wiki/pages/fish.ts`): a shoal is a slot in `Shoals` (`shoals.ts`, typed arrays `posX`, `posY`, `heading`, `species`, `size` as headcount, `depth`; capacity 12288), the catalogue is `FISH` in `species.ts` (minnow, perch, carp, trout, pike in fresh water; herring, mackerel, flatfish, cod, tuna in the sea; real length, mass, school size, trapezoid niches over temperature, depth, current and shore distance, liked water plants, prey, `common` weight). `World.depth` (decimetres) and `World.shore` come from `aquaticFor` beside `aqua` and `flow`, so both threads have them. **A species scores a water tile `Fish.fitness`** (0 to 1, zero on the wrong kind of water), a shoal re-aims every 0.7 to 1.9 s by probing nine headings 3.5 tiles ahead and never enters a tile of fitness 0 (`swim`), and **every `ECO_DAYS` 0.05 game days `ecology` runs**: predators take at most 8% of a prey shoal within 14 tiles (`hunt`, `MAX_PREY_SHARE`), a shoal grows logistically toward `school * fitness` (`vigour` falls with hunger), splits over 1.7 schools, dies under 1 fish, and 16 random tiles a step may get a stray shoal (`recolonise`). A species also needs room: `fitness` is scaled by the share of water within 3 tiles (`roomAround`) against a need that grows with fish length, so a big fish does not live in a pond. A start places each species by `fitness * common` on a jittered 10 tile grid and on a tenth of river tiles, sea only within 60 tiles of land. Temperature is 70% annual tile mean and 30% the air now (`WATER_FOLLOWS_YEAR`). **Fish are not saved**: they regenerate from the seed on load, so anything that kills fish later must save `Shoals` and the float headcounts. The worker sends `Frame.fish` every third frame (`FISH_EVERY`) and the `Replica` interpolates. **They are drawn as shadows under the water** (`render/lit/fishPass.ts`, `fishInstances.ts`, `shaders/fish.vert` and `fish.frag`, drawn after `waterPass` and before the grade pass): up to 14 fish per shoal from strip zoom 9, a dithered blob below that, both only on pixels the ground painter coloured as water (`uGround`), shadow length 1.3 times the real length and at least 0.16 m, each fish facing along its own path (the half second either side of now) and bowing its body into a turn as an arc of the path's curvature (turn angle over distance covered, times `BEND_GAIN` 2, in `fishInstances`, carried in the look's third float, `BLOB_FLAG` 10 marking a blob) so it arcs round instead of spinning on the spot; **fish keep their own hours** (`FishSpecies.day`, `night`, `dusk`, `activityOf`, floor `MIN_ACTIVITY` 0.1: the activity mixes day and night by the local daylight at the shoal, `FishEnvironment.daylightAt`, refreshed each time it re-aims, plus a bonus of `dusk` at dawn and dusk; minnow and perch sleep at night, carp, cod, flatfish and herring are most active in the dark, pike and trout at dusk), and it scales the shoal's drift in `swim`, and in the renderer (which reads `Lighting.daylight`) the darts, the weave and the shadow's strength; **fish move like fish**: a shoal drifts at `GLIDE` 0.45 of the species' cruise, and each fish glides with a gentle weave plus darts (`FishSpecies.dart`: `period`, `chance`, body `lengths`, `seconds`; `dartOffset` in `fishInstances.ts` sums the last four darts, each a fast ease-out that then decays back toward the shoal, all a pure function of the clock) with the tail beat strength following its speed (`aLook.w`), fainter with depth, by night and under ice, the shape a signed distance with a swinging tail in the fragment shader (no sprite sheet), its edge faded through the Bayer dither rather than cut (`soft` in `fish.frag`). People do not fish yet. **Fish have eggs and fry, and are part of the food web** (`Fish.eggs`, `Fish.fry`, per shoal): a shoal lays eggs in its `spawn` temperature range in proportion to the positive part of its logistic growth times `LAY_FACTOR` (the inverse of the egg and fry survival, about 1 in 5), eggs hatch at `rate / INCUBATION_PER_RATE`, fry mature at `rate / FRY_PER_RATE` into `size`, and fry (a twentieth of an adult's mass) are prey in `hunt` along with the shoal; the adult dies of `replacement` (the old base mortality) plus any overshoot. `Fish.measure` and `ledger` write each patch's fish biomass per species into `Fauna.fishBio` and apply what the reptiles took (`Fauna.fishTake`) to the shoals in that patch; a shoal that forages (`FishSpecies.forage`: minnow, perch, carp, trout, pike) takes insects, tadpoles and spawn through `Fauna.forage`, at most `FISH_FORAGE_SHARE` of a stock a step.

**Insects are a field to draw and a stock to keep, never agents** (`sim/insects/species.ts`, `sim/fauna/habitat/insectHabitat.ts`, `render/lit/insectPass.ts`, `shaders/insects.vert` and `.frag`, wiki page `insects.ts`): no individual insect is simulated, stored, saved or sent from the worker, but each species (12 of the 14 rows: the two mounds follow the ant and the termite) is a stock of eggs, larvae and adults in every food-web patch (`sim/fauna/`, below) that eats plants or other insects and is eaten, and the pass scales its slots by how full the patch is (`faunaFill` in `fauna.glsl`: adults over `Fauna.capacity`, byte `FILL_SCALE` 170 for 1, in the R channel of the fauna texture). `habitatAt(world, column, row)` gives four numbers per tile (nectar from the flower patch grain by biome plus fruiting shrubs, foliage from cover, water from damp and water tiles, ground from bare cover and wear), built by `HabitatTexture` (`render/lit/habitatTexture.ts`, shared with the amphibians and reptiles, which pass their own sampler) as an RGBA8 world-sized texture a 16 row band per frame, nearest the camera first, rebuilt every 20 s at most when `world.revision` moves. Each `InsectSpecies` (`INSECTS`: honey bee, bumblebee, butterfly, moth, dragonfly, midge, firefly, ant and its hill, termite and its mound, beetle, grasshopper, water strider, fly; spiders are not drawn) has `likes` (a weight on each habitat number), trapezoids over temperature and over the year, `day`/`night`/`dusk` activity, a `wind` limit (measured as `WIND_SHELTER` 0.4 of the texture's wind vector), a `rain` sensitivity, a `slots` count, a `motion` (`Motion`: hover-hop, flutter, skim, swarm, glow, trail, crawl, hop, web, buzz) and a colour. `abundance(species, habitat, weather)` in TypeScript is the product and **the shader repeats the same formula** (`density` in `insects.vert`, times the fill), so change both together; the wiki calls the TypeScript one. **The pass** draws instanced quads: the world is cut into `INSECT_CELL_TILES` 4 m cells, each cell has `INSECT_SLOTS.length` slots (the species' slot counts laid end to end), a slot is awake when its hash of cell and slot is below the abundance at its home point (faded over 0.12), and where it is and which way it faces is a closed-form function of the clock and the slot hash, so there is no state, and a swarm shares a cell centre and a trail shares a nest and a food point. Bodies are sorted with the props (see the animals paragraph in the lit layer): **ground** insects (ants, beetles, spiders) have height 0 so any plant covers them, **air** insects `AIR_HEIGHT` 8 so they are over everything; only the strider's ripple is an underlay (`uLayer`, `UNDERLAY` or `SORTED_WITH_PROPS`, switched off by `litSkip = ['insects']`). **An insect is one chunky pixel** (2 x 2 buffer pixels, snapped to the 2 pixel grid) in its species colour, with no shape, no shadow and no real size, and **nothing is drawn below zoom `INSECTS_FROM_ZOOM` 30** (the strip's unit, which is what the layer's `view.zoom` is in); the species differ in colour and in how they move (a dragonfly or bee holds a station and then darts to the next, a firefly is a pixel that blinks inside a dithered glow, a water strider holds a spot on the water and glides to the next 5 to 10 times a game day, leaving a ring ripple, and startling at a click: a click on water, which throws a ripple with or without a tool, is pushed onto `uClick` (the last `INSECT_CLICKS` 16, oldest first, fed by `LitLayer.throwRipple`), and every strider within `JUMP_NOTICE` 1 m of where it stands at that click (its scheduled place from `strideAt` plus the jumps before) hops 1 to 2 m away over `JUMP_SECONDS` 0.3, each jump a hashed direction and length added to its position and easing off over `JUMP_MEMORY` 180 s so repeated clicks chain and nothing snaps back, each landing a ripple of its own), and there are 2 to 8 slots per cell per species for flyers and crawlers, with the colonies as the exception. **Colonies**: ants and termites (`Motion.Colony`, 400 and 300 slots, so a colony is a black wiggling mass) never stop: each member drifts slowly round the nest on a sum of three sines of its own speed and phase (no stand and run phases, so nothing is rhythmic) plus a stepped 2 pixel jitter, spread thicker near the mound out to about `0.4 + 30 * length` m, and the mound (`Motion.Mound`, a faint sparsely dithered dark disc, `kind` 4, radius the row's `length`; an ant hill is needles and dry leaves, so nearly black) exists in a cell only when a cell-level hash is below `COLONY_SHARE` 0.4 times the habitat, temperature and season fit (and the fill), so the same cell always has the same hill and its ants are active only when `busy * calm * dry` allows; termites like bare, dry, vegetation-free ground, which is the desert and the deadlands. The slot's species is found in the shader from `uSlotStart` (cumulative slot counts, `INSECT_STARTS`) because a per-slot table of 700 would overflow the uniforms. **Second instance**: each slot has a second instance (`gl_InstanceID & 1`) only for fireflies (a 12 pixel dithered halo scaled by the blink) and water striders (an expanding ring from where it last stopped, `RIPPLE_SECONDS` 2.4, drawn only on pixels the painter coloured as water through `uGround`, and in the ground layer, under the water plants, while the strider itself is in the air layer). **A new species is a row in `INSECTS`** and a block in `INSECT_BIO` in `sim/fauna/life.ts` (and a `Motion` only if it moves unlike any of the ten). The wind in the texture is the raw wind field and can be 30 m/s in a gale, which clears the air of everything but ants, which is correct.

**Amphibians are drawn from the food web, with a life cycle** (`sim/amphibians/species.ts`, `sim/fauna/habitat/amphibianHabitat.ts`, `render/lit/amphibianPass.ts`, `shaders/amphibians.vert` and `.frag`, wiki page `amphibians.ts`): no animal is simulated, stored, saved or sent from the worker, but the numbers drawn are the eggs, tadpoles, froglets and adults the food web keeps in each patch. `amphibianHabitatAt` gives four numbers per tile (pond: fresh, still, shallow, planted water; shelter: cover, with logs and boulders best; damp: `world.damp`; bank: fresh water within 3 and 6 tiles), built by `HabitatTexture` with NEAREST filtering so water-or-land is exact; a water tile carries `WATER_FLAG` plus its pond quality and the ocean only the flag, which is how the shader tells water from land. Each `AmphibianSpecies` (`AMPHIBIANS`: common frog, common toad, pool frog, tree frog, fire salamander, smooth newt, marine toad, poison dart frog, wood frog, spadefoot toad) has `likes` over the four numbers plus a `bias`, trapezoids over temperature and year, `day`/`night`/`dusk`, `wet` (how much it waits for rain or wet ground, `dampness`), snow sends it under, and for the seven that breed a `clutch` (jelly clump or double string), a `spawn` and a `larva` window and a `water` temperature (the `water` range is the breeding temperature, `Life.breed`, the windows now only time the calling season, and what is spawn and what is tadpoles comes from the stocks). `abundance` in TypeScript is suitability times climate, kept for the wiki's habitat maps. **The pass** draws instanced quads over `AMPHIBIAN_CELL_TILES` 6 m cells, each with `AMPHIBIAN_SLOTS` slots (a species' adult slots then its `YOUNG_SLOTS` 8, two groups of `YOUNG_GROUP` 4): an adult slot is awake when its hash is under `faunaDensity` of the adults and froglets (R and G channels) times the cell area over the slot count, times `micro / suitMean` (the tile's own suitability against the patch mean, from the suit half of the fauna texture), the temperature trapezoid, the hour, `dampness` and snow, and is drawn at half size when its `key` falls in the froglet share; a young group is spawn or four tadpoles by whichever of `faunaDensity` of the eggs (A channel, per `EGGS_PER_CLUMP` 150) or the tadpoles (B channel) it passes, divided by the young-stage suitability (the share of calm pond in the patch) so the density in the water is the real one. An adult is a signed distance field evaluated at the world's own texel grid (not a sprite: `creature` in the fragment shader, `bodyTexels` 3.2 plus 30 per metre of length, one of 16 headings, five-step top-left light, an inked edge texel, spots, blotches or a stripe by a hash of the texel), tadpoles and spawn only on pixels the painter coloured as water. Frogs `Gait.Hop` (sit, then a 0.38 s hop with the body lifted up the screen and a shadow left behind), toads, newts and salamanders `Gait.Walk`; a spot on the wrong medium is replaced by home, a species with `likes[0]` over 0.3 can have its home on water and floats; **a click on water (`LitLayer.throwRipple`, `AmphibianPass.startle`) sends every hopper within 2 m away 0.9 to 1.8 m, remembered like the water striders'**; breeding frogs and toads call at night (a pulsing throat sac). Hoppers are sorted with the props by their hop height, tree frogs (`canopy`) at `CANOPY_HEIGHT` 6 so they are over everything, and tadpoles, spawn and shadows are underlays; nothing is drawn below zoom `AMPHIBIANS_FROM_ZOOM` 24; `litSkip = ['amphibians']` switches it off. **A new species is a `make({...})` row** and a block in `AMPHIBIAN_BIO` in `sim/fauna/life.ts`.
**Reptiles are drawn from the food web, for bodies big enough to be shapes** (`sim/reptiles/species.ts`, `sim/fauna/habitat/reptileHabitat.ts`, `render/lit/reptilePass.ts`, `shaders/reptiles.vert` and `.frag`, wiki page `reptiles.ts`): no animal is simulated, stored, saved or sent from the worker; the numbers drawn are the eggs, hatchlings, juveniles and adults the food web keeps. `reptileHabitatAt` gives four numbers per tile through `HabitatTexture` (NEAREST): **water** (0 on land, `SEA_WATER` 0.05 for ocean, `FRESH_WATER_FROM` 0.1 up to 1 for fresh water by stillness and depth, which is how the shader tells the three media apart), **cover** (shelter on land, plants on water), **warm** (open dry ground to bask on, shallows in water) and **bank** (fresh water within 3 and 6 tiles, or the sea at 0.8, on land; land nearby in water). Each `ReptileSpecies` (`REPTILES`, 37: grass snake, adder, western diamondback, sidewinder, spectacled and king cobra, black mamba, anaconda, reticulated python, coral snake, emerald tree boa, sea snake, slow worm; wall, green, house gecko, green and marine iguana, bearded dragon, thorny devil, blue-tongued skink, Komodo dragon, Nile monitor, basilisk; veiled and panther chameleon; pond slider, snapping, box, giant and desert tortoise, green sea turtle; alligator, Nile, saltwater and gharial crocodile, caiman) has a `realm` bitmask (`Realm`: land, fresh, sea; a slot whose home is on the wrong medium never wakes, except that a turtle or crocodilian nests on land), `likes` over the four numbers plus `bias`, trapezoids over temperature and year, `day`/`night`/`dusk`, `shy` (rain sends it under), `rest`, `speed`, `reach`, `skit` (the distance at which a click startles it, 0 stands its ground), a `Form` (snake, lizard, chameleon, turtle, crocodilian), a `Pattern`, a `Trait` bitmask (hood, rattle, tongue, blue tongue, crest, spikes, beard, camo, sidewind, plunge, flippers, dome) and body shape numbers (`girth`, `tail`, `legs`, `bulk`, `waves`); `common` is unused by the sim and the shader. **They are ectotherms**: in the sim a cold patch feeds and breeds them less (`act`) and a hard enough cold or heat kills (`tolerance`), and the shader still hides them from the same trapezoid and slows a cold one to 35% pace. `abundance` in TypeScript is suitability times climate, kept for the wiki's habitat maps. The species table reaches the shader as an RGBA32F texture (`REPTILE_TABLE_WIDTH` 12 texels a species, `tableRow`), because 37 x 12 vec4s is too much uniform space; the habitat and table use units 14 and 15 and the fauna texture 7, which other passes also use, so each pass must bind its own after `weather.bindTo`. **The pass** draws instanced quads over `REPTILE_CELL_TILES` 8 m cells with `REPTILE_SLOTS` slots and two instances a slot (the first a shadow, a ripple ring on water, or on land a **nest** (`kind` 6: a dark mound of vegetation for crocodilians and a sand scrape for turtles, with pale eggs, shown where `faunaDensity` of the eggs over the nest suitability says there are nests); the second the body), two cells of margin because a body can be 5 m long. A slot is awake when its hash is under `faunaDensity` of hatchlings, juveniles and adults times the cell area over the slot count, times `micro / suitMean`, the temperature, the hour, rain and snow, and is drawn at 0.22, 0.5 or 1 of adult size by where its `key` falls among the stages. **Bodies are drawn almost life size** (`bodyTexels` 3 plus 16 per metre of length) **as signed distance fields on the world's texel grid** (`snake`, `lizard`, `turtle` in the fragment shader; chameleons and crocodilians are the lizard function with other numbers): a snake is 22 capsules whose heading follows a sine wave fixed in the ground while the head moves through it (the phase is the distance travelled, so it follows its own track), relaxing at rest to an S or, for the big ones, a coil; a lizard has a tapering swinging tail and a diagonal-gait leg cycle; a turtle a Voronoi scute shell, a head that stretches and flippers or legs. `radiusAt` must never take `pow` of a sine that can be a hair below zero: it gave NaN and dropped most of every body, and a GLSL name like `total` must not be reused for a different type in `main`. **A click** (`ReptilePass.startle`, from `LitLayer.throwRipple`) sends each reptile within its `skit` to a point 0.7 to 1.3 times that far away at 3.5 times its pace, and species with `Plunge` scan nine directions for water and land there with a ring; the displacement eases back over 150 s. Animals on water are dithered 40% transparent and tinted except head, eyes and (crocodiles) back. Ground animals have height 0 so the props cover them, chameleons and the tree boa (`canopy`) are at `CANOPY_HEIGHT` 6 so they are over everything, and shadows, ripples and nests are underlays; nothing below zoom `REPTILES_FROM_ZOOM` 14; `litSkip = ['reptiles']`. **A new species is a `make({...})` row** and a block in `REPTILE_BIO` in `sim/fauna/life.ts`.

**Birds are drawn from the food web, and leave the ground** (`sim/birds/species.ts`, `sim/fauna/habitat/birdHabitat.ts`, `render/lit/birdPass.ts`, `shaders/birds.vert` and `.frag`, wiki page `birds.ts`): no bird is simulated, stored, saved or sent from the worker; the numbers drawn are the eggs, nestlings, fledglings and adults the food web keeps (`Taxon.Bird` 32, group `bird`, 35 species (songbirds, hawks, owls, eagles, vultures, waterfowl, sea birds, penguins, game birds and the flightless emu and ostrich), `BIRD_BIO` in `sim/fauna/life.ts`, need constant 8, replacement 4, egg mass `0.045 * mass^0.77`, nestling 0.4 of adult, territory `1 / (200 * mass^0.8 + 60)`; reptile eggEaters and big snakes, crocodilians, crows, gulls, storks, raptors have `B` in `eats`). `birdHabitatAt` gives four numbers per tile through `HabitatTexture` (NEAREST): **tree** (cover canopy, or 0.6 of the trees four tiles round), **open** (grass, bare, scrub), **water** (0 on land, `SEA_WATER` 0.05, `FRESH_WATER_FROM` 0.1 up to 1; the same convention as the reptiles, in the third channel) and **edge** (water near on land, land near on water). Each `BirdSpecies` has `likes` and a separate `nest` taste over those four (eggs and nestlings use `nest`, and live on land only), a `realm`, a `Gait` (`Perch` sits then flies a bowed leg, `Swoop` nearly always flying, `Soar` circles a drifting centre at height, `Float` paddles, `Walk` walks and flies only when startled), `rest`, `speed`, `reach`, `skit` (flush distance), `beat` (wing Hz), `altitude`, a `Pattern`, a `Trait` bitmask (crest, bill, neck, fork, hover, dive, flock, hook, plume), colours (body, accent, bill, eye) and shape numbers. `Flock` slots of one cell share leg timing and destinations. The table is a RGBA32F texture (`BIRD_TABLE_WIDTH` 11), habitat and table on units 14 and 15 like the reptiles. **The pass** draws two instances a slot over `BIRD_CELL_TILES` 10 m cells, three cells of margin: layer `GROUND` (before the props) draws the shadow (offset `0.14 + 0.34 * altitude` m down-right, never over water) or a ripple ring where a bird lands on or paddles over water, layer `AIR` (after the props and the insects) draws the body; `litSkip = ['birds']`; nothing below zoom `BIRDS_FROM_ZOOM` 10. Nestlings are not drawn; a fledgling is `FLEDGLING_SIZE` 0.62. **Bodies are signed distance fields on the texel grid** (`bird` in the fragment shader: ellipse body, head, bill, tail as fan, fork or plume, wings), with length `3 + 16 * length` texels and span `2 + 16 * span`; in flight the wings are a tapered capsule whose projected reach is `cos(angle)` of the beat, perched they are folded. **A click** (`BirdPass.startle`) flushes every bird within `skit` to a point `FLEE_FACTOR` 2.6 times that far away (trying three other headings if the landing is the wrong medium), where it stays about `STAY_AWAY` 24 s and flies back. **Migration is real, in the food web and on the map.** Each species has `migrant` 0 to 1 (`Life.migrant`): in `Fauna.disperse` a migrant's attraction to a patch is `(1 - m) + m * (MIGRATE_FLOOR + comfort)^MIGRATE_SHARP` (comfort is the temperature trapezoid at the patch's current climate, which includes the season) and its dispersal rate grows by `MIGRATE_BOOST * m * |comfort difference|`, so stocks flow toward warmth in autumn and back in spring and the cold kills any that stay. `tools/foodweb.ts` takes `SEASONS=1 MIGRANTS=swallow,goose WATCH=8` to print the north/tropics/south share through the year (swallows swing 0 to 30% in the north and 0 to 44% in the south); the wiki page's migration charts come from `tools/wiki/migrationRun.ts`. On the map (`birds.vert`): a migrant slot (the last `migrant * slots` of the species' slots, not flightless) is a **stream**: its cell column and slot hash into a journey of `MIGRATE_MIN_TILES` 180 to 320 m along the meridian toward the equator, a leave moment in `MIGRATE_LEAVE` 0.48 + `MIGRATE_SPREAD` 0.02 of the hemisphere's year phase (`uYear.x` north, `.y` south; the lattice, north or south, is the parity of the slot plus the column) and a return in `MIGRATE_RETURN` 0.02 + the spread. The flight takes `journey / max(speed, MIGRATE_CRUISE) / YEAR_SECONDS` of phase (`YEAR_SECONDS` is a shared define from `YEAR_LENGTH_IN_GAME_DAYS * DAY_SECONDS`, now exported from `calendar.ts`), so it is real-time and about half a minute at 1x; `away` 0 to 1 is how far along the winter leg it is and `progress` its eased form. **The identity lattice slides with the shift**: a bird is `cellId` with the row moved back by `floor(shift / CELL)`, so a view cell draws the bird that is in it now and every bird is drawn exactly once whatever its shift (a migrant whose anchor is in the other hemisphere than its lattice returns, which costs half the migrant slots). In flight (`transit`: away strictly between 0 and 1) it is high, fearless and fades its altitude to the ground at both ends; at rest it wanders round the summer or winter home with the ordinary movement. **Presence is the food web's answer at both ends**: `standingAt(p, ...)` is the old density block as a function, and a migrant mixes the one at the summer home and the one at the winter home by `progress`, with no floor, so a winter home fills as fast as the food web fills it. **Birds sort against the props by height**: a body's depth key is `depthKey(altitude * HEIGHT_PER_METRE 0.3, y)`, the props' own key (see the animals paragraph in the lit layer), so a bird hopping under a canopy is covered by it and a flyer above crosses over it, and one at a tree's height passes over a low tree and under a tall one. **Flightless** (`Trait.Flightless`: emu, ostrich, penguin) never leaves the ground and, startled, runs at the `altitude` field (used as run speed). **Fan** (peacock, turkey) opens the tail into a fan of eyespots for a spell (`display`, `vBody.w`). Species are drawn in `BIRD_TABLE_WIDTH` 12 texels. **The fauna texture is an atlas** (`FAUNA_ATLAS_ACROSS` 4 species wide, `FAUNA_ATLAS_DOWN` rows of tiles, each tile levels then suitability, `faunaUv` in `fauna.glsl`, `FaunaTexture.update` uploads one block a species) so the species count is no longer bounded by a texture height. **A new species is a `make({...})` row** and a block in `BIRD_BIO`.

**The food web keeps every insect, amphibian, reptile and bird (and, through the fish, every fish) alive, fed, breeding and eaten** (`sim/fauna/`, `Fauna` on `Simulation.fauna`, wiki page `tools/wiki/pages/foodWeb.ts`, `npm run foodweb`): the world is cut into patches of `PATCH_TILES` 16 tiles (136 x 96, the same cells as the weather), and for each of `LIFE_COUNT` species `Fauna.stock` holds `STAGES` 4 counts per patch (egg, hatchling, juvenile, adult; a tadpole is a hatchling and a froglet a juvenile; insects have no juvenile; live-bearers and the game stand-in skip the egg), laid out patch-major (`(patch * LIFE_COUNT + id) * STAGES + stage`) for the cache. **Species are rows of data, never code** (`life.ts`, `LIVES`, built from `INSECTS`, `AMPHIBIANS`, `REPTILES` and a table of biology per species: `INSECT_BIO`, `AMPHIBIAN_BIO`, `REPTILE_BIO`; plus `game`, a 15 kg plant eater that stands in for the mammals that do not exist yet): masses per stage, `realm` per stage (land, fresh, sea), `eats` (a mask of `Taxon`), a prey-size window `preyMin`..`preyMax` relative to its own mass, `eggEater`, plant share per stage, lifespan, `mature`, `incubation`, `density` (the most adults a square metre holds: reptiles `1 / (300 * mass^0.6 + 1)`), and `clutch`, `eggLoss`, `youngLoss` **derived** from a survival target per group (`survivalOf`: replacement rate 8 for insects, 6 amphibians, 4 reptiles, 3 game; survival to maturity .15, .05, .25, .5) so a population with food and room grows about fourfold to eightfold a generation. **A year is `FAUNA_YEAR_DAYS` 1 game day** (the calendar's own year, 32 days, is far too slow to see a population move; breeding follows temperature, not the calendar). **Habitat** (`patches.ts`, `buildPatches`, `habitat/suitability.ts`) averages each species' tile suitability over 9 sample tiles a patch for adults and nests, and for the water-bound young (amphibian eggs and tadpoles, aquatic larvae) takes the exact share of calm pond and lake tiles. **Diet is derived** (`diet.ts`, `buildDiet`): every stage of every species is a prey of every predator whose `eats` mask, size window and medium (`contact`: same medium 1, land and fresh 0.25, land and sea 0.1) allow it, with a weight peaking mid-window, the 24 best edges kept (`MAX_EDGES`); a young reptile or amphibian that is a carnivore also eats insects. **Each tick, per patch** (`Fauna.step`): demand is `need * tf` per stage (`needOf`: `c * mass^0.67`, c 9 amphibians, 5 reptiles, 4 insects and game, times `Life.appetite` 0.3 for snakes to 1 for small lizards, times `tuning.hunger`; `tf` is 0.12 plus 0.88 of the temperature trapezoid, so a cold animal eats little); supply is the sum over prey of `weight * harvest * free biomass * switching`, where `free` is the stock less `REFUGE` 3% of its territory capacity and `switching` is `free / (free + SWITCH * capacity)` (a type III response, so rare prey is left alone), times `rangeGain` (a predator ranges over `sqrt(territory / patch)` patches, at most `MAX_RANGE_GAIN` 6, so its supply is the prey around it; what it removes still comes from this patch, because the gain cancels in `huntShare`), plus plants shared by demand between small and large herbivores (`plantSmall`, `plantLarge` kg a patch from `World.eco`); **intake is `FEED_MAX` 2 x supply / (supply + demand)**, below 0.9 of need starvation kills (`tuning.starve`), above 1 the surplus times `tuning.efficiency` becomes young, at most the clutch, times a breeding window and a nest factor; removals are collected per (prey, stage) and applied after every predator has decided (so order does not matter), capped at `MAX_TAKE` 60% of a stock. Updates are semi-implicit (`x' = (x + inflow) / (1 + rate dt)`), so any step is stable; **the stages move**: eggs hatch at `sqrt(act) / incubation`, hatchlings grow into juveniles over 0.35 and juveniles into adults over 0.65 of `mature`, scaled by how well they eat; adults die of `1 / lifespan`, hunger, crowding (`CROWD`, over the territory capacity), a patch with none of their habitat (`HABITAT_LOSS`) and cold or heat (`tolerance`). **Movement** is an ideal-free drift between neighbours toward suitability times how well fed (`disperse`, `DISPERSAL`, per species `roam`), juveniles at 0.4. **Time**: `Fauna.update` visits `rows * days / CYCLE_DAYS` rows a frame in round-robin (one full pass about every 6 s at 1x, under 1 ms a frame), each row's step being the time since it was last visited, never more than `tuning.maxStep`; `Fauna.sweep` does a whole pass at once (the spin-up, `FAUNA_SPIN_UP_SWEEPS` 8 of 0.25 days when a world is made, about 1.5 s, and every tool). **Seeding** (`Fauna.populate`) goes smallest species first and sets each eater to `seedFill` 4% of what its food estimates it can feed (`supplyEstimate`) so the first minutes show no mass die-off. **The sim reads a climate, not the weather**: `Simulation.refreshClimate` gives each weather cell `warmth + seasonal swing` with no daily swing (an animal shelters from the day, and a noon desert is not lethal), every 2 s, plus the weather's snow cover. **Fish** are the only thing not in `stock`: `Fish` fills `Fauna.fishBio` per patch and species (scaled by `tuning.fishScale` 25, because the visible shoals are a sample of the water's fish) and applies `Fauna.fishTake`, and its foragers call `Fauna.forage`. **Nothing is saved**: the animals regrow from the seed (and the seed's weather) on load. **To the screen** (`pack.ts`, `FaunaPacker`, `Frame.fauna`, `Replica.fauna`, `render/lit/faunaTexture.ts`, `shaders/fauna.glsl`): the worker packs one species a frame into a persistent buffer and ships the whole `LIFE_COUNT * patches * 4` bytes every `LIFE_COUNT` frames (adults, juveniles, hatchlings, eggs as `LEVEL_LOG_MIN`..`LEVEL_LOG_MAX` log densities per square metre, insects' adults as a fill ratio) with a static suitability block (adult, young, egg) sent once at the start; the renderer uploads it as one RGBA8 atlas texture (a tile a species, levels left and suitability right in the tile), sampled bilinearly in the vertex shaders through `faunaLevels`, `faunaSuits`, `faunaDensity`, `faunaFill`. **Tuning** is `DEFAULT_TUNING` (hunger 0.5, efficiency 0.3, starve 3, crowd 2, plantSmall 450, plantLarge 90, insectDensity 3, fishScale 25, fishAttack 1, seedFill 0.04, maxStep 0.05) and `TUNE='{"hunger":0.7}' npm run foodweb 20250214 16 0.25 30-66` overrides it on a cropped band of rows (`TREND=1` prints a table over time, `DIAG=komodo` what its best patches offer, `RHO=komodo` its intake by stage; use `"maxStep":0.3` with a 0.25 sweep). Results to keep in mind: small animals follow their food, big ones are held by territory, the top predators converge to a few animals in a thousand patches, and sea snakes live on mackerel because herring are half their mass.

**Wear fades round-robin, a band of tiles per call, never the whole array** (`World.fade(days)`, above). Three million tiles swept in one go is a frame spike for something nobody would notice happening gradually.

**Changing a tile stamps the coarse block it sits in** (`touch`, `BLOCK_TILES` of 64). The chunk
cache keys on `world.stampOver(bounds)`, so a chunk re-bakes when something inside it actually
changed, and the painter never rescans a chunk's tiles to find out. Without this, keying a chunk
meant reading its 65,536 tiles every frame.

## The first two

**Adam and Eve are packed arrays, not objects** (`sim/people/people.ts`, `People`): position, target, speed, state, hand, body
heat, stamina and the path are parallel typed arrays indexed by person, and `update` walks the indices. **A hand holds one
`ItemType` and nothing else**; anything dropped is a slot in `world.items` (`GroundItems`, `sim/people/groundItems.ts`), a
parallel `tile`/`kind` pair with a per-tile bucket for the stack. `Tile.stack` reads it.

**Commands are chosen by who is nearest and free** (`pickerFor`, `knapperFor`, `carrierFor`, `chopperFor`), and the radial
menu greys a slice with its reason when that returns `NOBODY`. Paths are a bounded A* (`path.ts`) over `World.passable` and
`World.pace`; pace is biome, cover, altitude, a clamped slope and trodden wear, and zero means water, a river or a boulder. **A river is not in the biome array, so `world.river` rasterises its ribbons once** (a tile within `half + BANK_TILES` of a segment) and `passable` reads it; rivers are therefore walls. The slope is
clamped on purpose: the field's finest octaves put tens of metres between neighbouring tiles, so a raw grade would pin everyone
to the slowest pace.

**Wander is a biased walk one neighbour at a time**: persistence, a pull toward the other person when they are far apart, and each weight scaled by pace. **They are unclothed, so heat is lost to the air whenever it is cooler than the skin** (`SKIN_CELSIUS` 33, `HEAT_LOSS_PER_DEGREE` a second per degree of the gap, there is no comfort threshold; clothing comes much later), and only a fire or torch, a huddle, exertion or air at skin heat gives it back. Below `BODY_TEMP_COLD` they walk to each other and huddle, which cuts the loss and adds warmth.

**Hunger, thirst and tiredness are 0 (fine) to 1 (worst) per person** (`People.hunger`, `thirst`, `tiredness`, advanced in `vitals`): hunger fills over about three game days, thirst over about one and faster in heat above 25 C, and both and the weariness run `NEED_EXERTION` times faster while walking; tiredness climbs while awake and falls while idle or huddled (`REST_RECOVERY_PER_SECOND`). They are separate from `stamina`, which is the short breath spent by walking. **Nothing yet eats, so hunger only climbs; they do drink and sleep, below.**

**People think, and the critical thoughts show as an exclamation mark** (`sim/people/thoughts.ts`: `thoughtsFor(people, person, surroundings)` is a pure function from the vitals, the held item, the nearest fire and mate, and the rain, snow and `gloom` at the person's cell, giving `Thought`s sorted by `Urgency`: `Critical` (freezing, starving, parched, exhausted), `Concern` (cold, hungry, thirsty, tired, winded, rain on the cold) and `Passing` (the fire, the dark, company, "all is well")). `Game.rethink` refreshes them every `THOUGHT_SECONDS` 0.5 of wall time in `advancePeople`; nothing is saved because they are derived. A person with any `Critical` thought (`Game.isAlarmed`) gets a bobbing pixel `!` over their head on the cursor canvas (`drawAlert` in `ui/tileCursor.ts`, a fixed two buffer pixels per art pixel so it stays legible at any zoom, normal view only), and `PersonSheet` lists every thought, the critical ones in amber. A new thought is a line in `thoughtsFor`.

**They keep to the light after dark and lie down beside it when tired** (`People.gloom`, refreshed every `GLOOM_REFRESH_SECONDS` from `PeopleEnvironment.gloomAt`; `PeopleEnvironment.lightNear` is the nearest fire or standing torch within 60 tiles, never a carried flame, and is `null` when there is none, in which case nothing below applies). When the gloom is over `DARK_GLOOM` 0.5, `beginWander` pulls toward that light once they are past `LIGHT_LEASH_TILES` 5 and refuses any step that goes farther out than the leash, and an idle person does not start hauling or a planned build. Tiredness over `SLEEPY` 0.6 with a light about, or over `COLLAPSE` 0.92 anywhere, sends an idle person to `EntityState.Sleeping`: `beginSleep` picks a passable spot `light.side` from the light (2.2 tiles from a fire, 1.2 from a torch, feet to the flame), `sleep` walks there, then they lie still (`People.isLying`, pose `lie` in `folkInstances`, baked in `pixel/ground/folk.ts`), tiredness falls `SLEEP_RECOVERY` 3 times faster than idling, and they wake at `WAKES` 0.08, or when the cold would huddle them, or when a command is given.

**Thirst sends them to fresh water** (`World.drinkable`: a river tile or a lake, never the sea; `shoreFor` scans 30 tiles round the person for the nearest passable tile with drinkable water beside it, and `waterBeside` finds the water from there). An idle person whose thirst is over `THIRSTY_ENOUGH` 0.45 (0.8 when they are sheltering by a light in the dark) walks there (`beginDrink`, `Task.Drink`), turns to the water, kneels in `EntityState.Drinking`, and thirst falls `DRINK_PER_SECOND` 0.1 a second until `QUENCHED` 0.04 or `DRINK_MAX_SECONDS` 20. It is checked before sleep in `rest`, and nothing is done if no shore is in reach. Rivers are walls and the bank is a band of impassable tiles, so the shore tile is the first passable one outside it.

**Storage is a tile fact, and it draws the people to it** (`world.storage`, `World.designate` / `release`, `storageTiles` in insertion order; the radial menu's `Designate Storage` / `Clear Storage`). **A storage tile holds one kind of thing, up to `STORAGE_CAPACITY` 32** (`World.storageAccepts(tile, kind)`: empty, or the kind already there, and not full); it is trodden to full wear, `fade` skips it, and it reads as beaten earth with four cord corners (`marker.storage`). When an idle person's timer runs out they haul with `HAUL_CHANCE`: a hand already holding something goes to the nearest tile that accepts its kind (`storageFor(person, kind)`), otherwise they walk to the nearest *loose single* item within `HAUL_REACH_TILES` whose kind some storage accepts and carry it there (`hauling`, `beginHaul`, `carryToStorage`); arriving at a storage that has meanwhile taken another kind sends them looking again, and `Bring Here` greys out for a storage holding something else. **A stack of two or more outside storage is never touched, because it is somebody's experiment (and `Experiment` is not offered on a storage tile), and a hand axe is never stored, because it is the thing in a hand that chops.**

**A resource keeps its real size, and a heap of it changes sprite as it grows** (`pixel/ground/folk.ts`, `item.<kind>.s0..s4`, drawn on a one-tile, 16 texel canvas): the sprite is picked by `stackStage(count)` in `sim/people/items.ts`, one stage per `STACK_STEP` 8, so a pile shows its single, small piece for 1 to 7, then a heap at 8, 16, 24 and 32 (5, 9, 14 and 20 pieces of the same size laid on a spiral, packing tighter and overlapping as they fill the tile, the way Dwarf Fortress piles logs and stones). `folkInstances` counts items per (tile, kind) every frame and draws one sprite for each; kinds that share a tile (an experiment's flint and stone) are pushed to its corners. What a person holds is the small art, `item.<kind>.held` (10 texels). `GroundItems` keeps no position within the tile any more: a slot is a tile and a kind, and persistence stores only those.

**Discovery happens on a knapping floor, in a close-up, by hand** (`sim/discovery/`). `Designate Knapping Floor` makes a tile fact like storage (`world.floor` / `world.floors`, `layFloor` / `unfloor`, saved, trodden, a ring of pebbles `marker.floor`) that holds any mix of up to `FLOOR_CAPACITY` 12 items; haulers neither take from it nor fill it, so what lies there is what the player brought. `Experiment` on a floor sends the nearest free person; on arrival they put down what they hold, kneel, and emit `'trial'`, and `Game.openTrial` builds a `Trial` from the floor's items and pauses the world (`setSpeed` is refused while a trial is open, and the save keeps the speed from before it). **The `Trial` is its own little simulation** (`trial.ts`, `piece.ts`): pieces at positions in floor space (0..1), one held piece, states `Plain`, `Smouldering`, `Burning`, `Ash`, a clock of its own (`advanceTrial`), and transient `effects` for the view. **Every pair reacts, so the hint never tells you which pair is the answer** (`reactionBetween` in `reactions.ts`, a verb and an effect for the held piece against the target): flint on flint strikes a bright spray that can set dry kindling within `SPARK_REACH` smouldering, flint on stone only a few dull sparks, a stone knocks a flint and three knocks shape it into a `HandAxe`, an axe chops a branch into kindling, anything hard pressed onto smouldering kindling smothers it, more kindling buys it `SMOULDER_FEED_SECONDS`, and a branch fed to it within `SMOULDER_SECONDS` catches and **becomes a burning branch** (the kindling is used up, the branch in the hand burns; a burning branch held to loose kindling lights that); left alone smouldering kindling goes to ash. A branch held to a burning piece becomes a `Torch`. **Nothing in a trial is real until it is left** (Escape or a right click, `Game.leaveTrial`): `Trial.commit` clears the floor, puts back every surviving piece as an item, puts a burning piece back on the floor as an `ItemType.BurningBranch` (it does not make a fire, and sets no fire knowledge) and sets `hasDiscoveredFlintKnapping` if an axe was made; ash and anything still smouldering are lost. The view is `ui/closeUp.ts`, drawn into its own canvas over the world (`se-closeup`, hidden when there is no trial) in buffer pixels. **The ground is the map's own**: `drawWorld` paints the floor's tile and its neighbours at `FLOOR_PIXELS` (176) to the metre from the same chunk cache, so the biome, the paths and the light colour are the ones on the map, with a fixed grain laid over it, the map's `BACKGROUND_DIM` (0.78) on the ground only, and the place's night tint; nothing marks out the floor in the close-up, because a knapping floor is a patch of ground and not a pen, and a piece can be put down anywhere in view (`SPILL` past the tile's edge) (`gloom` from `Game.lightingAt`) over everything. Every piece comes from the close-up sheet (`npm run closeup`, `pixel/ground/closeUp.ts`: the same item generators as the world, sampled at `CLOSE_UP_SCALE` 11, which is `FLOOR_PIXELS` over sixteen so a piece is its map size, with speckle damped and inked, plus ash). **The hands are painted from a distance field, not stamped from blobs** (`handShape` in `pixel/ground/closeUpMetrics.ts`, numbers only and shared by the bake and the view; `paintHand` in `pixel/ground/closeUp.ts`): the back of the hand is a polygon as long as it is wide (wrist to knuckles about the length of the middle finger, a bulge on the thumb side), each finger and the thumb a chain of tapering capsules, all smooth-unioned into one surface so the webs between them fill in. A height field is read off the depth (rounded to `FLESH_ROUNDING` at the rim, flat across the back, with soft knuckle bumps) and lit from the top-left in five skin steps with a light 2 x 2 dither, the same way the forearm is; where one digit lies over another (the thumb over the index, fingers meeting at the base) a dark line follows the upper one's edge, joints get a crease, and the open hand shows nails. The grip curls the fingers over the held piece far enough to reach past its far edge, and **the thumb is under the hand and the piece, so the grip shows only its knuckle**: seen from above a thumb pressing from below cannot be seen, and any long thumb drawn there reads as lying on top, but with no thumb at all the hand looks like it has none, so the grip carries a short stub (`tuck` in `handShape`) that is a rounded bump standing out from the thumb side of the palm at mid-hand. The view draws the piece at `shape.hold` (in the hollow of the curled fingers, just ahead of the knuckles) and then `hand.grip` over it, so the piece shows only where it pokes out past the index and the little finger. **The pointer is the top of the palm** (`shape.tip`, at the knuckle line, the same point in both poses so the hand does not jump when it closes), not a fingertip; a tapering, banded and dithered forearm runs from the sprite's wrist off the bottom edge at `HAND_TILT`. A piece answers to the pointer within its `reachOf` (0.11 to 0.18 of the floor), and the pieces are laid out on a jittered grid so they start apart. Hovering with something in hand prints the verb, without it the thing's name. **A burning branch is an item and a small emitter** (`ItemType.BurningBranch`, `BURNING_BRANCH` 2.6 x 0.3 heat and a 3.6 reach light, look `'hand'`; lying it is drawn as a branch with a flame at its tip, and `GroundItems.burningTiles` keeps the lying ones so `emittersIn` does not scan every slot). It can be picked up and carried (never auto-hauled or stored), and it does not burn out yet. **A campfire is built from a blueprint, the first of the building plans** (`world.plan` / `world.plans`, `Blueprint`, `World.planCampfire` / `unplan` / `isPlanned`, saved in `WorldState.plans`, drawn with the storage's four stick corners, `marker.plan`, but on untrodden ground): the radial menu's `Plan Campfire` is offered on any free, non-storage, non-tree tile with an igniter (a burning branch lying or held, or a campfire) within `IGNITER_REACH_TILES` (8) (`igniterNear`), and only records the request, so it needs no branches yet; a planned tile offers `Cancel Campfire Plan` (or `Cancel Relight`) instead (`Game.planCampfire`, `cancelPlan`, `People.abandonPlan`), and **a left click on it selects it like a person**, as it does any structure (below). **A left click selects a structure like a person** (`Game.selectAt`: a person within reach first, otherwise the tile under the pointer if `World.hasStructure` says a plan, fire, storage, knapping floor or standing torch is on it; `selectedStructure`, the same corner brackets, Escape clears it) and opens `StructureSheet` under the time controls, built by `structureAt` in `sim/people/structures.ts` and republished every 0.3 s: a plan shows progress, its builder and what it still needs, storage and a floor what they hold and how full, a lit campfire how much fuel it has left (as a word and a gauge), how long it will burn and how far it warms and lights now, a burnt one that it is out, a torch its reach. A new kind of structure is a branch in `structureAt` and a line in `hasStructure`. **Builders come to the plan**: the nearest person is sent at once (`People.sendToBuild`), and any idle person with empty hands or a branch takes an unclaimed plan when their rest timer runs out (`beginPlanned`, one builder per plan, so a plan stalled for want of branches or a flame is retried and picked up again after a huddle). The builder is driven by `buildTile` (a person column): `nextBuildStep` fetches the nearest loose branch, carries it to the site, repeats until `CAMPFIRE_BRANCHES` (3) lie there, then fetches the burning branch and carries it in, and `finishCampfire` uses up the branches and the burning branch, calls `World.kindle` with the fuel of the branches (which clears the plan) and sets `hasDiscoveredFire`, which earns the milestone. Any other order, a huddle or `idle` clears `buildTile`. **A campfire** (`world.fire`, `world.fires`) is cleared and trodden, **is not walkable** (`passable` is false on it, so people go round it), and is an emitter (`CAMPFIRE`, look `'fire'`, so `torchInstances` skips it and `folkInstances` draws `campfire.base` and a flame instead: `campfire.flame.<tier>.<frame>`, four frames at each of five tiers (`flameTier(fuel)` in `sim/sources/fuel.ts`, `blaze` in `pixel/ground/folk.ts`) that grow from a low red glow to a tall bright flame with sparks, so the fire shrinks and dulls as it runs out of fuel). **A campfire has a fuel level and burns out** (`sim/sources/fuel.ts`; `world.fuel`, a map from fire tile to fuel, `World.burn(seconds)` called each frame by `Game.advancePeople` with the speed applied, `BURN_PER_SECOND` 0.5, `FUEL_CAPACITY` 600): **every item has a `fuel` attribute** (`ITEM_FUEL` in `sim/people/items.ts`: branch 100, dry kindling 30, burning branch 80, torch 60, the rest 0; `fuelOf`), and `World.stoke` adds it when thrown in. The flame's level is `fireLevel(fuel)` (0.25 at none to 1 at `FULL_FLAME_FUEL` 300, 1.25 at most), and it scales the emitter: `Emitter.level` multiplies the warmth and the light's strength, and `reachScale` shrinks the reach, in `warmthFrom` and `Game.lightSources`. A built fire starts with the fuel of the three branches (300). At none it **burns out**: `fire` goes, the tile joins `world.embers` (`world.ember`, saved, drawn as `campfire.burnt`, charred logs and ash), it is walkable again, no longer an emitter, igniter or huddling place, and the camera still keeps it in view. **A burnt campfire is relit by a plan**: `Relight Campfire` (`Game.planRelight`, `World.planRelight`, `Blueprint.Relight`) sends builders for `RELIGHT_FLINT` 2 flint, one dry kindling and one branch (`PLAN_NEEDS`, which now drives `nextBuildStep` for both plans through `deficit` and `needed`), and `finishRelight` uses up the kindling and the branch, sets the two flints on a free tile beside it and calls `World.kindle` with the fuel of what was brought (130, a dim fire to start). **People keep a fire alight when they notice it**: an idle person (`beginFeed`, in `rest` after thirst and sleep, even in the dark) who sees a lit fire within `FEED_NOTICE_TILES` 20 below `LOW_FUEL` 150 takes the branch or kindling in their hand, or fetches the nearest loose one (`hauling` 2, never from a plan or a knapping floor, storage is fine), walks to the fire side (`Task.Feed`, `sideOf`) and throws it in (`EntityState.Feeding`, `FEED_SECONDS`), one feeder at a time; `Add Fuel` on a lit fire sends whoever holds a branch or kindling (`feederFor`, `sendToFeed`). When the cold would huddle them, **they walk to the nearest fire within 60 tiles and stand `FIRE_SIDE_TILES` from it** until warm, and only fall back on each other if there is none. **A torch is made at a fire, not placed by a tool**: the radial menu's `Light Torch` on a fire tile sends whoever holds a branch (`lighterFor`, `sendToLight`, `Task.Light`) to the nearest free tile beside it, where they stand `LIGHT_SECONDS` (`EntityState.Lighting`) and the branch in their hand becomes an `ItemType.Torch`; a held or lying torch is the stick with a charred head plus a `torch.flame.N` laid at its tip by `folkInstances`, and a carried one is a small emitter of its own (`HELD_TORCH`, look `'hand'`, which `torchInstances` skips like a fire). `Place Torch` on any tile (`planterFor`, `sendToPlant`, `Task.Plant`, `EntityState.Planting`) sets it down: `World.plant` fills `world.torch` / `world.torches` and `emittersIn` turns each into a `STANDING_TORCH`. A torch does not burn out yet and cannot be picked up again.

**Heat and light are two small classes, and a thing that gives off either is an emitter** (`sim/sources/`): `HeatSource` (a `reach` in tiles and an `output`, `warmthAt(dx, dy)` falls off linearly to nothing at the reach) and `LightSource` (reach, strength, colour). An `EmitterKind` pairs one of each, either may be null, with the `look` the renderer draws (`'fire'`, `'post'`, `'hand'`); `CAMPFIRE` (heat 7 x 1, the strongest), `STANDING_TORCH` (3.5 x 0.4), `HELD_TORCH` (2.2 x 0.25) and `BURNING_BRANCH` (2.6 x 0.3) are the kinds so far, and a new source of warmth or light is a new kind and a line in `emittersIn`, which gathers every fire, standing torch and held torch into `Emitter`s each frame. `warmthFrom` is what `PeopleEnvironment.warmthAt` reads (the warmest wins) and `Game.lightSources` turns the same emitters into the renderer's `PointLight`s, so the heat a person feels and the light the ground shows can never come from different lists.

**Milestones are their own class** (`sim/achievements.ts`: `ACHIEVEMENTS` is the list, each with a `title`, the `reason` it is earned, what it `unlocks` and a `reached(people)` test, and `Achievements` keeps what has been earned and tells its subscribers): `Game.advancePeople` calls `check` every frame, so a milestone is earned by the thing happening, once, and no code has to remember to announce it. The first is **`fire`**, earned when `knowledge.hasDiscoveredFire` is set, and **until it is earned the world is small**: `Game.free` is false, so `pan` does nothing, `zoomAt` keeps the camera's centre and will not zoom out past strip zoom 30 (`LOCKED_MIN_ZOOM`, written in the strip's unit, so camera zoom 60; zooming in is free and the world opens at 30), the walkers are confined to `CONFINE_TILES` of where they started (`World.confine` makes `passable` false outside it, so paths, wandering and hauling all stay in), and a fog covers the land beyond `FOG_CLEAR_TILES` (`render/lit/fogPass.ts`, `shaders/fog.frag`, drawn last in `LitLayer.draw` so it hides props, weather and the map views too: an opaque dark mist whose edge is the world's own Bayer dither, wobbled by noise). **Earning it widens the world but does not open it**: the walkers' confinement grows to `CONFINE_OPENED_TILES` (`Game.widen`), and `advanceShell` grows the fog over `FOG_LIFT_SECONDS` to `FOG_OPENED_TILES` (26) with an edge of `FOG_OPENED_EDGE_TILES`, where it stays (`Game.fogView` never returns `null` any more). The camera is held by one function, `Game.held`, which `open`, `pan` and `zoomAt` all go through: the zoom floor is strip zoom 13 once free (`FREE_MIN_ZOOM`, zooming in is free), and once free the centre is clamped so the campfire nearest to it stays on the screen with `FIRE_PADDING_PIXELS` (50) to spare on every side. **An earned milestone jumps up as a toast** (`AchievementToast` in `ShellPanels.tsx`, `HudSnapshot.announcement`): the coin, the title, why, and what it unlocks, for `TOAST_SECONDS` or until clicked, queued if several arrive together. **Its icon is a coin, and for the primitive ones a round stone with the thing etched into it**: `coin-<id>` in `pixel/ui/icons.ts`, so a new milestone is a list entry and one 16 x 16 icon.

**The game's speed is the tick speed**: `Game.speed` (0 pause, 1, 2, 3; it starts at 1) scales the day clock, the people (`advancePeople` hands `People.update` `seconds * speed`, which sub-steps in 0.1 s pieces so a fast frame is still stepped finely) and the renderer's time (`playTime`, which every shader animation reads), so pausing stops the weather, the water, the flames and Adam and Eve together.

**The game is saved in the browser, one slot per game** (`ui/persist.ts`, `localStorage`, no slot is evicted; `Game.save` every `SAVE_SECONDS` of wall time, on `pagehide` and `visibilitychange`, and before a new world replaces the old). The world is regenerated from its seed and only what differs is stored: `World.snapshot` keeps the tiles whose cover changed against the `origin` copy taken at generation (felled, cleared, a fire's bare ground) and every tile with wear, as flat index/value pairs, plus `storageTiles`, `fires` with their `fuels`, `embers`, `plans` (and which are `relights`), `torches` and `GroundItems.state` in their order; `People.snapshot` is every column of the packed arrays by name plus the knowledge flags; `Calendar.state`, `Achievements.ids`, the speed, `playTime` and the camera (the torches are `World.torches`) ride along. Restoring goes through `Game.resume` after `settle`, and an earned `fire` lifts the confinement and the fog at once. A new per-person array must be added to `People.columns`, and a new per-tile fact to `World.snapshot` / `restore`, or it is lost on reload. The weather is not saved: `Sky` is rebuilt from the elapsed days.

**Keys go through a middleman, never an event listener of their own** (`ui/keys.ts`, `KeyController`): the code names *actions* (`ACTIONS`: `cancel`, `togglePause`, `cycleSpeed`, `radial`), `DEFAULT_KEYS` says which `KeyboardEvent.code` triggers each, and `rebind` / `bind` / `unbind` change it at run time (one code, one action). Whoever owns a behaviour registers it with `keys.on(action, handler)`: the handler gets `'press'` or `'release'`, the newest handler runs first, and returning `true` consumes the key, so Escape closes the radial menu before it clears the opened tile before it puts the tool away. The game-wide handlers live in `ui/controls.ts`, the canvas's own (radial, its escape) in `GameCanvas.tsx`; keys typed into an input, or held with ctrl, meta or alt, are never ours. Space pauses and resumes at the speed it had (`Game.togglePause`, `resumeSpeed`), Tab cycles 1x, 2x, 3x (`cycleSpeed`).

**The radial menu is the only way in** (`ui/radialMenu.ts`, slices from `ui/radialSlices.ts`): right button or the `radial` key (E) opens it
under the pointer and a flick past `FLICK_RADIUS` in a slice's direction commits on release; a short release leaves it open to
click. It is drawn on the cursor canvas in buffer pixels with the baked font (`ui/pixelText.ts`).

**People, items, the storage corners and the knapping sparks are lit props like the trees** (`pixel/ground/folk.ts`, baked by `npm run props`
as `person.<adam|eve>.<pose>.<s|n|e>`, `item.<kind>.v<n>`, `marker.storage`, `marker.spark`), so the sun, the night, the weather and the
torches light them and they cast shadows. `render/lit/folkInstances.ts` turns `People` and `world.items` into instances every
frame and the layer appends them to the torches'; **in air below `BREATH_BELOW_CELSIUS` (8) they breathe out a puff** (`marker.breath.<0..2>`, three growing frames, emissive so it casts no shadow; `People.air` is the air at their tile, `folkInstances` places a puff at the mouth every `BREATH_PERIOD_SECONDS` and lets it drift ahead and up, a frame larger below freezing), west is the east sprite flipped, a walker's frame is picked by the distance it has covered (`People.stride`, eight frames from `walk2` to `walkM2` and back, `STRIDE_PER_FRAME`) so the limbs swing at the pace of the ground, and a held item is its ground sprite placed at the
hands and drawn a hair above the person. Like the torch they sort by height, so a canopy covers a person under it until it dithers
away. When the layer is not drawing props (`LitLayer.showsFolk`, false far out or without WebGL) `ui/peopleDraw.ts` draws two dots.

**A prop that goes with the canopy without being one carries `hides`** (flag bit 8, `flagsOf` in `litLayerConstants.ts`; `rimmed` is bit 16, `focus` bit 32, the season index sits above them, at 64): the bare oak twins use it so their branches dither away with the leaves and only the trunk is left, while keeping no canopy lift so the leaves still draw over them.

**Things you can pick up read as things, not as ground, through their art and not through a glow** (`INKED` in `pixel/ground/folk.ts`, `inkAround` in `objects.ts`): every item sprite is wrapped in a one-texel ink outline baked into the sheet, drawn in colours that are deliberately not the ground's (`ITEM_FLINT` indigo-black with a pale spark, `ITEM_STRAW` golden, `ITEM_CHESTNUT` red-brown with a tan core, `ITEM_LIMESTONE` cool pale grey), with thick twigs and faceted stones, because at four to eight texels a realistic brown stick is a speckle of dirt. Items cast the same drop shadow as everything else (their `height` is 2 to 4 for that). `rimmed` in `flagsOf` is now only the draw-order lift: the vertex shader raises the key by 5 so an item draws over the marks around it and under people; there is no rim shader any more. **The background is dimmed so they stand out** (`BACKGROUND_DIM` in `weatherLibrary.glsl`, 0.78): the grade pass lays that much black over the ground and the prop shader multiplies every sprite without `focus` by it, so people, items, the storage corners and sparks (`focus`, which `rimmed` implies) keep full colour while trees, bushes and marks sit back.

## Where biomes meet

**The boundary wander is baked into the biome array, not painted on.** `classify` gives each
tile a biome from height, temperature and moisture; `wanderEdges` (`terrain/worldfield.ts`) then
rewrites the array by reading each land tile's biome from a position offset by three octaves of
noise — a long lobe, a mid wave, and a fine one that reaches about a tile. The result is a
wandering, interlocking border several tiles deep instead of the level set of a smooth field.

It is baked rather than applied in the painter **so that what you see and what the tile says are
the same fact**. A warp in the painter alone would colour a tile meadow while the inspector,
reading the array, called it desert. One array, one answer, and the trees follow it too because
`coverFor` reads the same array.

Water is never warped, in either direction: a wet tile keeps its biome, and a land tile whose
warped source is wet keeps its own. The painter's shoreline comes from `field.water`, so a warp
that moved Ocean into the biome array would put a lake somewhere the water sheet says there is
none.

**The painter reads the seam as a surface, never as a distance to a cell's side.** For each texel
it takes the four surrounding cell centres with bilinear weights; the heaviest is the ground, and
the heaviest *differing* one is the rival, with its weight as the blend. `seam()` then decides
between them against the material mask, so the transition is grainy and interlocked rather than a
dither band ruled along a cell face.

This is the same lesson `floodedAt` already learned for the shore, and getting it wrong looks the
same both times: read as whole cells, a boundary is a staircase of right angles as wide as a cell,
which at sixteen texels to the tile is the most obvious thing on the screen. A blend keyed to
`u` and `1-u` is that staircase with a soft edge — still axis-aligned, still straight.

## The terrain field

**A world is built once from its seed, in one pass, and nothing about it is stored between runs.**
`terrain.ts` is the way in; `worldfield.ts` assembles the pass and memoises it on the seed. The
same point gives the same answer however you arrive at it.

Four files, in dependency order, and none of them may reach back up:

- `heightmap.ts` — the grid, the fractal field, the shore falloff, `landFraction`.
- `hydrology.ts` — the sea, the priority flood, flow accumulation, lakes, rivers.
- `climate.ts` — temperature, the wind's rain, moisture, the biome table.
- `worldfield.ts` — assembles them, wanders the edges, memoises, answers questions about points.

`heightmap.ts` imports `TileGrid` from `sim/grid.ts` and re-exports it as `FieldGrid`. The cycle
that used to forbid this — the lattice read the field, so the field could not read the lattice —
is gone with the lattice.

**Eight octaves, and the last two are for the rivers.** The finest is about four fifths of a tile.
Steepest descent down a field that is smooth at the size of a cell has no small valley to find, so
every river runs dead straight and the whole map drains in parallel lines. Dropping octaves is
how that comes back.

**The world is bounded by its own terrain**: past the extent the shore falloff keeps growing until
nothing clears sea level, so there is no land beyond what is drawn and the skirt round the grid is
all sea. A falloff that merely saturates does not do this — the
noise goes on making islands for ever. `BEYOND` is derived from the margin and must stay derived:
they are the same rule seen twice, and a constant for one drifts from the other the moment the
world changes size.

**The falloff's reach is a smooth norm, never `max(dx, dy)`.** The infinity-norm's gradient over
the left and right thirds of the world points exactly along x — the same direction at every point
of a third of the map — and on flat ground that is a bigger slope than the terrain's own. Every
river in a plain then runs due east in parallel, evenly spaced, which is most of what makes a map
read as a circuit board. A smooth norm (`NORM`) has a gradient that turns with position.

**Route the water down the steepest slope, not back the way the flood came.** The priority flood
reaches a cell from whichever neighbour got there first, which on a gentle slope is the front of
an expanding ring — follow that back and the rivers come out as straight radial lines.

**Lakes evaporate, and a dry basin is a sink.** Filling every hollow puts a lake in every basin,
including the ones in the middle of a desert, and a desert stippled with blue is the clearest sign
of a map filled in by an algorithm. Emptying a lake without making it a sink is the worst of both:
the fill stays on the routing surface, so a river runs out of the far side of somewhere that holds
nothing. Drying and filling settle each other, so they are asked in turn, three rounds at most.

**A flat is drained by the ground under it, not by the fill on top.** Fill a hollow and its surface
is level to the last bit, so the only thing telling one neighbour from another is the hair's
breadth each was raised by as the flood went past. Steepest descent down *that* runs dead straight
out of the spill point, and a basin comes out as a star of rays. `steepest` breaks the tie on the
drowned bed instead.

**Temperature has Earth's range** (about -45 to +40 C over a year). `seaLevelTemperature` interpolates a table of Earth's annual mean by latitude (27 at the equator, 20 at 30, 9 at 45, -1 at 60, -16 at 75), the year swings it by `swingOf` (up to `SEASONAL_SWING_CELSIUS` 24 degrees, growing with latitude and about four times smaller over water than in a continent's heart), and the day by `dayswingOf` (1.5 degrees over the sea to about 10 in a dry interior). The heat view and the field texture span -60 to +60 (`TEMPERATURE_TEXTURE_FLOOR_CELSIUS`, `TEMPERATURE_TEXTURE_SPAN_CELSIUS`). **The climate is in real units and the game is in 0..1.** `climate.ts` works in degrees and in the
rainfall units Azgaar's biome table is written in, because a model in made-up units cannot be
checked against anything; `environmentAt` is where that is normalised.

**The meander is a field, not a jitter per cell.** A river's chain of cells can only point eight
ways, so on ground that falls smoothly steepest descent holds one of them for dozens of cells and
then turns a corner. A per-cell offset does not help, because white noise moves every point its own
way: the line comes out furry and a straight run is still straight. The offset is read out of a
noise field in world units, so neighbouring cells get almost the same answer and the whole chain
leans one way and then the other. Keep the amplitude under the step between cells or the line folds
back on itself. `RUMPLE` is the honest half of the same fix — it bends the drainage, not the
drawing.

**Water is three biomes and they are what blocks.** `isWater` covers Ocean, Lake and River;
`waterCheck` is the sentence the cursor gives back. Don't test `elevation < SEA_LEVEL` — a lake
stands above sea level and a river runs over land.

**A river is a ribbon, not a cell.** It is narrower than a tile, so it cannot be a tile's colour
without flooding it; it is drawn from its own segments and `field.biome` never holds River.

**A lake swallows its rivers; the sea mixes with them.** A river reaching a lake stops being drawn
at the water's edge, because standing water is one surface however much runs into it and anything
drawn across it reads as a seam. The sea is the one that mixes: the painter takes the mouth out in
a few widening steps and `plume` takes it away again over the shelf, which together read as a fan.
Carried on at its own width it reads as a canal.

**No shore is a fade — not the sea's, not a lake's, not a river's.** The ground dithers one cell
into the next; water never does. The sea and the lakes get their hard edge from the water mask read
as a surface, with noise on the crossing (`floodedAt`); a river gets its edge from its own width
(`bankOffset`), because a ribbon has no cell to take an edge from.

**Water is shaded by depth, and the land beside it by the same depth** (`terrainPixels.ts`). A river texel's shade comes from how far it is across the channel and how big the river is (`riverShade`, `riverAt` gives the signed distance to the painted edge, `RIVER_EDGE`), not from the terrain height under it, so a stream stays pale and a great river goes dark in the middle. Standing water is lightened over the first `SHALLOWS_TILES` off its shore (`SHORE`, which `floodedAt` fills: the signed distance to the shoreline in tiles and the kind of water beside it); water inside a river's reach always takes the river shade, or a lake cell on a river reads as a pale square. **The bank is a strip on the land side** (`bankAt`): within a band of the waterline (`riverBank(half)`: gravel on shallow streams, narrowing as they grow, mud on deep rivers, widening; lakes mud, the open sea sand) the strip is painted from the path ramps (`MUD`, `SAND`), its edge wandering on a noise, and outside it the ground is darkened a little, damp, down to nothing. The strip is a path ramp, so the baked decal pass keeps flat marks off it. It only exists on the fine rungs, where `smooth` is true, because a coarser texel has no room for it.

**Fresh water and the sea must not be the same blue; a lake and a river must be *exactly* the same
blue.** The first because salt is water you cannot drink and fresh is water you can. The second
because they are one substance seen twice — give the river its own ramp and every place a river
meets the water it runs into comes out as a hard cut across the surface, a line that is not there.
Both are shaded off the bed underneath, which is continuous across the join.

## Painting the ground

**A rung is a texel and nothing else** (`LEVELS`, `levelFor` in `render/terrainPixels.ts`). Nine
rungs, each a texel half the size of the one below, from 1/16 m up to 16 m. `MIN_TEXEL_PIXELS` is
2: a rung is held until its own texels are four buffer pixels and only then handed to one whose
texels are two, so the ground is chunky everywhere and stays chunky for a long stretch of zoom.

**Three things are wanted here and only two can be had at once**, so don't rediscover this by
changing one alone: *fluid zoom* (the drawn scale is the camera's), *big pixels*
(`MIN_TEXEL_PIXELS` above one), *even pixels* (every texel on screen the same width). A chunk is
baked at a pixel to the texel and magnified, so a fractional magnification always leaves some texels
a pixel wider than their neighbours. Snapping the zoom gives a ladder of about fourteen steps, worse
to live with than the ripple. Fluid and big; the ripple is the price.

**A rung whose texel is wider than a tile reads a coarsened copy, never a point sample**
(`fieldLevel`). Water, height *and biome* all go down the same 2:1 mip chain — water by majority,
height by mean, biome by majority among the dry children. Point sampling a 4 m texel against 1 m
tiles picks one tile in sixteen: the ground comes out as a random speckle that re-rolls at every
rung, and a pond four tiles across appears or vanishes depending on where a texel centre lands.
Four tiles become the answer most of them gave, which is what ground looks like from further off.

**Anything baked in chunks must be a function of world position alone** — never of the shape being
drawn, and never of the chunk. A biome running across several chunks is a separate run in each, so
a tone randomised per run, or a hatch anchored to the run's own centre, paints the chunk grid onto
the map. It shows up as a faint checkerboard, which reads as a rendering artefact rather than as the
seeding mistake it is.

**Baking has a budget per frame** (`BAKE_BUDGET_MS`): holes first — a chunk with no stand-in at all
— then chunks that have something to show, nearest the middle of the view first, at least one a
frame. **A rung being passed through is not baked at all** (`drawnRung`): crossing a rung leaves
every chunk on screen missing at once, so a wheel run through five rungs asks for sixty bakes and
gets one a frame, and what the eye sees is the middle of the map flickering. A chunk with a
stand-in waits until the rung has held still for a frame; a hole is baked whatever the zoom is
doing, because bare paper is worth a dropped frame.

**The cache budget must exceed the number of chunks drawn in one frame.** This has bitten twice. A
cache that evicts a chunk every frame and re-bakes it on the next costs tens of times the frame
budget, and it does not look like a cache problem — it looks like the renderer falling over.

**Every rung bakes the same 256-texel chunk**, so a chunk costs the same wherever you are and only
the number on screen varies. The rung is part of the cache key.

**The ground is lit from the top-left, and the sun is not a free choice.** Every sprite takes its
light from there, so ground lit from anywhere else puts the shadows on the map at odds with the
shadows on the things standing on it. `relief` is the whole of it: two heights off the field, one
up-sun and one down-sun. **It shades the hill, not the tilt of the country** (`BROAD`) — a plain
that leans one way leans that way for miles, so lighting the raw slope stains whole regions paler
or darker. **It reads at a fixed size in the world, never at the rung's own cell**: a hillside is a
thing with a size, so tying it to the rung replaces every shadow on the map with shadows belonging
to hills twice as big on one scroll click. Water is not shaded — the slope under a lake is a thing
nobody can see from above, and the sea picking up a hillside's light reads as murk.

**The blotch is the ground's and the grain is the paper's**, and they must not be scaled the same
way (`step`). The blotch has a size in the world and keeps it at every rung; the grain is the tooth
of the paper, so it is a fixed number of texels. Scaled by the rung, as both once were, the blotches
move and double at every scroll click while the coast under them stays put.

**The shade is a budget, and the light has to be given room out of it.** At five lightness points to
a step a whole step of shading is not read as light at all, so the ramps span about thirty-six
points and the mottle takes only its share.

## The ground sprites

`src/pixel/ground/` holds the drawn ground: **textures** (what a material is made of), **masks**
(how it spreads into a neighbour), **decals** (what lies and grows on it). `npm run ground` bakes
them to `public/ground`; until they load the ground is painted the plain way, and `groundVersion`
is in the chunk key so every chunk re-bakes once they arrive.

They paint the four finest rungs (`MIPS`). A texture is read at the texel's *world* index and a
mask decides every seam — never the Bayer threshold, never anything about the chunk.

**Decals are placed per tile, from `world.cover`.** A tile carrying a tree picks one from the
`tree.` family weighted by the material's density, jittered inside its own tile; flat marks
(tufts, flowers, mushrooms, stones) are scattered by density, and a worn tile draws the `path`
set instead. So clearing a tile removes exactly the thing that was standing there, and the
placement is a pure function of tile and seed — chunk-safe by construction.

**Rivers keep decals off the water.** the generator rolls nothing on a river tile (`world.river`), `Plants` never seeds them, and `marksOn` drops a mark on a river tile when its spot is within `MARK_SHORE_TILES` 0.3 of the water the painter draws (`wetNear` in `worldfield.ts`, the same reaches `terrainPixels` paints from), so the bank keeps its marks and the water only the `aqua.*` plants. A tree on the bank may still overhang the edge.

**Textures and ground cells in decals are ramp steps, never colours.** The biome and the sun pick
the colour per texel; a texture fixed in RGB would throw away both and the palette with it. Decals
pack this in the alpha — 255 a colour, 1–5 a ground step, 0 clear — resolved against the ramp the
painter recorded for *that* texel, so a forest tree by a river does not leave a green blob on the
water.

**Fields are code, marks are rows.** 128 texels that must wrap at every edge are not drawn by hand;
decals under a dozen texels are rows of characters, where every pixel is a choice. Every generator
wraps on `TEXTURE` — a noise size or scatter step that does not divide it draws the repeat as a
seam across the map.

**One mask per material, not per pair.** Where two meet, the one higher in `PRIORITY` spreads
through its own mask. Masks are rank-equalized, so a strength of 0.2 turns over a fifth of the
texels; noise left as it is bunches in the middle and the edge lurches across in one step.

**A texel is a hand's breadth.** Check a new decal in `ground:preview -- scene`, which stands a
villager beside everything; a mark drawn at the wrong scale turns a forest into moss.

## The lit layer

**Everything that stands on the ground is drawn by a WebGL layer over it, not painted into it**
(`render/lit/litLayer.ts`): trees, bushes, boulders and every flat mark — flowers, tufts, ferns,
mushrooms, stumps, logs, cacti, stones, puddles. `npm run props` bakes each one twice into `public/props`: an albedo sheet (the ramp's middle step,
inked, no light and no shadow in it) and a normal sheet (xy in red and green, height in blue). The
shader lights them every frame from `Lighting` — a sun, an ambient, and up to eight point lights —
and the shadow is the silhouette shifted along the sun by the tree's height, so it turns and
lengthens as the sun moves. Light is banded and Bayer-dithered in the shader to stay chunky.

**Every tree is baked at three storeys** (`STOREYS` in `pixel/ground/objects.ts`): a low, mid and high
variant, each regenerated at its own radius with a steeper or flatter dome, its density a share of the
species'. The storey's height sets the shadow's length and, with a per-tree hash, the draw order
(`key` in the vertex shader — height first, y only to break ties), so a tall tree stands over its neighbours instead of every canopy
stacking top-left to bottom-right. Trees are also flipped by a tile hash and scattered within their own tile (`SPREAD` 1, never more: a foot drawn in the next tile is a tree the cursor and the radial menu cannot find).

**A crown is a height field of its own, not one dome.** Each generator hands `surfaces` a `crown`: a
smooth maximum of bumps (`crownOf`) with their own heights, so peaks sit off-centre and valleys run
between them, and the broad normal comes from its slope. Oaks pick an archetype from their seed — round,
wide and low, twin-crowned, leaning — pines are built from whorls of separate needle sprays (a capsule and a ragged tuft each, `grit` roughening their normals) over a random tier count, breadth and lean, acacias are flat
clumps. The sheets carry a margin of 30% so a spread crown never touches the edge.

**Trees are generated, not drawn.** Each species is baked at several seeds (`variants` in `TREES`) times
three storeys, and each canopy gets `holes`: a ragged fringe that thickens toward the rim and a few
clearings, cut out of the alpha only — the broad dome and the lobes are measured on the whole
silhouette, so a gap does not turn into a crater in the normals. The holes show the ground, other
trees and dappled shadow through them. **Wind is a per-tile fact and the sway is stepped, never smooth.** `world.wind` (0..255, `terrain/wind.ts`)
is built with the field from the latitude belt, altitude, open water's fetch and the channelling of
ravines (a tile lower than the ground round it), less the shelter of high ground upwind
(`prevailing`, the same direction the rain blows). A tree reads it from its tile. `swayed` in the
shader moves a whole tree by one texel, and only when a gust passes a threshold, on a 2.5 Hz beat —
no per-pixel shear, which reads as water — plus the odd rim pixel twitching to its neighbour. Calm
tiles hardly move at all.

**Zoomed in far enough the canopies go and their shadows stay** (`CANOPY_HIDE_FROM_ZOOM`, `CANOPY_HIDE_TO_ZOOM` in
`render/lit/litLayer.ts`): between the two zooms the canopy is dithered away against the Bayer matrix,
a pixel at a time, never faded; past `CANOPY_HIDE_TO_ZOOM` the tree pass is not drawn at all. The ground shadow
pass is drawn first and does not care, so the dappled floor under the trees is what is left. **Every tree
also has a trunk** (`trunk.<kind>.<storey>`, sized to its tree: dark ridged bark, root flares and a patch of moss, and no cut face, so it can never be read as a felled `forest.stump`, which is pale with growth rings): drawn under the
canopy from `HIDE_FROM - 2` up, so as the canopy dithers away the stump it stood on is what shows. Trunks
are placed from the tree's own placement, never from the density tables.

**Ground chunks skip trees once the layer is ready** (`propsLit`, in the chunk key through
`groundVersion`); if WebGL or the sheets fail, the baked trees come back. Trees are opaque and
depth-tested on their foot's y, so no sorting. Placement is `standsIn` and `marksIn`, cached per 32-tile block and
keyed on `stampOver`. The tile cursor is its own canvas above the layer so a canopy cannot hide it.

**What the prop pass costs, and what keeps it down.** A forest is the worst case: every instance is drawn up to five times (a depth pre-pass, the ground shadow, the props themselves, the shadows onto marks, and a torch's shadow), and canopies stack eight deep. Measured in a forest the cost was fill, not shader arithmetic, so the savings are all in what is drawn. `collectInstances` hands the GPU only instances whose sprite and shadow can reach the view (`SHADOW_REACH_PER_HEIGHT` times the height, plus the sprite's size) instead of whole 32-tile blocks. **Each sprite's quad is cropped to its opaque bounds** (`cropTexture` in `propPlacementCache.ts`: an RGBA8 texture the size of the sheet, read by `texelFetch` at the sprite's atlas corner in the vertex shader, padded `SWAY_PADDING_TEXELS` so a swayed texel is never cut): an oak fills 62% of its square, a willow 52%, a bare oak 48%, an acacia 38%. Marks under `LOW_MARK_HEIGHT` (leaves, moss, pebbles) are drawn last and cast no shadow below zoom `LOW_MARK_SHADOWS_FROM_ZOOM`, because only the first `casterCount` instances go into the shadow draws. **A depth pre-pass** (`DEPTH_PREPASS`, `uShadowPass` 3) runs the same alpha, leaf-loss and canopy-dither discards as the main draw with the colour mask off, so the heavy lighting runs once per visible pixel; it is biased (`PREPASS_DEPTH_BIAS`) because the two draws do not produce bit-identical depths, and `litPrepass = false` in the console switches it off for comparing. Everything that is constant for one sprite (the seasonal table row and whole-sprite test, the gust and lean, a sun or moon shadow's strength) is worked out in the vertex shader and passed as a `flat` varying; the fragment shader only does per-texel work. The falling leaves are drawn as instanced quads (`fallingLeaves.vert`), one per cell and slot, never as a loop over every particle in every pixel. **`litProfile = true` in the console prints each pass's GPU and CPU milliseconds every two seconds** (`passTimer.ts`, needs `EXT_disjoint_timer_query_webgl2`): read it before guessing what is slow. **On a tile-based GPU (Apple) the timer queries lump the whole render pass together**, so the rows add up to several frames and neighbouring passes read alike; use `litProfile = 'sync'` there, which waits for the GPU (`gl.finish`) around each pass and times it directly, and `litSkip = ['water', 'grade', ...]` (`shadows`, `water`, `fish`, `insects`, `grade`, `props`, `leaves`, `precipitation`, `clouds`, `fog`) to switch passes off and watch the frame rate.

**The animals are sorted with the props through the depth buffer, not by pass order.** A prop writes `propDepth(key)` with `key = metres * 8 + canopy * 6 + rim * 5 + y * 0.02` (`weatherLibrary.glsl`, `PROP_DEPTH_RANGE` 96, one number for the props and the animals), and the buffer is still there after the props pass. Each animal pass draws twice: `UNDERLAY` before the props, without depth, for what lies on the ground (shadows, ripples, nests, spawn and tadpoles, the strider's ring), and `SORTED_WITH_PROPS` after them, with the depth test on (`useAlphaBlendingForLayer`, `LESS`, depth writes off, restored after the draw or the next clear would skip the depth buffer) for the bodies, whose z is `propDepth(depthKey(height, y, viewY))`. So an animal's height, in the props' own units, decides what covers it: a prop's height is its sprite height in texels over 16, so a tree is about 1 to 2.4 and a person under 1. A new animal pass takes a height and the two layers, never a pass of its own after the props.

**Everything in the layer is seen straight down, not at three-quarter.** A sprite's foot is its centre: a fern is a
rosette of fronds, a tuft a star of blades, a mushroom a cap, a stump a disc of rings with its roots,
a cactus a ribbed circle with arms. Height is only the sprite's `height`, which sets its shadow and its
draw order. A `bend` plant sways more the further a pixel is from its centre.

**Bushes and boulders are shaped like the trees** (`plants.ts`): the same crown height field, holes and
three storeys, a boulder's crown being cones so it comes out faceted. **Marks are small generators, not
rows of characters**: a tuft is blades, a flower a stem and petals, a fern fronds with leaflets, and each is
baked at three seeds, so no two neighbours are the same sprite. They are drawn only from zoom 10 up
(`GROUND_MARKS_FROM_ZOOM`), at 30% of their old density (`MARK_SHARE`) now that every one of them is a real sprite.
**Marks grow in patches, not evenly** (`patchiness` in `groundSprites.ts`): each species carries a `grain`, one or more
layers of value noise with a scale in tiles and a cover, and a tile's density is the species' density times that
field, scaled up to keep the mean. Flowers share one big field and each colour has its own inside it, so a
meadow has yellow patches and white patches; ferns and mushrooms clump tighter; cacti and boulders get a wide, loose
field and half the density (`thin`), so they stand apart. The noise is seeded by the world's seed and is a pure
function of tile, so a patch is the same wherever you come at it from.
A prop's `sway` and flags travel with it: rocks do not move, a canopy shifts as one piece, and a
`bend` plant (grass, flowers) shifts its top rows further than its roots, a row at a time. Only canopies
hide when zoomed in.

**Day and night are a place, not a moment** (`sim/astro.ts`, `skyAt(moment, place)` in `render/lit/lighting.ts`). The map is a strip of the planet: its rows are latitudes (`latitudeAt`) and its columns span `LONGITUDE_SPAN_DEGREES` (240) degrees, so local solar time is the map-centre `clock` plus `dayFractionOffsetAtMapPosition(across)` and the middle of the map is noon while its edges are dawn and dusk. The sun and the moon are real bodies: the season gives the sun's ecliptic longitude and so its declination (`AXIAL_TILT_RADIANS`, 23.44), the moon sits `2 pi moon` of ecliptic ahead of it and lags it in hour angle by the same, and `bodyBearingAt` turns latitude, declination and hour angle into east, south and up (north is the top of the screen, east the right). So the sun is high and short-shadowed in the tropics, low and long at the poles, up all day in a polar summer, and the moon rises later each night and is full only when it opposes the sun. `daylight`, `moonLight`, `gloom`, the ambient, the fog and cloud colours all follow from the two elevations. The shaders cannot take one `Lighting`, so `skyGrid.ts` evaluates `skyAt` on a 64 x 48 grid of places, packs seven RGBA16F slots per place into one texture (`uPlace`, `skyPlaces.glsl`: `sunToward(world)`, `dayAt`, `gloomAt`, ...) and the passes read it per fragment; shadows pick their direction per instance in the vertex shader (`uCast`: 1 sun, 2 moon, 3 whichever is stronger), and `skyPeaks` skips a shadow pass when no place on the map casts it. `Game.lightingAt` is the same function at the camera's own place, which is what the CPU side (readout, fog tint of the clouds' shadow lean) uses. Weather temperature takes its day swing from each cell's own local time. The ground's baked relief is still lit from the top-left whatever the sun does. `clock` runs 0..1 (0.5 is noon at the middle, `DAY_SECONDS` a
day) and `days` counts whole days, which turn the moon through `MOON_DAYS` phases (`moonPhaseOf`). The 2D ground cannot be re-lit, so the layer lays a **grade pass** over it: a full-screen
quad in the night tint whose alpha is the local `gloom`, drawn before the props, so it darkens the baked ground and
leaves the props to their own shader. Shadows are drawn first, so they are darkened with the rest, and the
moon casts its own, fainter ones.

**A torch is a light and two sprites** (`torch.post` and four `torch.flame.N` frames, emissive, picked from
the clock at 5 Hz), placed by the tool and flickered every frame by `flickered` (reach and strength
drift smoothly, a few per cent, not re-rolled). It is drawn **below every canopy** because **draw order is by height, not by y**: a
sprite's key is its height, plus a lift for canopies, plus a hair of y — seen from straight above, whatever
is higher covers whatever is lower. So a torch under a tree is hidden by it and shows through its gaps. Its
glow is added to the ground in the grade pass (banded and dithered), it lights canopies from below through
`leafy` translucency, and where it shines it **thins the shadows on the floor** (`torchFill` scales their
alpha down) — the light fills the dark under the trees rather than being blocked by them. Marks and bushes
under a canopy are darkened by its shadow in the last pass, which tests stencil == 1 (a prop is here) and
depth LESS (the caster is higher).

**Weather forms from the land, and the layer only reads it.** `terrain/weather.ts` boils the field down to a
coarse map, one texel to `WEATHER_STEP` (16) tiles, uploaded as a texture: red is **fog propensity** —
humidity (rain and the share of standing water) times calm air (`wind`), cool air (`temperature`) and low
ground — and green is **cloud propensity** — humidity plus altitude. Nothing in it moves; time does that.
**Fog** is that map times `fogTime(clock)` (thick until dawn, burnt off by mid-morning, gathering again
at dusk) times drifting noise, so it banks in cool, still, wet lowlands at night and clears from the dry
and the windy. The grade pass lays it over the ground, and every prop fogs itself by its own height, a
canopy standing a good way out of it. **Clouds** are noise drifting with the prevailing wind
(`world.field.prevailing`), thresholded by the local cloud propensity and a slow global `cover`. They cast
**shadows at every zoom** — soft, wide, shifted along the sun by their height, darkening the ground and
the direct light on props — but their **bodies are drawn only zoomed out** (`CLOUD_BODIES_FROM_ZOOM` to `CLOUD_BODIES_GONE_BY_ZOOM`, 4 to 14,
well before the canopies start to hide): banded and dithered like everything else, with a touch of parallax.

**Weather is a state the sim keeps and the layer draws** (`sim/weather/`, `Sky`, which is only the conductor: it owns the grid and calls `Winds`, `Temperature`, `Clouds`, `Precipitation`, `GroundSurface`, `StormDamage`, `Lightning` in the order the weather depends on itself). It owns a coarse grid — the
same cells as the weather map — of **fronts** (pure noise advected by the prevailing wind, so a front is the
same wherever you ask), from which each cell takes its own **rain, snowfall, thunder and gale**: rain or snow by the
cell's temperature (the map's, less the night, plus a slow season, less the storm's own chill), thunder when it is
warm and the front is heavy, gale by the front and the cell's wind. It also keeps the **ground's state**: `wet`
and `snow` per cell, integrated in fixed ticks of 1/240 day (`SIMULATION_TICK_DAYS`) — rain wets, snowfall builds, warmth and rain melt
snow into wet, evaporation dries — so it is slow, and `advance(time)` catches up in bigger steps after a skip
rather than dropping the time. **The ground is changed for real**: a tick rolls, per cell, `hazard` = gale squared,
thunder and the weight of settled snow, scaled up by wet soil, and fells that many trees (`World.fell` turns
`Cover.Tree` into `Cover.Fallen`, stamps the block, and the tile then draws a `fallen.*` sprite — a log with its
root plate and the canopy lying beside it); a thunder cell can also strike, which is the one thing the renderer is
told about (`strikes`, `strike`). The `sky` bar button cycles `Sky.forcedWeather` through clear, rain, thunder, snow and storm
for looking at them; null is the natural weather.

The layer reads two small textures from it (`skyData`: front, rain, snowfall, temperature; `groundData`: snow, wet,
gale, thunder) and one that never changes (a tile-resolution water mask, so snow and wet stop at the shore). The
**grade pass** lays snow, then the wetness's darkening, then puddles (noise thresholded by wetness) over the ground;
props wet-darken, and whiten on the faces that look up; the **precipitation pass** draws one-pixel streaks of rain
slanting with the wind and two-pixel flakes, density read from the cell under them; storm cloud is darker and the
front itself overcasts — cloud shadows and the direct light fall off with it. Gale also adds to every tree's sway and
lets it jump two texels. A strike flashes the whole scene twice and lights the spot (`flashAt`).

**Water moves** (`render/lit/shaders/lakeAndSea.frag`, `river.frag`, `river.vert`, `riverMesh.ts`; drawn by `waters` after the shadows and before the grade pass, from zoom 2.5 up). The ground's baked water stays underneath and the layer lays pixel-chunky shade, crests and foam over it. **Lakes and the sea** are a full-screen pass over the tile-resolution water mask, kept a little inside the painted shore and dithered out toward it: wave crests and troughs drift with the wind there (calm lakes shimmer, a gale makes bigger crests and whitecaps), a lapping foam line rides the shore, the sun glints on it by day, and **rain makes expanding rings** (`rings`: two layers of cells, each firing with the local rain, fewer in a gale). Clicking water throws a ripple (`LitLayer.throwRipple`, up to four). Below about -1 C it freezes over, still and pale with cracks. **Rivers** are real geometry: `riverMesh` turns every segment into a quad whose end normals are the mean of this and the neighbouring segment's direction, so a ribbon bends round corners without a seam, and carries its flow (direction times a speed from the slope), its half width, whether it falls (`WATERFALL_MINIMUM_METRES_DROPPED_PER_METRE`, the steepest few percent of wide reaches) and whether it ends in standing water (it tapers away there). **Water is found in the painted pixels, not in the mask.** `LitView.ground` is the ground's own buffer canvas, uploaded every frame (`uGround`), and `painted` calls a pixel water when its blue exceeds its red by 0.12 (every step of the `WATER` ramp does, no land colour does), so the overlay ends exactly where the painter's shore does, river mouths, plumes and ribbons included; the tile mask only says whether the water is standing (full waves) or river water outside it (calmer). The shore foam is a ring of four samples a couple of pixels out (`shoreDistance`). Rivers are drawn first with a stencil that lets each pixel be drawn once, so overlapping quads leave no edges inside a river, and the lake pass then draws only where no river did; the stencil is cleared after, because the props' last pass reads it. Ice stops everything, rings from clicks included. The pattern is the **flow-map trick**: two noise layers that slide along the flow for one cycle and cross-fade, so it moves forever without the displacement growing; the streak is a smear of a few samples along the flow, and banks get froth. A fall is white streaks sliding fast with a lip above and spray below. **Never rotate world coordinates into the flow frame**: the dot product of a position of a thousand tiles with a direction that varies a hair from pixel to pixel is a streak a hundred tiles long, the thin straight lines across the water that this once drew. The water shaders use their own `preciseHash` (`waterCommon.glsl`) for the same reason (a `sin` hash dies on large coordinates).

**The calendar and the controls.** Time is `clock` (a day) plus `elapsed` (every day ever run, which sets the
season: `YEAR_LENGTH_IN_GAME_DAYS` of them to a year, `season` 0..1, a quarter each of spring, summer, autumn, winter). The `sky`
button opens the **sky panel** (`ui/SkyPanel.tsx`): a 24-hour slider, a moon-phase slider, a **year slider**, and the forced-weather buttons (auto, clear, rain, thunder, snow, storm,
sand). The season moves the temperature by `SEASONAL_SWING_CELSIUS` degrees (`Sky.setCalendar`), which is what turns rain to snow
in winter, and the lit layer tints leaves orange and bare (some trees stay evergreen). Two
tools sit beside `tread`: **bolt** strikes a tile (`Lightning.strikeGroundAt`, which also fells a tree there) and **uproot** fells a
tree without weather. Sandstorms (`dust`, in dry, windy cells) are a fourth precipitation; storms of any kind thicken
`hazeAt` into a veil in the weather's own colour, which is what cuts the view. A thunderstorm strikes on a clock of
its own, mostly near the camera (`NEAR`), and the flash is scaled by distance. Opening a tile prints a debug readout
(`Game.readout`): height in metres, temperature, weather, front, wind in m/s, humidity, rain, snowfall, dust, snow
cover, wet ground, fog chance, light level, time.

**The planet is a latitude range, not a random window.** `latitudesOf` spans roughly ±65 to ±75 degrees, so the
equator crosses the middle row and the poles are the top and bottom edges: temperature falls from about 27 C
in the middle to below freezing at the edges, rain falls in bands (wet at the equator and 60, dry at 30), and the
prevailing wind flips by band (`bandStep`: easterly under 30, westerly 30 to 60, easterly beyond), which `precipitation`
and the lee shelter in `wind.ts` read per row. The strip's `weather.latitude` carries each weather cell's degrees.

**Wind comes from pressure.** `Sky.recomputeWeatherState` builds a pressure field per weather cell: a zonal base (low at the
equator and 60, high at 30 and the poles: `-cos(6 lat)`), moving noise highs and lows advected by `zonalFlow(lat)`
(`-cos(3 lat)`: easterly, calm, westerly, calm), **each in two layers cross-faded every `NOISE_CROSS_FADE_PERIOD_DAYS` (one day) that restart on a new seed, so the shear between latitudes never builds up past a few hundred tiles (advected for weeks, the rows decorrelate into fine horizontal streaks and a hundred H and L)**, less a thermal term. Wind is the gradient turned 90 degrees (the
way the Coriolis force turns it, clockwise round a high in the north and anticlockwise in the south) away from the
equator and straight down it near the equator, plus a friction inflow toward the low and the zonal flow, scaled by
the terrain's exposure. **The pressure follows the year** (`PRESSURE_BELT_SHIFT_DEGREES`, `yearly` in `Sky.recomputeWeatherState`): the belts of the zonal base and the zonal flow slide `PRESSURE_BELT_SHIFT_DEGREES` (9) degrees toward the summer hemisphere, and the thermal term reads the seasonal temperature, which swings less over water (`weather.standing`), so land cools into highs in winter and heats into lows in summer and the highs and lows in the wind view move as the year slider does. **Weather follows pressure:** a front is a low (`front` from `-pressure`, weighted by humidity),
so storms sit in lows, the horse latitudes stay dry, and gale is wind speed in m/s. `pressure`, `windX`, `windY` and
`speed` are per cell and `fieldData` (temperature, pressure, wind vector) is the fourth texture the layer reads.

**View modes** (`Game.viewMode`, buttons in the sky panel): 0 normal; 1 **height**, a hypsometric map with
contours and hillshade from a tile-resolution height texture and depth-banded water; 2 **heat**, the temperature
in 3-degree bands with isotherms every 10; 3 **wind**, the normal scene dimmed under a grid of arrows, each aimed
along the wind, as long as it is strong, coloured by speed, with dashes running along the shaft. The wind view also draws **isobars** (every 0.5 of pressure, from the field texture) and the **pressure centres**: `Winds.pressureCentres` are the local extrema of the pressure anomaly (the noise highs and lows less the zonal base, within `CENTRE_SEARCH_RADIUS_CELLS` weather cells), each with a signed strength that is a smoothstep of the anomaly, so an H (red) or L (blue) in a ring grows as its system builds and shrinks as it decays, and is gone below `WEAKEST_VISIBLE_ANOMALY`. **4 zones** shows the time zones: the map's 240 degrees cut into 17 one-hour bands (`hours = (across - 0.5) * 16`, the middle band holds the map clock), each tinted over a washed-out coast, its hour printed along the top in 3 x 5 pixel digits (`stamp`), the night side dimmed by the same per-place daylight, so the terminator is visible against the zone lines. The strip's time is the local solar time under the camera (`Game.localLabel`), the sky panel's slider is the clock at the middle of the map. 1 and 2 replace the
scene entirely (the props pass is skipped); `mapping` in `render/lit/litLayer.ts` draws all five (4 and 5 replace the scene too).

**Beneath the canopy it stops raining**: precipitation's visibility and the storm veil fade to nothing between
`CANOPY_HIDE_FROM_ZOOM` and `CANOPY_HIDE_TO_ZOOM`, the same zoom the canopies dither away on.

**Lightning is a discharge, not a dice roll.** Each weather cell keeps a `charge` (`Lightning.charge`). A storm cell
gathers it at a rate set by how heavy the front is, how warm the air is (`lift`), how much of a thundercloud
core it sits in (`core`, a noise, so a storm has a few active centres rather than every cell at once) and the
**pressure contrast** across it (`contrast`, the gradient between its high and its low). It leaks away when
the storm dies. At `CHARGE_NEEDED_TO_DISCHARGE` it fires: the charge drops to a residue, the cells within `NEIGHBOUR_RELIEF_RADIUS_CELLS` give up half
a unit each (so a flash relieves its neighbourhood and flashes space themselves out), and a `Bolt` is
recorded in the `bolts` ring. 40% reach the ground (`strikeAt`: they can fell a tree and light the scene);
the rest stay in the cloud. A bolt has a start, an end and a length of 14 to 40 tiles (ground) or 34 to 74
(in-cloud); a ground bolt ends at its strike tile and a cloud bolt begins at its own point.

**A bolt grows.** The cloud pass takes the twelve nearest live bolts (`uBolt`, `uBoltMeta`; the layer stamps
each with the time it first saw it and keeps it `BOLT_LIFETIME_SECONDS` seconds). For 0.28 s a leader travels from the start
along the path, jagged, with two forks and a bright head; then a return stroke runs the whole length at full
brightness for 0.1 s, flickers once, and dies away exponentially. The cloud around the already-lit part of the
path glows, and at the end of a ground bolt the cloud is lit where it reached the earth. Nothing flashes
unless the sim discharged, so a storm with no charge is dark and the bolt tool's `bolt` is the other way to
fire one.

**Clouds are a conserved quantity the sim moves, makes and rains out** (`Clouds.form`). Each weather cell
keeps `vapour` and `cloud` (liquid water). Vapour is made over standing water (most), wet and humid land (less),
scaled by the saturation at the air's temperature (`saturation`, Clausius-Clapeyron-shaped, so warm sea gives far
more) and the wind. It condenses into cloud when it exceeds a saturation lowered by **lift** — convergence into a
low, air forced up a slope (the wind against the altitude gradient) and surface heating — and a deep cloud feeds
itself (`feeding`: latent heat), which is how a thunderhead grows out of a cumulus; in drier or sinking air cloud
re-evaporates, and in a high it subsides. **Rain is the cloud emptying**: precipitation takes a share of the water
every tick (`RAIN_DRAINS_CLOUD_PER_DAY`), so a raining cloud thins, stops and dissipates unless fed. Both fields are advected by the
wind field (semi-Lagrangian, every `ADVECT_EVERY_DAYS`, `WIND_DRIFT_TILES_PER_METRE_PER_SECOND_PER_DAY` per m/s per day). The world is spun up for
`SPIN_UP_STEPS` steps before it opens, so there is weather from the first frame. `front` (overcast) and rain/snow are
read off the cloud water, `towering` (convective: deep, warm) off the water and the heat, and thunder off that,
so **only a cumulonimbus makes lightning**. The forced weather works by holding the cloud water at a level.

**The kinds of cloud** are the layer's reading of that state (`cloudData`: water, towering, layered, high): the
shader draws **cumulus** as cellular puffs whose size grows and merge as the water rises (the little white
sheep over a warm sea), **stratus** as a broad grey sheet where the air is cool and stable, **cumulonimbus** as
a massive dark body with a lit rim, **cirrus** as thin streaks stretched along the wind, and an **altocumulus**
mackerel pattern (rows of small flocks) ahead of an approaching low. They are lit by the sun on the rim facing
it and flow with the local wind in two cross-faded layers (`flowFbm`, period 25 s) so a shear bends them. Shadows
use the three low kinds only (`cloudCore`); the body adds the two high ones (`cloudParts`).

**The seasons act on the world through one base class** (`sim/seasons/`, `SeasonalPlant`). Each subclass answers
`stateAt(yearFraction)` — the year as 0..1, spring first — with a `PlantSeasonState`: `autumnColour`, `leafLoss`, `fruitRipeness`,
`blossomAmount`, `strawDryness` (dry grass rather than autumn leaf), `visibility` (either a fraction of texels kept, or an
interval of a per-plant hash inside which the whole sprite shows), and `fallingLeavesPerSecond`, `blowingPetalsPerSecond`
and `leafLitterOnGround`. `EvergreenPlant` does nothing; `DeciduousTree` turns from late
summer, loses its leaves through autumn and regrows them in spring; `FloweringShrub` does the same less, and blossoms in
spring; `BerryBush` also fruits (ripe late summer, gone by the end of autumn); `Grass` dries to straw; `FlowerInBloom`
is there only from spring to autumn; `Fern` dies back in winter. `seasonalKindIndexForSprite(name)` maps a sprite's name to
its class and the bake writes the index into `props.json`, so a new species is a line there, and a new
behaviour is a new subclass. Each frame `seasonalStateForBothHemispheres` turns the year into a small table (`uSeasonal`) the
prop shader indexes by the sprite's kind. **Leaf loss and presence are pixels discarded by a hash of the
texel**, in the shadow pass too, so a bare tree casts a thinner shadow. **Berries are marked in the bake**
(`Material.accent` writes a normal-map alpha of 250 on those pixels) and the shader hides them until ripe.
**Seasons are a hemisphere, not a moment** (`southernSeasonPhaseOf`, `seasonPhaseAtLatitude`, `dateName` in `sim/astro.ts`). `season` is the year as 0..1 (0 is the first of March) and it is the north's; the south is half a year on. `seasonalStateForBothHemispheres(north, south)` builds both tables (`uSeasonal` is two halves, `SEASONAL_LIMIT * 2` vec4s each) and `fall`, `blow`, `litter` as `[north, south]` pairs. The shaders find a place's latitude from its world y (`uLat`, `latitudeOf`) and `southAt` is a smoothstep across +-8 degrees: a prop picks the southern table when its own hash falls under that, so trees at the equator are a patchwork of autumn and spring rather than a seam, and the drift and litter passes just mix the pair. The sun does not care: its declination is the one global `season`. Temperature already took its sign from the hemisphere. The sky panel has a **year slider** (day of the year, `date 17 jun`, with the season in each hemisphere underneath) instead of the wheel, and the strip and tile readout name the season of the place they are looking at. View 5 **seasons** paints each place in its own season's colour (spring green, summer yellow, autumn orange, winter pale), dithered across the equatorial band, with the equator, the tropics and the polar circles ruled in and the night side dimmed. **A flower is not a crown that comes off, so it changes sprite instead of losing pixels.** Each flower is baked three ways (`bud`: a small rosette with a closed bud; the bloom; `seed`: bare dry stalks with seed heads), the bud and seed twins placed by `stages` over every flower mark and drawn only when the season says. `FlowerInBloom`, `FlowerBud` and `FlowerSeedHead` each give an interval `[fromFraction, toFraction)` on a per-flower hash, and the shader discards the *whole sprite* outside it (`wholeSpriteInterval` in `visibility`), so one flower at a time opens in spring and withers in autumn, with no dithered pixels. Heather is dried like grass. **Falling leaves and blown petals** are a screen pass (`fallingLeaves.frag`): world-space cells of 6 m each
holding a few particles that spawn on tiles with a tree (leaves) or a bush or meadow (petals) — a tile-resolution
texture of those sources, rebuilt when the world changes — and ride the wind under them, fluttering, for
a few seconds. They fall in the `shed` and `scatter` seasons only and show from zoom 5 up. **Fallen leaves pile up under
trees** (`litter` in `Phase`, `uLitter` in the grade pass): through autumn the ground within a few metres of a tree
fills with leaf-coloured texels, thickest by the end of autumn, then they rot away fast in early winter and are
gone before the snow settles. They stop at the shore. **A deciduous tree is not a thinned crown but a crown that comes off**: every oak sprite has a
bare twin (`bare.oak.*`, `bareCrown` in `objects.ts`: limbs that bend, fork and spur, in the same footprint,
the way a desert snag is drawn) placed from the tree's own placement and drawn under the canopy whenever the
leaves are going (`leafless` > 0.04). The canopy's pixels are discarded by `bare` until none are left, so as autumn
ends the branches show through, and in winter they are all that is left, casting their own thin shadow.

## The view and the sprite kit

The strip shows the zoom in the same unit every threshold in `render/lit/litLayer.ts` is written in (`GROUND_MARKS_FROM_ZOOM`,
`CLOUD_BODIES_FROM_ZOOM`, `CANOPY_HIDE_FROM_ZOOM`: buffer pixels to the metre, the camera's zoom over `SCALE`), so a number read off the
screen can be typed straight into a constant.

**Every drawing on the map is three-quarter, from about 45 degrees** (`src/pixel/view.ts`). The
ground is seen from above and everything on it stands up: anything lying flat is foreshortened to
`TILT` of its width; anything standing keeps its height and shows its front. `shade()` lights a
heightfield seen from above, so it does not give you this on its own — a standing thing is built
from upright shapes and only its top is a dome.

**Every standing thing casts a shadow**, down and to the right, away from the top-left sun. It is
what pins an upright drawing to the ground. **A hole is drawn by what it does not have**: no
outline and no shadow, since its edge is the ground stopping rather than a thing standing on it.

**Fire and single-cell marks go on after `outline`.** Inked, a flame a cell or two wide is all
outline and stands up out of the fire as a black stick.

**A family of marks is rasterised from one generator, never drawn one by one.** Eight arrowheads
drawn separately come out eight different weights.

The sprite kit under `src/pixel/` is kept whole, including the buildings the old game used. It is
authoring code, it compiles on its own, and it is art that would cost more to redraw than to keep.
`npm run sprites` still bakes it.

## The HUD

The bars and plates are **pixel art, baked** — `src/pixel/ui/` draws them, `npm run ui` writes them
to `public/ui`, and the game loads nothing but the sheets. `metrics.ts` is the one module under
`src/pixel/` the game imports: it is numbers, it tree-shakes to numbers, and it exists because
finding a glyph in a sheet is arithmetic that cannot be written down twice without the two copies
drifting.

**A sheet is baked at the size it is drawn at, and never resampled.** The labels are CSS masks, and
`image-rendering` is not reliably honoured on a mask, so the only way a glyph stays square is for
nothing to scale it. Hence a font baked once per size the HUD uses, and plates nine-sliced at
exactly the pixels they were baked at.

**A plate is a rail, and the face behind it is a surface that tiles.** A nine-slice stretches its
middle, so anything with grain in it comes out as a streak the length of the panel. **A plate's edge
bands must be uniform along the way they stretch**, and the rounding lives in the four corners,
which are never stretched. **Set a plate with the longhands, never the `border` shorthand** — the
shorthand resets `border-image` to `none` and silently takes the rail away.

**A sheet is asked for by version** (`SHEET_VERSION`, bumped whenever `public/ui` is baked again).
They are plain files under `public/`, so a browser holds on to the one it has — and a sheet whose
contents moved then draws the right slot of the wrong picture, which is far harder to recognise
than a blank.

**The seed box is the one place a system face is drawn.** A caret has to sit in a real text field,
and there is no bitmap font for the browser to lay out.

## The menu and the modes

**Nothing imports `game.ts` until a world has been chosen** (`ui/Root.tsx`: menu, then loading, then `App`). `game.ts` builds its singleton from `launched()` (`ui/launch.ts`), so the menu (`MainMenu.tsx`: a baked logo (`pixel/ui/logo.ts`, `public/ui/logo.png`) over `play` and `docs`; `play` opens the saved worlds at once, with a `+` tile first that goes to `create world` (a mode and a seed)) and the loading screen (`LoadingScreen.tsx`) call `launchWith` first. There are no URL parameters: a reload always lands on the menu, and the seed box's `menu` button (`Game.leave`) saves and reloads.

**The loading screen shows the field being built** because `buildField` is `fieldSteps`, a generator that yields a `FieldProgress` (label, share, and the height, water or biome arrays so far) between stages; `buildFieldStaged` awaits a painted frame at each yield, installs the field in the cache, and `World.generate` then finds it. The world and sky spin-up that follow are synchronous and show as the last label.

**A game has a mode** (`GameMode`, `Game.mode`, saved in `SaveData.mode`). `settle` is the game as it was. `discover` places nobody (`People` built with a `null` spawn has `count` 0), never confines or fogs (`free` is always true, `fogView` is null, `widen` does nothing), opens at `fitWorld` and has no zoom floor beyond the world's own; the weather, the seasons and the day run as ever. **A save is a slot, not a seed** (`Launch.slot`, `Game.slot`, `newSlot`): every new game, and the seed box's `open` and `roll`, takes a fresh slot, so one seed and mode can be played any number of times; a slot is only removed by `delete` on the load screen. `savedGames` lists slots, newest first, from a small summary key so the load screen does not parse every save. **Each slot keeps a screenshot** (`Game.shot`, a 320 px JPEG of the ground buffer with the lit layer over it, taken by `shotOf` in `GameCanvas.tsx` in the same frame as each save, because the WebGL canvas can only be read right after it draws; `Game.persist` only sets `saveDue` and the canvas does the save), stored under its own key and shown by the load screen as a four-column grid of tiles. The menu panel leaves 50px of paper on every side.

## The shell

Four slots, always mounted: the **strip** top left (the seed, and what the cursor is over), the
**seed box** top right (type a seed, or roll one), the **bar** along the bottom (clear,
tread, bolt ...), and the **tile sheet** on the right when a tile is open. The middle is the world and
nothing covers it. There is no look tool: with none in hand a left click does nothing, and `Inspect Ground` on the radial menu is how a tile is opened. A tool that cannot be used is dimmed with its reason on its face, because
removing a control teaches nothing.

**A world opens over land** (`openingSpot`): the middle of the map if it is dry, otherwise the
nearest walkable tile found by walking out from it in rings. Opening in the sea on one seed in
three is not a map, it is a blue screen.

**The time controls are the top right** (`TimeControls` in `ShellPanels.tsx`, beside the seed box): pause, play, fast and faster as pixel icons (`fast` is two arrows, `faster` three, baked into `public/ui/icons.png`), the active speed lit; the dock shifts them left when the tile sheet is open. **Left of them is the day dial** (`DayDial` in `ShellPanels.tsx`, drawn by `ui/dayDial.ts` into a 36 x 40 canvas shown at 2x): a wheel of light blue with a sun and dark blue with a moon and stars, and a fixed red arrow above it. It is a function of the *local* solar time under the camera (`Game.localDay`, the same clock as the strip, so `HudSnapshot.dayFraction`), turned clockwise by `(day - 0.5)` of a circle so noon has the sun under the arrow, midnight the moon, and dawn and dusk the edge between them. Every pixel is sampled by rotating its coordinates back into the dial's own frame, so the rotated glyphs stay chunky instead of being resampled; day melts into night across a band `FADE_HALF` either side of the dividing line, in `FADE_STEPS` steps broken by a 4 x 4 Bayer matrix (the same dither as the world, never a smooth blend), and a wooden pin (`pinColour`) sits at the centre while a wooden bezel with four rivets (`bezelColour`) rings the plate, both drawn in the screen's frame so they do not turn with the wheel and the plate reads as held in place by them (the canvas is 40 x 44, sized in `ShellPanels.tsx` from `DIAL_WIDTH` and `DIAL_HEIGHT`); the colours are `DIAL` in `render/palette.ts`.

**Clicking a person selects them** (with no tool in hand a left click goes to `Game.personAt`, which takes the nearest person within `PERSON_REACH_TILES`; clicking anywhere else clears it, and so does Escape, after the opened tile): four pixel corner brackets mark them on the map (`drawPersonMark` in `ui/tileCursor.ts`) and `PersonSheet` in `ShellPanels.tsx` opens under the time controls, on the right (it moves left of the tile sheet when that is open). `ui/personView.ts` turns a person into plain data for it, the same way the tile sheet reads its tile: what they are doing (from the state and task, and whether they are hauling), what is in their hands, body heat in degrees and as a bar (blue when cold), stamina, hunger, thirst and tiredness as bars (the last three with a word: `full` to `starving`, `quenched` to `parched`, `rested` to `exhausted`, and the bar turns red past 0.7), pace in m/s, where they stand, and how they feel (`cold`, `freezing`, `worn out`, `hungry`, `thirsty`, `exhausted`). The loop republishes every 0.3 s while one is selected so the bars move.

**The hovered tile is ringed while a tool is in hand, and the ring is pixels** (`ui/tileCursor.ts`): a one-buffer-pixel
square on the tile's own bounds, in bone, with a second ring inside it for the opened tile. The
map's marks are all pixels — there is no pencil kit any more and nothing should reintroduce one.

**The world is built behind a painted frame.** `main.tsx` renders "raising the world…", waits two
frames, and only then imports `App.tsx` — which pulls in `game.ts`, whose module-level singleton
builds the field. That is about 1.7 seconds of typed-array work; done before the first paint it is
a blank white tab.

## Layering

`src/sim/` must not import from `src/render/` or `src/ui/`, and must not touch the DOM, canvas or
React. `src/render/` reads the simulation and never writes to it. The dependency runs one way:
ui → render → sim. `tools/` use `sim/` and `pixel/` alone.

`ui/game.ts` is state and actions only: the camera, the tool in hand, what is hovered and what is
open. What the panels draw is plain data in `ui/shellView.ts`, built from the world, so a panel can
be stood up without a world behind it.

## Determinism

Insertion order everywhere, explicit tie-breaks. The same seed must always produce the same world —
it covers the height, the water, the biomes, the rivers and the cover. Don't add
`Math.random`, `Date.now` or unordered iteration anywhere the world build reaches. Wall-clock time
belongs to the renderer only.

## The models

`src/sim/models/` is the physics of fire, clay, fracture and knowing — pure functions ported from
`docs/model.js`, with no clock, no DOM and no RNG. `docs/methods.html` draws every figure on its
page by calling them, and **the four ceilings (506 / 697 / 1050 / 1197 °C) and the
damper the air peak sits at** are what it must keep reproducing. Nothing in the foundation
uses them yet; they are kept because they are a specification.

## TypeScript

`strict`, plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`verbatimModuleSyntax` and `allowImportingTsExtensions`. Practical consequences:

- relative imports carry the real `.ts`/`.tsx` extension, so editor go-to-definition works. Don't
  write `.js` specifiers.
- type-only imports use `import type`
- indexing a `Record`/array yields `T | undefined` — handle it, don't assert. In particular
  `array[i] += 1` does not typecheck; read, then write.
- an optional property is omitted, not set to `undefined`
- `noUnusedLocals` and `noUnusedParameters` are on, so dead code fails `typecheck` instead of
  accumulating

**`Biome` is a numeric const object, not a string union.** It indexes the ramp tables and the biome
array directly, which is what removed the string-to-index round trip that used to sit on every
lookup. `BIOME_NAMES` is for showing a player, never for comparing.

## Style

Follow the existing code: no comments (the reasons live in this file and in `docs/`), named
exports, small pure helpers rather than logic inlined into a loop. All colour comes from
`render/palette.ts`; no hard-coded hex in a draw function.
