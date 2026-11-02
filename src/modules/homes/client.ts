import { registerPass } from '../../render/lit/passes.ts';
import { HomePass } from './homePass.ts';


registerPass<HomePass>({
  id: 'homes',
  skip: 'homes',
  create: (c) => new HomePass(c.gl, c.quad.cornersBuffer),
  entries: [{ stage: 'underlay', order: 40, label: 'homes', run: (pass, frame) => pass.draw(frame.world, frame.view, frame.lighting) }],
});
