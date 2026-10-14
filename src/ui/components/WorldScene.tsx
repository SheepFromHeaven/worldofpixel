import { useMemo } from 'react';
import {
  blobPath,
  curveThrough,
  hatchStrokes,
  insetPath,
  ridgePath,
  rng,
  tickMarks,
} from '../sketchLib.ts';
import { dustMotes, WORLD_STAGES, type WorldState } from '../worldStages.ts';

const CX = 220;
const CY = 220;
/** Light falls from the upper left, so every shadow in the scene sits toward 135°. */
const DARK_SIDE = 135;

function onRim(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + Math.sin(rad) * radius, y: CY - Math.cos(rad) * radius };
}

/** Orthographic foreshortening for anything lying on the sphere. */
function onSurface(angle: number, d: number, r: number) {
  const spot = onRim(angle, d * r);
  const squash = Math.max(0.2, Math.sqrt(1 - Math.min(d, 0.99) ** 2));
  return { ...spot, squash, tilt: `rotate(${angle.toFixed(1)}) scale(1, ${squash.toFixed(2)})` };
}

function Hatch({
  id,
  seed,
  extent,
  spacing,
  angle = 0,
  className = 'ec-hatch',
  width = 0.8,
  opacity = 0.4,
  half,
}: {
  id: string;
  seed: number;
  extent: number;
  spacing: number;
  angle?: number;
  className?: string;
  width?: number;
  opacity?: number;
  half?: boolean;
}) {
  const strokes = hatchStrokes(seed, extent, spacing);
  const used = half ? strokes.slice(Math.ceil(strokes.length / 2)) : strokes;
  return (
    <g clipPath={`url(#${id})`}>
      <g transform={`rotate(${angle})`}>
        {used.map((d, index) => (
          <path
            key={`${id}-h-${index}`}
            className={className}
            pathLength={1}
            strokeWidth={width}
            opacity={opacity}
            d={d}
          />
        ))}
      </g>
    </g>
  );
}

function Sea({ index, r }: { index: number; r: number }) {
  const seed = 1700 + index * 97;
  const angle = 42 + index * 73;
  const d = 0.26 + (index % 3) * 0.18;
  const spot = onSurface(angle, d, r);
  const size = (23 + (index % 3) * 7) * (r / 92);
  const shape = { points: 36, lobes: 0.24, grit: 0.07 };
  const clipId = `ec-sea-clip-${index}`;

  return (
    <g transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) ${spot.tilt}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={blobPath(seed, size, shape)} />
        </clipPath>
      </defs>
      <path className="ec-sea" pathLength={1} d={blobPath(seed, size, shape)} />
      <Hatch
        id={clipId}
        seed={seed + 3}
        extent={size * 1.4}
        spacing={3.4}
        className="ec-water-line"
        width={0.75}
        opacity={0.45}
      />
      <path className="ec-shoreline" pathLength={1} d={insetPath(seed, size, 2.6, shape)} />
      <path className="ec-shoreline ec-shoreline-deep" pathLength={1} d={insetPath(seed, size, 6, shape)} />
      {tickMarks(seed + 5, 22, size, 1.8).map((tick, i) => (
        <path key={`foam-${i}`} className="ec-foam" pathLength={1} d={tick} />
      ))}
      {index % 2 === 0 && (
        <g transform={`translate(${(size * 0.35).toFixed(1)}, ${(-size * 0.2).toFixed(1)})`}>
          <path className="ec-island" pathLength={1} d={blobPath(seed + 11, size * 0.22, { points: 18, lobes: 0.3, grit: 0.1 })} />
        </g>
      )}
    </g>
  );
}

