float preciseHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float preciseNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(preciseHash(i), preciseHash(i + vec2(1.0, 0.0)), f.x), mix(preciseHash(i + vec2(0.0, 1.0)), preciseHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float preciseFbm(vec2 p) {
  float amount = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 4; i += 1) {
    sum += amount * preciseNoise(p);
    p *= 2.03;
    amount *= 0.5;
  }
  return sum / 0.9375;
}

vec4 tint(vec3 colour, float alpha) {
  return vec4(colour * alpha, alpha);
}

float rings(vec2 w, float rate, float seconds) {
  float total = 0.0;
  for (int layer = 0; layer < 2; layer += 1) {
    float size = layer == 0 ? 0.85 : 1.35;
    vec2 shifted = w / size + float(layer) * 0.37;
    vec2 id = floor(shifted);
    vec2 local = shifted - id;
    float gate = step(preciseHash(id + 77.0 + float(layer) * 19.0), rate);
    float h = preciseHash(id + float(layer) * 31.0);
    float h2 = preciseHash(id.yx + 5.0 + float(layer) * 13.0);
    float age = fract(seconds / (1.1 + 0.7 * h2) + h);
    vec2 centre = vec2(0.25 + 0.5 * preciseHash(id + 3.3), 0.25 + 0.5 * preciseHash(id + 8.1));
    float r = length(local - centre) * size;
    float ring = step(abs(r - age * 0.4), 0.05) * (1.0 - age);
    float splash = step(r, 0.07) * step(age, 0.1);
    total = max(total, gate * max(ring, splash));
  }
  return total;
}

uniform sampler2D uGround;

float painted(vec2 shift) {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y) + shift;
  vec4 c = texture(uGround, clamp(at / uBuffer, 0.0, 1.0));
  return step(0.12, c.b - c.r);
}

float shoreDistance(float reach) {
  return 1.0 - painted(vec2(reach, 0.0)) * painted(vec2(-reach, 0.0)) * painted(vec2(0.0, reach)) * painted(vec2(0.0, -reach));
}

float temperatureAt(vec2 w) {
  return fieldAt(w).r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
}

vec3 bedAt(vec2 bed) {
  vec2 cell = floor(bed / 0.34);
  float pebble = preciseHash(cell + 3.0);
  float sand = preciseNoise(bed * 1.6 + 9.0);
  vec3 colour = mix(vec3(0.56, 0.5, 0.38), vec3(0.32, 0.3, 0.26), step(0.55, pebble));
  return mix(colour, vec3(0.72, 0.66, 0.5), step(0.78, sand) * 0.7);
}

vec3 waterThrough(vec3 bedColour, float absorb, float sea) {
  vec3 shallow = bedColour * vec3(0.62, 0.95, 1.05) + vec3(0.04, 0.12, 0.16);
  vec3 deep = mix(vec3(0.07, 0.27, 0.42), vec3(0.03, 0.21, 0.4), sea);
  return mix(shallow, deep, absorb);
}

