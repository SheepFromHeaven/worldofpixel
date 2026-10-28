const float BODY = 0.0;
const float HEAD = 1.0;
const float LEG = 2.0;
const float TAIL = 3.0;
const float EAR = 4.0;
const float HORN = 5.0;
const float TRUNK = 6.0;
const float MANE = 7.0;
const float FLIPPER = 8.0;
const float FLUKE = 9.0;
const float WING = 10.0;
const float YOUNG = 11.0;
const float HUMP = 12.0;
const float TUSK = 14.0;
const float BILL = 15.0;
const float RUFF = 16.0;
const float FAR = 17.0;
const float FACE = 18.0;
const float EYE = 30.0;
const float FLOOR = 31.0;

float texelHash(vec2 p, float seed) {
  vec3 q = fract(vec3(p.xyx + seed) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
