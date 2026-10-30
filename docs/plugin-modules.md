# Pluggable modules: design

The goal: a module is a folder. Paste it in and the game has the feature, delete it and the game still builds and runs. Nothing outside the folder names it. The folder registers what it adds (a layer, commands, a radial menu offer, a person activity, content, a panel, a render pass) and uses what other modules provide (materials, people) through declared contracts.

The test for every step below: `rm -r` a module folder, run `npm run typecheck` and the headless sims, and nothing breaks except the features that module added.

## Where we are

The kernel is already half of this. Systems declare `needs` and `provides` as typed capability tokens, the kernel orders creation by dependency, commands and offers are contributed by modules. What is not plug-in yet, measured on the current tree:

- **A central list.** `modules/index.ts` imports every module by name and fixes the tick order. `STAGE_MODULES`, `HEAVY` and `CORE_MODULES` are more hand-kept lists.
- **A central token file.** `sim/capabilities.ts` imports the type of every module's main object (`People`, `Mind`, `Fauna`, `Sky`, `Snares`...). Adding a module means editing it, and it makes every module visible to every other.
- **A fixed set of layers.** `World` constructs `plants`, `trails`, `structures`, `items`, `homes` itself (`world.ts:105-128`). `Structures` is 549 lines and knows stations, blocks, plans, fires, torches, storage and floors.
- **A closed person state machine.** `People.rest()` is a hard-coded priority chain: drink, forage, eat, sleep, feed, gather, angle, wonder, planned build, scavenge, haul, wander. `EntityState` and `Task` are enums in `states.ts`. Building (`build.ts`, `buildTile` column, `finishCampfire`, `finishStation`) is inside `People`.
- **Central content registries.** `content/stations/index.ts`, `content/items/index.ts`, `content/research/*`, `content/buildables.ts` are literal lists. Ids are positions in those lists.
- **UI and render reach into modules.** 75 imports of `ecology/fauna` and 26 of `settlement/people` come from `render/`, `ui/`, `tools/`, `labs/`. `Game` has the placement tool and structure sheet built in. `folkInstances` draws structures, items and plans by name.
- **Worker split.** The sim runs in a worker, the UI on the main thread. A module that adds a panel has two halves in two realms.

Pasting in a building module today would need edits in about 17 files outside it. That is the number to drive to zero.

## Shape of a module

```
modules/<name>/
  module.ts          # the manifest, the only file anything loads
  api.ts             # what other modules may import (types, tokens, pure helpers)
  sim/               # runs in the worker
  client/            # runs on the main thread (panels, tools, passes)
  content/           # items, stations, research, species it contributes
  wiki.ts            # optional wiki page
  README.md          # what it adds, what it needs
```

`module.ts` default-exports one `defineModule` call:

```ts
export default defineModule({
  id: 'construction',
  needs: [PEOPLE, MATERIALS, STRUCTURES],
  after: ['people'],
  sim: {
    layers: [structuresLayer],
    commands: { blueprint, demolish, cancelPlan },
    offers: [constructionOffers],
    activities: [buildActivity],
    content: { stations, blocks },
    save: ['plans'],
  },
  client: {
    tools: [placementTool],
    sheets: [structureSheet],
    drawables: [structureDrawables],
  },
})
```

Everything a module contributes is a typed slot in this manifest. If a feature cannot be expressed as a slot, that is a missing extension point to add to the core, not a reason to edit another module.

## The rules

