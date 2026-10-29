vec3 texture_owl(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {
  float fleck = texelHash(floor(pc), 7.0);
  if (part == PATCH) return vec3(0.04, 0.03, 0.03);
  if (part == FACE) return mix(accent * 0.95, base * 1.1, step(0.82, fleck));
  if (part == BILL) return vec3(0.72, 0.64, 0.42);
  if (part == HEAD) return mix(base * 0.9, base * 0.7, step(0.75, fleck));
  if (part == WING) return mix(base * 0.85, accent * 0.8, step(0.72, fleck));
  if (part == TAIL) return mix(base * 0.8, accent * 0.7, step(0.55, fract(pc.x * 0.5)));
  return mix(base, accent * 0.85, step(0.7, fleck));
}
