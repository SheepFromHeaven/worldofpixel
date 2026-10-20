# Scribble Empire — working notes

`README.md` is the spec: the world and its three levels of detail, designs and blocks, the tick
order, dispatch scoring, the look, the levels.
Read it before changing `src/sim/` or `src/render/` — the rules there are load-bearing, and most
of them exist because something starved or shimmered without them. This file covers only how to
work in the repo.

## Commands

```
npm run typecheck      # tsc --noEmit, strict, covers .ts and .tsx
npm run sim            # the twelve verification levels, exit 1 on failure
npm run sprites        # bakes the map's tiles into public/tiles
npm run ui             # bakes the HUD's font, icons and plates into public/ui
npm run ground         # bakes the ground's textures, masks and decals into public/ground
npm run ground:preview -- <textures|decals|scene|seams> <out.png>
npm run terrain        # every rung over one patch of ground, with the drawn ground on
npm run dev            # the game at http://localhost:5173
npm run build          # typecheck + vite build
```

Both `package-lock.json` and `pnpm-lock.yaml` are committed; the scripts run the same either way.

## Verification

There is no test framework. `npm run sim` is the test suite — a plain `tsx` script that asserts
and sets an exit code. Run it plus `typecheck` after any change to `src/sim/`; it is fast and it
catches the failures that matter (a starved building, a stranded carrier, a drifting trace).

New simulation behaviour gets a new level in `src/cli/levels.ts` — there are twelve. Renderer changes are not
covered by it — look at them. Start the dev server and screenshot the layer you touched; a
renderer bug is invisible to the type checker and to every level.

## The seed

`generateWorld` takes a seed and has no default — one shipped map was the whole game for a
while, and a default is how that happens. The player's seed lives in `?seed=` and nothing else,
so a map is shareable and arriving without one rolls a fresh world. A *rolled* seed is also
checked for land (`landFraction`, a floor of 15%): the noise comes up nearly all sea about one
time in ten. A seed asked for by name is used exactly as given, ocean or not.

**Every cache is keyed by the seed, and this has bitten three times.** The chunk cache, the
renderer's site cache and `parcels.ts`'s parcel cache are all keyed by position — and a position
means nothing without a seed. Leaving the seed out does not look like a cache bug: the new map
simply comes out as the old one, in full, because every cell asked for is already there under
the same key.

## Saving

**The save is `GameWorld` and the tick count, and that is already everything** (`sim/save.ts`).
The terrain, the lattice, the claims, the trees, the parcels a path runs over — all of it is a
function of the seed and of what stands on the ground, so a save that kept any of it would be
keeping a second copy of an answer that is already derivable, and the two would disagree the
first time the generator changed. The one piece of state that does not look like state is the
**wear**: it is in the trace hash, so a world restored without it is a different world.

**A world is stored under its seed** (`ui/storage.ts`, one `localStorage` entry per seed). The
seed is already the map — `?seed=` decides which world the page opens — so what has been built
on it belongs under the same name, and arriving on a seed played before is arriving back in that
town. `newWorld` therefore *opens* a seed rather than starting it: it writes down the map being
left and reads back whatever was last played on the one asked for. Rolling the dice is the fresh
start, because a rolled seed is a world nobody has touched.

Restoring builds every square from the building's own design (`createBlockState`) and then fills
it from the save, so what a square *is* always agrees with the blueprint standing on the parcel
and only what is lying on it comes out of the file. `SAVE_VERSION` is bumped whenever the shape
changes, and a save from another version — or another seed, or one edited by hand — is refused
whole rather than half-read: the caller rolls the world from its seed instead. Level 12 asserts
a saved world reads back on the same trace hash and goes on tracing identically for 200 ticks.

The game writes itself down every few seconds while anything has changed, and on `pagehide` and
on the tab being hidden. Saving on every publish would serialise the whole town several times a
second for a few ticks nobody would miss.

## Founding

A world starts as a seed, a design library and nothing else. Zooming is free; founding is not.
`foundSettlement` is the only thing that creates a settlement and it throws unless `canFound`
passes — land, nobody already built there, and no other town near enough that the two claims
would share ground. Don't reintroduce a resource gate: a town on bare rock is legal and meant to
be, and what the land holds already decides what it can make.

**Every building claims the ground round it** (`claims.ts`): the hearth `HEARTH_REACH` parcels,
every other building `BUILDING_REACH`. A town builds inside its claim and nowhere else (`canBuild`
says so first, before the ground is looked at), and grows it by building near the edge — a sprawl
is allowed and pays in walking. Where two towns' reaches meet, each parcel goes to the nearest
building that reaches it, so the border falls between neighbours and a built parcel is always its
building's town's. A hearth may not be set where its reach would take in ground already held: a
new town never shaves an old one's border back. Water is claimed with the land round it — a
town's pond is its own — and its edge and stones run across it like anywhere else; that is
deliberate, not a missing `isWater`. All of it is derived from the buildings on every
call and never stored; `claims()` caches on the buildings themselves, since the map asks every
frame.

**The edge is border stones, not a line**: a whitewashed block with a red-painted top
(`border-stone`), under half a villager's height, every `STONE_SPACING` (0.6 of a parcel) along
each run of the edge, paced along it rather than set on parcel corners — corners bunch on the
jagged stretches. What makes them read is shape and rhythm, not size: round and grey they were
boulders, round and red-and-white they were wildflowers, a parcel apart they were scattered; a
squared block, close-set, is a border. The red is the top half, not a band, so it survives the
halving one rung out. Where two towns meet only one marks the line. Stones stand
in the depth-sorted list with everything else; the stones a placement would set are previewed
faint under the cursor. `canFound` is no longer "is this parcel free": anything asking that asks
`buildingOn`. Level 9.

**Founding places a hearth and nothing else.** It does not raise anything on the water around
it. An input block raised on a bank draws from it; that is the whole of the connection, and
level 6 asserts a new settlement has exactly one building.

**There are no deposits, and no marker layer.** A spring used to be scattered on a lattice of
its own and drawn on the map, which meant the one findable resource in the world had nothing to
do with the water drawn on it. The water *is* the map now, in blue, at every zoom. Don't put a
marker layer back on top of it — if something new has to be findable, it has to come off the
field the way the water does.

**`landYield` is earth on any land, plus water in any tile the water runs through, plus wood in
forest.** It returns every item the parcel holds, not one: a parcel takes one building, and which
item to work there is the player's choice. One free resource and the sited ones are the shape of
the opening: the first machine goes down anywhere, the next are a decision about where to stand. Don't make earth a marker again — the player
then hunts two kinds of speck before anything can be built, which is where this felt clunky.

## Designs and blocks

