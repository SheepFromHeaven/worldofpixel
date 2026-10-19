# Scribble Empire — vision

The north star. `README.md` is the spec for what exists; this is what it is being built toward.
Where the two disagree, the README wins for present behaviour and this file wins for direction.

## Core concept

A physical logistics empire-builder, scaling from tribal beginnings to the space age. The
Settlers III/IV for visible carriers and hand-carried goods, Anno for specialised regions that
have to trade with each other, Da Vinci cartography for the look.

**Nothing teleports.** There is no abstract storage number and no instant transfer. Every unit of
water, grain, flour or iron is an object that is harvested, then hand-carried or mechanically
hauled along a path, road or pipeline, and it exists somewhere the whole time.

## Aesthetic

Hand-drawn ink on parchment: wobbly organic strokes, sepia sheet (`#f4f1ea`), watercolour washes.

The contrast between grown and built is deliberate. Nature and every macroscopic boundary are
organic Voronoi polygons; human engineering — above all a building's interior — snaps to a
precise orthogonal grid.

No asset dependency. Everything is procedural vector drawing on canvas with seeded line jitter;
no sprite sheets, no 3D.

## The four layers

1. **World** — a global Voronoi atlas of continents, oceans and climate zones. Empire-level
   cartography: finding distant resource islands, planning long-range trade.
2. **Region** — a sub-Voronoi biome inside one world cell, governed by temperature, humidity and
   elevation, holding the source cells (artesian springs, coal seams, iron deposits, quartz
   sands) that decide what the region can specialise in.
3. **Settlement** — a parcel map inside one region cell: the campfire core, resource nodes,
   trodden ink paths, and carriers who physically walk goods between building doors.
4. **Building interior** — an orthogonal grid opened as a blueprint: input hoppers, cogs, belts,
   and the recipe working through them. The player draws it: there are no building types, only
   designs made of blocks and kept in a library.

## Economy

**Forced specialisation.** No settlement does everything; geography decides its industry. A ridge
settlement mines coal, a wetland grows grain, a forge town smelts iron.

**Interdependence.** Settlements survive by physically trading with each other — carts on roads
between regions, macro conduits between world cells. A supply chain that crosses a layer boundary
is still a supply chain, with the same carriers and the same travel time.

**Progression.** Campfires, bucket chains and wheat, through the industrial revolution and
automation, to a rocket programme.

## Where this stands

Built (see `README.md`): all four layers, the settlement vertical slice, carriers and dispatch,
designed buildings and their running interiors, deterministic ticking, founding.

Ahead: more recipes and block kinds for the library to be built out of, multiple settlements that
depend on each other, inter-settlement transport (carts, roads, pipelines, conduits), regional
specialisation driven by source cells rather than a fixed slice, and the technology tiers above
the campfire.
