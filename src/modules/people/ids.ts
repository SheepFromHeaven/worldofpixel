const FIRST_CONTRIBUTED = 32;

const LAST = 255;

const make = (kind: string) => {
  const named = new Map<string, number>();
  return (name: string): number => {
    const known = named.get(name);
    if (known !== undefined) return known;
    const id = FIRST_CONTRIBUTED + named.size;
    if (id > LAST) throw new Error(`no room for the ${kind} ${name}`);
    named.set(name, id);
    return id;
  };
};

export const allocateState = make('state');

export const allocateTask = make('task');
