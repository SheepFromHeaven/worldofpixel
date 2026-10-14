import { BaseSocketPosition } from 'rete-render-utils';
import type { AreaExtra, Schemes } from './schemes.js';

type Position = { x: number; y: number };

/**
 * Rete's stock watcher sums offsetLeft/offsetTop up the offsetParent chain, which
 * disagrees with the painted position whenever a socket is nudged with transforms,
 * negative margins or absolute positioning. Measuring the rendered rect instead
 * means the cable endpoint is wherever the circle actually is, whatever the CSS does.
 */
export class RectSocketPosition extends BaseSocketPosition<Schemes, AreaExtra> {
  async calculatePosition(
    nodeId: string,
    _side: 'input' | 'output',
    _key: string,
    element: HTMLElement,
  ): Promise<Position | null> {
    const view = this.area?.nodeViews.get(nodeId);
    if (!view?.element) return null;

    const node = view.element.getBoundingClientRect();
    const socket = element.getBoundingClientRect();

    // Rects are in screen pixels; the node's untransformed width recovers the area zoom.
    const zoom = view.element.offsetWidth ? node.width / view.element.offsetWidth : 1;
    if (!zoom) return null;

    return {
      x: (socket.left + socket.width / 2 - node.left) / zoom,
      y: (socket.top + socket.height / 2 - node.top) / zoom,
    };
  }
}
