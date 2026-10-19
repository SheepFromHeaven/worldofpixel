import { buildField } from '../sim/worldfield.ts';

/**
 * Works a world out off the main thread and hands it back.
 *
 * The seven grids and the river index are the bulk of it — hundreds of megabytes — and they are
 * `ArrayBuffer`s, so they go in the transfer list and change owner rather than being copied.
 * What is left is the river geometry, which is objects and is structure-cloned; that costs a few
 * hundred milliseconds against the seconds the pass itself takes, which is why it is not worth
 * flattening into arrays as well.
 *
 * The buffers are gone from this side once they are posted. Nothing here touches the field
 * afterwards, and the worker is finished with anyway.
 */
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
