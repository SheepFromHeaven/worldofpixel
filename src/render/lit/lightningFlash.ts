import type { Bolt } from '../../sim/weather/lightning.ts';
import type { Sky } from '../../sim/weather/sky.ts';
import type { World } from '../../sim/world.ts';
import { BOLT_LIFETIME_SECONDS } from './litLayerConstants.ts';

export interface LiveBolt {
  bolt: Bolt;
  firstSeenAtSeconds: number;
}

export class LightningFlash {
  readonly liveBolts: LiveBolt[] = [];
  latestStrike = { x: 0, y: 0 };

  private dischargesSeen = 0;
  private worldSeedSeen = -1;
  private groundStrikesSeen = 0;
  private flashStartedAtSeconds = -10;

  follow(world: World, sky: Sky, seconds: number): void {
    const { lightning } = sky;
    if (this.worldSeedSeen !== world.seed) {
      this.worldSeedSeen = world.seed;
      this.liveBolts.length = 0;
      this.dischargesSeen = lightning.dischargeCount;
    }
    if (lightning.dischargeCount < this.dischargesSeen) this.dischargesSeen = lightning.dischargeCount;
    for (const bolt of lightning.recentBolts) {
      if (bolt.id <= this.dischargesSeen) continue;
      this.liveBolts.push({ bolt, firstSeenAtSeconds: seconds });
    }
    this.dischargesSeen = lightning.dischargeCount;
    while (this.liveBolts.length > 0 && seconds - this.liveBolts[0]!.firstSeenAtSeconds > BOLT_LIFETIME_SECONDS) {
      this.liveBolts.shift();
    }

    if (lightning.groundStrikeCount !== this.groundStrikesSeen) {
      if (lightning.groundStrikeCount > this.groundStrikesSeen) {
        this.flashStartedAtSeconds = seconds;
        this.latestStrike = lightning.latestGroundStrike;
      }
      this.groundStrikesSeen = lightning.groundStrikeCount;
    }
  }

  flashStrength(seconds: number): number {
    const sinceFlash = seconds - this.flashStartedAtSeconds;
    if (sinceFlash < 0 || sinceFlash > 1) return 0;
    if (sinceFlash < 0.07) return 1;
    if (sinceFlash < 0.12) return 0.15;
    if (sinceFlash < 0.19) return 0.8;
    return Math.exp(-(sinceFlash - 0.19) * 6);
  }
}
