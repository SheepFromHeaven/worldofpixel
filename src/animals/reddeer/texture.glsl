vec3 texture_reddeer(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  return deerCoat(part, pc, base, accent, fallback, young, size, 0.0, vec3(0.42, 0.31, 0.2));
}
