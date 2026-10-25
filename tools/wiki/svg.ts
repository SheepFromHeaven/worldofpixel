export interface Axis {
  label: string;
  domain: readonly [number, number];
  ticks?: readonly number[];
  format?: (value: number) => string;
}

export interface Series {
  name: string;
  points: readonly (readonly [number, number])[];
  colour: string;
  dashed?: boolean;
}

export interface Guide {
  at: number;
  label?: string;
}

export interface Band {
  from: number;
  to: number;
  label?: string;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  x: Axis;
  y: Axis;
  series: readonly Series[];
  verticals?: readonly Guide[];
  horizontals?: readonly Guide[];
  bands?: readonly Band[];
  legend?: boolean;
  label: string;
}

const PAD = { left: 52, right: 14, top: 12, bottom: 40 };

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const trim = (value: number): string => String(Math.round(value * 100) / 100);

const tidy = (value: number): string => String(Number(value.toPrecision(3)));

export function niceTicks(from: number, to: number, target = 6): number[] {
  const span = to - from;
  const rough = span / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? power * 10;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to + step * 1e-9; t += step) ticks.push(Number((Math.round(t / step) * step).toFixed(10)));
  return ticks;
}

export function lineChart(options: ChartOptions): string {
  const width = options.width ?? 480;
  const height = options.height ?? 290;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const [x0, x1] = options.x.domain;
  const [y0, y1] = options.y.domain;
  const px = (v: number): number => PAD.left + ((v - x0) / (x1 - x0)) * innerW;
  const py = (v: number): number => PAD.top + (1 - (v - y0) / (y1 - y0)) * innerH;
  const fx = options.x.format ?? tidy;
  const fy = options.y.format ?? tidy;
  const out: string[] = [];

  for (const band of options.bands ?? []) {
    const left = px(Math.max(x0, band.from));
    const right = px(Math.min(x1, band.to));
    out.push(`<rect class="band" x="${trim(left)}" y="${PAD.top}" width="${trim(right - left)}" height="${innerH}"/>`);
    if (band.label) out.push(`<text class="note" x="${trim((left + right) / 2)}" y="${PAD.top + 12}" text-anchor="middle">${escape(band.label)}</text>`);
  }

  for (const t of options.y.ticks ?? niceTicks(y0, y1, 5)) {
    out.push(`<line class="grid" x1="${PAD.left}" x2="${PAD.left + innerW}" y1="${trim(py(t))}" y2="${trim(py(t))}"/>`);
    out.push(`<text class="tick" x="${PAD.left - 6}" y="${trim(py(t) + 3.5)}" text-anchor="end">${escape(fy(t))}</text>`);
  }
  for (const t of options.x.ticks ?? niceTicks(x0, x1, 7)) {
    out.push(`<line class="grid" x1="${trim(px(t))}" x2="${trim(px(t))}" y1="${PAD.top}" y2="${PAD.top + innerH}"/>`);
    out.push(`<text class="tick" x="${trim(px(t))}" y="${PAD.top + innerH + 15}" text-anchor="middle">${escape(fx(t))}</text>`);
  }

  for (const guide of options.horizontals ?? []) {
    out.push(`<line class="guide" x1="${PAD.left}" x2="${PAD.left + innerW}" y1="${trim(py(guide.at))}" y2="${trim(py(guide.at))}"/>`);
    if (guide.label) out.push(`<text class="note" x="${PAD.left + innerW - 4}" y="${trim(py(guide.at) - 4)}" text-anchor="end">${escape(guide.label)}</text>`);
  }
  for (const guide of options.verticals ?? []) {
    out.push(`<line class="guide" x1="${trim(px(guide.at))}" x2="${trim(px(guide.at))}" y1="${PAD.top}" y2="${PAD.top + innerH}"/>`);
    if (guide.label) out.push(`<text class="note" x="${trim(px(guide.at) + 4)}" y="${PAD.top + innerH - 6}">${escape(guide.label)}</text>`);
  }

  out.push(`<rect class="frame" x="${PAD.left}" y="${PAD.top}" width="${innerW}" height="${innerH}"/>`);

  for (const series of options.series) {
    const path = series.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${trim(px(x))} ${trim(py(Math.min(y1, Math.max(y0, y))))}`).join('');
    out.push(`<path class="line ${series.dashed ? 'dashed' : ''}" d="${path}" style="stroke:${series.colour}"/>`);
  }

  out.push(`<text class="axis" x="${PAD.left + innerW / 2}" y="${height - 6}" text-anchor="middle">${escape(options.x.label)}</text>`);
  out.push(`<text class="axis" transform="translate(13 ${PAD.top + innerH / 2}) rotate(-90)" text-anchor="middle">${escape(options.y.label)}</text>`);

  const legend = options.legend === false ? '' : keyOf(options.series);
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(options.label)}">${out.join('')}</svg>${legend}`;
}

export function areaChart(options: Omit<ChartOptions, 'series'> & { series: readonly Series[] }): string {
  const width = options.width ?? 480;
  const height = options.height ?? 290;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const [x0, x1] = options.x.domain;
  const [y0, y1] = options.y.domain;
  const px = (v: number): number => PAD.left + ((v - x0) / (x1 - x0)) * innerW;
  const py = (v: number): number => PAD.top + (1 - (v - y0) / (y1 - y0)) * innerH;
  const fx = options.x.format ?? tidy;
  const fy = options.y.format ?? tidy;
  const out: string[] = [];

  for (const t of options.y.ticks ?? niceTicks(y0, y1, 5)) {
    out.push(`<line class="grid" x1="${PAD.left}" x2="${PAD.left + innerW}" y1="${trim(py(t))}" y2="${trim(py(t))}"/>`);
    out.push(`<text class="tick" x="${PAD.left - 6}" y="${trim(py(t) + 3.5)}" text-anchor="end">${escape(fy(t))}</text>`);
  }
  for (const t of options.x.ticks ?? niceTicks(x0, x1, 7)) {
    out.push(`<text class="tick" x="${trim(px(t))}" y="${PAD.top + innerH + 15}" text-anchor="middle">${escape(fx(t))}</text>`);
  }

  const count = options.series[0]?.points.length ?? 0;
  const floor = new Array<number>(count).fill(0);
  for (const series of options.series) {
    const top = series.points.map(([, y], i) => floor[i]! + y);
    const upper = series.points.map(([x], i) => `${i === 0 ? 'M' : 'L'}${trim(px(x))} ${trim(py(Math.min(y1, top[i]!)))}`).join('');
    const lower = series.points
      .map((_, i) => `L${trim(px(series.points[count - 1 - i]![0]))} ${trim(py(Math.min(y1, floor[count - 1 - i]!)))}`)
      .join('');
    out.push(`<path class="area" d="${upper}${lower}Z" style="fill:${series.colour}"/>`);
    out.push(`<path class="edge" d="${upper}" style="stroke:${series.colour}"/>`);
    for (let i = 0; i < count; i += 1) floor[i] = top[i]!;
  }

  out.push(`<rect class="frame" x="${PAD.left}" y="${PAD.top}" width="${innerW}" height="${innerH}"/>`);
  out.push(`<text class="axis" x="${PAD.left + innerW / 2}" y="${height - 6}" text-anchor="middle">${escape(options.x.label)}</text>`);
  out.push(`<text class="axis" transform="translate(13 ${PAD.top + innerH / 2}) rotate(-90)" text-anchor="middle">${escape(options.y.label)}</text>`);

  const legend = options.legend === false ? '' : keyOf(options.series);
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(options.label)}">${out.join('')}</svg>${legend}`;
}

