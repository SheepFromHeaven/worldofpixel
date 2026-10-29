vec3 texture_sparrow(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == HEAD) return vec3(0.3, 0.3, 0.34);
  if (part == HUMP) return vec3(0.66, 0.62, 0.54);
  if (part == FACE) return vec3(0.78, 0.7, 0.58);
  if (part == BILL) return vec3(0.16, 0.13, 0.11);
  if (part == WING) return mix(base * 0.68, base * 0.95, step(0.5, texelHash(floor(pc), 5.0)));
  if (part == TAIL) return base * 0.8;
  if (part == BODY) return u < 0.0 ? vec3(0.1, 0.09, 0.09) : mix(base, vec3(0.62, 0.58, 0.5), step(0.55, pc.y));
  return base;
}
