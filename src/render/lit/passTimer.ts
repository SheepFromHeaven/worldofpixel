interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

interface Pending {
  name: string;
  query: WebGLQuery;
}

const REPORT_MILLISECONDS = 2000;
const NANOSECONDS_PER_MILLISECOND = 1e6;

export class PassTimer {
  private readonly extension: TimerExtension | null;
  private readonly pending: Pending[] = [];
  private readonly gpu = new Map<string, number>();
  private readonly cpu = new Map<string, number>();
  private frames = 0;
  private reportedAt = performance.now();
  private notes: Record<string, number> = {};

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
  }

  private get mode(): boolean | 'sync' | undefined {
    return (globalThis as { litProfile?: boolean | 'sync' }).litProfile;
  }

  private get enabled(): boolean {
    return this.mode === true || this.mode === 'sync';
  }

  note(name: string, value: number): void {
    if (this.enabled) this.notes[name] = value;
  }

  time<T>(name: string, run: () => T): T {
    if (!this.enabled) return run();
    const { gl, extension } = this;
    if (this.mode === 'sync') {
      gl.finish();
      const began = performance.now();
      const result = run();
      const submitted = performance.now();
      gl.finish();
      const finished = performance.now();
      this.gpu.set(name, (this.gpu.get(name) ?? 0) + finished - began);
      this.cpu.set(name, (this.cpu.get(name) ?? 0) + submitted - began);
      return result;
    }
    const started = performance.now();
    const query = extension ? gl.createQuery() : null;
    if (query && extension) gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    const result = run();
    if (query && extension) {
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      this.pending.push({ name, query });
    }
    this.cpu.set(name, (this.cpu.get(name) ?? 0) + performance.now() - started);
    return result;
  }

  frame(): void {
    if (!this.enabled) return;
    const { gl, extension } = this;
    this.frames += 1;

    if (extension) {
      const disjoint = gl.getParameter(extension.GPU_DISJOINT_EXT) as boolean;
      while (this.pending.length > 0) {
        const { name, query } = this.pending[0]!;
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
        this.pending.shift();
        if (!disjoint) this.gpu.set(name, (this.gpu.get(name) ?? 0) + (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / NANOSECONDS_PER_MILLISECOND);
        gl.deleteQuery(query);
      }
    }

    const now = performance.now();
    if (now - this.reportedAt < REPORT_MILLISECONDS) return;

    const frames = this.frames;
    const names = [...new Set([...this.cpu.keys(), ...this.gpu.keys()])];
    const rows = names.map((name) => ({
      pass: name,
      'gpu ms/frame': extension || this.mode === 'sync' ? +((this.gpu.get(name) ?? 0) / frames).toFixed(2) : 'no timer ext',
      'cpu ms/frame': +((this.cpu.get(name) ?? 0) / frames).toFixed(2),
    }));
    console.info(`lit passes over ${frames} frames (${((frames * 1000) / (now - this.reportedAt)).toFixed(0)} fps)`, this.notes);
    console.table(rows);

    this.gpu.clear();
    this.cpu.clear();
    this.frames = 0;
    this.reportedAt = now;
  }
}
