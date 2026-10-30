import { registerPass } from '../../render/lit/passes.ts';
import { CloudPass } from './cloudPass.ts';
import { FallingLeavesPass } from './fallingLeavesPass.ts';
import { PrecipitationPass } from './precipitationPass.ts';

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
