vec3 texture_burrow(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  float grain = texelHash(floor(pc), 17.0);
  float speck = 0.88 + 0.24 * step(0.72, grain);
  if (part == PATCH) return vec3(0.07, 0.05, 0.04);
  if (part == TAIL) return base * 0.55 * speck;
  if (part == FACE) return base * 1.38 * speck;
  if (part == HUMP) return base * 1.15 * speck;
  return base * 0.85 * speck;
}
