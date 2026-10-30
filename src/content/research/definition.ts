export type ResearchKind = 'thing' | 'happening';

export interface Recipe {
  readonly parents: readonly [string, string];
  readonly spend: readonly string[];
  readonly make: readonly string[];
  readonly title: string;
  readonly words: string;
  readonly order?: string;
  readonly station?: string;
}

export interface ResearchDef {
  readonly key: string;
  readonly label: string;
  readonly kind: ResearchKind;
  readonly item: string | null;
  readonly recipe: Recipe | null;
  readonly goal: boolean;
}

export interface ResearchPart {
  readonly item?: string;
  readonly recipe?: Recipe;
  readonly goal?: boolean;
}

export const research = (key: string, label: string, ...parts: readonly ResearchPart[]): ResearchDef => {
  const merged: { item?: string; recipe?: Recipe; goal?: boolean } = {};
  for (const part of parts) Object.assign(merged, part);
  return { key, label, kind: merged.item ? 'thing' : 'happening', item: merged.item ?? null, recipe: merged.recipe ?? null, goal: merged.goal ?? false };
};

export const thing = (item: string): ResearchPart => ({ item });

export const from = (parents: readonly [string, string], title: string, words: string, extra: { spend?: readonly string[]; make?: readonly string[]; order?: string; station?: string } = {}): ResearchPart => ({
  recipe: { parents, title, words, spend: extra.spend ?? [], make: extra.make ?? [], ...(extra.order ? { order: extra.order } : {}), ...(extra.station ? { station: extra.station } : {}) },
});

export const goal = (): ResearchPart => ({ goal: true });
