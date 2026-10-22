# Scribble Empire — working notes

`README.md` is the spec: the world and its three levels of detail, designs and blocks, the tick
order, dispatch scoring, the look, the levels.
Read it before changing `src/sim/` or `src/render/` — the rules there are load-bearing, and most
of them exist because something starved or shimmered without them. This file covers only how to
work in the repo.

## Commands

```
npm run typecheck      # tsc --noEmit, strict, covers .ts and .tsx
npm run sim            # the verification levels, exit 1 on failure
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

New simulation behaviour gets a new level in `src/cli/levels.ts` — eighteen of them, numbered to
20 because 2 and 13 were dropped and nothing renumbers behind them: a level's number is the name
it is cited by, here and in the code, so the gaps stay. The longer ones (17 to 20) sit in files of
their own beside it rather than growing that one past reading. Renderer changes are not
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

**The book is the other thing nothing derives.** What a town has worked out how to do — its
methods, the trials behind them, the techniques the rows have earned a name for — is not a
function of the seed or of what stands on the ground. It is what the town found out, and a world
restored without it is a town that has forgotten how to fire a pot while its kiln is still
standing. So the book is written out whole, rows and all, and a rig's build params and the batch
it is part-way through go with the building that holds them.

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

**Founding is shown before it is done.** With the hearth in hand, the claim it would hold is
marked parcel by parcel with what each holds (`drawFoundingYields`, `proposedClaim`), because
"a town on bare rock is legal and meant to be" is only a fair choice if the bare rock can be
seen coming. What the opening wants first is `openingItems` — the items of the land works that
follow from the fire alone, read off `STEPS` so it moves when the chapter does — and it stands
in a row of its own at full strength while everything else sits under it, quiet. Rows, because a
bank holds six or seven things and in one line that is wider than the parcel. The claim is
`HEARTH_REACH` (four) parcels round the fire: three held too little to promise both something to
gather and a bank to dig, and five already held seventy before anything was raised.

**Founding places a hearth and nothing else.** It does not raise anything on the water around
it. An input block raised on a bank draws from it; that is the whole of the connection, and
level 6 asserts a new settlement has exactly one building.

**There are no deposits, and no marker layer.** A spring used to be scattered on a lattice of
its own and drawn on the map, which meant the one findable resource in the world had nothing to
do with the water drawn on it. The water *is* the map now, in blue, at every zoom. Don't put a
marker layer back on top of it — if something new has to be findable, it has to come off the
field the way the water does.

**`landYield` is earth on any land; water, mud and clay on a fresh-water bank; deadwood wherever
anything grows; wood in forest; fibre on any growing ground.** Fibre is one item wherever it
came from, and which building may draw it is the land work's `where`: the reed bed only on
marsh and quick, the fibre patch on meadow, forest, highland, tundra or desert and slow. Cord
and daub open on either (`afterAny` in `chapter.ts`), so no town is shut out of the vessel by
the ground it was founded on. Level 6. The bank gives three because they are one bank
seen at three depths. Deadwood and cut wood are not the same rung — deadwood is gathered off a
meadow as readily as out of a wood, which is what keeps a town founded on open ground from
opening with no fuel at all, where wood wants a standing tree and an axe to put through it. It
returns every item the parcel holds, not one: a parcel takes one building, and which
item to work there is the player's choice. One free resource and the sited ones are the shape of
the opening: the first machine goes down anywhere, the next are a decision about where to stand. Don't make earth a marker again — the player
then hunts two kinds of speck before anything can be built, which is where this felt clunky.

## Designs and blocks

A building is a `Design` — blocks on a small grid — raised onto a parcel. There are two kinds.
**Land works** (`landWorks.ts`: well, dig site, woodcutter, forage camp, bank dig, clay pit,
reed bed) are fixed, one per item the ground gives, and live outside the library; they are the only designs with a `Source` block. Everything
else is a **rig**, and `designs.ts` holds all of them.

**The library is a catalogue, not a sketchbook.** `startingLibrary` is the chapter's own
buildings and nothing else: the player does not draw a design, cannot save one, and cannot throw
one away. The unit of progress is the *method* — what the town has worked out how to do, written
in the book — so a building is a fixed thing the chapter hands over and the interesting choice is
which recipe runs on it. There was a designer and a library of the player's own patterns
(`saveDesign`, `saveAsPattern`, `removeDesign`, `retool`, and `library.ts` to hold them); the
document replaced all of it, and it is gone. Adding a station means adding an entry in
`STARTER_DESIGNS` *and* a step in `chapter.ts`, or it is a building nothing can ever raise;
adding something the ground gives means a rule in `landYield`, an entry in `LAND_WORKS`, and a
step.

`validateDesign` refuses a `Source` block, so nothing outside `LAND_WORKS` can open the ground.
Don't put sources back into `PLACEABLE_BLOCKS` — a building that draws from its own parcel skips
the carriers, and the carriers are the game.

**A bin and a crate are untyped until something lands in them.** A `Storage` or `Output` block
takes anything while empty and only that item once claimed, which is what lets eight bins around
the fire be a warehouse rather than eight separate decisions the player has to get right in
advance — and what lets a pick-up bay serve whatever the line brings it. A crate that took one
named item made the player choose, before anything was built, which of a machine's products that
corner was for, and a crate standing empty beside a line carrying the wrong thing is not a
decision but a trap. `OutputBlock.item` survives as a *label* for the drawing where anyone knows
in advance (a land work's crate takes what its source draws) and is never a rule: what may be
collected is what is standing there. Capacities live in `blocks.ts`: a door and a crate hold
eight, a bin holds eight, a belt holds one.

**The fire block swallows nothing; the hearth building does.** The two are different things and
keeping them apart is the whole of this rule. A `Hearth` *block* is not a mouth: `blockSpace` for
one is 0 and the bins around it hold what arrives — a store that destroyed goods could never hand
them back, and fetching from the town store is the point of having one. The hearth *building* is
a rig, and a rig eats: its methods take Deadwood out of those same bins and give back Embers,
and take a basket and daub and give back a Vessel. That is deliberate and it is where the heat ladder starts — a
town whose only fire did nothing but hold things would have nowhere to begin.

The consequence is worth knowing before it surprises you. A store is also the destination of last
resort, so deadwood hauled to the hearth *because nobody else wanted it* is fuel thrown on the
fire: a forage camp working with no workshop asking for it is feeding the hearth's queue. The only
thing that stops it is the shelf: the fire makes embers until there is room for no more, and
the bins hold eight.

**A source is not an input.** A `Source` block is the ground opened: it draws its item out of
the parcel while a villager works it, holds *nothing*, and hands each unit straight to the square it faces. An
`Input` block is a door: carriers leave loads there and it holds what has not been used yet.
Keeping them one block meant a well had a stock to draw a number over, carriers could be sent to
feed a well, and nothing on the map said which parcels mattered.

`blocks.ts` owns what a square is: its capacity, what it accepts from inside (`blockSpace`), what
a carrier may drop into it (`dockSpace`), and whether a design is drawable at all
(`validateDesign`). Go through those rather than reading `held` and `hoppers` directly — dispatch
reads the same numbers, and a bypass shows up as an item that quietly stops moving.

**A building keeps its own copy of its design.** Two sources of truth for one machine is the bug
this avoids, and it is why nothing re-tools what is already standing.

The hearth is the one design that is never placed at all. `buildableDesigns` is the library minus
the hearth, and `canBuild` refuses it outright.

**The bar is a readout of the chapter, not the enforcement of it** (`chapter.ts`). `canBuild`
asks `designOpen`/`workOpen` first, before the ground is looked at, so a step the town has not
reached cannot be raised however it is asked for; the bars simply do not draw it. A step is
*done* when the thing it gives is standing and *open* when everything it follows from is done —
derived from the buildings on every call, never stored, for the same reason `claims.ts` is.

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

## Work areas and slots

**The map carries work areas, not machines** (`sim/area.ts`, `docs/methods.html` §3). An area is
one parcel with a few slots; the code still calls it a `Building`, since it is what stands on a
parcel. `Building.slots` holds a design per slot and, for a station, its `Rig`; the stage
(`STAGES`, 1 to 5 slots) sets how many. **Slots are all alike.** Two rules keep the ground in
it: a land work goes in a slot only where the parcel yields what it draws (`workServes`), and an
area opens its ground once (`groundSlot`), which is what keeps the town from collapsing into two
fat areas. A pool work, the forage camp, gathers whatever turns up and stands anywhere.

**The player builds one thing, a work area** (`placeArea`, the `area` tool): one open slot on
free ground inside the claim, cleared by hand like any site. What stands in it is chosen from its
own sheet, a slot at a time (`choicesFor`). There are no special buildings and no catalogue on the
bar: the bar is Found, Work area and Raze.

**Founding makes one area with two slots filled** (`foundSettlement`): a Fireplace and a forage
camp, at the Yard stage, free. The Fireplace is `HEARTH_DESIGN`, kept under that name in code and
`settlement.hearthId` names the founding area; the word never shows on screen. It carries the
`store` flag, so that area's shelf is the town's.

**The stage ladder** is Clearing (1), Yard (2, three stones), Walled yard (3, cord and daub),
Roofed works (4) and Stone works (5, one slot the chimney's). Stones come from the forager, whose camp
has two recipes (`pools`, set per slot by `Slot.recipe`): deadwood and stone, half each, so
every roll finds something; and berries 20, fibre 70, so one roll in ten finds nothing. Four rolls
a shift either way.

**The list belongs to the area, the knobs to the slot.** `Building.queue` is one ordered list of
`{ methodId, slot }` lines; each station scans only the lines bound to it (`linesFor`), in the
area's order, and runs its own batch. Two of a station are two lines running side by side, the
only parallelism there is. Everything in an area shares the shelf, so a hand-on between two
stations in one area costs no carrier; between areas somebody walks. A land work's shift lands on
its own area's shelf, which is how the camp feeds the fire beside it. Level 20.

**Placing onto a parcel with an area puts the design in a free slot** (`canBuild` asks `slotFor`
first): no new clearing, only the slot filled. `razeSlot` takes one station out, and the last
one takes the area with it. **A stage is ordered** (`orderStage`): its whole cost is the area's
want (`stillWanted`, `stageCost`, and `wanted` so it is carried at all), then it is built round by
hand on the same `clear` errand a site is cleared with (`workOnStage`). Walls warm the fires
inside (`warm`, `WARM_WALL` in `heldBuild`); a roof refuses `needsSun`; stone gives a slot to the
chimney.

**The inspector is docked, and nothing covers the middle** (`ui/AreaSheet.tsx`, `ui/dock.ts`, `docs/methods.html` §3, "Nothing covers the middle" and "The rail, and why a header is the whole trick"). It is a rail on the right edge, `DOCK_WIDTH` wide and full height, with no backdrop, so the map stays live under it: a click on another building opens that one and a click on bare ground puts the rail away. The selected area is ringed on the map in buffer-pixel dashes (`drawSelectionRing`, `TownView.selectedBuildingId`), and if it falls under the rail the camera moves and the rail never does (`Game.clearOfDock`). Inside it are framed groups (`Frame`): a groove with its lit lip, the word breaking the top run so it costs no row. In order: `work` (the slots, three to a row, and the way about the rail), `production` or, with a slot chosen, that station by its own name, `stored`, and an unlabelled foot. Only the middle one ever changes. **Anything that holds something is a hollow** (`.se-hollow`, carved in, top and left walls in shadow): a slot holds a station and a stored cell holds goods, one hollow per item, three to a row, the count cut into its corner and the name on hover. **The chosen slot is the same hollow turned over, lifted, and that is the only selection mark; pressing it again is the only way back to production.** There is no header and no yard mark. The foot is one line: the five stage pips, the cost pips beside them (`se-cost-pip`, filling as goods arrive), and the raise button, which is the one bordered control. The chosen banking is underlined, never given an arrow. `RigSlab` and `HoldingSlab` stay for the bench.

**The area screen is weighted by how often a thing is wanted** (`docs/methods.html` §3, "Laying the sheet out"). What stands here is the slot row, with no border round a filled slot: the sprite is the affordance, an empty slot is a dashed patch, a locked one the same patch with a small closed mark, a busy one smokes. The list is one grid, the same four columns and the same height on every row: station, inputs, time over the arrow, outputs. Stage and the raise sit last and quiet, a cost as pips that fill rather than `0/2`. **Red means a station has stopped for want of something, and nothing else**: the cross over a blocked slot and over the input a stuck line is short of (`ListLine.short`), with the row dimmed. A pool's finds are icons after the draw count, with no numbers; the chances live on the slot's own screen. **No item icon may be an X**: it reads as the blocked marker. The only bordered control on the sheet is the raise button, because it spends materials.

**On the map** a clearing with one thing in it is drawn as that thing's tile; anything walled, or
with nothing or several things in it, is the yard ring with each slot as its `mini-<designId>`
sprite round the parcel and empty ones as `mini-slot`, so the slots can be counted. A roofed
area is `works-roofed` or `works-stone`: smoke at the vent while a fire inside works, a glow at
the door while anything does, a strike over it when stuck.

## Rigs, methods and the book

**A rig is capital, a method is knowledge, and the queue is policy.** Three things on purpose
(`process.ts`, `book.ts`), and almost everything else here is a consequence of keeping them
apart. A rig is masonry on a floor: its build params — flue, wall, chamber, firebox — are settled
when the building goes up, they fix an **envelope** (the hottest it can ever be driven), and the
only way to change them is to tear it down. A method is a recipe with its settings written down,
and it is portable: stamp it onto any rig whose envelope can take it. The queue is an ordered
list of methods on one rig, scanned top to bottom, first entry that can run. So one fire runs
lime today and brick tomorrow, and a rig that cannot reach white heat refuses the lime method
**in plain words** (`Refusal`) rather than quietly making bad lime — a rig that stops silently is
the thing this layer exists to prevent.

**An entry runs until its output has nowhere to go.** There is no stop target: capacity is the
stop (`roomFor` against what it makes, refused as `full`), and an entry with room below it
starves nothing because a full one is passed over. The queue is still an order, and what it
decides is which entry gets the fire while more than one can run.

**A batch under way is never rescanned.** A rig takes its inputs when the batch begins — so a
carrier cannot walk off with what it is about to use — and asking the queue again mid-batch finds
exactly those inputs missing, refuses the entry that is running, and abandons the batch with the
goods already gone. The scan belongs between batches and nowhere else.

**`envelopeOf` is memoised, and it has to be.** It is a sweep of a few thousand `fire()` calls
over every fuel, damper and charge rate the masonry allows, and it was being asked on every scan
of every queue every tick — a couple of hundred thousand float steps a tick for one hearth. The
answer is fixed in the masonry, so it is worked out once per set of build params and kept.
Uncached it does not read as a slow function; it reads as the game failing to start.

**Switching entries on a fire rig costs a changeover** (`CHANGEOVER_TICKS`): the fire comes down
and goes back up. That one number is what pushes the player into firing campaigns — all the lime,
then all the brick, the way kilns were actually run — so running the same entry again pays
nothing against itself.

**A rig reads its doors as well as its bins** (`heldFor`). A door is a terminus and nothing inside
the building moves a load on from one, so a rig that looked only at bins reported "no Clay" for
ever with eight loads of clay standing in its clay door.

**The book belongs to the settlement, not the world.** A second town founded later starts
ignorant, which is a real cost and a real story: methods travel by being carried, not by existing.

**Charcoal is not a free upgrade, and a lazy clamp is a tax on every kiln in town.** It carries
twice the energy of wood and wants nearly twice the air, so a rig switched to it before it has
the flue to feed it runs *colder* and smokes while it does. And a clamp's one knob sets yield and
grade against each other — vents nearly shut gives a lot of half-burnt brands, opened gives
proper charcoal and less of it — so what the method asks for is the clamp's intent and `runRig`
substitutes what the pile actually gave.

**A clamp is not one of `RIGS`.** Those four are chambers the document fits ceilings for; a pile
cooking itself has no chamber at all, and keeping `clamp` out of `RigId` is what stops
`envelopeOf` ever being asked a question it cannot answer about one.

**`src/sim/models/` is the physics, and the fitted constants are the specification.** `heat.ts`,
`clay.ts`, `fracture.ts` and `knowing.ts` are pure functions ported from `docs/model.js` — no
clock, no DOM, no RNG — and `docs/methods.html` draws every figure on its page by calling them.
Level 14 asserts the four ceilings (506 / 697 / 1050 / 1197 °C) and the damper the air peak sits
at, so the document and the code cannot drift: move a fitted constant and that level is what says
the document now lies. Levels 15 and 17 are the same claims made of buildings standing on the
ground, and level 18 is what the town is allowed to *say* it knows — a method is believed on
evidence, and the evidence is floored by the instrument that read it.

## The map's marks are pixels

**Nothing is said on the map in pencil, and the pencil kit is gone** (`scribble.ts` was deleted
with the last stand-in that used it: the shed, the stick figure, the item glyphs and the ghost's
caption). A ghost under the cursor is named on the same slate a standing building is, and what
a land work would draw is its item's icon under that, struck through where the ground lacks it. A building's doors were marked on the ground once —
each bay served from a corner of its parcel, which had to be shown or the mechanic was invisible
— and two passes at it were wrong in the same way, so don't take either road again. A **pencil
thread** from the building to the corner said neither which way nor what: a hairline over grass,
several crossing a parcel at once, and nothing about a line carries direction or identity. Then
the same thing **drawn in the map's own hand**, a wobbled chip and a wobbled arrow, put a sketch
over a map whose every other mark is pixel art; the two idioms will not sit together at this
size. Anything new that has to be said out here is said in pixels — an icon off the HUD sheet, a
tile, a bitmap glyph.

**A family of marks is rasterised from one generator, never drawn one by one.** Eight arrowheads
drawn separately come out eight different weights, and a row of them on one map then reads as
eight different kinds of mark. The widest case sets the box: for an arrow that is the diagonal,
whose barbs project on both axes at once, so the shape that just fits pointing east runs off the
corner pointing north-east.

**A symbol is drawn at a fixed number of buffer pixels** (`RAZE_PIXELS`), not over a patch of
world, so it holds its size as the map is zoomed and never coarsens with the rung — the same
rule a town's name and a town's mark are drawn by. Two marks that belong together need a fixed
gap for the same reason: a parcel is half the screen at one zoom and a few pixels at another,
and anything measured in world units stops reading as one marker.

**Ask `drawIcon` for a whole icon box, never a fraction of one.** An icon is `ICON_CELLS` square
and it wants a whole number of device pixels to the cell, so a box under sixteen floors to none
and it draws *nothing at all*, silently — which is how a mark came to be missing while the ones
beside it were fine.

**The hovered parcel is never outlined.** It was a red pencil line traced round the cell under
the cursor, and it was the last scribble left on a map whose marks are all pixels — a hand-drawn
ring over ground that is painted, stones that are sprites and labels that are bitmap glyphs.
What the player needs to know is *what would stand here*, which the ghost says by standing there;
the cell it stands on needs no ring round it to be the cell it stands on. Gating it on "only
where a ghost is about to stand" was a half-measure that left it exactly where it was most often
seen.

**One mark at a time, and only where the cursor is.** Everything a carrier could reach was
marked at first, which on the hearth is eight bins round the fire and comes out as a star over
the town's own fire. What the map marks is what the tool in hand would do to the one thing it is
pointing at.

## One bar, one thing to build

**The bar is Found, Work area and Raze** (`BuildBar.tsx`). The Resources and Manufacturing bars
are gone, and with them the catalogue: the player marks out a work area and fills its slots from
its sheet, so where to site and what to run are decisions in the same place. The seam those bars
kept apart is kept in the slot rules instead (a land work needs the ground, a station does not).

**There is no designer button, and no library of the player's own drawings.** A machine is not
drawn in the abstract and never was worth drawing twice.

**A slot's list shows no step the town has not reached, and greys none out.** A shelf of locked
doors is a list of the things the game is withholding, and the player should have no reason to
want a kiln before there is anything to fire in one. `choicesFor` walks `STEPS` and keeps the
ones `designOpen` and `workOpen` allow, and `canBuild` refuses the rest. What the ground refuses
is shown dim with its reason, since that is the ground's answer and not the chapter's.

## Footpaths

**Nobody lays a road; walking wears one** (`footpaths.ts`). The ground is a network of nodes — the
middle of every parcel and every corner of it, joined middle-to-corner and corner-to-corner along
the edges — and every step a villager takes onto a node counts (`GameWorld.wear`). A walk is found
when an errand is taken, by A* over that network: worn ground is up to half the cost to cross and
half again as quick to walk, rough ground (forest, marsh, highland) dearer and slower, water
impassable. So traffic falls into the tracks traffic made, and a well-used way deepens into a road.
Every `WEAR_FADE_TICKS` every worn node loses a step, so a way nobody takes grows back. Level 11.

**Nobody walks through a building, and nobody walks into one either** — that is the walk's
business rather than the painter's (`builtMiddles` and `setOff` in `carriers.ts`, `shut` in
`routeNodes`). A parcel's middle is a neighbour of all six of its corners, so the cheapest way
*past* a well went in one side of it and out of the other, over the shaft, and no amount of depth
sorting makes that read as anything but wading through the masonry. Every built parcel's middle is
shut out of the search but the one being walked to, so the walk goes round by the corners and wears
a path round the building. The network itself knows nothing about what is standing on it: the
caller says which nodes are shut, and the set is kept per town until a building goes up or comes
down, like `blocked`.

A haul then **stops at the door's corner** rather than stepping on into the middle, which was a
step into the building: the last thing a villager did on the way to the well was walk over the
shaft and stand in it. `syncPosition` pinned it there too, and now only somebody *inside* — a
worker on a shift, who is off the map — is at the parcel's middle. The town also runs slightly
better for it, since a haul no longer walks the last half-parcel in and back out again.

**Nobody wades, and the water is in the step, not in its ends.** A river is a ribbon narrower
than the gap between two sites, so asking the two ends of a step what they stand on passes a
step straight over a stream — which is what villagers did. `neighbours` drops any step whose
*line* meets water (`waterBetween` → `crossesWater` in `worldfield.ts`): the walk against the
river's own half-width, the same ribbon the painter fills, and the standing water sampled along
it for a lake cell lying between two dry ends. It is filtered there rather than in `stepCost`
so the painter gets it too — `footpathRuns` draws between neighbours, and a trail that stops at
the bank is drawn because no step crosses. The test is symmetric in its two ends, which the
network needs, and it is cached with the adjacency because it costs far more than the adjacency
does. A river with no ford is a wall: two parcels facing each other across one are a hundred
nodes apart, and `route` returning null for a building on the far bank is the answer, not a bug.

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
`tileFits` says no and the building is drawn on one depth key rather than a piece per stone — at
that size there is nothing left for the sort to tell apart. How far out a town is drawn at all is `drawnLive`'s question and not this one's: the same
rule the standing trees take, so a town and the wood round it turn over together.

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
Chunks are sized per rung (`GroundLevel.cells`) so each at its widest needs only a dozen or so;
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

## Buffers and hoppers

A square's load lives in `BlockState.held`; a combine block's ingredients live in its `hoppers`,
one per item its recipe asks for. Go through the helpers in `blocks.ts` and `buildings.ts`
(`placeInBlock`, `takeFromBlock`, `depositHopper`, `withdraw`, `hopperSpace`) rather than
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
(`Working`), works the whole shift, and only then hands the whole batch into the building's stock
at once and comes out beside it. Every production works this way, a rig's batch included: the
time runs out first and the goods appear together, so the popup's filling arrow and what lands
in the store say the same thing. Dribbling a unit out every few seconds made a forage camp read
as a stick every three and a half seconds rather than four sticks for fourteen. Who is inside is derived from the carriers like any
claim (`manned` in the engine and in dispatch), never stored on the building.

A shift is only offered when the crate has room for the whole batch (`groundRoom`), so a land
work's crate holds at least a batch — the woodcutter's ten logs are more than the usual eight.
`findJob` hauls for the workshops, then works the ground for them, then hauls to the stores, then
works the ground for the stores; and a haul from where the carrier is already standing scores
`HERE_BONUS`, which is what makes the worker carry out what it just drew. Level 8 asserts all of
it.

`staffSettlement` hires up to `bedsIn(settlement)` whenever a building goes up — a town is as big
as the beds it has built, which is the next section — and it never fires anyone, because a
carrier mid-haul has an item in its hands that nothing else can take.

A **store** — anything with a bin in it, the hearth included — is the **destination of last
resort**: an empty bin takes anything, so `findJob` scans everything that makes something first
and the stores only afterwards. Don't put it back on a score penalty — a penalty is a number that
can lose, and the water a mixer is waiting on then goes into a bin.

**A store feeds workshops, never another store.** `availableSupply` drops bin stock when the
destination is itself a store; without that a load shuttles between two warehouses for ever, each
taking it in because nobody else wanted it. Level 3 stands two warehouses next to a full one and
asserts nothing moves.

## Needs come first

**Each villager has three meters, thirst, hunger and rest, that only run down** (`needs.ts`,
`DRAIN`). A day is a minute at normal speed (`DAY_TICKS`, 600), and the drains are tuned against
what villagers actually do, errands included: about three drinks, two meals and one sleep a day,
which level 16 holds to. Retune the errand lengths with them, or a shorter day spends itself on
walking to the bank. When one falls to `LOW` the villager takes no more work and goes to see to it: a
drink, a meal, a sleep. The check is in dispatch, between errands: a walk already begun is
finished and a land work's shift is worked to its end. The two open-ended jobs, a watch at a rig
and clearing a site, are put down when a need comes due, since both keep their progress for
whoever comes next. A drink or a meal comes before sleep when both are low, and thirst or hunger
far enough down wakes a sleeper.

**Where a need is met is what the chapter buys.** Water standing in a store is a quick drink;
without it, a well; without that, a walk to the nearest bank in the claim. Berries in a store
are a meal a handful at a time; without them, picking your own off open ground, which is slow.
A bed under a roof restores rest nearly twice as fast as sleeping by the fire. Spots on open
ground (a bank, ground with something growing) are walked to as a node and the villager stands
there (`Carrier.away`) until the next walk sets off from it.

**The forage camp draws from a pool**: each unit of its batch is rolled against the recipe it is set to (`poolOf`), seeded by the building, the tick and the unit (`drawFromPool`), so the same run turns up the same berries. A roll past the pool's chances finds nothing. The overview draws the finds as icons only; the chances are written out on the slot's own screen, where the recipes are also the choice.

**The day is watched, not worked out.** There is no budget formula any more: `recordDay` counts
what every villager was doing each tick, and the town's slab reads the last whole day back
(`dayOf`). Level 16 asserts the behaviour: everybody drinks, eats and sleeps, nobody takes work
with a need down, nobody goes half a day with one unmet, stored berries and a roof are quicker.

**Needs cost time, never lives.** A meter at nothing slows nobody down and kills nobody. A
survival death-loop punishes the player for the one thing they have least information about,
and this game is about information.

**A town is as big as the beds it has built** (`bedsIn`). This replaced `CARRIERS_FOR`, which
hired off the building count and so made a town's size a consequence of its floor space: a
village of sheds staffed itself, and the population was something that happened to the player
rather than something they decided. A bed costs a building, which makes it a decision, and
`Design.sheltered` makes it a better one — a roof over the bed is worth about an hour and a half
of the waking day, so the shelter ladder is the chapter's population curve.

**Water cannot be hauled until the town holds a vessel** (`canHaul`). With nothing to carry it in
everybody drinks at the source and nobody fetches for anybody, which is why the first sealed
basket is a milestone: after it, water carried to the fire is a drink at the fire. It is also
why the **bank dig** exists: mud straight out of a bank, without carrying water, which is the
only way out of the circle. Level 1 and level 16.

## What is drawn at which distance

Three views, and each one draws only what the eye can resolve at that distance. This is the LOD
rule and the performance budget at the same time, so don't widen one without the other:

- **a building open** — the rig's slab over a dimmed map: the fire it is banked at, its queue,
  and what is standing in it. Words and drawn settings, no canvas.
- **settlement** (`fine`) — buildings and carriers walking. No per-item motion, and **nothing
  hovering over a building**: not the row of chips with counts that floated above every works
  and the fire, not a progress ring swept round one, and not the red pencil ring that appeared
  round a works the moment a load landed with nowhere to go. On a map where each building is
  already a picture of itself, a readout hovering over the thing it reads out is a spreadsheet
  pinned to the village. What a building holds, how far through a craft it is, and why it is
  stuck are the *slab's* questions, a click away, and the slab answers all three properly — the
  last with a cross through the queue entry the rig cannot run and the book's own words under
  it. The blocked ring was
  also wobbled hard enough to read as a polygon traced round the parcel, which is a mark saying
  something the game does not mean.
- **far off** (`medium`, `coarse`) — one mark per town and its name, nothing inside it drawn.
  `drawTowns` is not called at all up there; clicking the mark opens that town's ledger
  (`ui/Ledger.tsx`), which says in words what the eye can no longer see. Before, the town was drawn in full under its own mark at
  `medium` — twice the work for something nobody could read.

**A mark is a symbol, and `drawMark` is the way in — never `drawTile`.** A tile is a thing
standing on the ground: it covers a patch of world, keeps it at every zoom and coarsens with the
rung. A mark covers no world at all — it says a town is *here* — so it is drawn at one sprite
cell to one *buffer pixel*, is never halved, and follows no rung. Drawn as a tile it vanishes at
exactly the distance it is the only thing left to read.

**There is one mark per stage of a town** (`STAGES` in `worldLayer.ts`, drawn in
`pixel/sprites/townMark.ts`): the hearth tile itself while a settlement is only its fire, then
mud and thatch, whitewash and tile, and stone with a tower over it. The far view has nothing but
the mark to say a town's size with, and one drawing for all of them makes a fire on bare rock and
a town of sixty buildings the same thing on a map of a country. Keyed on the building count,
which is the only measure of a town the simulation keeps — don't add a tier to `sim/` that
nothing but the renderer would read. The materials are the game's own: mud is `EARTH`, whitewash
and the town's red are `BONE` and `EMBER`, which is what a border stone is made of.

**A roof's pitch is two flat faces, not one face lit.** Given a profile and left to the sun it
comes out as a wedge of pale cells wandering across it — the shading of the lump a triangle's
depth field says a triangle is. At this size a roof is two sides and the ridge between them.

**A name on the map is the HUD's own 5x7, haloed** (`drawMapLabel`, `MARK_SCALE`, `MARK_HALO`).
Ink alone is a dark line over dark ground at the one distance where the name is all there is to
read, so every glyph goes down once in the map's paper a cell out in each of eight directions and
once in ink on top. Baked per label and kept: the halo is nine passes of the glyphs. It is baked
at scale **1** — a glyph cell is a buffer pixel, the same pixel the ground is drawn from; at the
HUD's smallest a name was twice the height of the mark it belonged to.

`npm run ground:preview -- mark` stands every stage, with its name, on real ground at two rungs.
That framing is the whole of the test: the stages have to read *apart* from each other, not
merely each read as a town.

`ui/game.ts` owns `tickFraction`, the renderer's only view of the clock, and both the carriers
and the belts interpolate with it. A belt square's `cooldown` *is* how far across the load has
got; without the fraction on top it steps twice a square instead of running.

## Drawing a block

On the map a works is **a floor of beaten earth ringed with stones** (`works` in
`pixel/sprites/`), a tile like the well and the dig. It was the last thing on the map drawn in
pencil, and there is no pencil stand-in any more: nothing is drawn until the tile decodes. One drawing whatever is
inside: what a works *does* is the slab's question, and a floor plan printed on a parcel reads as
a diagram of a village rather than a village.

**Not a boarded shed with a pitched roof.** A town here is a fire and a few works — nobody has
sawn a plank or raised a frame, and a carpentered building says a century the settlement has not
had. What people do first is clear a patch, tread it flat and ring it with the stones they turned
up clearing it, so the ring is both the wall and where the stones went. The ring has a **gap at
the front**, or it reads as a pen with something kept inside; and the floor takes **no outline**,
for the same reason the dig's hole has none — inked round, beaten earth is a brown blob drawn on
the map and the stones on its edge read as bumps in it.

## Inside a building

A load that lands on a square rests there for `PUSH_TICKS` before it may move on, which is what
gives a belt a speed and a throughput at all — take it out and a belt run declared in flow order
walks an item end to end in one tick while the same run declared backwards crawls. Nothing draws
this any more; it is the simulation's own clock on a building's squares.

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
standing decals, buildings and villagers as one list sorted by their foot, and the chips over
buildings after all of it.

**The depth sort is feet against feet, and a building is not one object.** A hearth is a pit, a
ring of stones round it and a fire standing out of the middle; a works is a floor with nine
separate stones on it, and that ring spans eighteen rows of the tile — half a parcel of depth. Each
of those meets the ground somewhere different, and the only thing that decides what a villager
passing by is drawn over and what it is drawn under is its feet against *that piece's* foot.

So **a drawing is baked as a clip per piece** (`Piece` in `pixel/sprite.ts`, `SpritePiece` and
`tilePieces` in `render/sprites.ts`), and `drawTowns` puts every piece of every building in the
sort beside the trees and the villagers. Three earlier passes all failed the same way, each by
trying to get one key to do the work of nine:

- *one key per building, at the middle of the parcel* — a villager a stride in front of a well
  sorted behind it, and the rim was drawn over them;
- *one key per building, at the front of the drawing* — right at the front, wrong everywhere
  else: coming up the left side of a works, a villager popped behind the whole ring at once;
- *the tile sliced into rows, each row-band sorted at its own foot* — which cannot work on
  anything with ground in it, because the near half of a tile is the near stones *and* the near
  half of the floor, so a villager crossing the yard came out painted over by the earth it was
  standing on. Don't reach for row slicing again; the split has to be by object.

**A piece that *lies* on the ground takes its far edge, not its near one.** Everything standing on
a floor is on top of it, and anything behind the floor's back edge is behind it and does not
overlap it at all — so a works' floor sorts at the back of its own ellipse. Given the near edge,
where the earth actually stops, it sorted in front of all nine of its stones and was painted
straight over them: the works came out as a bare patch of dirt. The same rule puts the hearth's
bed before the flames that rise out of it.

A piece's `foot` is otherwise **the row it stands on, not the row it is drawn on** — a flame rises out of
the bed it burns in, and a stone's body is above the ground it sits on. The geometry is in the
authoring file (a stone's foot is the row it was stamped on) and the renderer keeps a copy,
because the game cannot import authoring code: **`npm run sprites` refuses to bake when the two
disagree and prints the line to paste.** That check has already caught two feet off by one.

Every building on the map has turned out to be several things. A well is masonry, with the bucket
standing a third of a parcel in front of it; a woodcutter is a woodpile, a stump with the axe in it
and a felled trunk twenty rows apart; a dig is the heap of spoil standing beside its hole,
which is the only part of it that stands *up* at all — the hole goes in the `floor` layer with the
clods, since it is the ground stopping rather than a thing standing on it. Even a border stone declares its own foot now,
rather than the painter keeping a constant for where to lift it.

**The small stuff lying about a tile is one layer, the `floor`** — the well's tufts of grass, the
woodcutter's chips and saplings, the clods that rolled off the dig's heap. A thing two or three cells across does not earn a piece of its
own: nine of them would cost nine frames in the strip to settle a reading nobody can see, and the
strips are already near what a browser will decode. Like any other lying piece it takes the back
of the grid, so it goes down under everything standing near it.

**A manned land work is the exception, and only while somebody is in it.** The worker clip is one
animated drawing of the whole tile, because the axe leaves the stump for their hands and the pail
goes down the shaft — neither can be sorted between two pieces. So `drawStructure` draws that one
clip while they are there, `drawTowns` gives it one key at the front of the drawing, and the
building goes back to being its several pieces the moment they come out.

**A villager's own foot is a row of its grid too** (`CARRIER_FEET`), and it is the *bottom* of
that grid rather than `villager.ts`'s `GROUND`, which is only where the legs stop — the soles and
the shadow under them are on the rows below it, and what the figure stands on is the bottom of the
shadow. The lift that centres its tile above the point it stands on is that row less the middle of
the grid, in *cells*. Written as six of the pencil figure's own units it was a third number again,
since a figure unit is a tenth of a world unit where a texel is an eighth: the drawing stood two
pixels high on the map and sorted on its ankles.

**Where a villager waits at a building comes off the drawing too** (`frontOf`, `STANDING_STEP`).
One standing in the middle of a parcel is standing inside the building on it, so it steps a stride
out in front of the frontmost piece; a fixed distance from the parcel's middle is no answer, since
a well's rim nearly fills its tile and a hearth's ring is half that across.

**`npm run lab` has a depth bench for exactly this** (`lab/Clip.tsx`, the *depth* button): the
tile on bare ground with a villager to drag round it, every piece drawn in the order the map draws
them, and a dashed line at every foot. It runs on the painter's own numbers — `tilePieces` and
`CARRIER_FEET` for the row a villager's feet are on — so what clips wrong here clips wrong on the
map. On the map the same question means waiting for a carrier to walk past a well at
a zoom you cannot hold still, which is how all three passes above shipped unlooked-at.

**The feet are set there, not guessed in the file.** A foot's line is dragged like a light's
handle, and the bench hands back the `pieces:` line for both files (`piecesToSource`) — same idiom
as the lights, and for the same reason: a number settled by eye and then typed from memory is a
number nobody checked.

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

The bars, the ledger and the rig slab are **pixel art, baked** — `src/pixel/ui/` draws
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

**A plate is a rail, and the face behind it is a surface that tiles** (`pixel/ui/surfaces.ts`).
A nine-slice stretches its middle, so nothing with any grain in it can be drawn into a plate —
one fleck in the middle cell comes out as a streak the length of the panel, which is why every
panel here was a flat colour and why a sandstone slab read as a brown rectangle. The plate is
sliced without `fill` and the face is a `background-image` that repeats at the size it was baked,
clipped to the padding box where the rail's inner edge stops. The rail's inner cells and the
surface are drawn at the *same step of the same ramp*, or the two meet as a visible seam.

**A ledger says how far its town has got before a word on it is read**: sandstone scratched into
while the town is a fire and a few works, a beaten sheet written in coal once it is a village, a
chalkboard only when it is building in stone. The stages are `render/townStage.ts`'s — the same
counts the map's mark turns over at, so a village on the map is not a hamlet in its own books.
Letters on the slab are *incised*: the groove is cut dark and the far wall catches the light,
down and right, away from the same top-left sun the map is lit by. The highlight is a
`drop-shadow` on the word rather than on the glyph, because a glyph is a mask and a filter on a
masked element is drawn before the mask and then cut away by it.

`npm run ui:preview -- <out.png>` stands the three ledgers side by side on grass. Framed that way
the stages have to read *apart* from each other, which is the only question worth asking of them;
it is also the only way to look at the HUD when the page will not build.

**A plate's edge bands have to be uniform along the way they stretch.** CSS stretches the middle
row and the middle column; anything that varies there comes out as a streak the length of the
panel. The rounding lives in the four corners, which are never stretched, so it is the same
rounding on a button and on a panel ten times its size.

**Set a plate with the longhands, never the `border` shorthand.** The shorthand resets
`border-image` to `none`, so one `border:` on a rule whose plate is set by a stage class further
up the file silently takes the rail away and leaves the surface behind it standing — which looks
like the plate failing to load rather than like a cascade mistake.

**A knob is ordinal, because nobody can set what nobody can measure.** The rig slab
(`ui/RigSlab.tsx`) is a strip of three drawn fires with the chosen one circled, the way anyone
circles a choice: no sliders, no percentages, no panel with a title bar. A damper at 55% is a
number *about* a fire rather than a fire, and this town owns no instrument that could read it —
what they can do is point at a banking and say "like that". The three differ in the height of
the flame as well as in its colour, so the strip still works for somebody who cannot tell the
colours apart, which fell out of drawing three real bankings rather than three swatches. The
knob gets finer only when an instrument arrives that reads it finer (`knowing.ts`): three
settings are three bars, never a curve through three points.

**Counts are tallies, and stock is the stuff on a shelf.** A count drawn as goods on a board is in
the same place as the thing it is about. The slab takes its plate from
the town's stage like the ledger, and what it draws is kept as plain data apart from the game
(`rigView.ts`) so `/lab#hud` can stand it on the bench — `game.ts` raises a world the moment it
is imported, which is a slow loop to look at a slab through.

