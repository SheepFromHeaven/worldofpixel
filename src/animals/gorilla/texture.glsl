vec3 texture_gorilla(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback) {
  if (part == FACE) return mix(base, accent, 0.3);
  vec3 coat = part == HUMP && u < (texelHash(floor(pc), 3.0) - 0.5) * 2.4 ? accent : (part == HUMP ? base : fallback);
  return materialFur(coat, accent, pc, 0.16, 3.0);
}
