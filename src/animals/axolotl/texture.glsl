vec3 texture_axolotl(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback) {
  if (part == EAR) return accent;
  if (part == TAIL) return mix(fallback, accent, 0.25);
  return fallback;
}
