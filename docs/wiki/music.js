//#region src/music/theory.ts
var e = (e) => 440 * 2 ** ((e - 69) / 12);
//#endregion
//#region src/audio/synth.ts
function t(e) {
	let t = e.ctx.createGain(), n = e.ctx.createGain();
	return t.connect(e.dry), n.connect(e.echo), {
		ctx: e.ctx,
		dry: t,
		echo: n,
		master: e.master,
		fade: (r) => {
			let i = e.ctx.currentTime;
			for (let e of [t, n]) e.gain.cancelScheduledValues(i), e.gain.setValueAtTime(e.gain.value, i), e.gain.linearRampToValueAtTime(0, i + r);
			window.setTimeout(() => {
				t.disconnect(), n.disconnect();
			}, (r + .2) * 1e3);
		}
	};
}
var n = /* @__PURE__ */ new WeakMap();
function r(e) {
	let t = n.get(e);
	if (t) return t;
	let r = e.createBuffer(1, e.sampleRate * 2, e.sampleRate), i = r.getChannelData(0), a = 0;
	for (let e = 0; e < i.length; e += 1) {
		let t = Math.random() * 2 - 1;
		a = (a + t * .4) * .92, i[e] = t * .7 + a * 1.2;
	}
	return n.set(e, r), r;
}
var i = .6, a = 2048;
function o() {
	let e = new Float32Array(/* @__PURE__ */ new ArrayBuffer(a * Float32Array.BYTES_PER_ELEMENT));
	for (let t = 0; t < a; t += 1) {
		let n = t / 2047 * 4 - 2, r = Math.abs(n) - i;
		e[t] = r <= 0 ? n : Math.sign(n) * (i + .4 * Math.tanh(r / .4));
	}
	return e;
}
function s(e, t = e.destination) {
	let n = e.createGain();
	n.gain.value = 1;
	let r = e.createGain();
	r.gain.value = .36, r.connect(n);
	let i = e.createWaveShaper();
	i.curve = o(), i.oversample = "4x";
	let a = e.createDynamicsCompressor();
	a.threshold.value = -12, a.knee.value = 18, a.ratio.value = 4, a.attack.value = .004, a.release.value = .3;
	let s = e.createGain(), c = e.createGain(), l = e.createDelay(2);
	l.delayTime.value = .36;
	let u = e.createGain();
	u.gain.value = .34;
	let d = e.createBiquadFilter();
	return d.type = "lowpass", d.frequency.value = 1800, c.connect(l), l.connect(d), d.connect(u), u.connect(l), d.connect(r), s.connect(r), n.connect(a), a.connect(i), i.connect(t), {
		ctx: e,
		dry: s,
		echo: c,
		master: n
	};
}
function c(e, t, n, r = Infinity) {
	if (e.drop <= 0 || e.dropTime <= 0) return t;
	let i = Math.min(r, t * 2 ** (e.drop / 1200)), a = Math.max(0, Math.min(1, n / e.dropTime));
	return i * (Math.max(1, t) / i) ** a;
}
function l(e, t, n, r, i) {
	n.drop <= 0 || n.dropTime <= 0 || (e.setValueAtTime(c(n, t, 0, i / 2 - 100), r), e.exponentialRampToValueAtTime(Math.max(1, t), r + n.dropTime));
}
function u(t, n, i, a, o, s) {
	let { ctx: c } = t, u = c.createGain();
	u.gain.value = 0;
	let d = c.createBiquadFilter();
	d.type = n.wave === "noise" ? "bandpass" : "lowpass", d.frequency.value = Math.max(40, Math.min(c.sampleRate / 2 - 100, n.cutoff * 2 ** (n.tracking * (i - 60) / 12))), d.Q.value = Math.max(1e-4, n.resonance), d.connect(u);
	let f = [];
	if (n.wave === "noise") {
		let t = c.createBufferSource();
		t.buffer = r(c), t.loop = !0;
		let a = Math.max(80, Math.min(16e3, e(i) * 8));
		d.frequency.value = a, l(d.frequency, a, n, o, c.sampleRate), t.connect(d), t.start(o), f.push(t);
	} else for (let t of [-.5, .5]) {
		let r = c.createOscillator();
		if (r.type = n.wave, r.frequency.value = e(i), l(r.frequency, e(i), n, o, c.sampleRate), r.detune.value = n.spread * t, r.connect(d), r.start(o), f.push(r), n.vibrato > 0 && n.vibratoRate > 0) {
			let e = c.createOscillator();
			e.frequency.value = n.vibratoRate;
			let t = c.createGain();
			t.gain.value = n.vibrato, e.connect(t), t.connect(r.detune), e.start(o), f.push(e);
		}
	}
	let p = Math.max(1e-4, n.gain * a), m = p * n.sustain, h = o + n.attack, g = h + n.decay, _ = Math.max(o + s, o + .02), v = _ + n.release;
	if (u.gain.setValueAtTime(0, o), _ <= h) u.gain.linearRampToValueAtTime(p * ((_ - o) / Math.max(.001, n.attack)), _);
	else if (u.gain.linearRampToValueAtTime(p, h), _ <= g) {
		let e = (_ - h) / Math.max(.001, n.decay);
		u.gain.linearRampToValueAtTime(p + (m - p) * e, _);
	} else u.gain.linearRampToValueAtTime(m, g), u.gain.setValueAtTime(m, _);
	if (u.gain.linearRampToValueAtTime(0, v), u.connect(t.dry), n.echo > 0) {
		let e = c.createGain();
		e.gain.value = n.echo, u.connect(e), e.connect(t.echo);
	}
	for (let e of f) e.stop(v + .05);
	let y = f[0];
	y && (y.onended = () => u.disconnect());
}
//#endregion
//#region src/music/types.ts
var d = (e) => e.bars * e.beatsPerBar, f = (e) => 60 / e, p = .25, m = 50, h = 1 / 16, g = .08, _ = class {
	ctx;
	bus;
	song = null;
	timer = null;
	cursor = 0;
	nextTime = 0;
	running = !1;
	loop = !1;
	onEnd = null;
	channel;
	constructor(e) {
		this.ctx = e, this.bus = s(e), this.channel = t(this.bus);
	}
	get playing() {
		return this.running;
	}
	get current() {
		return this.song;
	}
	get beat() {
		if (!this.running || !this.song) return this.cursor;
		let e = (this.nextTime - this.ctx.currentTime) / f(this.song.tempo);
		return Math.max(0, this.cursor - e);
	}
	wake() {
		this.ctx.resume();
	}
	setVolume(e, t = .25) {
		let n = this.bus.master.gain;
		n.cancelScheduledValues(this.ctx.currentTime), n.setValueAtTime(Math.max(1e-4, n.value), this.ctx.currentTime), n.linearRampToValueAtTime(Math.max(1e-4, e), this.ctx.currentTime + t);
	}
	setSong(e) {
		let t = e?.name !== this.song?.name;
		this.song = e, t && this.running && this.play(0);
	}
	play(e = 0) {
		this.song && (this.ctx.resume(), this.silence(), this.cursor = e, this.nextTime = this.ctx.currentTime + .1, this.running = !0, this.timer === null && (this.timer = window.setInterval(() => this.tick(), m)), this.tick());
	}
	stop() {
		this.running = !1, this.timer !== null && (window.clearInterval(this.timer), this.timer = null);
	}
	silence(e = g) {
		this.stop(), this.channel.fade(e), this.channel = t(this.bus);
	}
	pause() {
		let e = this.beat;
		this.silence(), this.cursor = e;
	}
	seek(e) {
		this.running ? this.play(e) : this.cursor = e;
	}
	tick() {
		let e = this.song;
		if (!e || !this.running) return;
		let t = d(e), n = f(e.tempo);
		for (; this.nextTime < this.ctx.currentTime + p;) {
			this.schedule(e, this.cursor, Math.min(this.cursor + h, t), this.nextTime);
			let r = Math.min(h, t - this.cursor);
			if (this.cursor += r, this.nextTime += r * n, this.cursor >= t - 1e-9) {
				if (!this.loop) {
					this.stop(), this.cursor = 0, this.onEnd?.();
					return;
				}
				this.cursor = 0;
			}
		}
	}
	schedule(e, t, n, r) {
		let i = f(e.tempo);
		for (let a of e.tracks) if (!(a.muted || a.gain <= 0)) for (let e of a.notes) e.at < t || e.at >= n || u(this.channel, a.patch, e.pitch, e.velocity * a.gain, r + (e.at - t) * i, e.length * i);
	}
}, v = (e, t, n, r = .8) => ({
	at: e,
	length: n,
	pitch: t,
	velocity: r
}), y = (e, t, n, r = .7) => t.map((t) => v(e, t, n, r));
function b(e, t, n = .25, r = .12) {
	let i = {
		X: 1,
		x: .62,
		o: .32
	};
	return [...e].flatMap((e, a) => {
		let o = i[e];
		return o === void 0 ? [] : [v(a * n, t, r, o)];
	});
}
var x = (e, t) => e.map((e) => ({
	...e,
	at: e.at + t
})), S = (e, t, n) => Array.from({ length: t }, (t, r) => x(e, r * n)).flat(), C = (e) => [...e].sort((e, t) => e.at - t.at || e.pitch - t.pitch), w = {
	pad: {
		wave: "sawtooth",
		spread: 14,
		attack: 1.2,
		decay: 1.6,
		sustain: .65,
		release: 2.4,
		cutoff: 620,
		resonance: .8,
		tracking: .5,
		vibrato: 6,
		vibratoRate: 4.2,
		drop: 0,
		dropTime: 0,
		gain: .22,
		echo: .35
	},
	bell: {
		wave: "sine",
		spread: 6,
		attack: .004,
		decay: 1.1,
		sustain: .08,
		release: 1.3,
		cutoff: 3200,
		resonance: .4,
		tracking: .9,
		vibrato: 0,
		vibratoRate: 0,
		drop: 0,
		dropTime: 0,
		gain: .3,
		echo: .45
	},
	pluck: {
		wave: "triangle",
		spread: 9,
		attack: .006,
		decay: .34,
		sustain: .12,
		release: .4,
		cutoff: 2100,
		resonance: 1.1,
		tracking: .8,
		vibrato: 0,
		vibratoRate: 0,
		drop: 0,
		dropTime: 0,
		gain: .32,
		echo: .28
	},
	bass: {
		wave: "triangle",
		spread: 4,
		attack: .02,
		decay: .5,
		sustain: .55,
		release: .35,
		cutoff: 480,
		resonance: .6,
		tracking: .3,
		vibrato: 0,
		vibratoRate: 0,
		drop: 0,
		dropTime: 0,
		gain: .4,
		echo: .05
	},
	reed: {
		wave: "square",
		spread: 11,
		attack: .09,
		decay: .4,
		sustain: .6,
		release: .5,
		cutoff: 1500,
		resonance: 1.4,
		tracking: .7,
		vibrato: 12,
		vibratoRate: 5.4,
		drop: 0,
		dropTime: 0,
		gain: .18,
		echo: .3
	},
	growl: {
		wave: "sawtooth",
		spread: 16,
		attack: .005,
		decay: .22,
		sustain: .35,
		release: .18,
		cutoff: 320,
		resonance: 5.5,
		tracking: .55,
		vibrato: 0,
		vibratoRate: 0,
		drop: 0,
		dropTime: 0,
		gain: .3,
		echo: .08
	},
	blade: {
		wave: "sawtooth",
		spread: 22,
		attack: .01,
		decay: .3,
		sustain: .45,
		release: .3,
		cutoff: 2600,
		resonance: 2.6,
		tracking: .75,
		vibrato: 8,
		vibratoRate: 5.8,
		drop: 0,
		dropTime: 0,
		gain: .17,
		echo: .32
	},
	flute: {
		wave: "sine",
		spread: 7,
		attack: .07,
		decay: .3,
		sustain: .78,
		release: .4,
		cutoff: 2600,
		resonance: .6,
		tracking: .85,
		vibrato: 15,
		vibratoRate: 5.2,
		drop: 0,
		dropTime: 0,
		gain: .26,
		echo: .45
	},
	wood: {
		wave: "triangle",
		spread: 0,
		attack: .001,
		decay: .22,
		sustain: 0,
		release: .09,
		cutoff: 2200,
		resonance: 2.5,
		tracking: .6,
		vibrato: 0,
		vibratoRate: 0,
		drop: 500,
		dropTime: .02,
		gain: .4,
		echo: .15
	},
	rattle: {
		wave: "noise",
		spread: 0,
		attack: .001,
		decay: .07,
		sustain: 0,
		release: .04,
		cutoff: 6e3,
		resonance: 1.4,
		tracking: 0,
		vibrato: 0,
		vibratoRate: 0,
		drop: 400,
		dropTime: .04,
		gain: .3,
		echo: .12
	},
	kick: {
		wave: "sine",
		spread: 0,
		attack: .001,
		decay: .22,
		sustain: 0,
		release: .06,
		cutoff: 900,
		resonance: .4,
		tracking: 0,
		vibrato: 0,
		vibratoRate: 0,
		drop: 2600,
		dropTime: .05,
		gain: .75,
		echo: 0
	},
	snare: {
		wave: "noise",
		spread: 0,
		attack: .001,
		decay: .16,
		sustain: 0,
		release: .08,
		cutoff: 2e3,
		resonance: 1.1,
		tracking: 0,
		vibrato: 0,
		vibratoRate: 0,
		drop: 900,
		dropTime: .05,
		gain: .75,
		echo: .18
	},
	rim: {
		wave: "triangle",
		spread: 0,
		attack: .001,
		decay: .09,
		sustain: 0,
		release: .05,
		cutoff: 1800,
		resonance: 2,
		tracking: .4,
		vibrato: 0,
		vibratoRate: 0,
		drop: 1400,
		dropTime: .03,
		gain: .3,
		echo: .1
	},
	hat: {
		wave: "noise",
		spread: 0,
		attack: .001,
		decay: .035,
		sustain: 0,
		release: .02,
		cutoff: 9e3,
		resonance: 3,
		tracking: 0,
		vibrato: 0,
		vibratoRate: 0,
		drop: 300,
		dropTime: .02,
		gain: .38,
		echo: .08
	},
	openhat: {
		wave: "noise",
		spread: 0,
		attack: .002,
		decay: .3,
		sustain: 0,
		release: .12,
		cutoff: 8e3,
		resonance: 2,
		tracking: 0,
		vibrato: 0,
		vibratoRate: 0,
		drop: 0,
		dropTime: 0,
		gain: .3,
		echo: .2
	},
	tom: {
		wave: "sine",
		spread: 0,
		attack: .002,
		decay: .3,
		sustain: 0,
		release: .1,
		cutoff: 1400,
		resonance: 1,
		tracking: .5,
		vibrato: 0,
		vibratoRate: 0,
		drop: 900,
		dropTime: .1,
		gain: .4,
		echo: .12
	},
	drum: {
		wave: "sine",
		spread: 0,
		attack: .002,
		decay: .2,
		sustain: 0,
		release: .12,
		cutoff: 420,
		resonance: .6,
		tracking: .3,
		vibrato: 0,
		vibratoRate: 0,
		drop: 700,
		dropTime: .06,
		gain: .36,
		echo: .04
	},
	shaker: {
		wave: "noise",
		spread: 0,
		attack: .001,
		decay: .05,
		sustain: 0,
		release: .04,
		cutoff: 9e3,
		resonance: 2.2,
		tracking: 0,
		vibrato: 0,
		vibratoRate: 0,
		drop: 0,
		dropTime: 0,
		gain: .09,
		echo: .12
	},
	brush: {
		wave: "noise",
		spread: 0,
		attack: .002,
		decay: .12,
		sustain: 0,
		release: .12,
		cutoff: 5200,
		resonance: .7,
		tracking: 0,
		vibrato: 0,
		vibratoRate: 0,
		drop: 0,
		dropTime: 0,
		gain: .12,
		echo: .2
	}
};
Object.keys(w);
var T = (e) => w[e] ?? w.pluck, ee = [
	57,
	60,
	62,
	64,
	67,
	69,
	72,
	74,
	76,
	79
], te = [
	57,
	60,
	64
], ne = [
	te,
	[
		55,
		59,
		62
	],
	te,
	[
		55,
		60,
		64
	]
], E = 16, re = Array.from({ length: E }, (e, t) => ne[t % 4]), ie = Array.from({ length: E / 4 }, (e, t) => [v(t * 16, 33, 16.4, .55), v(t * 16 + 8, 45, 8.4, .3)]).flat(), ae = re.flatMap((e, t) => [
	v(t * 4, e[0] - 24, 1.4, .7),
	v(t * 4 + 1.5, e[0] - 12, .4, .45),
	v(t * 4 + 2.5, e[0] - 24, 1.2, .6)
]), oe = [
	0,
	.75,
	1.5,
	2,
	2.75,
	3.5
], se = re.flatMap((e, t) => oe.flatMap((n, r) => y(t * 4 + n, e.map((e) => e + 12), .3, r % 2 == 0 ? .5 : .34))), ce = "X..x..x.X..x..x.", le = "x.o.x.o.x.o.x.oo", ue = x(S(b(ce, 36), 14, 4), 8), de = x(S(b(le, 80), 12, 4), 16), D = [
	v(0, 76, 2.5),
	v(2.75, 74, .25, .5),
	v(3, 72, 1),
	v(4, 69, 3),
	v(7.75, 72, .25, .5),
	v(8, 74, 2),
	v(10, 72, 1),
	v(11, 69, 1),
	v(12, 67, 3.5)
], fe = [
	v(0, 72, 1.5),
	v(1.5, 74, .5, .6),
	v(2, 76, 2),
	v(4, 79, 2.5),
	v(6.75, 76, .25, .5),
	v(7, 74, 1),
	v(8, 72, 1),
	v(9, 69, 1),
	v(10, 67, 2),
	v(12, 69, 4)
], O = [
	...x(D, 16),
	...x(fe, 32),
	...x(D, 48)
], pe = O.filter((e) => e.length >= 1).map((e) => {
	let t = ee.indexOf(e.pitch), n = t >= 2 ? ee[t - 2] : e.pitch - 5;
	return {
		...e,
		pitch: n,
		velocity: e.velocity * .55
	};
}), me = {
	name: "condor",
	tempo: 100,
	beatsPerBar: 4,
	bars: E,
	tracks: [
		{
			name: "drone",
			patch: T("pad"),
			gain: .468,
			muted: !1,
			notes: C(ie)
		},
		{
			name: "bass",
			patch: T("bass"),
			gain: .504,
			muted: !1,
			notes: C(ae)
		},
		{
			name: "charango",
			patch: T("pluck"),
			gain: .396,
			muted: !1,
			notes: C(se)
		},
		{
			name: "pipes",
			patch: T("flute"),
			gain: .648,
			muted: !1,
			notes: C(O)
		},
		{
			name: "second",
			patch: T("flute"),
			gain: .432,
			muted: !1,
			notes: C(pe)
		},
		{
			name: "bombo",
			patch: T("drum"),
			gain: .576,
			muted: !1,
			notes: C(ue)
		},
		{
			name: "rattle",
			patch: T("rattle"),
			gain: .36,
			muted: !1,
			notes: C(de)
		}
	]
}, k = 16, he = Array.from({ length: k / 2 }, (e, t) => [v(t * 8, 38, 8.4, .7), v(t * 8 + 4, 45, 4.4, .4)]).flat(), ge = [
	62,
	66,
	69,
	66,
	70,
	69,
	66,
	63
], _e = Array.from({ length: k }, (e, t) => ge.map((e, n) => v(t * 4 + n * .5, t % 8 >= 4 ? e + 12 : e, .42, n % 2 == 0 ? .55 : .35))).flat(), ve = [
	v(0, 36, .25, 1),
	v(1.5, 36, .25, .7),
	v(2, 48, .18, .5),
	v(3, 36, .25, .8),
	v(3.5, 48, .18, .45)
], ye = Array.from({ length: 16 }, (e, t) => v(t * .25, 88, .08, t % 4 == 0 ? .32 : t % 2 == 0 ? .2 : .12)), be = x(S(ve, 14, 4), 8), xe = x(S(ye, 12, 4), 16), Se = [
	v(0, 69, 1.5),
	v(1.5, 70, .5, .6),
	v(2, 69, 1),
	v(3, 66, 1),
	v(4, 67, 1.5),
	v(5.5, 66, .5, .6),
	v(6, 63, 2),
	v(8, 62, 1),
	v(9, 66, 1),
	v(10, 69, 1.5),
	v(11.5, 70, .5, .6),
	v(12, 74, 3)
], Ce = [
	v(0, 74, 1),
	v(1, 75, 1),
	v(2, 74, 1),
	v(3, 70, 1),
	v(4, 69, 2.5),
	v(7, 66, 1),
	v(8, 69, 1.5),
	v(9.5, 67, .5, .6),
	v(10, 66, 1),
	v(11, 63, 1),
	v(12, 62, 3.5)
], we = [...x(Se, 24), ...x(Ce, 44)], Te = {
	name: "dunes",
	tempo: 124,
	beatsPerBar: 4,
	bars: k,
	tracks: [
		{
			name: "drone",
			patch: T("bass"),
			gain: .7,
			muted: !1,
			notes: C(he)
		},
		{
			name: "ostinato",
			patch: T("pluck"),
			gain: .6,
			muted: !1,
			notes: C(_e)
		},
		{
			name: "snake",
			patch: T("reed"),
			gain: .8,
			muted: !1,
			notes: C(we)
		},
		{
			name: "drum",
			patch: T("drum"),
			gain: .8,
			muted: !1,
			notes: C(be)
		},
		{
			name: "shaker",
			patch: T("shaker"),
			gain: .6,
			muted: !1,
			notes: C(xe)
		}
	]
}, Ee = [
	[
		57,
		60,
		64,
		69
	],
	[
		53,
		57,
		60,
		65
	],
	[
		55,
		60,
		64,
		67
	],
	[
		55,
		59,
		62,
		67
	]
], De = [
	33,
	41,
	36,
	43
], A = 16, j = Array.from({ length: A }, (e, t) => Ee[t % 4]), Oe = j.flatMap((e, t) => y(t * 4, e, 4.4, .5)), ke = j.flatMap((e, t) => [v(t * 4, De[t % 4], 3.4, .7)]), Ae = [
	3,
	2,
	3,
	1,
	2,
	3,
	1,
	2
], je = j.flatMap((e, t) => {
	if (t % 2 == 1) return [];
	let n = Ae[t / 2 % Ae.length];
	return [v(t * 4 + 2.5, e[n] + 12, 2, .34)];
}), Me = [
	v(0, 69, 3, .4),
	v(4, 67, 3, .36),
	v(8, 64, 5, .33)
], Ne = {
	name: "dusk",
	tempo: 66,
	beatsPerBar: 4,
	bars: A,
	tracks: [
		{
			name: "pad",
			patch: T("pad"),
			gain: 1.05,
			muted: !1,
			notes: C(Oe)
		},
		{
			name: "bass",
			patch: T("bass"),
			gain: .75,
			muted: !1,
			notes: C(ke)
		},
		{
			name: "drops",
			patch: T("bell"),
			gain: .75,
			muted: !1,
			notes: C(je)
		},
		{
			name: "answer",
			patch: T("pluck"),
			gain: .85,
			muted: !1,
			notes: C(x(Me, 32))
		}
	]
}, M = [
	57,
	60,
	64
], Pe = [
	M,
	M,
	[
		53,
		57,
		60,
		65
	],
	[
		55,
		59,
		62,
		67
	]
], N = 16, P = Array.from({ length: N }, (e, t) => Pe[t % 4]), Fe = P.flatMap((e, t) => y(t * 4, e, 4, .42)), Ie = P.flatMap((e, t) => [
	v(t * 4, 33, 2.2, .8),
	v(t * 4 + 2, 45, .8, .5),
	v(t * 4 + 3, 45, .6, .42)
]), Le = [
	57,
	60,
	62,
	64,
	62,
	60,
	57,
	55
], Re = P.flatMap((e, t) => Le.map((e, n) => v(t * 4 + n * .5, t % 4 == 2 ? e - 4 : t % 4 == 3 ? e - 2 : e, .42, n % 2 == 0 ? .55 : .38))), ze = [v(0, 36, .3, 1), v(2, 36, .3, .85)], Be = [v(0, 81, .6, .3), v(2, 84, .5, .24)], Ve = [v(1.5, 62, .1, .3), v(3.5, 62, .1, .22)], He = x(S(ze, 12, 4), 16), Ue = x(S(Be, 12, 4), 16), We = x(S(Ve, 8, 4), 32), Ge = [
	v(0, 69, 2),
	v(2, 72, 1.5),
	v(3.5, 71, .5, .6),
	v(4, 69, 3),
	v(8, 65, 2),
	v(10, 67, 1.5),
	v(11.5, 69, .5, .6),
	v(12, 72, 3.5)
], Ke = {
	name: "forge",
	tempo: 96,
	beatsPerBar: 4,
	bars: N,
	tracks: [
		{
			name: "pad",
			patch: T("pad"),
			gain: .7,
			muted: !1,
			notes: C(Fe)
		},
		{
			name: "drone",
			patch: T("bass"),
			gain: .75,
			muted: !1,
			notes: C(Ie)
		},
		{
			name: "riff",
			patch: T("pluck"),
			gain: .6,
			muted: !1,
			notes: C(Re)
		},
		{
			name: "call",
			patch: T("reed"),
			gain: .8,
			muted: !1,
			notes: C(x(Ge, 32))
		},
		{
			name: "hammer",
			patch: T("drum"),
			gain: .8,
			muted: !1,
			notes: C(He)
		},
		{
			name: "anvil",
			patch: T("bell"),
			gain: .6,
			muted: !1,
			notes: C(Ue)
		},
		{
			name: "tongs",
			patch: T("shaker"),
			gain: .7,
			muted: !1,
			notes: C(We)
		}
	]
}, F = [
	55,
	59,
	62,
	67
], qe = [
	F,
	[
		53,
		57,
		60,
		65
	],
	[
		55,
		60,
		64,
		67
	],
	F
], Je = [
	43,
	41,
	48,
	43
], Ye = 16, I = Array.from({ length: Ye }, (e, t) => qe[t % 4]), Xe = I.flatMap((e, t) => y(t * 4, e, 3.6, .4)), Ze = I.flatMap((e, t) => {
	let n = Je[t % 4];
	return [
		v(t * 4, n, .9, .85),
		v(t * 4 + 1.5, n + 7, .5, .55),
		v(t * 4 + 2, n, .9, .7),
		v(t * 4 + 3.5, n + 12, .4, .5)
	];
}), Qe = [
	0,
	2,
	3,
	2,
	1,
	2,
	3,
	1
], $e = I.flatMap((e, t) => Qe.map((n, r) => v(t * 4 + r * .5, e[n] + 12, .4, r % 2 == 0 ? .5 : .34))), et = [
	v(0, 40, .2, .95),
	v(2.5, 40, .2, .7),
	v(3, 40, .2, .4)
], tt = [v(1, 58, .15, .6), v(3, 58, .15, .65)], nt = Array.from({ length: 8 }, (e, t) => v(t * .5, 86, .1, t % 2 == 0 ? .35 : .2)), rt = x(S(et, 12, 4), 16), it = x(S(tt, 12, 4), 16), at = x(S(nt, 10, 4), 24), ot = [
	v(0, 67, 1),
	v(1, 69, 1),
	v(2, 71, 1.5),
	v(3.5, 72, .5, .6),
	v(4, 74, 2),
	v(6, 71, 1.5),
	v(7.5, 69, .5, .6),
	v(8, 67, 1),
	v(9, 65, 1),
	v(10, 67, 2),
	v(12, 62, 1.5),
	v(13.5, 64, .5, .6),
	v(14, 67, 2)
], st = [
	v(0, 74, 1.5),
	v(1.5, 72, .5, .6),
	v(2, 71, 2),
	v(4, 69, 1),
	v(5, 67, 1),
	v(6, 69, 2),
	v(8, 71, 1.5),
	v(9.5, 72, .5, .6),
	v(10, 74, 3),
	v(14, 67, 2, .6)
], ct = [...x(ot, 32), ...x(st, 48)], lt = {
	name: "market",
	tempo: 112,
	beatsPerBar: 4,
	bars: Ye,
	tracks: [
		{
			name: "pad",
			patch: T("pad"),
			gain: .7,
			muted: !1,
			notes: C(Xe)
		},
		{
			name: "bass",
			patch: T("bass"),
			gain: .7,
			muted: !1,
			notes: C(Ze)
		},
		{
			name: "strings",
			patch: T("pluck"),
			gain: .6,
			muted: !1,
			notes: C($e)
		},
		{
			name: "melody",
			patch: T("reed"),
			gain: .85,
			muted: !1,
			notes: C(ct)
		},
		{
			name: "drum",
			patch: T("drum"),
			gain: .75,
			muted: !1,
			notes: C(rt)
		},
		{
			name: "clap",
			patch: T("brush"),
			gain: .7,
			muted: !1,
			notes: C(it)
		},
		{
			name: "shaker",
			patch: T("shaker"),
			gain: .8,
			muted: !1,
			notes: C(at)
		}
	]
}, ut = [
	[
		57,
		62,
		65,
		69
	],
	[
		58,
		62,
		65,
		70
	],
	[
		57,
		60,
		65,
		69
	],
	[
		55,
		60,
		64,
		67
	]
], dt = [
	38,
	46,
	41,
	48
], ft = 16, L = Array.from({ length: ft }, (e, t) => ut[t % 4]), pt = L.flatMap((e, t) => y(t * 4, e, 3.8, .55)), mt = L.flatMap((e, t) => {
	let n = dt[t % 4];
	return [v(t * 4, n, 2.4, .8), v(t * 4 + 2.5, n + 7, 1.2, .5)];
}), ht = [
	0,
	2,
	1,
	3,
	2,
	1,
	0,
	2
], gt = L.flatMap((e, t) => {
	let n = Math.floor(t / 4), r = n === 0 ? .3 : n === 3 ? .34 : .46;
	return ht.map((n, i) => v(t * 4 + i * .5, e[n] + 12, .45, i % 2 == 0 ? r : r * .7));
}), _t = [
	v(0, 69, 1.5),
	v(1.5, 72, .5, .6),
	v(2, 74, 2),
	v(4, 70, 1.5),
	v(5.5, 69, .5, .6),
	v(6, 65, 2),
	v(8, 69, 1),
	v(9, 72, 1),
	v(10, 74, 1.5),
	v(11.5, 76, .5, .65),
	v(12, 74, 2),
	v(14, 72, 1.5, .7)
], vt = [
	v(0, 74, 1),
	v(1, 76, 1),
	v(2, 77, 2),
	v(4, 74, 1.5),
	v(5.5, 72, .5, .6),
	v(6, 70, 2),
	v(8, 69, 1),
	v(9, 65, 1),
	v(10, 67, 2),
	v(12, 69, 3)
], yt = [
	v(0, 69, 2, .6),
	v(4, 65, 2, .55),
	v(8, 62, 6, .5)
], bt = [
	...x(_t, 16),
	...x(vt, 32),
	...x(yt, 48)
], xt = x(S([
	v(1, 60, .1, .45),
	v(3, 60, .1, .5),
	v(3.5, 60, .1, .2)
], 12, 4), 16), St = {
	name: "meadow",
	tempo: 92,
	beatsPerBar: 4,
	bars: ft,
	tracks: [
		{
			name: "pad",
			patch: T("pad"),
			gain: .738,
			muted: !1,
			notes: C(pt)
		},
		{
			name: "bass",
			patch: T("bass"),
			gain: .656,
			muted: !1,
			notes: C(mt)
		},
		{
			name: "bells",
			patch: T("bell"),
			gain: .574,
			muted: !1,
			notes: C(gt)
		},
		{
			name: "melody",
			patch: T("reed"),
			gain: .82,
			muted: !1,
			notes: C(bt)
		},
		{
			name: "brush",
			patch: T("brush"),
			gain: .492,
			muted: !1,
			notes: C(xt)
		}
	]
}, R = [
	[
		55,
		60,
		64,
		71
	],
	[
		57,
		62,
		66,
		69
	],
	[
		55,
		59,
		62,
		67
	],
	[
		57,
		60,
		64,
		69
	]
], Ct = 16, wt = R.flatMap((e, t) => y(t * 16, e, 17, .46)), z = [
	36,
	38,
	43,
	33
], Tt = R.flatMap((e, t) => [v(t * 16, z[t], 9, .6), v(t * 16 + 10, z[t] + 7, 5, .4)]), Et = [
	[2.5, 3],
	[7, 2],
	[11.5, 1],
	[14, 3],
	[19, 2],
	[23.5, 3],
	[27, 0],
	[34.5, 2],
	[39, 3],
	[43.5, 1],
	[50, 2],
	[55.5, 3],
	[59, 1]
].map(([e, t]) => {
	let n = R[Math.floor(e / 16) % 4];
	return v(e, n[t] + 12, 2.5, .3);
}), Dt = [
	v(0, 72, 4, .4),
	v(5, 76, 3, .36),
	v(9, 74, 6, .34),
	v(17, 71, 4, .36),
	v(22, 69, 7, .3)
], Ot = {
	name: "mistfell",
	tempo: 58,
	beatsPerBar: 4,
	bars: Ct,
	tracks: [
		{
			name: "pad",
			patch: T("pad"),
			gain: 1.3,
			muted: !1,
			notes: C(wt)
		},
		{
			name: "deep",
			patch: T("bass"),
			gain: .85,
			muted: !1,
			notes: C(Tt)
		},
		{
			name: "drops",
			patch: T("bell"),
			gain: .8,
			muted: !1,
			notes: C(Et)
		},
		{
			name: "air",
			patch: T("reed"),
			gain: .8,
			muted: !1,
			notes: C(x(Dt, 26))
		}
	]
}, B = [
	57,
	62,
	65,
	69
], kt = [
	B,
	B,
	[
		58,
		62,
		65,
		70
	],
	[
		55,
		59,
		62,
		67
	]
], At = [
	38,
	38,
	34,
	43
], V = 16, H = Array.from({ length: V }, (e, t) => kt[t % 4]), jt = H.flatMap((e, t) => y(t * 4, e, 3.7, .3)), Mt = [
	[0, 0],
	[.75, 0],
	[1.5, 0],
	[2, 12],
	[2.5, 0],
	[3, 10],
	[3.5, 12]
], Nt = H.flatMap((e, t) => {
	let n = At[t % 4];
	return Mt.map(([e, r]) => v(t * 4 + e, n + r, .4, e === 0 ? .95 : .65));
}), Pt = [
	1.5,
	2.75,
	3.5
], Ft = H.flatMap((e, t) => t % 4 == 1 || t % 4 == 3 ? Pt.flatMap((n) => y(t * 4 + n, e, .22, .55)) : y(t * 4 + 1.5, e, .22, .5)), It = "X.....x.X.......", Lt = "X.....x.X...x...", U = "....X.......X...", Rt = "...o..o....o..o.", zt = "x.xoxox.x.xoxox.", Bt = [...x(S(b(It, 36), 7, 8), 8), ...x(S(b(Lt, 36), 7, 8), 12)], Vt = x(S(b(U, 62), 14, 4), 8), Ht = x(S(b(Rt, 62), 12, 4), 16), Ut = x(S(b(U, 64), 14, 4), 8), Wt = S(b(zt, 90), 16, 4), W = [
	v(0, 74, .5),
	v(.75, 77, .5),
	v(1.5, 81, 1),
	v(3, 79, 1),
	v(4.5, 77, .5),
	v(5.25, 74, .5),
	v(6, 72, 1.5),
	v(8, 77, .5),
	v(8.75, 79, .5),
	v(9.5, 81, 1.5),
	v(11.5, 79, .5),
	v(12, 74, 3)
], Gt = [...x(W, 16), ...x(W, 48)], Kt = {
	name: "quarry",
	tempo: 128,
	beatsPerBar: 4,
	bars: V,
	tracks: [
		{
			name: "pad",
			patch: T("pad"),
			gain: .316,
			muted: !1,
			notes: C(jt)
		},
		{
			name: "bass",
			patch: T("growl"),
			gain: .505,
			muted: !1,
			notes: C(Nt)
		},
		{
			name: "stabs",
			patch: T("blade"),
			gain: .38,
			muted: !1,
			notes: C(Ft)
		},
		{
			name: "figure",
			patch: T("bell"),
			gain: .348,
			muted: !1,
			notes: C(Gt)
		},
		{
			name: "kick",
			patch: T("kick"),
			gain: .505,
			muted: !1,
			notes: C(Bt)
		},
		{
			name: "snare",
			patch: T("snare"),
			gain: .442,
			muted: !1,
			notes: C(Vt)
		},
		{
			name: "ghost",
			patch: T("snare"),
			gain: .286,
			muted: !1,
			notes: C(Ht)
		},
		{
			name: "body",
			patch: T("rim"),
			gain: .348,
			muted: !1,
			notes: C(Ut)
		},
		{
			name: "hat",
			patch: T("hat"),
			gain: .442,
			muted: !1,
			notes: C(Wt)
		}
	]
}, qt = [
	[
		57,
		60,
		64
	],
	[
		53,
		57,
		60,
		65
	],
	[
		55,
		60,
		64,
		67
	],
	[
		55,
		59,
		62,
		67
	]
], Jt = [
	33,
	29,
	36,
	31
], G = 16, K = Array.from({ length: G }, (e, t) => qt[t % 4]), Yt = K.flatMap((e, t) => y(t * 4, e, 3.9, .4)), Xt = [
	0,
	0,
	12,
	0,
	0,
	12,
	0,
	7
], Zt = K.flatMap((e, t) => {
	let n = Jt[t % 4];
	return Xt.map((e, r) => v(t * 4 + r * .5, n + e, .42, r % 2 == 0 ? .9 : .6));
}), Qt = [
	0,
	1,
	2,
	1,
	2,
	1,
	0,
	1,
	2,
	3,
	2,
	1,
	2,
	1,
	0,
	1
], $t = K.flatMap((e, t) => Qt.map((n, r) => v(t * 4 + r * .25, e[n % e.length] + 12, .22, r % 4 == 0 ? .55 : .34))), en = "X...X...X...X...", q = "....X.......X...", tn = "..o....o..o....o", nn = "x.x.x.x.x.x.x.x.", rn = "..............x.", an = x(S(b(en, 36), 12, 4), 16), on = x(S([...b(q, 62), ...b(tn, 62)], 12, 4), 16), sn = x(S(b(q, 64), 12, 4), 16), cn = S(b(nn, 90), 16, 4), ln = x(S(b(rn, 88, .25, .3), 6, 8), 16), un = [
	v(0, 69, 1),
	v(1, 72, .5),
	v(1.5, 74, 1.5),
	v(3, 72, 1),
	v(4, 69, 2),
	v(6.5, 67, 1.5),
	v(8, 65, 1),
	v(9, 67, 1),
	v(10, 69, 2),
	v(12, 74, 1.5),
	v(13.5, 72, .5),
	v(14, 71, 2)
], dn = [
	v(0, 76, 1),
	v(1, 74, .5),
	v(1.5, 72, 1.5),
	v(3, 74, 1),
	v(4, 77, 2),
	v(6.5, 76, 1.5),
	v(8, 74, 1),
	v(9, 72, 1),
	v(10, 69, 1.5),
	v(11.5, 72, .5),
	v(12, 74, 4)
], fn = [...x(un, 32), ...x(dn, 48)], pn = {
	name: "ramparts",
	tempo: 140,
	beatsPerBar: 4,
	bars: G,
	tracks: [
		{
			name: "pad",
			patch: T("pad"),
			gain: .362,
			muted: !1,
			notes: C(Yt)
		},
		{
			name: "bass",
			patch: T("growl"),
			gain: .431,
			muted: !1,
			notes: C(Zt)
		},
		{
			name: "arp",
			patch: T("pluck"),
			gain: .33,
			muted: !1,
			notes: C($t)
		},
		{
			name: "lead",
			patch: T("blade"),
			gain: .527,
			muted: !1,
			notes: C(fn)
		},
		{
			name: "kick",
			patch: T("kick"),
			gain: .417,
			muted: !1,
			notes: C(an)
		},
		{
			name: "snare",
			patch: T("snare"),
			gain: .417,
			muted: !1,
			notes: C(on)
		},
		{
			name: "body",
			patch: T("rim"),
			gain: .33,
			muted: !1,
			notes: C(sn)
		},
		{
			name: "hat",
			patch: T("hat"),
			gain: .461,
			muted: !1,
			notes: C(cn)
		},
		{
			name: "open",
			patch: T("openhat"),
			gain: .396,
			muted: !1,
			notes: C(ln)
		}
	]
}, J = 16, mn = Array.from({ length: J / 4 }, (e, t) => [...y(t * 16, [38, 45], 9, .5), ...y(t * 16 + 9.5, [
	38,
	45,
	50
], 6.9, .42)]).flat(), hn = "X.....x.....X...", gn = "X.....x.....X.x.", _n = "..x..x..x..x..x.", vn = "x.oox.oox.oox.oo", yn = "o.o.o.o.o.o.o.oo", bn = [...x(S(b(hn, 45), 7, 4), 0), ...x(S(b(gn, 45), 9, 4), 28)], xn = x(S(b(_n, 57), 12, 4), 16), Sn = x(S(b(vn, 76), 14, 4), 8), Cn = x(S(b(yn, 84), 8, 4), 32), wn = x(S([v(0, 33, .4, .9)], 12, 4), 16), Tn = [
	v(0, 74, 1.5),
	v(1.5, 72, .5, .55),
	v(2, 69, 2),
	v(4.5, 67, 1.5),
	v(6, 69, 2),
	v(8, 74, 1),
	v(9, 77, 3),
	v(13, 74, 2.5)
], En = [
	v(0, 69, 1),
	v(1, 72, 1),
	v(2, 74, 1.5),
	v(3.5, 72, .5, .55),
	v(4, 69, 2.5),
	v(7, 65, 1),
	v(8, 67, 1.5),
	v(9.5, 69, .5, .55),
	v(10, 62, 4)
], Dn = [...x(Tn, 16), ...x(En, 44)], On = x(Dn, 4).map((e) => ({
	...e,
	pitch: e.pitch - 12,
	velocity: e.velocity * .45
})), kn = {
	name: "temple",
	tempo: 84,
	beatsPerBar: 4,
	bars: J,
	tracks: [
		{
			name: "conch",
			patch: T("pad"),
			gain: .7,
			muted: !1,
			notes: C(mn)
		},
		{
			name: "ocarina",
			patch: T("flute"),
			gain: .85,
			muted: !1,
			notes: C(Dn)
		},
		{
			name: "across",
			patch: T("flute"),
			gain: .45,
			muted: !1,
			notes: C(On)
		},
		{
			name: "log low",
			patch: T("wood"),
			gain: .8,
			muted: !1,
			notes: C(bn)
		},
		{
			name: "log high",
			patch: T("wood"),
			gain: .5,
			muted: !1,
			notes: C(xn)
		},
		{
			name: "deep",
			patch: T("drum"),
			gain: .7,
			muted: !1,
			notes: C(wn)
		},
		{
			name: "rattle",
			patch: T("rattle"),
			gain: .55,
			muted: !1,
			notes: C(Sn)
		},
		{
			name: "shake",
			patch: T("rattle"),
			gain: .4,
			muted: !1,
			notes: C(Cn)
		}
	]
}, An = [
	[
		50,
		57,
		62
	],
	[
		46,
		53,
		58
	],
	[
		43,
		50,
		55
	],
	[
		45,
		52,
		57,
		61
	]
], jn = [
	38,
	34,
	31,
	33
], Mn = 16, Y = Array.from({ length: Mn }, (e, t) => An[t % 4]), Nn = Y.flatMap((e, t) => y(t * 4, t >= 12 ? [...e, e[0] + 24] : e, 3.7, .5)), Pn = Y.flatMap((e, t) => y(t * 4, [e[0] + 12], 4, .3)), Fn = Y.flatMap((e, t) => {
	let n = jn[t % 4];
	return [
		v(t * 4, n, 1.4, .95),
		v(t * 4 + 1.5, n, .4, .6),
		v(t * 4 + 2, n, 1.4, .85),
		v(t * 4 + 3.5, n + 7, .4, .55)
	];
}), In = "X...x...X...x..x", Ln = "..x...x...x...x.", Rn = "............x.x.", zn = "X.......X.......", Bn = "....X.......X..x", Vn = "x.x.x.x.x.x.x.x.", Hn = "xxxxxxxxXxXxXXXX", Un = S(b(In, 45), 16, 4), Wn = x(S(b(Ln, 52), 12, 4), 16), Gn = x(S(b(Rn, 57), 8, 4), 32), Kn = x(S(b(zn, 36), 12, 4), 16), qn = x(S(b(Bn, 62), 8, 4), 32), Jn = x(S(b(Vn, 90), 8, 4), 32), Yn = [...x(b(Hn, 52), 28), ...x(b(Hn, 57), 60)], Xn = [
	v(0, 69, 1.5),
	v(1.5, 70, .5),
	v(2, 69, 1),
	v(3, 65, 1),
	v(4, 62, 2.5),
	v(7, 69, 1),
	v(8, 73, 1.5),
	v(9.5, 74, 2.5),
	v(12, 73, 1),
	v(13, 69, 3)
], Zn = [
	St,
	lt,
	Ke,
	pn,
	Ne,
	me,
	Kt,
	Ot,
	kn,
	Te,
	{
		name: "warhorns",
		tempo: 150,
		beatsPerBar: 4,
		bars: Mn,
		tracks: [
			{
				name: "horns",
				patch: T("reed"),
				gain: .54,
				muted: !1,
				notes: C(Nn)
			},
			{
				name: "pad",
				patch: T("pad"),
				gain: .304,
				muted: !1,
				notes: C(Pn)
			},
			{
				name: "bass",
				patch: T("growl"),
				gain: .454,
				muted: !1,
				notes: C(Fn)
			},
			{
				name: "call",
				patch: T("blade"),
				gain: .507,
				muted: !1,
				notes: C(x(Xn, 32))
			},
			{
				name: "toms low",
				patch: T("tom"),
				gain: .391,
				muted: !1,
				notes: C(Un)
			},
			{
				name: "toms mid",
				patch: T("tom"),
				gain: .406,
				muted: !1,
				notes: C(Wn)
			},
			{
				name: "toms high",
				patch: T("tom"),
				gain: .339,
				muted: !1,
				notes: C(Gn)
			},
			{
				name: "roll",
				patch: T("tom"),
				gain: .3,
				muted: !1,
				notes: C(Yn)
			},
			{
				name: "kick",
				patch: T("kick"),
				gain: .404,
				muted: !1,
				notes: C(Kn)
			},
			{
				name: "snare",
				patch: T("snare"),
				gain: .439,
				muted: !1,
				notes: C(qn)
			},
			{
				name: "hat",
				patch: T("hat"),
				gain: .372,
				muted: !1,
				notes: C(Jn)
			}
		]
	}
], Qn = {
	kick: ["X..x..X...x.X...", 36],
	snare: ["....X.......X..x", 62],
	rim: ["....X.......X...", 64],
	hat: ["x.x.x.x.x.x.x.xx", 90],
	openhat: ["..............x.", 88],
	tom: ["X...x...X..x..x.", 45],
	wood: ["X.....x.....X...", 50],
	rattle: ["x.oox.oox.oox.oo", 76],
	shaker: ["x.x.x.x.x.x.x.oo", 86],
	drum: ["X..x..x.X..x..x.", 36],
	brush: ["....x.......x...", 58]
}, $n = 104, er = [
	0,
	7,
	12,
	16,
	19,
	12
], tr = (e) => e.cutoff < 700 ? 38 : e.cutoff < 2e3 ? 57 : 69, nr = null, X = null, Z = null, Q = null, rr = 0;
function ir() {
	return nr ??= new AudioContext(), X || (X = new _(nr), X.onEnd = () => $()), X;
}
function $() {
	window.clearTimeout(rr), Q &&= (Q.textContent = "play", Q.classList.remove("on"), null);
}
function ar() {
	X?.silence(), Z?.fade(.06), Z = null, $();
}
function or(e) {
	let t = Q === e;
	return ar(), !t && (Q = e, e.textContent = "stop", e.classList.add("on"), !0);
}
function sr(e, t) {
	let n = Zn.find((e) => e.name === t);
	if (!n || !or(e)) return;
	let r = ir();
	r.setSong(n), r.play(0);
}
function cr(e, n) {
	let r = w[n];
	if (!r || !or(e)) return;
	let i = ir();
	i.wake(), Z = t(i.bus);
	let a = 60 / $n, o = Qn[n], s = o ? S(b(o[0], o[1]), 2, 4) : er.map((e, t) => ({
		at: t * .5,
		length: t === er.length - 1 ? 2 : .45,
		pitch: tr(r) + e,
		velocity: .85
	})), c = i.bus.ctx.currentTime + .06, l = 0;
	for (let e of s) u(Z, r, e.pitch, e.velocity, c + e.at * a, e.length * a), l = Math.max(l, (e.at + e.length) * a);
	rr = window.setTimeout($, (l + r.release + .2) * 1e3);
}
for (let e of document.querySelectorAll("button.play")) {
	let t = e.dataset.song, n = e.dataset.voice;
	e.disabled = !1, e.addEventListener("click", () => {
		t ? sr(e, t) : n && cr(e, n);
	});
}
//#endregion
