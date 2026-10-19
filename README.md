# Scribble Empire

A four-layer logistics settlement game drawn as if on parchment. A deterministic headless
simulation (`src/sim/`) moves carriers, buildings and items; a canvas renderer (`src/render/`)
draws the whole thing in wobbling pencil; a thin React shell (`src/ui/`) owns the camera, the
layer stack and the clock. The simulation never imports the renderer, and nothing in `sim/`
touches the DOM.

```
src/
  sim/           Headless simulation — no DOM, no React, no canvas
    types.ts       ItemType, Block, Design, Building, Path, Carrier, Settlement
    geometry.ts    Vec2 maths, polygon area/centroid/inside, arc-length walking of a polyline
    rng.ts         Seeded PRNG, string hashing, value noise
    terrain.ts     The one terrain field, in world coordinates
    voronoi.ts     Half-plane Voronoi with a windowed clipper
    parcels.ts     The world lattice: three spacings, stable ids, cells on demand
    shapes.ts      Union outline of a group of cells
    recipes.ts     The recipe book a combine block picks from
    blocks.ts      The four block kinds: capacities, what a square accepts, design checks
    designs.ts     The hearth, the starter workshop, a fresh library
    landWorks.ts   The fixed buildings that open the ground: well, dig site, woodcutter
    library.ts     Saving, throwing away and re-tooling designs
    buildings.ts   A standing machine: its squares, their loads, and one tick of its interior
    paths.ts       Breadth-first routing over the path graph
    carriers.ts    Job scoring, reservations, the carrier state machine
    construction.ts Raising and razing buildings
    roads.ts       Painted dirt, and the paths derived from it
    markers.ts     What the land holds and what a parcel yields — a function of position
    worldgen.ts    Founding, and the world container's seed
    world.ts       What a world holds: a seed, a design library, and what has been built on it
    engine.ts      LogisticsEngine: the tick loop and the trace hash
  render/        Canvas 2D, scribble aesthetic — reads the simulation, never writes it
    palette.ts     Parchment, ink, biome and item colours
    scribble.ts    drawWobblyLine and the rest of the hand-drawn stroke kit
    paper.ts       The baked parchment sheet
    icons.ts       Item glyphs and cargo chips
    blockGlyphs.ts One drawing of each block kind, shared by the map, the sheet and the designer
    structures.ts  A building drawn from its own blocks; the deposits the land holds
    carrier.ts     The stick figure and its walk cycle
    camera.ts      Free pan and zoom, in world coordinates
    worldLayer.ts  The land: biome collapse far off, parcels close up
    townLayer.ts   Roads, buildings and carriers
    interiorLayer.ts The orthogonal blueprint sheet
    designerLayer.ts The designer's sheet: palette, grid, hit testing
  ui/
    game.ts         The singleton: world, engine, camera, tools, HUD snapshot
    GameCanvas.tsx  Canvas element, animation loop, pan/zoom, hit testing
    ControlBar.tsx  Zoom readout, play/pause/step, speed
    BuildBar.tsx    The tools and the design library, once the ground resolves into parcels
    Designer.tsx    The canvas a machine is drawn on, and what the pointer does to it
    Ledger.tsx      Carrier states and the hearth's tally
  cli/
    levels.ts      The six verification levels
    render.ts      Console formatting of settlement state
    index.ts       Level runner (exit code 1 if any level fails)
```
npm install
npm run dev        # the game at http://localhost:5173
npm run sim        # headless: the six verification levels
npm run typecheck
npm run build
```

## One world, three levels of detail

There are no regions, no sub-regions and no territories. Unexplored land has never been walked
on, so there is nothing there to bound or to name — only a settlement gives a patch of ground a
name. The map is one continuous world you pan and zoom across, and zooming simply resolves a
finer grid:

| Tier | Lattice spacing | What you see |
|---|---|---|
| World | 31.6 world units | Cells collapsed into biomes: one unbordered shape per stretch of ground, with the rivers and lakes that cross it |
| Country | 7.8 | The same collapse at closer range |
| Ground | 3.8 | Parcels — the grid a settlement is built on |

A tier switches on when its cells reach 17 screen pixels. Set lower, the parcel grid appears
while the cells are still specks and the map reads as mosaic noise; the grid exists to be built
on, so it waits until a parcel is big enough to aim at. The fourth view is unchanged: a
building's interior, a ruled 4 × 4 blueprint, opened over the world rather than inside a layer.

## One lattice, three spacings

Every cell at every tier comes from one lattice in **world coordinates**. A site is a pure
function of its index (`siteOf` in `parcels.ts`), so any part of the program — the simulation, a
chunk being baked, a click being tested — agrees about where the cells are without anything
being stored or passed around. A parcel's id *is* its lattice index, so it is the same parcel
however you arrive at it.

That makes two things free that used to be hard. **Nothing has to tile**, because there is only
one mesh: a chunk of it baked for the renderer and a cell looked up by the simulation are the
same cell, and level 5 proves it by computing the same parcels three ways — alone, in a sweep,
and in a sweep framed somewhere else — and comparing the corners. And **nothing has to be
generated in advance**: a cell is computed when something asks for it.

Hit testing needs no geometry at all. The parcel a point falls in is the nearest lattice site,
which is what a Voronoi cell means, so `cellAt` checks a five-by-five block of indices and is
done.

## Collapsing cells into biomes

Zoomed out, a grid of individually tinted cells is noise. What the eye wants is a coast, a
forest, a moor — so above the parcel tier the cells are grouped into connected runs of one biome
and drawn as one shape each, filled from the union outline.

**Nothing is inked around them.** A drawn border says someone surveyed this ground and agreed
where it ends, and nobody has been here; the change of colour is the whole of the information.
It also means the country tier can be baked in chunks without anything giving that away — an
outline would have to stop at the edge of the chunk it was drawn in and would read as a border
that is not there, while fills carry across on their own because the neighbouring chunk paints
the same colour over the same cells.

What the land holds is drawn on top at every tier. **Resource markers keep a constant size on
screen**, not in the world: fixed in world units they shrink to a speck the moment you pull back,
and what the ground holds is exactly what you want to see when choosing where to settle. Scaling
the radius keeps the glyph's own strokes constant too, since `drawStructure` scales its whole
drawing from that radius. A marker a town has built on is drawn as that building instead, not
twice.

## One field under everything

A world is **built once from its seed**, not sampled. `terrain.ts` is still the only way in and
still answers the same question — what is at this point — but behind it is a field worked out in
one pass over the whole world, half a parcel to a cell, memoised on the seed.

It has to be. Everything up to here was a pure function of a position: ask the noise about a
point and it answered without reference to anywhere else. Water cannot be asked that way. Whether
a river runs through a spot depends on every slope above it, so the question has no local answer,
and a map with rivers is a map that was built. What survives unchanged is the part that matters:
the field is a pure function of the seed, the same seed gives the same world for ever, and the
same lake is the same lake at every zoom — more so than before, because now there *is* only one
of it.

The pass, in order:

1. **The heightmap** — nine octaves of fractal noise from 420 world units down to about one and
   a half, with an elevation falloff toward the edge of the world to put a sea around it. Past
   that edge the falloff keeps growing until nothing can clear sea level: a falloff that merely
   saturates leaves the noise free to throw up land for ever, miles beyond anything the map
   draws. The last three octaves are there for the water — roughness at the size of a cell is
   what gives a river a small valley to find, and without it every river on the map runs dead
   straight down the one slope there is.
2. **The sea** — everything below sea level that can be reached from the edge of the world. What
   is left below sea level is an inland basin, not an ocean.
3. **The hollows** — a priority flood from sea level upward fills every depression until the
   whole of the land drains somewhere. One pass answers three questions at once: what the water
   surface is, which way each cell drains, and where the water stands deep enough to be a lake.
4. **The weather** — temperature from latitude and altitude, and rain by walking the wind across
   the map: it comes in off the sea carrying water, drops it as the land forces it up, and
   arrives dry on the far side. Coasts are wet, a range is wetter on the windward side, and the
   country behind it is a rain shadow. Which band of the globe a world sits in is rolled from the
   seed, so one map is taiga giving way to forest and the next is desert giving way to jungle.
5. **The rivers** — every cell's rain, plus everything the land above it sends down. Where that
   comes to more than a river's worth, it is drawn as one, as wide as its flow and wandering off
   the line between cells so it does not read as a staircase. Rivers meet because two cells
   draining into a third both end their run there; no confluence is special-cased.
6. **The lakes that survive** — a hollow with no river running into it and a hot sky over it is a
   dry basin, which is what the real ones are. Fill every hollow and leave it at that and the
   deserts come out stippled with blue, which is the clearest sign a map was filled in by an
   algorithm rather than by weather. A basin that dries is a *sink*: what runs in stays there,
   so a river ends at it instead of running out of the far side of somewhere that holds nothing.
   Drying and filling decide each other, so they are asked in turn until they agree.
7. **The biomes** — a temperature-by-moisture table, with rock above the treeline, permafrost
   below freezing, and waterlogged ground beside slow water. The method is Azgaar's; the
   vocabulary is this game's seven biomes, so four kinds of rainforest all come out as Forest.

**Fresh water is not the sea.** A lake and a river are biomes of their own, drawn in their own
ramps, and the three water biomes are the three things nothing can be built on.

**A lake swallows its rivers; the sea fans them out.** A river reaching a lake simply stops at
the water's edge — standing water is one surface however much runs into it, and a current drawn
across it reads as a seam rather than as a river. Reaching the sea it widens as it goes, the way
water does when it slows, and dithers into the salt as the bed drops away — so an estuary takes
the shape of its own bay rather than stopping at the coast or running on as a canal.

**A river meanders because the drawing bends, not because the cells do.** The chain of cells a
river runs down can only point eight ways, so on smooth ground it holds one of them for dozens
of cells at a time. Two things fix the ruler that leaves behind: the ground the water is routed
over is gently rumpled, so the drainage itself wanders; and the drawn line is displaced by a
noise field read in world units, so neighbouring cells lean the same way and the river bends
instead of jittering.

**The land is lit from the top-left.** The field carries a height for every cell, so the ground
is shaded by which way it faces: a hillside turned into the sun is a step paler, one turned away
a step darker, and the map reads as terrain with a shape rather than as a flat sheet of biomes.
The light is the same one every sprite on the map is drawn under — one sun, or the shadows on
the ground and the shadows on the things standing on it disagree. What it shades is the *hill*
and not the lie of the country: the broad slope is subtracted first, so a plain that leans does
not come out as a pale stain, and each zoom reads the slope at the size it is drawing the land.

**A shore is a line, not a fade** — the sea's, a lake's and a river's alike. Cells dither into
one another everywhere on the map except across water, where the boundary is cut hard and wanders
instead: stippling the two together leaves a band of texels that are neither, and on something
as narrow as a stream that band is most of it. A river's wander is scaled to its own width rather
than to the lattice, so a creek wriggles tightly where an estuary swings wide, and a river is
never drawn over the sea or the lake it runs into — the water is already there.

**Fresh water is not painted the sea's blue.** The difference decides something — salt is water
you cannot draw on — so the lake and river ramps carry more green and sit higher. A lake and a
river, though, are painted *identically* and shaded off the ground beneath them: they are one
substance, and anything that distinguishes them draws a cut across the water where a river
arrives at a lake.

**A river is a ribbon, not a cell.** A stream a third of a parcel wide cannot be a cell's colour
without flooding the whole cell, so rivers are drawn the way dirt paths are — a line with a width
of its own, dithered out at the bank. The rules test the same ribbon the painter fills: a parcel
is river exactly when the water is drawn over its site, so what you can see and what you can
build on cannot disagree. A creek that runs between two sites blocks nothing and is drawn all
the same.

## The model

**Items.** `Water`, `Dirt`, `Wood`, `Mud`. Three come out of the ground; everything else is
something the player builds a machine to make rather than something the catalogue already knows
about.

**One free resource, two sited ones.** Earth is under every parcel of land — anyone can dig —
water only on a bank: a tile the river or the lake runs through, or one beside it — and wood only
in forest. That is the shape of the opening: the first machine goes down anywhere, the next ones
are a decision about which bank or which wood to stand on. Nothing is marked, because the water
and the forest are already drawn — what the player reads off the map is the thing the rule tests.

**Two kinds of building: land works and workshops.** Where a resource comes from is geography;
how it is turned into something else is the puzzle. So they are split:

- **Land works** (`landWorks.ts`) — the Well, the Dig site, the Woodcutter: one fixed building per
  item the ground gives, not drawn and not in the library. A land work is raised only on a parcel
  that holds its item. A parcel can hold several — a forest on a lake shore gives water, dirt and
  wood — but takes one building, so which of them to work there is the player's choice.
- **Workshops** — everything else is a **design**: blocks on a small grid, drawn by the player,
  kept in the world's library and raised onto any parcel. Two designs with the same blocks are the
  same machine, and the game knows nothing about mills or bakeries. **A workshop never touches the
  ground**: what it works on comes in through its doors, carried there along the roads.

The blocks, of which the player draws all but the first and the last:

- **Source** — the ground opened, and only a land work has one. Draws its item out of the parcel
  for ever, one unit every `INTAKE_TICKS`, straight onto the square it faces. It holds nothing:
  there is no stock to fill up, nothing to run dry, and nothing to draw a number over out on the
  map. `validateDesign` refuses a drawn design with one in it.
- **Input** — a door. Carriers leave loads here and it holds what has not been used yet. It never
  gates where a building may stand, because a carrier can reach anywhere the roads do.
- **Transport** — a belt. Holds one thing and hands it one square along the way it faces.
- **Combine** — one recipe out of `recipes.ts`, with a hopper per ingredient and a small output
  of its own. `Water + Dirt → Mud` is the first.
- **Storage** — a bin. Holds eight of whatever reaches it first and keeps them until something
  wants them; untyped until claimed, so a row of them is a warehouse rather than eight decisions
  made in advance. Carriers both fill bins and fetch from them.
- **Output** — the way out. Stock waits here for a carrier rather than falling out of the wall.
- **Hearth** — the settlement's fire. It swallows nothing: the hearth design is the fire ringed
  by eight bins, and that is the town store. Founding places one; the player cannot.

**The interior is the machine, not a readout of one.** The squares the blueprint sheet draws are
the squares the tick moves things across. A load that lands on a square rests there for
`PUSH_TICKS` before it may move on — that single rule is what makes a belt a belt. It gives the
line both a speed and a throughput, and it means a run declared in flow order carries no faster
than the same run declared backwards; without it the mover would walk a flow-ordered run end to
end inside one tick.

**What the ground gives is a function of where it is.** `landYield` is earth on any land at all,
plus water in any tile a river or a lake runs through, plus wood in forest — every item at once,
not one per parcel — and a land work is the only thing that can draw on it. Nothing is stored and
nothing is marked: the water and the forest are on the map, so the rule and the thing the player
reads are the same thing.

**Items do not teleport.** A `Carrier` is a state machine —
`IDLE → MOVING_TO_SOURCE → PICKING_UP → MOVING_TO_DEST → DROPPING_OFF → IDLE` — that walks the
actual points of a `Path` at a fixed speed. `progress` runs 0 → 1 along the path's own vector and
`direction` says which way the carrier is travelling, so a path is walkable from either end
without a second copy of its points. A route is a list of legs found breadth-first over the path
graph; paths are visited in insertion order, so two equally short routes always resolve the same
way.

## Tick order

Fixed, and every collection iterates in insertion order:

1. **Work** — every building runs its own interior: intakes draw, combines craft, belts step.
2. **Dispatch** — each idle carrier claims the best available job.
3. **Walk** — carriers advance along their current leg and pick up or drop off on arrival.

Dispatch sits between the two so a carrier can claim against production that happened this tick.

## Dispatch

**Reservations are derived, never stored.** What a carrier has claimed — one unit of its source's
output, one slot of its destination's hopper — is recomputed from the live carriers every time a
job is picked. A stale reservation ledger is the one bug in this layer that would be invisible:
the item simply never moves and nothing reports an error.

**Jobs are scored, not taken in order.** Scanning and taking the first match starves whatever
sits late in the list — the well always has water waiting, so the mixer at the far end would
never see a load of earth. Each candidate is scored on:

- **urgency** — how empty the destination hopper is, measured against the batch the recipe needs;
- **pressure** — how full the source's output buffer is, so a backed-up producer drains first;
- **legs** — a mild preference for the nearer of two equal suppliers.

**A store is the destination of last resort.** An empty bin takes anything, so left to compete
the town store would swallow the water a mixer was waiting on. Jobs are scanned once over
everything that makes something and only then over the stores — a rule, rather than the thumb on
the scale a flat penalty was.

**A store feeds workshops, never another store.** Bin stock is not offered when the destination
is itself a store, or a load would shuttle between two warehouses for ever, each taking it in
because nobody else wanted it.

Ties break on insertion order, so the choice is reproducible rather than merely stable.

**A carrier is never stranded.** If the destination hopper filled while the carrier was walking,
it waits a few ticks and then looks for another building that will take the load. A carrier
standing at a full door forever would strand the item it is holding, and nothing else in the
simulation can take an item out of a carrier's hands.

## Determinism

The same seed always produces the same trace. Node iteration follows insertion order, paths and
routes follow declaration order, and job scoring breaks every tie explicitly. Nothing in the tick
path may call `Math.random` or `Date.now`, and nothing may iterate a `Map` or `Set` whose order
is not defined. Level 4 runs two worlds from one seed for 400 ticks and compares a hash of every
building and carrier field.

Animation is the exception and lives entirely in the renderer: wall-clock time drives cogs,
flames and walk cycles, and carrier positions are interpolated between ticks because the
simulation moves a carrier a whole stride at a time.

## The look

Two drawings, and the seam between them is the subject. **The land is pencil on parchment. The
building flow is mahjong tiles on a board.** You are looking at a map of somewhere, and you lay
pieces down on a table to decide what goes on it.

### The land

**A building on the map is drawn as a building**, not as its floor plan: a shed whose width comes
from how many blocks it holds, with a chimney over a combine block, a trough where it draws and
crates at the door it ships from. The plan belongs on the blueprint sheet — out on the land the
player is looking at a village, and the hearth is a ring of stones with a fire in it.

Everything is drawn with `drawWobblyLine` and its relatives (`render/scribble.ts`): a sine for the
long bow of a drawn line, a seeded per-sample jitter for the grain, and a taper to zero at both
ends so joined strokes still meet at the corner. **The seed defaults to a hash of the endpoints**,
which is the whole trick — a line redrawn in the same place every frame keeps the same wobble
instead of shimmering. Anything animated has to pass its own stable seed, not let the position
reseed it.

The sheet itself (`paper.ts`) is baked into an offscreen canvas and blitted, because a few hundred
wobbled grid lines are the one thing here that would actually cost something per frame. The
settlement's ground — parcels, dirt and tracks — is baked the same way and invalidated by
`settlement.revision`, which anything that changes the layout bumps; at 160 parcels, outlining
them live would be the frame budget. Only the parcel under the cursor is outlined per frame.

The world and region maps are baked too, keyed by how many of their cells have been explored:
700 washed mesh cells and 22 wandering outlines are far past what a frame can afford. Hovering,
site marks, waves, markers and hamlets stay live on top. All four layers hold 120fps. Strokes
follow a weight hierarchy — silhouette 2.2, form 1.5, detail 1.0, texture 0.7 — since uniform
line weight is most of what makes line art look amateur. Coastlines are restated heavily; an
inland border is a light pencil division. Fills are hatched rather than flooded.

Carriers are stick figures whose bob is a rectified sine at twice the stride frequency — a body
rises once per step, not once per cycle — with arms swinging in opposition to the legs and the
cargo held in front. A figure sliding along a path without either reads as a token, not a person.

Standing on the pencil are the pixel tiles (`src/pixel/`): a well, a dig, a woodcutter, the
hearth and the villagers. Each is a mask, a material and a light rather than a picture — see
`pixel/index.ts` — baked by `npm run sprites` and laid down one sprite cell to one ground texel,
so a tile coarsens with the ground instead of being stretched to a radius.

### The board

Everything in the building flow — the build bar, the library picker, the designer sheet, a
building's blueprint — is drawn as **chunky bevelled pieces laid on a felt board with a timber
rail**. A block is a tile you pick up and put down, not a labelled rectangle; a tool in your hand
is a tile pushed forward out of it.

The whole of that look is seven nine-slice plates and one sheet of icons, baked by `npm run ui`
into `public/ui`:

| Plate | What it is |
|---|---|
| `board` | Felt let into a rail of oiled timber. Every panel and every sheet. |
| `tile` | A piece lying face up, lit along the top and the left. |
| `tile-hover` | The same piece with the light caught on it. |
| `tile-on` | Pushed forward: the bevel turns over and the face is the map's red. |
| `tile-off` | Face down, and flat — a piece that cannot be laid has no lit edge. |
| `field` | Cut into the board rather than laid on it; the two text inputs. |
| `slot` | Where a tile is not: a square pressed into the felt. |

A plate is twelve cells square, sliced four and four and four, and baked at 3x. **Four cells of
corner rather than three, because that is what a bevel costs** — an ink line, a lit face, the
tile's own face, and the shaded face falling away on the other side. Three cells draw a rounded
box, which is what all of these used to be. The CSS border width is the same twelve pixels the
slice is (`--se-slice`, and `PLATE_BORDER` in `pixel/ui/metrics.ts`), so a corner is laid down at
the size it was baked and never resampled.

**The same plates are laid two ways.** The build bar and the picker are DOM and get theirs
through `border-image`; the designer grid and the blueprint are canvases and get theirs through
`render/hudPlates.ts`, under the same two rules the map's tiles follow — a whole-number
magnification, laid on whole device pixels. That is what makes a block chosen off the designer's
shelf and a block standing on its grid the same object rather than two drawings that agree.
`src/ui/pixel/Tile.tsx` is the one piece in the DOM; anything that wants a row of tiles should
use it rather than restyling a button.

Letters are the 5x7 in `pixel/ui/font.ts`, baked at 2x and 3x and never scaled between them. In
the DOM a glyph is a **mask** and takes its colour from whatever is above it, so a label on bone
and the same label on felt are one sheet and two values of `color`; on canvas the sheet is tinted
once per colour and kept. The font is printable ASCII, and `foldToFont` puts the marks the game
actually writes — the arrow in a recipe, a middle dot, a times sign — onto glyphs it has.

**Colour comes from the shared ramps and nowhere else** (`pixel/palette.ts`). Bone for a tile
face, felt for the board, oiled timber for its rail, ember for what is held. Two icons that each
invent their own brown are two kinds of wood on one bar.

`/lab` is the bench for the map's sprites and `/lab#hud` for the board: both sheets, every plate,
every icon, the designer and a blueprint, with no world under them.

