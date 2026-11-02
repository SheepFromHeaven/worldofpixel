import { registerPass } from '../../render/lit/passes.ts';
import { FishPass } from './fishPass.ts';
export { fishInstances } from './fishInstances.ts';

registerPass<FishPass>({
  id: 'fish',
  skip: 'fish',
  create: (c) => new FishPass(c.gl, c.quad.cornersBuffer, c.weather),
  entries: [{ stage: 'water', order: 10, label: 'fish', run: (pass, frame) => pass.draw(frame.world, frame.view, frame.lighting) }],
});
