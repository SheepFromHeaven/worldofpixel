# Splitting World into layers owned by modules

Status: phases 0 to 5 are built (safety net, layer machinery, trails, structures, items and homes, the zoo stage, plants and cover). Phase 6 (removing the `World` facade) is built too: callers use the layers directly and the duplicate methods and aliased arrays are gone from `World`, except `world.cover`. Decisions taken: old saves are dropped, the facade stays until phase 6, plants are included.

## Why

`src/sim/world.ts` (870 lines) is the one place where unrelated modules meet. It holds, in one class:

| Concern | State on `World` | Used by |
| --- | --- | --- |
| Terrain facts (read only) | `biome`, `wind`, `river`, `eco`, `steep`, `damp`, `aqua`, `flow`, `depth`, `shore`, `silt`, `bloom` | renderer, plants, fauna, people |
| Plants and cover | `cover`, `plants` (own class, 9 arrays) | flora, renderer, people, fauna |
| Trails | `wear`, `fade`, `tread` | trails, renderer, people paths |
| Structures | `storage`, `floor`, `fire`, `fuel`, `ember`, `torch`, `torchDepth`, `plan`, `built` plus five tile lists | construction, fire, storage, people, renderer |
| Things on the ground | `items` (`GroundItems`) | items, people, renderer |
| Homes | `homes` (`Homes`) | mammals, renderer |
| Movement | `confinement`, `passable`, `pace` | people, achievements |
| Change tracking | `changed`, `stamps`, `listRevision`, `revision` | renderer chunk cache, worker sync |
| Wire and disk | `ground()`, `drain()`, `introduce()`, `apply()`, `snapshot()`, `restore()`, `WorldState`, `Ground`, `WorldDelta` | worker, replica, saves |

The cost shows up every time a module adds a per-tile fact. One new array has to be written into six places: the class, `Ground`, `WorldDelta`, `drain`, `apply`, `snapshot` and `restore`, plus the zoo stage constructor and `link/transfer.ts`. The zoo, the tools and the game each build their own `World` through `generate`, `stage` or `mirror`. This is the "implement everything twice" problem at the data level. It also stops the module split from being real: `fire`, `construction`, `storage` and `items` all reach into the same object.

## Target

A **layer** is a per-tile store owned by exactly one module. The module declares it once and gets sync, persistence and change tracking for free.

```ts
const structures = tileLayer({
  id: 'structures',
  arrays: { storage: u8, floor: u8, fire: u8, ember: u8, torch: u8, plan: u8, built: u8 },
  lists: ['storageTiles', 'floors', 'fires', 'embers', 'plans', 'torches', 'buildings'],
  maps: { fuel: 'number', torchDepth: 'number' },
  save: structuresState,      // the keys it owns in the saved game
})
```

- A layer provides `drain()` (changes since last call), `apply(delta)` (on the main thread replica), `snapshot()`, `restore()` and stamps changed tiles for the renderer.
- Each module exposes its layer through a typed capability (`STRUCTURES`, `ITEMS`, `PLANTS`, `TRAILS`, `HOMES`), the same way `FAUNA` and `PEOPLE` work now. Other modules ask for the capability, never for `World`.
- `World` shrinks to the immutable terrain (`field`, `grid`, derived layers) plus a read facade for the renderer. Its mutating verbs move into the owning modules.
- The worker sends `Record<layerId, delta>`. The replica applies each delta to its own copy of the same layers. `World.mirror`, `World.stage` and the zoo's stand-in disappear: the stage builds the same layers with a flat terrain.
- Hot loops keep reading raw typed arrays. Nothing per tile goes through an accessor.

## Phases

Each phase ends with `simHash`, `simRoundTrip`, typecheck, and a look at the game and the zoo. A phase can be stopped after, with the game working.

0. **Safety net (S).** Extend `simHash` to hash every world array and list (structures, items, homes, wear). Add a drain to apply to mirror round trip test (a mirror built from `introduce()` and then fed deltas must equal the source). There are no tests in this repo, so this is what makes the later phases checkable.
1. **Layer machinery and `trails` (S).** `tileLayer`, `Layers` registry, generic drain and apply and snapshot. Port `wear` only (one array, three call sites), including the wire format and saved game key. Proves the design.
2. **`structures` (L).** Move the nine arrays, five lists and two maps out of `World` into one module, with `plan`, `built`, `fire`, `storage` verbs (`planCampfire`, `raise`, `kindle`, `designate`, and the rest) as methods on the layer. This is the biggest piece: about 25 files read `world.items`, 11 read `world.built`, and `People` leans on `isFire`, `isStorage`, `plan`.
3. **`items` and `homes` (M).** Both are already classes, so this is mostly rewiring: register them as layers, move their `drain`/`apply`/`state` into the layer contract, drop them from `World`.
4. **Zoo stage and tools (M).** Build the stage from the same layers with a flat terrain. Delete `World.stage`, `World.mirror`, `stageHost` leftovers, and per-tool world setup in `tools/`.
5. **`plants` and `cover` (L, optional, last).** Nine arrays, 638 lines, read by the renderer, fauna habitat and people. Do this last, or leave it as a layer with a `World.cover` alias for the renderer.
6. **Facade removal (M).** Replace remaining `world.x` reads in the renderer with layer reads, then delete the facade.

Rough size: phases 0 and 1 are about a day of work together, phase 2 about two days, 3 and 4 about a day each, 5 and 6 about two days. Phases 0 to 2 give most of the benefit.

## Risks and how each is handled

- **Saves.** `WorldState` has a flat shape with ad hoc keys (`bedPlans`, `hutPlans`, `snarePlans`, `relights`...). Layers would own their own keys. A reader for the old shape keeps existing saves working (decision 1 below).
- **Wire cost.** Today `drain` is one pass over a changed-tile set. Per-layer deltas must not cost more per frame. `simHash` timing is the check.
- **Determinism.** Lists are insertion ordered and several rules depend on that order (`storageTiles`, `fires`). Layers keep arrays, not sets, where order is part of behaviour. The phase 0 hash covers this.
- **Renderer chunk cache.** It keys on `stampOver(bounds)`. Every layer that changes drawn state has to stamp, or chunks stop re-baking. Layers stamp through `World.touch`, and `stampOver` is unchanged.
- **People reach into the world a lot** (path, pace, `passable`). `passable` combines terrain, structures (a fire or a hut blocks) and confinement. It becomes a small system that asks each layer, instead of a `World` method. This is the part most likely to cost time.
- **No test runner.** All checking is the hash tools plus looking. Phase 0 is there to reduce that risk.

## Decisions (taken)

1. Existing browser saves are dropped. Each layer owns its key under `WorldState.layers`.
2. The facade was removed in the same project. `world.cover` is the one array left on `World`.
3. Plants and cover are a layer (`plants`).
4. All phases were built.

## How it differs from the plan

- Layers share one set of changed tiles on `World` (`mark` and `touch`) and each packs its own columns for it, instead of each layer keeping its own changed set. This kept the wire cost the same and the code smaller.
- `passable` and `pace` are still methods on `World`. They read the structures and trails layers directly. Making them a small system that asks each layer is still open.
- `World.stage` and `World.mirror` still exist as thin builders over the same layers.
