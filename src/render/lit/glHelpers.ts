import type { LitView } from './litLayer.ts';
import { TEXEL } from '../terrainPixels.ts';

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('could not create a shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed to compile');
  }
  return shader;
}

export function linkProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string, feedback?: readonly string[]): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('could not create a program');
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  if (feedback) gl.transformFeedbackVaryings(program, [...feedback], gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program failed to link');
  }
  return program;
}

async function fetchSpriteSheetBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  return createImageBitmap(await response.blob(), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
}

function textureFromBitmap(gl: WebGL2RenderingContext, bitmap: ImageBitmap): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('could not create a texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export async function loadSpriteSheetTexture(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
  const bitmap = await fetchSpriteSheetBitmap(url);
  const texture = textureFromBitmap(gl, bitmap);
  bitmap.close();
  return texture;
}

export async function loadSpriteSheetTextureWithPixels(
  gl: WebGL2RenderingContext,
  url: string,
): Promise<{ texture: WebGLTexture; pixels: ImageData }> {
  const bitmap = await fetchSpriteSheetBitmap(url);
  const texture = textureFromBitmap(gl, bitmap);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('could not read the sprite sheet back');
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return { texture, pixels };
}

export function setTextureFiltering(gl: WebGL2RenderingContext, texture: WebGLTexture, filter: number): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export type UniformLocations<Name extends string> = Record<Name, WebGLUniformLocation | null>;

export function findUniforms<Name extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly Name[],
): UniformLocations<Name> {
  const found = {} as UniformLocations<Name>;
  for (const name of names) found[name] = gl.getUniformLocation(program, name);
  return found;
}

export interface QuadGeometry {
  cornersBuffer: WebGLBuffer;
  fullScreenVertexArray: WebGLVertexArrayObject;
}

export function createQuadGeometry(gl: WebGL2RenderingContext): QuadGeometry {
  const cornersBuffer = gl.createBuffer();
  const fullScreenVertexArray = gl.createVertexArray();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornersBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.bindVertexArray(fullScreenVertexArray);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { cornersBuffer: cornersBuffer!, fullScreenVertexArray: fullScreenVertexArray! };
}

export function useAlphaBlendingWithoutDepth(gl: WebGL2RenderingContext): void {
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

export function useAlphaBlendingForLayer(gl: WebGL2RenderingContext, body: boolean): void {
  useAlphaBlendingWithoutDepth(gl);
  if (!body) return;
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.depthMask(false);
}

export function setViewUniforms(
  gl: WebGL2RenderingContext,
  locations: UniformLocations<'uView' | 'uBuffer'>,
  view: LitView,
): void {
  gl.uniform4f(locations.uView, view.centre.x, view.centre.y, view.zoom, TEXEL);
  gl.uniform2f(locations.uBuffer, view.width, view.height);
}

export const zoomFade = (zoom: number, fullyVisibleAt: number, goneAt: number): number =>
  Math.min(1, Math.max(0, (zoom - fullyVisibleAt) / (goneAt - fullyVisibleAt)));