## What is drawn at which distance

Three views, and each draws only what can be resolved at that distance — the look and the frame
budget being the same decision:

| View | Shows | Costs |
|---|---|---|
| Blueprint (a building open) | The design's tiles on a board, loads moving square by square, craft rings turning | One building |
| Settlement (`fine`) | Buildings, carriers walking, buffer chips | One town |
| Far off (`medium`, `coarse`) | One mark per town and its name | A few strokes |

One rule governs every drawing at every distance: **a sixteen-cell icon needs sixteen pixels
before it is a drawing at all.** An item over a building is a baked pixel chip close in and a
pencil mark once the chip is six pixels across; a block on the blueprint is a tile with a face
on it, and below that just the tile. Nothing is squeezed into a size it was not drawn at — see
`render/hudPlates.ts` and `render/sprites.ts`, which refuse rather than resample.

Clicking a town's mark from far off opens its ledger: who is working, who is waiting on
something, what the carriers are holding and what the fire has kept. What the eye cannot resolve
at that distance, the words have to say — and a world of towns then costs a few strokes each
rather than a full draw of every building and carrier in it.

Carriers walk about a parcel and a half a second (`CARRIER_SPEED`), which is people carrying
things on their backs rather than errand-runners sprinting between doors.

## The camera

Drag to pan, scroll to zoom about the cursor. That is the whole of navigation — there is nothing
to click *into*, because there are no layers to descend through. `Esc` puts the tool down, space
toggles the clock.

