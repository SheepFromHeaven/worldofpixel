import { registerDrawable } from '../clientSlots.ts';
import { MAX_POINTS } from '../../render/lit/lighting.ts';
import { windOver } from '../../render/lit/localWind.ts';
import { registerPass } from '../../render/lit/passes.ts';
import { hearths } from './draw.ts';
import { FlamePass } from './flamePass.ts';

registerDrawable(hearths);

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
