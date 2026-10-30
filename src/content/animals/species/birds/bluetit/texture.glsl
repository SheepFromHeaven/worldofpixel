vec3 texture_bluetit(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == HEAD) return accent;
  if (part == FACE) return vec3(0.92, 0.92, 0.88);
  if (part == BILL) return vec3(0.16, 0.14, 0.12);
  if (part == WING) return accent * 0.85;
  if (part == TAIL) return accent * 0.8;
  if (part == BODY) return u < 0.0 ? vec3(0.9, 0.78, 0.22) : base;
  return base;
}
