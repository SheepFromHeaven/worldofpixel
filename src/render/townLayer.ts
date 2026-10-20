import { designRadius, recipeOf } from '../sim/blocks.ts';
import { blocksOf, radiusOf, visibleBuffers } from '../sim/buildings.ts';
import { lerp, polygonCentroid } from '../sim/geometry.ts';
import type { Bounds, Vec2 } from '../sim/geometry.ts';
import { claims, ownerOf, townIdFor } from '../sim/claims.ts';
import type { Proposal } from '../sim/claims.ts';
import { PARCEL, parcelOf } from '../sim/parcels.ts';
import { hashString, rng } from '../sim/rng.ts';
import { BuildingState, CarrierState } from '../sim/types.ts';
import type { Building, CarrierId, CellId, Design, ItemType as Item, Settlement } from '../sim/types.ts';

export interface GhostInput {
  item: Item;
  /** `ground` is a source block — it only works over its own deposit; `carried` is a door. */
  from: 'ground' | 'carried';
  ok: boolean;
}
import type { GameWorld } from '../sim/world.ts';
import { buildOf, drawCarrier, poseOf } from './carrier.ts';
import { drawDecal } from './decals.ts';
import { dugAt, felledAt, groundSprites, placementsIn, siteTrees } from './groundSprites.ts';
import { drawItemChip } from './icons.ts';
import { DIRT, DIRT_DARK, INK, INK_FAINT, INK_SOFT, ITEM_COLORS, RED_PENCIL } from './palette.ts';
import {
  drawWobblyCircle,
  drawWobblyLine,
  drawWobblyPath,
  fillPolygon,
  pencil,
  sketchText,
  strokeWeight,
} from './scribble.ts';
import { drawStructure } from './structures.ts';
import { drawTile } from './sprites.ts';
import { TEXEL } from './terrainPixels.ts';

/** The stick figure is drawn about 17 units tall; this brings it down beside a building. */
const CARRIER_SCALE = 0.1;

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

function drawBuildingHud(
  ctx: CanvasRenderingContext2D,
  building: Building,
  zoom: number,
  hovered: boolean,
): void {
  const radius = radiusOf(building);
  const { x, y } = building.position;
  const top = y - radius * 1.9;
  const chip = 6 / zoom;

  const chips = visibleBuffers(building).filter((buffer) => buffer.capacity > 0);
  const spacing = chip * 4.3;
  const startX = x - ((chips.length - 1) * spacing) / 2;
  chips.forEach((buffer, index) => {
    const cx = startX + index * spacing;
    ctx.globalAlpha = buffer.amount > 0 ? 1 : 0.4;
    drawItemChip(ctx, buffer.item, cx, top, chip);
    ctx.globalAlpha = 1;
    sketchText(ctx, `${buffer.amount}`, cx + chip * 1.8, top + chip * 1.3, {
      size: 11 / zoom,
      color: buffer.amount >= buffer.capacity ? RED_PENCIL : INK_SOFT,
      align: 'left',
    });
  });

  // One ring for the whole building, taken from whichever combine block is furthest along: the
  // player is watching a machine work, not auditing each square.
  let fraction = 0;
  let making: Building['design']['blocks'][number] | null = null;
  for (const { block, state } of blocksOf(building)) {
    const recipe = recipeOf(block);
    if (!recipe || state.progress === 0) continue;
    const progress = state.progress / recipe.ticks;
    if (progress > fraction) {
      fraction = progress;
      making = block;
    }
  }

  if (making) {
    const recipe = recipeOf(making);
    if (recipe) {
      pencil(ctx, ITEM_COLORS[recipe.output], strokeWeight.form / zoom, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.5, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
      ctx.stroke();
    }
  }

  if (building.state === BuildingState.Blocked) {
    pencil(ctx, RED_PENCIL, strokeWeight.detail / zoom, 0.8);
    drawWobblyCircle(ctx, x, y, radius * 1.6, { amplitude: 0.3, seed: hashString(building.id) });
  }

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
  const allowed = view.hoverAction !== 'none';
  pencil(ctx, allowed ? RED_PENCIL : INK_FAINT, strokeWeight.form / view.zoom, allowed ? 0.9 : 0.6);
  drawWobblyPath(ctx, parcel.vertices, { amplitude: 0.3, wavelength: 12, step: 4 }, true);

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
 * How far below the middle of the border stone's tile the stone stands, in cells — the tile is
 * drawn centred on a point and the stone's foot is five cells below that. Written here rather than
 * imported because the game does not import authoring code; `borderStone.ts` has `STONE_FOOT`.
 */
const STONE_FOOT_CELLS = 5;

/** A border stone, as something standing: in order with the trees, buildings and villagers. */
const stoneAt = (ctx: CanvasRenderingContext2D, at: Vec2) => ({
  y: at.y,
  draw: () => drawTile(ctx, 'border-stone', at.x, at.y - STONE_FOOT_CELLS * TEXEL),
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
    drawTile(ctx, 'border-stone', at.x, at.y - STONE_FOOT_CELLS * TEXEL);
  }
  ctx.restore();
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
      standing.push({
        y: building.position.y + BUILDING_FOOT,
        draw: () => {
          // Placed but not raised: the building is a faint promise on its site until the trees
          // round it are down (`clearing.ts`).
          ctx.save();
          if (building.clearing) ctx.globalAlpha = 0.35;
          drawStructure(ctx, building.design, building.position.x, building.position.y, radiusOf(building), {
            time: view.time,
            working: building.state === BuildingState.Working,
            ...(worker ? { worker: buildOf(worker) } : {}),
          });
          ctx.restore();
        },
      });
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
      const position = view.carrierPositions.get(carrier.id) ?? carrier.position;
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
      drawBuildingHud(ctx, building, view.zoom, view.hoveredBuildingId === building.id);
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
