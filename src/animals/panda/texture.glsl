vec3 texture_panda(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == TUSK) return vec3(0.45, 0.62, 0.25) * (0.85 + 0.3 * texelHash(floor(pc), 3.0));
  if (part == LEG || part == FAR || part == EAR || part == FACE || part == HUMP) return materialFur(accent, accent * 1.6, pc, 0.1, 3.0);
  return materialFur(base, base * 0.9, pc, 0.08, 3.0);
}
