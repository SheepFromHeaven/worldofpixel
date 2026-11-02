vec3 materialScales(vec3 base, vec3 accent, vec2 pc, float size) {
  vec2 q = pc / max(1.0, size);
  q.x += 0.5 * mod(floor(q.y), 2.0);
  vec2 f = fract(q) - 0.5;
  vec3 tone = mix(base, accent, texelHash(floor(q), 23.0) * 0.35);
  return length(f) > 0.42 ? tone * 0.72 : tone;
}
