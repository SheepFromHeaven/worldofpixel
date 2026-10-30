import { animals } from '../../render/lit/corePasses.ts';
import { registerPass } from '../../render/lit/passes.ts';
import { AmphibianPass } from './pass.ts';

registerPass(animals('amphibians', 'amphibians', 'amphibian', { under: 20, sorted: 40 }, (c) => new AmphibianPass(c.gl, c.quad.fullScreenVertexArray, c.weather, c.fauna)));