A building is a `Design` — blocks on a small grid — raised onto a parcel. There are two kinds.
**Land works** (`landWorks.ts`: well, dig site, woodcutter) are fixed, one per item the ground
gives, and live outside the library; they are the only designs with a `Source` block. **Workshops**
are drawn by the player and kept in the library; `designs.ts` holds the hearth and the one starter
a world opens with. Adding a workshop means adding a *recipe* or a *block kind*, never a building;
adding something the ground gives means a rule in `landYield` and an entry in `LAND_WORKS`.

`validateDesign` refuses a `Source` block and `saveDesign` refuses a land work's id, so the library
can never open the ground. Don't put sources back into `PLACEABLE_BLOCKS` — a workshop that draws
from its own parcel skips the carriers, and the carriers are the game.

**A bin is untyped until something lands in it.** A `Storage` block takes anything while empty
and only that item once claimed, which is what lets eight of them around the fire be a warehouse
rather than eight separate decisions the player has to get right in advance. Capacities live in
`blocks.ts`: a door and a crate hold eight, a bin holds eight, a belt holds one.

**The fire swallows nothing.** The hearth is the centre of the town, not a mouth: `blockSpace`
for a `Hearth` block is 0 and the bins around it hold what arrives. A store that destroyed goods
could never hand them back, and fetching from the town store is the point of having one.

**A source is not an input.** A `Source` block is the ground opened: it draws its item out of
the parcel while a villager works it, holds *nothing*, and hands each unit straight to the square it faces. An
`Input` block is a door: carriers leave loads there and it holds what has not been used yet.
Keeping them one block meant a well had a stock to draw a number over, carriers could be sent to
feed a well, and nothing on the map said which parcels mattered.

`blocks.ts` owns what a square is: its capacity, what it accepts from inside (`blockSpace`), what
a carrier may drop into it (`dockSpace`), and whether a design is drawable at all
(`validateDesign`). Go through those rather than reading `held` and `hoppers` directly — dispatch
reads the same numbers, and a bypass shows up as an item that quietly stops moving.

**A building keeps its own copy of its design.** Editing a library entry must not silently
re-tool what is standing on it; `retool` in `library.ts` does that, deliberately, and loses
whatever was on the belts. Two sources of truth for one machine is the bug this avoids.

The hearth is the one design the player cannot place or throw away. `buildableDesigns` is the
library minus the hearth, and `canBuild` refuses it outright.

## Building

`construction.ts` owns everything that changes the shape of a settlement: `canBuild`,
`placeBuilding`, `canRaze` and `raze`. Founding uses the same `addBuilding`, which is why it does
not check `canBuild` — founding sets the hearth, and the player never may.

Water refuses everything, through `isWater` on the parcel's biome: `canFound`, `canBuild` and the
walking network (`footpaths.ts`, where water is impassable) all gate on it, and `waterCheck` is the
sentence the cursor gives back. The sea, a lake and a river are the same answer to the player.

`canBuild` asks the ground about **land works only**. A land work over ground that does not hold
its item can never do anything, so it is refused and the cursor says why; a workshop is fed through
doors and never gates — carriers feed it anywhere. Land works are placed through the same
`place:<designId>` tool as workshops (`Game.heldDesign` looks in both). That one rule is the whole of siting, which is why
the refused ghost is still drawn, with the missing item struck through.

**A building is placed, then its site is prepared by hand** (`clearing.ts`): its trees felled, then
its plot dug and levelled. `placeBuilding` sets `Building.clearing` — `felling` is a fixed time per
tree on the plot and the ring round it, `needed` adds the digging, costed by the plot's ground (sand
easy, rock hard, never nothing). The trees are the simulation's (`trees.ts`): how many grow on a
parcel and where, so the felling is exactly the trees there and the map draws a tree at each — the
decals only choose *which* tree, by density. A site with no trees is dug from the first stroke; a
villager never swings an axe at nothing.

Only trees are felled (`isTree`, by the `tree.` name): bushes and boulders on the ring round a
building stay — too small to hide it — and those on its own plot are gone the moment it is placed.
Until it is cleared a building does nothing and dispatch neither hauls to nor from it nor works it;
a `clear` job comes before every other errand, one villager to a site, drawn beside the next tree
with an axe (`chop-w`/`chop-e`), then working round the plot with a spade (`dig-w`/`dig-e`) while
the lot spreads out from its middle (`dugAt`). The chunk key carries each felled tree by where it
stood and each site's digging in eighths — **each term reaching exactly as far as the thing it
changes**, a crown's width and a lot's. Taken as one number over a box round the plot, which it
was, every chunk within three parcels was baked again on every tree and every eighth, four chunks
for a change that fell inside one, and clearing a plot churned the ground round it for the whole
of the digging. A felled tree is keyed for a building that is finished as well as one still
clearing, so the term settles rather than vanishing when the work ends. The hearth is exempt: founding is `addBuilding` alone. A level that runs a
building by hand, with no villager to clear it, clears it itself. Level 10.

Bump `settlement.revision` after anything that adds or removes a building; `placeBuilding` and
`raze` already do.

## Footpaths

**Nobody lays a road; walking wears one** (`footpaths.ts`). The ground is a network of nodes — the
middle of every parcel and every corner of it, joined middle-to-corner and corner-to-corner along
the edges — and every step a villager takes onto a node counts (`GameWorld.wear`). A walk is found
when an errand is taken, by A* over that network: worn ground is up to half the cost to cross and
half again as quick to walk, rough ground (forest, marsh, highland) dearer and slower, water
impassable. So traffic falls into the tracks traffic made, and a well-used way deepens into a road.
Every `WEAR_FADE_TICKS` every worn node loses a step, so a way nobody takes grows back. Level 11.

Wear is state, like a building's stock, and it is in the trace hash — two runs that wear the ground
differently are not the same run. A node's id is its place (`c:column:row`, `v:x:y` in
ten-thousandths, which two parcels sharing a corner agree on exactly), so nothing about the network
is stored but the counts.

The painter draws a strip of dirt between every pair of neighbouring nodes that both show
(`footpathRuns`, `PATH_SHOWS`): a faint trail at first, a road's width once worn right in. The chunk
key carries each node's wear in sixths, so a chunk re-bakes when a path through it visibly
changes, not on every footfall. A carrier walks node to node, so it walks on the path it is wearing.

The dirt is the colour of the ground it wears through (`PATH_RAMPS`): leaf-mould in a forest, pale
sand in the desert, grey grit on highland, mud in a marsh. Lots take the same colours.

## Layering

`src/sim/` must not import from `src/render/` or `src/ui/`, and must not touch the DOM, canvas
or React. `src/render/` reads the simulation and never writes to it — if a draw function needs to
change state, the state belongs in `sim/` or in `ui/game.ts`. The dependency runs one way:
ui → render → sim. `cli/` uses `sim/` alone.

## Determinism

