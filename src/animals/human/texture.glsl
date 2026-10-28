vec3 texture_human(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == HUMP) return accent;
  if (part == FAR) return base * 0.9;
  if (part == EAR) return base * 0.92;
  return base;
}
