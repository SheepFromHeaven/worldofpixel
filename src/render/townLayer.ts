import { firstStation, groundWork, occupants, stageOf, stations } from '../sim/area.ts';
import { recipeById } from '../sim/book.ts';
import type { Proposal } from '../sim/claims.ts';
import { claims, ownerOf, townIdFor } from '../sim/claims.ts';
import type { Bounds, Vec2 } from '../sim/geometry.ts';
import { landWorkById } from '../sim/landWorks.ts';
import { GLOW } from '../sim/models/heat.ts';
import { asleepIndoors } from '../sim/needs.ts';
import { heatOf, scanQueue } from '../sim/process.ts';
import type { Recipe } from '../sim/recipe.ts';
import { CHARGE_LOW, ChargedRecipe } from '../sim/recipe.ts';
import type { Station } from '../sim/station.ts';
import { CharStation, FireStation } from '../sim/station.ts';
import { PARCEL, parcelOf } from '../sim/terrain/parcels.ts';
import type { Building, Carrier, CarrierId, CellId, Design, Settlement } from '../sim/types.ts';
import { CarrierState } from '../sim/types.ts';

import { TILT } from '../pixel/view.ts';
import type { GameWorld } from '../sim/world.ts';
import { CARRIER_SCALE, buildOf, drawCarrier, poseOf } from './carrier.ts';
import { drawDecal } from './decals.ts';
import { dugAt, felledAt, groundSprites, placementsIn, siteTrees } from './groundSprites.ts';
import { drawIcon } from './hudPlates.ts';
import { GLOW_LIGHT, SELECTION, SELECTION_SHADE, SMOKE_TINTS } from './palette.ts';
import type { Tint } from './sprites.ts';
import { drawTile, tileFits, tilePieces } from './sprites.ts';
import type { GlowLight } from './structures.ts';
import { designRadius, drawGlow, drawStructure, structureTile } from './structures.ts';
import { TEXEL } from './terrainPixels.ts';

export interface TownView {
  time: number;
  bounds: Bounds;
  zoom: number;
  carrierPositions: Map<CarrierId, Vec2>;
  tool: string;
  hoveredParcelId: CellId | null;
  hoveredBuildingId: string | null;
  hoverAction: string;
  ghost: Design | null;
  selectedBuildingId: string | null;
}

const RING_DASHES = 28;
const RING_PIXEL = 3;

function drawSelectionRing(ctx: CanvasRenderingContext2D, world: GameWorld, view: TownView): void {
  if (!view.selectedBuildingId) return;
  for (const settlement of world.settlements.values()) {
    const area = settlement.buildings.get(view.selectedBuildingId);
    if (!area) continue;
    const { a, d, e, f } = ctx.getTransform();
    const cx = a * area.position.x + e;
    const cy = d * area.position.y + f;
    const rx = PARCEL * 0.72 * a;
    const ry = rx * TILT;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    for (const [shade, drop] of [[SELECTION_SHADE, 1], [SELECTION, 0]] as const) {
      ctx.fillStyle = shade;
      for (let k = 0; k < RING_DASHES; k += 1) {
        if (k % 3 === 2) continue;
        const theta = (k / RING_DASHES) * Math.PI * 2;
        ctx.fillRect(
          Math.round(cx + Math.cos(theta) * rx - RING_PIXEL / 2),
          Math.round(cy + Math.sin(theta) * ry - RING_PIXEL / 2) + drop,
          RING_PIXEL,
          RING_PIXEL,
        );
      }
    }
    ctx.restore();
    return;
  }
}

function drawToolOverlay(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  view: TownView,
): void {
  if (!view.hoveredParcelId || view.tool === 'inspect') return;
  const parcel = parcelOf(world.seed, view.hoveredParcelId);
  if (parcel.vertices.length < 3) return;

  const centre = parcel.site;

  if (view.ghost) {
    const allowed = view.hoverAction === 'build' || view.hoverAction === 'found';
    const radius = designRadius(view.ghost);
    ctx.save();
    ctx.globalAlpha = allowed ? 0.45 : 0.18;
    drawStructure(ctx, view.ghost, centre.x, centre.y, radius, { time: view.time });
    ctx.restore();
    return;
  }

}

const RAZE_PIXELS = 32;

function drawRazeOverlay(ctx: CanvasRenderingContext2D, building: Building, zoom: number): void {
  drawIcon(ctx, 'strike', building.position.x, building.position.y, RAZE_PIXELS / zoom);
}

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

const BUILDING_FOOT = PARCEL * 0.3;

const STANDING_STEP = TEXEL * 2;

function shownDesign(area: Building): Design {
  const all = occupants(area);
  return (
    all.find((design) => structureTile(design) !== 'works' && !landWorkById(design.id)) ??
    groundWork(area)?.design ??
    all[0] ??
    BARE
  );
}

const BARE: Design = { id: 'clearing', label: 'Clearing', capacity: 8 };

