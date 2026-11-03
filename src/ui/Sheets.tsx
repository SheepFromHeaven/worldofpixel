import { useEffect, useState } from 'react';
import type { SheetSection, StructureNeed } from '../modules/client.ts';
import { NOBODY } from '../modules/people/api.ts';
import { NOWHERE } from '../sim/grid.ts';
import type { HudSnapshot } from './game.ts';
import { game } from './game.ts';
import { Field, Fields, Meter, Panel, Section, Well, Wells } from './pixel/Panel.tsx';
import type { Tone } from './pixel/Panel.tsx';
import { PixelIcon, PixelText } from './pixel/Pixel.tsx';
import type { IconName } from './pixel/Pixel.tsx';

interface SpriteBox {
  x: number;
  y: number;
  size: number;
}

interface PropSheet {
  width: number;
  height: number;
  sprites: ReadonlyMap<string, SpriteBox>;
}

const THUMB_PIXELS = 32;

const THUMB_ZOOM = 2;

let propSheet: Promise<PropSheet | null> | null = null;

const loadPropSheet = (): Promise<PropSheet | null> => {
  propSheet ??= fetch('/props/props.json')
    .then((reply) => reply.json() as Promise<{ sheet: { width: number; height: number }; props: (SpriteBox & { name: string })[] }>)
    .then((manifest) => ({ width: manifest.sheet.width, height: manifest.sheet.height, sprites: new Map(manifest.props.map((one) => [one.name, one])) }))
    .catch(() => null);
  return propSheet;
};

function ItemThumb({ art, size = THUMB_PIXELS }: { art: string; size?: number }): React.JSX.Element {
  const [sheet, setSheet] = useState<PropSheet | null>(null);
  useEffect(() => {
    void loadPropSheet().then(setSheet);
  }, []);
  const box = sheet?.sprites.get(`item.${art}.s0`);
  if (!sheet || !box) return <i className="se-thumb" style={{ width: size, height: size }} />;
  const scale = (size * THUMB_ZOOM) / box.size;
  const inset = (size * (THUMB_ZOOM - 1)) / 2;
  return (
    <i
      className="se-thumb"
      style={{
        width: size,
        height: size,
        backgroundImage: 'url(/props/albedo.png)',
        backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
        backgroundPosition: `${-box.x * scale - inset}px ${-box.y * scale - inset}px`,
      }}
    />
  );
}

const SLOTS = ['head', 'arms', 'body', 'hands', 'legs', 'feet'] as const;

function Need({ icon, word, tone, label }: { icon: IconName; word: string; tone: Tone; label: string }): React.JSX.Element {
  return (
    <div className={tone === 'plain' ? 'se-need' : `se-need se-tone-${tone}`} title={label}>
      <PixelIcon name={icon} />
      <PixelText>{word}</PixelText>
    </div>
  );
}