1. **Discovery.** Modules are found by globbing `modules/*/module.ts`. No file lists modules. Vite does it with `import.meta.glob` in the worker and the page. Node tools (`tsx`) have no glob, so `tools/modules.ts` writes `modules/manifest.generated.ts` (static imports, sorted) and runs from `predev`, `prebuild`, `typecheck` and a Vite plugin on file add or remove. The generated file is never edited and is the only place that lists modules.
2. **Ordering.** A tick runs systems in dependency order from `needs`/`provides`, then `after`/`before` hints, then module id. No central order list. The current order in `MODULES` becomes `after` hints where it matters.
3. **Imports.** A module may import from `core/` and from `modules/<other>/api.ts` of modules it lists in `needs`. Never from another module's `sim/`, `client/` or `content/`. Core never imports a module. `tools/modules.ts check` enforces this and `typecheck` runs it. This is what makes deleting a folder safe.
4. **Tokens live with their provider.** `PEOPLE` is defined in `people/api.ts`. `capabilities.ts` shrinks to the tokens core itself provides (seed, mode, world, clock, events).
5. **Soft needs.** A module can ask `find(TOKEN)` for an optional capability and degrade when absent (the mind module present or not, weather present or not). `needs` is hard, `wants` is soft, and the kernel reports which is missing.
6. **Content is contributed, not listed.** Items, stations, blocks, research and species are registered by manifests. A station's `needs` refers to material keys, resolved at load. A missing key fails loudly at startup naming the module.
7. **State is owned.** Per-tile state is a layer the module contributes. Per-person state is a column the module allocates on `People`. Saved state is under the module's own key. Removing the module removes its keys from new saves; old saves are out of scope pre-alpha.

## Extension points to build

Each is a slot the core offers. They are listed in the order they unblock a pilot.

**Layers (replaces the fixed list in `World`).** `World` is built by the `world` module before other modules exist. Change it so layer factories are collected from manifests first, then `World` is constructed with them, in id order. `World.layers` stays the loop everything already uses. `Structures` moves into the construction module's folder, with `Trails`, `GroundItems` and `Homes` going to their modules. The hot-path helpers `World` reads (`heldFast`, `passable`) become capabilities `Movement` queries instead of fields.

**Person activities (opens `People`).** An activity is `{ id, priority, begin(people, person): boolean, work?(people, person, dt), cancel?(people, person), columns? }`. `People.rest()` walks the sorted activity list and calls `begin` until one returns true. States and tasks become ids allocated by an `ActivityRegistry` rather than enum members, with the existing ones preallocated so the shaders and `humanPose` keep their numbers. `buildTile` becomes a column owned by the construction module. Today's `build.ts`, `food.ts`, `fireside.ts`, `haul.ts`, `sleep.ts`, `wonder.ts` each become an activity in their own module, with `vitals` staying in `people` because everything reads it.

**Content registries.** `ItemRegistry`, `StationRegistry`, `ResearchRegistry` collect from manifests. Ids are assigned by sorted key at load so they are stable for a given module set. The `PLAN_BASE + station id` scheme and the registry-order guard are replaced by a registry that hands out plan ids. `ItemType` stops being a closed enum in `sim`: core items (hand, nothing) stay, everything else is looked up by key through `MATERIALS`.

**Materials contract.** The thing the building module uses from "the material module" is an `api.ts` contract: `MATERIALS.find(key)`, `fuelOf`, `foodOf`, `foundOn`. Items register themselves into it. Construction asks for `needs([['branch', 2]])` by key and never imports an item.

**Radial menu and commands.** Already modular. Remaining work is removing `Game.planCampfire`-style stubs so the UI only sends `{ kind, ... }`.

**Client contributions.** `client/` halves are collected on the main thread the same way. Slots: `tools` (the armed placement tool and its ghost), `sheets` (structure, person, tile sheets), `hud` (buttons, toasts), `drawables` (what `folkInstances` draws: structures, plans, markers) and `passes` (a lit-layer pass with its own shaders). `Game` shrinks to state, the camera and the plugin registry. The replica mirrors each module's layer delta by layer id, which `transfer.ts` already does by walking the delta.

**Zoo and stage.** `STAGE_MODULES` is replaced by a flag on the manifest (`stage: true`) so a module opts into the zoo's control mode instead of the zoo naming it.

## Migration order

Each step keeps `tools/simHash.ts` identical, `simRoundTrip`, `worldSync`, `simBuilding` and `simOffers` green, and typecheck and `vite build` passing. Steps are separate commits.

