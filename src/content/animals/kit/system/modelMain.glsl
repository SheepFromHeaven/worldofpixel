vec2 mapAll(vec3 p) {
  vec2 c = creature(p);
  return p.z < c.x ? vec2(p.z, FLOOR) : c;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0012;
  return normalize(e.xyy * mapAll(p + e.xyy).x + e.yyx * mapAll(p + e.yyx).x + e.yxy * mapAll(p + e.yxy).x + e.xxx * mapAll(p + e.xxx).x);
}

float shadowOf(vec3 p, vec3 light) {
  float shade = 1.0;
  float t = 0.02;
  for (int i = 0; i < 28; i++) {
    float h = creature(p + light * t).x;
    shade = min(shade, 8.0 * h / t);
    t += clamp(h, 0.01, 0.12);
    if (shade < 0.02 || t > 3.0) break;
  }
  return clamp(shade, 0.0, 1.0);
}

float bands(float v) {
  return floor(clamp(v, 0.0, 0.999) * 5.0) / 4.0;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uOrigin - 0.5 * uRes) / uRes.y;
  float yaw = uCam.x;
  float pitch = uCam.y;
  vec3 target = vec3(0.0, 0.0, uBody.x * 0.3);
  vec3 eye = target + uCam.z * vec3(cos(pitch) * cos(yaw), cos(pitch) * sin(yaw), sin(pitch));
  vec3 fw = normalize(target - eye);
  vec3 rt = normalize(cross(vec3(0.0, 0.0, 1.0), fw));
  vec3 up = cross(fw, rt);
  vec3 ray = normalize(fw * 1.6 + rt * uv.x + up * uv.y);

  vec3 sky = mix(vec3(0.93, 0.9, 0.84), vec3(0.8, 0.85, 0.88), clamp(uv.y + 0.5, 0.0, 1.0));
  vec3 colour = sky;
  float t = 0.0;
  float material = -1.0;
  for (int i = 0; i < 120; i++) {
    vec3 p = eye + ray * t;
    vec2 m = mapAll(p);
    if (m.x < 0.0008 * t) {
      material = m.y;
      break;
    }
    t += m.x * 0.9;
    if (t > 20.0) break;
  }

  if (material >= 0.0) {
    vec3 p = eye + ray * t;
    vec3 n = normalAt(p);
    vec3 light = normalize(vec3(-0.45, -0.55, 0.8));
    float lit = max(dot(n, light), 0.0);
    float sh = shadowOf(p + n * 0.004, light);
    float amount = mix(0.3 + 0.7 * lit * sh, bands(0.3 + 0.7 * lit * sh), 0.8);
    vec3 base = animalColour(material, p, n);
    if (material == FLOOR) {
      vec2 floorAt = p.xy + vec2(uTravel, 0.0);
      vec2 g = abs(fract(floorAt * 2.0) - 0.5);
      float line = step(0.47, max(g.x, g.y));
      float metre = step(0.485, max(abs(fract(floorAt.x) - 0.5), abs(fract(floorAt.y) - 0.5)));
      base = mix(vec3(0.86, 0.83, 0.75), vec3(0.62, 0.58, 0.5), max(line * 0.5, metre));
    } else if (material == EYE) {
      base = vec3(0.07, 0.06, 0.06);
    }
    colour = base * amount;
    if (material == FLOOR) colour = mix(colour, sky, smoothstep(5.0, 14.0, t));
  }
  outColour = vec4(colour, 1.0);
}
