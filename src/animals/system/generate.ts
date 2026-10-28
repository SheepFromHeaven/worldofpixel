import type { AnimalModel, At, Flex, Gait, Limb, Part, Shape, Tilt, Tilts, Vec3 } from '../model.ts';
import { isPoint, isReach } from '../model.ts';

export type Target = 'game' | 'view';

const GROWN = 0.06;

let growing: Part['grows'] | undefined;

let tilting: readonly Tilt[] = [];

let tiltName = '';

const whole = (expression: string, target: Target): string => (target === 'game' ? `floor(${expression} + 0.5)` : expression);

const num = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : `${value}`);

const vec = (value: Vec3): string => `vec3(${num(value[0])}, ${num(value[1])}, ${num(value[2])})`;

const placed = (value: Vec3): string => (growing ? `(${vec(growing.anchor)} + (${vec(value)} - ${vec(growing.anchor)}) * gs)` : vec(value));

const sized = (scale: string): string => (growing ? `(${scale} * (0.5 + 0.5 * gs))` : scale);

const anchorOf = (shape: Shape): At => ('ellipsoid' in shape ? shape.ellipsoid : shape.limb[0]);

const flexTerms = (flex: Flex | readonly Flex[] | undefined, target: Target): string[] =>
  flex === undefined ? [] : ([] as Flex[]).concat(flex).map((one) => whole(`vec3(pose[${one.by}] * ${num(one.x ?? 0)}, ${one.y === undefined ? '0.0' : `pose[${one.by}] * ${num(one.y)} * lat`}, pose[${one.by}] * ${num(one.z ?? 0)}) * L`, target));

const tiltList = (tilts: Tilts | undefined): readonly Tilt[] => (tilts === undefined ? [] : ([] as Tilt[]).concat(tilts));

const turnWith = (expression: string, tilt: Tilt, pivot: string, c: string, s: string): string => `${tilt.axis === 'yaw' ? 'turnAbout' : 'tiltAbout'}(${expression}, ${vec(tilt.pivot)} * ${pivot} + rise, ${c}, ${s})`;

const tilted = (expression: string): string => tilting.reduce((inner, tilt, at) => turnWith(inner, tilt, 'sides', `tc${tiltName}_${at}`, `ts${tiltName}_${at}`), expression);

const pointExpr = (at: At, target: Target): string => {
  if (!isPoint(at)) return tilted(`${placed(at)} * sides + rise`);
  const parts = [`${placed(at.at)} * sides`];
  parts.push(at.grounded ? 'dig' : 'rise');
  const calm = at.still === undefined ? '' : ` * (1.0 - pose[${at.still}])`;
  if (at.swing !== undefined) parts.push(`vec3(swing * ${num(at.swing)}${calm}, 0.0, 0.0)`);
  if (at.lift !== undefined) parts.push(`vec3(0.0, 0.0, up * ${num(at.lift)}${calm})`);
  parts.push(...flexTerms(at.flex, target));
  return tilted(parts.join(' + '));
};

const baseOf = (at: At): Vec3 => (isPoint(at) ? at.at : at);

const anchorExpr = (shape: Shape, lat: string): string => `${vec(baseOf(anchorOf(shape)))} * vec3(L, ${lat} * L, L) + rise`;

const radiusExpr = (value: number, floor: number | undefined, scale: string, target: Target): string => {
  const raw = `${num(value)} * ${scale}`;
  return target === 'game' && floor !== undefined ? `max(${num(floor)}, ${raw})` : raw;
};

const limbExpr = (shape: Limb, target: Target): string => {
  const [from, end] = shape.limb;
  const start = pointExpr(from, target);
  const reach = isReach(end) ? `(${end.param} * L * ${num(end.k)})` : 'L';
  const stop = isReach(end)
    ? `${start} + ${vec(end.dir)} * vec3(1.0, lat, 1.0) * ${reach}${end.sway ? ` + ${vec(end.sway)} * swayT` : ''}`
    : pointExpr(end, target);
  const scale = shape.radiiBy === 'reach' ? reach : sized('L');
  const r1 = radiusExpr(shape.radii[0], shape.floor?.[0], scale, target);
  const r2 = radiusExpr(shape.radii[1], shape.floor?.[1], scale, target);
  return target === 'game' ? `limb(k, p, ${start}, ${stop}, ${r1}, ${r2})` : `limb(p, ${start}, ${stop}, ${r1}, ${r2})`;
};

const shapeExpr = (shape: Shape, target: Target): string => {
  if ('limb' in shape) return limbExpr(shape, target);
  const radii = `${vec(shape.radii)} * ${sized('L')}`;
  return target === 'game' ? `blob(k, p, ${pointExpr(shape.ellipsoid, target)}, ${radii})` : `blob(p, ${pointExpr(shape.ellipsoid, target)}, ${radii})`;
};

