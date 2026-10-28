import { draftFor } from '../../animals/catalogue.ts';
import { trapezoid } from '../plants/niche.ts';
import type { Range } from '../plants/species.ts';
import { Form, Gait, Horn, Pattern, Social, Trait } from './vocabulary.ts';
import type { Colour, Draft, Habitat } from './vocabulary.ts';
import { CLIFF_SEEN } from '../steep.ts';
import { FRESH_WATER_FROM, MediumBit, Realm, SEA_WATER, SNOW_FROM, SNOW_TO, WATER_PRESENT, WET_FROM, WET_TO } from '../reptiles/species.ts';

export { Realm, SEA_WATER, FRESH_WATER_FROM, SNOW_FROM, SNOW_TO, WET_FROM, WET_TO };

export * from './vocabulary.ts';

export interface MammalSpecies {
  readonly key: string;
  readonly name: string;
  readonly form: Form;
  readonly gait: Gait;
  readonly social: Social;
  readonly realm: number;
  readonly size: number;
  readonly groups: number;
  readonly slots: number;
  readonly sight: number;
  readonly length: number;
  readonly height: number;
  readonly likes: Habitat;
  readonly wet: Habitat;
  readonly bias: number;
  readonly rough: number;
  readonly soil: number;
  readonly temperature: Range;
  readonly season: Range;
  readonly day: number;
  readonly night: number;
  readonly dusk: number;
  readonly shy: number;
  readonly rest: number;
  readonly speed: number;
  readonly reach: number;
  readonly skit: number;
  readonly traits: number;
  readonly horn: Horn;
  readonly hornSize: number;
  readonly hornBoth: boolean;
  readonly pattern: Pattern;
  readonly colour: Colour;
  readonly accent: Colour;
  readonly eye: Colour;
  readonly spots: number;
  readonly bulk: number;
  readonly neck: number;
  readonly head: number;
  readonly legs: number;
  readonly tail: number;
  readonly ears: number;
  readonly rut: number;
  readonly dive: number;
}

const DARK_EYE: Colour = [0.06, 0.05, 0.04];

const ALL_YEAR: Range = [0, 0.02, 0.98, 1];

const NO_WATER: Habitat = [0, 0, 0, 0];

interface Shape {
  bulk: number;
  neck: number;
  head: number;
  legs: number;
  tail: number;
  ears: number;
}

const SHAPES: Record<Form, Shape> = {
  [Form.Quad]: { bulk: 0.34, neck: 0.2, head: 0.24, legs: 1, tail: 0.25, ears: 0.1 },
  [Form.Long]: { bulk: 0.2, neck: 0.1, head: 0.16, legs: 0.5, tail: 0.4, ears: 0.06 },
  [Form.Rodent]: { bulk: 0.42, neck: 0.04, head: 0.24, legs: 0.6, tail: 0.7, ears: 0.1 },
  [Form.Bat]: { bulk: 0.22, neck: 0.04, head: 0.22, legs: 0.2, tail: 0.3, ears: 0.18 },
  [Form.Whale]: { bulk: 0.2, neck: 0, head: 0.2, legs: 0, tail: 0.3, ears: 0 },
  [Form.Dolphin]: { bulk: 0.2, neck: 0, head: 0.2, legs: 0, tail: 0.28, ears: 0 },
  [Form.Seal]: { bulk: 0.3, neck: 0.1, head: 0.18, legs: 0.3, tail: 0.1, ears: 0 },
  [Form.Primate]: { bulk: 0.42, neck: 0.1, head: 0.22, legs: 1, tail: 0.5, ears: 0.1 },
  [Form.Roo]: { bulk: 0.28, neck: 0.14, head: 0.2, legs: 1, tail: 0.7, ears: 0.14 },
  [Form.Sirenian]: { bulk: 0.28, neck: 0, head: 0.14, legs: 0, tail: 0.2, ears: 0 },
  [Form.Beluga]: { bulk: 0.22, neck: 0.04, head: 0.18, legs: 0, tail: 0.2, ears: 0 },
};

const CLIMBERS = new Set(['squirrel', 'flyingsquirrel', 'chipmunk', 'marmot', 'pika', 'hyrax', 'ibex', 'mountaingoat', 'bighorn', 'mouflon', 'chamois', 'snowleopard', 'leopard', 'puma', 'lynx', 'wildcat', 'jaguar', 'macaque', 'snowmonkey', 'baboon', 'gibbon', 'orangutan', 'chimpanzee', 'howler', 'spidermonkey', 'lemur', 'koala', 'sloth', 'possum', 'opossum', 'sugarglider', 'porcupine', 'dormouse', 'stoat', 'marten', 'wolverine', 'raccoon', 'coati', 'pipistrelle', 'flyingfox', 'freetail', 'arcticfox', 'redfox']);

const make = (draft: Draft): MammalSpecies => {
  const shape = SHAPES[draft.form];
  const size = draft.size ?? 1;
  const groups = draft.groups ?? 1;
  return {
    key: draft.key,
    name: draft.name,
    form: draft.form,
    gait: draft.gait,
    social: draft.social ?? Social.Solo,
    realm: (draft.realm ?? Realm.Land) | (CLIMBERS.has(draft.key) ? Realm.Cliff : 0),
    size,
    groups,
    slots: size * groups,
    sight: draft.sight ?? 1,
    length: draft.length,
    height: draft.height,
    likes: draft.likes,
    wet: draft.wet ?? NO_WATER,
    bias: draft.bias ?? 0,
    rough: draft.rough ?? 0,
    soil: draft.soil ?? 0,
    temperature: draft.temperature,
    season: draft.season ?? ALL_YEAR,
    day: draft.day,
    night: draft.night,
    dusk: draft.dusk ?? 0,
    shy: draft.shy ?? 0.25,
    rest: draft.rest,
    speed: draft.speed,
    reach: draft.reach,
    skit: draft.skit,
    traits: draft.traits ?? 0,
    horn: draft.horn ?? Horn.None,
    hornSize: draft.hornSize ?? 1,
    hornBoth: draft.hornBoth ?? false,
    pattern: draft.pattern ?? Pattern.Plain,
    colour: draft.colour,
    accent: draft.accent ?? draft.colour,
    eye: draft.eye ?? DARK_EYE,
    spots: draft.spots ?? 0.3,
    bulk: draft.bulk ?? shape.bulk,
    neck: draft.neck ?? shape.neck,
    head: draft.head ?? shape.head,
    legs: draft.legs ?? shape.legs,
    tail: draft.tail ?? shape.tail,
    ears: draft.ears ?? shape.ears,
    rut: draft.rut ?? -1,
    dive: draft.dive ?? 0,
  };
};

const LF = Realm.Land | Realm.Fresh;
const LS = Realm.Land | Realm.Sea;
const F = Realm.Fresh;
const S = Realm.Sea;
const FS = Realm.Fresh | Realm.Sea;

const T = Trait;
const Q = Form.Quad;
const Z = Social;
const G = Gait;
const P = Pattern;

const WINTER_OFF: Range = [0.05, 0.16, 0.7, 0.82];
const SUMMER_ONLY: Range = [0.06, 0.14, 0.5, 0.62];