**The icons are objects, not symbols.** The tool that founds a town is a fire and the one that
razes is a pick, because the bar sits over a map where every building is already a picture of
itself. They are written as rows of characters (`art.ts`) rather than coordinate lists: at
sixteen cells every pixel is a decision, and rows are the only form in which that decision can be
read in a diff. The legend is shared for the same reason the ramps are — two icons that each
invent their own brown are two kinds of wood on one bar.

**The bar has no Inspect button, and the catalogue is not on it.** Inspecting is what an empty
hand does — a click on a building the tool has nothing to say about opens it anyway — so a
button for the resting state would be the one pressed nearly all the time. A tool clicked twice,
Escape, or raising what was in hand all put it down again. The catalogue sits behind `Build`,
which holds what is in hand and opens a menu: the chapter runs to a couple of dozen buildings,
and laid out as tiles they would be the widest thing on the screen several times over.

**Raising something puts it down, unless the chaining key is held** (`chaining` in
`GameCanvas.tsx`, shift). `found` and `build` in `game.ts` deliberately do *not* reset the tool:
only the click knows whether the key was down. A tool that stays in hand by default turns every
stray click on the ground into a shed nobody asked for, and with no Inspect button there is
nowhere obvious to put it down.

**Everything in the catalogue earns a drawing.** The chapter is a known list, so an icon is
owed for every step in it: `designIcon` in `ui/designIcons.ts` holds them, and anything not yet drawn falls back to the blueprint — which is now a gap to be
filled rather than the honest answer it was while the player could invent machines. The lean-to
keeps the blueprint on purpose: nothing on the sheet is a shelter, and a roof drawn as a log
would be a worse lie than a blank plate. Don't invent an icon name; `ICON_NAMES` in
`pixel/ui/metrics.ts` is the list, and a sheet has to be baked for a new one.

**The seed box is the one place a system face is drawn.** A caret has to sit in a real text
field, and there is no bitmap font for the browser to lay out — so it uses a monospace face
inside a pixel plate.

**A sheet is asked for by version** (`SHEET_VERSION`, bumped whenever `public/ui` is baked
again). They are plain files under `public/`, so nothing hashes their names and a browser holds
on to the one it has — and a sheet whose *contents* moved, an icon added so every slot after it
shifted, then draws the right slot of the wrong picture. That is somebody else's drawing in
place of the new one rather than a blank where it should be, which is far harder to recognise:
it cost a round of "the arrow is missing" when the arrow was being drawn correctly from a stale
image.

**The sheet is as many rows tall as there are icons.** It was a fixed square of `ICON_COLS`, so
the thirty-seventh icon fell off the bottom in silence — nothing threw, the bake printed its
usual line, and one icon simply drew as nothing. `iconSheet` now refuses a sheet that cannot
hold what it is given.

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
