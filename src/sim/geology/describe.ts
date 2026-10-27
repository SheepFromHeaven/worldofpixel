import { Cave, CAVE_NAMES, Life, LIFE_NAMES } from './caves.ts';
import type { Sample } from './geology.ts';
import { FORM_NAMES, mineralOf, Mineral } from './minerals.ts';
import { rockOf } from './rocks.ts';

export interface Described {
  title: string;
  where: string;
  mineral: string | null;
  note: string | null;
}

const metres = (value: number): string => `${Math.round(Math.abs(value))} m`;

const firstSentence = (text: string): string => {
  const end = text.indexOf('. ');
  return end < 0 ? text : text.slice(0, end + 1);
};

export function describeCell(sample: Sample, ground: number, elevation: number): Described {
  const level = elevation === 0 ? 'at sea level' : `${metres(elevation)} ${elevation > 0 ? 'above' : 'below'} sea level`;

  if (sample.cave >= Cave.Air) {
    if (sample.cave === Cave.Water) return { title: 'open water', where: `${metres(sample.above)} above the bed, ${level}`, mineral: null, note: null };
    return { title: 'open air', where: `${metres(sample.above)} above the ground, ${level}`, mineral: null, note: null };
  }

  const rock = rockOf(sample.rock);
  const below = ground - elevation;
  const where = `${below < 0.5 ? 'at the ground' : `${metres(below)} below the ground`}, ${level}`;
  const cave = sample.cave > Cave.Solid && sample.cave < Cave.Air ? CAVE_NAMES[sample.cave]! : null;
  const title = cave ? `${cave} in ${rock.name}` : rock.name;

  const floor = cave && sample.cave !== Cave.Flooded && sample.life !== Life.Bare ? `floor of ${LIFE_NAMES[sample.life]}` : null;

  if (sample.mineral === Mineral.None) {
    return {
      title,
      where,
      mineral: floor ?? `${rock.group}, hardness ${rock.hardness}${rock.soluble ? ', dissolves' : ''}`,
      note: floor ? `${rock.group}, hardness ${rock.hardness}` : firstSentence(rock.made),
    };
  }

  const kind = mineralOf(sample.mineral);
  return {
    title: cave ? title : `${rock.name} with ${kind.name}`,
    where,
    mineral: `${kind.name}: ${kind.class}, ${FORM_NAMES[kind.form]}, hardness ${kind.mohs}`,
    note: firstSentence(kind.uses),
  };
}
