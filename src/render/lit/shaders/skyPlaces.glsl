uniform sampler2D uPlace;
uniform vec4 uPlaceRect;
uniform vec3 uLat;
float latitudeOf(vec2 w) { return uLat.x - (w.y / uLat.z) * (uLat.x - uLat.y); }
float southAt(vec2 w) { return smoothstep(-8.0, 8.0, -latitudeOf(w)); }
vec4 placeAt(float slot, vec2 world) {
  vec2 f = (world - uPlaceRect.xy) / uPlaceRect.zw;
  float x = clamp(f.x * SKY_COLUMNS, 0.5, SKY_COLUMNS - 0.5);
  float y = clamp(f.y * SKY_ROWS, 0.5, SKY_ROWS - 0.5);
  return texture(uPlace, vec2((slot * SKY_COLUMNS + x) / SKY_WIDTH, y / SKY_ROWS));
}
vec3 sunToward(vec2 w) { return normalize(placeAt(0.0, w).xyz); }
float dayAt(vec2 w) { return placeAt(0.0, w).w; }
vec3 sunColourAt(vec2 w) { return placeAt(1.0, w).rgb; }
float sunShadowAt(vec2 w) { return placeAt(1.0, w).w; }
vec3 moonTowardAt(vec2 w) { return normalize(placeAt(2.0, w).xyz); }
float moonShadowAt(vec2 w) { return placeAt(2.0, w).w; }
vec3 moonColourAt(vec2 w) { return placeAt(3.0, w).rgb; }
float gloomAt(vec2 w) { return placeAt(3.0, w).w; }
vec3 ambientAt(vec2 w) { return placeAt(4.0, w).rgb; }
float fogTimeAt(vec2 w) { return placeAt(4.0, w).w; }
vec3 fogColourAt(vec2 w) { return placeAt(5.0, w).rgb; }
vec3 cloudColourAt(vec2 w) { return placeAt(6.0, w).rgb; }
