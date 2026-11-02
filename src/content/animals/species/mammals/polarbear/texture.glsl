vec3 texture_polarbear(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == LEG || part == FAR) {
    float y = pc.y / size * 38.2;
    float t = clamp((y - 2.0) / 8.0 + (texelHash(floor(pc), 5.0) - 0.5) * 0.3, 0.0, 1.0);
    vec3 top = part == LEG ? base : base * 0.9;
    return materialFur(mix(top * 0.94, top, t), top * 0.95, pc, 0.08, 3.0);
  }
  if (part == EAR) return materialFur(fallback * 0.9, fallback, pc, 0.08, 2.0);
  return materialFur(fallback, accent, pc, 0.08, 3.0);
}
