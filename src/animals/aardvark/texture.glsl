vec3 texture_aardvark(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == TUSK) return vec3(0.5, 0.38, 0.24) * (0.8 + 0.4 * texelHash(floor(pc), 7.0));
  if (part == EAR) return accent;
  if (part == LEG || part == FAR) {
    float y = pc.y / size * 20.6;
    float t = clamp((y - 0.5) / 3.5 + (texelHash(floor(pc), 5.0) - 0.5) * 0.3, 0.0, 1.0);
    vec3 top = part == LEG ? base : fallback;
    return materialFur(mix(top * 0.78, top, t), accent, pc, 0.1, 4.0);
  }
  return materialFur(fallback, accent, pc, 0.1, 4.0);
}