Insertion order everywhere, declaration order for paths and routes, explicit tie-breaks in job
scoring. The same seed must always produce the same trace — level 4 asserts it with a hash over
every building and carrier field. Don't add `Math.random`, `Date.now` or unordered iteration
anywhere the tick reaches.

Wall-clock time belongs to the renderer only: cogs, flames, walk cycles and the camera.
`ui/game.ts` interpolates carrier positions between ticks; the simulation never sees a frame time.

## The lattice

`parcels.ts` is the ground everything stands on. A site is a pure function of its lattice index
in world coordinates; a parcel's id *is* that index. Never scatter sites per view, per map or per
settlement — that was the old design, and it meant two views of the same ground had no cell in
common and could only approximate each other where they met.

`cellsIn` computes over a wider rectangle than asked for (`MARGIN_RINGS`) so every cell handed
back has its full neighbourhood; a cell clipped by the edge of one request would differ from the
same cell computed by a request next door. Level 5 asserts a parcel is identical computed alone,
in a sweep, and in a sweep framed somewhere else — compared as a set of corners, because where a
polygon's loop *starts* depends on the frame it was clipped against.

`computeVoronoi` clips against two rings of neighbouring sites above 200 sites, and sizes its
buckets from the bounds' aspect rather than `sqrt(n)`. Thin buckets on a wide rectangle let two
rings miss a bounding site and the cell comes out slightly too large — invisible except as a
seam. Both are exact for jittered-lattice sites and only for those.

## The terrain field

**A world is built once from its seed, not sampled.** `terrain.ts` is the only way in and keeps
the signature it always had, but behind it `worldfield.ts` works the whole world out in one pass,
half a parcel to a cell, memoised on the seed. Read `README.md` for the pass itself.

This replaced the rule that used to be here — terrain as a pure function of position — and it
had to. Where water goes at a point depends on every slope above it, so "is there a river here"
has no local answer. What has *not* changed, and must not: the field is a pure function of the
seed, nothing about it is stored between runs, and the same point gives the same answer however
you arrive at it. Level 7 asserts a seed builds the same world twice.

The pass is four files, in dependency order, and none of them may reach back up:

- `heightmap.ts` — the grid, the fractal field, the shore falloff, `landFraction`.
- `hydrology.ts` — the sea, the priority flood, flow accumulation, lakes, rivers.
- `climate.ts` — temperature, the wind's rain, moisture, the biome table.
- `worldfield.ts` — assembles them, memoises on the seed, and answers questions about points.

`FIELD` is half a parcel and is written as a number in `heightmap.ts` rather than imported from
`parcels.ts`: the lattice reads the field, so taking the constant the other way closes a cycle.
Level 7 asserts the two agree.

**The world is bounded by its own terrain**: past `WORLD_EXTENT` the shore falloff keeps growing
until nothing clears sea level, so there is no land beyond what is drawn. A falloff that merely
saturates does not do this — the noise goes on making islands for ever.

**The falloff's reach is a smooth norm, never `max(dx, dy)`.** The infinity-norm's gradient over
the left and right thirds of the world points *exactly* along x — the same direction at every
point of a third of the map — and on flat ground that is a bigger slope than the terrain's own.
Every river in a plain then runs due east in parallel, evenly spaced, which is most of what made
the map read as a circuit board. A smooth norm (`NORM`) has a gradient that turns with position,
so it steers rivers apart instead of combing them, and it rounds the world's corners off while
it is there. The coastal ramp is warped by a long wave on top (`COAST_WARP`) so the outline is
not a rounded rectangle — but the warp is kept *out* of the term past the extent, because that
one has to stay arithmetic or the skirt stops being wide enough to hold the coast.

**`BEYOND` is derived from `SKIRT`, and must stay derived.** They are the same rule seen twice:
nothing may clear sea level past the extent, and the skirt is where the field stops being
computed at all. A constant for one drifts away from the other the moment the world changes
size — which happened. The extent grew eightfold, the skirt did not, and a strip of land
survived to the very edge of the array. Ground ended by a clamp rather than by a coast is
*exactly* level, so the rivers crossing it ran arrow-straight for a hundred units at a time.

**Nine octaves, and the last three are for the rivers.** Six was enough while the ground was only
ever looked at — the finest was a third of a parcel and nothing below that was missed. Steepest
descent down a field that is smooth at the size of a cell has no small valley to find, so every
river runs dead straight and the whole map drains in parallel lines. The detail is barely visible
in the ground and is most of what the rivers are.

**Route the water down the steepest slope, not back the way the flood came.** The priority flood
reaches a cell from whichever neighbour got there first, which on a gentle slope is the front of
an expanding ring — follow that back and the rivers come out as straight radial lines. The filled
surface guarantees every cell a neighbour strictly below it, so steepest descent is both safe and
what water does. The flood's own order is still the right order to add the flux up in, because a
cell's receiver is lower and so was reached earlier.

**Lakes evaporate, and a dry basin is a sink.** Filling every hollow puts a lake in every basin,
including the ones in the middle of a desert, and a desert stippled with blue is the clearest
sign of a map filled in by an algorithm. A hollow with no river running in and a hot sky over it
is a dry basin — and what runs into it stays there, as it does in any basin with no way out.

Emptying the lake without making it a sink is the worst of both: the fill stays on the routing
surface, so the water still crosses the basin, and the river runs out of the far side of
somewhere that holds nothing. It is also what painted straight rays across a flat (below).
`flow.sink` says so, `accumulate` stops there, and `traceRivers` draws no river on that floor:
the river arrives and ends, which is what an endorheic basin looks like.

**Drying and filling settle each other, so they are asked in turn.** Which basins hold water
depends on what runs in, and what runs into the next one down depends on which of the ones above
it dried. `buildField` accumulates, dries, and accumulates again until nothing more dries, three
rounds at most.

**A flat is drained by the ground under it, not by the fill on top.** Fill a hollow and its
surface is level to the last bit, so the only thing telling one neighbour from another is the
hair's breadth each was raised by as the flood went past — which is a record of how the flood
spread, not of the land. Steepest descent down *that* runs dead straight out of the spill point,
and a basin comes out as a star of straight rivers. `steepest` breaks the tie on the drowned bed
instead, among the neighbours the flood reached earlier — which is exactly the ones whose filled
level is lower, so it can never close a loop.

**The climate is in real units and the game is in 0..1.** `climate.ts` works in degrees and in
the rainfall units Azgaar's biome table is written in, because a model in made-up units cannot be
checked against anything; `environmentAt` is where that is normalised for everyone else. Rain is
scaled back out of per-cell and into per-ground (`SPREAD`), or cutting the field finer would make
the world drier — the wind would cross five times as many cells and dry out five times as fast.

