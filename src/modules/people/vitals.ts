import { Station } from '../../sim/world.ts';
import { stationOf } from '../../content/stations/index.ts';
import { BODY_TEMP_FLOOR, BODY_TEMP_NORMAL, EntityState } from './states.ts';
import { METABOLIC_GAIN, DRINK_PER_SECOND, EXERTION_GAIN, FIRE_GAIN, GLOOM_REFRESH_SECONDS, HEAT_LOSS_PER_DEGREE, HUDDLE_GAIN, HUDDLE_LOSS_SHARE, HUDDLE_RANGE, HUNGER_PER_SECOND, NEED_EXERTION, REST_RECOVERY_PER_SECOND, SKIN_CELSIUS, SLEEP_RECOVERY, STAMINA_DRAIN, STAMINA_REGAIN, THIRSTY_ABOVE_CELSIUS, THIRST_PER_DEGREE, THIRST_PER_SECOND, WARM_AIR_GAIN, WEARINESS_PER_SECOND, clamp01 } from './tuning.ts';
import type { People, PeopleEnvironment } from './people.ts';
import { shelterAt } from './sleep.ts';

export function vitals(people: People, person: number, dt: number, environment: PeopleEnvironment): void {
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  const ambient = environment.temperatureAt(people.tileAt(x, y));
  const heat = environment.warmthAt(x, y);
  people.warmth[person] = heat;
  people.air[person] = ambient;
  people.gloomLeft[person] = people.gloomLeft[person]! - dt;
  if (people.gloomLeft[person]! <= 0) {
    people.gloomLeft[person] = GLOOM_REFRESH_SECONDS;
    people.gloom[person] = environment.gloomAt(x, y);
  }

  const moving = people.moveSpeed[person]! > 0;
  const state = people.state[person]!;
  const resting = state === EntityState.Idle || state === EntityState.Huddling || state === EntityState.Sleeping;
  const sleeping = state === EntityState.Sleeping && !moving;
  if (moving) people.stamina[person] = Math.max(0, people.stamina[person]! - STAMINA_DRAIN * dt);
  else people.stamina[person] = Math.min(1, people.stamina[person]! + STAMINA_REGAIN * (resting ? 1 : 0.5) * dt);

  const recovering = state === EntityState.Sleeping || state === EntityState.Huddling;
  const exertion = moving ? NEED_EXERTION : 1;
  const dry = 1 + Math.max(0, ambient - THIRSTY_ABOVE_CELSIUS) * THIRST_PER_DEGREE;
  people.hunger[person] = clamp01(people.hunger[person]! + HUNGER_PER_SECOND * exertion * dt);
  people.thirst[person] = clamp01(
    people.thirst[person]! + (state === EntityState.Drinking ? -DRINK_PER_SECOND : THIRST_PER_SECOND * exertion * dry) * dt,
  );
  const shelter = sleeping ? shelterAt(people, people.tileAt(x, y)) : Station.None;
  const sheltered = stationOf(shelter)?.shelter;
  const restful = sheltered?.recovery ?? 1;
  people.tiredness[person] = clamp01(people.tiredness[person]! + (recovering ? -REST_RECOVERY_PER_SECOND * (sleeping ? SLEEP_RECOVERY * restful : 1) : WEARINESS_PER_SECOND * exertion) * dt);

  const mate = people.mateOf(person);
  const close = Math.hypot(people.posX[mate]! - x, people.posY[mate]! - y) <= HUDDLE_RANGE;
  const huddled = mate !== person && close && (state === EntityState.Huddling || people.state[mate] === EntityState.Huddling);

  const covered = sheltered?.loss ?? 1;
  const loss = Math.max(0, SKIN_CELSIUS - ambient) * HEAT_LOSS_PER_DEGREE * (huddled ? HUDDLE_LOSS_SHARE : 1) * covered;
  const gain =
    METABOLIC_GAIN + heat * FIRE_GAIN + (huddled ? HUDDLE_GAIN : 0) + (moving ? EXERTION_GAIN : 0) + (ambient >= SKIN_CELSIUS ? WARM_AIR_GAIN : 0);

  const next = people.bodyTemp[person]! + (gain - loss) * dt;
  people.bodyTemp[person] = Math.min(BODY_TEMP_NORMAL, Math.max(BODY_TEMP_FLOOR, next));
}
