import { PixelIcon, PixelText } from './Pixel.tsx';
import type { IconName } from './Pixel.tsx';

/**
 * A mahjong tile with something drawn on its face.
 *
 * Every button in the building flow is one of these, and that is the whole of the direction: a
 * tool is not a labelled rectangle, it is a piece you pick up and lay down. The bevel comes from
 * the baked plate (`pixel/ui/plates.ts`) through `border-image`, so a tile is the same four
 * cells of lit edge at any width and nothing here chooses a colour.
 *
 * Three states, and they are three plates rather than three filters: resting, under the cursor,
 * and pushed forward out of the hand. A tile that is merely tinted when it is held reads as the
 * same tile recoloured; one with its bevel turned over reads as having moved.
 */
export function PixelTile({
  icon,
  label,
  title,
  held = false,
  disabled = false,
  reason,
  wide = false,
  onClick,
}: {
  icon?: IconName;
  label?: string;
  title?: string;
  /** Pushed forward: this is what the next click will do. */
  held?: boolean;
  disabled?: boolean;
  /** Why it is greyed out, drawn small on the face under the label. */
  reason?: string;
  /** A fixed width, so a tile whose label changes under the cursor does not shift the row. */
  wide?: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  const classes = ['se-tile'];
  if (held) classes.push('se-on');
  if (wide) classes.push('se-tile-wide');
  if (reason) classes.push('se-tile-stacked');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? <PixelIcon name={icon} /> : null}
      {label === undefined ? null : (
        <span className="se-tile-face">
          <PixelText>{label}</PixelText>
          {reason ? (
            <span className="se-tile-reason">
              <PixelText>{reason}</PixelText>
            </span>
          ) : null}
        </span>
      )}
    </button>
  );
}

/**
 * The rule that divides one run of tiles from the next — land from workshops, say.
 *
 * A mark and a word rather than a heading: the board is small, and a row of its own eats the
 * space two more tiles would have taken.
 */
export function PixelSection({
  icon,
  label,
}: {
  icon: IconName;
  label: string;
}): React.JSX.Element {
  return (
    <span className="se-section">
      <PixelIcon name={icon} />
      <PixelText>{label}</PixelText>
    </span>
  );
}
