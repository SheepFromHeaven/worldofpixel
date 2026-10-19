import { designRadius, recipeOf } from '../sim/blocks.ts';
import { blocksOf, radiusOf, visibleBuffers } from '../sim/buildings.ts';
import { lerp, polygonCentroid } from '../sim/geometry.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { parcelOf } from '../sim/parcels.ts';
import { hashString, rng } from '../sim/rng.ts';
import { BuildingState } from '../sim/types.ts';
import type { Building, CarrierId, CellId, Design, ItemType as Item, Settlement } from '../sim/types.ts';

export interface GhostInput {
  item: Item;
  /** `ground` is a source block — it only works over its own deposit; `carried` is a door. */
  from: 'ground' | 'carried';
  ok: boolean;
}
import type { GameWorld } from '../sim/world.ts';
import { drawCarrier, poseOf } from './carrier.ts';
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

/** The stick figure is drawn about 17 units tall; this brings it down beside a building. */
const CARRIER_SCALE = 0.1;

export interface TownView {
  time: number;
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

  if (view.hoverAction === 'pave') {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = DIRT;
    fillPolygon(ctx, parcel.vertices);
    ctx.restore();
  }

  if (view.hoverAction === 'link') {
    sketchText(ctx, 'run dirt here', centre.x, centre.y - 3, { size: 12 / view.zoom, color: RED_PENCIL });
  }

  if (view.hoverAction === 'lift') {
    sketchText(ctx, 'lift', centre.x, centre.y, { size: 12 / view.zoom, color: RED_PENCIL });
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

export function drawTowns(ctx: CanvasRenderingContext2D, world: GameWorld, view: TownView): void {
  for (const settlement of world.settlements.values()) {
  }

  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      drawStructure(ctx, building.design, building.position.x, building.position.y, radiusOf(building), {
        time: view.time,
        working: building.state === BuildingState.Working,
      });
      drawBuildingHud(ctx, building, view.zoom, view.hoveredBuildingId === building.id);
    }

    for (const carrier of settlement.carriers.values()) {
      const position = view.carrierPositions.get(carrier.id) ?? carrier.position;
      // A pencil line on the figure, whatever the zoom: the drawing is in its own units, so the
      // width has to be divided back through both the figure's scale and the camera's.
      drawCarrier(
        ctx,
        poseOf(carrier, position, view.time),
        CARRIER_SCALE,
        1.4 / (view.zoom * CARRIER_SCALE),
      );
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
