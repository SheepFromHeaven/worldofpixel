vec3 texture_gorilla(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == FACE) return mix(base, accent, 0.3);
  if (part == LEG || part == BODY || part == FAR) {
    float y = pc.y * 23.8 / size;
    float t = clamp((y - 0.5) / 9.0 + (texelHash(floor(pc), 5.0) - 0.5) * 0.3, 0.0, 1.0);
    return materialFur(mix(fallback * 0.8, fallback, t), accent, pc, 0.16, 3.0);
  }
  vec3 coat = part == HUMP && u < (texelHash(floor(pc), 3.0) - 0.5) * 2.4 ? accent : (part == HUMP ? base : fallback);
  return materialFur(coat, accent, pc, 0.16, 3.0);
}
