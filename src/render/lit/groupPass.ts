import { SORTED_WITH_PROPS, UNDERLAY } from './litLayerConstants.ts';
import type { GroupPass, PassDef, RenderContext } from './passes.ts';
import type { ZooState } from './zoo.ts';

interface Orders {
  readonly under: number;
  readonly sorted: number;
}

export const animals = <T extends GroupPass>(id: string, skip: string, group: ZooState['group'], orders: Orders, create: (context: RenderContext) => T, extra: Partial<PassDef<T>> = {}, once = false): PassDef<T> => ({
  id,
  skip,
  group,
  create,
  startle: (pass, x, y, seconds) => pass.startle(x, y, seconds),
  probe: (pass, world, view, lighting) => pass.probe(world, view, lighting),
  entries: [
    {
      stage: 'underlay',
      order: orders.under,
      label: `${skip} (under)`,
      once,
      run: (pass, frame, pin) => {
        pass.prepare(frame.world, frame.view);
        pin(() => pass.draw(frame.world, frame.view, frame.lighting, UNDERLAY));
      },
    },
    {
      stage: 'sorted',
      order: orders.sorted,
      label: `${skip} (sorted with props)`,
      once,
      run: (pass, frame, pin) => pin(() => pass.draw(frame.world, frame.view, frame.lighting, SORTED_WITH_PROPS)),
    },
    ...(extra.entries ?? []),
  ],
});