function River({ index, r }: { index: number; r: number }) {
  const seed = 2600 + index * 61;
  const random = rng(seed);
  const angle = 18 + index * 95;
  const spot = onSurface(angle, 0.3 + (index % 2) * 0.14, r);
  const phase = random() * 6;

  const spine = Array.from({ length: 10 }, (_, i) => ({
    x: -32 + i * 7.4,
    y: Math.sin(i * 0.9 + phase) * 6.5 + (random() - 0.5) * 2.4,
  }));
  const bank = (offset: number) => spine.map((p) => ({ x: p.x, y: p.y + offset }));

  return (
    <g
      className="ec-river-group"
      transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) ${spot.tilt} rotate(${index * 41})`}
    >
      <path className="ec-river" pathLength={1} d={curveThrough(spine, false)} />
      <path className="ec-river-bank" pathLength={1} d={curveThrough(bank(1.8), false)} />
      <path className="ec-river-bank" pathLength={1} d={curveThrough(bank(-1.6), false)} />
      {[2, 5, 7].map((i) => {
        const anchor = spine[i]!;
        const dir = i % 2 === 0 ? -1 : 1;
        const branch = Array.from({ length: 4 }, (_, k) => ({
          x: anchor.x - k * 3.4 + (random() - 0.5) * 2,
          y: anchor.y + dir * k * 4.2 + (random() - 0.5) * 2,
        }));
        return (
          <path key={`trib-${i}`} className="ec-river-branch" pathLength={1} d={curveThrough(branch, false)} />
        );
      })}
      <path className="ec-river-branch" pathLength={1} d="M 36 -2 l 6 3 M 37 -5 l 7 0 M 36 1 l 5 5" />
    </g>
  );
}

function Volcano({ index, r }: { index: number; r: number }) {
  const seed = 3300 + index * 53;
  const angle = 24 + index * 83;
  const spot = onRim(angle, r - 6);
  const clipId = `ec-volcano-clip-${index}`;
  const cone = ridgePath(seed, 42, 30, { segments: 11, crater: 11 });

  return (
    <g className="ec-volcano" transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) rotate(${angle})`}>
      <defs>
        <clipPath id={clipId}>
          <path d={cone} />
        </clipPath>
      </defs>
      <path className="ec-volcano-cone" pathLength={1} d={cone} />
      <Hatch id={clipId} seed={seed + 2} extent={30} spacing={2.6} angle={62} className="ec-hatch-fire" width={0.7} opacity={0.42} />
      <Hatch id={clipId} seed={seed + 7} extent={30} spacing={4.4} angle={-24} className="ec-hatch-fire" width={0.6} opacity={0.26} />
      {[0, 1, 2].map((k) => (
        <path
          key={`strata-${k}`}
          className="ec-volcano-ridge"
          pathLength={1}
          d={curveThrough(
            Array.from({ length: 5 }, (_, i) => ({ x: -16 + i * 8, y: -4 - k * 6 + Math.sin(i + k) * 1.6 })),
            false,
          )}
        />
      ))}
      <path className="ec-lava" pathLength={1} d={curveThrough([{ x: -1, y: -25 }, { x: -4, y: -18 }, { x: -3, y: -11 }, { x: -7, y: -5 }, { x: -6, y: 1 }], false)} />
      <path className="ec-lava ec-lava-thin" pathLength={1} d={curveThrough([{ x: 2, y: -25 }, { x: 5, y: -17 }, { x: 4, y: -9 }, { x: 8, y: -2 }], false)} />
      <path className="ec-smoke" pathLength={1} d={curveThrough([{ x: 0, y: -28 }, { x: 5, y: -34 }, { x: -2, y: -40 }, { x: 3, y: -46 }], false)} />
      <g className="ec-smoke-puff">
        <path pathLength={1} d={blobPath(seed + 21, 9, { points: 16, lobes: 0.3, grit: 0.12, squashY: 0.8 })} transform="translate(2 -52)" />
      </g>
      <g className="ec-smoke-puff ec-smoke-high">
        <path pathLength={1} d={blobPath(seed + 31, 12, { points: 18, lobes: 0.34, grit: 0.12, squashY: 0.75 })} transform="translate(-4 -68)" />
      </g>
    </g>
  );
}