Zoom runs from seeing the whole world at once to a parcel filling a thumb — enough to read a
settlement building by building.

**The view is held on the map.** The camera is clamped so the visible rectangle stays inside the
drawn area — the world and the sea around it — and the zoom floor is whatever makes that area
fill the window. Without it you can pull back or pan onto bare paper, where the baked land simply
stops but everything drawn live on top of it carries on regardless.

The land is drawn from baked canvases. The world tier is one canvas covering the whole world,
baked once; the two nearer tiers are chunks baked as they come into view and kept least-recently
-used. Anything baked into a chunk is a function of world position alone — never of the shape being
drawn, and never of the chunk. A biome running across several chunks becomes a separate group in
each, so a tone randomised per group, or hatching anchored to a group's own centre, prints the
chunk grid onto the map as a faint checkerboard. Hatch lines sit at absolute multiples of their
spacing and take their wobble from the absolute distance along the line, so two chunks drawing
the same stretch of a biome draw the same strokes.

The parcel tier bakes **two chunk sizes** across its zoom span, switching to smaller ones
up close: one size cannot serve an eightfold range, since a chunk sized for the wide end is
magnified into a blur at the near end, and one sized for the near end puts far too many on screen
at the wide end. The size is part of the cache key, so both live side by side across the switch. **The cache has to hold everything one frame draws** — the chunk budget is sized so that
each tier at its widest still needs only a dozen or so chunks, because a cache that evicts a
chunk every frame and re-bakes it on the next does not look like a cache problem, it looks like
the renderer falling over. Chunks are sized per tier for the same reason: the country tier covers
far more ground per screen than the ground tier does.

