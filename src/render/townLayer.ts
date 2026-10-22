import type { Bounds, Vec2 } from '../sim/geometry.ts';
import { claims, ownerOf, townIdFor } from '../sim/claims.ts';
import type { Proposal } from '../sim/claims.ts';
import { PARCEL, parcelOf } from '../sim/parcels.ts';
import { CHARGE_LOW, CHARGE_STEPS, methodById } from '../sim/book.ts';
import type { Method } from '../sim/book.ts';
import { charOf, heatOf, scanQueue } from '../sim/process.ts';
import { GLOW } from '../sim/models/heat.ts';
import { itemIcon } from '../pixel/ui/metrics.ts';
import { asleepIndoors } from '../sim/needs.ts';
import { firstStation, groundWork, occupants, stageOf, stations } from '../sim/area.ts';
import { labelOf } from '../sim/buildings.ts';
import { landWorkById } from '../sim/landWorks.ts';
import type { Rig } from '../sim/process.ts';
import { BuildingState, CarrierState } from '../sim/types.ts';
import type { Building, Carrier, CarrierId, CellId, Design, ItemType as Item, Settlement } from '../sim/types.ts';

import type { GameWorld } from '../sim/world.ts';
import { CARRIER_SCALE, buildOf, drawCarrier, poseOf } from './carrier.ts';
import { drawDecal } from './decals.ts';
import { dugAt, felledAt, groundSprites, placementsIn, siteTrees } from './groundSprites.ts';
import { drawIcon, drawNamePlate } from './hudPlates.ts';
import { GLOW_LIGHT, SMOKE_TINTS } from './palette.ts';
import { designRadius, drawGlow, drawStructure, structureTile } from './structures.ts';
import type { GlowLight } from './structures.ts';
import { drawTile, tileFits, tilePieces } from './sprites.ts';
import type { Tint } from './sprites.ts';
import { TEXEL } from './terrainPixels.ts';

export interface TownView {
  time: number;
  /** What is on screen, in world units — the trees standing in it are drawn with the town. */
  bounds: Bounds;
  /** Screen pixels per world unit, so labels and chips can keep a constant size on screen. */
  zoom: number;
  carrierPositions: Map<CarrierId, Vec2>;
  tool: string;
  hoveredParcelId: CellId | null;
  hoveredBuildingId: string | null;
  hoverAction: string;
  /** The design the build tool is holding, drawn under the cursor before it is raised. */
  ghost: Design | null;
}

/** Buffer pixels between a building's foot and the top of its name. */
const NAME_GAP = 2;

function drawBuildingHud(
  ctx: CanvasRenderingContext2D,
  building: Building,
): void {
  const radius = designRadius(shownDesign(building));
  const { x, y } = building.position;

  // **Nothing hovers over a building.** A row of chips with counts beside them floated above
  // every works and the fire, which on a map where each building is already a picture of itself
  // reads as a spreadsheet pinned over the village — and says the same thing the slab says
  // properly, a click away. What a building is holding is the slab's question.

  // **No progress ring.** What a rig is part-way through is the slab's question, like what it is
  // holding: a ring swept round a building on the map is a readout hovering over a picture of
  // the thing it is reading out.

  // **And no ring round one that is stuck.** It was the last scribble left on the map: a red
  // pencil circle appearing round a works the moment a load landed with nowhere to go, needing
  // neither hover nor a tool in hand, and wobbled hard enough at this size to read as a polygon
  // traced round the parcel. Why a rig is not running is the slab's question — and the slab
  // answers it exactly, with a cross through the queue entry it cannot run and the book's own
  // words under it.

  // **A name is a label, not a readout**: set at the building's foot on a slate of its own, in
  // buffer pixels, so it holds its size at every zoom and never sits over the roof.
  const { a, d, e, f } = ctx.getTransform();
  drawNamePlate(ctx, labelOf(building), a * x + e, d * (y + radius * 1.6) + f + NAME_GAP);
}