**The ground is lit from the top-left, and the sun is not a free choice.** Every sprite on the
map takes its light from there — it is where the hatching on the pencil drawings comes from and
what the well's own pixels are shaded by — so a ground lit from anywhere else puts the shadows
on the map at odds with the shadows on the things standing on it. `relief` in
`terrainPixels.ts` is the whole of it: two heights off the field, one up-sun and one down-sun.

**It shades the hill, not the tilt of the country** (`BROAD`). A plain that leans one way leans
that way for miles, so lighting the raw slope paints the whole region a shade paler or darker —
a stain on the map rather than ground with a shape, and whole deserts washed out. The broad
slope is measured as well and subtracted, so flat country stays flat however it leans and a
valley cut into a slope still has a lit side and a dark one.

**The sun reads at half a parcel, never at the rung's own cell** (`lit`). A hillside is a thing
in the world with a size, so it has to be lit the same way however close you are standing. Tied
to the lattice — which it was — every rung shaded a differently sized landform out of the same
ground, and one scroll click replaced every shadow on the map with a set belonging to hills
twice as big. That was the loudest of the jumps between rungs, louder than the cells changing
size, and it is the same mistake the water had before `floodedAt`.

Past the point where a texel is wider than half a parcel there is no reading a hillside at all,
so the floor is the *coarsened bed* at its own spacing — the height goes down the same pyramid
as the water (`fieldLevel`), averaged four cells to one. The widest rungs then shade the same
hills averaged down, which is what ground looks like from far off, rather than a point sample of
a hillside nobody can see.

**The blotch is the ground's and the grain is the paper's**, and they must not be scaled the same
way (`step`). The blotch — a patch of scrub, a drier shoulder — has a size in the world and keeps
it at every rung, the way a lake does; the grain is the tooth of the paper the map is drawn on,
so it is a fixed number of texels and comes out the same coarseness at every distance. Scaled by
the rung, as both were, the blotches moved and doubled at every scroll click while the coast
under them stayed put.

`npm run terrain` draws the same rectangle of ground at all nine rungs side by side, magnified to
one size. Framed that way the jumps are the only thing on the page; a rung drawn at its own
extent is a pretty picture of somewhere else and hides exactly this class of bug.

**The shade is a budget, and the light has to be given room out of it.** This is why the land
ramps are wider than they were: the mottle used to take nearly the whole range on its own, so
anything the sun added to a texel already at the top of a ramp came out the same colour. At
five lightness points to a step a whole step of shading is not read as light at all. The ramps
now span about thirty-six points, the mottle's *share* of the shade shrank as the span grew — so
its contrast on the page is about what it always was — and the rest is the sun and the height.

Water is not shaded: the slope under a lake is a thing nobody can see from above, and the sea
picking up a hillside's light reads as murk.

**Standing water is painted off the field, never off the rung's lattice.** A lake is a few
field cells across and every rung's lattice is coarser than that, so a lake painted as the cells
whose *sites* stand in it comes out as a Voronoi polygon roughly where the lake is — and it
changes shape and jumps half a cell every time the rung changes. One scroll click moved a lake
across the map. `floodedAt` reads the water out of the field instead, and a texel the water
covers never looks at a cell at all; the lattice still owns the colour of the *land*, which is
what keeps the ground a mosaic of cells rather than a photograph — and the lattice is now the
parcel's at every rung that matters, so that colour no longer jumps either. A site standing in water is
dropped from the search for a land texel's colour (`WET`), so the mosaic runs up to the bank.

**A rung whose texel is wider than a field cell asks a coarsened copy** (`fieldLevel`). Point
sampling a lake four cells across with a texel sixteen across hits it or misses it depending on
where the texel's centre falls: the ponds that survive are scattered at random and drawn in the
wrong place, and a map stippled with blue is the clearest sign of a world filled in by an
algorithm. Four cells become the answer most of them gave — so water too small to cover a texel
is not drawn at all, the way a river too narrow for one is not, and the big water keeps the
outline it has at every other rung. The levels are built by halves, on demand, once per world.

**No shore is a fade — not the sea's, not a lake's, and not a river's.** The ground dithers one
cell into the next; water never does. Stippling the two together leaves a band of texels that
are neither, and at the size of a stream that band is most of the stream. The sea and the lakes
get their hard edge from the water mask read as a *surface* — the mask taken between the four
cells around the point, crossing zero halfway between a wet centre and a dry one, with noise on
the crossing (`floodedAt`). Read as whole cells it is a staircase of right angles a dozen pixels
on a side wherever a rung draws several texels to a cell. The crossing moves by a fifth of a
cell at most, so the middle of a parcel — which is what `biomeAt` reads and the cursor reports —
is never in doubt. A river gets its edge from its own width (`bankOffset`), because a ribbon has
no cell to take an edge from.

**The meander is a field, not a jitter per cell.** A river's chain of cells can only point eight
ways, so on ground that falls smoothly steepest descent holds one of them for dozens of cells and
then turns a corner: long straight runs meeting at right angles, with the lattice's own axes
showing through — a circuit board. A per-cell offset does not help, because white noise moves
every point its own way: the line comes out furry and a straight run is still straight. The
offset is read out of a noise *field* in world units (`MEANDER`, `MEANDER_WAVE`), so neighbouring
cells get almost the same answer and the whole chain leans one way and then the other. Keep the
amplitude under the step between cells, or a steep part of the field pushes two points past each
other and the line folds back on itself.

**`RUMPLE` is what makes the water itself wander**, and it has to be a real fraction of the
terrain's own slope to do anything — at a tenth of it the flow goes exactly where it would have
gone anyway. The meander bends the drawing; this bends the drainage, which is the honest half of
the fix.

**A river's wander is scaled to the river, not to the lattice.** The coast wanders by a third of
a *cell* because a cell is the only scale it has. A stream a texel across doing that would spend
most of its length somewhere other than where the water is, so `bankOffset` works in multiples of
the river's own half-width — a creek wriggles tightly, an estuary swings wide.

**Fresh water and the sea must not be the same blue.** They started two shades apart and that was
fine while it decided nothing. It decides something now — salt is water you cannot draw on, fresh
is water you can — so a player who cannot tell them apart is reading a refusal that looks like a
bug. The lake and river ramps carry more green and sit higher than the ocean's.

**A lake and a river must be *exactly* the same blue, and shaded the same way.** They are two
biomes because the rules need two — the cursor says which you are standing on — but they are one
substance, and a river is only the shape water takes on a slope. Give the river its own ramp, or
its own shading by how deep into the ribbon a texel falls, and every place a river meets the
water it is running into comes out as a hard cut across the surface: a line that is not there,
in a place where nothing happens. So the two ramps hold the same values and both are shaded off
the bed underneath (`step`), which is continuous across the join because the ground is.