1. **Contracts and discovery.** Add `api.ts` per module, move tokens into providers, add the generated manifest, the glob, the import checker. Delete `modules/index.ts`, `STAGE_MODULES`, `HEAVY`, `capabilities.ts` (reduced). No behaviour change. This is the "registry only" scope and is useful alone.
2. **Layers.** World takes contributed layers. Move `Trails`, `GroundItems`, `Homes` to their modules. Then `Structures`, split into a plan/built core and the station-aware parts.
3. **Content registries.** Items, stations, blocks, research contributed by manifests. Verify `artDigest` and `simHash` unchanged.
4. **Activities.** Open `People`. Move activities out one at a time, easiest first (`sleep`, `wonder`, `fireside`), then `food`, `haul`, and `build` last. `states.ts` ids stay stable.
5. **Pilot: construction.** With 1 to 4 done, move everything construction into one folder: stations and blocks, the structures layer, build activity, commands, offers, placement tool, structure sheet, drawables. Delete the folder, run the checks, paste it back. This is the proof of the design.
6. **Client slots.** Tools, sheets, hud, drawables, passes. Do construction's first, then people and items.
7. **Remaining modules.** Ecology (`fauna` plus its animal groups), `weather`, `mind`, `discovery`, `fire` and `light`. Ecology is the largest by import count (75 external imports into `fauna`) and needs the render passes and shaders under `modules/ecology/*/client/`.
8. **Docs and tools.** `CLAUDE.md` rewritten around the module contract, wiki pages move into module folders, `npm run modules` scaffolds a new module.

Rough size: step 1 is a day, 2 and 3 a day each, 4 two to three days, 5 a day, 6 two days, 7 three to four days, 8 half a day. Step 4 is the risk.

## Costs and risks

- **Hot loops.** `People.update` runs per person per tick. A sorted activity list is cheap, but every `switch (state)` on a numeric enum that becomes a registry lookup must stay an array index. Measure with `simHash` timing (`advance cpu 61 ms a step` today) after step 4.
- **Layering rule.** CLAUDE.md says ui goes to render goes to sim. A module folder with `sim/` and `client/` halves keeps that rule per half; the checker must enforce it inside the folder too (client may import sim types, sim never imports client).
- **Ids and saves.** Ids by sorted key mean adding a module renumbers later content. Saves are already out of scope, but worker and page must load the same module set. The generated manifest guarantees it.
- **Typing.** Fully open registries lose some exhaustiveness (`switch` over `EntityState`). We keep exhaustiveness on the core states and use string ids for contributed ones.
- **Shaders.** GLSL for animals and passes is assembled in `shaderSources.ts` from the catalogue. Contributed passes bring their own shader text and use the shared `#include` libraries.
- **Wiki.** The wiki imports sim code directly. After the move it imports `modules/*/api.ts` and loads `wiki.ts` from each module, which adds pages by glob.
- **Not everything should be a module.** Terrain, geology, the kernel, calendar, astronomy and the renderer core stay core. Anything every module needs and nothing can remove (the tile grid, `World` itself) is core.

## Decisions taken

Modules live in `src/modules/<name>/`, flat, one folder per feature (the seven animal groups are seven modules). Ids are assigned by sorted key. The first proof is ecology plus environment, then construction.

## Status

Step 1 is mostly done. Done: modules moved to `src/modules/`, flat; the central list is gone (`tools/modules.ts` generates `manifest.generated.ts`, `modules/index.ts` discovers by `order`, `heavy`, `stage`, `optional` flags on each module); capability tokens live in their provider's `api.ts` (`people`, `mind`, `items`, `fauna`, `fish`, `snares`, `mammals`, `homes`, `weather`, `achievements`, `light`) and `sim/capabilities.ts` only keeps core ones (seed, mode, saved, carry, events, clock, calendar, world, spot, trial, ambient and the structures and trails layers); `npm run modules:check` reports the remaining coupling (`--list` names every import, `--strict` fails on any). The sim hash is unchanged.

Measured by the checker: 108 module-to-module imports skip `api.ts`, and outside code reaches into module internals 255 times (render 66, ui 53, content 55, sim 50, labs 31). Those numbers are what steps 2 to 7 drive to zero. Not done: `api.ts` holding more than tokens (types and pure helpers other modules use), the `sim/` and `client/` halves of a folder, and steps 2 to 8.

