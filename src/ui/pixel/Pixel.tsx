import {
  BOX,
  FIRST_CODE,
  FONT_COLS,
  GLYPH,
  HEAD_SCALE,
  ICON_CELLS,
  ICON_COLS,
  ICON_NAMES,
  ICON_SCALE,
  LAST_CODE,
  TEXT_SCALE,
  foldToFont,
  itemIcon,
} from '../../pixel/ui/metrics.ts';
import type { IconName } from '../../pixel/ui/metrics.ts';

export type { IconName };
export { itemIcon };

/**
 * The HUD's letters and pictures, read out of the sheets `npm run ui` bakes.
 *
 * A label is one element per glyph, which sounds extravagant and is not: a bar of them is a few
 * hundred elements that never change, and the alternative — a canvas per label — gives up
 * wrapping, selection and layout for nothing.
 *
 * **A glyph is a mask, an icon is an image.** The letters take their colour from whatever is
 * above them, so a pressed tool's label is the same red as its plate and the HUD needs one font
 * sheet rather than one per colour. An icon is already coloured: a fire is the colour of fire.
 */
function Glyph({ code, scale }: { code: number; scale: number }): React.JSX.Element {
  const slot = (code < FIRST_CODE || code > LAST_CODE ? '?'.charCodeAt(0) : code) - FIRST_CODE;
  const col = slot % FONT_COLS;
  const row = Math.floor(slot / FONT_COLS);

  return (
    <i
      className="se-px-glyph"
      aria-hidden="true"
      style={{
        width: GLYPH.w * scale,
        height: BOX.h * scale,
        marginRight: scale,
        maskImage: `var(--se-font-${scale})`,
        WebkitMaskImage: `var(--se-font-${scale})`,
        maskPosition: `${-col * BOX.w * scale}px ${-row * BOX.h * scale}px`,
        WebkitMaskPosition: `${-col * BOX.w * scale}px ${-row * BOX.h * scale}px`,
      }}
    />
  );
}

/**
 * Words are kept whole so a line still breaks between them: the glyphs of one word are a single
 * inline-block, and the gap between two of them is a box of air rather than a space character
 * the browser might collapse or wrap inside.
 */
export function PixelText({
  children,
  scale = TEXT_SCALE,
  className,
}: {
  children: string;
  scale?: number;
  className?: string;
}): React.JSX.Element {
  // Folded here rather than at every caller: the HUD writes what it means and the font
  // substitutes what it has. See `foldToFont`.
  const words = foldToFont(children).split(' ');

  return (
    <span
      className={className ? `se-px-text ${className}` : 'se-px-text'}
      style={{ lineHeight: `${BOX.h * scale}px` }}
      // The text is drawn as masks, so nothing here is readable to anything but an eye.
      role="img"
      aria-label={children}
    >
      {words.map((word, index) => (
        <span key={`${index}-${word}`} className="se-px-word">
          {index > 0 ? <i className="se-px-space" style={{ width: BOX.w * scale }} aria-hidden="true" /> : null}
          {[...word].map((character, at) => (
            <Glyph key={at} code={character.codePointAt(0) ?? 32} scale={scale} />
          ))}
        </span>
      ))}
    </span>
  );
}

export function PixelHeading({ children }: { children: string }): React.JSX.Element {
  return <PixelText scale={HEAD_SCALE}>{children}</PixelText>;
}

const SIZE = ICON_CELLS * ICON_SCALE;

export function PixelIcon({ name }: { name: IconName }): React.JSX.Element {
  const slot = ICON_NAMES.indexOf(name);
  const col = slot % ICON_COLS;
  const row = Math.floor(slot / ICON_COLS);

  return (
    <i
      className="se-px-icon"
      aria-hidden="true"
      style={{
        width: SIZE,
        height: SIZE,
        backgroundPosition: `${-col * SIZE}px ${-row * SIZE}px`,
      }}
    />
  );
}
