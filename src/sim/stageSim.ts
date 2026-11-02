import type { CalendarMoment } from './calendar.ts';
import type { Ambient } from './capabilities.ts';
import { AMBIENT, MODE, SAVED, WORLD } from './capabilities.ts';
import { EMITTER_SOURCES } from '../modules/light/api.ts';
import { EMISSION } from '../modules/light/api.ts';
import { MIND } from '../modules/mind/api.ts';
import { PEOPLE } from '../modules/people/api.ts';
import { commitTrial } from './commands.ts';
import { daylightAt, placeOf } from './daylight.ts';
import { Trial } from '../modules/discovery/api.ts';
import type { Vec2 } from './geometry.ts';
import { Kernel, provide } from './kernel/kernel.ts';
import { layersOf } from './layers/provide.ts';
import type { Mind } from '../modules/mind/api.ts';
import { GAME_EMITTERS, STAGE_MODULES } from '../modules/index.ts';
import { stageModule } from './stageModule.ts';
import type { OfferContext } from './offers.ts';
import type { ItemType } from '../modules/items/api.ts';
import type { People } from '../modules/people/api.ts';
import type { Command } from './simulation.ts';
import type { World } from './world.ts';

export const STAGE_CELSIUS = 18;

export class StageSim {
  readonly people: People;
  readonly mind: Mind;
  readonly kernel: Kernel;
  moment: CalendarMoment = { timeOfDay: 0.5, seasonPhase: 0.3, moonPhase: 0.5, completedDays: 0 };
  celsius = STAGE_CELSIUS;
  speed = 1;
  trial: Trial | null = null;
  private trialPerson = 0;
  private trials = 0;

  constructor(
    readonly world: World,
    humans: readonly { at: Vec2; heading: number }[],
  ) {
    const ambient: Ambient = {
      temperatureAt: () => this.celsius,
      gloomAt: (x, y) => daylightAt(this.moment, placeOf(this.world.grid, this.world.seed, { x, y })).gloom,
    };
    this.kernel = new Kernel(
      [stageModule(humans, (person, tile) => this.openTrial(person, tile)), ...STAGE_MODULES].flatMap((module) => module.systems),
      [provide(WORLD, world), ...layersOf(world), provide(MODE, 'settle'), provide(SAVED, null), provide(AMBIENT, ambient), provide(EMITTER_SOURCES, GAME_EMITTERS)],
    );
    this.people = this.kernel.get(PEOPLE);
    this.mind = this.kernel.get(MIND);
  }

  get offers(): OfferContext {
    return { world: this.world, people: this.people, mode: 'settle', depth: 0, plane: 0, knows: (id) => this.mind.proven(id), igniterNear: (x, y) => this.kernel.get(EMISSION).igniterNear(x, y), deepCaveAt: () => false };
  }

  apply(command: Command): void {
    if (this.kernel.has(command.kind)) this.kernel.run(command.kind, command);
  }

  private openTrial(person: number, tile: number): void {
    if (this.trial) return;
    const { items } = this.world;
    const kinds = items.at(tile).map((slot) => items.kind[slot]! as ItemType);
    this.trial = new Trial(tile, kinds, this.world.seed ^ Math.imul(this.trials + 1, 7919));
    this.trials += 1;
    this.trialPerson = person;
  }

  leaveTrial(): void {
    const { trial } = this;
    if (!trial) return;
    this.trial = null;
    commitTrial(this.world, this.people, this.trialPerson, trial.outcome());
  }

  private readonly tick = { seconds: 0, scaled: 0 };

  advance(seconds: number): void {
    const { people, tick } = this;
    this.trial?.update(seconds);
    if (people.count === 1) {
      people.posX[1] = people.posX[0]!;
      people.posY[1] = people.posY[0]!;
    }
    tick.seconds = seconds;
    tick.scaled = this.trial ? 0 : seconds * this.speed;
    this.kernel.update(tick);
  }
}
