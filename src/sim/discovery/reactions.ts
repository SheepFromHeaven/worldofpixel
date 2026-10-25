import { ItemType } from '../people/items.ts';
import type { Piece } from './piece.ts';
import { PieceState } from './piece.ts';
import type { Trial } from './trial.ts';

export type Verb = 'strike' | 'knock' | 'tap' | 'rub' | 'scrape' | 'chop' | 'feed' | 'light' | 'press' | 'poke' | 'stir' | 'lay on';

export interface Reaction {
  verb: Verb;
  apply(trial: Trial, held: Piece, target: Piece): void;
}

const CHIPS_TO_SHAPE = 3;

const SPARK_REACH = 0.2;

const BRIGHT_SPARKS = 0.45;

const DULL_SPARKS = 0.1;

const SMOULDER_FEED_SECONDS = 2;

const nothing = (verb: Verb, effect: 'thunk' | 'dust' = 'thunk'): Reaction => ({
  verb,
  apply: (trial, _held, target) => trial.effect(effect, target.x, target.y),
});

const sparking = (chance: number): Reaction => ({
  verb: 'strike',
  apply: (trial, _held, target) => {
    trial.effect(chance >= BRIGHT_SPARKS ? 'spray' : 'chip', target.x, target.y);
    trial.sparksOver(target.x, target.y, SPARK_REACH, chance);
  },
});

const knapping: Reaction = {
  verb: 'knock',
  apply: (trial, _held, target) => {
    target.chips += 1;
    trial.effect('chip', target.x, target.y);
    if (target.chips >= CHIPS_TO_SHAPE) {
      target.kind = ItemType.HandAxe;
      target.chips = 0;
      trial.effect('dust', target.x, target.y);
    }
  },
};

const chopping: Reaction = {
  verb: 'chop',
  apply: (trial, _held, target) => {
    target.kind = ItemType.DryKindling;
    trial.pieces.push(trial.make(ItemType.DryKindling, target.x + 0.05, target.y + 0.03));
    trial.effect('chip', target.x, target.y);
  },
};

const feedingBranch: Reaction = {
  verb: 'feed',
  apply: (trial, held, target) => {
    target.spent = true;
    held.state = PieceState.Burning;
    trial.effect('flare', target.x, target.y);
  },
};

const feedingTorch: Reaction = {
  verb: 'feed',
  apply: (trial, held, target) => {
    held.spent = true;
    trial.held = null;
    target.state = PieceState.Burning;
    trial.effect('flare', target.x, target.y);
  },
};

const feedingKindling: Reaction = {
  verb: 'feed',
  apply: (trial, held, target) => {
    held.spent = true;
    trial.held = null;
    target.timer += SMOULDER_FEED_SECONDS;
    trial.effect('smoke', target.x, target.y);
  },
};

const smothering: Reaction = {
  verb: 'press',
  apply: (trial, _held, target) => {
    target.state = PieceState.Ash;
    trial.effect('snuff', target.x, target.y);
  },
};

const lighting: Reaction = {
  verb: 'light',
  apply: (trial, held, target) => {
    held.kind = ItemType.Torch;
    trial.effect('flare', target.x, target.y);
  },
};

const kindlingFromTorch: Reaction = {
  verb: 'light',
  apply: (trial, _held, target) => trial.smoulder(target),
};

const burningFed: Reaction = {
  verb: 'feed',
  apply: (trial, held, target) => {
    held.spent = true;
    trial.held = null;
    trial.effect('flare', target.x, target.y);
  },
};

export function reactionBetween(held: Piece, target: Piece): Reaction {
  if (target.state === PieceState.Ash) return nothing('stir', 'dust');

  if (held.state === PieceState.Burning) {
    if (target.state === PieceState.Plain && target.kind === ItemType.DryKindling) return kindlingFromTorch;
    return nothing('tap');
  }

  if (target.state === PieceState.Burning) {
    if (held.kind === ItemType.Branch) return lighting;
    if (held.kind === ItemType.DryKindling) return burningFed;
    return nothing('poke');
  }

  if (target.state === PieceState.Smouldering) {
    if (held.kind === ItemType.Branch) return feedingBranch;
    if (held.kind === ItemType.DryKindling) return feedingKindling;
    if (held.kind === ItemType.Torch) return feedingTorch;
    return smothering;
  }

  switch (held.kind) {
    case ItemType.Flint:
      if (target.kind === ItemType.Flint) return sparking(BRIGHT_SPARKS);
      if (target.kind === ItemType.Stone) return sparking(DULL_SPARKS);
      if (target.kind === ItemType.HandAxe) return sparking(BRIGHT_SPARKS);
      if (target.kind === ItemType.Branch) return nothing('scrape', 'dust');
      return nothing('rub', 'dust');
    case ItemType.HandAxe:
      if (target.kind === ItemType.Branch) return chopping;
      if (target.kind === ItemType.Flint) return sparking(BRIGHT_SPARKS);
      if (target.kind === ItemType.Stone) return sparking(DULL_SPARKS);
      return nothing('tap');
    case ItemType.Stone:
      if (target.kind === ItemType.Flint) return knapping;
      return nothing('knock', 'dust');
    case ItemType.Torch:
      if (target.kind === ItemType.DryKindling) return kindlingFromTorch;
      return nothing('tap');
    case ItemType.DryKindling:
      return nothing('lay on');
    default:
      return nothing('tap');
  }
}
