vec3 materialFur(vec3 base, vec3 accent, vec2 pc, float grain, float tuft) {
  vec2 cell = floor(pc);
  float strand = texelHash(cell, 11.0);
  float clump = texelHash(floor(cell / max(1.0, tuft)), 17.0);
  float shade = (strand - 0.5) * grain + (clump - 0.5) * grain * 0.6;
  vec3 tone = base * (1.0 + shade);
  return mix(tone, accent, step(0.96, strand) * 0.3);
}