Stroke widths are screen pixels divided back through whatever scale they are drawn at. Left in
world units they grow with the zoom, and a pencil line becomes a pale tube — or, on something
small like a cargo chip, a solid disc. Where a drawing is already sized in the caller's units,
its strokes are a fraction of that size instead, which comes out constant on screen for free.

Cell **fills are exact** — only the stroke on top wobbles. Neighbouring cells share an edge to
the last bit, so wobbling each fill independently makes the two edges part company and leaves a
pale gap between every pair of cells. Buildings and resource markers are drawn to about a third
of a parcel, so they sit inside the cell they stand on rather than straddling several.

## Designing a building

A machine is drawn, not chosen. `✎ New design` opens a sheet: click a square to place the block
in hand, click it again to turn it, right-click to clear it. Name it, save it, and it is a
library entry — and the tool in your hand. `✎` beside a library entry opens it again.

The sheet is canvas, drawn with the same pencil as the map rather than as a panel of boxed
symbols — the grid being drawn there *is* the building, so the two have to be one drawing.
`blockGlyphs.ts` holds that drawing: one funnel, one crate, one cog, one belt bed, one fire, used
by the designer, by the blueprint sheet and by the plan of a building standing on a parcel.

`validateDesign` is the whole of the rule: blocks on the grid, no two on a square, every combine
block holding a real recipe, and some way in. It does not ask whether the design is *useful* — a
shed of belts going nowhere is legal, it simply will not do anything.