/** The parcel under the cursor, and what the tool in hand would do to it. */
function drawToolOverlay(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  view: TownView,
): void {
  if (!view.hoveredParcelId || view.tool === 'inspect') return;
  const parcel = parcelOf(world.seed, view.hoveredParcelId);
  if (parcel.vertices.length < 3) return;

  const centre = parcel.site;

  // **The hovered parcel is never outlined.** It was a red pencil line traced round the cell
  // under the cursor, and it was the last scribble left on a map whose marks are all pixels —
  // a hand-drawn ring over ground that is painted, stones that are sprites and labels that are
  // bitmap glyphs. What the player needs is *what would stand here*, which the ghost says by
  // standing there; the cell it stands on needs no ring round it to be the cell it stands on.
  if (view.ghost) {
    // Drawn even where it cannot stand, at half the weight: being told *why* a parcel is wrong —
    // no water under it — is the whole lesson, and an empty cursor teaches nothing.
    const allowed = view.hoverAction === 'build' || view.hoverAction === 'found';
    const radius = designRadius(view.ghost);
    ctx.save();
    ctx.globalAlpha = allowed ? 0.45 : 0.18;
    drawStructure(ctx, view.ghost, centre.x, centre.y, radius, { time: view.time });
    ctx.restore();
    // Named the way a standing building is, on its slate at its foot, so the thing in hand reads
    // as the thing it will be.
    const { a, d, e, f } = ctx.getTransform();
    const plateX = a * centre.x + e;
    const plateTop = d * (centre.y + radius * 1.6) + f + NAME_GAP;
    drawNamePlate(ctx, view.ghost.label, plateX, plateTop);
    return;
  }

}

/**
 * How big the strike is drawn, in buffer pixels. Twice a bay's icon: there is one of these on
 * the map at a time and it has to be found at a glance, where a row of bay icons must not shout.
 */
const RAZE_PIXELS = 32;

/**
 * What the raze tool is pointing at: a strike through the building, in the town's red.
 *
 * It was a red pencil ring with a cross through it, which is exactly the mark `CLAUDE.md` says
 * the game does not mean — a hand-drawn line over a map whose ground is painted, whose stones
 * are sprites and whose labels are bitmap glyphs, and wobbled hard enough at this size to read
 * as a polygon traced round the parcel.
 *
 * The strike and not the bar's own pick, though the icons there are objects rather than symbols
 * and the pick is the tool in hand. A pick is sixteen cells of brown haft and grey head, and
 * stood on the ground beside a well it reads as part of the well — a handle, a pump — because
 * everything else out there is brown and grey as well. The saltire is the mark the cursor
 * already strikes through an input the ground cannot give with, in the one colour on this map
 * that is never scenery.
 *
 * Laid over the building rather than hovering above it: it is not a readout of what the
 * building is doing but what would be done *to* it, the same way a ghost stands on the parcel
 * it would be raised on.
 */
function drawRazeOverlay(ctx: CanvasRenderingContext2D, building: Building, zoom: number): void {
  drawIcon(ctx, 'strike', building.position.x, building.position.y, RAZE_PIXELS / zoom);
}

/**
 * Where someone preparing a site stands, what they hold, and which way they work.
 *
 * Felling first: beside the next tree to come down, on the side the plot is — working outward from
 * where the building will go — with the axe towards the trunk. Then digging: with a spade, working
 * round the plot as the lot spreads, so the patch is seen being dug rather than appearing under one
 * spot. Never an axe at nothing: a site with no trees on it is dug from the first stroke.
 */
function preparingAt(
  world: GameWorld,
  settlement: Settlement,
  siteId: string | undefined,
): (Vec2 & { toward: 'w' | 'e'; tool: 'chop' | 'dig' }) | null {
  const site = siteId ? settlement.buildings.get(siteId) : undefined;
  if (!site) return null;
  const sprites = groundSprites();
  const next = sprites ? siteTrees(world, sprites, site)[felledAt(world, sprites, site)] : undefined;
  if (next && site.clearing && site.clearing.done < site.clearing.felling) {
    const plotToTheLeft = site.position.x < next.x;
    return {
      x: next.x + TEXEL * (plotToTheLeft ? -4 : 4),
      y: next.y + TEXEL * 0.5,
      toward: plotToTheLeft ? 'e' : 'w',
      tool: 'chop',
    };
  }
  const round = dugAt(site) * Math.PI * 3;
  const spot = { x: site.position.x + Math.cos(round) * PARCEL * 0.22, y: site.position.y + Math.sin(round) * PARCEL * 0.15 };
  const rightOfSpot = Math.cos(round) <= 0;
  return { x: spot.x + TEXEL * (rightOfSpot ? 4 : -4), y: spot.y, toward: rightOfSpot ? 'w' : 'e', tool: 'dig' };
}

