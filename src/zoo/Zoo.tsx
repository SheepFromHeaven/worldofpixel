import { useEffect, useMemo, useRef, useState } from 'react';
import { applyCamera, screenToWorld, visibleBounds, zoomAbout } from '../render/camera.ts';
import type { Viewport } from '../render/camera.ts';
import type { LitLayer } from '../render/lit/litLayer.ts';
import { createLitLayer } from '../render/lit/litLayer.ts';
import { bufferFor, present, SCALE } from '../render/screen.ts';
import type { Bounds, Vec2 } from '../sim/geometry.ts';
import { TEXELS_PER_TILE } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';
import { PixelText } from '../ui/pixel/Pixel.tsx';
import type { ZooEntry } from './catalogue.ts';
import { ZOO } from './catalogue.ts';
import { groundPattern } from './groundTexture.ts';
import type { Tab } from './Library.tsx';
import { Library } from './Library.tsx';
import { drawCloseUp, layoutFor, toFloor } from '../ui/closeUp.ts';
import { Model3D, modelled } from './Model3D.tsx';
import type { Piece } from './pieces.ts';
import { DEFAULT_STAGE, STAGES } from './pieces.ts';
import { ERASE_RADIUS, Scene } from './scene.ts';
import { stageWorld, TERRAINS } from './stage.ts';
import type { Terrain } from './stage.ts';
import { emptyFauna, lightingFor, stillSky } from './surroundings.ts';
import type { Switches } from './Toolbar.tsx';
import { Toolbar } from './Toolbar.tsx';
import type { ZooReadout } from './zoo.ts';
import type { Placement } from './zoo.ts';
import { stageHost } from './host.ts';
import { MindPanel } from '../ui/MindPanel.tsx';
import type { MindHost } from '../ui/mindArt.ts';
import type { MindView } from '../sim/mind/mind.ts';
import { drawBubbleOf, drawPulse } from '../ui/tileCursor.ts';
import { lightSourcesOf } from '../render/lit/lightSources.ts';
import { flickered } from '../render/lit/lighting.ts';
import { StageSim } from '../sim/stageSim.ts';
import type { RadialHost } from '../ui/radialSlices.ts';
import { slicesFor } from '../ui/radialSlices.ts';
import { RadialMenuController } from '../ui/radialMenu.ts';
import { NOWHERE } from '../sim/grid.ts';
import { People, POPULATION } from '../sim/people/people.ts';
import type { ItemType } from '../sim/people/items.ts';
import { ITEM_NAMES } from '../sim/people/items.ts';
import type { StructureKind } from './structures.ts';
import { eraseStructures, placeStructure, STRUCTURES, structuresOf } from './structures.ts';
import { ZooSession } from './zoo.ts';

const CLICK_SLOP = 4;

const READOUT_SECONDS = 0.25;

const GRID_FAINT = 'rgba(0,0,0,0.045)';

const GRID_STRONG = 'rgba(0,0,0,0.1)';

const PLACE_RING = '#e3dabb';

const ERASE_RING = '#c05140';

const ADDRESS_DELAY_MILLISECONDS = 300;

const NOON = 0.5;

const SUMMER = 0.3;

const HOUR_NAMES: Readonly<Record<string, number>> = { dawn: 0.27, day: 0.5, noon: 0.5, dusk: 0.73, night: 0 };

const SEASON_NAMES: Readonly<Record<string, number>> = { spring: 0.05, summer: 0.3, autumn: 0.62, winter: 0.85 };

const fromAddress = (name: string): string | null => new URLSearchParams(window.location.search).get(name);

const writeAddress = (name: string, value: string): void => {
  const address = new URL(window.location.href);
  address.searchParams.set(name, value);
  window.history.replaceState(null, '', address);
};

const numberFrom = (name: string, named: Readonly<Record<string, number>>, fallback: number): number => {
  const given = fromAddress(name);
  if (given === null) return fallback;
  const known = named[given];
  if (known !== undefined) return known;
  const value = Number(given);
  return Number.isFinite(value) ? ((value % 1) + 1) % 1 : fallback;
};

const STARTING: Switches = { grid: true, texture: true, shading: true, tint: true, model: fromAddress('model') === '1', paused: false, erase: false, control: fromAddress('control') === '1', mind: false };

