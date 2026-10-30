import type { Frame, Hello } from './protocol.ts';

const collect = (into: Set<ArrayBuffer>, values: Iterable<unknown>): void => {
  for (const value of values) if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) into.add(value.buffer);
};

const collectDeep = (into: Set<ArrayBuffer>, value: unknown): void => {
  if (ArrayBuffer.isView(value)) collect(into, [value]);
  else if (value && typeof value === 'object') for (const inner of Object.values(value)) collectDeep(into, inner);
};

export function framePayload(frame: Frame): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const { world, people, sky } = frame;
  collect(buffers, [world.tiles]);
  collectDeep(buffers, world.layers);
  collect(buffers, Object.values(people.columns));
  if (frame.fish) collect(buffers, Object.values(frame.fish.columns));
  if (frame.fauna) {
    const { levels, suit, part } = frame.fauna;
    collect(buffers, [...(levels ? [levels] : []), ...(suit ? [suit] : []), ...(part ? [part.data] : [])]);
  }
  collect(buffers, [sky.precipitationData, sky.cloudData, sky.fieldData, sky.groundData, sky.vapourData]);
  return [...buffers];
}

export function helloPayload(hello: Hello): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>(framePayload(hello.frame));
  collect(buffers, Object.values(hello.ground));
  return [...buffers];
}