A building keeps its own copy of the blueprint it was raised from, so editing a library entry
does not quietly re-tool what is already standing. Saving an edit to an entry that *is* standing
somewhere calls `retool`, which rebuilds those buildings from the new blocks and loses whatever
was on their belts. That is deliberate: a blueprint that disagreed with the building on the
ground would be a trap.

## Raising a settlement

Zoom in until the ground resolves into parcels and the tools appear. Take the hearth, click open
ground, and that is a settlement — `canFound` asks only for land nobody has already built on.
There is no resource rule: a town on bare rock is legal and is meant to be. **Founding hands over
a fire and nothing else** — no deposits turned into buildings, no dirt, not one square of belt.
What the land holds is still there, waiting for a machine to be put on it.

- **Buildable**: everything in the library except the hearth. `canBuild` asks for a finished
  design, a parcel nobody has taken, and — for a design with source blocks — ground that holds
  what they draw. The ghost is drawn even where it is refused, with the missing item struck
  through: being told *why* a parcel is wrong is the lesson, and an empty cursor teaches nothing.
- **Water is where the water is.** A source block for water wants a tile the river or the lake
  runs through, or one that shares an edge with it — so the second machine is a decision about
  which bank to stand on. There are no deposits and nothing is marked: the water is drawn on the
  map at every zoom, and a tile touching blue is a tile a well works on. The sea is not water:
  it is drawn in its own blue, and it gives nothing.
