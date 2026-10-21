/**
 * A count, scratched in fives.
 *
 * Counting predates writing, and four strokes with one laid across them is the oldest readout
 * there is. It is also legible at four pixels, which a number is not — and it is the right mark
 * for a town that has not invented arithmetic over a total nobody has counted.
 *
 * Incised like everything else written on the town's slab: the groove is cut in the ledger's own
 * tally colour and its far wall catches the light down and to the right, away from the top-left
 * sun the map is lit by. Both colours come from the stage, so the same component is scratched
 * sandstone, beaten sheet or chalk without knowing which it is on.
 */

export const TALLY_GROUP = 5;

/** Above this many, the strokes are a texture rather than a count, so the rest is a numeral. */
const TOO_MANY = 8;

export function Tally({ count, title }: { count: number; title?: string }): React.JSX.Element {
  const whole = Math.max(0, Math.round(count));
  const groups = Math.floor(whole / TALLY_GROUP);
  const rest = whole % TALLY_GROUP;

  // Past a point a row of gates stops being read and starts being counted, which is the one
  // thing a tally is for. So the fives are written as a numeral and only the remainder is cut.
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
