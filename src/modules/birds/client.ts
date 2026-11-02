import { animals } from '../../render/lit/groupPass.ts';
import { registerPass } from '../../render/lit/passes.ts';
import { BirdPass } from './pass.ts';

registerPass(animals('birds', 'birds', 'bird', { under: 50, sorted: 70 }, (c) => new BirdPass(c.gl, c.quad.fullScreenVertexArray, c.weather, c.fauna)));
