# Scribble Empire — working notes

This is the **foundation branch**. The settlement game — buildings, carriers, recipes, the book,
the chapter, claims, dispatch, needs — was taken out whole and lives on `main` at `c18a294`. What
is here is the ground it will be rebuilt on: a square metre-scale tile world, generated from a
seed, painted in pixels, and inspectable a tile at a time. `README.md` still describes the old
design and has not been rewritten; trust this file over it until it is.

## Commands

```
npm run typecheck      # tsc --noEmit, strict, covers .ts and .tsx
npm run sim            # the verification levels, exit 1 on failure
npm run sprites        # bakes sprite tiles into public/tiles
npm run ui             # bakes the HUD's font, icons and plates into public/ui
npm run ground         # bakes the ground's textures, masks and decals into public/ground
npm run props          # bakes every lit prop's albedo and normal sheets into public/props
npm run ground:preview -- <textures|decals|scene|seams> <out.png>
npm run terrain [seed] [x] [y] [span]   # every rung over one patch of ground, to /tmp/tiers.png
npm run dev            # the game at http://localhost:5173
npm run build          # typecheck + vite build
```

Both `package-lock.json` and `pnpm-lock.yaml` are committed; the scripts run the same either way.


## Where the code lives

Look for the thing by its name; each is one class or one small module.

**`src/sim/weather/`**, one file per piece of weather, all driven by `Sky` (`sky.ts`):
`temperature.ts` (`Temperature`: heat by place, hour and season), `winds.ts` (`Winds`: the pressure field, the wind it
blows, gale), `pressureCentres.ts` (the highs and lows the wind map draws), `clouds.ts` (`Clouds`: vapour, cloud water,
lift, the kinds of cloud, how they form, rain out and are carried by the wind), `precipitation.ts` (`Precipitation`: rain,
snow, thunder, dust), `groundSurface.ts` (`GroundSurface`: wet ground and snow cover), `stormDamage.ts` (`StormDamage`:
trees felled), `lightning.ts` (`Lightning`: charge, bolts, strikes), `forcedWeather.ts` (what the sky panel forces),
`weatherTextures.ts` (the bytes the renderer reads), `weatherGrid.ts` and `weatherMath.ts` (shared helpers).

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

There is no test framework. `npm run sim` is the test suite — a plain `tsx` script that asserts
and sets an exit code. Run it plus `typecheck` after any change to `src/sim/`. Ten levels, in
`src/cli/`, listed in `levels.ts`: **1** the grid, **2** determinism, **3** the water, **4** the
tile and its handle, **14** the models, **15** the heavens (sun, moon, calendar), **16** the seasons,
**17** the weather (the range of heat, the pressure belts, bounds), **18** the river mesh, **19** the
light (day and night place by place). The numbering has gaps because a level's number is the
name it is cited by, and nothing renumbers behind a deleted one.

Renderer changes are not covered by any of it — **look at them**. `npm run terrain` draws the
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
caller that forgot to check gets a visible wrong answer instead of a silent edge tile. Level 1.

## Data-oriented, with handles over the top

**The data is flat typed arrays; the readable API is a lightweight proxy that owns no data.**
`World` (`sim/world.ts`) holds `biome`, `cover` and `wear` as parallel `Uint8Array`s indexed by
tile. `Tile` (`sim/tile.ts`) is a handle — a world reference and an index, nothing else — whose
getters and methods read and write straight through to those arrays. `tile.wear` *is*
`world.wear[i]`; there is no copy to fall out of step, which is what level 4 asserts.

**Hot loops read the arrays; call sites use the handle.** The proxy exists so that code about
one tile reads as code about one tile. It is not for per-texel work: the painter walks
`world.biome` directly, because allocating a handle per texel would be millions of objects a
frame. If you find yourself constructing handles inside two nested loops, you want the array.

**A new per-tile fact is a new array on `World`, not a field on `Tile`.** Add the array, add a
getter to the handle, and add a line to level 4.