**Water is three biomes and they are what blocks.** `isWater` covers Ocean, Lake and River;
`waterCheck` is the sentence the cursor says. Don't test `elevation < SEA_LEVEL` for this — a
lake stands above sea level and a river runs over land.

**A river is a ribbon, not a cell.** It is narrower than a cell, so it cannot be a cell's colour
without flooding it; it is drawn the way a dirt path is drawn, and `groundBiomeAt` is the biome
with the rivers taken off for the painter. The rules and the painter test the same ribbon —
a parcel is river exactly when the water is drawn over its *site* — so what you see and what you
can build on cannot disagree. A creek between two sites blocks nothing and is drawn all the same.
Don't "fix" that by widening the test: the painter would have to widen with it.

**A lake swallows its rivers; the sea mixes with them.** Two endings, and only one of them is
drawn.

A river reaching a lake stops being drawn at the water's edge. Standing water is one surface
however much runs into it, and anything drawn across it reads as a seam in the lake rather than
as a river going somewhere. This was tried the other way — a run per lake cell, which fanned
each lake into a star of rays because inside a lake every cell's receiver points back the way
the flood came; then one narrow line per inlet, walked down the drainage, which was legible and
still wrong. A lake is a lake.

The sea is the one that mixes, and it does not stop at a line or carry straight on either —
water leaving a river slows as it meets the sea, so it spreads. The painter takes the mouth out
in a few widening steps (`DELTA_*`) and `plume` takes it away again over the shelf, which
together read as a fan; carried on at its own width it reads as a canal. The depth is measured
off the sea bed rather than off a distance from the shore, so an estuary has the shape of its
own bay. The simulation's ribbon is untouched by any of it — the rules still end the river where
it ends, and a parcel out at sea is sea.

**A well wants water in its tile, or in the one next door**, and it takes both tests to cover
the shore.

`freshWaterIn` is the first: the tile itself, not a circle round its middle. A Voronoi cell is
convex, so a run of river crosses it exactly when the point of that run nearest the site falls
inside it; when the centre line passes just outside, the water still reaches in if the bank on
the cell's side does; and the corners and edge middles are read as well, because a lake that
takes one corner of a tile is in the tile. This is the only test that finds a creek, which is
narrower than the gap between two sites and so is never any parcel's biome.

The second is `landYield` asking whether any neighbouring parcel is fresh water. A lake's cells
stop wherever they stop, nowhere near the line the lattice drew, so a quarter of the tiles that
visibly touched a lake had no water *inside* them and refused a well for a reason the player
could not see. Sharing an edge with water is a reason anyone can see. `isFresh`, never
`isWater`: the sea is the one shore that gives nothing.

**The nearest-water question is asked several times a second** — the ledger turns it into "two
hundred paces north-east" — so it goes through `marks`, one scrap of water per sixty units,
searched in rings. Scanning the runs and the lake cells is a sweep of the whole world, which at
this extent is a quarter of a million runs and twelve million cells.

## Detail tiers

`detailFor` picks a tier from the zoom. Above the parcel tier, cells are collapsed into connected
runs of one biome and drawn as one shape — a grid of individually tinted cells reads as mosaic
noise at any distance. **Don't ink a border round them.** A drawn border says someone surveyed
the ground and agreed where it ends, and nobody has; it also cannot survive chunk baking, since
it would stop at the chunk edge and read as a border that is not there.

**One pixel, and every drawing stands on it.** `TEXELS_PER_PARCEL` is the game's pixel: a
thirty-second of a parcel, in the world, and the grid the sprites are authored on — a well is
32 cells across a parcel, a villager 16 across half of one. Sprites therefore go through
`drawTile`, which takes a *world* point and no size at all: a tile's size is its cells, one to
the texel, snapped to whole buffer pixels. A tile scaled to some caller's radius is a second
pixel grid on the same screen, and the eye reads the finer one as a picture lying on the map
rather than as part of it.

**A tile follows the rung, by halving.** A sprite cell is a ground pixel, so when the ground
steps out to a rung with twice the texel, the tile is drawn from a grid with half the cells —
same patch of world, half the pixels, the way anything looks from further away. The halvings are
built once at load, each an exact two-to-one reduction, and nothing is ever drawn at a size
between two of them. Below `MIN_TILE_CELLS` a tile is a smudge rather than a small drawing, so
`tileFits` says no and the caller skips: that one test gates the deposit markers *and* whether
`drawTowns` is called at all, which is why towns and the things in them appear together.

**The ground is a ladder of rungs, each a texel half the size of the one below** (`LEVELS`,
`levelFor`). **A rung is a texel and nothing else**: the lattice it paints its mosaic on is
derived from it by `mosaic`, never chosen beside it.

**That lattice is the parcel's, doubled only when it must be.** Sites are a pure function of a
lattice *and its spacing*, so two spacings share no cell and no boundary — a ladder of spacings
picked per rung paints a different country at every one of them, and a desert one plot wide
becomes a blob eight plots across on a lattice eight times as coarse, in a place no parcel is
desert. One scroll click moved it and resized it. Held at `PARCEL` until a cell is down to about
four texels (`MOSAIC_MIN_TEXELS`), the four closest rungs paint the simulation's *own* cells —
the ones `parcelOf` reads and the cursor reports — so over the range anyone plays at the ground
does not merely stop jumping, it stops being an approximation. Further out a parcel is not worth
drawing and the lattice takes the same halving step the texel does.

Raising the floor does **not** calm the far rungs down, which is the tempting move: a coarser
lattice is *bigger* blobs, so the world view comes out as a handful of flat cells. Four texels to
a cell up there is the generalisation that still has the island's shape in it.

`GroundLevel.detail` stays a separate field from `spacing`: `detail` is the simulation's tier —
whether a town is a mark or a place you can build in — and it still turns over at the zooms it
always did, however finely the ground is stepped underneath it.

`MIN_TEXEL_PIXELS` is **2**: a rung is held until its own texels are four buffer pixels and only
then handed on to one whose texels are two, so the ground is chunky everywhere and stays chunky
for a long stretch of zoom. Switching at one pixel instead spends the whole range at the smallest
pixel there is, and resets the ground to specks every time you zoom in.

**Three things are wanted here and only two can be had at once**, so don't rediscover this by
changing one of them alone:

- *fluid zoom* — the drawn scale is the camera's, whatever it is;
- *big pixels* — `MIN_TEXEL_PIXELS` above one;
- *even pixels* — every texel on screen the same width.

A chunk is baked at a pixel to the texel and magnified, so a fractional magnification always
leaves some texels a pixel wider than their neighbours. Under two that unevenness reads as
variation in the ground; at 2.85 it is a regular ripple that reads as a fault. The even-pixel
cure is to snap `viewZoom` to a whole number of pixels per texel, which was tried and gives a
ladder of about fourteen zoom steps — worse to live with than the ripple. So: fluid and big, and
the ripple is the price.