/**
 * Where a building meets the ground, for putting it in order with what stands round it: the near
 * edge of its lot rather than its middle, since in the three-quarter view (`view.ts`) the front
 * of a building is what a tree just in front of it has to cover, and a tree just behind it has
 * to be covered by.
 */
const BUILDING_FOOT = PARCEL * 0.3;

/**
 * A villager at a building stands at the door it walked to (`setOff`), and its feet sort against
 * the drawing's foot like anything else on the map. The one left standing in the *middle* of a
 * parcel never walked to a door — just hired at the fire, or out of a shift at a land work — and
 * a parcel's middle is the inside of the building on it, so it steps a stride out in front of the
 * drawing rather than being drawn down the well it has just come out of. How far out comes off
 * the drawing (`tilePieces`): a well's rim nearly fills its tile and a hearth's ring is half that
 * across, so no one number is right for both.
 */
const STANDING_STEP = TEXEL * 2;

/**
 * What an area is drawn as on the map: the station in it with a drawing of its own (a fire, a
 * pit, a clamp), else the land work opening its ground, else whatever stands in it first, else
 * the bare works floor.
 */
function shownDesign(area: Building): Design {
  const all = occupants(area);
  return (
    all.find((design) => structureTile(design) !== 'works' && !landWorkById(design.id)) ??
    groundWork(area)?.design ??
    all[0] ??
    BARE
  );
}

/** An area with nothing standing in it yet: a cleared patch, drawn as the works floor. */
const BARE: Design = { id: 'clearing', label: 'Clearing', capacity: 8 };

/** The station whose fire and smoke the map shows: the one drawn, or the first with a rig. */
function shownRig(area: Building): Rig | null {
  const shown = shownDesign(area);
  return area.slots.find((slot) => slot.design?.id === shown.id && slot.rig)?.rig ?? firstStation(area)?.rig ?? null;
}

/** How far down the map the front of a building's drawing stands, from its parcel's middle. */
const frontOf = (building: Building): number =>
  tilePieces(structureTile(shownDesign(building))).reduce((front, piece) => Math.max(front, piece.depth), 0);

/** A carrier's drawn position: where it is walking or standing, stepped out of any building. */
export function standingSpot(carrier: Carrier, settlement: Settlement): Vec2 {
  if (carrier.trail.length > 0) return carrier.position;
  const at = settlement.buildings.get(carrier.atId);
  const inside = at && at.position.x === carrier.position.x && at.position.y === carrier.position.y;
  return inside ? { x: carrier.position.x, y: at.position.y + frontOf(at) + STANDING_STEP } : carrier.position;
}

/**
 * How far above the line it marks the border stone's tile is drawn — its own foot, which is below
 * the middle of its grid, so the tile goes up by that much for the stone to sit on the line
 * (`tilePieces`). It was a constant of its own here before, one place too many.
 */
const stoneLift = (): number => tilePieces('border-stone')[0]?.depth ?? 0;

/** A border stone, as something standing: in order with the trees, buildings and villagers. */
const stoneAt = (ctx: CanvasRenderingContext2D, at: Vec2) => ({
  y: at.y,
  draw: () => drawTile(ctx, 'border-stone', at.x, at.y - stoneLift()),
});

/**
 * The stones a placement under the cursor would set: a new hearth's whole ring, or the ring a
 * building at the edge would push out. Faint, and over everything — it is a question being asked,
 * not a thing standing there yet.
 */
function drawProposedStones(ctx: CanvasRenderingContext2D, world: GameWorld, view: TownView): void {
  const cell = view.hoveredParcelId;
  if (!cell) return;
  let proposal: Proposal | undefined;
  if (view.tool === 'hearth' && view.hoverAction === 'found') {
    proposal = { owner: townIdFor(cell), cellId: cell, hearth: true };
  } else if (view.tool.startsWith('place:') && view.hoverAction === 'build') {
    const owner = ownerOf(world, cell);
    if (owner) proposal = { owner, cellId: cell, hearth: false };
  }
  if (!proposal) return;

  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const at of claims(world, proposal).stones.get(proposal.owner) ?? []) {
    drawTile(ctx, 'border-stone', at.x, at.y - stoneLift());
  }
  ctx.restore();
}

