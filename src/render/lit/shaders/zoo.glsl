uniform vec4 uZoo;
uniform vec2 uZooHome;
uniform vec4 uZooLeg[ZOO_LEGS];
uniform vec2 uZooWhen[ZOO_LEGS];

struct ZooAnchor {
  vec2 pos;
  vec2 dir;
  float going;
  float travelled;
};

bool zooOn() {
  return uZoo.x > -0.5;
}

bool zooSkips(int species, vec2 cellId, int slot, float firstSlot) {
  return zooOn() && (species != int(uZoo.x + 0.5) || cellId != uZoo.yz || float(slot) != firstSlot);
}

ZooAnchor zooAnchor(float t) {
  ZooAnchor a;
  a.pos = uZooHome;
  a.dir = vec2(1.0, 0.0);
  a.going = 0.0;
  a.travelled = 0.0;
  for (int i = 0; i < ZOO_LEGS; i++) {
    vec2 when = uZooWhen[i];
    if (when.y <= when.x || t < when.x) break;
    vec4 leg = uZooLeg[i];
    vec2 span = leg.zw - leg.xy;
    float length_ = length(span);
    float u = clamp((t - when.x) / (when.y - when.x), 0.0, 1.0);
    a.pos = leg.xy + span * u;
    a.travelled += length_ * u;
    if (length_ > 0.001) a.dir = span / length_;
    a.going = u < 1.0 ? 1.0 : 0.0;
  }
  return a;
}
