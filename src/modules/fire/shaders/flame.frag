#version 300 es
precision highp float;

uniform float uTime;
uniform vec3 uRamp[RAMP_STEPS];

flat in vec4 vFlame;
flat in vec4 vInfo;
in vec2 vWorld;

out vec4 outColour;

const float TEXELS = 16.0;
const float FLAME_HEIGHT = 0.72;
const float SPARKS = 4.0;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    sum += amplitude * vnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    amplitude *= 0.5;
  }
  return sum;
}

float bayer2(vec2 cell) {
  cell = floor(cell);
  return fract(cell.x / 2.0 + cell.y * cell.y * 0.75);
}

float dither(vec2 texel) {
  return bayer2(0.5 * texel) * 0.25 + bayer2(texel);
}

vec3 rampAt(float index) {
  int step = int(clamp(index, 0.0, float(RAMP_STEPS - 1)));
  return uRamp[step];
}

void main() {
  vec2 snapped = (floor(vWorld * TEXELS) + 0.5) / TEXELS;
  float id = vInfo.x;
  float dim = clamp(vInfo.y, 0.25, 1.25);
  float t = uTime + id * 7.31;

  vec2 wind = vFlame.zw;
  float speed = length(wind);
  float gale = clamp(speed / 12.0, 0.0, 1.0);
  float gust = 0.55 + 0.9 * vnoise(vec2(t * 0.8, id * 3.7));
  float push = clamp(speed * gust / 6.5, 0.0, 1.35);
  vec2 direction = speed > 0.01 ? wind / speed : vec2(0.0);
  vec2 lean = direction * push;

  float scale = vInfo.z;
  float head = vFlame.y - vInfo.w;
  float rise = (head - snapped.y) / scale;
  float across = (snapped.x - vFlame.x) / scale;

  float flick = 0.6 + 0.5 * vnoise(vec2(t * 7.0, id)) + 0.22 * vnoise(vec2(t * 26.0, id + 4.0)) + 0.25 * pow(vnoise(vec2(t * 2.3, id + 6.0)), 3.0) - 0.34 * push * vnoise(vec2(t * 12.0, id + 9.0));
  float tall = FLAME_HEIGHT * flick * (0.55 + 0.45 * dim) * (1.0 - 0.4 * push);

  float unit = clamp(rise / tall, 0.0, 1.4);
  float bend = min(unit, 1.0) * min(unit, 1.0);
  float sway = (fbm(vec2(t * 1.6, 3.0 + id)) - 0.5) * (0.55 + 0.9 * gale);
  float lap = (vnoise(vec2(rise * 4.5 - t * 8.0, id + 2.0)) - 0.5) * 0.24 * (0.4 + unit) * (1.0 + push);
  float x = across - (lean.x * 0.28 + 0.1 * sin(t * 5.0 + id)) * bend - sway * unit - lap;
  float lifted = rise + lean.y * 0.15 * bend;

  float height = clamp(lifted / tall, 0.0, 1.0);
  float bulb = 0.55 + 0.45 * sin(3.14159 * min(1.0, height * 2.4));
  float width = (scale > 1.0 ? 0.26 : 0.2) * pow(1.0 - height, 0.85) * bulb * (0.8 + 0.4 * dim);

  vec2 scroll = vec2(x * 7.5, lifted * 5.2 - t * 5.0 * (1.0 + 0.6 * gale));
  float body = fbm(scroll + vec2(id, 0.0));
  float fine = vnoise(vec2(x * 15.0 + t * 1.4, lifted * 9.0 - t * 7.0));
  float tongues = vnoise(vec2(x * 5.0 + id, lifted * 2.5 - t * 2.2));

  float core = 1.0 - abs(x) / max(width, 0.001);
  float heat = core * 1.08 - height * 0.42 + (body - 0.5) * (0.6 + 1.1 * height) + (fine - 0.5) * 0.4 * height + (tongues - 0.5) * 0.55 * height;
  heat -= (1.25 - dim) * 0.22;
  float below = smoothstep(-0.05, 0.03, rise);
  heat *= below * smoothstep(1.0, 0.72, height);

  vec2 texel = snapped * TEXELS;
  float grain = dither(texel);
  bool lit = heat > 0.07 + grain * 0.07;
  float floorStep = scale > 1.0 ? 2.0 : 0.0;
  float level = floorStep + clamp(heat, 0.0, 1.0) * (float(RAMP_STEPS - 1) - floorStep) + (grain - 0.5) * 0.9;
  vec3 colour = rampAt(floor(level + 0.5));
  float alpha = lit ? 1.0 : 0.0;

  for (float spark = 0.0; spark < SPARKS; spark += 1.0) {
    float seed = hash(vec2(id + spark * 3.1, spark * 5.7));
    float cycle = fract(t * (0.3 + 0.35 * seed + 0.3 * gale) + seed * 9.0);
    float alive = step(seed, 0.5 + 0.4 * gale);
    float climb = min(1.0, cycle * (0.45 + 0.8 * push + 0.5 * seed));
    float drift = lean.x * (0.45 * cycle) + (seed - 0.5) * 0.35 + sin(cycle * 11.0 + seed * 20.0) * 0.07;
    vec2 at = vec2(vFlame.x + drift * scale, head - (0.15 + climb) * scale);
    at += vec2(0.0, lean.y * 0.2 * cycle * scale);
    vec2 cell = (floor(at * TEXELS) + 0.5) / TEXELS;
    vec2 gap = abs(snapped - cell);
    float hit = step(max(gap.x, gap.y), 0.5 / TEXELS + 0.001) * alive * step(cycle, 0.92);
    if (hit > 0.5) {
      colour = rampAt(float(RAMP_STEPS - 1) - floor(cycle * 3.0));
      alpha = 1.0;
    }
  }

  if (alpha < 0.5) discard;
  outColour = vec4(colour, 1.0);
}