function Tree({ seed, x, scale }: { seed: number; x: number; scale: number }) {
  const random = rng(seed);
  return (
    <g className="ec-tree" transform={`translate(${x}, 0) scale(${scale})`}>
      <path className="ec-trunk" pathLength={1} d="M 0 2 C -0.6 -2, 0.6 -6, 0 -11" />
      <path className="ec-trunk" pathLength={1} d="M 0 -6 l -4 -3 M 0 -8.5 l 4 -3" />
      {[
        { dx: -4, dy: -13, rr: 6 },
        { dx: 4, dy: -14, rr: 5.4 },
        { dx: 0, dy: -18, rr: 5.8 },
      ].map((lobe, i) => (
        <path
          key={`lobe-${i}`}
          className="ec-canopy"
          pathLength={1}
          transform={`translate(${lobe.dx}, ${lobe.dy})`}
          d={blobPath(seed + i * 13, lobe.rr, { points: 16, lobes: 0.26, grit: 0.14 })}
        />
      ))}
      {tickMarks(seed + 41, 10, 7, 1.6).map((tick, i) => (
        <path key={`leaf-${i}`} className="ec-leaf" pathLength={1} transform="translate(0 -15)" d={tick} opacity={0.5 + random() * 0.3} />
      ))}
    </g>
  );
}

function Village({ index, r }: { index: number; r: number }) {
  const seed = 4100 + index * 71;
  const angle = 58 + index * 61;
  const spot = onRim(angle, r - 2);
  const roofId = `ec-roof-clip-${index}`;
  const wallId = `ec-wall-clip-${index}`;
  const roof = 'M -14 -6 L -3 -16 L 8 -6 Z';
  const wall = 'M -11 2 L -11 -6.5 L 5 -6.5 L 5 2 Z';

  return (
    <g className="ec-hut" transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) rotate(${angle})`}>
      <defs>
        <clipPath id={roofId}>
          <path d={roof} />
        </clipPath>
        <clipPath id={wallId}>
          <path d={wall} />
        </clipPath>
      </defs>

      <path className="ec-hut-wall" pathLength={1} d={wall} />
      <Hatch id={wallId} seed={seed} extent={12} spacing={1.9} angle={78} className="ec-hatch-clay" width={0.55} opacity={0.4} />
      <path className="ec-hut-beam" pathLength={1} d="M -11 -2 L 5 -2 M -6 -6.5 L -6 2 M 0 -6.5 L 0 2" />

      <path className="ec-hut-roof" pathLength={1} d={roof} />
      <g clipPath={`url(#${roofId})`}>
        {[0, 1, 2, 3].map((row) => (
          <path
            key={`shingle-${row}`}
            className="ec-shingle"
            pathLength={1}
            d={Array.from({ length: 7 }, (_, i) => `M ${-13 + i * 4} ${-7.5 - row * 2.4} q 2 1.6 4 0`).join(' ')}
          />
        ))}
      </g>

      <path className="ec-hut-door" pathLength={1} d="M -8 2 L -8 -3.4 Q -6.5 -5 -5 -3.4 L -5 2" />
      <path className="ec-hut-detail" pathLength={1} d="M -1.5 -2 L 2.5 -2 L 2.5 -5 L -1.5 -5 Z M 0.5 -5 L 0.5 -2 M -1.5 -3.5 L 2.5 -3.5" />
      <path className="ec-hut-detail" pathLength={1} d="M 1 -16 L 1 -21 L 4.5 -21 L 4.5 -13 M 1 -19 L 4.5 -19 M 1 -17 L 4.5 -17" />
      <path className="ec-chimney-smoke" pathLength={1} d={curveThrough([{ x: 2.7, y: -22 }, { x: 5, y: -26 }, { x: 1, y: -30 }, { x: 4, y: -34 }], false)} />

      <path className="ec-hut-wall" pathLength={1} d="M 8 2 L 8 -4 L 12.5 -8.5 L 17 -4 L 17 2 Z" />
      <path className="ec-hut-detail" pathLength={1} d="M 11 2 L 11 -2.5 L 14 -2.5 L 14 2" />

      <Tree seed={seed + 5} x={-22} scale={1} />
      <Tree seed={seed + 9} x={22} scale={0.72} />

      <path className="ec-fence" pathLength={1} d="M -30 2 L -30 -4 M -27 2 L -27 -4.6 M -24 2 L -24 -4 M -30 -3 L -24 -3.4 M 25 2 L 25 -4 M 28 2 L 28 -4.6 M 25 -3 L 28 -3.4" />
      {tickMarks(seed + 61, 14, 26, 2, 0.12).map((tick, i) => (
        <path key={`grass-${i}`} className="ec-grass" pathLength={1} transform="translate(0 2)" d={tick} />
      ))}
    </g>
  );
}