const unionExpr = (shapes: readonly string[]): string => shapes.reduce((sum, one) => (sum === '' ? one : `min(${sum}, ${one})`), '');

const phasesOf = (part: Part, states: readonly string[], side: 0 | 1): { c: string; s: string } => {
  const angle = (name: string | null): number => {
    const over = name === null ? undefined : part.states?.[name];
    const phase = over?.phase ?? part.phase ?? 0;
    const stagger = over?.stagger ?? part.stagger ?? Math.PI;
    return phase + (side === 1 ? stagger : 0);
  };
  const names = Object.keys(part.states ?? {});
  const chain = (fn: (a: number) => number): string =>
    names.reduce((rest, name) => {
      const id = states.indexOf(name);
      if (id < 0) throw new Error(`part has a pose for state '${name}' that its animal does not declare`);
      return `(state == ${num(id)} ? ${num(fn(angle(name)))} : ${rest})`;
    }, num(fn(angle(null))));
  return { c: chain(Math.cos), s: chain(Math.sin) };
};

const partCode = (part: Part, index: number, target: Target, states: readonly string[]): string => {
  growing = part.grows;
  tilting = tiltList(part.tilt);
  tiltName = String(index);
  const first = part.shapes[0]!;
  const sides = part.mirror ? 2 : 1;
  const distance = unionExpr(part.shapes.map((shape) => shapeExpr(shape, target)));
  const lines: string[] = [];
  const conditions: string[] = [];
  if (part.when) conditions.push(`grow ${part.when === 'grown' ? '>' : '<='} ${num(GROWN)}`);
  if (part.only) {
    const ids = part.only.map((name) => {
      const id = states.indexOf(name);
      if (id < 0) throw new Error(`part is only drawn in state '${name}' that its animal does not declare`);
      return `state == ${num(id)}`;
    });
    conditions.push(`(${ids.join(' || ')})`);
  }
  if (conditions.length > 0) lines.push(`  if (${conditions.join(' && ')}) {`);
  if (part.grows) lines.push(`  float gs = clamp(grow / ${num(part.grows.full)}, 0.0, 1.0);`);
  tilting.forEach((tilt, at) => lines.push(`  float ta${index}_${at} = pose[${tilt.by}] * ${num(tilt.max)};\n  float tc${index}_${at} = cos(ta${index}_${at});\n  float ts${index}_${at} = sin(ta${index}_${at});`));
  lines.push(`  for (int side = 0; side < ${sides}; side++) {`);
  const p0 = phasesOf(part, states, 0);
  const p1 = phasesOf(part, states, 1);
  lines.push('    float lat = side == 0 ? 1.0 : -1.0;');
  lines.push(`    float pc = side == 0 ? ${p0.c} : ${p1.c};`);
  lines.push(`    float ps = side == 0 ? ${p0.s} : ${p1.s};`);
  const held = (part.still ?? []).map((name) => {
    const id = states.indexOf(name);
    if (id < 0) throw new Error(`part holds still in state '${name}' that its animal does not declare`);
    return `state == ${num(id)}`;
  });
  const hold = held.length > 0 ? ` * (${held.join(' || ')} ? 0.0 : 1.0)` : '';
  lines.push(`    float swing = ${whole(`(sp * pc + cp * ps) * amp${hold}`, target)};`);
  lines.push(`    float up = ${whole(`max(0.0, cp * pc - sp * ps) * lift${hold}`, target)};`);
  lines.push('    vec3 sides = vec3(L, lat * L, L);');
  lines.push(`    float d${index} = ${distance};`);
  if (part.blend && target === 'game') lines.push(`    float s${index} = ${distance.replaceAll('k, p,', 'k, p + SHADOW_STEP,')};`);
  if (part.emboss && target === 'game') {
    lines.push(`    float t${index} = ${distance.replaceAll('k, p,', `k, p + SHADOW_STEP * ${num(part.emboss)},`)};`);
    lines.push(`    float a${index} = ${distance.replaceAll('k, p,', `k, p - SHADOW_STEP * ${num(part.emboss)},`)};`);
    lines.push(`    if (d${index} < 0.0) emb = t${index} >= 0.0 ? 1.0 : (a${index} >= 0.0 ? -1.0 : 0.0);`);
  }
  if (target === 'view') {
    lines.push(`    res = add(res, d${index}, ${part.kind});`);
  } else {
    const self = anchorExpr(first, 'lat');
    const other = anchorExpr(first, '-lat');
    const own = `nearness(k, ${self})`;
    const depth = part.depth === 'head' ? `headDepth + ${num(part.bias ?? 0)} * L` : part.depth === 'self' ? (part.behind ? `(${own} < nearness(k, ${other}) - 0.01 * L ? -1.0 * L : ${own})` : part.bias ? `(${own} + ${num(part.bias)} * L)` : own) : `${num(part.bias ?? 0)} * L`;
    const id = part.far ? `(nearness(k, ${self}) < nearness(k, ${other}) - 0.01 * L ? FAR : ${part.kind})` : part.kind;
    if (part.inked) lines.push(`    inkSdf = min(inkSdf, d${index});`);
    const draw = `${part.blend ? `DRAW_BLEND(o, d${index}, s${index}, ${depth}, ${id});` : `DRAW(o, d${index}, ${depth}, ${id});`}`;
    lines.push(part.standing ? `    if (!lying) ${draw}` : `    ${draw}`);
  }
  lines.push('  }');
  if (conditions.length > 0) lines.push('  }');
  growing = undefined;
  tilting = [];
  return lines.join('\n');
};

