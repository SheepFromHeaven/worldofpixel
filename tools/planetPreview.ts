import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { PLANET_HEIGHT, PLANET_WIDTH, messageFor, paintPlanet, settledState } from '../src/ui/planet.ts';

const out = process.argv[2] ?? '/tmp/planet.png';
const steps = (process.argv[3] ?? '0.03,0.1,0.18,0.28,0.4,0.52,0.65,0.8,0.92,0.98').split(',').map(Number);
const scale = 2;
const columns = 5;
const rows = Math.ceil(steps.length / columns);
const width = columns * PLANET_WIDTH * scale;
const height = rows * PLANET_HEIGHT * scale;
const sheet = new Uint8Array(width * height * 4);

steps.forEach((progress, index) => {
  const frame = new Uint8ClampedArray(PLANET_WIDTH * PLANET_HEIGHT * 4);
  paintPlanet(frame, settledState(progress), 3 + index * 0.7);
  const left = (index % columns) * PLANET_WIDTH * scale;
  const top = Math.floor(index / columns) * PLANET_HEIGHT * scale;
  for (let y = 0; y < PLANET_HEIGHT * scale; y += 1) {
    for (let x = 0; x < PLANET_WIDTH * scale; x += 1) {
      const from = (Math.floor(y / scale) * PLANET_WIDTH + Math.floor(x / scale)) * 4;
      const to = ((top + y) * width + left + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) sheet[to + channel] = frame[from + channel]!;
    }
  }
  console.log(`${progress}: ${messageFor(progress)}`);
});

writeFileSync(out, encodePng(sheet, width, height));
console.log(out);
