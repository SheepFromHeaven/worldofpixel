export const ANIMAL_CAPACITY = 2048;

export const EMPTY = 255;

export type AnimalColumn = Float32Array | Uint8Array;

export interface AnimalFrame {
  n: number;
  columns: Record<string, AnimalColumn>;
}

export class AnimalStore {
  n = 0;
  readonly posX = new Float32Array(ANIMAL_CAPACITY);
  readonly posY = new Float32Array(ANIMAL_CAPACITY);
  readonly posZ = new Float32Array(ANIMAL_CAPACITY);
  readonly pitch = new Float32Array(ANIMAL_CAPACITY);
  readonly dirX = new Float32Array(ANIMAL_CAPACITY);
  readonly dirY = new Float32Array(ANIMAL_CAPACITY);
  readonly key = new Float32Array(ANIMAL_CAPACITY);
  readonly travelled = new Float32Array(ANIMAL_CAPACITY);
  readonly groupKey = new Float32Array(ANIMAL_CAPACITY);
  readonly glance = new Float32Array(ANIMAL_CAPACITY);
  readonly denX = new Float32Array(ANIMAL_CAPACITY);
  readonly denY = new Float32Array(ANIMAL_CAPACITY);
  readonly species = new Uint8Array(ANIMAL_CAPACITY).fill(EMPTY);
  readonly stage = new Uint8Array(ANIMAL_CAPACITY);
  readonly going = new Uint8Array(ANIMAL_CAPACITY);
  readonly state = new Uint8Array(ANIMAL_CAPACITY);
  readonly since = new Float32Array(ANIMAL_CAPACITY);
  readonly left = new Float32Array(ANIMAL_CAPACITY);
  readonly member = new Uint8Array(ANIMAL_CAPACITY);

  columns(): Record<string, AnimalColumn> {
    return {
      posX: this.posX,
      posY: this.posY,
      posZ: this.posZ,
      pitch: this.pitch,
      dirX: this.dirX,
      dirY: this.dirY,
      key: this.key,
      travelled: this.travelled,
      groupKey: this.groupKey,
      glance: this.glance,
      denX: this.denX,
      denY: this.denY,
      species: this.species,
      stage: this.stage,
      going: this.going,
      state: this.state,
      since: this.since,
      left: this.left,
      member: this.member,
    };
  }

  pack(): AnimalFrame {
    const columns: Record<string, AnimalColumn> = {};
    for (const [name, array] of Object.entries(this.columns())) columns[name] = array.slice(0, this.n);
    return { n: this.n, columns };
  }

  unpack(frame: AnimalFrame): void {
    const own = this.columns();
    for (const [name, values] of Object.entries(frame.columns)) own[name]?.set(values);
    for (let at = frame.n; at < this.n; at += 1) this.species[at] = EMPTY;
    this.n = frame.n;
  }
}
