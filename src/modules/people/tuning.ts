export const POPULATION = 8;

export const FIRST_PEOPLE = 2;

export const ADAM = 0;

export const EVE = 1;

export const NOBODY = -1;

export const Task = { None: 0, Pick: 1, Knap: 2, Bring: 3, Chop: 4, Light: 5, Plant: 6, Drink: 7, Feed: 8, Forage: 9, Wonder: 10, Roast: 12, Fish: 13, Scavenge: 14 } as const;

export type Task = (typeof Task)[keyof typeof Task];

export const Walk = { Moving: 0, Arrived: 1, Blocked: 2 } as const;

export type Walk = (typeof Walk)[keyof typeof Walk];

export const BASE_SPEED = 1.5;

export const BODY_TEMP_RECOVERED = 36.6;

export const SKIN_CELSIUS = 33;

export const HEAT_LOSS_PER_DEGREE = 0.0004;

export const FIRE_GAIN = 0.1;

export const HUDDLE_GAIN = 0.03;

export const HUDDLE_LOSS_SHARE = 0.2;

export const EXERTION_GAIN = 0.004;

export const WARM_AIR_GAIN = 0.01;

export const WARM_ENOUGH = 0.3;

export const HUDDLE_RANGE = 0.9;

export const HUNGER_PER_SECOND = 1 / 4320;

export const THIRST_PER_SECOND = 1 / 1440;

export const WEARINESS_PER_SECOND = 1 / 900;

export const REST_RECOVERY_PER_SECOND = 1 / 700;

export const NEED_EXERTION = 1.8;

export const THIRSTY_ABOVE_CELSIUS = 25;

export const THIRST_PER_DEGREE = 0.04;

export const STAMINA_DRAIN = 0.011;

export const STAMINA_REGAIN = 0.05;

export const STAMINA_TIRED = 0.35;

export const STAMINA_RESTED = 0.25;

export const ARRIVE = 0.02;

export const MAX_STEP = 0.1;

export const MAX_FRAME = 0.6;

export const FIRE_SIDE_TILES = 1.7;

export const FIRE_SEEK_TILES = 60;

export const DARK_GLOOM = 0.5;

export const GLOOM_REFRESH_SECONDS = 1;

export const LIGHT_LEASH_TILES = 5;

export const LIGHT_PULL = 3;

export const SLEEPY = 0.5;

export const NIGHT_SLEEPY = 0.25;

export const DAY_WAKES = 0.35;

export const AWAKE_RECOVERY = 0.2;

export const COLLAPSE = 0.92;

export const WAKES = 0.08;

export const SLEEP_RECOVERY = 3;

export const SLEEP_ANGLES = 8;

export const THIRSTY_ENOUGH = 0.45;

export const THIRSTY_IN_THE_DARK = 0.8;

export const QUENCHED = 0.04;

export const DRINK_SEEK_TILES = 30;

export const DRINK_PER_SECOND = 0.1;

export const DRINK_MAX_SECONDS = 20;

export const FORAGE_HUNGER = 0.4;

export const FORAGE_IN_THE_DARK = 0.75;

export const FORAGE_SEEK_TILES = 40;

export const FORAGE_SECONDS = 6;

export const SCAVENGE_SECONDS = 3;

export const SCAVENGE_SEEK_TILES = 14;

export const SCAVENGE_SAMPLES = 24;

export const SCAVENGE_CHANCE = 0.85;

export const GATHER_KCAL = 140;

export const ROAST_SECONDS = 2.4;

export const FULL_STOMACH_KCAL = 650;

export const WORTH_A_WALK_KCAL = 60;

export const KCAL_PER_HUNGER = 6000;

export const PICK_SECONDS = 1;

export const CHOP_SECONDS = 2.6;

export const TRIAL_SECONDS = 1e9;

export const FISH_SECONDS = 12;

export const FISH_SHORE_TILES = 5;

export const FISH_CASTS = 3;

export const SHELTER_REACH_TILES = 40;

export const WONDER_SECONDS = 3.4;

export const WONDER_URGENT_SECONDS = 0.3;

export const FEED_NOTICE_TILES = 20;

export const FEED_SEEK_TILES = 60;

export const FEED_SECONDS = 0.9;

export const LIGHT_SECONDS = 1.6;

export const PLANT_SECONDS = 1.2;

export const STRIKE_INTERVAL = 0.8;;

export const IDLE_SECONDS = [1.5, 5] as const;

export const WANDER_CONTINUES = 0.8;

export const PERSISTENCE = 0.5;

export const COHESION_BIAS = 1.5;

export const COHESION_TILES = 10;

export const STEP_JITTER = 0.3;

export const HAUL_CHANCE = 0.75;

export const HAUL_REACH_TILES = 40;

export const SETTLE_RADIUS = 6;

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export const DEATH_TEMPERATURE = 32;

export const DYING_SECONDS = 240;

export const BIRTH_SECONDS = 600;

export const BIRTH_CONTENT = 0.6;

export const BIRTH_TOGETHER_TILES = 6;