Step 2 has started. A module now contributes a layer by calling `registerLayer({ id, order, create })` from a file its `module.ts` imports (`modules/items/layer.ts`, `modules/homes/layer.ts`), and `World` builds every registered layer, exposes it as `world.items` or `world.homes` through TypeScript interface merging (`declare module '../../sim/world.ts' { interface World { ... } }`), so no call site changed and the sim hash is identical. `homes` is now a real module with its own `module.ts`. Still core and still to move: `plants`, `trails` and `structures`, because `Movement`, `Plants` and the structure verbs read each other's arrays inside `World`'s constructor. The plan for those is to give `LayerDef.create` a context with the layers built so far and the shared columns, then move `Structures` into the construction module. A process that builds a `World` without loading `modules/index.ts` gets no items or homes layer, which is fine for terrain tools and is why the game, the worker and the zoo all load the module index first.

Step 2 continued. `LayerDef.create` now receives a context (`world`, `column(layer, name)`), and layers are created in `order` with each one assigned onto `World` before the next, so a later layer reads an earlier one (`trails` 5, `structures` 8, `items` 10, `homes` 20). `Trails` moved to `modules/trails/` and `Structures` to `modules/construction/`, each with a `layer.ts` and the `TRAILS` and `STRUCTURES` tokens in their own `api.ts`; the sim hash is unchanged. Only `plants` is still built by `World`, because `Plants` is the shared cover and trample owner. `Movement` falls back to empty arrays when `trails` and `structures` are not registered, so terrain and fauna tools that never load `modules/` still build a `World`.

