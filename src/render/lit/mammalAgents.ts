export const AGENT_CAPACITY = 2048;

export const AGENT_FLOATS = 20;

export interface MammalAgents {
  count: number;
  data: Float32Array;
  isolated: boolean;
}

export interface AgentPose {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  species: number;
  stage: number;
  key: number;
  travelled: number;
  going: number;
  groupKey: number;
  member: number;
  denX: number;
  denY: number;
  glance: number;
  state: number;
  height?: number;
  pose?: readonly number[];
}

export function packAgent(data: Float32Array, index: number, agent: AgentPose): void {
  data.set(
    [agent.x, agent.y, agent.dirX, agent.dirY, agent.species, agent.stage, agent.key, agent.travelled, agent.going, agent.groupKey, agent.member, agent.glance, agent.denX, agent.denY, agent.state, agent.height ?? 0, agent.pose?.[0] ?? 0, agent.pose?.[1] ?? 0, agent.pose?.[2] ?? 0, agent.pose?.[3] ?? 0],
    index * AGENT_FLOATS,
  );
}