/**
 * What a rig on this floor shows of itself, which is the whole of what the map says about one.
 *
 * The control and the readout are the same drawing: a kiln's heat is its glow, and a charcoal
 * clamp — which never glows, being a pile cooking itself under earth — says how far through it
 * is in the colour of its smoke. Nothing is written over a building and no number is drawn; how
 * hot it is and what is in it are the room's questions.
 */
/** Which banking a method is run at, as an index into `CHARGE_STEPS`. Nothing running is banked. */
const chargeOf = (method: Method | undefined): number =>
  Math.min(Math.max(0, method?.run.charge ?? CHARGE_LOW), CHARGE_STEPS.length - 1);

/**
 * Where each slot of an open area stands on its parcel: round an ellipse, foreshortened like
 * anything lying on the ground, the first on the left, so two stand side by side rather than one
 * hiding the other.
 */
function slotSpots(area: Building): Vec2[] {
  const n = area.slots.length;
  if (n === 1) return [{ ...area.position }];
  return area.slots.map((_, index) => {
    const angle = Math.PI + (2 * Math.PI * index) / n;
    return {
      x: area.position.x + Math.cos(angle) * PARCEL * 0.36,
      y: area.position.y + Math.sin(angle) * PARCEL * 0.24,
    };
  });
}

/** The small drawing a design stands as in a shared area. */
const miniOf = (id: string | undefined): string => (id === undefined ? 'mini-slot' : id === 'hearth' ? 'hearth' : `mini-${id}`);

/**
 * An open area with several things in it: its yard ring once it has one, then every slot as the
 * small drawing of what stands there — empty ones too, so the slots can be counted from outside.
 */
function pushYard(
  ctx: CanvasRenderingContext2D,
  settlement: Settlement,
  area: Building,
  view: TownView,
  standing: { y: number; draw: () => void }[],
): void {
  const faint = area.clearing !== null;
  const look = rigLook(settlement, area);
  if (area.stage >= 1 && tileFits('works', view.zoom)) {
    for (const piece of tilePieces('works')) {
      standing.push({
        y: area.position.y + piece.depth,
        draw: () => {
          ctx.save();
          if (faint) ctx.globalAlpha = 0.35;
          drawTile(ctx, 'works', area.position.x, area.position.y, piece.clip ?? 'default');
          ctx.restore();
        },
      });
    }
  }
  const spots = slotSpots(area);
  area.slots.forEach((slot, index) => {
    const at = spots[index];
    if (!at) return;
    const name = miniOf(slot.design?.id);
    const fire = slot.rig?.running && slot.rig.process === 'fire'
      ? chargeOf(methodById(settlement.book, slot.rig.running.methodId))
      : look.fire;
    for (const piece of tilePieces(name)) {
      standing.push({
        y: at.y + piece.depth,
        draw: () => {
          ctx.save();
          if (faint) ctx.globalAlpha = 0.35;
          if (name === 'hearth' && slot.design) {
            drawStructure(ctx, slot.design, at.x, at.y, designRadius(slot.design), {
              time: view.time,
              ...(fire !== undefined ? { fire } : {}),
              ...(piece.clip ? { piece } : {}),
            });
          } else {
            drawTile(ctx, name, at.x, at.y, piece.clip ?? 'default');
          }
          ctx.restore();
        },
      });
    }
  });
}

/**
 * Whether an area is stuck: it has stations, none of them is working or changing over, and every
 * line on its list is refused for something other than a full shelf. A full shelf is done, not
 * stuck.
 */
function stuck(settlement: Settlement, area: Building): boolean {
  const all = stations(area);
  if (all.length === 0 || area.clearing) return false;
  for (const { slot, rig } of all) {
    if (rig.running || rig.changeover > 0) return false;
    const scan = scanQueue(rig, settlement.book, area, slot);
    if (scan.method || scan.refused.some((refusal) => refusal.kind === 'full')) return false;
  }
  return true;
}

/**
 * A roofed area: a building, and the view of what is inside it gone. What the map still says it
 * says another way — smoke at the vent while a fire inside is working, a glow at the door while
 * anything is, and a cross over it when it is stuck.
 */
