import { buildField } from '../sim/terrain/worldfield.ts';

self.onmessage = (event: MessageEvent<number>): void => {
  const field = buildField(event.data);

  const buffers: ArrayBufferLike[] = [
    field.height.buffer,
    field.surface.buffer,
    field.water.buffer,
    field.temperature.buffer,
    field.wet.buffer,
    field.flux.buffer,
    field.biome.buffer,
    field.rivers.of.buffer,
  ];

  (self as unknown as Worker).postMessage(field, buffers as Transferable[]);
};
