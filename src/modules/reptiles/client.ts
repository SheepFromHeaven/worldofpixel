import { animals } from '../../render/lit/corePasses.ts';
import { registerPass } from '../../render/lit/passes.ts';
import { ReptilePass } from './pass.ts';

registerPass(animals('reptiles', 'reptiles', 'reptile', { under: 30, sorted: 50 }, (c) => new ReptilePass(c.gl, c.quad.fullScreenVertexArray, c.weather, c.fauna)));