Skip a marker whose parcel already carries a building, or it is drawn twice at two different
sizes.

## Caching the ground

`settlement.revision` is bumped by every structural change. The land is baked — one canvas for
the world tier, chunks for the two nearer ones — and the towns are drawn live on top, so a path
or a building appears without any cache being invalidated.

**Baking has a budget per frame** (`BAKE_BUDGET_MS`): missing chunks are baked holes first — a
chunk with no stand-in at all — then the ones that have something to show, each nearest the middle
of the view first, at least one a frame; a chunk still waiting is drawn from the last canvas baked
at its place (`latest`) or the coarser rung's chunk over it (`standIn`).

**A rung being passed through is not baked at all** (`drawnRung`). Crossing a rung leaves every
chunk on screen missing at once, so a wheel run through five rungs asks for sixty bakes and gets
one a frame: the sharp ground arrives in a patch that is still spreading when the next rung throws
it away, and what the eye sees is the middle of the map flickering between the coarser rung
magnified and the new one. A chunk that has a stand-in waits until the rung has held still for a
frame — the zoom runs on the stand-ins, which is what they are for, and the ground sharpens from
the middle out the moment the wheel stops. A hole is baked whatever the zoom is doing: bare paper
is worth a dropped frame and a road one tree out of date is not. Baking every missing
chunk in the frame that found it froze a pan for a tenth of a second, and the arrival of the drawn
ground — which re-keys every chunk — for half of one.

**The cache budget must exceed the number of chunks drawn in one frame.** This has bitten twice.
A cache that evicts a chunk every frame and re-bakes it on the next costs tens of times the frame
budget, and it does not look like a cache problem — it looks like the renderer falling over.
Chunks are sized per tier (`CHUNK_CELLS`) so each tier at its widest needs only a dozen or so;
if you change a spacing or a tier threshold, check the count again.

**Stroke widths are screen pixels.** Divide them by whatever scale they are drawn at — the bake's
scale inside a chunk, the camera's zoom outside one. Left in world units a pencil line becomes a
pale tube as you zoom in, and on something small like a cargo chip it swallows the icon whole and
leaves a solid disc. Where a drawing is already sized in the caller's units (`drawItemIcon`,
`drawStructure`), make the stroke a fraction of that size instead — it then comes out constant on
screen without anyone passing a zoom in.

**Anything baked in chunks must be a function of world position alone** — never of the shape
being drawn, and never of the chunk. A biome running across several chunks becomes a separate
group in each of them, so a tone randomised per group, or a hatch anchored to the group's own
centre, paints the chunk grid onto the map. It shows up as a faint checkerboard, which reads as a
rendering artefact rather than as the seeding mistake it is. `hatchRegion` places its lines at
absolute multiples of the spacing and takes its wobble from the absolute distance along the line
for exactly this reason.

Every rung bakes the **same 256-pixel chunk** — `LEVELS` carries the cells per chunk that makes
that true, which is why a rung reading eight texels to a cell takes thirty-two cells and one
reading thirty-two takes eight. So a chunk costs the same wherever you are (~20ms), and the
number on screen only varies with how far the rung has been magnified. The rung is part of the
cache key.

## Fills are exact, strokes wobble

`fillPolygon` fills a cell with the polygon exactly as computed; only the stroke on top gets the
hand-drawn wobble. Neighbouring cells share an edge to the last bit, so wobbling each fill
independently makes the two edges part company and leaves a pale gap between every pair of
cells — which reads as the mesh coming apart, not as a fill problem.

## Stroke seeds

Every wobbled stroke is seeded. The default seed is a hash of the stroke's endpoints, so a line
redrawn in the same place keeps its wobble. Anything that moves must pass its own stable seed —
derive it from the entity id, not from the position, or the line will shimmer as it travels.

The reverse rule holds for anything two shapes share: **never pass a polygon-wide seed to an
outline that a neighbour also draws.** Parcel edges and coastlines rely on the endpoint default
so a shared edge comes out as one line. Seeding per polygon doubles every border, and it reads as
a sawtooth rather than as two lines, so it is easy to misdiagnose.

The endpoint default is only half of it. `wobblePoints` **canonicalises the direction** of a
segment before doing anything else: the seed is a hash of the endpoints *in order*, and the
offset is measured along the normal, so the same edge traversed backwards got a different seed
and a mirrored wobble. Two cells sharing an edge each drew their own curve. If you add another
stroke kind that two shapes can both draw, it has to go through `wobblePoints` for this reason.

## Buffers and hoppers

A square's load lives in `BlockState.held`; a combine block's ingredients live in its `hoppers`,
one per item its recipe asks for. Go through the helpers in `blocks.ts` and `buildings.ts`
(`placeInBlock`, `takeFromBlock`, `depositHopper`, `withdrawOutput`, `hopperSpace`) rather than
touching `amount` directly.

Carrier reservations are derived from the live carriers on every dispatch, never stored. Don't
introduce a ledger.

**Dispatch runs for every idle carrier every tick, so nothing in it may be per pair of buildings.**
It never searches for a route: it weighs errands by straight-line distance and takes every pair of
buildings to be walkable until a walk between them is looked for and fails (`blocked`, forgotten
when the town changes). The walk itself is found once, when the errand is taken. Working out
ahead of time which buildings share dry ground meant laying out the parcels round the whole town —
a quarter-second freeze on the first errand of a game — for an answer that is nearly always yes. Within one dispatch, who supplies an item and what each
taker wants are worked out once, not inside the loop over the other side. Asked per pair, a sixty-building town spent most of a frame on a tick; now it is well
under one.

**The ground gives nothing on its own.** A land work draws only while a villager is inside it on
a shift (`job.kind === 'work'`): the well a bucket in five seconds, the dig five loads in ten, the
woodcutter ten logs in fifteen (`LAND_WORKS`, in ticks). The worker walks there, goes off the map
(`Working`), draws the batch a unit at a time onto the building's belt, and comes out when the
batch is *in the crate* — not when the last unit leaves the ground. Out any sooner and it stands
at an empty crate with its own load still on the belt, finds nothing to carry, and goes straight
back in; that is what the first pass did. Who is inside is derived from the carriers like any
claim (`manned` in the engine and in dispatch), never stored on the building.

A shift is only offered when the crate has room for the whole batch (`groundRoom`), so a land
work's crate holds at least a batch — the woodcutter's ten logs are more than the usual eight.
`findJob` hauls for the workshops, then works the ground for them, then hauls to the stores, then
works the ground for the stores; and a haul from where the carrier is already standing scores
`HERE_BONUS`, which is what makes the worker carry out what it just drew. Level 8 asserts all of
it.