const pick = (model: AnimalModel, states: readonly string[], field: keyof Gait): string => {
  const base = model.gait[field] ?? (field === 'stride' ? 1 : 0);
  const value = (gait: Partial<Gait>): number => Number(gait[field] ?? base);
  const overrides = Object.entries(model.states ?? {}).filter(([, gait]) => gait[field] !== undefined && value(gait) !== Number(base));
  return overrides.reduce((rest, [name, gait]) => {
    const id = states.indexOf(name);
    if (id < 0) throw new Error(`model has a gait for state '${name}' that its animal does not declare`);
    return `(state == ${num(id)} ? ${num(value(gait))} : ${rest})`;
  }, num(Number(base)));
};

const driven = (model: AnimalModel, states: readonly string[]): string => {
  if (!model.driven) return '';
  const id = states.indexOf(model.driven.state);
  if (id < 0) throw new Error(`model is driven in state '${model.driven.state}' that its animal does not declare`);
  return `  if (state == ${num(id)}) {\n    ph = pose[${model.driven.phase}];\n    moving = max(moving, pose[${model.driven.amount}]);\n  }`;
};

const prelude = (model: AnimalModel, states: readonly string[], target: Target): string => {
  const legs = model.gait.byLegs ? ' * legs' : '';
  const lines = [
    '  float sp = sin(ph);',
    '  float cp = cos(ph);',
    `  float amp = ${pick(model, states, 'swing')} * L${legs} * moving;`,
    `  float lift = ${pick(model, states, 'lift')} * L * moving;`,
    `  float bob = ${whole(`moving > 0.3 ? ${pick(model, states, 'bob')} * L * mix(abs(sin(ph * 0.5)), 0.5 - 0.5 * cos(ph + ${pick(model, states, 'bobPhase')}), ${pick(model, states, 'bobShape')}) : 0.0`, target)};`,
    `  float roll = ${whole(`moving > 0.3 ? ${pick(model, states, 'roll')} * L * sp : 0.0`, target)};`,
    `  float swayT = ${whole('0.07 * L * sin(clk * 1.9 + seed * 6.0) * (0.3 + moving)', target)};`,
  ];
  lines.push(`  float sink = ${whole(`pose[3] * ${num(model.sink ?? 0)} * L`, target)};`);
  lines.push(`  vec3 dig = vec3(${whole(`pose[2] * ${num(model.slide ?? 0)} * L`, target)}, 0.0, -sink${model.drop ? ` - pose[${model.drop.by}] * ${num(model.drop.z)} * L` : ''});`);
  lines.push(target === 'game' ? `  vec3 rise = vec3(0.0, roll, lying ? -${num(model.lying)} * L : bob) + dig;` : '  vec3 rise = vec3(0.0, roll, bob) + dig;');
  return lines.join('\n');
};