export function Zoo(): React.JSX.Element {
  const [terrain, setTerrainState] = useState<Terrain>(() => TERRAINS.find((one) => one.key === fromAddress('terrain')) ?? TERRAINS[0]!);
  const [selected, setSelectedState] = useState<ZooEntry | null>(() => ZOO.find((one) => one.key === fromAddress('animal')) ?? ZOO[0] ?? null);
  const [switches, setSwitches] = useState<Switches>(STARTING);
  const [hour, setHour] = useState(() => numberFrom('hour', HOUR_NAMES, NOON));
  const [season, setSeason] = useState(() => numberFrom('season', SEASON_NAMES, SUMMER));
  const [tab, setTab] = useState<Tab>('animals');
  const [piece, setPiece] = useState<Piece | null>(null);
  const [placing, setPlacing] = useState<ZooEntry | null>(null);
  const [item, setItem] = useState<ItemType | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [structure, setStructure] = useState<StructureKind | null>(null);
  const itemCast = useRef<number[][]>([]);
  const structureCast = useRef<[number, StructureKind][]>([]);
  const cast = useRef<Placement[]>([]);
  const blank = useRef(false);
  const [stage, setStage] = useState<string>(() => STAGES.find((one) => one === fromAddress('stage')) ?? DEFAULT_STAGE);
  const [placed, setPlaced] = useState(0);
  const scene = useMemo(() => new Scene(), []);
  const world = useMemo(() => stageWorld(terrain, TERRAINS.indexOf(terrain) + 1), [terrain, epoch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeAddress('hour', hour.toFixed(3));
      writeAddress('season', season.toFixed(3));
      writeAddress('stage', stage);
    }, ADDRESS_DELAY_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [hour, season, stage]);

  const setTerrain = (one: Terrain): void => {
    writeAddress('terrain', one.key);
    setTerrainState(one);
  };
  const setSelected = (entry: ZooEntry): void => {
    writeAddress('animal', entry.key);
    setSelectedState(entry);
  };
  const toggle = (name: keyof Switches): void => {
    setSwitches((now) => ({ ...now, [name]: !now[name] }));
  };
  const chooseStructure = (kind: StructureKind | null): void => {
    setStructure(kind);
    if (kind !== null) {
      setPiece(null);
      setPlacing(null);
      setItem(null);
      setSwitches((now) => ({ ...now, erase: false }));
    }
  };
  const chooseItem = (kind: ItemType | null): void => {
    setItem(kind);
    if (kind !== null) {
      setStructure(null);
      setPiece(null);
      setPlacing(null);
      setSwitches((now) => ({ ...now, erase: false }));
    }
  };
  const chooseAnimal = (entry: ZooEntry | null): void => {
    setPiece(null);
    setItem(null);
    setStructure(null);
    setPlacing(entry);
    if (entry) {
      setSwitches((now) => ({ ...now, erase: false }));
      setSelected(entry);
    }
  };
  const choosePiece = (one: Piece | null): void => {
    setPiece(one);
    if (one) {
      setPlacing(null);
      setItem(null);
      setStructure(null);
      setSwitches((now) => ({ ...now, erase: false }));
    }
  };
  const toggleErase = (): void => {
    setSwitches((now) => ({ ...now, erase: !now.erase }));
    setPiece(null);
    setPlacing(null);
    setItem(null);
    setStructure(null);
  };

  return (
    <div className="zoo">
      <ZooView
        key={`${terrain.key}:${epoch}`}
        world={world}
        terrain={terrain}
        setTerrain={setTerrain}
        selected={selected}
        switches={switches}
        toggle={(name) => (name === 'erase' ? toggleErase() : toggle(name))}
        hour={hour}
        setHour={setHour}
        season={season}
        setSeason={setSeason}
        piece={piece}
        item={item}
        structure={structure}
        placing={placing}
        cast={cast}
        itemCast={itemCast}
        structureCast={structureCast}
        blank={blank}
        onWipe={() => {
          cast.current = [];
          itemCast.current = [];
          structureCast.current = [];
          blank.current = true;
          setPlaced(0);
          setEpoch((now) => now + 1);
        }}
        stage={stage}
        scene={scene}
        placed={placed}
        setPlaced={setPlaced}
        library={<Library tab={tab} setTab={setTab} animal={placing} piece={piece} item={item} structure={structure} stage={stage} setStage={setStage} onAnimal={chooseAnimal} onPiece={choosePiece} onItem={chooseItem} onStructure={chooseStructure} />}
        onEscape={() => {
          setPiece(null);
          setPlacing(null);
          setItem(null);
          setStructure(null);
          setSwitches((now) => ({ ...now, erase: false }));
        }}
      />
    </div>
  );
}