- **A well is drawn as a well** — the pool with a bucket beside it, which is the drawing that
  used to be scattered over the map as a spring.
- **Water blocks.** Nothing is founded, built or paved on a parcel the water stands in, and a
  route will not cross one. Two banks a narrow stream apart are still neighbours — the ford is
  the parcel the water misses, and finding it is the player's problem.
- **Carriers are hired as the town grows** — two to begin with, another for every pair of
  buildings, up to a crowd of eight. A town that grows without them looks broken rather than
  busy: everything fills up, nothing moves, and nothing says why.
- **Razing** takes a building and its paths down. The hearth stays. Anything a carrier was
  holding for the razed building is lost: there is nowhere else to put it, and a carrier holding
  a load addressed to a building that no longer exists would wedge.

A settlement owns nothing but what it has built. The tools act on whichever hearth is nearest
what you are pointing at, within reach.

## Dirt paths

The settlement is a parcel map of ~160 cells — small enough to be tiles, irregular enough to stay
hand-drawn. **Paths are not placed, they are derived from the dirt the player lays on those
tiles.** Drag the road tool across parcels to lay a track; a drag that starts on existing dirt
lifts it instead, and the first parcel decides the whole stroke so a wandering drag never toggles
its own work back off.

**Clicking a building with the road tool runs the shortest track to it from the fire.** Painting
the first road out to every new shed by hand is tedium rather than craft, and tedium in the
opening minute is what makes a game feel clunky; the hand-laid path is still there for everything
after that.

