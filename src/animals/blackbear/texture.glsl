vec3 texture_blackbear(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == FACE) return materialFur(accent * 0.8, accent, pc, 0.12, 2.0);
  if (part == EAR) return materialFur(fallback * 0.85, fallback, pc, 0.1, 2.0);
  float top = clamp((pc.y / size * 27.0 - 7.0) / 6.0, 0.0, 1.0);
  return materialFur(fallback * (1.0 + 0.9 * top), accent * 0.5, pc, 0.3, 2.0);
}
