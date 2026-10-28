vec3 calfSpots(vec3 coat, vec2 pc, float amount) {
  vec2 grid = pc / 2.6;
  vec2 id = floor(grid);
  vec2 local = fract(grid) - 0.5;
  if (texelHash(id, 9.0) > 0.4) return coat;
  vec2 centre = (vec2(texelHash(id, 7.0), texelHash(id, 8.0)) - 0.5) * 0.35;
  float soft = floor(smoothstep(0.46, 0.1, length(local - centre)) * 3.0 + 0.5) / 3.0;
  return mix(coat, mix(coat, vec3(0.93, 0.86, 0.72), 0.7), soft * 0.65 * amount);
}

vec3 deerCoat(float part, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size, float adultSpots, vec3 horn) {
  if (part == HORN) return horn;
  float spots = young > 0.5 ? 1.0 : adultSpots;
  if (part == LEG || part == FAR) {
    float y = pc.y / size * 36.6;
    float t = clamp((y - 5.0) / 8.0 + (texelHash(floor(pc), 5.0) - 0.5) * 0.3, 0.0, 1.0);
    vec3 top = part == LEG ? base : fallback;
    vec3 coat = mix(top * 0.6, top, t);
    if (spots > 0.0 && t > 0.7) coat = calfSpots(coat, pc, spots);
    return materialFur(coat, coat, pc, 0.1, 3.0);
  }
  if (part == TAIL) return accent;
  if (part == EAR) return materialFur(fallback * 0.85, fallback * 0.85, pc, 0.1, 2.0);
  vec3 coat = spots > 0.0 && part == BODY ? calfSpots(fallback, pc, spots) : fallback;
  return materialFur(coat, coat, pc, 0.1, 3.0);
}