After every change, `rebuildPaths` discards the whole network and walks it out again from the
roads:

- breadth-first from each building across road parcels, recording the chain of tiles crossed;
- **building parcels are terminals, not corridor** — a route that ran *through* the mill to reach
  the bakery would make the two look directly linked, and carriers would be sent through a
  building they have no business entering;
- two buildings on adjacent parcels are linked with no dirt at all, which is the one case where
  the chain is empty;
- the tile chain becomes the path's points, unsmoothed: the parcel centres exactly. Smoothing
  looked better on its own and pulled the walk off the road at every corner.

**The road you see is ground, not a line.** A settlement's paths are one per pair of buildings,
so a stretch of road shared by six routes was drawn six times, each from a slightly different
chain of parcels — a tangle of near-parallel curves wandering off the dirt. Inking the dirt's own
links instead fixed the tangle and replaced it with a worse thing: a network of strokes between
cell centres reads as a diagram of a road rather than as a road.

So nothing about the paths is drawn. Each parcel of dirt is a blob of earth pulled back from its
cell's border, and every pair of touching blobs is joined by a neck, so a run of three comes out
as one worn patch the way metaballs merge — a junction is simply where more of them meet. The
whole network is one fill of identically wound sub-paths: filled piecewise it darkens at every
overlap, and mixed winding punches holes through the joins. Necks alone are not enough — they run
along centre lines, so every mutually adjacent triple also fills the triangle on its three
centres, or the middle of each junction stays bare. Because the paths are the same parcel
centres, a carrier walks down the middle of the dirt.

