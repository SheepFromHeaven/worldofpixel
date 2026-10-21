import { designRadius } from '../sim/blocks.ts';
import { blocksOf, radiusOf } from '../sim/buildings.ts';
import { lerp, polygonCentroid } from '../sim/geometry.ts';
import type { Bounds, Vec2 } from '../sim/geometry.ts';
import { claims, ownerOf, townIdFor } from '../sim/claims.ts';
import type { Proposal } from '../sim/claims.ts';
import { PARCEL, parcelOf } from '../sim/parcels.ts';
import { zoneCornerOf } from '../sim/zones.ts';
import { positionOf } from '../sim/footpaths.ts';
import { hashString, rng } from '../sim/rng.ts';
import { methodById } from '../sim/book.ts';
import { charOf, heatOf } from '../sim/process.ts';
import { GLOW } from '../sim/models/heat.ts';
import { BlockKind, BuildingState, CarrierState } from '../sim/types.ts';
import type { Building, Carrier, CarrierId, CellId, Design, ItemType as Item, Settlement } from '../sim/types.ts';

export interface GhostInput {
  item: Item;
  /** `ground` is a source block — it only works over its own deposit; `carried` is a door. */
  from: 'ground' | 'carried';
  ok: boolean;
}
import type { GameWorld } from '../sim/world.ts';
import { CARRIER_SCALE, buildOf, drawCarrier, poseOf } from './carrier.ts';
import { drawDecal } from './decals.ts';
import { dugAt, felledAt, groundSprites, placementsIn, siteTrees } from './groundSprites.ts';
import { drawItemChip } from './icons.ts';
import { drawIcon } from './hudPlates.ts';
import { itemIcon } from '../pixel/ui/metrics.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import { DIRT, DIRT_DARK, GLOW_LIGHT, INK, INK_FAINT, INK_SOFT, ITEM_COLORS, RED_PENCIL, SMOKE_TINTS } from './palette.ts';
import {
  drawWobblyCircle,
  drawWobblyLine,
  drawWobblyPath,
  fillPolygon,
  pencil,
  sketchText,
  strokeWeight,
} from './scribble.ts';
import { drawGlow, drawStructure, structureTile } from './structures.ts';
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
  /** The ghost's ways in, and whether this parcel can serve them — siting is the whole decision. */
  ghostInputs: GhostInput[];
}

/** How far a blob of dirt is pulled in from its cell's border, as a fraction of the way in. */

/**
 * How big a bay's icon is drawn, in buffer pixels — the same pixel the ground is drawn from, so
 * one sheet cell comes out as one ground pixel and the mark never coarsens with the rung.
 */
const BAY_PIXELS = 16;

/** Which of the eight arrows points this way. */
const ARROWS = ['arrow-e', 'arrow-se', 'arrow-s', 'arrow-sw', 'arrow-w', 'arrow-nw', 'arrow-n', 'arrow-ne'] as const;

const arrowFor = (dx: number, dy: number): IconName =>
  ARROWS[Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * 8 + 8) % 8] ?? 'arrow-e';

/**
 * Where a hovered works' bays are served from, out on the ground.
 *
 * The inside and the outside are one decision (`zones.ts`): a bay is laid somewhere on the floor,
 * and the carriers walk round to the corner of the parcel it leans towards. That is a real
 * consequence — the paths wear where they are walked, so a drop-off on the river side grows a
 * track to the river — but it would be an invisible one with nothing on the map to point at it.
 *
 * It is drawn as **the thing and the direction, both in pixels**: the item's own icon off the
 * HUD sheet standing at the corner, and one of the eight arrows between it and the works —
 * pointing *in* at a drop-off, *out* at a pick-up. Two earlier passes were wrong in the same
 * way. A pencil thread from the building to the corner said neither which way nor what. Drawing
 * it in the map's hand — a wobbled chip, a wobbled arrow — put a sketch over a map whose every
 * other mark is pixel art, and the two idioms will not sit together at this size.
 *
 * Like a town's name and a town's mark, these are **symbols**: drawn at a fixed number of buffer
 * pixels rather than a patch of world, so they stay the same size as the map is zoomed and never
 * coarsen with the rung.
 */
