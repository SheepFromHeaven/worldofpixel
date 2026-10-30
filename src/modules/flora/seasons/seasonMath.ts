export const clampBetween = (value: number, lowest = 0, highest = 1): number =>
  Math.min(highest, Math.max(lowest, value));

export const smoothstepBetween = (edgeStart: number, edgeEnd: number, value: number): number => {
  const progress = clampBetween((value - edgeStart) / (edgeEnd - edgeStart));
  return progress * progress * (3 - 2 * progress);
};

export const smoothBump = (value: number, startsAt: number, endsAt: number, easeLength = 0.06): number =>
  smoothstepBetween(startsAt, startsAt + easeLength, value) * (1 - smoothstepBetween(endsAt - easeLength, endsAt, value));
