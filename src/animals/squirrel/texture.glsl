vec3 texture_squirrel(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == TAIL) return materialFur(base * 1.06, base * 1.06, pc, 0.2, 2.0);
  if (part == EAR) return materialFur(base * 0.8, base * 0.8, pc, 0.1, 2.0);
  return materialFur(base, base, pc, 0.12, 2.0);
}