interface ZooViewProps {
  world: World;
  terrain: Terrain;
  setTerrain: (terrain: Terrain) => void;
  selected: ZooEntry | null;
  switches: Switches;
  toggle: (name: keyof Switches) => void;
  hour: number;
  setHour: (hour: number) => void;
  season: number;
  setSeason: (season: number) => void;
  piece: Piece | null;
  item: ItemType | null;
  structure: StructureKind | null;
  placing: ZooEntry | null;
  cast: React.RefObject<Placement[]>;
  itemCast: React.RefObject<number[][]>;
  structureCast: React.RefObject<[number, StructureKind][]>;
  blank: React.RefObject<boolean>;
  onWipe: () => void;
  stage: string;
  scene: Scene;
  placed: number;
  setPlaced: (count: number) => void;
  library: React.JSX.Element;
  onEscape: () => void;
}

function paintGround(ctx: CanvasRenderingContext2D, terrain: Terrain, bounds: Bounds, textured: boolean): void {
  ctx.fillStyle = terrain.colour;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const pattern = textured ? groundPattern(ctx, terrain) : null;
  if (pattern) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(1 / TEXELS_PER_TILE, 1 / TEXELS_PER_TILE);
    ctx.fillStyle = pattern;
    ctx.fillRect(bounds.minX * TEXELS_PER_TILE, bounds.minY * TEXELS_PER_TILE, (bounds.maxX - bounds.minX) * TEXELS_PER_TILE, (bounds.maxY - bounds.minY) * TEXELS_PER_TILE);
    ctx.restore();
  }
  if (terrain.waterColour) {
    ctx.fillStyle = terrain.waterColour;
    ctx.fillRect(bounds.minX - 1, bounds.minY - 1, -bounds.minX + 1, bounds.maxY - bounds.minY + 2);
  }
}

