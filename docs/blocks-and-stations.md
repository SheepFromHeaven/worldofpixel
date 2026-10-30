# From single-tile buildings to blocks, rooms and stations

Status: concept only. Nothing here is built. It describes where `content/buildings` goes.

## The idea

Today a "building" is one tile with a bundle of components: a hut, a bed, a campfire, a storage tile are all the same kind of thing. That was a stand-in. The target is RimWorld or Dwarf Fortress style:

- **Blocks** are the unit you build with: floor, wall, door, window, roof, and the like. A block is a piece of a structure, never a thing people use.
- **Rooms** are derived, never placed. A room is a region of floor enclosed by walls, doors and windows. A hut or a tipi stops being content and becomes something the player builds out of blocks.
- **Stations** are the things people use, placed on a floor tile: bed, knapping floor, campfire, torch, storage, snare. Every current "building" becomes a station. A station is still data, built from the same components as today.

So the vocabulary shifts: what is called a building now is renamed **station**, and **building** disappears as a word (a "building" is just a room that happens to be enclosed).

## What each side owns

| | Content (data, one folder each) | System (behaviour) |
| --- | --- | --- |
| item | `content/items/<key>/` | people, storage, cooking, fuel |
| station | `content/stations/<key>/` (was `buildings`) | jobs, sleeping, storage, light, traps |
| block | `content/blocks/<key>/` | blueprints, movement, rooms, rendering |
| research | `content/research/` | the research module |

A block or station folder holds the same three things an item folder holds now: `index.ts` (the definition and its components), `sprite.ts` (sprite generation) and `model.ts` where it needs an upright body for the bake. `npm run content` already enforces that every folder is registered.

## Block components

Sketch, in the same style as items and stations:

```ts
block('wall', 'Wall', 'block.wall',
  needs(['branch', 4], ['hide', 2]),
  solid(), opaque(), supportsRoof({ reach: 3 }),
  unlockedBy('wall'),
)
block('door', 'Door', 'block.door', needs(...), passable(), opaque(), unlockedBy('door'))
block('window', 'Window', 'block.window', needs(...), solid(), transparent(), letsInLight(), unlockedBy('window'))
block('roof', 'Roof', 'block.roof', needs(...), roofs({ needsSupport: true }), unlockedBy('roof'))
block('floor', 'Floor', 'block.floor', needs(...), trodden(), unlockedBy('floor'))
```

A tile gets three block layers instead of one `built` byte: floor, wall, roof. A station sits on a floor tile and may not sit on a wall.

## Rooms

A `rooms` system floods enclosed floor tiles and keeps, per room: tile count, how much of it is roofed, whether it is closed (no gap in the walls), windows, doors, and which stations and people are inside. It updates only around a changed block. Everything that today reads a building's component reads the room instead:

- `shelter` (rest recovery, how much cold it keeps off) becomes a property of the room: closed and roofed rest faster, a bed station adds comfort on top.
- `glow` (a lit window) becomes windows on a room that is lit or occupied.
- Rain, snow and wind stop at a roof and at walls. The weather system asks "is this tile under a roof".
- The hut and tipi sprites and definitions go away. A tipi is a room of hide walls with a roof.

## Stations after the rename

Everything in `content/buildings` moves to `content/stations`, with the same components: `storage`, `job`, `trap`, `emits`, `fuelled`, `shelter` (a bed's own comfort), `needs`, `unlockedBy`, `footprint`. The command `build` stays and means "place or plan this station". `Structures.built` becomes `stations`. The campfire and the knapping floor are stations in exactly the sense you described: a workstation you can still build, just no longer special.

## Research

Unlocks become granular and name blocks and stations, never houses: `wall`, `door`, `window`, `roof`, `floor`, `bed`, `hide wall`. Houses need no research of their own. Research stays content under `content/research`, and a block or station names the research that unlocks it with `unlockedBy`.

## Building by blueprint

The plan layer generalises from "one plan per tile" to a blueprint per tile and layer. The player designates a line, a rectangle or a room outline; each tile becomes a blueprint naming a block; builders fetch the `needs` and raise it. This reuses the plan and builder machinery in `People` (`PLAN_NEEDS`, `nextBuildStep`, `finishBuilding`), which today is written for one tile.

## Migration, in order

Each step ends with `simHash`, `worldSync` and `simRoundTrip`, and keeps the game playable.

1. **Rename** (S, mechanical). `buildings` to `stations`, `BuildingDef` to `StationDef`, `buildingOf` to `stationOf`, `built` to `stations`. Move bed, snare, storage, knapping floor, campfire and torch. Keep hut and tipi as temporary stations so nothing breaks. Hashes must not move.
2. **Layered tiles** (M). A `blocks` layer with floor, wall and roof columns; `Movement` reads walls and doors; the plan layer takes a block id. Placement rules between blocks and stations.
3. **Block building** (M). Blueprints for blocks, designate a line or rectangle, builders fetch materials. First blocks: floor and wall.
4. **Rooms** (L). The flood fill, its incremental update, the room properties above. Sleeping and cold loss read rooms.
5. **Roof, door, window and light** (M). The remaining blocks, windows as light through the `emits` component, weather under roofs.
6. **Renderer** (L). Connected-edge wall sprites, roofs that hide when someone is inside, window glow, the see-through at the cursor.
7. **Research and cleanup** (S). Granular research, delete hut and tipi, update the zoo and the wiki.

## Risks

- **Passability and pathing.** `passable` and `pace` read walls, doors and station footprints. A wrong rule traps people, so `simBuilding`-style scripts for "walk through a door, not through a wall" come first.
- **Wire and save.** Three block columns per tile plus blueprints go through the existing layer contract (`pack`, `unpack`, `snapshot`, `restore`). Old saves are already dropped.
- **Room cost.** The flood fill must stay local to a changed tile. A whole-world rescan per block would stall a frame.
- **Renderer.** Walls and roofs change the draw order and the see-through rules. This is the largest unknown.
- **People AI.** Where people sleep, flee weather and carry things all assume a single-tile shelter. Each moves to "the room I am in".

## Decisions needed

1. **Is a bed a station or a block?** I assume a station (furniture) placed in a room.
2. **How many layers** a tile has (floor, wall, roof), or whether a block is simply one entity per tile as in Dwarf Fortress.
3. **Open or closed:** do rooms need a door and a roof to count as shelter, or does enclosure alone suffice at first?
4. **Do hut and tipi stay as shortcut stations** until rooms work, or do they go at step 1?
