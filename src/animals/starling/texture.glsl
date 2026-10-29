vec3 texture_starling(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == BILL) return vec3(0.85, 0.7, 0.2);
  if (part == WING) return base * 1.5;
  if (part == TAIL) return base * 1.4;
  if (part == BODY || part == HEAD) return texelHash(floor(pc), 3.0) < 0.2 ? accent : base * 1.7;
  return base;
}