function shownStation(area: Building): Station | null {
  const shown = shownDesign(area);
  return (
    area.slots.find((slot) => slot.design?.id === shown.id && slot.station)?.station ??
    firstStation(area)?.station ??
    null
  );
}

const frontOf = (building: Building): number =>
  tilePieces(structureTile(shownDesign(building))).reduce((front, piece) => Math.max(front, piece.depth), 0);

export function standingSpot(carrier: Carrier, settlement: Settlement): Vec2 {
  if (carrier.trail.length > 0) return carrier.position;
  const at = settlement.buildings.get(carrier.atId);
  const inside = at && at.position.x === carrier.position.x && at.position.y === carrier.position.y;
  return inside ? { x: carrier.position.x, y: at.position.y + frontOf(at) + STANDING_STEP } : carrier.position;
}

const stoneLift = (): number => tilePieces('border-stone')[0]?.depth ?? 0;

const stoneAt = (ctx: CanvasRenderingContext2D, at: Vec2) => ({
  y: at.y,
  draw: () => drawTile(ctx, 'border-stone', at.x, at.y - stoneLift()),
});

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

const chargeOf = (recipe: Recipe | undefined): number =>
  recipe instanceof ChargedRecipe ? recipe.charge : CHARGE_LOW;

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

const miniOf = (id: string | undefined): string => (id === undefined ? 'mini-slot' : id === 'hearth' ? 'hearth' : `mini-${id}`);

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
    const fire =
      slot.station instanceof FireStation && slot.station.running
        ? chargeOf(recipeById(settlement.book, slot.station.running.recipeId))
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

function stuck(settlement: Settlement, area: Building): boolean {
  const all = stations(area);
  if (all.length === 0 || area.clearing) return false;
  for (const { slot, station } of all) {
    if (station.running || station.changeover > 0) return false;
    const scan = scanQueue(station, settlement.book, area, slot);
    if (scan.recipe || scan.refused.some((refusal) => refusal.kind === 'full')) return false;
  }
  return true;
}

function pushRoofed(
  ctx: CanvasRenderingContext2D,
  settlement: Settlement,
  area: Building,
  view: TownView,
  standing: { y: number; draw: () => void }[],
): void {
  const tile = stageOf(area).chimney ? 'works-stone' : 'works-roofed';
  const all = stations(area);
  const busy = all.some(({ station }) => station.running !== null);
  const smoking = all.some(({ station }) => station.running !== null && station.offers.length > 0);
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
  const station = shownStation(building);

  if (!station || station.offers.length === 0) return {};

  const banking =
    station instanceof FireStation
      ? {
          fire: chargeOf(
            station.running ? recipeById(settlement.book, station.running.recipeId) : undefined,
          ),
        }
      : {};

  if (!station.running) return banking;

  if (station instanceof CharStation) {
    const recipe = recipeById(settlement.book, station.running.recipeId);
    return { smoke: SMOKE_TINTS[recipe ? station.pile(recipe).smoke : 'white'] };
  }

  const { glow } = heatOf(station, settlement.book);
  const step = GLOW.findIndex((entry) => entry.name === glow.name);
  const color = GLOW_LIGHT[glow.name];
  return {
    ...banking,
    smoke: SMOKE_TINTS.white,
    ...(color && step > 0 ? { glow: { color, level: step / (GLOW.length - 1) } } : {}),
  };
}

export function drawTowns(ctx: CanvasRenderingContext2D, world: GameWorld, view: TownView): void {
  const standing: { y: number; draw: () => void }[] = [];

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
    const inside = new Map<string, string>();
    for (const carrier of settlement.carriers.values()) {
      if (carrier.state === CarrierState.Working && carrier.job?.kind === 'work') inside.set(carrier.atId, carrier.id);
    }

    for (const building of settlement.buildings.values()) {
      if (stageOf(building).roofed) {
        pushRoofed(ctx, settlement, building, view, standing);
        continue;
      }
      const only = occupants(building)[0];
      if (building.stage > 0 || occupants(building).length !== 1 || (only && structureTile(only) === 'works')) {
        pushYard(ctx, settlement, building, view, standing);
        continue;
      }
      const worker = inside.get(building.id);
      const shown = shownDesign(building);
      const tile = structureTile(shown);
      const look = rigLook(settlement, building);
      const pieces: { clip?: string; depth: number }[] = !tileFits(tile, view.zoom)
        ? [{ depth: BUILDING_FOOT }]
        : worker
          ? [{ depth: frontOf(building) }]
          : [...tilePieces(tile)];
      for (const piece of pieces) {
        standing.push({
          y: building.position.y + piece.depth,
          draw: () => {
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

  drawSelectionRing(ctx, world, view);
  drawToolOverlay(ctx, world, view);

  if (view.hoverAction === 'raze' && view.hoveredBuildingId) {
    for (const settlement of world.settlements.values()) {
      const target = settlement.buildings.get(view.hoveredBuildingId);
      if (target) drawRazeOverlay(ctx, target, view.zoom);
    }
  }
}
