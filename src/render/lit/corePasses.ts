import { MIPS } from '../groundSprites.ts';
import { CloudPass } from './cloudPass.ts';
import { FallingLeavesPass } from './fallingLeavesPass.ts';
import { FlamePass } from './flamePass.ts';
import { HumanPass } from './humanPass.ts';
import { MAX_POINTS } from './lighting.ts';
import { SORTED_WITH_PROPS, UNDERLAY } from './litLayerConstants.ts';
import { windOver } from './localWind.ts';
import { registerPass } from './passes.ts';
import type { GroupPass, PassDef, RenderContext } from './passes.ts';
import { PrecipitationPass } from './precipitationPass.ts';
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



registerPass<HumanPass>({
  id: 'people',
  skip: 'people',
  create: (c) => new HumanPass(c.gl, c.quad.fullScreenVertexArray),
  entries: [
    {
      stage: 'sorted',
      order: 10,
      label: 'people',
      when: (frame) => frame.mip < MIPS,
      run: (pass, frame) => {
        if (frame.humans.length > 0) pass.drawList(frame.view, frame.lighting, frame.humans);
        if (frame.view.people) pass.draw(frame.view, frame.lighting, frame.view.people);
      },
    },
  ],
});

registerPass<FlamePass>({
  id: 'flames',
  skip: 'flames',
  create: (c) => new FlamePass(c.gl, c.quad.fullScreenVertexArray),
  entries: [
    {
      stage: 'sorted',
      order: 20,
      label: 'flames',
      when: (frame) => frame.standing,
      run: (pass, frame) => pass.draw(frame.view, frame.lighting.points.slice(0, MAX_POINTS), (x, y) => windOver(frame.world, frame.sky, x, y)),
    },
  ],
});

registerPass<FallingLeavesPass>({
  id: 'leaves',
  skip: 'leaves',
  create: (c) => new FallingLeavesPass(c.gl, c.quad.fullScreenVertexArray, c.weather),
  entries: [{ stage: 'overlay', order: 10, label: 'falling leaves', run: (pass, frame) => pass.draw(frame.world, frame.view, frame.lighting) }],
});

registerPass<PrecipitationPass>({
  id: 'precipitation',
  skip: 'precipitation',
  create: (c) => new PrecipitationPass(c.gl, c.quad.fullScreenVertexArray, c.weather),
  entries: [{ stage: 'overlay', order: 20, label: 'precipitation', run: (pass, frame) => pass.draw(frame.world, frame.view, frame.lighting) }],
});

registerPass<CloudPass>({
  id: 'clouds',
  skip: 'clouds',
  create: (c) => new CloudPass(c.gl, c.quad.fullScreenVertexArray, c.weather),
  entries: [{ stage: 'overlay', order: 30, label: 'clouds', run: (pass, frame) => pass.draw(frame.world, frame.view, frame.lighting) }],
});
