import { animals } from '../../render/lit/groupPass.ts';
import { registerPass } from '../../render/lit/passes.ts';
import { InsectPass } from './pass.ts';

registerPass(animals('insects', 'insects', 'insect', { under: 10, sorted: 30 }, (c) => new InsectPass(c.gl, c.quad.fullScreenVertexArray, c.weather, c.fauna)));