Nothing else may author a path. Keeping a hand-edited path list beside the roads would let the
two disagree, and the disagreement would surface only as a carrier refusing to move for no
visible reason. A carrier whose leg or route vanishes when the dirt is lifted is sent home idle
rather than left walking a path that no longer exists.

**Founding lays no dirt at all** — not even to the water next door. A new town is a hearth and
two carriers with nowhere to walk; every road is the player's to lay. `layTrack` is what the
one-click link and the levels both use, so the opening moves are played rather than handed over.

## Levels

`npm run sim` is the test suite. There is no test framework: `cli/levels.ts` is a plain `tsx`
script that asserts and sets an exit code. Every level founds its own town beside running water
and raises the chain the way a player would, so founding, building and road-laying are exercised
by all of them rather than by one.

| Level | Verifies |
|---|---|
| 1 Intake | A well raised on running water fills itself, and a carrier fetches from it |
| 2 Belts | A load crosses a belt run a square at a time, however the run is declared |
| 3 Mud and the store | Water and earth carried to a mixer, combined, and filed in the bins by the fire — and two warehouses that refuse to shuttle stock between themselves |
| 4 Determinism | One seed, two runs, 400 ticks, one trace hash |
| 5 The ground | One lattice however you ask for it: alone, in a sweep, in a sweep framed elsewhere |
| 6 The library | Founding as a hearth alone; drawing, saving, raising, re-tooling, razing, and the refusals |
| 7 Water | Every river runs downhill to the sea or a lake; nothing is founded, built or paved in the water; a tile the water runs through or sits beside gives water, dry ground and a salt coast do not; one seed builds one world |

Because a world starts empty, every level plays the opening moves itself — walking to the
nearest water, finding a tile it runs through with free ground beside it, founding there, raising
a well on the bank, a digging on open ground and a mixer beside it, then laying the dirt to reach
all three. Founding, designing, raising
and road-laying are covered by the levels rather than assumed.