function drawBays(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  building: Building,
  zoom: number,
): void {
  const { x, y } = building.position;
  const mark = BAY_PIXELS / zoom;
  const taken = new Map<string, number>();

  for (const { block, state } of blocksOf(building)) {
    if (block.kind !== BlockKind.Input && block.kind !== BlockKind.Output) continue;
    const node = zoneCornerOf(world, building, block);
    if (!node) continue;

    // A crate is untyped, so what it shows is whatever is standing in it.
    const inward = block.kind === BlockKind.Input;
    const item = inward ? block.item : state.held?.item;

    const corner = positionOf(world, node);
    const away = Math.hypot(corner.x - x, corner.y - y) || 1;
    const dir = { x: (corner.x - x) / away, y: (corner.y - y) / away };

    // Two bays served from one corner would stack; they step aside along the edge instead.
    const stacked = taken.get(node) ?? 0;
    taken.set(node, stacked + 1);
    const at = {
      x: corner.x - dir.y * stacked * mark * 1.2,
      y: corner.y + dir.x * stacked * mark * 1.2,
    };

    // The arrow sits between the works and the icon, pointing whichever way the goods go.
    // Just inside the icon rather than halfway to the works, so the two read as one marker
    // however far the corner happens to be: a parcel's corner is half a parcel from its middle
    // at one zoom and a quarter of the screen at another.
    const arrow = { x: at.x - dir.x * mark, y: at.y - dir.y * mark };
    const heading = inward ? arrowFor(-dir.x, -dir.y) : arrowFor(dir.x, dir.y);

    // **Both at `mark`, never a fraction of it.** An icon is sixteen cells, and `drawIcon` wants
    // a whole number of device pixels to the cell — asked for four fifths of a sixteen-pixel box
    // it floors to none and draws nothing at all, which is how the arrows came to be missing
    // while the items beside them were fine.
    drawIcon(ctx, heading, arrow.x, arrow.y, mark);
    drawIcon(ctx, itemIcon(item ?? 'crate'), at.x, at.y, mark);
  }
}

function drawBuildingHud(
  ctx: CanvasRenderingContext2D,
  building: Building,
  zoom: number,
  hovered: boolean,
): void {
  const radius = radiusOf(building);
  const { x, y } = building.position;

  // **Nothing hovers over a building.** A row of chips with counts beside them floated above
  // every works and the fire, which on a map where each building is already a picture of itself
  // reads as a spreadsheet pinned over the village — and says the same thing the room says
  // properly, a click away. What a building is holding is the room's question.

  // **No progress ring.** What a machine is part-way through is the room's question, like what
  // it is holding: a ring swept round a building on the map is a readout hovering over a picture
  // of the thing it is reading out.

  // **And no ring round one that is backed up.** It was the last scribble left on the map: a red
  // pencil circle appearing round a works the moment a load landed with nowhere to go, needing
  // neither hover nor a tool in hand, and wobbled hard enough at this size to read as a polygon
  // traced round the parcel. Why a square has nowhere to hand its load on is the room's question
  // — and the room answers it exactly, with a cross on the square that is stuck.

  sketchText(ctx, building.design.label, x, y + radius * 1.6, {
    size: 12 / zoom,
    color: hovered ? INK : INK_SOFT,
    alpha: hovered ? 1 : 0.85,
  });
}

/**
 * What the design in hand would draw from this ground, as icons rather than a sentence. A chip
 * with drips under it fills itself here; a chip with an arrow into it has to be carried. The
 * sentence it replaces was read once and then never again, and siting is the whole decision.
 */
