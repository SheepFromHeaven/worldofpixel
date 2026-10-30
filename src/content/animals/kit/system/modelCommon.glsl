uniform vec2 uRes;
uniform vec2 uOrigin;
uniform float uPhase;
uniform vec3 uCam;
uniform vec4 uBody;
uniform vec3 uColour;
uniform vec3 uAccent;
uniform float uTime;
uniform float uWalk;
uniform float uState;
uniform float uTravel;
uniform vec4 uPose;

out vec4 outColour;

const float PI = 3.14159265;
const float TAU = 6.28318531;

vec3 turnAbout(vec3 point, vec3 pivot, float c, float s) {
  vec3 d = point - pivot;
  return pivot + vec3(c * d.x - s * d.y, s * d.x + c * d.y, d.z);
}

vec3 rollAbout(vec3 point, vec3 pivot, float c, float s) {
  vec3 d = point - pivot;
  return pivot + vec3(d.x, c * d.y - s * d.z, s * d.y + c * d.z);
}

vec3 tiltAbout(vec3 point, vec3 pivot, float c, float s) {
  vec3 d = point - pivot;
  return pivot + vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
}

float blob(vec3 p, vec3 c, vec3 r) {
  vec3 q = p - c;
  float k0 = length(q / r);
  float k1 = length(q / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

float limb(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

vec2 add(vec2 a, float d, float id) {
  return d < a.x ? vec2(d, id) : a;
}