export const MAMMALS: readonly MammalSpecies[] = [
  make({ key: 'mole', name: 'European mole', form: Form.Rodent, gait: G.Burrow, sight: 0.1, length: 0.15, height: 0.05, likes: [0.1, 0.8, 0, 0.2], soil: 0.5, bias: -0.1, temperature: [-8, 2, 26, 34], day: 0.5, night: 0.5, dusk: 0.3, rest: 18, speed: 0.1, reach: 4, skit: 1.5, traits: T.Burrow | T.Snout, colour: [0.12, 0.12, 0.14], accent: [0.86, 0.6, 0.58], bulk: 0.5, tail: 0.12, head: 0.3 }),
  make({ key: 'starnose', name: 'star-nosed mole', form: Form.Rodent, gait: G.Burrow, realm: LF, sight: 0.1, length: 0.12, height: 0.04, likes: [0.2, 0.4, 0, 0.9], wet: [0, 0.5, 0, 0.6], soil: 0.3, temperature: [-14, -3, 22, 30], day: 0.5, night: 0.5, dusk: 0.3, rest: 16, speed: 0.12, reach: 4, skit: 1.5, traits: T.Burrow | T.Snout, colour: [0.2, 0.15, 0.12], accent: [0.9, 0.62, 0.6], bulk: 0.5, tail: 0.5, head: 0.3 }),
  make({ key: 'hedgehog', name: 'hedgehog', form: Form.Rodent, gait: G.Walk, sight: 0.25, length: 0.24, height: 0.1, likes: [0.4, 0.5, 0, 0.1], temperature: [-2, 6, 26, 34], season: WINTER_OFF, day: 0.1, night: 1, dusk: 0.6, shy: 0.6, rest: 14, speed: 0.3, reach: 14, skit: 3, traits: T.Quills | T.Snout, colour: [0.38, 0.3, 0.22], accent: [0.78, 0.7, 0.58], bulk: 0.56, tail: 0.05, head: 0.3 }),
  make({ key: 'shrew', name: 'common shrew', form: Form.Rodent, gait: G.Bound, sight: 0.08, length: 0.07, height: 0.03, likes: [0.4, 0.6, 0, 0.1], temperature: [-10, 0, 24, 32], day: 0.7, night: 0.7, dusk: 0.3, shy: 0.3, rest: 3, speed: 3.5, reach: 8, skit: 2, traits: T.Snout, colour: [0.32, 0.26, 0.22], accent: [0.62, 0.55, 0.5], bulk: 0.34, tail: 0.6 }),
  make({ key: 'molerat', name: 'naked mole-rat', form: Form.Rodent, gait: G.Burrow, social: Z.Colony, size: 5, sight: 0.25, length: 0.09, height: 0.03, likes: [0, 0.6, 0, 0], soil: 0.9, bias: -0.1, temperature: [18, 24, 38, 44], day: 0.5, night: 0.5, rest: 20, speed: 0.1, reach: 5, skit: 1, traits: T.Burrow, colour: [0.9, 0.72, 0.66], bulk: 0.44, tail: 0.3 }),
  make({ key: 'gopher', name: 'pocket gopher', form: Form.Rodent, gait: G.Burrow, sight: 0.12, length: 0.2, height: 0.07, likes: [0.1, 0.8, 0, 0.1], soil: 0.6, bias: -0.1, temperature: [-12, 0, 32, 40], day: 0.5, night: 0.5, dusk: 0.3, rest: 18, speed: 0.15, reach: 5, skit: 1.5, traits: T.Burrow, colour: [0.5, 0.4, 0.3], accent: [0.82, 0.62, 0.55], bulk: 0.5, tail: 0.3 }),
  make(draftFor('aardvark')),
  make({ key: 'anteater', name: 'giant anteater', form: Q, gait: G.Walk, social: Z.Family, size: 2, sight: 0.6, length: 1.1, height: 0.7, likes: [0.3, 0.6, 0, 0.2], temperature: [14, 21, 36, 42], day: 0.7, night: 0.5, dusk: 0.3, rest: 20, speed: 0.7, reach: 40, skit: 10, traits: T.Tube | T.Snout | T.Bushy | T.Back, pattern: P.Saddle, colour: [0.55, 0.5, 0.45], accent: [0.1, 0.09, 0.09], bulk: 0.42, tail: 0.9, head: 0.4, ears: 0.05 }),
  make({ key: 'pangolin', name: 'ground pangolin', form: Q, gait: G.Walk, sight: 0.4, length: 0.5, height: 0.2, likes: [0.3, 0.6, 0, 0.1], soil: 0.3, temperature: [14, 21, 36, 42], day: 0.05, night: 1, dusk: 0.4, shy: 0.5, rest: 22, speed: 0.4, reach: 20, skit: 5, traits: T.Armour | T.Snout | T.Burrow, pattern: P.Bands, colour: [0.52, 0.42, 0.3], accent: [0.42, 0.34, 0.24], bulk: 0.55, neck: 0, head: 0.2, tail: 0.8, legs: 0.5, ears: 0 }),
  make({ key: 'armadillo', name: 'nine-banded armadillo', form: Form.Rodent, gait: G.Walk, sight: 0.4, length: 0.4, height: 0.15, likes: [0.3, 0.6, 0, 0.1], soil: 0.5, temperature: [6, 14, 36, 42], day: 0.2, night: 1, dusk: 0.5, shy: 0.4, rest: 5, speed: 1.8, reach: 20, skit: 5, traits: T.Armour | T.Burrow | T.Snout, pattern: P.Bands, colour: [0.52, 0.44, 0.38], accent: [0.4, 0.32, 0.28], bulk: 0.5, tail: 0.7, ears: 0.14 }),
  make({ key: 'echidna', name: 'short-beaked echidna', form: Form.Rodent, gait: G.Walk, sight: 0.4, length: 0.35, height: 0.12, likes: [0.4, 0.5, 0, 0.1], soil: 0.2, temperature: [2, 10, 36, 42], day: 0.6, night: 0.5, dusk: 0.6, shy: 0.5, rest: 16, speed: 0.3, reach: 20, skit: 4, traits: T.Quills | T.Snout | T.Tube, colour: [0.24, 0.17, 0.12], accent: [0.8, 0.7, 0.5], bulk: 0.6, tail: 0.04, head: 0.3, ears: 0 }),
  make({ key: 'platypus', name: 'platypus', form: Form.Long, gait: G.Swim, realm: LF, sight: 0.5, length: 0.4, height: 0.1, likes: [0.1, 0.1, 0, 0.8], wet: [0, 0.5, 0, 0.5], temperature: [2, 10, 28, 34], day: 0.2, night: 1, dusk: 0.8, shy: 0.6, rest: 16, speed: 0.6, reach: 30, skit: 6, traits: T.Bill | T.Burrow, colour: [0.34, 0.25, 0.2], accent: [0.2, 0.18, 0.18], bulk: 0.28, tail: 0.5, ears: 0, dive: 25 }),

  make({ key: 'fieldmouse', name: 'wood mouse', form: Form.Rodent, gait: G.Bound, sight: 0.15, length: 0.09, height: 0.04, likes: [0.5, 0.5, 0, 0.1], temperature: [-12, 0, 28, 36], day: 0.2, night: 1, dusk: 0.4, shy: 0.6, rest: 3, speed: 3.5, reach: 12, skit: 3, colour: [0.55, 0.42, 0.28], accent: [0.9, 0.86, 0.78], bulk: 0.38, tail: 0.9, ears: 0.18 }),
  make({ key: 'rat', name: 'brown rat', form: Form.Rodent, gait: G.Bound, sight: 0.15, length: 0.24, height: 0.08, likes: [0.3, 0.6, 0, 0.3], temperature: [-12, 0, 32, 40], day: 0.4, night: 1, dusk: 0.5, shy: 0.4, rest: 3, speed: 3.5, reach: 16, skit: 4, colour: [0.42, 0.35, 0.3], accent: [0.8, 0.7, 0.66], bulk: 0.34, tail: 0.9, ears: 0.14 }),
  make({ key: 'vole', name: 'field vole', form: Form.Rodent, gait: G.Bound, sight: 0.12, length: 0.11, height: 0.04, likes: [0.1, 0.9, 0, 0.1], temperature: [-18, -6, 24, 32], day: 0.6, night: 0.6, dusk: 0.3, shy: 0.4, rest: 3, speed: 3.5, reach: 10, skit: 3, colour: [0.5, 0.4, 0.3], accent: [0.75, 0.68, 0.6], bulk: 0.42, tail: 0.35, ears: 0.06 }),
  make({ key: 'lemming', name: 'Norway lemming', form: Form.Rodent, gait: G.Bound, sight: 0.15, length: 0.14, height: 0.05, likes: [0, 0.8, 0, 0.1], temperature: [-45, -30, 12, 22], day: 0.6, night: 0.6, dusk: 0.3, shy: 0.2, rest: 3, speed: 3.5, reach: 12, skit: 3, pattern: P.Patches, colour: [0.62, 0.42, 0.2], accent: [0.14, 0.1, 0.08], bulk: 0.46, tail: 0.12, ears: 0.05 }),
  make({ key: 'hamster', name: 'common hamster', form: Form.Rodent, gait: G.Walk, sight: 0.2, length: 0.25, height: 0.09, likes: [0.1, 0.8, 0, 0.1], soil: 0.4, temperature: [-10, 2, 30, 38], season: WINTER_OFF, day: 0.2, night: 1, dusk: 0.5, shy: 0.5, rest: 4, speed: 2.2, reach: 14, skit: 4, traits: T.Burrow, pattern: P.Patches, colour: [0.55, 0.38, 0.2], accent: [0.9, 0.86, 0.76], bulk: 0.5, tail: 0.12, ears: 0.1 }),
  make({ key: 'squirrel', name: 'red squirrel', form: Form.Rodent, gait: G.Bound, sight: 0.4, length: 0.22, height: 0.09, likes: [1, 0, 0, 0.05], temperature: [-20, -6, 26, 34], day: 1, night: 0, dusk: 0.3, shy: 0.5, rest: 3, speed: 3.5, reach: 14, skit: 5, traits: T.Climb | T.Bushy | T.Ears, colour: [0.68, 0.32, 0.14], accent: [0.92, 0.88, 0.8], bulk: 0.32, tail: 1, ears: 0.14 }),
  make({ key: 'flyingsquirrel', name: 'northern flying squirrel', form: Form.Rodent, gait: G.Bound, sight: 0.3, length: 0.2, height: 0.06, likes: [1, 0, 0, 0.05], temperature: [-24, -10, 24, 32], day: 0, night: 1, dusk: 0.3, shy: 0.5, rest: 2, speed: 5.5, reach: 18, skit: 5, traits: T.Climb | T.Glide | T.Bushy, colour: [0.52, 0.46, 0.4], accent: [0.86, 0.82, 0.76], bulk: 0.34, tail: 0.85, ears: 0.1 }),
  make({ key: 'chipmunk', name: 'eastern chipmunk', form: Form.Rodent, gait: G.Bound, sight: 0.25, length: 0.15, height: 0.06, likes: [0.6, 0.3, 0, 0.1], temperature: [-8, 4, 28, 36], season: WINTER_OFF, day: 1, night: 0, dusk: 0.2, shy: 0.5, rest: 3, speed: 3.5, reach: 12, skit: 4, pattern: P.Saddle, colour: [0.55, 0.36, 0.2], accent: [0.14, 0.1, 0.08], bulk: 0.36, tail: 0.7, ears: 0.1 }),
  make({ key: 'marmot', name: 'alpine marmot', form: Form.Rodent, gait: G.Burrow, social: Z.Colony, size: 4, sight: 0.6, length: 0.55, height: 0.22, likes: [0, 0.7, 0, 0], rough: 0.8, soil: 0.4, temperature: [-14, -2, 20, 28], season: SUMMER_ONLY, day: 1, night: 0, dusk: 0.2, shy: 0.4, rest: 12, speed: 0.5, reach: 14, skit: 12, traits: T.Burrow | T.Sentinel, colour: [0.52, 0.42, 0.3], accent: [0.78, 0.66, 0.5], bulk: 0.5, tail: 0.3, ears: 0.06 }),
  make({ key: 'prairiedog', name: 'prairie dog', form: Form.Rodent, gait: G.Burrow, social: Z.Colony, size: 6, groups: 2, sight: 0.7, length: 0.32, height: 0.14, likes: [0, 1, 0, 0], soil: 0.6, bias: -0.1, temperature: [-12, 0, 32, 40], day: 1, night: 0, dusk: 0.1, shy: 0.4, rest: 10, speed: 0.6, reach: 12, skit: 10, traits: T.Burrow | T.Sentinel, colour: [0.66, 0.5, 0.34], accent: [0.9, 0.82, 0.68], bulk: 0.46, tail: 0.25, ears: 0.05 }),
  make({ key: 'dormouse', name: 'hazel dormouse', form: Form.Rodent, gait: G.Bound, sight: 0.1, length: 0.08, height: 0.04, likes: [0.9, 0.1, 0, 0], temperature: [0, 8, 26, 34], season: [0.12, 0.22, 0.62, 0.7], day: 0, night: 1, dusk: 0.3, shy: 0.6, rest: 3, speed: 3.5, reach: 10, skit: 3, traits: T.Climb | T.Bushy, colour: [0.72, 0.52, 0.28], accent: [0.9, 0.8, 0.6], bulk: 0.36, tail: 0.9, ears: 0.1 }),
  make({ key: 'beaver', name: 'North American beaver', form: Form.Rodent, gait: G.Swim, social: Z.Family, size: 3, realm: LF, sight: 0.8, length: 0.8, height: 0.3, likes: [0.4, 0.2, 0, 0.9], wet: [0, 0.5, 0, 0.5], temperature: [-25, -8, 26, 34], day: 0.2, night: 1, dusk: 0.8, shy: 0.4, rest: 14, speed: 0.6, reach: 30, skit: 10, traits: T.Burrow, colour: [0.38, 0.26, 0.18], accent: [0.15, 0.12, 0.1], bulk: 0.46, tail: 0.4, ears: 0.05, dive: 20 }),
  make({ key: 'muskrat', name: 'muskrat', form: Form.Rodent, gait: G.Swim, realm: LF, sight: 0.4, length: 0.3, height: 0.1, likes: [0.1, 0.2, 0, 0.9], wet: [0, 0.5, 0, 0.6], temperature: [-25, -8, 28, 36], day: 0.3, night: 1, dusk: 0.7, shy: 0.4, rest: 5, speed: 1.5, reach: 20, skit: 6, colour: [0.32, 0.24, 0.18], accent: [0.6, 0.5, 0.4], bulk: 0.38, tail: 0.8, ears: 0.04, dive: 14 }),
  make({ key: 'capybara', name: 'capybara', form: Q, gait: G.Swim, social: Z.Herd, size: 6, realm: LF, sight: 1, length: 1.2, height: 0.55, likes: [0.1, 0.5, 0, 0.9], wet: [0, 0.5, 0, 0.6], temperature: [14, 22, 36, 42], day: 0.8, night: 0.5, dusk: 0.6, rest: 16, speed: 0.6, reach: 22, skit: 10, colour: [0.52, 0.38, 0.26], accent: [0.62, 0.48, 0.34], bulk: 0.4, neck: 0.08, head: 0.28, tail: 0.02, ears: 0.05, legs: 0.5 }),
  make({ key: 'porcupine', name: 'crested porcupine', form: Form.Rodent, gait: G.Walk, social: Z.Family, size: 2, sight: 0.6, length: 0.7, height: 0.25, likes: [0.3, 0.5, 0, 0.1], rough: 0.2, temperature: [4, 12, 36, 42], day: 0, night: 1, dusk: 0.4, shy: 0.4, rest: 14, speed: 0.5, reach: 26, skit: 8, traits: T.Quills, pattern: P.Stripes, colour: [0.22, 0.18, 0.15], accent: [0.9, 0.88, 0.8], bulk: 0.5, tail: 0.1, ears: 0.05 }),
  make({ key: 'agouti', name: 'red-rumped agouti', form: Form.Rodent, gait: G.Bound, sight: 0.5, length: 0.5, height: 0.25, likes: [0.8, 0.2, 0, 0.2], temperature: [18, 23, 36, 42], day: 1, night: 0, dusk: 0.2, shy: 0.5, rest: 4, speed: 3, reach: 20, skit: 8, colour: [0.5, 0.34, 0.2], accent: [0.8, 0.5, 0.2], bulk: 0.32, tail: 0.08, legs: 1, ears: 0.08, neck: 0.1 }),
  make({ key: 'mara', name: 'Patagonian mara', form: Q, gait: G.Hop, social: Z.Family, size: 2, sight: 0.6, length: 0.7, height: 0.4, likes: [0, 1, 0, 0], temperature: [-6, 4, 32, 40], day: 1, night: 0, dusk: 0.3, shy: 0.4, rest: 10, speed: 1, reach: 30, skit: 14, colour: [0.52, 0.46, 0.4], accent: [0.9, 0.9, 0.86], bulk: 0.36, tail: 0.06, ears: 0.18, legs: 1.2, neck: 0.12 }),
  make({ key: 'jerboa', name: 'greater jerboa', form: Form.Roo, gait: G.Hop, sight: 0.15, length: 0.15, height: 0.07, likes: [0, 0.8, 0, 0], temperature: [-8, 6, 38, 46], day: 0, night: 1, dusk: 0.3, shy: 0.5, rest: 3, speed: 3.5, reach: 16, skit: 4, pattern: P.Bands, colour: [0.82, 0.68, 0.46], accent: [0.15, 0.12, 0.1], bulk: 0.34, tail: 1.6, ears: 0.26, legs: 1.2 }),
  make(draftFor('rabbit')),
  make({ key: 'hare', name: 'brown hare', form: Form.Rodent, gait: G.Hop, sight: 0.8, length: 0.6, height: 0.28, likes: [0, 1, 0, 0], temperature: [-14, -2, 30, 38], day: 0.4, night: 0.8, dusk: 1, shy: 0.4, rest: 5, speed: 6.5, reach: 40, skit: 22, traits: T.Ears | T.LongEars, colour: [0.58, 0.42, 0.26], accent: [0.95, 0.94, 0.9], bulk: 0.28, tail: 0.1, ears: 0.34, legs: 1.5, rut: 0.15 }),
  make({ key: 'arctichare', name: 'Arctic hare', form: Form.Rodent, gait: G.Hop, social: Z.Herd, size: 4, sight: 0.8, length: 0.6, height: 0.3, likes: [0, 1, 0, 0], temperature: [-50, -34, 10, 20], day: 0.6, night: 0.6, dusk: 0.6, shy: 0.2, rest: 5, speed: 6.5, reach: 40, skit: 22, traits: T.Ears | T.LongEars, colour: [0.96, 0.96, 0.98], accent: [0.15, 0.13, 0.12], bulk: 0.28, tail: 0.1, ears: 0.3, legs: 1.5 }),
  make({ key: 'pika', name: 'American pika', form: Form.Rodent, gait: G.Bound, sight: 0.2, length: 0.17, height: 0.07, likes: [0, 0.4, 0, 0], rough: 1, temperature: [-20, -6, 16, 24], season: SUMMER_ONLY, day: 1, night: 0, dusk: 0.3, shy: 0.6, rest: 3, speed: 3.5, reach: 10, skit: 5, colour: [0.52, 0.42, 0.34], accent: [0.72, 0.64, 0.56], bulk: 0.5, tail: 0.02, ears: 0.16 }),

  make({ key: 'macaque', name: 'Barbary macaque', form: Form.Primate, gait: G.Walk, social: Z.Troop, size: 8, sight: 0.9, length: 0.6, height: 0.4, likes: [0.6, 0.4, 0, 0.1], rough: 0.4, temperature: [-4, 6, 32, 40], day: 1, night: 0, dusk: 0.1, rest: 5, speed: 2.5, reach: 30, skit: 12, colour: [0.52, 0.42, 0.32], accent: [0.7, 0.55, 0.45], bulk: 0.32, tail: 0.04, ears: 0.1 }),
  make({ key: 'snowmonkey', name: 'Japanese macaque', form: Form.Primate, gait: G.Walk, social: Z.Troop, size: 8, sight: 0.9, length: 0.6, height: 0.4, likes: [0.7, 0.2, 0, 0.3], rough: 0.5, temperature: [-20, -6, 24, 32], day: 1, night: 0, dusk: 0.1, rest: 5, speed: 2.5, reach: 26, skit: 12, colour: [0.62, 0.58, 0.54], accent: [0.78, 0.4, 0.34], bulk: 0.34, tail: 0.04, ears: 0.1 }),
  make({ key: 'baboon', name: 'olive baboon', form: Form.Primate, gait: G.Walk, social: Z.Troop, size: 10, sight: 1, length: 0.8, height: 0.55, likes: [0.3, 0.7, 0, 0.3], rough: 0.2, temperature: [8, 16, 36, 42], day: 1, night: 0, dusk: 0.1, rest: 5, speed: 3.5, reach: 40, skit: 14, colour: [0.48, 0.44, 0.32], accent: [0.78, 0.46, 0.46], bulk: 0.3, tail: 0.5, head: 0.3, ears: 0.06 }),
  make({ key: 'chimpanzee', name: 'chimpanzee', form: Form.Primate, gait: G.Walk, social: Z.Troop, size: 7, sight: 0.9, length: 0.85, height: 0.7, likes: [0.9, 0.1, 0, 0.2], temperature: [14, 21, 34, 40], day: 1, night: 0, dusk: 0.1, rest: 6, speed: 2.5, reach: 40, skit: 14, colour: [0.14, 0.12, 0.1], accent: [0.62, 0.5, 0.42], bulk: 0.38, tail: 0, head: 0.24, ears: 0.14, legs: 0.9 }),
  make(draftFor('gorilla')),
  make({ key: 'orangutan', name: 'orangutan', form: Form.Primate, gait: G.Walk, social: Z.Family, size: 2, sight: 0.9, length: 0.9, height: 0.7, likes: [1, 0, 0, 0.1], temperature: [18, 23, 34, 40], day: 1, night: 0, dusk: 0.1, rest: 10, speed: 1.0, reach: 30, skit: 10, traits: T.Climb, colour: [0.66, 0.3, 0.12], accent: [0.5, 0.2, 0.1], bulk: 0.4, tail: 0, ears: 0.05, legs: 1.1 }),
  make({ key: 'howler', name: 'howler monkey', form: Form.Primate, gait: G.Walk, social: Z.Troop, size: 5, sight: 0.8, length: 0.55, height: 0.35, likes: [1, 0, 0, 0.1], temperature: [18, 23, 35, 42], day: 1, night: 0, dusk: 0.2, rest: 8, speed: 1.5, reach: 20, skit: 10, traits: T.Climb, colour: [0.42, 0.2, 0.1], accent: [0.3, 0.14, 0.08], bulk: 0.34, tail: 1, ears: 0.05 }),
  make({ key: 'spidermonkey', name: 'spider monkey', form: Form.Primate, gait: G.Walk, social: Z.Troop, size: 5, sight: 0.8, length: 0.5, height: 0.35, likes: [1, 0, 0, 0.1], temperature: [18, 23, 35, 42], day: 1, night: 0, dusk: 0.2, rest: 6, speed: 2.0, reach: 30, skit: 10, traits: T.Climb, colour: [0.2, 0.15, 0.12], accent: [0.62, 0.56, 0.5], bulk: 0.22, tail: 1.3, legs: 1.3, ears: 0.06 }),
  make({ key: 'lemur', name: 'ring-tailed lemur', form: Form.Primate, gait: G.Bound, social: Z.Troop, size: 7, sight: 0.9, length: 0.42, height: 0.25, likes: [0.5, 0.4, 0, 0.1], rough: 0.4, temperature: [8, 16, 34, 40], day: 1, night: 0, dusk: 0.3, rest: 4, speed: 3.0, reach: 26, skit: 10, traits: T.Bushy, pattern: P.Bands, colour: [0.58, 0.58, 0.6], accent: [0.14, 0.12, 0.12], bulk: 0.24, tail: 1.4, ears: 0.1, legs: 0.9 }),
  make({ key: 'gibbon', name: 'white-handed gibbon', form: Form.Primate, gait: G.Walk, social: Z.Family, size: 3, sight: 0.7, length: 0.45, height: 0.35, likes: [1, 0, 0, 0], temperature: [18, 23, 34, 40], day: 1, night: 0, dusk: 0.1, rest: 5, speed: 2.5, reach: 24, skit: 10, traits: T.Climb, colour: [0.16, 0.14, 0.13], accent: [0.9, 0.88, 0.8], bulk: 0.2, tail: 0, legs: 1.6, ears: 0.05 }),

  make({ key: 'pipistrelle', name: 'common pipistrelle', form: Form.Bat, gait: G.Fly, social: Z.Colony, size: 5, sight: 0.5, length: 0.045, height: 0.02, likes: [0.5, 0.2, 0, 0.5], temperature: [2, 10, 28, 36], season: [0.1, 0.22, 0.65, 0.78], day: 0, night: 1, dusk: 1, shy: 0.7, rest: 3, speed: 5, reach: 30, skit: 3, traits: T.Climb, colour: [0.3, 0.22, 0.18], accent: [0.2, 0.16, 0.14], bulk: 0.25, tail: 0.5, ears: 0.2 }),
  make({ key: 'flyingfox', name: 'grey-headed flying fox', form: Form.Bat, gait: G.Fly, social: Z.Colony, size: 8, sight: 0.9, length: 0.26, height: 0.1, likes: [0.9, 0.1, 0, 0.3], temperature: [8, 16, 34, 40], day: 0, night: 1, dusk: 1, shy: 0.4, rest: 8, speed: 6, reach: 50, skit: 6, traits: T.Climb, colour: [0.28, 0.2, 0.15], accent: [0.8, 0.5, 0.2], bulk: 0.3, tail: 0, ears: 0.1, head: 0.26 }),
  make({ key: 'freetail', name: 'Mexican free-tailed bat', form: Form.Bat, gait: G.Fly, social: Z.Colony, size: 12, sight: 0.5, length: 0.065, height: 0.02, likes: [0.1, 0.5, 0, 0.3], rough: 0.5, temperature: [10, 18, 36, 42], day: 0, night: 1, dusk: 1, shy: 0.5, rest: 3, speed: 8, reach: 60, skit: 3, traits: T.Climb, colour: [0.3, 0.26, 0.24], accent: [0.2, 0.18, 0.16], bulk: 0.22, tail: 0.5, ears: 0.18 }),

  make({ key: 'wolf', name: 'grey wolf', form: Q, gait: G.Trot, social: Z.Pack, size: 6, sight: 1, length: 1.1, height: 0.8, likes: [0.5, 0.5, 0, 0.1], temperature: [-45, -25, 28, 38], day: 0.5, night: 1, dusk: 1, shy: 0.1, rest: 11, speed: 1.6, reach: 70, skit: 26, traits: T.Bushy | T.Ears, colour: [0.52, 0.5, 0.46], accent: [0.78, 0.74, 0.66], bulk: 0.26, neck: 0.2, head: 0.24, tail: 0.4, ears: 0.1, legs: 1.2, rut: 0.9 }),
  make({ key: 'redfox', name: 'red fox', form: Q, gait: G.Trot, social: Z.Family, size: 3, sight: 0.8, length: 0.65, height: 0.4, likes: [0.4, 0.5, 0, 0.2], temperature: [-40, -15, 32, 40], day: 0.4, night: 1, dusk: 1, shy: 0.3, rest: 10, speed: 1.4, reach: 40, skit: 16, traits: T.Bushy | T.Ears, colour: [0.78, 0.38, 0.12], accent: [0.94, 0.92, 0.88], bulk: 0.22, neck: 0.18, head: 0.24, tail: 0.65, ears: 0.14, legs: 0.9 }),
  make({ key: 'arcticfox', name: 'Arctic fox', form: Q, gait: G.Trot, social: Z.Family, size: 3, sight: 0.8, length: 0.55, height: 0.3, likes: [0.1, 0.8, 0, 0.3], temperature: [-60, -40, 10, 22], day: 0.6, night: 0.9, dusk: 0.6, shy: 0.2, rest: 10, speed: 1.3, reach: 40, skit: 14, traits: T.Bushy, colour: [0.95, 0.96, 0.98], accent: [0.84, 0.86, 0.9], bulk: 0.26, neck: 0.16, head: 0.22, tail: 0.6, ears: 0.07, legs: 0.8 }),
  make({ key: 'fennec', name: 'fennec fox', form: Q, gait: G.Bound, social: Z.Family, size: 3, sight: 0.6, length: 0.38, height: 0.2, likes: [0, 0.8, 0, 0], soil: 0.4, temperature: [14, 22, 44, 52], day: 0, night: 1, dusk: 0.6, shy: 0.4, rest: 7, speed: 1.4, reach: 30, skit: 10, traits: T.Ears | T.Burrow, colour: [0.9, 0.78, 0.58], accent: [0.98, 0.96, 0.92], bulk: 0.24, neck: 0.14, head: 0.24, tail: 0.6, ears: 0.34, legs: 0.7 }),
  make({ key: 'coyote', name: 'coyote', form: Q, gait: G.Trot, social: Z.Family, size: 3, sight: 0.8, length: 0.9, height: 0.55, likes: [0.3, 0.7, 0, 0.1], temperature: [-30, -10, 36, 44], day: 0.5, night: 1, dusk: 1, shy: 0.2, rest: 10, speed: 1.6, reach: 60, skit: 20, traits: T.Bushy | T.Ears, colour: [0.58, 0.5, 0.38], accent: [0.8, 0.72, 0.58], bulk: 0.22, neck: 0.18, head: 0.24, tail: 0.5, ears: 0.12, legs: 1 }),
  make({ key: 'jackal', name: 'golden jackal', form: Q, gait: G.Trot, social: Z.Pack, size: 3, sight: 0.8, length: 0.85, height: 0.45, likes: [0.3, 0.7, 0, 0.2], temperature: [4, 14, 38, 46], day: 0.4, night: 1, dusk: 1, shy: 0.2, rest: 9, speed: 1.5, reach: 50, skit: 18, traits: T.Bushy | T.Ears, colour: [0.72, 0.58, 0.34], accent: [0.86, 0.78, 0.6], bulk: 0.22, neck: 0.18, head: 0.24, tail: 0.4, ears: 0.12, legs: 1 }),
  make({ key: 'wilddog', name: 'African wild dog', form: Q, gait: G.Trot, social: Z.Pack, size: 7, sight: 1, length: 0.95, height: 0.65, likes: [0.2, 0.8, 0, 0.1], temperature: [10, 18, 38, 46], day: 0.9, night: 0.2, dusk: 1, shy: 0.1, rest: 9, speed: 2.4, reach: 90, skit: 24, traits: T.Ears, pattern: P.Patches, colour: [0.56, 0.4, 0.2], accent: [0.12, 0.1, 0.1], bulk: 0.2, neck: 0.18, head: 0.22, tail: 0.4, ears: 0.18, legs: 1.2 }),

  make({ key: 'lion', name: 'lion', form: Q, gait: G.Walk, social: Z.Pack, size: 6, sight: 1, length: 1.8, height: 1.1, likes: [0.15, 0.8, 0, 0.15], temperature: [8, 16, 38, 46], day: 0.3, night: 1, dusk: 0.9, shy: 0.1, rest: 30, speed: 1.1, reach: 60, skit: 22, traits: T.Ruff | T.Bushy, colour: [0.78, 0.6, 0.36], accent: [0.4, 0.26, 0.14], bulk: 0.3, neck: 0.16, head: 0.24, tail: 0.5, ears: 0.06, legs: 0.9 }),
  make({ key: 'tiger', name: 'tiger', form: Q, gait: G.Walk, social: Z.Family, size: 3, sight: 0.9, length: 1.9, height: 1.0, likes: [0.6, 0.4, 0, 0.5], temperature: [-25, -8, 36, 44], day: 0.3, night: 1, dusk: 1, shy: 0.1, rest: 30, speed: 1.1, reach: 60, skit: 22, pattern: P.Stripes, colour: [0.88, 0.5, 0.16], accent: [0.1, 0.08, 0.07], bulk: 0.3, neck: 0.16, head: 0.24, tail: 0.5, ears: 0.06, legs: 0.9 }),
  make({ key: 'leopard', name: 'leopard', form: Q, gait: G.Walk, social: Z.Family, size: 2, sight: 0.8, length: 1.3, height: 0.7, likes: [0.6, 0.4, 0, 0.2], rough: 0.2, temperature: [-10, 4, 38, 46], day: 0.3, night: 1, dusk: 0.9, shy: 0.2, rest: 30, speed: 1, reach: 50, skit: 20, traits: T.Climb, pattern: P.Spots, colour: [0.82, 0.62, 0.3], accent: [0.14, 0.1, 0.07], bulk: 0.24, neck: 0.16, head: 0.24, tail: 0.65, ears: 0.06, legs: 0.7 }),
  make({ key: 'jaguar', name: 'jaguar', form: Q, gait: G.Walk, social: Z.Family, size: 2, sight: 0.8, length: 1.5, height: 0.75, likes: [0.6, 0.3, 0, 0.7], temperature: [14, 21, 36, 44], day: 0.3, night: 1, dusk: 0.9, shy: 0.2, rest: 30, speed: 1, reach: 50, skit: 20, pattern: P.Spots, colour: [0.82, 0.6, 0.22], accent: [0.14, 0.1, 0.07], bulk: 0.3, neck: 0.16, head: 0.26, tail: 0.4, ears: 0.06, legs: 0.7 }),
  make({ key: 'cheetah', name: 'cheetah', form: Q, gait: G.Trot, social: Z.Family, size: 3, sight: 0.9, length: 1.2, height: 0.8, likes: [0, 1, 0, 0.1], temperature: [10, 18, 38, 46], day: 1, night: 0.2, dusk: 0.5, shy: 0.1, rest: 26, speed: 1.3, reach: 80, skit: 30, pattern: P.Spots, colour: [0.86, 0.7, 0.4], accent: [0.14, 0.1, 0.07], bulk: 0.18, neck: 0.2, head: 0.18, tail: 0.75, ears: 0.05, legs: 1.5 }),
  make({ key: 'puma', name: 'puma', form: Q, gait: G.Walk, social: Z.Family, size: 2, sight: 0.8, length: 1.4, height: 0.7, likes: [0.5, 0.5, 0, 0.1], rough: 0.4, temperature: [-25, -6, 36, 44], day: 0.3, night: 1, dusk: 0.9, shy: 0.2, rest: 30, speed: 1, reach: 60, skit: 22, colour: [0.72, 0.58, 0.4], accent: [0.9, 0.84, 0.74], bulk: 0.22, neck: 0.16, head: 0.2, tail: 0.7, ears: 0.06, legs: 0.8 }),
  make({ key: 'snowleopard', name: 'snow leopard', form: Q, gait: G.Walk, social: Z.Family, size: 2, sight: 0.7, length: 1.1, height: 0.6, likes: [0, 0.4, 0, 0], rough: 1, temperature: [-40, -22, 14, 26], day: 0.4, night: 0.8, dusk: 1, shy: 0.1, rest: 30, speed: 1, reach: 50, skit: 20, pattern: P.Spots, colour: [0.82, 0.82, 0.8], accent: [0.2, 0.2, 0.22], bulk: 0.26, neck: 0.16, head: 0.2, tail: 0.85, ears: 0.05, legs: 0.7 }),
  make({ key: 'lynx', name: 'Eurasian lynx', form: Q, gait: G.Walk, social: Z.Solo, sight: 0.7, length: 1, height: 0.6, likes: [0.8, 0.2, 0, 0.1], temperature: [-35, -15, 28, 36], day: 0.2, night: 1, dusk: 1, shy: 0.2, rest: 30, speed: 0.9, reach: 40, skit: 18, pattern: P.Fleck, colour: [0.72, 0.58, 0.4], accent: [0.2, 0.15, 0.12], bulk: 0.24, neck: 0.16, head: 0.22, tail: 0.14, ears: 0.1, legs: 1.1 }),
  make({ key: 'wildcat', name: 'wildcat', form: Q, gait: G.Walk, social: Z.Solo, sight: 0.5, length: 0.55, height: 0.3, likes: [0.6, 0.3, 0, 0.1], temperature: [-20, -4, 32, 40], day: 0.3, night: 1, dusk: 1, shy: 0.3, rest: 18, speed: 0.9, reach: 30, skit: 12, pattern: P.Stripes, colour: [0.52, 0.46, 0.38], accent: [0.2, 0.18, 0.16], bulk: 0.24, neck: 0.16, head: 0.22, tail: 0.6, ears: 0.1, legs: 0.8 }),
  make({ key: 'hyena', name: 'spotted hyena', form: Q, gait: G.Trot, social: Z.Pack, size: 6, sight: 1, length: 1.3, height: 0.8, likes: [0.1, 0.9, 0, 0.1], temperature: [6, 14, 38, 46], day: 0.2, night: 1, dusk: 0.9, shy: 0.1, rest: 14, speed: 1.4, reach: 70, skit: 20, traits: T.Ears, pattern: P.Spots, colour: [0.68, 0.58, 0.4], accent: [0.2, 0.15, 0.1], bulk: 0.32, neck: 0.16, head: 0.28, tail: 0.18, ears: 0.1, legs: 0.9 }),

  make({ key: 'brownbear', name: 'brown bear', form: Q, gait: G.Walk, social: Z.Family, size: 3, sight: 1, length: 1.9, height: 1.1, likes: [0.5, 0.4, 0, 0.6], temperature: [-40, -18, 28, 36], season: [0.1, 0.22, 0.72, 0.84], day: 0.6, night: 0.5, dusk: 0.7, shy: 0.1, rest: 22, speed: 0.9, reach: 50, skit: 18, traits: T.Hump, colour: [0.36, 0.24, 0.15], accent: [0.28, 0.18, 0.12], bulk: 0.42, neck: 0.12, head: 0.2, tail: 0.04, ears: 0.05, legs: 0.7 }),
  make({ key: 'polarbear', name: 'polar bear', form: Q, gait: G.Walk, social: Z.Family, size: 2, realm: LS, sight: 1, length: 2.2, height: 1.3, likes: [0, 0.4, 0, 0.8], wet: [0, 0.3, 0, 0.8], temperature: [-60, -40, 6, 16], day: 0.6, night: 0.6, dusk: 0.5, shy: 0.05, rest: 26, speed: 0.9, reach: 80, skit: 22, colour: [0.95, 0.94, 0.88], accent: [0.9, 0.88, 0.8], bulk: 0.36, neck: 0.18, head: 0.18, tail: 0.04, ears: 0.04, legs: 0.7, dive: 30 }),
  make({ key: 'blackbear', name: 'American black bear', form: Q, gait: G.Walk, social: Z.Family, size: 3, sight: 0.9, length: 1.5, height: 0.9, likes: [0.8, 0.2, 0, 0.4], temperature: [-30, -10, 32, 40], season: [0.1, 0.22, 0.72, 0.84], day: 0.6, night: 0.4, dusk: 0.7, shy: 0.2, rest: 22, speed: 0.9, reach: 40, skit: 16, traits: T.Climb, colour: [0.12, 0.1, 0.09], accent: [0.6, 0.45, 0.3], bulk: 0.38, neck: 0.12, head: 0.2, tail: 0.04, ears: 0.06, legs: 0.7 }),
  make({ key: 'panda', name: 'giant panda', form: Q, gait: G.Walk, social: Z.Family, size: 2, sight: 0.9, length: 1.5, height: 0.8, likes: [0.7, 0.2, 0, 0.3], rough: 0.5, temperature: [-10, 2, 22, 30], day: 0.6, night: 0.5, dusk: 0.5, shy: 0.3, rest: 24, speed: 0.5, reach: 24, skit: 12, pattern: P.Saddle, colour: [0.95, 0.95, 0.94], accent: [0.08, 0.08, 0.09], bulk: 0.46, neck: 0.08, head: 0.22, tail: 0.04, ears: 0.06, legs: 0.7 }),

  make({ key: 'stoat', name: 'stoat', form: Form.Long, gait: G.Bound, sight: 0.25, length: 0.28, height: 0.07, likes: [0.3, 0.6, 0, 0.2], temperature: [-35, -14, 26, 34], day: 0.6, night: 0.7, dusk: 0.4, shy: 0.4, rest: 5, speed: 1.4, reach: 22, skit: 6, colour: [0.58, 0.4, 0.24], accent: [0.94, 0.92, 0.86], bulk: 0.16, tail: 0.4 }),
  make({ key: 'marten', name: 'pine marten', form: Form.Long, gait: G.Bound, sight: 0.35, length: 0.5, height: 0.14, likes: [1, 0, 0, 0.1], temperature: [-30, -10, 26, 34], day: 0.2, night: 1, dusk: 0.7, shy: 0.4, rest: 8, speed: 1.2, reach: 30, skit: 10, traits: T.Climb | T.Bushy, colour: [0.4, 0.28, 0.2], accent: [0.94, 0.82, 0.6], bulk: 0.18, tail: 0.6 }),
  make({ key: 'badger', name: 'European badger', form: Q, gait: G.Walk, social: Z.Family, size: 4, sight: 0.6, length: 0.8, height: 0.3, likes: [0.5, 0.4, 0, 0.1], soil: 0.5, temperature: [-12, 0, 28, 36], season: [0.04, 0.14, 0.78, 0.9], day: 0, night: 1, dusk: 0.6, shy: 0.4, rest: 12, speed: 0.8, reach: 30, skit: 8, traits: T.Burrow, pattern: P.Saddle, colour: [0.52, 0.52, 0.52], accent: [0.9, 0.9, 0.9], bulk: 0.42, neck: 0.06, head: 0.28, tail: 0.1, ears: 0.05, legs: 0.5 }),
  make({ key: 'otter', name: 'Eurasian otter', form: Form.Long, gait: G.Swim, social: Z.Family, size: 3, realm: LF, sight: 0.7, length: 0.7, height: 0.2, likes: [0.3, 0.1, 0, 0.9], wet: [0, 0.4, 0, 0.8], temperature: [-20, -5, 26, 34], day: 0.4, night: 1, dusk: 0.8, shy: 0.3, rest: 9, speed: 1, reach: 40, skit: 12, colour: [0.38, 0.26, 0.18], accent: [0.82, 0.74, 0.62], bulk: 0.2, tail: 0.6, ears: 0.03, dive: 16 }),
  make({ key: 'seaotter', name: 'sea otter', form: Form.Long, gait: G.Swim, social: Z.Herd, size: 6, realm: S, sight: 0.9, length: 1, height: 0.2, likes: [0, 0, 0, 0], wet: [0.1, 0.4, 0, 0.7], temperature: [-8, 0, 16, 24], day: 0.9, night: 0.4, dusk: 0.5, shy: 0.1, rest: 20, speed: 0.5, reach: 12, skit: 14, colour: [0.28, 0.2, 0.15], accent: [0.8, 0.7, 0.58], bulk: 0.22, tail: 0.28, ears: 0.03, dive: 40 }),
  make({ key: 'wolverine', name: 'wolverine', form: Q, gait: G.Trot, sight: 0.6, length: 0.85, height: 0.4, likes: [0.4, 0.4, 0, 0], rough: 0.3, temperature: [-50, -30, 14, 24], day: 0.5, night: 0.7, dusk: 0.6, shy: 0.2, rest: 16, speed: 1, reach: 80, skit: 16, traits: T.Bushy, pattern: P.Saddle, colour: [0.2, 0.15, 0.1], accent: [0.72, 0.58, 0.34], bulk: 0.36, neck: 0.1, head: 0.24, tail: 0.3, ears: 0.05, legs: 0.6 }),
  make({ key: 'honeybadger', name: 'honey badger', form: Q, gait: G.Walk, sight: 0.5, length: 0.75, height: 0.28, likes: [0.3, 0.7, 0, 0.1], soil: 0.3, temperature: [4, 14, 40, 48], day: 0.7, night: 0.8, dusk: 0.5, shy: 0.05, rest: 12, speed: 0.9, reach: 60, skit: 5, traits: T.Burrow, pattern: P.Saddle, colour: [0.12, 0.11, 0.11], accent: [0.9, 0.9, 0.88], bulk: 0.4, neck: 0.06, head: 0.24, tail: 0.12, ears: 0, legs: 0.5 }),
  make({ key: 'skunk', name: 'striped skunk', form: Q, gait: G.Walk, social: Z.Family, size: 3, sight: 0.5, length: 0.45, height: 0.2, likes: [0.3, 0.6, 0, 0.1], soil: 0.2, temperature: [-20, -4, 32, 40], season: [0.04, 0.14, 0.76, 0.88], day: 0.2, night: 1, dusk: 0.6, shy: 0.4, rest: 12, speed: 0.6, reach: 24, skit: 5, traits: T.Bushy, pattern: P.Saddle, colour: [0.08, 0.08, 0.09], accent: [0.96, 0.96, 0.96], bulk: 0.3, neck: 0.1, head: 0.2, tail: 0.8, ears: 0.05, legs: 0.5 }),
  make({ key: 'giantotter', name: 'giant otter', form: Form.Long, gait: G.Swim, social: Z.Pack, size: 5, realm: LF, sight: 0.9, length: 1.3, height: 0.3, likes: [0.3, 0.1, 0, 0.9], wet: [0, 0.4, 0, 0.8], temperature: [18, 23, 34, 40], day: 1, night: 0, dusk: 0.2, shy: 0.2, rest: 10, speed: 1.2, reach: 50, skit: 14, colour: [0.34, 0.24, 0.18], accent: [0.9, 0.86, 0.78], bulk: 0.2, tail: 0.5, ears: 0.03, dive: 20 }),
  make({ key: 'meerkat', name: 'meerkat', form: Form.Rodent, gait: G.Burrow, social: Z.Colony, size: 6, sight: 0.8, length: 0.3, height: 0.15, likes: [0, 0.8, 0, 0], soil: 0.6, bias: -0.1, temperature: [6, 16, 38, 46], day: 1, night: 0, dusk: 0.1, shy: 0.4, rest: 8, speed: 0.8, reach: 18, skit: 10, traits: T.Burrow | T.Sentinel, pattern: P.Bands, colour: [0.72, 0.6, 0.44], accent: [0.28, 0.2, 0.14], bulk: 0.3, tail: 0.8, ears: 0.06 }),
  make({ key: 'mongoose', name: 'banded mongoose', form: Form.Long, gait: G.Bound, social: Z.Pack, size: 6, sight: 0.7, length: 0.35, height: 0.12, likes: [0.3, 0.7, 0, 0.1], soil: 0.2, temperature: [10, 18, 38, 46], day: 1, night: 0, dusk: 0.2, shy: 0.4, rest: 7, speed: 1.2, reach: 28, skit: 8, pattern: P.Bands, colour: [0.52, 0.46, 0.36], accent: [0.24, 0.2, 0.16], bulk: 0.22, tail: 0.6 }),
  make({ key: 'raccoon', name: 'raccoon', form: Q, gait: G.Walk, social: Z.Family, size: 3, sight: 0.7, length: 0.6, height: 0.25, likes: [0.6, 0.2, 0, 0.7], temperature: [-20, -4, 32, 40], season: [0.04, 0.14, 0.8, 0.92], day: 0.1, night: 1, dusk: 0.6, shy: 0.4, rest: 10, speed: 0.7, reach: 30, skit: 8, pattern: P.Mask, colour: [0.5, 0.48, 0.46], accent: [0.12, 0.1, 0.1], bulk: 0.36, neck: 0.08, head: 0.24, tail: 0.5, ears: 0.08, legs: 0.5 }),
  make({ key: 'coati', name: 'white-nosed coati', form: Q, gait: G.Walk, social: Z.Troop, size: 7, sight: 0.8, length: 0.55, height: 0.3, likes: [0.7, 0.2, 0, 0.3], temperature: [14, 21, 36, 42], day: 1, night: 0, dusk: 0.2, shy: 0.4, rest: 8, speed: 0.9, reach: 30, skit: 9, traits: T.Snout, pattern: P.Bands, colour: [0.5, 0.36, 0.24], accent: [0.14, 0.1, 0.08], bulk: 0.22, neck: 0.1, head: 0.26, tail: 0.9, ears: 0.06, legs: 0.7 }),

  make({ key: 'harbourseal', name: 'harbour seal', form: Form.Seal, gait: G.Swim, social: Z.Herd, size: 6, realm: LS, sight: 1, length: 1.5, height: 0.35, likes: [0, 0.2, 0, 1], wet: [0.1, 0.2, 0, 0.8], temperature: [-12, 0, 22, 30], day: 0.7, night: 0.4, dusk: 0.4, shy: 0.1, rest: 24, speed: 0.4, reach: 40, skit: 10, traits: T.Flippers, pattern: P.Fleck, colour: [0.52, 0.5, 0.46], accent: [0.2, 0.2, 0.2], bulk: 0.34, dive: 22 }),
  make({ key: 'elephantseal', name: 'southern elephant seal', form: Form.Seal, gait: G.Swim, social: Z.Harem, size: 6, realm: LS, sight: 1, length: 4.5, height: 1, likes: [0, 0.2, 0, 1], wet: [0.3, 0.1, 0, 0.6], temperature: [-30, -14, 14, 22], day: 0.6, night: 0.6, dusk: 0.3, shy: 0, rest: 40, speed: 0.3, reach: 24, skit: 8, traits: T.Flippers | T.Snout, colour: [0.46, 0.4, 0.34], accent: [0.34, 0.3, 0.26], bulk: 0.32, head: 0.14, dive: 40, rut: 0.1 }),
  make({ key: 'sealion', name: 'California sea lion', form: Form.Seal, gait: G.Swim, social: Z.Herd, size: 7, realm: LS, sight: 1, length: 2, height: 0.5, likes: [0, 0.3, 0, 1], wet: [0.2, 0.2, 0, 0.8], temperature: [-2, 6, 26, 34], day: 0.7, night: 0.5, dusk: 0.3, shy: 0.1, rest: 20, speed: 0.6, reach: 40, skit: 10, traits: T.Flippers, colour: [0.38, 0.28, 0.2], accent: [0.28, 0.2, 0.15], bulk: 0.3, head: 0.16, dive: 20 }),
  make({ key: 'walrus', name: 'walrus', form: Form.Seal, gait: G.Swim, social: Z.Herd, size: 8, realm: LS, sight: 1, length: 3, height: 0.9, likes: [0, 0.2, 0, 1], wet: [0.1, 0.4, 0, 0.8], temperature: [-45, -28, 6, 14], day: 0.6, night: 0.6, dusk: 0.3, shy: 0, rest: 40, speed: 0.4, reach: 24, skit: 8, traits: T.Flippers | T.Tusks, horn: Horn.Tusk, hornSize: 0.7, colour: [0.58, 0.42, 0.34], accent: [0.86, 0.82, 0.72], bulk: 0.36, head: 0.16, dive: 30 }),
  make({ key: 'leopardseal', name: 'leopard seal', form: Form.Seal, gait: G.Swim, social: Z.Solo, realm: LS, sight: 0.9, length: 3, height: 0.5, likes: [0, 0.3, 0, 1], wet: [0.2, 0.2, 0, 0.8], temperature: [-45, -28, 6, 16], day: 0.6, night: 0.6, dusk: 0.3, shy: 0.1, rest: 20, speed: 0.8, reach: 50, skit: 12, traits: T.Flippers, pattern: P.Fleck, colour: [0.3, 0.32, 0.36], accent: [0.8, 0.82, 0.84], bulk: 0.22, head: 0.18, dive: 25 }),

  make({ key: 'kangaroo', name: 'red kangaroo', form: Form.Roo, gait: G.Hop, social: Z.Herd, size: 6, sight: 1, length: 1.3, height: 1.1, likes: [0.1, 0.9, 0, 0.1], temperature: [2, 12, 40, 48], day: 0.3, night: 0.8, dusk: 1, shy: 0.2, rest: 12, speed: 1.6, reach: 60, skit: 20, traits: T.Pouch | T.Ears, colour: [0.74, 0.4, 0.22], accent: [0.92, 0.86, 0.76], bulk: 0.22, neck: 0.16, head: 0.2, tail: 0.8, ears: 0.12 }),
  make({ key: 'wallaby', name: 'red-necked wallaby', form: Form.Roo, gait: G.Hop, social: Z.Herd, size: 4, sight: 0.9, length: 0.8, height: 0.7, likes: [0.3, 0.7, 0, 0.1], temperature: [-2, 8, 34, 42], day: 0.3, night: 0.9, dusk: 1, shy: 0.3, rest: 10, speed: 1.4, reach: 40, skit: 16, traits: T.Pouch | T.Ears, colour: [0.52, 0.42, 0.34], accent: [0.76, 0.5, 0.34], bulk: 0.24, neck: 0.16, head: 0.2, tail: 0.8, ears: 0.12 }),
  make({ key: 'koala', name: 'koala', form: Form.Primate, gait: G.Walk, social: Z.Family, size: 2, sight: 0.8, length: 0.7, height: 0.4, likes: [1, 0, 0, 0], temperature: [6, 14, 34, 42], day: 0.2, night: 0.5, dusk: 0.6, shy: 0.3, rest: 40, speed: 0.2, reach: 10, skit: 6, traits: T.Climb | T.Pouch | T.Back, colour: [0.58, 0.58, 0.58], accent: [0.9, 0.9, 0.88], bulk: 0.42, tail: 0, ears: 0.18, head: 0.26, legs: 0.8 }),
  make({ key: 'wombat', name: 'common wombat', form: Q, gait: G.Walk, sight: 0.6, length: 0.95, height: 0.4, likes: [0.3, 0.6, 0, 0.1], soil: 0.5, rough: 0.2, temperature: [-4, 6, 28, 36], day: 0.1, night: 1, dusk: 0.6, shy: 0.4, rest: 18, speed: 0.7, reach: 30, skit: 7, traits: T.Burrow | T.Pouch, colour: [0.44, 0.36, 0.28], accent: [0.34, 0.28, 0.22], bulk: 0.5, neck: 0.05, head: 0.22, tail: 0.04, ears: 0.05, legs: 0.5 }),
  make({ key: 'devil', name: 'Tasmanian devil', form: Q, gait: G.Walk, sight: 0.5, length: 0.65, height: 0.3, likes: [0.5, 0.4, 0, 0.1], temperature: [-4, 6, 26, 34], day: 0.1, night: 1, dusk: 0.6, shy: 0.2, rest: 12, speed: 0.9, reach: 30, skit: 6, traits: T.Pouch, colour: [0.12, 0.1, 0.1], accent: [0.9, 0.9, 0.9], bulk: 0.4, neck: 0.08, head: 0.3, tail: 0.3, ears: 0.1, legs: 0.5 }),
  make({ key: 'possum', name: 'common brushtail possum', form: Form.Rodent, gait: G.Walk, sight: 0.5, length: 0.45, height: 0.18, likes: [0.9, 0.1, 0, 0.1], temperature: [-2, 8, 34, 42], day: 0, night: 1, dusk: 0.4, shy: 0.4, rest: 12, speed: 0.6, reach: 24, skit: 6, traits: T.Climb | T.Pouch | T.Back | T.Bushy, colour: [0.58, 0.54, 0.5], accent: [0.9, 0.88, 0.84], bulk: 0.34, tail: 0.9, ears: 0.14, head: 0.24 }),
  make({ key: 'opossum', name: 'Virginia opossum', form: Form.Rodent, gait: G.Walk, sight: 0.5, length: 0.45, height: 0.2, likes: [0.6, 0.3, 0, 0.3], temperature: [-8, 4, 34, 42], day: 0, night: 1, dusk: 0.4, shy: 0.5, rest: 10, speed: 0.5, reach: 24, skit: 5, traits: T.Pouch | T.Back | T.Snout, colour: [0.68, 0.66, 0.62], accent: [0.9, 0.88, 0.84], bulk: 0.34, tail: 0.8, ears: 0.14, head: 0.28 }),
  make({ key: 'sugarglider', name: 'sugar glider', form: Form.Rodent, gait: G.Bound, sight: 0.25, length: 0.17, height: 0.06, likes: [1, 0, 0, 0], temperature: [6, 14, 34, 42], day: 0, night: 1, dusk: 0.4, shy: 0.5, rest: 3, speed: 3.5, reach: 20, skit: 5, traits: T.Climb | T.Glide | T.Pouch | T.Bushy, pattern: P.Saddle, colour: [0.6, 0.6, 0.64], accent: [0.14, 0.12, 0.14], bulk: 0.34, tail: 1.1, ears: 0.14 }),

  make({ key: 'bluewhale', name: 'blue whale', form: Form.Whale, gait: G.Cruise, social: Z.Solo, realm: S, sight: 1, length: 24, height: 2, likes: [0, 0, 0, 0], wet: [1, 0, 0, -0.4], bias: 0.1, temperature: [-12, 0, 22, 30], season: [0, 0.04, 0.96, 1], day: 1, night: 1, shy: 0, rest: 40, speed: 2, reach: 200, skit: 30, traits: T.Spout | T.Dorsal | T.Flippers, colour: [0.28, 0.36, 0.46], accent: [0.62, 0.7, 0.76], bulk: 0.1, head: 0.28, tail: 0.18, dive: 90 }),
  make({ key: 'humpback', name: 'humpback whale', form: Form.Whale, gait: G.Cruise, social: Z.Family, size: 3, realm: S, sight: 1, length: 14, height: 2, likes: [0, 0, 0, 0], wet: [0.6, 0.2, 0, 0.2], bias: 0.1, temperature: [-8, 2, 28, 34], day: 1, night: 1, shy: 0, rest: 40, speed: 2.2, reach: 160, skit: 28, traits: T.Spout | T.Dorsal | T.Flippers | T.Breach, pattern: P.Fleck, colour: [0.2, 0.24, 0.3], accent: [0.86, 0.88, 0.9], bulk: 0.2, head: 0.24, tail: 0.2, dive: 70, rut: 0.45 }),
  make({ key: 'greywhale', name: 'grey whale', form: Form.Whale, gait: G.Cruise, social: Z.Family, size: 2, realm: S, sight: 1, length: 13, height: 2, likes: [0, 0, 0, 0], wet: [0.1, 0.4, 0, 0.7], bias: 0.1, temperature: [-12, 0, 20, 28], day: 1, night: 1, shy: 0, rest: 40, speed: 1.6, reach: 120, skit: 26, traits: T.Spout | T.Flippers, pattern: P.Fleck, colour: [0.4, 0.42, 0.44], accent: [0.78, 0.8, 0.8], bulk: 0.2, head: 0.22, tail: 0.2, dive: 60 }),
  make({ key: 'spermwhale', name: 'sperm whale', form: Form.Whale, gait: G.Cruise, social: Z.Pod, size: 4, realm: S, sight: 1, length: 14, height: 2, likes: [0, 0, 0, 0], wet: [1, 0, 0, -0.5], bias: 0.1, temperature: [-4, 6, 28, 34], day: 1, night: 1, shy: 0, rest: 40, speed: 1.8, reach: 160, skit: 28, traits: T.Spout | T.Flippers, colour: [0.32, 0.32, 0.36], accent: [0.5, 0.5, 0.54], bulk: 0.22, head: 0.38, tail: 0.18, dive: 100 }),
  make({ key: 'orca', name: 'killer whale', form: Form.Whale, gait: G.Cruise, social: Z.Pod, size: 5, realm: S, sight: 1, length: 7, height: 1.8, likes: [0, 0, 0, 0], wet: [0.4, 0.2, 0, 0.3], bias: 0.1, temperature: [-40, -12, 24, 32], day: 1, night: 0.8, shy: 0, rest: 30, speed: 3.5, reach: 140, skit: 24, traits: T.Spout | T.Dorsal | T.Flippers | T.Breach, pattern: P.Patches, colour: [0.07, 0.08, 0.1], accent: [0.96, 0.96, 0.96], bulk: 0.22, head: 0.2, tail: 0.2, dive: 24 }),
  make({ key: 'bottlenose', name: 'bottlenose dolphin', form: Form.Dolphin, gait: G.Porpoise, social: Z.Pod, size: 6, realm: S, sight: 1, length: 3, height: 0.8, likes: [0, 0, 0, 0], wet: [0.3, 0.4, 0, 0.4], bias: 0.1, temperature: [4, 12, 30, 36], day: 1, night: 0.6, dusk: 0.3, shy: 0, rest: 14, speed: 3.5, reach: 100, skit: 20, traits: T.Spout | T.Dorsal | T.Flippers | T.Breach, colour: [0.46, 0.52, 0.58], accent: [0.86, 0.88, 0.9], bulk: 0.2, head: 0.24, tail: 0.24, dive: 12 }),
  make({ key: 'commondolphin', name: 'common dolphin', form: Form.Dolphin, gait: G.Porpoise, social: Z.Pod, size: 9, realm: S, sight: 1, length: 2.2, height: 0.6, likes: [0, 0, 0, 0], wet: [0.6, 0.2, 0, 0], bias: 0.1, temperature: [4, 12, 28, 34], day: 1, night: 0.6, dusk: 0.3, shy: 0, rest: 12, speed: 4.5, reach: 140, skit: 20, traits: T.Spout | T.Dorsal | T.Flippers | T.Breach, pattern: P.Saddle, colour: [0.32, 0.36, 0.42], accent: [0.88, 0.84, 0.66], bulk: 0.18, head: 0.24, tail: 0.24, dive: 10 }),
  make({ key: 'porpoise', name: 'harbour porpoise', form: Form.Dolphin, gait: G.Cruise, social: Z.Family, size: 2, realm: S, sight: 0.9, length: 1.6, height: 0.5, likes: [0, 0, 0, 0], wet: [0, 0.5, 0, 0.5], bias: 0.1, temperature: [-12, 0, 18, 26], day: 1, night: 0.6, dusk: 0.3, shy: 0.2, rest: 12, speed: 1.6, reach: 60, skit: 20, traits: T.Dorsal | T.Flippers, colour: [0.3, 0.32, 0.36], accent: [0.84, 0.86, 0.88], bulk: 0.2, head: 0.16, tail: 0.24, dive: 12 }),
  make({ key: 'beluga', name: 'beluga', form: Form.Beluga, gait: G.Cruise, social: Z.Pod, size: 6, realm: S, sight: 1, length: 4.3, height: 0.8, likes: [0, 0, 0, 0], wet: [0.1, 0.5, 0, 0.7], bias: 0.1, temperature: [-50, -34, 8, 16], day: 1, night: 0.8, shy: 0, rest: 22, speed: 1.4, reach: 80, skit: 20, traits: T.Spout | T.Flippers, colour: [0.94, 0.94, 0.92], accent: [0.86, 0.86, 0.84], bulk: 0.22, head: 0.18, tail: 0.2, dive: 24 }),
  make({ key: 'narwhal', name: 'narwhal', form: Form.Dolphin, gait: G.Cruise, social: Z.Pod, size: 5, realm: S, sight: 1, length: 4.2, height: 0.8, likes: [0, 0, 0, 0], wet: [0.8, 0.1, 0, 0.1], bias: 0.1, temperature: [-55, -38, 4, 12], day: 1, night: 0.8, shy: 0, rest: 24, speed: 1.4, reach: 80, skit: 20, traits: T.Spout | T.Flippers | T.Tusks, horn: Horn.Tusk, hornSize: 1.4, pattern: P.Fleck, colour: [0.58, 0.58, 0.56], accent: [0.9, 0.9, 0.88], bulk: 0.2, head: 0.14, tail: 0.2, dive: 30 }),
  make({ key: 'riverdolphin', name: 'Amazon river dolphin', form: Form.Dolphin, gait: G.Swim, social: Z.Pod, size: 3, realm: F, sight: 0.9, length: 2.4, height: 0.5, likes: [0, 0, 0, 0], wet: [0.1, 0.5, 0, 0.5], bias: 0.1, temperature: [18, 24, 34, 40], day: 1, night: 0.4, dusk: 0.3, shy: 0.1, rest: 12, speed: 1.2, reach: 60, skit: 14, traits: T.Spout | T.Flippers, colour: [0.86, 0.6, 0.62], accent: [0.9, 0.7, 0.7], bulk: 0.18, head: 0.28, tail: 0.2, dive: 18 }),
  make({ key: 'manatee', name: 'West Indian manatee', form: Form.Sirenian, gait: G.Cruise, social: Z.Family, size: 3, realm: FS, sight: 1, length: 3, height: 0.8, likes: [0, 0, 0, 0], wet: [-0.1, 0.8, 0, 0.3], bias: 0.15, temperature: [16, 22, 34, 40], day: 0.7, night: 0.7, shy: 0.1, rest: 30, speed: 0.4, reach: 40, skit: 8, traits: T.Flippers, colour: [0.46, 0.46, 0.44], accent: [0.52, 0.5, 0.46], bulk: 0.3, head: 0.14, tail: 0.18, dive: 40 }),
  make({ key: 'dugong', name: 'dugong', form: Form.Sirenian, gait: G.Cruise, social: Z.Family, size: 2, realm: S, sight: 1, length: 3, height: 0.8, likes: [0, 0, 0, 0], wet: [0, 0.9, 0, 0.2], bias: 0.15, temperature: [18, 23, 34, 40], day: 0.7, night: 0.7, shy: 0.1, rest: 30, speed: 0.4, reach: 40, skit: 8, traits: T.Flippers, colour: [0.52, 0.5, 0.46], accent: [0.56, 0.52, 0.48], bulk: 0.28, head: 0.14, tail: 0.2, dive: 40 }),

  make({ key: 'zebra', name: 'plains zebra', form: Q, gait: G.Trot, social: Z.Harem, size: 7, sight: 1, length: 2.2, height: 1.3, likes: [0.1, 0.9, 0, 0.2], temperature: [6, 14, 38, 46], day: 1, night: 0.2, dusk: 0.3, shy: 0.1, rest: 12, speed: 1.3, reach: 60, skit: 24, traits: T.Mane | T.Ears, pattern: P.Stripes, colour: [0.94, 0.94, 0.92], accent: [0.08, 0.08, 0.09], bulk: 0.28, neck: 0.22, head: 0.28, tail: 0.3, ears: 0.08, legs: 1.2 }),
  make({ key: 'horse', name: 'Przewalski horse', form: Q, gait: G.Trot, social: Z.Harem, size: 7, sight: 1, length: 2.1, height: 1.3, likes: [0.1, 0.9, 0, 0.1], temperature: [-35, -14, 30, 38], day: 1, night: 0.2, dusk: 0.3, shy: 0.1, rest: 14, speed: 1.3, reach: 60, skit: 24, traits: T.Mane, colour: [0.68, 0.54, 0.38], accent: [0.2, 0.15, 0.1], bulk: 0.28, neck: 0.24, head: 0.28, tail: 0.3, ears: 0.06, legs: 1.2 }),
  make({ key: 'onager', name: 'Asiatic wild ass', form: Q, gait: G.Trot, social: Z.Herd, size: 6, sight: 1, length: 2, height: 1.2, likes: [0, 1, 0, 0.1], temperature: [-25, -6, 38, 46], day: 1, night: 0.2, dusk: 0.4, shy: 0.1, rest: 12, speed: 1.6, reach: 70, skit: 26, traits: T.Mane | T.Ears, colour: [0.72, 0.58, 0.42], accent: [0.94, 0.9, 0.84], bulk: 0.26, neck: 0.22, head: 0.28, tail: 0.28, ears: 0.12, legs: 1.2 }),
  make({ key: 'whiterhino', name: 'white rhinoceros', form: Q, gait: G.Walk, social: Z.Family, size: 3, sight: 1, length: 3.6, height: 1.7, likes: [0.1, 0.9, 0, 0.5], temperature: [8, 16, 38, 46], day: 0.5, night: 0.6, dusk: 0.5, shy: 0.05, rest: 28, speed: 0.8, reach: 40, skit: 16, horn: Horn.Rhino, hornSize: 1, colour: [0.58, 0.55, 0.5], accent: [0.5, 0.46, 0.42], bulk: 0.38, neck: 0.1, head: 0.3, tail: 0.14, ears: 0.05, legs: 0.7 }),
  make({ key: 'indianrhino', name: 'Indian rhinoceros', form: Q, gait: G.Walk, social: Z.Family, size: 2, realm: LF, sight: 1, length: 3.3, height: 1.7, likes: [0.3, 0.6, 0, 0.8], wet: [0, 0.3, 0, 0.4], temperature: [10, 18, 36, 44], day: 0.5, night: 0.6, dusk: 0.5, shy: 0.05, rest: 28, speed: 0.7, reach: 40, skit: 14, horn: Horn.Rhino, hornSize: 0.8, pattern: P.Plain, colour: [0.46, 0.44, 0.42], accent: [0.38, 0.36, 0.34], bulk: 0.4, neck: 0.1, head: 0.28, tail: 0.14, ears: 0.05, legs: 0.7 }),
  make({ key: 'tapir', name: 'Malayan tapir', form: Q, gait: G.Walk, social: Z.Family, size: 2, realm: LF, sight: 0.8, length: 2.2, height: 1, likes: [0.8, 0.2, 0, 0.8], wet: [0, 0.3, 0, 0.4], temperature: [16, 22, 34, 40], day: 0.1, night: 1, dusk: 0.6, shy: 0.3, rest: 20, speed: 0.7, reach: 40, skit: 12, traits: T.Snout, pattern: P.Saddle, colour: [0.1, 0.1, 0.11], accent: [0.94, 0.94, 0.92], bulk: 0.34, neck: 0.08, head: 0.26, tail: 0.04, ears: 0.06, legs: 0.7 }),
  make({ key: 'hippo', name: 'hippopotamus', form: Q, gait: G.Swim, social: Z.Harem, size: 6, realm: LF, sight: 1, length: 3.4, height: 1.4, likes: [0.1, 0.7, 0, 0.8], wet: [0, 0.2, 0, 0.5], temperature: [14, 21, 38, 46], day: 0.3, night: 1, dusk: 0.5, shy: 0.05, rest: 30, speed: 0.6, reach: 30, skit: 12, traits: T.Tusks, colour: [0.56, 0.48, 0.5], accent: [0.78, 0.6, 0.56], bulk: 0.46, neck: 0.04, head: 0.3, tail: 0.04, ears: 0.04, legs: 0.5, dive: 30 }),
  make({ key: 'boar', name: 'wild boar', form: Q, gait: G.Trot, social: Z.Herd, size: 5, sight: 1, length: 1.4, height: 0.8, likes: [0.8, 0.3, 0, 0.3], temperature: [-25, -6, 32, 40], day: 0.3, night: 1, dusk: 0.8, shy: 0.1, rest: 12, speed: 1.2, reach: 40, skit: 14, traits: T.Tusks | T.Snout, colour: [0.28, 0.22, 0.17], accent: [0.6, 0.5, 0.4], bulk: 0.34, neck: 0.1, head: 0.3, tail: 0.1, ears: 0.08, legs: 0.7 }),
  make({ key: 'warthog', name: 'common warthog', form: Q, gait: G.Trot, social: Z.Family, size: 4, sight: 1, length: 1.3, height: 0.7, likes: [0.1, 0.9, 0, 0.3], soil: 0.2, temperature: [8, 16, 38, 46], day: 1, night: 0, dusk: 0.2, shy: 0.2, rest: 10, speed: 1.2, reach: 40, skit: 14, traits: T.Tusks | T.Burrow | T.Mane, colour: [0.42, 0.36, 0.3], accent: [0.2, 0.15, 0.1], bulk: 0.32, neck: 0.1, head: 0.32, tail: 0.3, ears: 0.1, legs: 0.7 }),
  make({ key: 'peccary', name: 'collared peccary', form: Q, gait: G.Trot, social: Z.Herd, size: 7, sight: 0.9, length: 0.95, height: 0.5, likes: [0.6, 0.4, 0, 0.2], temperature: [6, 14, 38, 46], day: 0.8, night: 0.5, dusk: 0.4, shy: 0.2, rest: 9, speed: 1.1, reach: 40, skit: 12, traits: T.Snout, colour: [0.3, 0.26, 0.22], accent: [0.84, 0.8, 0.7], bulk: 0.32, neck: 0.08, head: 0.28, tail: 0.04, ears: 0.06, legs: 0.7 }),
  make({ key: 'dromedary', name: 'dromedary', form: Q, gait: G.Walk, social: Z.Herd, size: 6, sight: 1, length: 2.5, height: 1.8, likes: [0, 0.9, 0, 0], temperature: [0, 12, 44, 52], day: 1, night: 0.2, dusk: 0.2, shy: 0, rest: 20, speed: 1.1, reach: 80, skit: 20, traits: T.Hump | T.Mane, colour: [0.74, 0.6, 0.4], accent: [0.62, 0.48, 0.3], bulk: 0.3, neck: 0.4, head: 0.22, tail: 0.12, ears: 0.04, legs: 1.4 }),
  make({ key: 'bactrian', name: 'wild Bactrian camel', form: Q, gait: G.Walk, social: Z.Herd, size: 5, sight: 1, length: 2.5, height: 1.8, likes: [0, 0.9, 0, 0], rough: 0.1, temperature: [-35, -14, 32, 42], day: 1, night: 0.2, dusk: 0.2, shy: 0, rest: 20, speed: 1, reach: 80, skit: 20, traits: T.Hump | T.Mane, colour: [0.56, 0.44, 0.32], accent: [0.34, 0.26, 0.2], bulk: 0.3, neck: 0.4, head: 0.22, tail: 0.12, ears: 0.04, legs: 1.4 }),
  make({ key: 'guanaco', name: 'guanaco', form: Q, gait: G.Trot, social: Z.Harem, size: 6, sight: 1, length: 1.7, height: 1.1, likes: [0, 0.9, 0, 0.1], rough: 0.4, temperature: [-20, -4, 28, 38], day: 1, night: 0.1, dusk: 0.3, shy: 0.1, rest: 12, speed: 1.4, reach: 70, skit: 24, colour: [0.68, 0.5, 0.32], accent: [0.94, 0.9, 0.84], bulk: 0.24, neck: 0.4, head: 0.2, tail: 0.1, ears: 0.1, legs: 1.4 }),
  make({ key: 'giraffe', name: 'giraffe', form: Q, gait: G.Walk, social: Z.Herd, size: 5, sight: 1, length: 3.2, height: 3.5, likes: [0.5, 0.5, 0, 0.1], temperature: [10, 18, 38, 46], day: 1, night: 0.3, dusk: 0.3, shy: 0, rest: 16, speed: 1.3, reach: 70, skit: 26, horn: Horn.Knob, hornSize: 0.8, pattern: P.Patches, colour: [0.88, 0.72, 0.42], accent: [0.46, 0.28, 0.12], bulk: 0.22, neck: 0.62, head: 0.14, tail: 0.3, ears: 0.05, legs: 1.8 }),

  make(draftFor('reddeer')),
  make(draftFor('roedeer')),
  make(draftFor('fallowdeer')),
  make(draftFor('moose')),
  make(draftFor('reindeer')),
  make(draftFor('whitetail')),

  make({ key: 'bison', name: 'American bison', form: Q, gait: G.Walk, social: Z.Herd, size: 10, sight: 1, length: 3, height: 1.8, likes: [0.1, 1, 0, 0.2], temperature: [-40, -18, 30, 40], day: 0.8, night: 0.4, dusk: 0.4, shy: 0.05, rest: 20, speed: 1.1, reach: 80, skit: 20, traits: T.Hump | T.Ruff, horn: Horn.Short, hornSize: 0.8, colour: [0.28, 0.2, 0.15], accent: [0.2, 0.14, 0.1], bulk: 0.34, neck: 0.12, head: 0.26, tail: 0.18, ears: 0.04, legs: 0.9, rut: 0.35 }),
  make({ key: 'buffalo', name: 'African buffalo', form: Q, gait: G.Walk, social: Z.Herd, size: 10, sight: 1, length: 2.9, height: 1.5, likes: [0.2, 0.8, 0, 0.5], temperature: [8, 16, 38, 46], day: 0.6, night: 0.6, dusk: 0.5, shy: 0.05, rest: 20, speed: 1.1, reach: 70, skit: 20, horn: Horn.Cow, hornSize: 1.2, colour: [0.16, 0.13, 0.11], accent: [0.12, 0.1, 0.09], bulk: 0.36, neck: 0.1, head: 0.26, tail: 0.18, ears: 0.1, legs: 0.8 }),
  make({ key: 'waterbuffalo', name: 'water buffalo', form: Q, gait: G.Walk, social: Z.Herd, size: 8, realm: LF, sight: 1, length: 2.6, height: 1.4, likes: [0.3, 0.6, 0, 0.8], wet: [0, 0.3, 0, 0.4], temperature: [10, 18, 38, 46], day: 0.5, night: 0.6, dusk: 0.5, shy: 0.05, rest: 20, speed: 1, reach: 50, skit: 18, horn: Horn.Cow, hornSize: 1.3, colour: [0.28, 0.26, 0.26], accent: [0.8, 0.78, 0.72], bulk: 0.34, neck: 0.1, head: 0.26, tail: 0.18, ears: 0.1, legs: 0.8 }),
  make({ key: 'yak', name: 'wild yak', form: Q, gait: G.Walk, social: Z.Herd, size: 8, sight: 1, length: 2.8, height: 1.7, likes: [0, 0.9, 0, 0.1], rough: 0.7, temperature: [-40, -22, 12, 22], day: 0.7, night: 0.5, dusk: 0.3, shy: 0.05, rest: 20, speed: 0.9, reach: 60, skit: 18, traits: T.Hump | T.Ruff, horn: Horn.Cow, hornSize: 1, colour: [0.15, 0.12, 0.1], accent: [0.2, 0.16, 0.12], bulk: 0.36, neck: 0.1, head: 0.26, tail: 0.2, ears: 0.04, legs: 0.6 }),
  make({ key: 'muskox', name: 'muskox', form: Q, gait: G.Walk, social: Z.Herd, size: 8, sight: 1, length: 2.2, height: 1.3, likes: [0, 0.9, 0, 0.1], temperature: [-60, -40, 10, 20], day: 0.7, night: 0.6, dusk: 0.3, shy: 0.05, rest: 20, speed: 0.8, reach: 40, skit: 14, traits: T.Ruff, horn: Horn.Cow, hornSize: 0.9, colour: [0.2, 0.16, 0.12], accent: [0.76, 0.7, 0.58], bulk: 0.4, neck: 0.1, head: 0.24, tail: 0.04, ears: 0.03, legs: 0.5 }),
  make({ key: 'wildebeest', name: 'blue wildebeest', form: Q, gait: G.Trot, social: Z.Herd, size: 12, sight: 1, length: 2.2, height: 1.4, likes: [0.05, 1, 0, 0.2], temperature: [10, 18, 38, 46], day: 0.9, night: 0.3, dusk: 0.3, shy: 0.1, rest: 11, speed: 1.6, reach: 100, skit: 24, traits: T.Mane, horn: Horn.Cow, hornSize: 0.8, colour: [0.38, 0.34, 0.32], accent: [0.18, 0.15, 0.13], bulk: 0.26, neck: 0.18, head: 0.3, tail: 0.3, ears: 0.08, legs: 1.1, rut: 0.45 }),
  make({ key: 'impala', name: 'impala', form: Q, gait: G.Trot, social: Z.Harem, size: 9, sight: 1, length: 1.3, height: 0.9, likes: [0.3, 0.7, 0, 0.3], temperature: [10, 18, 38, 46], day: 0.9, night: 0.2, dusk: 0.6, shy: 0.1, rest: 9, speed: 1.6, reach: 50, skit: 24, horn: Horn.Lyre, hornSize: 1, colour: [0.74, 0.46, 0.26], accent: [0.94, 0.92, 0.86], bulk: 0.2, neck: 0.22, head: 0.22, tail: 0.12, ears: 0.1, legs: 1.3, rut: 0.45 }),
  make({ key: 'gazelle', name: "Thomson's gazelle", form: Q, gait: G.Trot, social: Z.Herd, size: 10, sight: 1, length: 1.1, height: 0.65, likes: [0, 1, 0, 0.1], temperature: [10, 18, 38, 46], day: 0.9, night: 0.2, dusk: 0.6, shy: 0.1, rest: 8, speed: 2, reach: 70, skit: 26, horn: Horn.Lyre, hornSize: 0.8, pattern: P.Saddle, colour: [0.76, 0.54, 0.32], accent: [0.14, 0.11, 0.09], bulk: 0.2, neck: 0.22, head: 0.2, tail: 0.14, ears: 0.1, legs: 1.4 }),
  make({ key: 'springbok', name: 'springbok', form: Q, gait: G.Trot, social: Z.Herd, size: 10, sight: 1, length: 1.2, height: 0.8, likes: [0, 1, 0, 0.05], temperature: [0, 12, 38, 46], day: 0.9, night: 0.2, dusk: 0.6, shy: 0.1, rest: 8, speed: 2, reach: 70, skit: 26, horn: Horn.Lyre, hornSize: 0.7, pattern: P.Saddle, colour: [0.78, 0.56, 0.34], accent: [0.96, 0.94, 0.9], bulk: 0.2, neck: 0.22, head: 0.2, tail: 0.1, ears: 0.1, legs: 1.4 }),
  make({ key: 'oryx', name: 'gemsbok', form: Q, gait: G.Trot, social: Z.Herd, size: 8, sight: 1, length: 1.8, height: 1.2, likes: [0, 1, 0, 0], temperature: [0, 12, 44, 52], day: 0.8, night: 0.4, dusk: 0.5, shy: 0, rest: 12, speed: 1.5, reach: 100, skit: 22, horn: Horn.Straight, hornSize: 1.4, pattern: P.Mask, colour: [0.74, 0.66, 0.56], accent: [0.14, 0.12, 0.1], bulk: 0.26, neck: 0.18, head: 0.28, tail: 0.3, ears: 0.1, legs: 1.1 }),
  make({ key: 'kudu', name: 'greater kudu', form: Q, gait: G.Trot, social: Z.Family, size: 5, sight: 1, length: 2.2, height: 1.4, likes: [0.7, 0.3, 0, 0.2], rough: 0.2, temperature: [6, 14, 38, 46], day: 0.5, night: 0.5, dusk: 1, shy: 0.2, rest: 12, speed: 1.4, reach: 50, skit: 24, pattern: P.Stripes, horn: Horn.Lyre, hornSize: 1.6, colour: [0.62, 0.5, 0.4], accent: [0.94, 0.94, 0.9], bulk: 0.22, neck: 0.22, head: 0.24, tail: 0.14, ears: 0.14, legs: 1.3 }),
  make({ key: 'ibex', name: 'Alpine ibex', form: Q, gait: G.Trot, social: Z.Herd, size: 7, sight: 0.9, length: 1.4, height: 0.85, likes: [0, 0.5, 0, 0], rough: 1, temperature: [-25, -8, 20, 30], day: 0.8, night: 0.2, dusk: 0.5, shy: 0.1, rest: 12, speed: 1, reach: 40, skit: 18, horn: Horn.Curl, hornSize: 1.5, colour: [0.52, 0.44, 0.36], accent: [0.76, 0.7, 0.62], bulk: 0.28, neck: 0.16, head: 0.22, tail: 0.06, ears: 0.08, legs: 0.8, rut: 0.8 }),
  make({ key: 'mountaingoat', name: 'mountain goat', form: Q, gait: G.Walk, social: Z.Herd, size: 5, sight: 0.9, length: 1.5, height: 1, likes: [0, 0.4, 0, 0], rough: 1, temperature: [-35, -15, 16, 26], day: 0.8, night: 0.2, dusk: 0.4, shy: 0.1, rest: 14, speed: 0.8, reach: 30, skit: 14, traits: T.Mane, horn: Horn.Short, hornSize: 0.7, colour: [0.96, 0.95, 0.9], accent: [0.9, 0.88, 0.8], bulk: 0.28, neck: 0.12, head: 0.2, tail: 0.04, ears: 0.06, legs: 0.7 }),
  make({ key: 'bighorn', name: 'bighorn sheep', form: Q, gait: G.Trot, social: Z.Herd, size: 7, sight: 0.9, length: 1.6, height: 0.95, likes: [0, 0.6, 0, 0], rough: 0.9, temperature: [-30, -10, 26, 36], day: 0.8, night: 0.2, dusk: 0.4, shy: 0.1, rest: 12, speed: 1.1, reach: 50, skit: 18, horn: Horn.Curl, hornSize: 1.6, colour: [0.52, 0.42, 0.32], accent: [0.92, 0.9, 0.84], bulk: 0.28, neck: 0.14, head: 0.22, tail: 0.04, ears: 0.06, legs: 0.9, rut: 0.7 }),
  make({ key: 'mouflon', name: 'mouflon', form: Q, gait: G.Trot, social: Z.Herd, size: 7, sight: 0.9, length: 1.2, height: 0.75, likes: [0.2, 0.6, 0, 0], rough: 0.6, temperature: [-14, -2, 30, 38], day: 0.7, night: 0.3, dusk: 0.6, shy: 0.1, rest: 11, speed: 1.2, reach: 50, skit: 18, horn: Horn.Curl, hornSize: 1.2, colour: [0.5, 0.34, 0.22], accent: [0.92, 0.88, 0.8], bulk: 0.28, neck: 0.14, head: 0.2, tail: 0.05, ears: 0.06, legs: 0.9, rut: 0.65 }),
  make({ key: 'saiga', name: 'saiga', form: Q, gait: G.Trot, social: Z.Herd, size: 10, sight: 1, length: 1.25, height: 0.75, likes: [0, 1, 0, 0.05], temperature: [-40, -20, 30, 40], day: 0.8, night: 0.4, dusk: 0.5, shy: 0.1, rest: 9, speed: 1.8, reach: 90, skit: 22, traits: T.Snout, horn: Horn.Straight, hornSize: 0.6, colour: [0.78, 0.66, 0.5], accent: [0.94, 0.9, 0.84], bulk: 0.24, neck: 0.18, head: 0.28, tail: 0.04, ears: 0.06, legs: 1.1 }),
  make({ key: 'chamois', name: 'chamois', form: Q, gait: G.Trot, social: Z.Herd, size: 6, sight: 0.9, length: 1.1, height: 0.75, likes: [0.2, 0.5, 0, 0], rough: 1, temperature: [-25, -8, 24, 32], day: 0.8, night: 0.2, dusk: 0.6, shy: 0.1, rest: 10, speed: 1.4, reach: 40, skit: 20, pattern: P.Mask, horn: Horn.Short, hornSize: 0.5, colour: [0.56, 0.4, 0.26], accent: [0.14, 0.1, 0.08], bulk: 0.22, neck: 0.16, head: 0.2, tail: 0.03, ears: 0.1, legs: 1.1 }),

  make({ key: 'elephant', name: 'African bush elephant', form: Q, gait: G.Walk, social: Z.Herd, size: 8, sight: 1, length: 6, height: 3.3, likes: [0.3, 0.7, 0, 0.5], temperature: [8, 16, 38, 46], day: 0.7, night: 0.6, dusk: 0.4, shy: 0, rest: 22, speed: 1.1, reach: 80, skit: 22, traits: T.Trunk | T.Tusks | T.Ears, horn: Horn.Tusk, hornSize: 1, colour: [0.52, 0.5, 0.48], accent: [0.46, 0.44, 0.42], bulk: 0.38, neck: 0.06, head: 0.24, tail: 0.14, ears: 0.34, legs: 0.7 }),
  make({ key: 'asianelephant', name: 'Asian elephant', form: Q, gait: G.Walk, social: Z.Herd, size: 7, sight: 1, length: 5.5, height: 2.8, likes: [0.6, 0.4, 0, 0.5], temperature: [14, 21, 36, 42], day: 0.7, night: 0.6, dusk: 0.4, shy: 0, rest: 22, speed: 1.1, reach: 70, skit: 20, traits: T.Trunk | T.Tusks | T.Ears, horn: Horn.Tusk, hornSize: 0.5, colour: [0.48, 0.46, 0.44], accent: [0.44, 0.42, 0.4], bulk: 0.38, neck: 0.06, head: 0.24, tail: 0.14, ears: 0.2, legs: 0.7 }),
  make({ key: 'hyrax', name: 'rock hyrax', form: Form.Rodent, gait: G.Walk, social: Z.Colony, size: 6, sight: 0.6, length: 0.5, height: 0.2, likes: [0, 0.5, 0, 0], rough: 1, temperature: [4, 14, 38, 46], day: 1, night: 0, dusk: 0.2, shy: 0.4, rest: 12, speed: 0.5, reach: 14, skit: 8, traits: T.Sentinel, colour: [0.5, 0.42, 0.34], accent: [0.76, 0.68, 0.56], bulk: 0.4, tail: 0, ears: 0.04 }),
  make({ key: 'sloth', name: 'brown-throated sloth', form: Form.Primate, gait: G.Walk, social: Z.Family, size: 2, sight: 0.7, length: 0.55, height: 0.3, likes: [1, 0, 0, 0.1], temperature: [20, 25, 34, 40], day: 0.5, night: 0.5, dusk: 0.3, shy: 0.3, rest: 60, speed: 0.1, reach: 8, skit: 4, traits: T.Climb | T.Back, colour: [0.5, 0.46, 0.38], accent: [0.62, 0.58, 0.46], bulk: 0.4, tail: 0, ears: 0.02, head: 0.24, legs: 1.1 }),
];

