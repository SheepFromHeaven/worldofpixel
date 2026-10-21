import * as Model from './model.js';
import { FIG } from './figures.js';

/**
 * Wires the page up: fills the tables that are derived from `model.js`, then runs the figures.
 *
 * Tables here are generated rather than typed into the HTML because every one of them is a claim
 * the model has to keep making. A number written by hand is a number that goes stale the first
 * time a constant is tuned.
 */

const cell = (v, cls) => `<td${cls ? ` class="${cls}"` : ''}>${v}</td>`;
const rows = (id, data) => {
  const body = document.querySelector(`#${id} tbody`);
  if (body) body.innerHTML = data.map((r) => `<tr>${r.join('')}</tr>`).join('');
};

function fillLadder() {
  rows('t-ladder', Object.values(Model.RIGS).map((rig) => {
    const e = Model.envelopeOf(rig);
    const b = rig.build;
    return [
      cell(rig.label),
      cell(b.flue.toFixed(2), 'n'),
      cell(b.wall.toFixed(2), 'n'),
      cell(b.maxRate.toFixed(1), 'n'),
      cell(`${e.T} °C`, 'n'),
      cell(Model.glowOf(e.T).name),
      cell(`${e.fuel}, damper ${Math.round(e.damper * 100)}%, ${e.fuelRate.toFixed(1)}/min`),
    ];
  }));
}

function fillClamp() {
  const data = [];
  for (let v = 0.05; v <= 0.78; v += 0.12) {
    const c = Model.char({ vent: v, wood: 5 });
    data.push([
      cell(v.toFixed(2), 'n'),
      cell(`${c.T} °C`, 'n'),
      cell(c.carbon.toFixed(2), 'n'),
      cell(c.charcoal.toFixed(1), 'n'),
      cell(c.grade === 'brands' ? '<span style="color:var(--warn)">brands</span>' : c.grade),
      cell(c.smoke),
      cell(c.minutes, 'n'),
    ]);
  }
  rows('t-clamp', data);
}

function fillClay() {
  const runs = [
    ['Rushed — no temper, dried in the sun, straight up', { temper: 0.02, dryRate: 0.9, rampLow: 0.9, ramp573: 0.9, peak: 850, hold: 10 }],
    ['Tempered and slow — the batch survives', { temper: 0.2, dryRate: 0.3, rampLow: 0.2, ramp573: 0.2, peak: 850, hold: 10 }],
    ['…and soaked at the top — now it is hard', { temper: 0.2, dryRate: 0.3, rampLow: 0.2, ramp573: 0.2, peak: 960, hold: 40 }],
  ];
  rows('t-clay', runs.map(([label, p]) => {
    const r = Model.clay(p);
    return [
      cell(label),
      cell(`${Math.round(r.loss * 100)}%`, 'n'),
      cell(`${Math.round(r.hardness * 100)}%`, 'n'),
      cell(r.grade),
      cell(r.carries, 'n'),
      cell(r.tripsBeforeBreaking, 'n'),
    ];
  }));
}

function fillDays() {
  rows('t-days', Object.values(Model.DAYS).map((d) => {
    const r = Model.day(d);
    const pct = (v) => `${Math.round(v * 100)}%`;
    return [
      cell(d.label),
      cell(pct(r.shares.water), 'n'),
      cell(pct(r.shares.food + r.shares.prep), 'n'),
      cell(pct(r.shares.rest), 'n'),
      cell(pct(r.surplusShare), 'n'),
      cell(r.surplusHours.toFixed(0), 'n'),
    ];
  }));
}

function fillKnap() {
  const use = {
    hard: 'Scrapers, rough work, when stone is plentiful',
    soft: 'Everyday blades: the working compromise',
    antler: 'An axe head, or a blade that has to last',
  };
  rows('t-knap', Object.entries(Model.HAMMERS).map(([key, h]) => {
    const r = Model.knap({ hammer: key, angle: 72, force: 0.6, setback: 0.4, prepared: true });
    return [
      cell(h.label),
      cell(r.ratio.toFixed(2), 'n'),
      cell(r.grade),
      cell(r.fromOneCore, 'n'),
      cell(`${r.edgeLife} cuts`, 'n'),
      cell(use[key]),
    ];
  }));
}

/** Figures animate only while on screen, and hold a single still frame if motion is unwanted. */
function startFigures() {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const views = [];
  for (const canvas of document.querySelectorAll('canvas[data-fig]')) {
    const draw = FIG[canvas.dataset.fig];
    if (!draw) continue;
    const buffer = new Buf(canvas.width, canvas.height, canvas);
    const view = { canvas, visible: false, offset: views.length * 1.7 };
    view.render = (t) => {
      try {
        draw(buffer, t + view.offset);
      } catch (err) {
        console.error(canvas.dataset.fig, err);
      }
      buffer.present();
    };
    view.render(3.4);
    views.push(view);
  }
  if (still) return;

  const seen = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      const v = views.find((x) => x.canvas === e.target);
      if (v) v.visible = e.isIntersecting;
    }),
    { rootMargin: '100px' },
  );
  views.forEach((v) => seen.observe(v.canvas));

  let last = 0;
  const frame = (ms) => {
    if (ms - last > 45) {
      last = ms;
      for (const v of views) if (v.visible) v.render(ms / 1000);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

fillLadder();
fillClamp();
fillClay();
fillKnap();
fillDays();
startFigures();