export function PersonSheet({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const person = hud.person;
  if (!person) return null;
  const freezing = person.conditions.includes('freezing');
  const cold = freezing || person.conditions.includes('cold');
  const toneOf = (bad: boolean): Tone => (bad ? 'warn' : 'plain');

  return (
    <Panel kicker="person" title={person.name} onClose={() => game.selectPerson(NOBODY)}>
      <Section label="body">
        <div className="se-body">
          <div className="se-doll">
            {SLOTS.map((slot) => {
              const held = slot === 'hands' ? person.heldArt : null;
              return (
                <div key={slot} className={`se-doll-${slot}`}>
                  <Well title={held ? `${slot}: ${person.holding}` : `${slot}: nothing`} off={held === null}>
                    {held ? <ItemThumb art={held} /> : <PixelIcon name={`slot-${slot}`} />}
                  </Well>
                </div>
              );
            })}
          </div>
          <div className="se-needs">
            <Need icon="hearth" label="warmth" word={freezing ? 'freezing' : cold ? 'cold' : 'warm'} tone={cold ? 'cold' : 'plain'} />
            <Need icon="berries" label="food" word={person.hungerWord} tone={toneOf(person.hungerBad)} />
            <Need icon="water" label="water" word={person.thirstWord} tone={toneOf(person.thirstBad)} />
            <Need icon="night" label="rest" word={person.tirednessWord} tone={toneOf(person.tirednessBad)} />
          </div>
        </div>
      </Section>
      {person.thoughts.length > 0 ? (
        <Section label="thinks">
          <div className="se-lines">
            {person.thoughts.map((thought) => (
              <PixelText key={thought.text} {...(thought.critical ? { className: 'se-tone-warn' } : {})}>
                {thought.text}
              </PixelText>
            ))}
          </div>
        </Section>
      ) : null}
    </Panel>
  );
}

function ItemWells({ items, empty }: { items: readonly StructureNeed[]; empty: string }): React.JSX.Element {
  return (
    <Wells {...(items.length === 0 ? { empty } : {})}>
      {items.map((item) => (
        <Well key={item.icon} title={item.count > 1 ? `${item.count} ${item.name}` : item.name} count={item.count}>
          <ItemThumb art={item.icon} />
        </Well>
      ))}
    </Wells>
  );
}

const DENSE_FROM = 16;

const DENSE_COLUMNS = 8;

const DENSE_THUMB_PIXELS = 26;

function SlotWells({ items, capacity }: { items: readonly StructureNeed[]; capacity: number }): React.JSX.Element {
  const filled = items.flatMap((item) => Array.from({ length: item.count }, () => item));
  const dense = capacity > DENSE_FROM;
  return (
    <Wells dense={dense}>
      {Array.from({ length: capacity }, (_, slot) => {
        const item = filled[slot];
        return (
          <Well key={slot} title={item ? item.name : 'empty'}>
            {item ? <ItemThumb art={item.icon} {...(dense ? { size: DENSE_THUMB_PIXELS } : {})} /> : null}
          </Well>
        );
      })}
    </Wells>
  );
}

function ButtonSection({ section }: { section: SheetSection }): React.JSX.Element {
  const dense = (section.slots ?? 0) >= DENSE_COLUMNS;
  return (
    <Section label={section.title} hint={section.hint}>
      <Wells dense={dense} {...(section.buttons.length === 0 && section.empty && !section.slots ? { empty: section.empty } : {})}>
        {section.buttons.map((button) => (
          <Well
            key={button.key}
            title={button.note ? `${button.name}: ${button.note}` : button.name}
            off={!button.on}
            onClick={button.command === null ? null : () => button.command && game.send(button.command)}
          >
            <ItemThumb art={button.icon} {...(dense ? { size: DENSE_THUMB_PIXELS } : {})} />
          </Well>
        ))}
        {Array.from({ length: Math.max(0, (section.slots ?? 0) - section.buttons.length) }, (_, slot) => (
          <Well key={`empty-${slot}`} title="empty">
            {null}
          </Well>
        ))}
      </Wells>
    </Section>
  );
}

export function StructureSheet({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const structure = hud.structure;
  if (!structure) return null;
  const site = structure.title.endsWith('site') || structure.missing !== undefined;

  return (
    <Panel kicker={site ? 'plan' : 'building'} title={structure.title} onClose={() => game.clearStructureSelection()}>
      {structure.share !== null || structure.rows.length > 0 ? (
        <Section label="state">
          <Fields>
            {structure.share === null ? null : (
              <Field word={site ? 'built' : 'filled'} value={structure.gauge}>
                <Meter share={structure.share} />
              </Field>
            )}
            {structure.rows.map(([word, value]) => (
              <Field key={word} word={word} value={value} />
            ))}
          </Fields>
        </Section>
      ) : null}
      {structure.stored ? (
        <Section label={structure.title === 'knapping floor' ? 'lying here' : 'holds'}>
          {structure.capacity ? <SlotWells items={structure.stored} capacity={structure.capacity} /> : <ItemWells items={structure.stored} empty="nothing" />}
        </Section>
      ) : null}
      {structure.missing && structure.missing.length > 0 ? (
        <Section label="still needs">
          <ItemWells items={structure.missing} empty="nothing" />
        </Section>
      ) : null}
      {(structure.sections ?? []).map((section) => (
        <ButtonSection key={section.id} section={section} />
      ))}
    </Panel>
  );
}

const GROUND_WORDS: ReadonlySet<string> = new Set(['height', 'on the ground']);

export function TileSheet({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const tile = hud.opened;
  if (!tile) return null;
  const ground = tile.readout.filter(([word]) => GROUND_WORDS.has(word));
  const air = tile.readout.filter(([word]) => !GROUND_WORDS.has(word));

  return (
    <Panel kicker={`tile ${tile.column}, ${tile.row}`} title={tile.biome} onClose={() => game.openTile(NOWHERE)}>
      <Section label="ground">
        <Fields>
          <Field word="cover" value={tile.standing} />
          <Field word="trodden" value={String(tile.wear)} />
          <Field word="walking" value={tile.refusal ?? 'open'} />
          {ground.map(([word, value]) => (
            <Field key={word} word={word} value={value} />
          ))}
        </Fields>
      </Section>
      {air.length > 0 ? (
        <Section label="air">
          <Fields>
            {air.map(([word, value]) => (
              <Field key={word} word={word} value={value} />
            ))}
          </Fields>
        </Section>
      ) : null}
    </Panel>
  );
}
