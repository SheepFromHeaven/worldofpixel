vec3 texture_brownbear(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == LEG || part == FAR) {
    float y = pc.y / size * 33.4;
    float t = clamp((y - 2.0) / 6.0 + (texelHash(floor(pc), 5.0) - 0.5) * 0.3, 0.0, 1.0);
    vec3 top = part == LEG ? base : fallback;
    return materialFur(mix(accent * 0.9, top, t), top * 1.25, pc, 0.14, 3.0);
  }
  if (part == EAR) return materialFur(fallback * 0.68, fallback * 0.8, pc, 0.1, 2.0);
  return materialFur(fallback, fallback * 1.3, pc, 0.14, 3.0);
}
