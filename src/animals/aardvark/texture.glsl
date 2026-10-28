vec3 texture_aardvark(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  if (part == EAR) return accent;
  return materialFur(fallback, accent, pc, 0.1, 4.0);
}
