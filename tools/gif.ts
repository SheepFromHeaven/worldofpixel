import { inflateSync } from 'node:zlib';

export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const paeth = (left: number, above: number, corner: number): number => {
  const estimate = left + above - corner;
  const a = Math.abs(estimate - left);
  const b = Math.abs(estimate - above);
  const c = Math.abs(estimate - corner);
  return a <= b && a <= c ? left : b <= c ? above : corner;
};

export const decodePng = (file: Uint8Array): Raster => {
  const buffer = Buffer.from(file);
  if (SIGNATURE.some((value, at) => buffer[at] !== value)) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  let channels = 0;
  const parts: Buffer[] = [];
  let at = 8;
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString('ascii', at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8]!;
      const colour = body[9]!;
      if (depth !== 8 || (colour !== 2 && colour !== 6) || body[12] !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour ${colour}, interlace ${body[12]})`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') parts.push(body);
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const data = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)]!;
    const line = new Uint8Array(stride);
    for (let x = 0; x < stride; x += 1) {
      const byte = raw[row * (stride + 1) + 1 + x]!;
      const left = x >= channels ? line[x - channels]! : 0;
      const above = previous[x]!;
      const corner = x >= channels ? previous[x - channels]! : 0;
      line[x] = (byte + (filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? (left + above) >> 1 : paeth(left, above, corner))) & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const to = (row * width + x) * 4;
      data[to] = line[x * channels]!;
      data[to + 1] = line[x * channels + 1]!;
      data[to + 2] = line[x * channels + 2]!;
      data[to + 3] = channels === 4 ? line[x * channels + 3]! : 255;
    }
    previous = line;
  }
  return { width, height, data };
};

export const crop = (source: Raster, left: number, top: number, width: number, height: number): Raster => {
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) data.set(source.data.subarray(((top + row) * source.width + left) * 4, ((top + row) * source.width + left + width) * 4), row * width * 4);
  return { width, height, data };
};

const colourKey = (data: Uint8Array, at: number): number => (data[at]! << 16) | (data[at + 1]! << 8) | data[at + 2]!;

const paletteOf = (frames: readonly Raster[]): { colours: number[]; lookup: (key: number) => number } => {
  const counts = new Map<number, number>();
  for (const frame of frames) for (let at = 0; at < frame.data.length; at += 4) counts.set(colourKey(frame.data, at), (counts.get(colourKey(frame.data, at)) ?? 0) + 1);
  const colours = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map(([key]) => key);
  const index = new Map(colours.map((key, at) => [key, at]));
  const lookup = (key: number): number => {
    const known = index.get(key);
    if (known !== undefined) return known;
    const red = key >> 16;
    const green = (key >> 8) & 255;
    const blue = key & 255;
    let best = 0;
    let distance = Infinity;
    colours.forEach((candidate, at) => {
      const gap = (red - (candidate >> 16)) ** 2 + (green - ((candidate >> 8) & 255)) ** 2 + (blue - (candidate & 255)) ** 2;
      if (gap < distance) {
        distance = gap;
        best = at;
      }
    });
    index.set(key, best);
    return best;
  };
  return { colours, lookup };
};

const compress = (indices: Uint8Array, minimum: number): number[] => {
  const clear = 1 << minimum;
  const end = clear + 1;
  const out: number[] = [];
  let bits = 0;
  let held = 0;
  let size = minimum + 1;
  let next = end + 1;
  let table = new Map<number, number>();
  const emit = (code: number): void => {
    held |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(held & 255);
      held >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = indices[0]!;
  for (let at = 1; at < indices.length; at += 1) {
    const byte = indices[at]!;
    const key = (prefix << 8) | byte;
    const found = table.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      next = end + 1;
      size = minimum + 1;
      table = new Map();
    } else {
      if (next >= 1 << size) size += 1;
      table.set(key, next);
      next += 1;
    }
    prefix = byte;
  }
  emit(prefix);
  emit(end);
  if (bits > 0) out.push(held & 255);
  return out;
};

const word = (value: number): number[] => [value & 255, (value >> 8) & 255];

export const encodeGif = (frames: readonly Raster[], framesPerSecond: number): Uint8Array => {
  const first = frames[0];
  if (!first) throw new Error('no frames to encode');
  const { colours, lookup } = paletteOf(frames);
  let depth = 2;
  while (1 << depth < colours.length) depth += 1;
  const out: number[] = [...Buffer.from('GIF89a'), ...word(first.width), ...word(first.height), 0x80 | 0x70 | (depth - 1), 0, 0];
  for (let at = 0; at < 1 << depth; at += 1) {
    const key = colours[at] ?? 0;
    out.push(key >> 16, (key >> 8) & 255, key & 255);
  }
  out.push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  const delay = Math.max(2, Math.round(100 / framesPerSecond));
  for (const frame of frames) {
    const indices = new Uint8Array(frame.width * frame.height);
    for (let at = 0; at < indices.length; at += 1) indices[at] = lookup(colourKey(frame.data, at * 4));
    out.push(0x21, 0xf9, 4, 0x04, ...word(delay), 0, 0, 0x2c, 0, 0, 0, 0, ...word(frame.width), ...word(frame.height), 0, depth);
    const packed = compress(indices, depth);
    for (let at = 0; at < packed.length; at += 255) {
      const block = packed.slice(at, at + 255);
      out.push(block.length, ...block);
    }
    out.push(0);
  }
  out.push(0x3b);
  return Uint8Array.from(out);
};