function pushRoofed(
  ctx: CanvasRenderingContext2D,
  settlement: Settlement,
  area: Building,
  view: TownView,
  standing: { y: number; draw: () => void }[],
): void {
  const tile = stageOf(area).chimney ? 'works-stone' : 'works-roofed';
  const all = stations(area);
  const busy = all.some(({ rig }) => rig.running !== null);
  const smoking = all.some(({ rig }) => rig.running !== null && rig.process !== 'hand');
  const look = rigLook(settlement, area);
  const frame = Math.floor(view.time * 2) % 3;
  for (const piece of tilePieces(tile)) {
    if (piece.clip === 'smoke' && !smoking) continue;
    if (piece.clip === 'glow' && !busy) continue;
    standing.push({
      y: area.position.y + piece.depth,
      draw: () => {
        ctx.save();
        if (area.clearing) ctx.globalAlpha = 0.35;
        drawTile(ctx, tile, area.position.x, area.position.y, piece.clip ?? 'default', piece.clip === 'smoke' ? frame : 0, false, piece.clip === 'smoke' ? look.smoke : undefined);
        ctx.restore();
      },
    });
  }
  if (stuck(settlement, area)) {
    const front = Math.max(0, ...tilePieces(tile).map((piece) => piece.depth));
    standing.push({
      y: area.position.y + front + TEXEL,
      draw: () => drawIcon(ctx, 'strike', area.position.x, area.position.y, (RAZE_PIXELS * 0.75) / view.zoom),
    });
  }
}

function rigLook(
  settlement: Settlement,
  building: Building,
): { glow?: GlowLight; smoke?: Tint; fire?: number } {
  const rig = shownRig(building);

  // A hand rig has no fire under it at all, so it has nothing to show: smoke over a cord walk
  // is a fire nobody lit.
  if (!rig || rig.process === 'hand') return {};

  // A fire rig says how hard it is being driven in the height of its flame, which is the same
  // drawing the player picked it with. Nothing running banks it rather than putting it out: the
  // town's own fire is never cold, and a hearth drawn out reads as the game having stopped.
  const banking = rig.process === 'fire'
    ? { fire: chargeOf(rig.running ? methodById(settlement.book, rig.running.methodId) : undefined) }
    : {};

  if (!rig.running) return banking;

  if (rig.process === 'char') {
    const method = methodById(settlement.book, rig.running.methodId);
    return { smoke: SMOKE_TINTS[method ? charOf(method).smoke : 'white'] };
  }

  const { glow } = heatOf(rig, settlement.book);
  const step = GLOW.findIndex((entry) => entry.name === glow.name);
  const color = GLOW_LIGHT[glow.name];
  return {
    ...banking,
    smoke: SMOKE_TINTS.white,
    ...(color && step > 0 ? { glow: { color, level: step / (GLOW.length - 1) } } : {}),
  };
}

