# Element Circuit

A node-based automation game built in two layers: a deterministic headless simulation engine
(Phase 1) and a Rete.js visual canvas that drives it (Phase 2). The engine never imports the
UI; the UI holds the only reference to the engine.

```
src/
  engine/      Headless simulation — no DOM, no React
    types.ts     Channels, Port, Connection, CombineNode, Recipe, TickReport
    buffers.ts   Buffer primitives (deposit / withdraw / capacity / signal clamping)
    nodes.ts     Node + port factories, port lookup by channel
    engine.ts    SimulationEngine: topology, thermodynamics, tick loop
    recipes.ts   Core recipe book (Mud, Clay Block, Steam)
  cli/         Headless harnesses
    levels.ts    The three verification levels
    render.ts    Console formatting of per-tick state
    index.ts     Level runner (exit code 1 if any level fails)
    bridgeCheck.ts  Runs the canvas topology through the engine without a DOM
  ui/          Rete.js v2 + React canvas
    schemes.ts      Rete scheme types, ChannelSocket, CombineNodeRete
    EngineBridge.ts Bi-directional graph ⇄ engine sync and the tick clock
    simStore.ts     External store feeding per-node/per-cable visuals to React
    NodeCanvas.tsx  Editor, area, connection and render plugin wiring
    startingGraph.ts The four elemental sources the canvas opens with
    theme.ts        Channel palette, status colors, tick rate
    nodeCatalog.ts  The elemental sources offered by the right-click menu
    menuStore.ts    Context-menu position and target
    components/     CombineNodeUI, CustomSocket, CustomConnection, ControlBar, ContextMenu
```

```
npm install
npm run dev            # visual canvas at http://localhost:5173
npm run sim            # headless: the three verification levels
npm run check:bridge   # headless: Rete graph ⇄ engine sync checks
npm run typecheck
npm run build
```

## Model

**Channels.** `Solid`, `Fluid`, `Gas`, `Electricity`, `Heat`, `Signal`. Signal amounts are
clamped to 0–15 wherever they cross a port or a pipe.

**One node type.** Every node is a `CombineNode`: typed input ports, typed output ports, an
internal buffer, and a capacity. Source nodes are the same node with a `source` spec that
regenerates a resource into its own output port each tick.

**Internal buffer.** A single `Map<string, number>` holds both ingredients (`"Solid:Earth"`)
and undelivered products (`"out:Gas:Steam"`), sharing one capacity. The prefix is what lets
the flush step tell a product awaiting delivery from an ingredient awaiting a reaction.

**Thermodynamics are combinatorial.** Heat is not stored. Each tick, a node's tier is the
number of *distinct connections* that delivered heat into its Heat port that tick — 1 pipe
is tier 1, 2 pipes is tier 2. Heat ports are cleared at ingest, so a tier must be re-earned
every tick. A recipe fires only when `heatTier >= thermalRequirement`.

## Tick order

Deterministic throughout: nodes iterate in insertion order, connections in declaration order,
and buffer flushes iterate sorted keys. The same graph always produces the same trace.

1. **Regenerate** — source nodes emit into their output ports.
2. **Transfer** — each connection moves up to `throughput` units from an output port to an
   input port, bounded by the destination's free space. Heat deliveries are tallied per node.
3. **Ingest** — input ports drain into the internal buffer; Heat ports are cleared instead.
4. **React** — pick the first satisfied recipe (highest thermal requirement, then most
   ingredients, then id), consume ingredients, write products to the internal buffer.
5. **Flush** — move products from the internal buffer into matching output ports.

## Pressure

Two backpressure rules keep a stalled graph from deadlocking, which matters because steps 3
and 5 share one buffer:

- **Intake halts while products are backed up.** A node with undelivered products ingests
  nothing, so ingredients queue in the pipe instead of filling the buffer that the products
  need to leave through. Status: `overpressure`.
