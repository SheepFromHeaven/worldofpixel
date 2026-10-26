import { resolve } from 'node:path';
import { build } from 'vite';

/**
 * The wiki is plain files, so the player has to arrive as one.
 *
 * Bundled from the real modules rather than written out by hand: the page plays what the game
 * plays, and a retuned patch is heard on the next `npm run wiki` without anybody remembering to
 * copy it across.
 */
export async function bundleMusicPlayer(out: string): Promise<void> {
  await build({
    configFile: false,
    logLevel: 'error',
    publicDir: false,
    build: {
      target: 'es2022',
      outDir: out,
      emptyOutDir: false,
      lib: {
        entry: resolve(import.meta.dirname, 'musicPlayer.ts'),
        formats: ['es'],
        fileName: () => 'music.js',
      },
    },
  });
}