export function drawTowns(ctx: CanvasRenderingContext2D, world: GameWorld, view: TownView): void {
  // Everything that stands up — trees, buildings, villagers — in one list, drawn in order of
  // where it stands: further down the map is nearer, so it goes on last and overlaps what is
  // behind it. Drawn by kind instead, a villager walking behind a tree came out in front of it.
  const standing: { y: number; draw: () => void }[] = [];

  // The edge of every claim, as stones standing on it (`claims.ts`).
  for (const stones of claims(world).stones.values()) {
    for (const at of stones) standing.push(stoneAt(ctx, at));
  }

  const sprites = groundSprites();
  if (sprites) {
    for (const placement of placementsIn(world, sprites, view.bounds, true)) {
      standing.push({ y: placement.y, draw: () => drawDecal(ctx, placement) });
    }
  }

  for (const settlement of world.settlements.values()) {
    // Who is inside which land work, so the building can show that same villager at it.
    const inside = new Map<string, string>();
    for (const carrier of settlement.carriers.values()) {
      // Only somebody working the ground shows in the tile; a watch at a station is inside it.
      if (carrier.state === CarrierState.Working && carrier.job?.kind === 'work') inside.set(carrier.atId, carrier.id);
    }

    for (const building of settlement.buildings.values()) {
      // A roofed area is a building and nothing of what is inside it shows. An open one shows each
      // thing standing in its slot, inside its wall once it has one. The one case drawn whole is
      // a clearing with a single thing in it, which is the tile that thing always had.
      if (stageOf(building).roofed) {
        pushRoofed(ctx, settlement, building, view, standing);
        continue;
      }
      if (building.stage > 0 || occupants(building).length !== 1) {
        pushYard(ctx, settlement, building, view, standing);
        continue;
      }
      const worker = inside.get(building.id);
      const shown = shownDesign(building);
      const tile = structureTile(shown);
      const look = rigLook(settlement, building);
      // One entry per piece of the drawing, each standing where it stands: the pit of a hearth, the
      // fire out of it, every stone of a works' ring. A villager at the fireside is then drawn over
      // the far stones and under the near ones, because that is what its feet say. Where the tile
      // cannot be drawn at all — not decoded yet, or a rung too coarse to cut it honestly — the
      // pencil stand-in is one drawing and takes one key, the front of the lot.
      const pieces: { clip?: string; depth: number }[] = !tileFits(tile, view.zoom)
        ? [{ depth: BUILDING_FOOT }]
        : worker
          // At work, a land work is one animated drawing of the whole tile (`drawStructure`), so
          // it takes one key: the front of it, where the villager is standing.
          ? [{ depth: frontOf(building) }]
          : [...tilePieces(tile)];
      for (const piece of pieces) {
        standing.push({
          y: building.position.y + piece.depth,
          draw: () => {
            // Placed but not raised: the building is a faint promise on its site until the trees
            // round it are down (`clearing.ts`).
            ctx.save();
            if (building.clearing) ctx.globalAlpha = 0.35;
            drawStructure(ctx, shown, building.position.x, building.position.y, designRadius(shown), {
              time: view.time,
              ...(worker ? { worker: buildOf(worker) } : {}),
              ...(look.smoke ? { smoke: look.smoke } : {}),
              ...(look.fire !== undefined ? { fire: look.fire } : {}),
              ...(piece.clip ? { piece } : {}),
            });
            ctx.restore();
          },
        });
      }

      // The light the rig throws, in the sort with everything else: the pool on the ground goes
      // under the whole drawing, the chamber over it, so the near face of the mound is lit and a
      // villager walking in front of the fire is still in front of it.
      const glow = look.glow;
      if (glow) {
        const { x, y } = building.position;
        const back = (pieces[0]?.depth ?? 0) - TEXEL;
        standing.push({ y: y + back, draw: () => drawGlow(ctx, x, y, glow, view.time, 'ground') });
        standing.push({
          y: y + frontOf(building),
          draw: () => drawGlow(ctx, x, y, glow, view.time, 'chamber'),
        });
      }
    }

    for (const carrier of settlement.carriers.values()) {
      // Inside a land work, at work: drawn in the building's own tile, not out here. Asleep under
      // a roof is inside too.
      if (carrier.state === CarrierState.Working || asleepIndoors(settlement, carrier)) continue;
      if (carrier.state === CarrierState.Clearing) {
        const at = preparingAt(world, settlement, carrier.job?.sourceId);
        if (at) {
          standing.push({
            y: at.y,
            draw: () =>
              drawCarrier(
                ctx,
                { ...poseOf(carrier, at, view.time), preparing: { tool: at.tool, toward: at.toward } },
                CARRIER_SCALE,
              ),
          });
          continue;
        }
        // Building an area's next stage round it has no tree to stand at: drawn where it stands.
      }
      const position = view.carrierPositions.get(carrier.id) ?? standingSpot(carrier, settlement);
      standing.push({
        y: position.y,
        draw: () => drawCarrier(ctx, poseOf(carrier, position, view.time), CARRIER_SCALE),
      });
    }
  }

  standing.sort((a, b) => a.y - b.y);
  for (const thing of standing) thing.draw();
  drawProposedStones(ctx, world, view);

  // The chips over the buildings after everything, so a tree in front of a building never hides
  // what the building is waiting on.
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      drawBuildingHud(ctx, building);
    }
  }

  drawToolOverlay(ctx, world, view);

  if (view.hoverAction === 'raze' && view.hoveredBuildingId) {
    for (const settlement of world.settlements.values()) {
      const target = settlement.buildings.get(view.hoveredBuildingId);
      if (target) drawRazeOverlay(ctx, target, view.zoom);
    }
  }
}
