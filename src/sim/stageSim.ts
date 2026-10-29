import type { CalendarMoment } from './calendar.ts';
import { DAY_SECONDS } from './calendar.ts';
import { applyPeopleCommand, commitTrial } from './commands.ts';
import { Trial } from './discovery/trial.ts';
import type { ItemType } from './people/items.ts';
import { daylightAt, placeOf } from './daylight.ts';
import type { Vec2 } from './geometry.ts';
import type { PeopleEnvironment } from './people/people.ts';
import { People, POPULATION } from './people/people.ts';
import { lightSpotNear } from './people/surroundings.ts';
import { Mind } from './mind/mind.ts';
import type { Command } from './simulation.ts';
import { emittersIn, warmthFrom } from './sources/emitters.ts';
import type { World } from './world.ts';

export const STAGE_CELSIUS = 18;

const IDLE_START_SECONDS = 4;

export class StageSim {
  readonly people: People;
  readonly mind: Mind;
  moment: CalendarMoment = { timeOfDay: 0.5, seasonPhase: 0.3, moonPhase: 0.5, completedDays: 0 };
  celsius = STAGE_CELSIUS;
  speed = 1;
  trial: Trial | null = null;
  private trialPerson = 0;
  private trials = 0;

  private readonly surroundings: PeopleEnvironment = {
    temperatureAt: () => this.celsius,
    warmthAt: (x, y) => warmthFrom(emittersIn(this.world, this.people), x, y),
    gloomAt: (x, y) => daylightAt(this.moment, placeOf(this.world.grid, this.world.seed, { x, y })).gloom,
    lightNear: (x, y) => lightSpotNear(this.world, this.people, x, y),
  };

  constructor(
    readonly world: World,
    humans: readonly { at: Vec2; heading: number }[],
  ) {
    const people = new People(world, null, Math.min(POPULATION, humans.length));
    humans.slice(0, people.count).forEach(({ at, heading }, person) => {
      people.posX[person] = at.x;
      people.posY[person] = at.y;
      people.targetX[person] = at.x;
      people.targetY[person] = at.y;
      people.heading[person] = heading;
      people.timer[person] = IDLE_START_SECONDS;
    });
    this.people = people;
    this.mind = new Mind(people);
    people.mind = this.mind;
    this.people.knowledge.hasDiscoveredFire = true;
    this.people.knowledge.hasDiscoveredFlintKnapping = true;
    this.people.subscribe((event) => {
      if (event.kind === 'trial') this.openTrial(event.person, event.tile);
    });
  }

  apply(command: Command): void {
    applyPeopleCommand(this.world, this.people, 'settle', command);
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

  advance(seconds: number): void {
    const { people } = this;
    this.trial?.update(seconds);
    if (people.count === 1) {
      people.posX[1] = people.posX[0]!;
      people.posY[1] = people.posY[0]!;
    }
    const scaled = this.trial ? 0 : seconds * this.speed;
    this.world.burn(scaled);
    this.people.update(scaled, this.surroundings);
    this.mind.update(scaled);
    this.world.fade(scaled / DAY_SECONDS);
  }
}
