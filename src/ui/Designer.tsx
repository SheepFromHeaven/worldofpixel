import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { validateDesign } from '../sim/blocks.ts';
import { emptyDesign } from '../sim/designs.ts';
import { RECIPES } from '../sim/recipes.ts';
import { BlockKind, DIRECTIONS, Direction, ItemType } from '../sim/types.ts';
import type { Block, Design, ItemType as Item, RecipeId } from '../sim/types.ts';
import { drawDesigner, hitDesigner, layoutDesigner } from '../render/designerLayer.ts';
import type { DesignerSelection, PlaceableKind } from '../render/designerLayer.ts';
import { game } from './game.ts';
import { PixelText } from './pixel/Pixel.tsx';
import { PixelTile } from './pixel/Tile.tsx';

function makeBlock(
  kind: PlaceableKind,
  x: number,
  y: number,
  facing: Direction,
  item: Item,
  recipeId: RecipeId,
): Block {
  switch (kind) {
    case BlockKind.Source:
      return { kind: BlockKind.Source, x, y, facing, item };
    case BlockKind.Input:
      return { kind: BlockKind.Input, x, y, facing, item };
    case BlockKind.Output:
      return { kind: BlockKind.Output, x, y, facing, item };
    case BlockKind.Combine:
      return { kind: BlockKind.Combine, x, y, facing, recipeId };
    case BlockKind.Storage:
      return { kind: BlockKind.Storage, x, y, facing };
    default:
      return { kind: BlockKind.Transport, x, y, facing };
  }
}

const turn = (facing: Direction): Direction =>
  DIRECTIONS[(DIRECTIONS.indexOf(facing) + 1) % DIRECTIONS.length] ?? Direction.East;

function startingDraft(designId: string | null): Design {
  const existing = designId ? game.designById(designId) : undefined;
  if (existing) return { ...existing, blocks: existing.blocks.map((block) => ({ ...block })) };
  return emptyDesign('', '');
}

/**
 * Where a building comes from. The sheet is drawn on canvas with the same pencil as the map,
 * because the grid being drawn here *is* the building: a panel of boxed symbols would say the
 * inside of a machine came from somewhere other than the player's hand.
 */
export function Designer(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const editing = hud.editingDesignId;

  const [draft, setDraft] = useState<Design>(() => startingDraft(editing));
  const [opened, setOpened] = useState<string | null>(editing);
  const [selection, setSelection] = useState<DesignerSelection>({
    kind: BlockKind.Input,
    facing: Direction.East,
    item: ItemType.Water,
    recipeId: RECIPES[0]?.id ?? 'mud',
  });
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The draw loop reads the latest state without being torn down and rebuilt on every keystroke.
  const frameRef = useRef({ draft, selection, hovered });
  frameRef.current = { draft, selection, hovered };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let handle = 0;
    const render = (now: number): void => {
      handle = requestAnimationFrame(render);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      if (viewport.width === 0 || viewport.height === 0) return;
      if (canvas.width !== Math.round(viewport.width * ratio)) {
        canvas.width = Math.round(viewport.width * ratio);
        canvas.height = Math.round(viewport.height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const current = frameRef.current;
      const layout = layoutDesigner(viewport, current.draft, current.selection);
      drawDesigner(ctx, viewport, current.draft, current.selection, layout, current.hovered, now / 1000);
    };

    handle = requestAnimationFrame(render);
    return () => cancelAnimationFrame(handle);
  }, [hud.designerOpen]);

  if (!hud.designerOpen) return null;

  // The panel is kept mounted across openings, so a second visit has to reload its draft.
  if (opened !== editing) {
    setOpened(editing);
    setDraft(startingDraft(editing));
  }

  const check = validateDesign(draft);

  const pick = (event: React.PointerEvent | React.MouseEvent): ReturnType<typeof hitDesigner> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    const layout = layoutDesigner(viewport, draft, selection);
    return hitDesigner(layout, draft, event.clientX - rect.left, event.clientY - rect.top);
  };

  const put = (x: number, y: number, erase: boolean): void => {
    const index = draft.blocks.findIndex((block) => block.x === x && block.y === y);
    const blocks = draft.blocks.map((block) => ({ ...block }));
    const standing = blocks[index];

    if (erase) {
      if (index >= 0) blocks.splice(index, 1);
    } else if (standing && standing.kind === selection.kind) {
      // Clicking what is already there turns it, so laying a corner is one click and a nudge.
      standing.facing = turn(standing.facing);
    } else {
      const block = makeBlock(selection.kind, x, y, selection.facing, selection.item, selection.recipeId);
      if (index >= 0) blocks.splice(index, 1, block);
      else blocks.push(block);
    }

    setDraft({ ...draft, blocks });
  };

  const act = (event: React.PointerEvent | React.MouseEvent, erase: boolean): void => {
    const hit = pick(event);
    if (!hit) return;
    if (hit.target === 'cell') put(hit.x, hit.y, erase || event.shiftKey);
    else if (hit.target === 'kind') setSelection({ ...selection, kind: hit.kind });
    else if (hit.target === 'facing') setSelection({ ...selection, facing: hit.facing });
    else if (hit.target === 'item') setSelection({ ...selection, item: hit.item });
    else if (hit.target === 'recipe') setSelection({ ...selection, recipeId: hit.recipeId });
  };

  return (
    <div className="se-designer">
      <header>
        <input
          className="se-name-field"
          value={draft.label}
          onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          placeholder="name this machine"
        />
        <span className="se-check">
          <PixelText>{check.reason}</PixelText>
        </span>
      </header>

      <canvas
        ref={canvasRef}
        className="se-designer-canvas"
        onPointerDown={(event) => {
          if (event.button === 0) act(event, false);
        }}
        onPointerMove={(event) => {
          const hit = pick(event);
          setHovered(hit?.target === 'cell' ? { x: hit.x, y: hit.y } : null);
        }}
        onPointerLeave={() => setHovered(null)}
        onContextMenu={(event) => {
          event.preventDefault();
          act(event, true);
        }}
      />

      <footer>
        <span className="se-hint">
          <PixelText>
            {'Click to place, click again to turn, right-click to clear. An input block fills ' +
              'itself where the ground gives its item, and takes carried loads anywhere else.'}
          </PixelText>
        </span>
        <div className="se-designer-actions">
          {editing ? (
            <PixelTile
              icon="raze"
              label="Throw away"
              onClick={() => {
                game.discardDesign(editing);
                game.closeDesigner();
              }}
            />
          ) : null}
          <PixelTile label="Cancel" onClick={() => game.closeDesigner()} />
          <PixelTile
            icon="design"
            label="Save to library"
            title={check.ok ? 'Keep this machine on the shelf' : check.reason}
            disabled={!check.ok}
            onClick={() => game.saveDraft(draft)}
          />
        </div>
      </footer>
    </div>
  );
}
