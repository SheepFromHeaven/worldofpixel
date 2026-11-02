import { animals } from '../../render/lit/groupPass.ts';
import type { MammalAgents } from '../../render/lit/mammalAgents.ts';
import { registerPass } from '../../render/lit/passes.ts';
import { MammalPass } from './pass.ts';

export { MAMMALS_FROM_ZOOM } from './pass.ts';

registerPass<MammalPass>({
  ...animals(
    'mammals',
    'mammals',
    'mammal',
    { under: 60, sorted: 60 },
    (c) => new MammalPass(c.gl, c.quad.fullScreenVertexArray, c.weather, c.fauna),
    {
      entries: [
        {
          stage: 'sorted',
          order: 65,
          label: 'mammals (through)',
          once: true,
          when: (frame) => frame.view.xray === true,
          run: (pass, frame, pin) => pin(() => pass.drawThrough(frame.world, frame.view, frame.lighting)),
        },
      ],
    },
    true,
  ),
  feed: (pass, value) => pass.setAgents(value as MammalAgents | null),
});
