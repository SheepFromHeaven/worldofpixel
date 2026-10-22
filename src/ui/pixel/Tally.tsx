
export const TALLY_GROUP = 5;

const TOO_MANY = 8;

export function Tally({ count, title }: { count: number; title?: string }): React.JSX.Element {
  const whole = Math.max(0, Math.round(count));
  const groups = Math.floor(whole / TALLY_GROUP);
  const rest = whole % TALLY_GROUP;

  const shown = Math.min(groups, TOO_MANY);
  const spoken = groups > TOO_MANY ? `${groups * TALLY_GROUP}` : null;

  return (
    <span className="se-tally" title={title ?? String(whole)} aria-label={`${whole}`}>
      {spoken ? <span className="se-tally-many">{spoken}</span> : null}
      {Array.from({ length: shown }, (_, group) => (
        <span className="se-tally-five" key={`five-${group}`}>
          {Array.from({ length: 4 }, (_, stroke) => (
            <i className="se-tally-stroke" key={`s-${stroke}`} />
          ))}
          <i className="se-tally-across" />
        </span>
      ))}
      {rest > 0 ? (
        <span className="se-tally-five">
          {Array.from({ length: rest }, (_, stroke) => (
            <i className="se-tally-stroke" key={`r-${stroke}`} />
          ))}
        </span>
      ) : null}
      {whole === 0 ? <i className="se-tally-none" /> : null}
    </span>
  );
}