- **Intake reserves product headroom.** Ingestion stops `maxProductUnits` short of capacity
  (the largest output of any registered recipe), so a node can never eat so much that its own
  product has nowhere to go.
- **Intake is capped at recipe demand.** A node holds at most `INTAKE_BATCHES` (4) times the
  largest quantity any recipe asks of a given resource. Without this, a node starved of one
  ingredient fills on the other and can never restart when supply returns — switch the water
  source off for a while and the mixer would deadlock on Earth. A resource no recipe wants is
  never ingested at all; it backs up in the pipe where the player can see it.

Without both, a node whose output unblocks fills with ingredients on the next tick and stalls
permanently. Statuses escalate within a tick and never downgrade:
`idle < starved < crafting < blocked < overpressure`. `disabled` sits outside that ladder: a
switched-off node is skipped before any step runs.

## The canvas (Phase 2)

Rete.js v2 with the area, connection and React render plugins. Nodes, sockets and cables are
all custom React components; the classic preset supplies only the plumbing.

**Channel palette.** Solid `#D97706`, Fluid `#06B6D4`, Gas `#8B5CF6`, Electricity `#EAB308`,
Heat `#EF4444`, Signal `#10B981`, Bundle `#94A3B8`. Sockets, port gauges and cables all read
from `theme.ts`, so a channel has one color everywhere.

**Socket positions.** The canvas supplies its own `socketPositionWatcher`
(`socketPosition.ts`). Rete's stock watcher sums `offsetLeft`/`offsetTop` up the
`offsetParent` chain, which only matches the painted position for unshifted flow layout —
transforms are invisible to it, and margins or absolute positioning on anything other than the
measured wrapper make the cable endpoint drift from the circle. Measuring
`getBoundingClientRect()` instead (dividing by the zoom recovered from the node's rect over
its `offsetWidth`) puts the endpoint wherever the socket actually renders.

**Compatibility.** A cable is refused unless the two sockets' channels match, enforced in the
editor pipe on `connectioncreate` — the drag simply drops. Input ports allow multiple
connections, which Level 3 needs: heat tier is a count of *connected pipes*, so two fire
sources must be able to land on one Heat port.

**Bundle cables.** A `Bundle` port is channel-agnostic and connects to anything. Its buffer
keys contents by channel (`Fluid:Water`), so one bundle cable genuinely carries several
channels at once: entries bound for a concrete port are filtered to that port's channel, and
heat tier counts a bundle pipe when any Heat-channel unit crossed it that tick.

**Elemental sources.** Earth (Solid), Water (Fluid), Fire (Heat) and Air (Gas) are source
nodes: they regenerate one unit per tick and their ports are fixed. The add/remove port
controls are hidden on their cards and the bridge refuses `addPort`/`removePort` for any node
with a `source` spec, so the rule holds even if something calls the bridge directly. Air has
no recipe yet — it is wired in and ready to feed one.

**Outputs are derived, not placed.** A combine node is created with inputs only. The engine's
`predictRecipe` reads the graph — what each upstream supplier would produce, and how many heat
pipes land on the node — and the bridge gives the node exactly the output ports of the matching
recipe, labelled with the product before a single unit has flowed. Wire Earth and Water into a
bare node and a Solid `Mud` output appears; unplug either one and it disappears along with any
cable hanging off it. The status badge reads `Ready [Mud]` or `Waiting [Clay Block]` when a
recipe is matched but not yet running, and the output column reads `no recipe` when nothing
matches. Players still add and remove *input* ports by hand.

Prediction is recursive: a node's products feed its downstream neighbour's prediction, so a
whole chain resolves from the sources outward. Cycles are cut with a visited set, and a
switched-off node offers nothing downstream.

**Port labels.** A port shows the element moving through it — `Water`, `Mud`, `Clay Block` —
in its channel colour, with the channel in the tooltip. The name is sticky: a port that empties
mid-tick keeps its last-seen resource rather than flickering back to the channel name, and a
source port always reads its own resource. A port that has never carried anything falls back to
the channel name.

