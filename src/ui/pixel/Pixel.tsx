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

export function PixelText({
  children,
  scale = TEXT_SCALE,
  className,
}: {
  children: string;
  scale?: number;
  className?: string;
}): React.JSX.Element {
  const words = foldToFont(children).split(' ');

  return (
    <span
      className={className ? `se-px-text ${className}` : 'se-px-text'}
      style={{ lineHeight: `${BOX.h * scale}px`, '--se-px': `${scale}px` } as React.CSSProperties}
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

export function PixelBody({ children, className }: { children: string; className?: string }): React.JSX.Element {
  return className ? (
    <PixelText scale={HEAD_SCALE} className={className}>
      {children}
    </PixelText>
  ) : (
    <PixelText scale={HEAD_SCALE}>{children}</PixelText>
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