`staffSettlement` hires up to `CARRIERS_FOR(buildings)` whenever a building goes up — it never
fires anyone, because a carrier mid-haul has an item in its hands that nothing else can take.

A **store** — anything with a bin in it, the hearth included — is the **destination of last
resort**: an empty bin takes anything, so `findJob` scans everything that makes something first
and the stores only afterwards. Don't put it back on a score penalty — a penalty is a number that
can lose, and the water a mixer is waiting on then goes into a bin.

**A store feeds workshops, never another store.** `availableSupply` drops bin stock when the
destination is itself a store; without that a load shuttles between two warehouses for ever, each
taking it in because nobody else wanted it. Level 3 stands two warehouses next to a full one and
asserts nothing moves.

## What is drawn at which distance

Three views, and each one draws only what the eye can resolve at that distance. This is the LOD
rule and the performance budget at the same time, so don't widen one without the other:

- **blueprint** (a building open) — individual loads moving square by square, the craft ring
  turning. The only place single items are animated.
- **settlement** (`fine`) — buildings, carriers walking, buffer chips. No per-item motion.
- **far off** (`medium`, `coarse`) — one mark per town and its name, nothing inside it drawn.
  `drawTowns` is not called at all up there; clicking the mark opens `statsLayer`, which says in
  words what the eye can no longer see. Before, the town was drawn in full under its own mark at
  `medium` — twice the work for something nobody could read.

`ui/game.ts` owns `tickFraction`, the renderer's only view of the clock, and both the carriers
and the belts interpolate with it. A belt square's `cooldown` *is* how far across the load has
got; without the fraction on top it steps twice a square instead of running.

## Drawing a block

On the map a building is a **building** — `drawWorkshop` in `structures.ts` reads the design and
bolts a chimney, a trough or a stack of crates onto a shed. Don't print the floor plan out there
again; the plan is what the blueprint sheet and the designer are for, and a grid of squares on a
parcel reads as a diagram of a village rather than a village.

`render/blockGlyphs.ts` holds **one** drawing of each block kind, in the caller's own units.
Two places draw blocks — the blueprint sheet and the designer's grid — and both go through
`drawBlockFace`. Don't add a third funnel; they drift apart by the second block kind someone
adds.

The designer is canvas (`render/designerLayer.ts`), not DOM. `layoutDesigner` is a pure function
of the viewport, the draft and the selection, and both the draw and the hit test call it — which
is why clicking lands on what you can see without a layout cached anywhere.

## Interiors

The interior **is** the machine now, not a readout of one: the squares drawn on the blueprint
sheet are the squares `processBuilding` moves things across. A load that lands on a square rests
there for `PUSH_TICKS` before it may move on, which is what gives a belt a speed and a throughput
at all — take it out and a belt run declared in flow order walks an item end to end in one tick
while the same run declared backwards crawls.

The renderer reads `cooldown` to place an item part-way across its square. Don't animate it off
the clock instead: what is drawn on the belt has to agree with what the simulation says is on it,
or an item appears to arrive before it has.

## The view

**Every drawing on the map is three-quarter, from about 45 degrees** (`src/pixel/view.ts`). The
ground is seen from above and everything on it stands up: anything lying flat — a pool, a ring
of stones, a shadow — is foreshortened to `TILT` of its width; anything standing — a trunk, a
wall, a person, a flame — keeps its height and shows its front. It was three cameras on one map
before (buildings from overhead, the villager from the front, trees from above) and nothing
looked wrong until they stood next to each other.

`shade()` lights a heightfield seen from above, so it does not give you this on its own: a
standing thing is built from upright shapes (a trunk capsule, a wall below a rim, tongues of
flame) and only its *top* is a dome. Check a new sprite against the others with
`ground:preview -- scene`, which stands the tiles among the trees.

**Every standing thing casts a shadow**, down and to the right, away from the top-left sun —
`groundShadow` for the shape. It is what pins an upright drawing to the ground. A tile is baked
without knowing what it will stand on, so its shadow is `SHADOW`, translucent ink; a ground decal
uses the ground's own darkest step instead. Both have to come out the same weight.

**Fire and single-cell marks go on after `outline`.** Inked, a flame a cell or two wide is all
outline and stands up out of the fire as a black stick; a two-cell chip comes out solid ink.

**A hole is drawn by what it does not have**: no outline and no shadow, since its edge is the
ground stopping rather than a thing standing on it. You see its far wall and its floor over the
near lip, and it is shaded on the side *nearest* the sun, where the rim throws shadow in — a lump
is lit there. The dig is the worked example; drawn as an inked dark shape it read as a mound, and its spoil
banked along the far rim read as a slab laid over it — the heap stands beside the hole instead.

**The villager is drawn a pixel at a time, not shaded** (`villager.ts`): a four-cell head, a
four-cell tunic lit on its left, and limbs one cell thick, with the ink *outside* the silhouette.
Shaded capsules with a traced outline, like the buildings, came out three cells a limb and turned
an arm raised to the face into one brown lump. There are two — `villager-woman` and
`villager-man`, same skeleton, differing in hair and hem — and a carrier is one or the other by
its id (`buildOf`). A land work shows its worker in its own tile, so it has a work clip for each
(`work`, `work-man`); an arm is never longer than it hangs (`ARM`), and a tool is held at the
hand the arm actually reaches, at a fixed haft length.

**A villager walks eight ways, and none of them is a mirror.** `walk-<heading>` and
`carry-<heading>` for each of `HEADINGS`, and `idle` facing the viewer for standing still. A
mirrored tile takes its light from the right, and everything else on the map is lit from the
left, so every heading is drawn — the heads as rows (`HEADS`), since at four cells which way
someone looks is a matter of single pixels. `headingOf` picks the heading from the carrier's own.
`render/sprites.ts` lists the headings again (the game cannot import authoring code); the bake
refuses if the two disagree. Sixty-six frames would make a strip no browser decodes at the usual
magnification, so `npm run sprites` halves the magnification of any strip past `MAX_STRIP`; the
renderer reads the frame size off the image.

**Things further down the map are nearer**, and overlap what is behind them. `drawTowns` draws
standing decals, buildings and villagers as one list sorted by their foot — a building's is the
front of its lot (`BUILDING_FOOT`) — and the chips over buildings after all of it.

## The ground sprites

`src/pixel/ground/` holds the drawn ground: **textures** (what a material is made of), **masks**
(how it spreads into a neighbour), **decals** (what lies and grows on it). `npm run ground` bakes
them to `public/ground`; `render/groundSprites.ts` loads them in the background, and until they
arrive the ground is painted the old way — `groundVersion` is in the chunk key so every chunk is
baked again once they have. The CLI previews have no browser to load with and build the same
data from the authoring code (`cli/groundSource.ts`).