## What a tile remembers

`cover` is what stands on it — bare, grass, scrub, bush, tree, boulder — rolled deterministically
per tile from the seed and the biome, clumped by a noise field so woods come out as woods
(`sim/cover.ts`). Nothing grows with its foot in water. `wear` is how trodden the ground is,
0 to 255.

**Wear fades round-robin, a band of tiles per call, never the whole array.** Three million tiles
swept in one go is a frame spike for something nobody would notice happening gradually. Level 4
sweeps `FADE_SWEEPS(count)` times before asserting a tile faded, because one call does not reach
the far end.

**Changing a tile stamps the coarse block it sits in** (`touch`, `BLOCK_TILES` of 64). The chunk
cache keys on `world.stampOver(bounds)`, so a chunk re-bakes when something inside it actually
changed, and the painter never rescans a chunk's tiles to find out. Without this, keying a chunk
meant reading its 65,536 tiles every frame.

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
none. Level 3 asserts the two still agree.

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
same point gives the same answer however you arrive at it, and level 2 asserts a seed builds the
same world twice.

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
all sea (level 3 walks the border ring). A falloff that merely saturates does not do this — the
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
stacking top-left to bottom-right. Trees are also flipped by a tile hash and scattered 1.7 tiles.

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
tools sit beside `torch`: **bolt** strikes a tile (`Lightning.strikeGroundAt`, which also fells a tree there) and **uproot** fells a
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

## The shell

Four slots, always mounted: the **strip** top left (the seed, and what the cursor is over), the
**seed box** top right (type a seed, or roll one), the **bar** along the bottom (look, clear,
tread), and the **tile sheet** on the right when a tile is open. The middle is the world and
nothing covers it. A tool that cannot be used is dimmed with its reason on its face, because
removing a control teaches nothing.

**A world opens over land** (`openingSpot`): the middle of the map if it is dry, otherwise the
nearest walkable tile found by walking out from it in rings. Opening in the sea on one seed in
three is not a map, it is a blue screen.

**The hovered tile is ringed, and the ring is pixels** (`ui/tileCursor.ts`): a one-buffer-pixel
square on the tile's own bounds, in bone, with a second ring inside it for the opened tile. The
map's marks are all pixels — there is no pencil kit any more and nothing should reintroduce one.

**The world is built behind a painted frame.** `main.tsx` renders "raising the world…", waits two
frames, and only then imports `App.tsx` — which pulls in `game.ts`, whose module-level singleton
builds the field. That is about 1.7 seconds of typed-array work; done before the first paint it is
a blank white tab.

## Layering

`src/sim/` must not import from `src/render/` or `src/ui/`, and must not touch the DOM, canvas or
React. `src/render/` reads the simulation and never writes to it. The dependency runs one way:
ui → render → sim. `cli/` uses `sim/` alone.

`ui/game.ts` is state and actions only: the camera, the tool in hand, what is hovered and what is
open. What the panels draw is plain data in `ui/shellView.ts`, built from the world, so a panel can
be stood up without a world behind it.

## Determinism

Insertion order everywhere, explicit tie-breaks. The same seed must always produce the same world —
level 2 asserts it over the height, the water, the biomes, the rivers and the cover. Don't add
`Math.random`, `Date.now` or unordered iteration anywhere the world build reaches. Wall-clock time
belongs to the renderer only.

## The models

`src/sim/models/` is the physics of fire, clay, fracture and knowing — pure functions ported from
`docs/model.js`, with no clock, no DOM and no RNG. `docs/methods.html` draws every figure on its
page by calling them, and **level 14 asserts the four ceilings (506 / 697 / 1050 / 1197 °C) and the
damper the air peak sits at**, so the document and the code cannot drift. Nothing in the foundation
uses them yet; they are kept because they are a specification, and the level is what says the
document still tells the truth.

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