export const keyOf = (series: readonly Series[]): string =>
  `<ul class="key">${series
    .map((s) => `<li><i class="swatch ${s.dashed ? 'dashed' : ''}" style="--c:${s.colour}"></i>${escape(s.name)}</li>`)
    .join('')}</ul>`;

export function bars(rows: readonly { label: string; value: number; colour?: string; note?: string }[], max: number, format = trim): string {
  return `<div class="bars">${rows
    .map(
      (r) =>
        `<div class="bar"><span class="name">${escape(r.label)}</span><span class="track"><i style="width:${trim((100 * Math.min(r.value, max)) / max)}%;background:${r.colour ?? 'var(--ink)'}"></i></span><span class="val">${escape(r.note ?? format(r.value))}</span></div>`,
    )
    .join('')}</div>`;
}

export function samples(from: number, to: number, count: number, f: (x: number) => number): [number, number][] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const x = from + ((to - from) * i) / count;
    return [x, f(x)];
  });
}

export interface HeatmapOptions {
  width?: number;
  height?: number;
  x: Axis;
  y: Axis;
  columns: number;
  rows: number;
  colourAt: (x: number, y: number) => string;
  label: string;
}

export function heatmap(options: HeatmapOptions): string {
  const width = options.width ?? 480;
  const height = options.height ?? 330;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const [x0, x1] = options.x.domain;
  const [y0, y1] = options.y.domain;
  const px = (v: number): number => PAD.left + ((v - x0) / (x1 - x0)) * innerW;
  const py = (v: number): number => PAD.top + (1 - (v - y0) / (y1 - y0)) * innerH;
  const cellW = innerW / options.columns;
  const cellH = innerH / options.rows;
  const out: string[] = [];

  for (let row = 0; row < options.rows; row += 1) {
    const y = y1 - ((row + 0.5) / options.rows) * (y1 - y0);
    let start = 0;
    let colour = options.colourAt(x0 + (0.5 / options.columns) * (x1 - x0), y);
    for (let column = 1; column <= options.columns; column += 1) {
      const next = column < options.columns ? options.colourAt(x0 + ((column + 0.5) / options.columns) * (x1 - x0), y) : '';
      if (next === colour) continue;
      out.push(`<rect x="${trim(PAD.left + start * cellW)}" y="${trim(PAD.top + row * cellH)}" width="${trim((column - start) * cellW + 0.4)}" height="${trim(cellH + 0.4)}" fill="${colour}"/>`);
      start = column;
      colour = next;
    }
  }

  for (const t of options.y.ticks ?? niceTicks(y0, y1, 5)) {
    out.push(`<line class="gridline" x1="${PAD.left - 4}" x2="${PAD.left}" y1="${trim(py(t))}" y2="${trim(py(t))}"/>`);
    out.push(`<text class="tick" x="${PAD.left - 7}" y="${trim(py(t) + 3.5)}" text-anchor="end">${escape((options.y.format ?? tidy)(t))}</text>`);
  }
  for (const t of options.x.ticks ?? niceTicks(x0, x1, 7)) {
    out.push(`<line class="gridline" x1="${trim(px(t))}" x2="${trim(px(t))}" y1="${PAD.top + innerH}" y2="${PAD.top + innerH + 4}"/>`);
    out.push(`<text class="tick" x="${trim(px(t))}" y="${PAD.top + innerH + 16}" text-anchor="middle">${escape((options.x.format ?? tidy)(t))}</text>`);
  }
  out.push(`<rect class="frame" x="${PAD.left}" y="${PAD.top}" width="${innerW}" height="${innerH}"/>`);
  out.push(`<text class="axis" x="${PAD.left + innerW / 2}" y="${height - 6}" text-anchor="middle">${escape(options.x.label)}</text>`);
  out.push(`<text class="axis" transform="translate(13 ${PAD.top + innerH / 2}) rotate(-90)" text-anchor="middle">${escape(options.y.label)}</text>`);
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(options.label)}" shape-rendering="crispEdges">${out.join('')}</svg>`;
}

export const legend = (entries: readonly { name: string; colour: string }[]): string =>
  `<ul class="key">${entries.map((e) => `<li><i class="chip" style="--c:${e.colour}"></i>${escape(e.name)}</li>`).join('')}</ul>`;