export const MAMMAL_COUNT = MAMMALS.length;

export const MAMMAL_STARTS: readonly number[] = MAMMALS.reduce<number[]>((starts, species) => [...starts, (starts[starts.length - 1] ?? 0) + species.slots], [0]);

export const MAMMAL_SLOTS = MAMMAL_STARTS[MAMMAL_COUNT]!;

export const MAMMAL_CELL_TILES = 16;

export const MAMMAL_TABLE_WIDTH = 15;

export const YOUNG_SIZE = 0.62;

export const CALF_SIZE = 0.42;

export const bodyTexels = (species: MammalSpecies): number => 3 + 16 * species.length;

export interface Weather {
  celsius: number;
  year: number;
  daylight: number;
  wet: number;
  snow: number;
}

export interface Extras {
  rough: number;
  soil: number;
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const mediumOf = (habitat: Habitat): number => (habitat[2] <= WATER_PRESENT ? (habitat[2] >= CLIFF_SEEN ? MediumBit.Cliff : MediumBit.Land) : habitat[2] < FRESH_WATER_FROM ? MediumBit.Sea : MediumBit.Fresh);

export const lives = (species: MammalSpecies, habitat: Habitat): boolean => (species.realm & mediumOf(habitat)) !== 0;

export const activity = (species: MammalSpecies, daylight: number): number =>
  Math.min(1, Math.max(0, species.night + (species.day - species.night) * daylight + species.dusk * 4 * daylight * (1 - daylight)));

export const sheltering = (species: MammalSpecies, wet: number): number => 1 - species.shy * smooth(WET_FROM, WET_TO, wet);

export const warmth = (species: MammalSpecies, celsius: number): number => trapezoid(species.temperature, celsius);

export const suitability = (species: MammalSpecies, habitat: Habitat, extras: Extras = { rough: 0, soil: 0 }): number => {
  const weights = habitat[2] <= WATER_PRESENT ? species.likes : species.wet;
  const land = habitat[2] <= WATER_PRESENT ? species.rough * extras.rough + species.soil * extras.soil : 0;
  return Math.min(1, Math.max(0, species.bias + weights[0] * habitat[0] + weights[1] * habitat[1] + weights[3] * habitat[3] + land));
};

export function abundance(species: MammalSpecies, habitat: Habitat, extras: Extras, weather: Weather): number {
  if (!lives(species, habitat)) return 0;
  return (
    suitability(species, habitat, extras) *
    warmth(species, weather.celsius) *
    trapezoid(species.season, weather.year) *
    activity(species, weather.daylight) *
    sheltering(species, weather.wet) *
    (1 - smooth(SNOW_FROM, SNOW_TO, weather.snow))
  );
}

export function tableRow(species: MammalSpecies, diet: number): number[] {
  return [
    ...species.likes,
    ...species.wet,
    ...species.temperature,
    ...species.season,
    species.day, species.night, species.dusk, species.shy,
    species.length, species.height, species.form, species.gait,
    ...species.colour, species.spots,
    ...species.accent, species.bulk,
    ...species.eye, species.bias,
    species.realm, species.rest, species.speed, species.reach,
    species.skit, species.traits, species.social, species.sight,
    species.horn, species.pattern, species.neck, species.head,
    species.legs, species.tail, species.ears, species.rut,
    species.size, species.groups, species.hornSize, species.dive,
    diet, species.hornBoth ? 1 : 0, 0, 0,
  ];
}