function drawStage(ctx: CanvasRenderingContext2D, terrain: Terrain, lens: { centre: Vec2; zoom: number }, pane: { width: number; height: number }, grid: boolean, textured: boolean): void {
  ctx.save();
  ctx.fillStyle = terrain.colour;
  ctx.fillRect(0, 0, pane.width, pane.height);
  applyCamera(ctx, lens, pane);
  const bounds = visibleBounds(lens, pane);
  paintGround(ctx, terrain, bounds, textured);
  if (grid) {
    const unit = 1 / lens.zoom;
    const step = lens.zoom >= 6 ? 1 : 5;
    for (const [every, colour] of [[step, GRID_FAINT], [5 * step, GRID_STRONG]] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = unit;
      ctx.beginPath();
      for (let x = Math.ceil(bounds.minX / every) * every; x <= bounds.maxX; x += every) {
        ctx.moveTo(x, bounds.minY);
        ctx.lineTo(x, bounds.maxY);
      }
      for (let y = Math.ceil(bounds.minY / every) * every; y <= bounds.maxY; y += every) {
        ctx.moveTo(bounds.minX, y);
        ctx.lineTo(bounds.maxX, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function ZooView({ world, terrain, setTerrain, selected, switches, toggle, hour, setHour, season, setSeason, piece, item, structure, placing, cast, itemCast, structureCast, blank, onWipe, stage, scene, placed, setPlaced, library, onEscape }: ZooViewProps): React.JSX.Element {
  const session = useMemo(() => new ZooSession(world), [world]);
  const sky = useMemo(() => stillSky(world), [world]);
  const fauna = useMemo(emptyFauna, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLCanvasElement>(null);
  const [readout, setReadout] = useState<ZooReadout | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [canControl, setCanControl] = useState<boolean | null>(null);
  const focusEntry = readout ? (ZOO.find((one) => one.key === readout.key) ?? null) : null;
  const look = useRef({ switches, hour, season, piece, item, structure, placing, stage });
  look.current = { switches, hour, season, piece, item, structure, placing, stage };
  const escape = useRef(onEscape);
  escape.current = onEscape;
  const wipe = useRef(false);
  const simRef = useRef<StageSim | null>(null);
  const [mindView, setMindView] = useState<MindView | null>(null);
  const mindHost = useMemo<MindHost>(() => {
    let cached: MindView | null = null;
    return {
      view: () => {
        const mind = simRef.current?.mind;
        if (!mind) return null;
        if (!cached || cached.revision !== mind.revision) cached = mind.view();
        return cached;
      },
      selected: () => -1,
      wonder: (a, b) => simRef.current?.apply({ kind: 'wonder', a, b }),
      forget: (id) => simRef.current?.apply({ kind: 'forget', id }),
      lookAt: (person) => {
        const people = simRef.current?.people;
        if (!people || person < 0) return;
        session.follow = false;
        session.camera = { zoom: session.camera.zoom, centre: { x: people.posX[person]!, y: people.posY[person]! } };
      },
    };
  }, [session]);

  useEffect(() => {
    if (!switches.mind) return undefined;
    const timer = window.setInterval(() => setMindView(mindHost.view()), 250);
    return () => window.clearInterval(timer);
  }, [switches.mind, mindHost]);
  const counted = useRef(setPlaced);
  counted.current = setPlaced;

  useEffect(() => {
    (globalThis as { litSkip?: string[] }).litSkip = ['water', 'leaves', 'precipitation', 'clouds', 'fog', ...(switches.tint ? [] : ['grade'])];
  }, [switches.tint]);

  useEffect(() => {
    session.paused = switches.paused;
  }, [session, switches.paused]);

  useEffect(() => {
    if (cast.current.length > 0) for (const one of cast.current) session.add(one.entry, one.at, true);
    else if (selected && !blank.current) session.spawn(selected);
    blank.current = false;
    for (const [tile, kind] of structureCast.current) placeStructure(world, tile, kind);
    for (const [tile, kind] of itemCast.current) world.items.add(tile!, kind! as ItemType);
    setPlaced(scene.count + session.count + world.items.count);
    return () => {
      cast.current = session.placements();
    };
  }, [session]);

  const bare = useMemo(() => new People(world, null, 0), [world]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const lit = litRef.current;
    const cursor = cursorRef.current;
    const cursorCtx = cursor?.getContext('2d');
    const close = closeRef.current;
    const closeCtx = close?.getContext('2d');
    if (!canvas || !ctx || !lit || !cursor || !cursorCtx || !close || !closeCtx) return;
    let closePointer: Vec2 | null = null;

    const litLayer: LitLayer | null = createLitLayer(lit);
    let viewport: Viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    let frameHandle = 0;
    let last = performance.now();
    let readoutAt = 0;
    let drag: { from: Vec2; moved: number } | null = null;
    let stroke: { last: Vec2 } | null = null;
    let pointer: Vec2 | null = null;
    let lastTile: number = NOWHERE;
    let sim: StageSim | null = null;
    let host: RadialHost | null = null;
    const radial = new RadialMenuController();
    let radialHeld = false;
    const inBuffer = (point: Vec2): Vec2 => ({ x: point.x / SCALE, y: point.y / SCALE });

    const ensureSim = (): void => {
      if (sim) return;
      const humans = session.takeHumans(POPULATION);
      if (humans.length === 0) return;
      sim = new StageSim(world, humans);
      simRef.current = sim;
      host = stageHost(sim, (text) => {
        session.refused = text;
      });
      (window as unknown as { stage: StageSim }).stage = sim;
    };

    (window as unknown as { zoo: ZooSession; scene: Scene }).zoo = session;
    (window as unknown as { scene: Scene }).scene = scene;

    const editing = (): boolean => look.current.switches.erase || look.current.piece !== null || look.current.placing !== null || look.current.item !== null || look.current.structure !== null;

    const ratio = (): number => Math.max(1, Math.floor(Math.min(2, window.devicePixelRatio || 1)));

    const resize = (): void => {
      viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      canvas.width = Math.round(viewport.width * ratio());
      canvas.height = Math.round(viewport.height * ratio());
    };

    const fit = (overlay: HTMLCanvasElement, frame: { width: number; height: number }): void => {
      if (overlay.width !== frame.width || overlay.height !== frame.height) {
        overlay.width = frame.width;
        overlay.height = frame.height;
      }
      overlay.style.width = `${frame.width * SCALE}px`;
      overlay.style.height = `${frame.height * SCALE}px`;
    };

    const step = (now: number): void => {
      try {
        draw(now);
      } catch (error) {
        setNote(String(error instanceof Error ? error.stack : error));
      }
    };

    const render = (now: number): void => {
      frameHandle = requestAnimationFrame(render);
      step(now);
    };

    const hiddenTimer = window.setInterval(() => {
      if (document.hidden) step(performance.now());
    }, 250);

    const ring = (at: Vec2, radius: number, colour: string, unit: number): void => {
      cursorCtx.strokeStyle = colour;
      cursorCtx.lineWidth = unit;
      cursorCtx.setLineDash([3 * unit, 3 * unit]);
      cursorCtx.beginPath();
      cursorCtx.arc(at.x, at.y, radius, 0, Math.PI * 2);
      cursorCtx.stroke();
      cursorCtx.setLineDash([]);
      cursorCtx.beginPath();
      cursorCtx.moveTo(at.x - 2 * unit, at.y);
      cursorCtx.lineTo(at.x + 2 * unit, at.y);
      cursorCtx.moveTo(at.x, at.y - 2 * unit);
      cursorCtx.lineTo(at.x, at.y + 2 * unit);
      cursorCtx.stroke();
    };

    const draw = (now: number): void => {
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      session.tick(seconds);
      session.advance(seconds);

      const frame = bufferFor(viewport.width, viewport.height);
      if (!frame) return;

      const { switches: on, hour: hourNow, season: seasonNow } = look.current;
      if (wipe.current) {
        sim = null;
        simRef.current = null;
        host = null;
        wipe.current = false;
        radial.close();
        radialHeld = false;
      }
      if (on.control) ensureSim();
      const time = session.now();
      const lensZoom = session.camera.zoom / SCALE;
      const lens = { centre: { x: Math.round(session.camera.centre.x * lensZoom) / lensZoom, y: Math.round(session.camera.centre.y * lensZoom) / lensZoom }, zoom: lensZoom };
      const pane = { width: frame.width, height: frame.height };

      drawStage(frame.ctx, terrain, lens, pane, on.grid, on.texture);

      ctx.setTransform(ratio(), 0, 0, ratio(), 0, 0);
      present(ctx, frame);

      fit(lit, frame);
      litLayer?.setMammalAgents(session.agents());
      litLayer?.setHumans(session.humans());
      const pins = session.states(!on.shading);
      litLayer?.setZoos(pins.all, pins.focus);
      const here = session.readout();
      const hole = session.bodies().map(({ x, y, length }) => ({ x, y, lift: length * 0.26, radius: Math.max(1.2, length * 1.1 + 0.8), simple: true }));
      litLayer?.setScenery(scene.props());
      const view = { centre: lens.centre, zoom: lens.zoom, width: frame.width, height: frame.height, time, ground: frame.ctx.canvas, people: sim?.people ?? bare, shoals: null, fauna, fog: null, depth: 0, see: hole };
      const base = lightingFor(world, lens.centre, hourNow, seasonNow);
      if (sim) {
        sim.moment = base.moment;
        sim.advance(on.paused ? 0 : seconds);
      }
      const lighting = { ...base, points: flickered(lightSourcesOf(world, sim?.people ?? bare, lens.centre, () => 0), time) };
      litLayer?.draw(world, view, lighting, sky, 0);
      session.seen = litLayer?.probeZoo(world, view, lighting) ?? null;

      const trial = sim?.trial ?? null;
      close.style.display = trial ? 'block' : 'none';
      if (trial) {
        const layout = layoutFor(close.clientWidth, close.clientHeight);
        if (close.width !== layout.width || close.height !== layout.height) {
          close.width = layout.width;
          close.height = layout.height;
        }
        drawCloseUp(closeCtx, world, trial, layout, closePointer, { gloom: lighting.gloom, tint: lighting.tint, time, paintGround: (target, bounds) => paintGround(target, terrain, bounds, on.texture) });
      }

      fit(cursor, frame);
      cursorCtx.setTransform(1, 0, 0, 1, 0, 0);
      cursorCtx.clearRect(0, 0, frame.width, frame.height);
      cursorCtx.save();
      applyCamera(cursorCtx, lens, pane);
      const unit = 1 / lens.zoom;
      if (session.target && here?.travelling) {
        cursorCtx.strokeStyle = PLACE_RING;
        cursorCtx.lineWidth = unit;
        cursorCtx.setLineDash([4 * unit, 4 * unit]);
        cursorCtx.beginPath();
        const from = session.seen ?? here.position;
        cursorCtx.moveTo(from.x, from.y);
        cursorCtx.lineTo(session.target.x, session.target.y);
        cursorCtx.stroke();
        cursorCtx.setLineDash([]);
        cursorCtx.strokeRect(session.target.x - 3 * unit, session.target.y - 3 * unit, 6 * unit, 6 * unit);
      }
      if (pointer && editing() && !drag) {
        const at = screenToWorld(pointer, session.camera, viewport);
        if (on.erase) ring(at, ERASE_RADIUS, ERASE_RING, unit);
        else if (look.current.piece) ring(at, look.current.piece.spacing / 2, PLACE_RING, unit);
        else if (look.current.item !== null || look.current.structure !== null) {
          const tile = world.grid.atPoint(at);
          if (tile !== NOWHERE) {
            const box = world.grid.bounds(tile);
            cursorCtx.strokeStyle = PLACE_RING;
            cursorCtx.lineWidth = unit;
            cursorCtx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
          }
        } else if (look.current.placing) ring(at, Math.max(0.4, look.current.placing.length / 2), PLACE_RING, unit);
      }
      if (sim && on.control) {
        for (let person = 0; person < sim.people.count; person += 1) {
          const at = { x: sim.people.posX[person]!, y: sim.people.posY[person]! };
          drawBubbleOf(cursorCtx, sim.people, person, time);
          if (sim.people.pulse[person]! > 0) drawPulse(cursorCtx, at.x, at.y, sim.people.pulse[person]!);
        }
      }
      cursorCtx.restore();
      if (radial.isOpen) radial.draw(cursorCtx);
      canvas.style.cursor = editing() ? 'crosshair' : 'grab';

      if (now - readoutAt > READOUT_SECONDS * 1000) {
        readoutAt = now;
        setReadout(here);
        setZoom(session.camera.zoom / SCALE);
        setCanControl(sim !== null || session.humanCount() > 0);
        setNote(session.refused);
      }
    };

    const local = (event: PointerEvent | WheelEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const apply = (point: Vec2, first: boolean): void => {
      const at = screenToWorld(point, session.camera, viewport);
      const { switches: on, piece: current, item: kind, structure: built, placing: animal, stage: size } = look.current;
      session.follow = false;
      if (on.erase) {
        let removed = scene.erase(at) + session.remove(at, ERASE_RADIUS);
        const tile = world.grid.atPoint(at);
        if (tile !== NOWHERE) {
          for (const slot of [...world.items.at(tile)]) {
            world.items.remove(slot);
            removed += 1;
          }
          removed += eraseStructures(world, tile);
        }
        if (removed > 0) counted.current(scene.count + session.count + world.items.count);
        return;
      }
      if (built !== null) {
        const tile = world.grid.atPoint(at);
        if (tile === NOWHERE || (!first && tile === lastTile)) return;
        lastTile = tile;
        placeStructure(world, tile, built);
      } else if (kind !== null) {
        const tile = world.grid.atPoint(at);
        if (tile === NOWHERE || !world.walkable(tile) || (!first && tile === lastTile)) return;
        lastTile = tile;
        world.items.add(tile, kind);
      } else if (animal) {
        if (first) session.add(animal, at);
      } else if (current) scene.place(current, at, size, !first);
      counted.current(scene.count + session.count + world.items.count);
    };

    const openRadial = (point: Vec2): void => {
      if (sim?.trial) return;
      ensureSim();
      if (!host) return;
      const index = world.grid.atPoint(screenToWorld(point, session.camera, viewport));
      if (index === NOWHERE) return;
      radial.open(inBuffer(point), index, slicesFor(host, index));
    };

    const closePoint = (event: PointerEvent): Vec2 => {
      const rect = close.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onClosePointerMove = (event: PointerEvent): void => {
      closePointer = closePoint(event);
    };

    const onClosePointerDown = (event: PointerEvent): void => {
      const trial = sim?.trial;
      if (!sim || !trial) return;
      closePointer = closePoint(event);
      if (event.button === 2) {
        sim.leaveTrial();
        return;
      }
      if (event.button !== 0) return;
      const at = toFloor(layoutFor(close.clientWidth, close.clientHeight), closePointer);
      const target = trial.pieceAt(at.x, at.y);
      if (trial.held) {
        if (target) trial.act(target);
        else trial.drop(at.x, at.y);
      } else if (target) trial.pick(target);
    };

    const onClosePointerLeave = (): void => {
      closePointer = null;
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const point = local(event);
      pointer = point;
      if (event.button === 2) {
        if (look.current.switches.control) {
          openRadial(point);
          radialHeld = radial.isOpen;
          if (radialHeld) canvas.setPointerCapture(event.pointerId);
          return;
        }
        session.send(screenToWorld(point, session.camera, viewport));
        return;
      }
      if (event.button === 0 && radial.isOpen) {
        radial.click(inBuffer(point));
        radialHeld = false;
        return;
      }
      const panning = event.button === 1 || (event.button === 0 && (event.shiftKey || !editing()));
      if (event.button !== 0 && event.button !== 1) return;
      if (panning) {
        event.preventDefault();
        drag = { from: point, moved: 0 };
      } else {
        stroke = { last: point };
        apply(point, true);
      }
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const point = local(event);
      const previous = pointer;
      pointer = point;
      if (radial.isOpen) {
        radial.move(inBuffer(point));
        return;
      }
      if (stroke) {
        const { piece: current, switches: on, placing: animal } = look.current;
        if (animal && !on.erase) return;
        const gap = Math.hypot(point.x - stroke.last.x, point.y - stroke.last.y) / session.camera.zoom;
        const every = on.erase ? ERASE_RADIUS / 2 : look.current.item !== null || look.current.structure !== null ? 0.5 : (current?.spacing ?? 1);
        if (gap >= every) {
          stroke.last = point;
          apply(point, false);
        }
        return;
      }
      if (!drag || !previous) return;
      drag.moved += Math.hypot(point.x - previous.x, point.y - previous.y);
      if (drag.moved > CLICK_SLOP) session.follow = false;
      session.camera = {
        zoom: session.camera.zoom,
        centre: {
          x: session.camera.centre.x - (point.x - previous.x) / session.camera.zoom,
          y: session.camera.centre.y - (point.y - previous.y) / session.camera.zoom,
        },
      };
    };

    const onPointerLeave = (): void => {
      if (!drag && !stroke) pointer = null;
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (radialHeld) {
        radialHeld = false;
        radial.release(inBuffer(local(event)));
        return;
      }
      stroke = null;
      const finished = drag;
      drag = null;
      if (!finished || finished.moved > CLICK_SLOP || editing() || event.button !== 0) return;
      const at = screenToWorld(finished.from, session.camera, viewport);
      litLayer?.throwRipple(at.x, at.y, session.now());
      session.select(at);
      session.startle(at);
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      session.camera = zoomAbout(session.camera, local(event), viewport, Math.exp(-event.deltaY * 0.001));
    };

    const onContextMenu = (event: Event): void => event.preventDefault();

    const typing = (event: KeyboardEvent): boolean => event.target instanceof HTMLInputElement && event.target.value !== '';

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Escape' && sim?.trial) {
        sim.leaveTrial();
        return;
      }
      if (event.code === 'Escape' && !(event.target instanceof HTMLInputElement)) {
        if (radial.isOpen) {
          radial.close();
          radialHeld = false;
          return;
        }
        escape.current();
        return;
      }
      if (event.code === 'KeyE' && !event.repeat && !typing(event) && !(event.target instanceof HTMLInputElement) && look.current.switches.control && pointer && !radial.isOpen) {
        openRadial(pointer);
        radialHeld = radial.isOpen;
        return;
      }
      if (event.code !== 'Space' || typing(event)) return;
      event.preventDefault();
      session.recentre();
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'KeyE' && radialHeld) {
        radialHeld = false;
        radial.release(pointer ? inBuffer(pointer) : { x: 0, y: 0 });
        return;
      }
      if (event.code === 'Space' && !typing(event)) event.preventDefault();
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    close.addEventListener('pointermove', onClosePointerMove);
    close.addEventListener('pointerdown', onClosePointerDown);
    close.addEventListener('pointerleave', onClosePointerLeave);
    close.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    frameHandle = requestAnimationFrame(render);

    return () => {
      if (!wipe.current) {
        itemCast.current = world.items.state();
        structureCast.current = structuresOf(world);
      }
      if (sim && !wipe.current) {
        const human = ZOO.find((one) => one.group === 'human');
        if (human) for (let person = 0; person < sim.people.count; person += 1) cast.current.push({ entry: human, at: { x: sim.people.posX[person]!, y: sim.people.posY[person]! } });
      }
      cancelAnimationFrame(frameHandle);
      window.clearInterval(hiddenTimer);
      litLayer?.dispose();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      close.removeEventListener('pointermove', onClosePointerMove);
      close.removeEventListener('pointerdown', onClosePointerDown);
      close.removeEventListener('pointerleave', onClosePointerLeave);
      close.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [session, world, sky, fauna, terrain, scene]);

  const clear = (): void => {
    scene.clear();
    session.clear();
    wipe.current = true;
    onWipe();
  };

  useEffect(() => {
    if (switches.control && canControl === false) toggle('control');
  }, [switches.control, canControl]);

  const help = switches.erase
    ? 'click or drag to erase what you placed, animals too. shift or middle drag: pan. escape: put it away.'
    : placing
      ? `click to place ${placing.name}. right click: send the selected animal. click an animal to select it. escape: put it away.`
      : structure !== null
        ? `click or drag to build ${STRUCTURES.find((one) => one.kind === structure)?.title}, one a tile. shift or middle drag: pan. escape: put it away.`
      : item !== null
        ? `click or drag to put down ${ITEM_NAMES[item]}, one a tile. shift or middle drag: pan. escape: put it away.`
        : piece
      ? `click or drag to place ${piece.title}. shift or middle drag: pan. right click: send the animal. escape: put it away.`
      : switches.control
        ? 'right click or E: radial menu, flick to choose. click an animal: select it. click: startle. drag: pan. wheel: zoom.'
        : 'right click: send the selected animal there. click an animal: select it. click: startle. drag: pan. wheel: zoom. space: recentre.';

  return (
    <>
      <Toolbar
        canControl={canControl === true}
        terrain={terrain}
        setTerrain={setTerrain}
        switches={switches}
        toggle={toggle}
        hour={hour}
        setHour={setHour}
        season={season}
        setSeason={setSeason}
        placed={placed}
        onClear={clear}
        onFollow={() => session.recentre()}
      />
      {library}
      <main className="zoo-stage">
        <canvas ref={canvasRef} className="zoo-canvas" />
        <canvas ref={litRef} className="zoo-overlay" />
        <canvas ref={cursorRef} className="zoo-overlay" />
        <canvas ref={closeRef} className="se-closeup" />
        <MindPanel open={switches.mind} view={mindView} host={mindHost} onClose={() => toggle('mind')} />
        {switches.model && <Model3D species={focusEntry ? modelled(focusEntry.key, focusEntry.group) : null} onClose={() => toggle('model')} />}
        <div className="se-board zoo-readout">
          {readout ? (
            <>
              <PixelText>{`${readout.name} (${readout.group})`}</PixelText>
              <PixelText>{readout.travelling ? `travelling, ${readout.remaining.toFixed(1)} m to go at ${readout.speed.toFixed(2)} m/s` : 'natural behaviour'}</PixelText>
            </>
          ) : (
            <PixelText>no animal, pick one and click the ground</PixelText>
          )}
          <PixelText>{`zoom ${zoom.toFixed(1)}${session.follow ? '' : ' (free camera)'}${readout && readout.count > 1 ? `, ${readout.count} animals` : ''}${placed > 0 ? `, ${placed} placed` : ''}`}</PixelText>
          {note && <PixelText className="zoo-note">{note}</PixelText>}
          <PixelText className="zoo-help">{help}</PixelText>
        </div>
      </main>
    </>
  );
}