function Cloud({ index, r }: { index: number; r: number }) {
  const seed = 5200 + index * 43;
  const angle = 36 + index * 69;
  const spot = onRim(angle, r + 36);
  const clipId = `ec-cloud-clip-${index}`;
  const shape = blobPath(seed, 19, { points: 26, lobes: 0.3, grit: 0.08, squashY: 0.52 });

  return (
    <g transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) rotate(${angle})`}>
      <g className="ec-cloud-group">
        <defs>
          <clipPath id={clipId}>
            <path d={shape} />
          </clipPath>
        </defs>
        <path className="ec-cloud" pathLength={1} d={shape} />
        <Hatch id={clipId} seed={seed + 4} extent={20} spacing={2.4} angle={12} className="ec-cloud-under" width={0.6} opacity={0.3} half />
        <path className="ec-cloud-lip" pathLength={1} d={insetPath(seed, 19, 2.4, { points: 26, lobes: 0.3, grit: 0.08, squashY: 0.52 })} />
      </g>
    </g>
  );
}

function Crater({ seed, angle, d, size, r }: { seed: number; angle: number; d: number; size: number; r: number }) {
  const spot = onSurface(angle, d, r);
  const clipId = `ec-crater-clip-${seed}`;
  const shape = blobPath(seed, size, { points: 20, lobes: 0.1, grit: 0.08 });

  return (
    <g transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) ${spot.tilt}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={shape} />
        </clipPath>
      </defs>
      <path className="ec-crater" pathLength={1} d={shape} />
      <Hatch id={clipId} seed={seed + 2} extent={size * 1.2} spacing={1.9} angle={28} width={0.65} opacity={0.4} half />
      <path className="ec-crater-light" pathLength={1} d={insetPath(seed, size, size * 0.3, { points: 20, lobes: 0.1, grit: 0.08 })} />
    </g>
  );
}

export function WorldScene({ state, earth }: { state: WorldState; earth: number }) {
  const stars = useMemo(() => {
    const random = rng(1337);
    return Array.from({ length: 58 }, () => ({
      x: random() * 440,
      y: random() * 440,
      size: 0.6 + random() * 1.1,
      bright: random() > 0.88,
    })).filter((star) => Math.hypot(star.x - CX, star.y - CY) > 172);
  }, []);

  const dust = useMemo(() => {
    const random = rng(99);
    return Array.from({ length: 26 }, () => {
      const angle = random() * 360;
      const radius = 60 + random() * 80;
      return { ...onRim(angle, radius), size: 2 + random() * 3 };
    });
  }, []);

  const specks = useMemo(() => {
    const random = rng(4242);
    return Array.from({ length: 70 }, () => {
      const angle = random() * 360;
      const d = Math.sqrt(random()) * 0.93;
      const towardDark = Math.cos((((angle - DARK_SIDE) % 360) * Math.PI) / 180);
      return { angle, d, tilt: random() * 180, long: random() > 0.62, keep: random() < 0.42 + towardDark * 0.42 };
    }).filter((speck) => speck.keep);
  }, []);

  const r = state.planetRadius;
  const visibleDust = state.hasPlanet ? 0 : dustMotes(earth, WORLD_STAGES[0]!.needed);
  const hasSky = (state.counts.sky ?? 0) > 0;
  const hasVillages = (state.counts.settlements ?? 0) > 0;
  const moonSpot = onRim(312, r + 54);

  return (
    <svg className="ec-scene" viewBox="0 0 440 440" role="img" aria-label="The world so far">
      <defs>
        <clipPath id="ec-planet-clip">
          <circle cx={CX} cy={CY} r={r} />
        </clipPath>
        <clipPath id="ec-terminator-clip">
          <circle cx={CX} cy={CY} r={r - 1} />
        </clipPath>
      </defs>

      <g className="ec-ink-layer">
        {stars.map((star, index) =>
          star.bright ? (
            <path
              key={`star-${index}`}
              className="ec-star-bright"
              pathLength={1}
              d={`M ${star.x - 3.2} ${star.y} L ${star.x + 3.2} ${star.y} M ${star.x} ${star.y - 3.2} L ${star.x} ${star.y + 3.2}`}
            />
          ) : (
            <circle key={`star-${index}`} className="ec-star" cx={star.x} cy={star.y} r={star.size} />
          ),
        )}

        {Array.from({ length: visibleDust }, (_, index) => {
          const mote = dust[index % dust.length]!;
          return (
            <g key={`dust-${index}`} className="ec-dust">
              <circle pathLength={1} cx={mote.x} cy={mote.y} r={mote.size} />
            </g>
          );
        })}

        {state.hasPlanet && (
          <>
            {Array.from({ length: state.counts.sky ?? 0 }, (_, index) => (
              <circle
                key={`sky-${index}`}
                className="ec-sky"
                pathLength={1}
                cx={CX}
                cy={CY}
                r={r + 13 + index * 10}
                style={{ opacity: 0.5 - index * 0.13 }}
              />
            ))}

            {hasSky && (
              <g className="ec-moon-orbit">
                <circle className="ec-orbit" pathLength={1} cx={CX} cy={CY} r={r + 54} />
                <g className="ec-moon" transform={`translate(${moonSpot.x.toFixed(1)}, ${moonSpot.y.toFixed(1)})`}>
                  <defs>
                    <clipPath id="ec-moon-clip">
                      <path d={blobPath(777, 13, { points: 22, lobes: 0.05, grit: 0.05 })} />
                    </clipPath>
                  </defs>
                  <path className="ec-moon-body" pathLength={1} d={blobPath(777, 13, { points: 22, lobes: 0.05, grit: 0.05 })} />
                  <Hatch id="ec-moon-clip" seed={778} extent={14} spacing={1.7} angle={34} width={0.6} opacity={0.35} half />
                  <path className="ec-crater" pathLength={1} transform="translate(-4 -3)" d={blobPath(779, 3.4, { points: 12, lobes: 0.12, grit: 0.1 })} />
                  <path className="ec-crater" pathLength={1} transform="translate(4.5 4)" d={blobPath(781, 2.6, { points: 12, lobes: 0.12, grit: 0.1 })} />
                </g>
              </g>
            )}

            <g className="ec-contour-layer">
              <circle className="ec-planet" pathLength={1} cx={CX} cy={CY} r={r} />
            </g>

            <g clipPath="url(#ec-planet-clip)">
              {specks.map((speck, index) => {
                const spot = onSurface(speck.angle, speck.d, r);
                const length = speck.long ? 4.2 : 1.8;
                return (
                  <path
                    key={`speck-${index}`}
                    className="ec-speck"
                    pathLength={1}
                    transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) rotate(${speck.tilt.toFixed(0)})`}
                    d={`M ${-length / 2} 0 L ${length / 2} 0`}
                  />
                );
              })}

              {[0, 1, 2].map((index) => {
                const spot = onSurface(246 + index * 46, 0.54, r);
                const seed = 910 + index * 17;
                const clipId = `ec-ridge-clip-${index}`;
                const ridge = ridgePath(seed, 46 * (r / 95), 17 * (r / 95), { segments: 13 });
                return (
                  <g key={`ridge-${index}`} transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) ${spot.tilt}`}>
                    <defs>
                      <clipPath id={clipId}>
                        <path d={ridge} />
                      </clipPath>
                    </defs>
                    <path className="ec-ridge" pathLength={1} d={ridge} />
                    <Hatch id={clipId} seed={seed + 3} extent={26} spacing={2.1} angle={70} width={0.6} opacity={0.35} />
                  </g>
                );
              })}

              <Crater seed={611} angle={318} d={0.42} size={13} r={r} />
              <Crater seed={623} angle={28} d={0.56} size={9} r={r} />
              <Crater seed={641} angle={118} d={0.62} size={11} r={r} />
              <Crater seed={659} angle={204} d={0.3} size={6.5} r={r} />

              {Array.from({ length: state.counts.seas ?? 0 }, (_, index) => (
                <Sea key={`sea-${index}`} index={index} r={r} />
              ))}

              {Array.from({ length: state.counts.riverbeds ?? 0 }, (_, index) => (
                <River key={`river-${index}`} index={index} r={r} />
              ))}
            </g>

            {/* Terminator shading rides over everything on the surface, as light does. */}
            <g clipPath="url(#ec-terminator-clip)" className="ec-shading">
              {[
                { inset: 2, span: 128, width: 1.3, opacity: 0.4 },
                { inset: 8, span: 108, width: 1.1, opacity: 0.32 },
                { inset: 15, span: 86, width: 1, opacity: 0.26 },
                { inset: 23, span: 62, width: 0.85, opacity: 0.2 },
                { inset: 32, span: 38, width: 0.75, opacity: 0.14 },
              ].map((band, index) => {
                const a = onRim(DARK_SIDE - band.span / 2, r - band.inset);
                const b = onRim(DARK_SIDE + band.span / 2, r - band.inset);
                return (
                  <path
                    key={`band-${index}`}
                    className="ec-hatch"
                    pathLength={1}
                    strokeWidth={band.width}
                    opacity={band.opacity}
                    d={`M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${(r - band.inset).toFixed(1)} ${(r - band.inset).toFixed(1)} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`}
                  />
                );
              })}
              {Array.from({ length: 11 }, (_, index) => {
                const angle = DARK_SIDE - 45 + index * 9;
                const outer = onRim(angle, r - 1);
                const inner = onRim(angle, r - 12 - (index % 3) * 6);
                return (
                  <path
                    key={`cross-${index}`}
                    className="ec-hatch"
                    pathLength={1}
                    strokeWidth={0.7}
                    opacity={0.26}
                    d={`M ${outer.x.toFixed(1)} ${outer.y.toFixed(1)} L ${inner.x.toFixed(1)} ${inner.y.toFixed(1)}`}
                  />
                );
              })}
            </g>

            {Array.from({ length: state.counts.volcanoes ?? 0 }, (_, index) => (
              <Volcano key={`volcano-${index}`} index={index} r={r} />
            ))}

            {Array.from({ length: state.counts.settlements ?? 0 }, (_, index) => (
              <Village key={`hut-${index}`} index={index} r={r} />
            ))}

            {Array.from({ length: state.counts.clouds ?? 0 }, (_, index) => (
              <Cloud key={`cloud-${index}`} index={index} r={r} />
            ))}

            {hasVillages &&
              [0, 1, 2].map((index) => {
                const spot = onRim(330 + index * 14, r + 26 + index * 9);
                return (
                  <path
                    key={`bird-${index}`}
                    className="ec-bird"
                    pathLength={1}
                    transform={`translate(${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}) rotate(${index * 9 - 10})`}
                    d="M -7 0 q 3.5 -3.4 7 -0.4 q 3.6 -3.2 7 0.2"
                  />
                );
              })}
          </>
        )}
      </g>

      <rect className="ec-grain" width="440" height="440" filter="url(#ec-paper-grain)" />
    </svg>
  );
}
