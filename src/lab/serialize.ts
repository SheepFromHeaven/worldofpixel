import type { Light } from '../pixel/light.ts';

const round = (value: number): string => {
  const fixed = Number(value.toFixed(2));
  return Number.isInteger(fixed) ? fixed.toFixed(0) : String(fixed);
};

/**
 * The lights as the source that would produce them.
 *
 * The point of the lab is to settle an argument about where the sun is, and an answer you can
 * only see on screen has not settled anything. This is the paste that carries it back into the
 * sprite file, in the shape the file already uses.
 */
export function lightsToSource(lights: readonly Light[], name = 'LIGHTS'): string {
  const lines = lights.map((light) => {
    if (light.kind === 'sun') {
      const [x, y, z] = light.toward;
      return `  { kind: 'sun', toward: [${round(x)}, ${round(y)}, ${round(z)}], strength: ${round(light.strength)} },`;
    }

    const flatten = light.flatten === undefined ? '' : `, flatten: ${round(light.flatten)}`;
    if (light.kind === 'glow') {
      return (
        `  { kind: 'glow', x: ${round(light.x)}, y: ${round(light.y)}, reach: ${round(light.reach)},` +
        ` strength: ${round(light.strength)}${flatten} },`
      );
    }

    return (
      `  { kind: 'rings', x: ${round(light.x)}, y: ${round(light.y)}, spacing: ${round(light.spacing)},` +
      ` breaks: ${round(light.breaks)}, rotation: ${round(light.rotation)}, reach: ${round(light.reach)},` +
      ` strength: ${round(light.strength)}${flatten} },`
    );
  });

  return `export const ${name}: readonly Light[] = [\n${lines.join('\n')}\n];`;
}

/**
 * The pieces as the line that would produce them, for the sprite and for `SOURCES`.
 *
 * Same reason as the lights: where a drawing's parts stand gets settled by dragging them against
 * a villager, and an answer that only exists on screen has not been settled. The sprite declares
 * these and `render/sprites.ts` keeps a copy — the bake refuses when the two disagree — so the
 * same line goes in both places.
 */
export function piecesToSource(pieces: readonly { clip?: string; foot: number }[]): string {
  const parts = pieces.map(
    (piece) => `{ clip: '${piece.clip ?? 'default'}', foot: ${round(piece.foot)} }`,
  );
  return `pieces: [${parts.join(', ')}],`;
}