Step 3 started. Items, stations and blocks are discovered from their folders: `tools/content.ts` generates the def and art manifests (ids from each folder's `order`), so a new content folder needs no edit elsewhere, and art output and the sim hash are unchanged. Still to do: research (hand list), and content contributed from inside a module folder instead of `src/content/`.

Step 4 done in part. People activities are registered (`registerActivity`, `modules/people/activities.ts`): the idle ladder in `rest`, the arrival starts in `arrive` and the finishers in `work` are lookups, and the built-in activities register themselves from `coreActivities.ts`, so another module can add one without editing `People`. Sim hash unchanged; `mindBuild` and `mindHunt` run to the same kind of result. Still to do: a module allocating its own `Task` and `EntityState` ids (both are closed const objects), per-activity `columns`, and cancel hooks.

Step 5 started. `Task` and `EntityState` ids can be allocated by a module (`people/ids.ts`), the activity registry has `carried` and `pickedUp` hooks, and the builder's whole machinery (`build.ts`) now lives in `modules/construction/` and registers itself as an activity; `People` has no build code left (the `buildTile` column stays as a generic work-site column). Sim hash unchanged, and `mindBuild`, `simBuilding` and `simOffers` give the same results. Still core and to move: the plan needs (`PLAN_NEEDS` and the campfire constants in `people/tuning.ts`), `structureAt` and `hasStructure` (people/structures.ts), the station and block content folders, the construction offers' art, and the placement tool in `ui/`.

Step 5 continued. The plan needs and campfire constants moved to `modules/construction/tuning.ts`, the structure sheet to `construction/sheet.ts`, and `modules/people/api.ts` now re-exports the people surface (class, tuning, states, activity registry, ids, bubbles), with every outside import redirected to it: `modules:check` went from 119 to 100 module-to-module imports and outside imports from 235 to 215. Hash unchanged. Still in `src/content/` and `pixel/`: the station and block folders and their art.

Step 6 started. A module's browser half is `modules/<name>/client.ts`, found by `tools/modules.ts` into `client.manifest.generated.ts` and imported only by the main thread (`modules/client.ts`), so the worker never loads it. The first slot is the structure sheet: `registerSheet` in `modules/clientSlots.ts`, with `construction/client.ts` registering the existing sheet and `ui/readout.ts` asking `sheetAt` instead of naming the module. The second slot is drawables: `registerDrawable({ id, order, draw(world, people, stamp) })`, run by `folkInstances` after the items and before the people with a `Stamp` (`seen`, `has`, `grown`, `place`, `flat`, `time`, `ghost`), so the renderer stays one and a module only says where its sprites go. `construction/draw.ts` (stations, fences, blocks, plans, the placement ghost) and `fire/draw.ts` (embers, campfires) are the first two; items, people and the lit passes of the animal groups are still named by the renderer. The third is brushes: `registerBrush({ id, arm(host, args) })` gives a `Brush` (`turn`, `marks`, `ghost`, `note`, `apply`) that `ui/brush.ts` arms from an `arm` offer command naming its `brush`, so the canvas draws marks, ghost and note and applies on click without naming stations; `construction/brush.ts` is the first. Still to do: other tools, HUD tiles, whole render passes, the zoo's library tabs, and moving station and block art out of `pixel/`.

Step 6 continued. The third slot is brushes: `registerBrush({ id, arm(host, args) })` gives a `Brush` (`turn`, `marks`, `ghost`, `note`, `apply`) that `ui/brush.ts` arms from an `arm` offer command naming its `brush`, so the canvas draws marks, ghost and note and applies on click without naming stations; `construction/brush.ts` is the first, and `tools/placementShot.ts` drives it in the real game.

Step 3 and 5 finished. Station and block folders moved into their owners (`construction`, `fire`, `snares`, `discovery`, each under `content/<kind>/<key>/`) and `tools/content.ts` scans every module's `content/` beside `src/content/`; research moved to `modules/<name>/research.ts` with an explicit `at(n)` order so the neuron ids are unchanged (`construction`, `fire`, `items`, `knapping`). `artDigest` is identical and the sim hash is unchanged (people 18f27694ae, world 78defb9984).

Step 1 finished. The widely shared files of the modules (`items`, `groundItems`, the fire sources, the flora species and niche, every animal group's species table, `fauna`, `life`, `patches`, the weather pieces, `trails`, `homes`, `mind`, `neurons`, `thoughts`) are re-exported from their module's `api.ts` and every importer goes through it: module-to-module imports that skip `api.ts` went from 100 to 2, outside code from 239 to 129. Hash unchanged.

Step 8 started. `npm run modules:new -- <name> [--client] [--research] [--item] [--station]` scaffolds a module (and `modules:check` counts the coupling). `CLAUDE.md` describes the module contract; the wiki pages stay in `tools/wiki/` and still import module internals.

Not done, and why. The lit passes (props, water, terrain light, grade, the animal groups, flames, people) are still built and ordered by name in `litLayer.ts`: they share one depth buffer, stencil state, the zoo's pinning and the profiling timer, so a pass slot needs those made explicit first, and that is a rendering refactor to judge on screenshots, not a move. The same goes for the animal content (`content/animals/`) and its shaders, the HUD tiles and the zoo library tabs, the person and item drawing in `folkInstances`, the sprite sheet bake in `pixel/ground/folk.ts` (the station and block sprite generators are in their modules, the sheet that packs them is not), and the wiki pages moving into modules. `plants` is still built by `World`.

Coupling finished. Module-to-module imports that skip `api.ts` are zero and so is outside code (`npm run typecheck` ends with `modules:check --strict`, so a new reach fails the build). The last batch routed the remaining shared files through `api.ts` (the weather views and textures, `shoals`, the fauna wire format, the habitat files, the discovery trial, flora generation and seasons, the achievements list) and gave the mammals a second public entry, `shared.ts` (store, walker, climbing ability, predators), plus the leaf `vocabulary.ts`, because `content/animals` imports them and `mammals/api.ts` imports `content/animals`, which made a module-load cycle (`Gait` read before it exists). Two capability tokens were renamed because an `api.ts` that re-exports data cannot also export a token of the same name: `FISH_SIM` and `EARNED`.


Two consumers of world state, kept apart. World rendering is what the world looks like (terrain, water, weather, a campfire's flame, animals, people): modules bring their own passes, shaders, sprites and models, and the core owns only the GL context, camera, lighting, the shared depth buffer and the shader libraries. The UI is what the player is told (need bubbles, toasts, panels, the radial menu, readouts): it draws a pure `Presentation` built from the replica and sends commands. The test is whether the thing would exist if nobody were looking: a flame would, a hungry bubble would not. A UI overlay may be anchored at a world position through the camera, but the UI never draws the world. Drawables are the first slot on the rendering side; the pass slot (`registerPass` with named layers, a `RenderContext` passed to every pass and allocated texture units) is the next one, starting with the animal groups.

Insects are the first module that brings its own rendering: `modules/insects/client.ts` calls `registerPass` with `pass.ts`, and its shaders live in `modules/insects/shaders/`, assembled with `assembleShader(source, defines)` so its constants are defined by the module and not in `shaderSources.ts`.
