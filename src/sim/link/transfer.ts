import type { Frame, Hello } from './protocol.ts';

const collect = (into: Set<ArrayBuffer>, values: Iterable<unknown>): void => {
  for (const value of values) if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) into.add(value.buffer);
};

export function framePayload(frame: Frame): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const { world, people, sky } = frame;
  collect(buffers, [world.tiles, world.canopy, world.canopyAge, world.canopyHeight, world.under, world.underAge, world.underHeight, world.herb, world.canopyTaken, world.underTaken, world.cover, world.wear, world.storage, world.floor, world.fire, world.ember, world.torch, world.plan]);
  collect(buffers, Object.values(people.columns));
  if (frame.fish) collect(buffers, Object.values(frame.fish.columns));
  if (frame.fauna) collect(buffers, frame.fauna.suit ? [frame.fauna.levels, frame.fauna.suit] : [frame.fauna.levels]);
  collect(buffers, [sky.precipitationData, sky.cloudData, sky.fieldData, sky.groundData, sky.vapourData]);
  return [...buffers];
}

export function helloPayload(hello: Hello): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>(framePayload(hello.frame));
  collect(buffers, Object.values(hello.ground));
  return [...buffers];
}
