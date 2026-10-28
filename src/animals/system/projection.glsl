const float TILT = 0.4;

struct Look {
  vec2 fw;
  vec2 lf;
  vec2 up;
  vec2 deep;
};

Look lookAt(float heading) {
  float a = floor(heading / (PI * 0.25) + 0.5) * PI * 0.25;
  float c = cos(a);
  float s = sin(a);
  Look k;
  k.fw = vec2(c, -TILT * s);
  k.lf = vec2(s, TILT * c);
  k.up = vec2(0.0, sqrt(1.0 - TILT * TILT));
  k.deep = vec2(s, -c);
  return k;
}

vec2 seen(Look k, vec3 a) {
  return a.x * k.fw + a.y * k.lf + a.z * k.up;
}

float nearness(Look k, vec3 a) {
  return dot(a.xy, k.deep);
}

float blob(Look k, vec2 p, vec3 c, vec3 r) {
  vec2 q = p - seen(k, c);
  vec2 A = k.fw * r.x;
  vec2 B = k.lf * r.y;
  vec2 C = k.up * r.z;
  float sxx = A.x * A.x + B.x * B.x + C.x * C.x;
  float sxy = A.x * A.y + B.x * B.y + C.x * C.y;
  float syy = A.y * A.y + B.y * B.y + C.y * C.y;
  float det = max(sxx * syy - sxy * sxy, 1e-6);
  float m = sqrt(max(syy * q.x * q.x - 2.0 * sxy * q.x * q.y + sxx * q.y * q.y, 0.0) / det);
  float tr = sxx + syy;
  float least = sqrt(max(0.5 * (tr - sqrt(max(tr * tr - 4.0 * det, 0.0))), 1e-4));
  return (m - 1.0) * least;
}

float limb(Look k, vec2 p, vec3 a, vec3 b, float ra, float rb) {
  return tapered(p, seen(k, a), seen(k, b), ra, rb);
}

vec3 footOf(vec3 hip, float amp, float ph, float r, float lift) {
  return vec3(hip.x + amp * sin(ph), hip.y, r + lift * max(0.0, cos(ph)));
}

#define DRAW(o, d, depth, id) { float e_ = (d); (o).edge = min((o).edge, e_); if (e_ < 0.0 && (depth) > best) { best = (depth); top = e_; (o).part = (id); } }

Beast profileShadow(vec2 p, float heading, float L) {
  Beast o;
  o.edge = blob(lookAt(heading), p, vec3(-0.1 * L, 0.0, 0.0), vec3(0.5 * L, 0.3 * L, 0.0));
  o.part = BODY;
  o.pc = p;
  o.eye = 1.0;
  o.nose = 1.0;
  o.u = 0.0;
  return o;
}