They paint only the rungs on the parcel lattice (`MIPS`, halved per rung); further out the old
mottle is the ground. A texture is read at the texel's *world* index and a mask decides every seam
(`seam`) — never the Bayer threshold, never anything about the chunk.

**Decals are placed per parcel**, a pure function of the parcel's lattice index and biome
(`placementsIn`), so a tree is the same tree in every chunk and every frame. Nothing grows on a
built parcel, a worn path, or with its foot in water; and no *tree* grows on the ring round a building,
or a forest swallows the town. Flat marks are baked into the sharpest rung; standing
things are baked on the rungs too far out for the town (`LIVE_MIPS`) and drawn live with it on the
rest — `drawnLive` is the one rule for both, since the close rungs have no trees baked in.
`pavingIn` looks three parcels past a paved square, because that is how far a lot and the trees it
clears reach into a neighbouring chunk.

**A building stands on its lot**, a parcel of trodden earth (`LOT_HALF`) painted in the same pass
as the paths, so a path runs into it with no seam. At a path's width the lot was entirely under
the building's tile, and every building stood on grass with its path vanishing beneath it. The
dirt belongs to the ground, not the sprite: drawn into a sprite it has its own edge and shade, and
sits on top of the path instead of joining it.

**A texel is a hand's breadth.** The villager is sixteen texels tall, so a grass blade is one or
two texels, a bush a dozen, an oak thirty-odd wide and forty tall. Check a new decal in `ground:preview -- scene`,
which stands a villager and a well beside everything; a mark drawn at the wrong scale turns a
forest into moss, which is how the first pass came out.

**Textures and ground cells in decals are ramp steps, never colours.** The biome and the sun
pick the colour per texel; a texture fixed in RGB would throw away both and the palette with
them. Decals pack this in the alpha — 255 a colour, 1–5 a ground step, 0 clear — and the ground
cells are resolved where the decal is laid, against the ramp and step the painter recorded for
that texel (`paint`, `stampDecals`): the darkest step of whatever land is there, or on water the
water two steps darker, broken by ripples. Resolved against the decal's own ground, a forest tree
by a river left a green blob on the water and a green one on the path. So a shadow is always
baked into the ground — even for a tree drawn live, which is drawn without its shadow, since up
there it cannot see what it is standing over.

**Fields are code, marks are rows.** Textures and masks are generated: 128 texels that must wrap
at every edge are not drawn by hand. Decals under a dozen texels are rows of characters, where
every pixel is a choice; trees, bushes and boulders are shaded like the well. Every generator
wraps on `TEXTURE` — a noise size or a scatter step that does not divide it draws the repeat as
a seam across the map.

**One mask per material, not per pair.** Where two meet, the one higher in `PRIORITY` spreads
through its own mask. Masks are rank-equalized, so a strength of 0.2 turns over a fifth of the
texels; noise left as it is bunches in the middle and the edge lurches across in one step.

## The HUD

The bars, the ledger and the designer's chrome are **pixel art, baked** — `src/pixel/ui/` draws
them, `npm run ui` writes them to `public/ui`, and the game loads nothing but the sheets.
`metrics.ts` is the one module under `src/pixel/` the game imports: it is numbers, it tree-shakes
to numbers, and it exists because finding a glyph in a sheet is arithmetic that cannot be written
down twice without the two copies drifting into every label at once.

**A sheet is baked at the size it is drawn at, and never resampled.** The labels are CSS masks,
so a button's text can be the colour of the button; `image-rendering` is not reliably honoured on
a mask, so the only way a glyph stays square is for nothing to scale it. That is why the font is
baked once per size the HUD uses (`FONT_SCALES`) rather than once and scaled, and why the plates
are nine-sliced at exactly the pixels they were baked at — `border-image-width` and
`border-image-slice` are the same nine, so a corner is drawn one to one.

**A plate's edge bands have to be uniform along the way they stretch.** CSS stretches the middle
row and the middle column; anything that varies there comes out as a streak the length of the
panel. The rounding lives in the four corners, which are never stretched, so it is the same
rounding on a button and on a panel ten times its size.

**The icons are objects, not symbols.** The tool that founds a town is a fire and the one that
razes is a pick, because the bar sits over a map where every building is already a picture of
itself. They are written as rows of characters (`art.ts`) rather than coordinate lists: at
sixteen cells every pixel is a decision, and rows are the only form in which that decision can be
read in a diff. The legend is shared for the same reason the ramps are — two icons that each
invent their own brown are two kinds of wood on one bar.

**The bar has no Inspect button, and the library is not on it.** Inspecting is what an empty
hand does — a click on a building the tool has nothing to say about opens it anyway — so a
button for the resting state would be the one pressed nearly all the time. A tool clicked twice,
Escape, or raising what was in hand all put it down again. The library sits behind `Build`,
which holds what is in hand and opens a menu: a shelf grows a button per design and the player
may draw as many as they like, so three starters already made the bar the widest thing on screen.

**Raising something puts it down, unless the chaining key is held** (`chaining` in
`GameCanvas.tsx`, shift). `found` and `build` in `game.ts` deliberately do *not* reset the tool:
only the click knows whether the key was down. A tool that stays in hand by default turns every
stray click on the ground into a shed nobody asked for, and with no Inspect button there is
nowhere obvious to put it down.

**Only the starters have drawings.** The library is open-ended, so there is no icon to be had for
a machine nobody has invented yet; `DESIGN_ICONS` in `BuildBar.tsx` covers the starter a world
opens with and everything else gets the blueprint; the land works take theirs from `LAND_ICONS`
in `LandBar.tsx`, which says correctly that this one is the
player's own.

**The two text inputs are the one place a system face is drawn.** A caret has to sit in a real
text field, and there is no bitmap font for the browser to lay out — so the seed box and the
designer's name box use a monospace face inside a pixel plate.

`npm run sim` does not cover any of this and neither does the type checker. Bake, open the page
and look at it.

## TypeScript

`strict`, plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`verbatimModuleSyntax` and `allowImportingTsExtensions`. Practical consequences:

- relative imports carry the real `.ts`/`.tsx` extension, so editor go-to-definition works.
  This relies on `allowImportingTsExtensions`, which in turn requires `noEmit` — nothing here
  emits via `tsc` (vite builds the bundle), so that holds. Don't write `.js` specifiers.
- type-only imports use `import type`
- indexing a `Record`/array yields `T | undefined` — handle it, don't assert
- an optional property is omitted, not set to `undefined`

## Style

Follow the existing code: no comments unless the *why* is genuinely non-obvious (the ones in
`carriers.ts`, `engine.ts` and `scribble.ts` are the bar), named exports, small pure helpers in
`geometry.ts`/`buildings.ts` rather than logic inlined into the tick loop. All colour comes from
`render/palette.ts`; no hard-coded hex in a draw function.
