vec3 texture_robin(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == FACE) return accent;
  if (part == BILL) return vec3(0.16, 0.13, 0.11);
  if (part == WING) return base * 0.88;
  if (part == TAIL) return base * 0.94;
  if (part == BODY) return u < 0.0 ? accent : mix(base * 1.05, vec3(0.86, 0.82, 0.72), step(0.55, pc.y));
  return base;
}
