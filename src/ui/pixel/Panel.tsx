import type { ReactNode } from 'react';
import { PixelHeading, PixelIcon, PixelText } from './Pixel.tsx';

export type Tone = 'plain' | 'cold' | 'warn';

const toneClass = (tone: Tone): string => (tone === 'plain' ? '' : ` se-tone-${tone}`);

export function Panel({ kicker, title, onClose, children }: { kicker?: string; title: string; onClose: () => void; children: ReactNode }): React.JSX.Element {
  return (
    <section className="se-panel se-wood">
      <header className="se-panel-head">
        <div className="se-panel-titles">
          {kicker ? <PixelText className="se-label">{kicker}</PixelText> : null}
          <PixelHeading>{title}</PixelHeading>
        </div>
        <button type="button" className="se-panel-close" aria-label="close" title="close" onClick={onClose}>
          <PixelIcon name="close" />
        </button>
      </header>
      {children}
    </section>
  );
}

export function Section({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }): React.JSX.Element {
  return (
    <div className="se-panel-section" {...(hint ? { title: hint } : {})}>
      <PixelText className="se-section-title">{label}</PixelText>
      {children}
    </div>
  );
}

export function Fields({ children }: { children: ReactNode }): React.JSX.Element {
  return <dl className="se-fields">{children}</dl>;
}

export function Field({ word, value, tone = 'plain', children }: { word: string; value: string; tone?: Tone; children?: ReactNode }): React.JSX.Element {
  return (
    <>
      <dt>
        <PixelText className="se-label">{word}</PixelText>
      </dt>
      <dd className={`se-field-value${toneClass(tone)}`}>
        <PixelText>{value}</PixelText>
        {children}
      </dd>
    </>
  );
}

export function Meter({ share, tone = 'plain' }: { share: number; tone?: Tone }): React.JSX.Element {
  return (
    <div className={`se-meter${toneClass(tone)}`}>
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%` }} />
    </div>
  );
}

export function Wells({ children, empty, dense = false }: { children: ReactNode; empty?: string; dense?: boolean }): React.JSX.Element {
  return (
    <div className={dense ? 'se-wells is-dense' : 'se-wells'}>
      {children}
      {empty ? <PixelText className="se-label">{empty}</PixelText> : null}
    </div>
  );
}

export function Well({ title, count, off = false, onClick, children }: { title: string; count?: number; off?: boolean; onClick?: (() => void) | null; children: ReactNode }): React.JSX.Element {
  const body = (
    <>
      {children}
      {count !== undefined && count > 1 ? <PixelText className="se-well-count">{`${count}`}</PixelText> : null}
    </>
  );
  const className = `se-well${off ? ' is-off' : ''}`;
  if (onClick === undefined) {
    return (
      <div className={className} title={title}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={`${className} is-button`} title={title} disabled={onClick === null} onClick={() => onClick?.()}>
      {body}
    </button>
  );
}
