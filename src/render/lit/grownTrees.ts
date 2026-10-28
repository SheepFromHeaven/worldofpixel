import { cropBytes } from './obliqueAtlas.ts';
import type { PlacedSprite } from './obliqueAtlas.ts';
import { loadSpriteSheetTexture, textureFromPixels } from './glHelpers.ts';
import type { SpriteAtlas } from './propPlacementCache.ts';

export interface GrownEntry {
  x: number;
  y: number;
  size: number;
  foot: { x: number; y: number };
  layered: boolean;
  low: { x: number; y: number };
  high: { x: number; y: number };
  height: number;
  sway: number;
  canopy: boolean;
  bend: boolean;
  hides: boolean;
  season: number;
}

interface GrownManifest {
  k: number;
  arts: Record<string, { width: number; height: number; sprites: Record<string, GrownEntry> }>;
}

const artOf = (name: string): string => name.split('.')[1]!;

export class GrownTrees {
  ready = false;
  readonly atlases = new Map<string, SpriteAtlas>();
  private readonly entries = new Map<string, GrownEntry>();
  private disposed = false;

  constructor(private readonly gl: WebGL2RenderingContext) {
    void this.load();
  }

  dispose(): void {
    this.disposed = true;
  }

  entry(name: string): GrownEntry | undefined {
    return this.entries.get(name);
  }

  atlasOf(name: string): SpriteAtlas | undefined {
    return this.atlases.get(artOf(name));
  }

  private async load(): Promise<void> {
    try {
      const manifest = (await (await fetch('/trees/trees.json')).json()) as GrownManifest;
      const arts = Object.entries(manifest.arts);
      await Promise.all(
        arts.map(async ([art, atlas]) => {
          const [albedo, normal] = await Promise.all([loadSpriteSheetTexture(this.gl, `/trees/${art}.albedo.png`), loadSpriteSheetTexture(this.gl, `/trees/${art}.normals.png`)]);
          if (this.disposed) return;
          const placed = new Map<string, PlacedSprite>(Object.entries(atlas.sprites).map(([name, sprite]) => [name, sprite]));
          const crop = textureFromPixels(this.gl, cropBytes(placed, atlas.width, atlas.height), atlas.width, atlas.height, false);
          this.atlases.set(art, { albedo, normal, crop, torchShadow: new Set(), width: atlas.width, height: atlas.height });
          for (const [name, sprite] of Object.entries(atlas.sprites)) this.entries.set(name, sprite);
        }),
      );
      this.ready = !this.disposed;
    } catch (error) {
      console.warn('grown trees unavailable:', error);
    }
  }
}
