vec3 texture_aardvarkburrow(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  float grain = texelHash(floor(pc), 17.0);
  float clod = texelHash(floor(pc * 0.5), 29.0);
  vec3 soil = base * (0.9 + 0.2 * clod);
  vec3 stone = vec3(0.6, 0.55, 0.48) * (0.85 + 0.3 * grain);
  if (part == PATCH) return vec3(0.06, 0.045, 0.035);
  if (part == TAIL) return base * 0.5;
  float lift = part == FLOOR ? 0.78 : part == FACE ? 1.35 : part == HUMP ? 1.15 : 0.85;
  if (grain > 0.88) return stone * (0.8 + 0.2 * lift);
  if (grain < 0.08) return soil * lift * 0.7;
  return soil * lift;
}
