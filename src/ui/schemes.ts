import { ClassicPreset, type GetSchemes } from 'rete';
import type { AreaPlugin } from 'rete-area-plugin';
import type { ReactArea2D } from 'rete-react-plugin';
import { channelsCompatible } from '../engine/engine.js';
import type { PortChannel, PortDirection } from '../engine/types.js';

export class ChannelSocket extends ClassicPreset.Socket {
  constructor(
    readonly channel: PortChannel,
    readonly portId: string,
    readonly direction: PortDirection,
    readonly nodeId: string,
  ) {
    super(channel);
  }

  isCompatibleWith(other: ChannelSocket): boolean {
    return channelsCompatible(this.channel, other.channel);
  }
}

export class CombineNodeRete extends ClassicPreset.Node<
  Record<string, ChannelSocket>,
  Record<string, ChannelSocket>,
  Record<string, never>
> {
  width = 268;
  height = 176;

  constructor(
    id: string,
    label: string,
    readonly isSource: boolean,
  ) {
    super(label);
    this.id = id;
  }
}

export type Schemes = GetSchemes<
  CombineNodeRete,
  ClassicPreset.Connection<CombineNodeRete, CombineNodeRete> & { isLoop?: boolean }
>;

export type AreaExtra = ReactArea2D<Schemes>;
export type CanvasArea = AreaPlugin<Schemes, AreaExtra>;

export const NODE_BASE_HEIGHT = 128;
export const NODE_PORT_HEIGHT = 30;

export function nodeHeight(node: CombineNodeRete): number {
  const rows = Math.max(Object.keys(node.inputs).length, Object.keys(node.outputs).length);
  return NODE_BASE_HEIGHT + rows * NODE_PORT_HEIGHT;
}