**Node card.** Title and id, a live status badge (`Idle`, `Active [Mud]`, `Backpressure`,
`Pressure Warning`) plus the current heat tier, input ports with fill gauges on the left,
output ports with items/sec on the right, an internal-buffer meter, and — on combine nodes —
a channel picker with `+ In` / `+ Out` to append ports (hover a port for its remove button).
Source cards show `fixed ports` instead. Widgets sit inside
`Drag.NoDrag` so clicking them doesn't drag the node.

**Right-click menu.** The area plugin emits a `contextmenu` signal that already says whether
the click landed on empty canvas, a node or a cable, so one pipe handler drives all three
menus: empty canvas offers the node catalog (Combine Node and the four elemental sources,
placed where you clicked), a node offers switch on/off and remove, a cable offers remove.
Click position is converted to area coordinates through the area transform, so new nodes land
under the cursor at any pan or zoom. Nodes also carry a × in their header.

**Removing a pipe.** Hovering a cable reveals a delete handle at its midpoint; clicking it
removes the connection from the Rete graph, and the editor pipe drops it from the engine. The
cable carries an invisible 18px-wide hit stroke so it stays easy to hover at any zoom. The
handle sits at the average of the two endpoints, which is the exact midpoint of the classic
cubic path when its control points are symmetric.

**Power toggle.** The ⏻ button on each node card switches it on and off. A disabled node is
inert for the whole tick: it regenerates nothing, ingests nothing, reacts to nothing, and
pipes touching it move nothing in either direction — a powered-down machine should neither
push nor pull. Its buffers keep their contents, so switching it back on resumes mid-stream.
Status reads `Offline` and the card dims.

**Items/sec** is an exponential moving average of units moved per pipe per tick, times the
tick rate — the raw per-tick figure flickers too much to read at 10 ticks/sec.

## The bridge

`EngineBridge` owns the only `SimulationEngine` instance and keeps ids 1:1 in both directions:
a Rete node id *is* its engine node id, a socket key *is* its engine port id, and a Rete
connection id *is* its engine connection id. No lookup tables, so nothing can drift.

- **Graph → engine**: an editor pipe maps `connectioncreate` (validate), `connectioncreated`
  (`engine.connect`), `connectionremoved` (`engine.disconnect`) and `noderemoved`
  (`engine.removeNode`). Adding or removing a port goes through the bridge, which mutates the
  engine node and the Rete node together.
- **Output syncs queue** rather than overlapping. Removing a port removes its cables, which
  fires more editor signals, which request another sync; a re-entrancy guard dropped those and
  left ports a step behind the wiring. `settled()` awaits the queue.
- **Engine → graph**: after each tick the bridge publishes a visual snapshot to `simStore`,
  an external store React reads with `useSyncExternalStore`. Node components re-render
  themselves from the store, so ticking never re-renders the whole canvas.

`rete-react-plugin` mounts each node in its own React root, so a React context provider around
the canvas would not reach node components. That is why the store is a module singleton rather
than context, and why the bridge is reachable from node widgets via `bridgeRef.ts`.

## Levels

| Level | Graph | Verifies |
|---|---|---|
| 1 | Earth (Solid) + Water (Fluid) → Mixer | multi-channel combination → `Mud` |
| 2 | Mixer → Kiln ← 1 Fire | tier-1 thermal gate → `Clay Block` |
| 3 | Water → Boiler ← 2 Fire, Gas output valve closed | tier-2 gate, pressure build-up, recovery on valve open |

Level 3 opens the valve at tick 9 to show the boiler drain and resume rather than stay stuck.

The canvas opens on the four elements alone — Earth, Water, Fire, Air, unconnected — and the
player builds the rest: right-click to add combine nodes, drag cables between matching
channels. `check:bridge` wires Level 1 and Level 2 the same way a player would, so the clay
chain stays covered without the app pre-building it. The control bar
runs Play / Pause / Step at 10 ticks/sec.
