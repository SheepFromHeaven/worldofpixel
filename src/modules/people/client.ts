import { MIPS } from '../../render/groundSprites.ts';
import { registerPass } from '../../render/lit/passes.ts';
import { registerDrawable } from '../clientSlots.ts';
import { folk } from './draw.ts';
import { HumanPass } from './humanPass.ts';
import type { HumanDraw } from './pose.ts';

registerDrawable(folk);

let staged: readonly HumanDraw[] = [];

registerPass<HumanPass>({
  id: 'people',
  skip: 'people',
  create: (c) => new HumanPass(c.gl, c.quad.fullScreenVertexArray),
  feed: (_pass, value) => {
    staged = value as readonly HumanDraw[];
  },
  entries: [
    {
      stage: 'sorted',
      order: 10,
      label: 'people',
      when: (frame) => frame.mip < MIPS,
      run: (pass, frame) => {
        if (staged.length > 0) pass.drawList(frame.view, frame.lighting, staged);
        if (frame.view.people) pass.draw(frame.view, frame.lighting, frame.view.people);
      },
    },
  ],
});
