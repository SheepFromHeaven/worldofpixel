import { PixelIcon, PixelText } from './Pixel.tsx';
import type { IconName } from './Pixel.tsx';

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
  held?: boolean;
  disabled?: boolean;
  reason?: string;
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
