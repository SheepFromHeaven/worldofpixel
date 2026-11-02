# From single-tile buildings to blocks, rooms and stations

Status: step 1 (the rename) is done. `content/buildings` is `content/stations`, `BuildingDef` is `StationDef`, `Structures.buildings` is `stations`, and the `build` command takes `{ tile, station }`. Hut and tipi stay as temporary stations. Steps 2 to 7 are concept only.

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

The world gets height levels, as Dwarf Fortress and the geology already have. Every level is a grid of tiles and each tile on a level holds at most one block (floor, wall, door, window, roof, stairs) plus at most one station on a floor block. A roof is simply a floor block on the level above, so building higher and roofing are the same act. A station sits on a floor block and never on a wall.

## Rooms

A `rooms` system floods enclosed floor tiles and keeps, per room: tile count, how much of it is roofed, whether it is closed (no gap in the walls), windows, doors, and which stations and people are inside. It updates only around a changed block. Everything that today reads a building's component reads the room instead:

- `shelter` (rest recovery, how much cold it keeps off) becomes a property of the room: closed and roofed rest faster, a bed station adds comfort on top.
- `glow` (a lit window) becomes windows on a room that is lit or occupied.
- Rain, snow and wind stop at a roof and at walls. The weather system asks "is this tile under a roof".
- The hut and tipi sprites and definitions go away. A tipi is a room of hide walls with a roof.

## Stations after the rename

Everything in `content/stations` moves to `content/stations`, with the same components: `storage`, `job`, `trap`, `emits`, `fuelled`, `shelter` (a bed's own comfort), `needs`, `unlockedBy`, `footprint`. The command `build` stays and means "place or plan this station". `Structures.built` becomes `stations`. The campfire and the knapping floor are stations in exactly the sense you described: a workstation you can still build, just no longer special.

## Research

Unlocks become granular and name blocks and stations, never houses: `wall`, `door`, `window`, `roof`, `floor`, `bed`, `hide wall`. Houses need no research of their own. Research stays content under `content/research`, and a block or station names the research that unlocks it with `unlockedBy`.

## Placement: the blueprint tool

Right click to place does not scale to anything bigger than a tile, so placement becomes a tool with a preview, and it serves stations and blocks alike.

- **Pick, then hover.** Choosing a station or block from the menu arms the tool. The thing follows the pointer as a translucent ghost drawn with its own sprite, snapped to the tile grid and the current level.
- **Footprint.** A definition gets a `footprint` of tiles (a list of offsets, each naming what it needs: floor, free, or a wall to lean on), so a bed is 1 x 2, a workbench 2 x 1 and a one-tile block is a single offset. The existing `footprint` component (clears, trees, trodden) is renamed `ground` so the word is free.
- **Rotation.** `R` turns the footprint in quarter turns before placing. A definition says which rotations are distinct, and the ghost and the placed station share one orientation byte.
- **Conflicts.** Every footprint tile is checked as it moves: red where it is blocked (occupied, water, a tree, no floor, a wall, not enough support below), green where it fits. Placing is refused while any tile is red, and the reason shows under the pointer. The check is one pure function over the layers (`placeable(footprint, tile, level, rotation)`), used by the ghost, by the command and by the builders, so the three can never disagree.
- **Drag.** Click places one. Dragging a line or a rectangle repeats the ghost over every tile (for walls, floors and roofs), and a conflicting tile is skipped and drawn red while the rest go through. Escape or a right click puts the tool away.
- **Output.** Placing creates blueprints (plans) per tile, never the thing itself. Builders fetch the `needs` and raise it, as plans already work. In discover mode there are no builders, so it is placed at once.
- **Where it lives.** A `placement` module owns the tool state's rules and the `blueprint` command (`{ what, tile, level, rotation }`, replacing `build`). The ghost is drawn by the lit layer from the same instances as placed things with a flag for translucency and tint, and the UI only arms the tool and forwards the pointer, so the zoo gets it for free.

## Building by blueprint

The plan layer generalises from "one plan per tile" to a blueprint per tile and layer. The player designates a line, a rectangle or a room outline; each tile becomes a blueprint naming a block; builders fetch the `needs` and raise it. This reuses the plan and builder machinery in `People` (`PLAN_NEEDS`, `nextBuildStep`, `finishStation`), which today is written for one tile.

## Decisions

1. A bed is a station. Everything that can be interacted with after being built is a station; blocks are only structure.
2. Levels as in Dwarf Fortress, like the geology: a block per tile per level, roofs are floor blocks above.
3. Enclosure counts as shelter for some things. A door and a roof make the room better: stronger heat retention, and some stations only work or can only be built in a closed, roofed room.
4. Hut, tipi and the lean-to go. Houses are made of blocks.

## Migration, in order

Each step ends with `simHash`, `worldSync` and `simRoundTrip`, and keeps the game playable.

1. **Rename** (done). `buildings` to `stations`, `built` stays for now.
2. **Placement tool** (done for stations on the ground level: footprint, rotation, conflicts, drag, `blueprint`; the ghost is tinted tiles and not yet the sprite, and the `level` argument waits for step 3). The `footprint` and `rotation` data on stations, `placeable`, the `blueprint` command with a level and a rotation, the ghost with conflict colours, drag. Stations only, on the ground level. This comes first because every later piece (blocks, rooms) is placed through it.
3. **Levels and blocks** (started: `content/blocks` with floor and wall at ground level, one id space with stations in `content/buildables.ts`, a `block` column and list in `Structures`, solid walls in `Movement`, placed through the same tool and built by the same builders, hut and tipi deleted. Still to do: the level dimension, stairs, and `Movement` reading doors). A `blocks` layer per level, `Movement` reading walls, doors and stairs, the plan layer taking a block id, floor and wall as the first blocks, hut and tipi deleted with their neurons.
4. **Rooms** (L). The flood fill and its incremental update. Sleeping and cold loss read the room. Door and roof change the heat model; stations may require a room.
5. **Roof, door, window and light** (M). The remaining blocks, windows as light through `emits`, weather stopping at a roof.
6. **Renderer** (L). Connected-edge wall sprites, roofs that hide when someone is inside, window glow, the see-through at the cursor, the level view.
7. **Research and cleanup** (S). Granular research (wall, door, window, roof, floor, bed), the zoo and the wiki.

## Risks

- **Passability and pathing.** `passable` and `pace` read walls, doors and station footprints. A wrong rule traps people, so `simBuilding`-style scripts for "walk through a door, not through a wall" come first.
- **Wire and save.** Block layers per level plus blueprints go through the existing layer contract (`pack`, `unpack`, `snapshot`, `restore`). Old saves are already dropped. A world of 3.3 million tiles times levels must be sparse: only levels with blocks exist.
- **Room cost.** The flood fill must stay local to a changed tile. A whole-world rescan per block would stall a frame.
- **Renderer.** Walls, roofs and levels change the draw order and the see-through rules. This is the largest unknown. The ghost shares it.
- **People AI.** Where people sleep, flee weather and carry things all assume a single-tile shelter. Each moves to "the room I am in".
