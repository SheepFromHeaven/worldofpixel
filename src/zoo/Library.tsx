import { useEffect, useState } from 'react';
import { PixelText } from '../ui/pixel/Pixel.tsx';
import { PixelTile } from '../ui/pixel/Tile.tsx';
import type { ZooEntry } from './catalogue.ts';
import { GROUPS, ZOO } from './catalogue.ts';
import { modelled } from './Model3D.tsx';
import { ITEM_ART } from '../render/lit/folkInstances.ts';
import { ITEM_NAMES, ItemType } from '../sim/people/items.ts';
import type { StructureKind } from './structures.ts';
import { STRUCTURES } from './structures.ts';
import type { Piece } from './pieces.ts';
import { PIECES, SECTIONS, spriteNames, STAGES } from './pieces.ts';

export type Tab = 'animals' | 'plants' | 'decals' | 'items' | 'buildings';

const TABS: readonly Tab[] = ['animals', 'plants', 'decals', 'items', 'buildings'];

const PLACEABLE_ITEMS: readonly ItemType[] = [ItemType.Flint, ItemType.Stone, ItemType.DryKindling, ItemType.Branch, ItemType.HandAxe, ItemType.Torch, ItemType.BurningBranch];

const THUMB = 32;

interface SpriteBox {
  x: number;
  y: number;
  size: number;
}

interface Sheet {
  width: number;
  height: number;
  sprites: ReadonlyMap<string, SpriteBox>;
}

let sheet: Promise<Sheet | null> | null = null;

const loadSheet = (): Promise<Sheet | null> => {
  sheet ??= fetch('/props/props.json')
    .then((reply) => reply.json() as Promise<{ sheet: { width: number; height: number }; props: (SpriteBox & { name: string })[] }>)
    .then((manifest) => ({ width: manifest.sheet.width, height: manifest.sheet.height, sprites: new Map(manifest.props.map((one) => [one.name, one])) }))
    .catch(() => null);
  return sheet;
};

function Thumb({ name, sprites }: { name: string; sprites: Sheet | null }): React.JSX.Element {
  const box = sprites?.sprites.get(name);
  if (!sprites || !box) return <i className="zoo-thumb" />;
  const scale = THUMB / box.size;
  return (
    <i
      className="zoo-thumb"
      style={{
        backgroundImage: 'url(/props/albedo.png)',
        backgroundSize: `${sprites.width * scale}px ${sprites.height * scale}px`,
        backgroundPosition: `${-box.x * scale}px ${-box.y * scale}px`,
      }}
    />
  );
}

interface LibraryProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
  animal: ZooEntry | null;
  piece: Piece | null;
  item: ItemType | null;
  structure: StructureKind | null;
  stage: string;
  setStage: (stage: string) => void;
  onAnimal: (entry: ZooEntry | null) => void;
  onPiece: (piece: Piece | null) => void;
  onItem: (item: ItemType | null) => void;
  onStructure: (kind: StructureKind | null) => void;
}

export function Library({ tab, setTab, animal, piece, item, structure, stage, setStage, onAnimal, onPiece, onItem, onStructure }: LibraryProps): React.JSX.Element {
  const [filter, setFilter] = useState('');
  const [sprites, setSprites] = useState<Sheet | null>(null);

  useEffect(() => {
    void loadSheet().then(setSprites);
  }, []);

  const wanted = filter.trim().toLowerCase();
  const matches = (name: string): boolean => wanted === '' || name.toLowerCase().includes(wanted);

  const animalRow = (entry: ZooEntry): React.JSX.Element => (
    <button key={entry.life} type="button" className={entry === animal ? 'zoo-row zoo-picked' : 'zoo-row'} onClick={() => onAnimal(entry === animal ? null : entry)}>
      <PixelText>{entry.name}</PixelText>
    </button>
  );

  const shown = ZOO.filter((entry) => matches(entry.name));
  const done = shown.filter((entry) => modelled(entry.key, entry.group) !== null);
  const rest = shown.filter((entry) => modelled(entry.key, entry.group) === null);

  const heading = (text: string): React.JSX.Element => (
    <div key={text} className="zoo-heading">
      <PixelText>{text}</PixelText>
    </div>
  );

  const pieceRow = (one: Piece): React.JSX.Element => (
    <button key={one.key} type="button" className={one === piece ? 'zoo-row zoo-picked' : 'zoo-row'} onClick={() => onPiece(one === piece ? null : one)}>
      <Thumb name={spriteNames(one, 0, stage)[0]!} sprites={sprites} />
      <PixelText>{one.title}</PixelText>
    </button>
  );

  return (
    <aside className="se-board zoo-library">
      <div className="zoo-tabs">
        {TABS.map((name) => (
          <PixelTile key={name} label={name} held={name === tab} onClick={() => setTab(name)} />
        ))}
      </div>
      <input className="zoo-search" placeholder="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
      <div className="zoo-list">
        {tab === 'animals' && (
          <>
            {done.length > 0 && heading('migrated')}
            {done.map(animalRow)}
            {GROUPS.map(({ group, title }) => {
              const entries = rest.filter((entry) => entry.group === group);
              if (entries.length === 0) return null;
              return (
                <section key={group}>
                  {heading(`not yet: ${title}`)}
                  {entries.map(animalRow)}
                </section>
              );
            })}
          </>
        )}
        {tab === 'items' && (
          <section>
            {heading('items')}
            {PLACEABLE_ITEMS.filter((kind) => matches(ITEM_NAMES[kind]!)).map((kind) => (
              <button key={kind} type="button" className={kind === item ? 'zoo-row zoo-picked' : 'zoo-row'} onClick={() => onItem(kind === item ? null : kind)}>
                <Thumb name={`item.${ITEM_ART[kind]}.s0`} sprites={sprites} />
                <PixelText>{ITEM_NAMES[kind]!}</PixelText>
              </button>
            ))}
          </section>
        )}
        {tab === 'buildings' && (
          <section>
            {heading('structures')}
            {STRUCTURES.filter((one) => matches(one.title)).map((one) => (
              <button key={one.kind} type="button" className={one.kind === structure ? 'zoo-row zoo-picked' : 'zoo-row'} onClick={() => onStructure(one.kind === structure ? null : one.kind)}>
                <Thumb name={one.sprite} sprites={sprites} />
                <PixelText>{one.title}</PixelText>
              </button>
            ))}
          </section>
        )}
        {(tab === 'plants' || tab === 'decals') &&
          SECTIONS.filter((section) => section.tab === tab).map(({ section, title }) => {
            const pieces = PIECES.filter((one) => one.section === section && matches(one.title));
            if (pieces.length === 0) return null;
            return (
              <section key={section}>
                {heading(title)}
                {pieces.map(pieceRow)}
              </section>
            );
          })}
      </div>
      {piece?.staged && (
        <div className="zoo-stages">
          <PixelText>growth</PixelText>
          <div className="zoo-stage-row">
            {STAGES.map((one) => (
              <PixelTile key={one} label={one} held={one === stage} onClick={() => setStage(one)} />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