function drawGhostInputs(
  ctx: CanvasRenderingContext2D,
  view: TownView,
  x: number,
  y: number,
): void {
  const chip = 6 / view.zoom;
  const spacing = chip * 4.6;
  const startX = x - ((view.ghostInputs.length - 1) * spacing) / 2;

  view.ghostInputs.forEach((input, index) => {
    const cx = startX + index * spacing;
    drawItemChip(ctx, input.item, cx, y, chip);

    if (input.from === 'carried') {
      // An arrow coming in from the side: somebody has to walk this here.
      pencil(ctx, INK_FAINT, strokeWeight.detail / view.zoom, 0.9);
      drawWobblyLine(ctx, cx - chip * 2.6, y + chip * 2.2, cx - chip * 0.4, y + chip * 2.2, {
        amplitude: 0.1,
        step: chip,
      });
      drawWobblyLine(ctx, cx - chip * 0.4, y + chip * 2.2, cx - chip * 1.1, y + chip * 1.8, {
        amplitude: 0.08,
        step: chip,
      });
      drawWobblyLine(ctx, cx - chip * 0.4, y + chip * 2.2, cx - chip * 1.1, y + chip * 2.6, {
        amplitude: 0.08,
        step: chip,
      });
      return;
    }

    if (input.ok) {
      // Drips off a line of ground: this parcel holds it, and the source opens straight onto it.
      pencil(ctx, ITEM_COLORS[input.item], strokeWeight.detail / view.zoom, 0.9);
      drawWobblyLine(ctx, cx - chip * 1.5, y + chip * 2.4, cx + chip * 1.5, y + chip * 2.4, {
        amplitude: 0.1,
        step: chip,
      });
      for (let drip = -1; drip <= 1; drip += 1) {
        drawWobblyLine(ctx, cx + drip * chip, y + chip * 1.7, cx + drip * chip, y + chip * 2.2, {
          amplitude: 0.08,
          step: chip,
        });
      }
      return;
    }

    // Struck through: there is none of this under the parcel, so the machine cannot stand here.
    pencil(ctx, RED_PENCIL, strokeWeight.form / view.zoom, 0.95);
    drawWobblyLine(ctx, cx - chip * 1.6, y - chip * 1.6, cx + chip * 1.6, y + chip * 1.6, {
      amplitude: 0.12,
      step: chip,
    });
    drawWobblyLine(ctx, cx + chip * 1.6, y - chip * 1.6, cx - chip * 1.6, y + chip * 1.6, {
      amplitude: 0.12,
      step: chip,
    });
  });
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
    drawStructure(ctx, view.ghost, centre.x, centre.y, radius, { time: view.time, working: false });
    ctx.restore();
    sketchText(
      ctx,
      view.hoverAction === 'found' ? 'set the hearth here' : `raise a ${view.ghost.label}`,
      centre.x,
      centre.y + radius * 1.8,
      { size: 12 / view.zoom, color: allowed ? RED_PENCIL : INK_FAINT },
    );
    drawGhostInputs(ctx, view, centre.x, centre.y + radius * 2.6);
    return;
  }

}

function drawRazeOverlay(ctx: CanvasRenderingContext2D, building: Building, zoom: number): void {
  const reach = radiusOf(building) * 1.6;
  const { x, y } = building.position;
  pencil(ctx, RED_PENCIL, strokeWeight.form / zoom, 0.95);
  drawWobblyCircle(ctx, x, y, reach, { amplitude: 0.4, seed: hashString(`raze${building.id}`) });
  drawWobblyPath(ctx, [{ x: x - reach * 0.7, y: y - reach * 0.7 }, { x: x + reach * 0.7, y: y + reach * 0.7 }], { amplitude: 0.3, step: 4 });
  drawWobblyPath(ctx, [{ x: x + reach * 0.7, y: y - reach * 0.7 }, { x: x - reach * 0.7, y: y + reach * 0.7 }], { amplitude: 0.3, step: 4 });
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

/** How far down the map the front of a building's drawing stands, from its parcel's middle. */
const frontOf = (building: Building): number =>
  tilePieces(structureTile(building.design)).reduce((front, piece) => Math.max(front, piece.depth), 0);

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
function rigLook(settlement: Settlement, building: Building): { glow?: GlowLight; smoke?: Tint } {
  const rig = building.rig;
  if (!rig?.running) return {};

  if (rig.process === 'char') {
    const method = methodById(settlement.book, rig.running.methodId);
    return { smoke: SMOKE_TINTS[method ? charOf(method).smoke : 'white'] };
  }

  const { glow } = heatOf(rig, settlement.book);
  const step = GLOW.findIndex((entry) => entry.name === glow.name);
  const color = GLOW_LIGHT[glow.name];
  return {
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
      if (carrier.state === CarrierState.Working) inside.set(carrier.atId, carrier.id);
    }

    for (const building of settlement.buildings.values()) {
      const worker = inside.get(building.id);
      const tile = structureTile(building.design);
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
            drawStructure(ctx, building.design, building.position.x, building.position.y, radiusOf(building), {
              time: view.time,
              working: building.state === BuildingState.Working,
              ...(worker ? { worker: buildOf(worker) } : {}),
              ...(look.smoke ? { smoke: look.smoke } : {}),
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
      // Inside a land work, at work: drawn in the building's own tile, not out here.
      if (carrier.state === CarrierState.Working) continue;
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
                1.4 / (view.zoom * CARRIER_SCALE),
              ),
          });
        }
        continue;
      }
      const position = view.carrierPositions.get(carrier.id) ?? standingSpot(carrier, settlement);
      // A pencil line on the figure, whatever the zoom: the drawing is in its own units, so the
      // width has to be divided back through both the figure's scale and the camera's.
      standing.push({
        y: position.y,
        draw: () =>
          drawCarrier(ctx, poseOf(carrier, position, view.time), CARRIER_SCALE, 1.4 / (view.zoom * CARRIER_SCALE)),
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
      const hovered = view.hoveredBuildingId === building.id;
      if (hovered) drawBays(ctx, world, building, view.zoom);
      drawBuildingHud(ctx, building, view.zoom, hovered);
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