export const profileGlsl = (key: string, model: AnimalModel, states: readonly string[]): string => {
  const headTilts = tiltList(model.headTilt);
  const headTurn = (expression: string): string => headTilts.reduce((inner, tilt, at) => turnWith(inner, tilt, 'vec3(L)', `hc${at}`, `hs${at}`), expression);
  const headAngle = headTilts.map((tilt, at) => `  float ha${at} = pose[${tilt.by}] * ${num(tilt.max)};\n  float hc${at} = cos(ha${at});\n  float hs${at} = sin(ha${at});`).join('\n');
  const eyeShift = flexTerms(model.eyeFlex, 'game').map((term) => ` + ${term}`).join('');
  const parts = model.parts.map((part, index) => partCode(part, index, 'game', states)).join('\n');
  const inked = [...new Set(model.parts.filter((part) => part.inked).map((part) => part.kind))];
  const marked = model.parts.find((part) => part.mark);
  const eye = model.eyes
    ? `  for (int side = 0; side < 2; side++) {
    vec3 eyeAt = ${headTurn(`${vec(model.eyes)} * vec3(L, (side == 0 ? 1.0 : -1.0) * L, L) + rise${eyeShift}`)};
    if (L >= 10.0 && nearness(k, eyeAt) > headDepth + 0.005 * L) o.eye = min(o.eye, length(p - seen(k, eyeAt)) - 0.55);
  }`
    : '';
  const noseAt = model.nose ? headTurn(`${vec(model.nose)} * L + rise${eyeShift}`) : '';
  const nose = model.nose ? `  if (L >= 16.0 && nearness(k, ${noseAt}) >= headDepth - 0.01 * L) o.nose = length(p - seen(k, ${noseAt})) - 0.75;` : '';
  return `Beast profile_${key}(vec2 p, float heading, float L, float legs, float tail, float ears, float leg, float moving, float clk, float seed, float posture, float state, vec4 pose, float grow) {
  Look k = lookAt(heading);
  bool lying = posture > 1.5 && posture < 2.5;
  float ph = leg / max(2.0, 0.55 * L * (0.5 + 0.5 * legs) * ${pick(model, states, 'stride')}) * TAU;
${driven(model, states)}
${prelude(model, states, 'game')}
  Beast o;
  o.edge = 1e3;
  o.part = BODY;
  o.pc = p;
  o.eye = 1.0;
  o.nose = 1.0;
  o.u = p.x / L;
  o.shade = 0.0;
  float top = 1e3;
  float best = -1e9;
  float ce = 1e3;
  float cd = -1e9;
  float emb = 0.0;
  float inkSdf = 1e3;
  float headDepth = nearness(k, ${vec(model.head)} * L + rise);
${parts}
${headAngle}
  if (top < 0.0) o.edge = top;
  if (cd > best) o.shade = ce < 0.9 ? 2.0 : 1.0;
${[...new Set(model.parts.filter((part) => part.emboss).map((part) => part.kind))].map((kind) => `  if (o.part == ${kind}) o.shade = emb * 2.0;`).join('\n')}
${inked.length ? `  if ((${inked.map((kind) => `o.part == ${kind}`).join(' || ')}) && inkSdf > -1.1) o.part = FAR;` : ''}
${marked && model.mark ? `  if (o.part == ${marked.kind}) o.u = blob(k, p, ${vec(model.mark.at)} * L + rise, ${vec(model.mark.radii)} * L);` : ''}
${eye}
${nose}
  return o;
}
`;
};

export const creatureGlsl = (key: string, model: AnimalModel, states: readonly string[]): string => {
  const headTilts = tiltList(model.headTilt);
  const headTurn = (expression: string): string => headTilts.reduce((inner, tilt, at) => turnWith(inner, tilt, 'vec3(L)', `hc${at}`, `hs${at}`), expression);
  const headAngle = headTilts.map((tilt, at) => `  float ha${at} = pose[${tilt.by}] * ${num(tilt.max)};\n  float hc${at} = cos(ha${at});\n  float hs${at} = sin(ha${at});`).join('\n');
  const eyeShiftView = flexTerms(model.eyeFlex, 'view').map((term) => ` + ${term}`).join('');
  const parts = model.parts.map((part, index) => partCode(part, index, 'view', states)).join('\n');
  const eye = model.eyes
    ? `  for (int side = 0; side < 2; side++) {
    res = add(res, length(p - ${headTurn(`${vec(model.eyes)} * vec3(L, (side == 0 ? 1.0 : -1.0) * L, L) + rise${eyeShiftView}`)}) - 0.012 * L, EYE);
  }`
    : '';
  const mark = model.mark ? `blob(at, ${vec(model.mark.at)} * uBody.x, ${vec(model.mark.radii)} * uBody.x)` : '1000.0';
  return `vec3 defaultColour(float id) {
  if (id == LEG) return uColour * 0.84;
  if (id == TAIL) return uColour * 0.96;
  if (id == HUMP) return uColour * 1.08;
  return uColour;
}

vec2 creature(vec3 p) {
  float L = uBody.x;
  float legs = uBody.y;
  float tail = uBody.z;
  float ears = uBody.w;
  float moving = uWalk;
  float clk = uTime;
  float seed = 0.0;
  float ph = uPhase;
  float state = uState;
  vec4 pose = uPose;
  float grow = 1.0;
${prelude(model, states, 'view')}
  vec2 res = vec2(1e3, BODY);
${parts}
${headAngle}
${eye}
  return res;
}

vec3 animalColour(float id, vec3 at, vec3 normal) {
  float u = ${mark} * ${num(16)};
  return texture_${key}(id, u, floor(at.xy * 16.0), uColour, uAccent, defaultColour(id), 0.0, uBody.x * 16.0 + 3.0);
}
`;
};
