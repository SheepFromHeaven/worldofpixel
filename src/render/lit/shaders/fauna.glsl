uniform sampler2D uFauna;
uniform vec4 uFaunaRect;

vec2 faunaUv(int species, vec2 world, float side) {
  vec2 uv = (world - uFaunaRect.xy) / uFaunaRect.zw;
  uv = clamp(uv, vec2(0.5 / FAUNA_COLUMNS, 0.5 / FAUNA_ROWS), vec2(1.0 - 0.5 / FAUNA_COLUMNS, 1.0 - 0.5 / FAUNA_ROWS));
  return vec2(uv.x * 0.5 + side, (float(species) + uv.y) / FAUNA_SPECIES);
}

vec4 faunaLevels(int species, vec2 world) {
  return texture(uFauna, faunaUv(species, world, 0.0));
}

vec4 faunaSuits(int species, vec2 world) {
  return texture(uFauna, faunaUv(species, world, 0.5));
}

float faunaFill(int species, vec2 world) {
  return faunaLevels(species, world).r * 255.0 / FAUNA_FILL_SCALE;
}

float faunaDensity(float level) {
  float b = level * 255.0;
  if (b < 1.0) return b * pow(10.0, FAUNA_LOG_MIN);
  return pow(10.0, FAUNA_LOG_MIN + (b - 1.0) / 254.0 * (FAUNA_LOG_MAX - FAUNA_LOG_MIN));
}
