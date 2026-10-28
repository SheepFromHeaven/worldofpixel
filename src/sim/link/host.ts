import { FaunaPacker } from '../fauna/pack.ts';
import type { Command, SimState } from '../simulation.ts';
import { Simulation } from '../simulation.ts';
import type { FromSim, Frame, Hello, Start } from './protocol.ts';

const FISH_EVERY = 3;

const ANIMALS_EVERY = 2;

export class SimHost {
  readonly sim: Simulation;
  private tick = 0;
  private changed = false;
  private thoughtsSent = -1;
  private readonly packer: FaunaPacker;

  constructor(
    start: Start,
    private readonly post: (message: FromSim) => void,
  ) {
    this.sim = new Simulation(start.seed, start.mode, start.saved, start.carry);
    this.packer = new FaunaPacker(this.sim.fauna);
    this.sim.subscribe((event) => {
      if (event.kind === 'achievement') this.post({ kind: 'event', event: { kind: 'achievement', id: event.achievement.id } });
      else if (event.kind === 'trial') this.post({ kind: 'event', event: { kind: 'trial', person: event.person, tile: event.tile, items: event.items, seed: event.seed } });
    });
  }

  hello(): Hello {
    const { sim } = this;
    const ground = sim.world.ground();
    const frame = this.frame(true);
    return { seed: sim.world.seed, mode: sim.mode, spot: sim.spot, count: sim.people.count, ground, frame };
  }

  command(command: Command): void {
    this.sim.apply(command);
    this.changed = true;
  }

  step(seconds: number): void {
    this.sim.advance(seconds);
    this.post({ kind: 'frame', frame: this.frame(false) });
  }

  snapshot(): SimState {
    return this.sim.snapshot();
  }

  private frame(introduce: boolean): Frame {
    const { sim } = this;
    const frame: Frame = {
      tick: (this.tick += 1),
      changed: this.changed,
      calendar: sim.calendar.state(),
      speed: sim.speed,
      playTime: sim.playTime,
      forced: sim.forced,
      trialOpen: sim.trialOpen,
      achievements: [...sim.achievements.ids],
      world: introduce ? sim.world.introduce() : sim.world.drain(),
      people: sim.people.pack(),
      fish: introduce || this.tick % FISH_EVERY === 0 ? sim.fish.shoals.pack() : null,
      animals: introduce || this.tick % ANIMALS_EVERY === 0 ? sim.animals.store.pack() : null,
      fauna: introduce ? this.packer.all() : this.packer.step(),
      sky: sim.sky.frame(),
      thoughts: sim.thoughtRevision === this.thoughtsSent ? null : sim.allThoughts(),
    };
    this.thoughtsSent = sim.thoughtRevision;
    this.changed = false;
    return frame;
  }
}
