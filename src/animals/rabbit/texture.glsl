vec3 texture_rabbit(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == TAIL) return accent;
  if (part == EAR) return materialFur(mix(fallback, accent, 0.2), accent, pc, 0.1, 2.0);
  return materialFur(fallback, accent, pc, 0.12, 2.0);
}
