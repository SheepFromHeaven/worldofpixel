uniform sampler2D uTerrain;
uniform vec4 uTerrainParams;
uniform vec4 uSwitch;
uniform vec4 uCoarse;

vec2 terrainAt(vec2 w) {
  return texture(uTerrain, clamp((w - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0)).rg;
}

float terrainHeight(vec2 w) {
  return terrainAt(w).r * uTerrainParams.x;
}
