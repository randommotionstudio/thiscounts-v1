// All sounds are synthesised with Web Audio: no audio files to load.
// Stands in for AVAudioEngine in the iOS build.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  /** Must be called from a user gesture (iOS Safari keeps audio locked until then). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ok() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  tone({ type = 'sine', f0, f1 = f0, dur, vol, delay = 0, attack = 0.004 }) {
    if (!this.ok) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hiss({ dur, vol, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, delay = 0 }) {
    if (!this.ok) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  /** The throb every ripe pimple pulses to. */
  throb(accent) {
    this.tone({ f0: accent ? 86 : 74, f1: 42, dur: 0.17, vol: accent ? 0.34 : 0.22, attack: 0.006 });
    this.hiss({ dur: 0.05, vol: 0.03, type: 'lowpass', f0: 500 });
  }

  jump() { this.tone({ type: 'triangle', f0: 330, f1: 640, dur: 0.1, vol: 0.12 }); }
  flap() { this.hiss({ dur: 0.12, vol: 0.12, f0: 2500, f1: 900, q: 0.8 }); }
  pound() { this.hiss({ dur: 0.09, vol: 0.1, f0: 2200, f1: 300, q: 0.7 }); }
  land() { this.hiss({ dur: 0.05, vol: 0.05, type: 'lowpass', f0: 600 }); }

  pop(grade) {
    if (grade === 'perfect') {
      this.tone({ f0: 980, f1: 170, dur: 0.24, vol: 0.32 });
      this.hiss({ dur: 0.2, vol: 0.28, f0: 3000, f1: 350, q: 1.2 });
      this.tone({ type: 'triangle', f0: 1568, dur: 0.1, vol: 0.08, delay: 0.03 });
      this.tone({ type: 'triangle', f0: 2093, dur: 0.14, vol: 0.07, delay: 0.08 });
    } else if (grade === 'great') {
      this.tone({ f0: 720, f1: 210, dur: 0.18, vol: 0.26 });
      this.hiss({ dur: 0.14, vol: 0.18, f0: 2200, f1: 400 });
    } else {
      this.tone({ f0: 480, f1: 260, dur: 0.12, vol: 0.16 });
      this.hiss({ dur: 0.08, vol: 0.08, f0: 1400, f1: 500 });
    }
  }

  squish() {
    this.hiss({ dur: 0.12, vol: 0.14, type: 'lowpass', f0: 1200, f1: 200 });
    this.tone({ f0: 230, f1: 130, dur: 0.1, vol: 0.1 });
  }
  splat() { this.hiss({ dur: 0.22, vol: 0.18, type: 'lowpass', f0: 1800, f1: 200 }); }
  thud() {
    this.tone({ f0: 140, f1: 55, dur: 0.18, vol: 0.3 });
    this.hiss({ dur: 0.08, vol: 0.12, type: 'lowpass', f0: 400 });
  }
  snip() { this.tone({ type: 'square', f0: 2400, f1: 1800, dur: 0.04, vol: 0.06 }); }
  crack() {
    this.hiss({ dur: 0.18, vol: 0.25, type: 'highpass', f0: 1800 });
    this.tone({ type: 'square', f0: 300, f1: 120, dur: 0.12, vol: 0.08 });
  }
  ready() { this.tone({ type: 'triangle', f0: 1320, dur: 0.12, vol: 0.12 }); }
  pickup() {
    [660, 880, 1320].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.12, delay: i * 0.06 }));
  }
  goo() { this.tone({ type: 'sine', f0: 900 + Math.random() * 300, f1: 1500, dur: 0.07, vol: 0.08 }); }
  erupt() {
    this.tone({ f0: 90, f1: 40, dur: 0.3, vol: 0.3 });
    this.hiss({ dur: 0.3, vol: 0.2, type: 'lowpass', f0: 900, f1: 200 });
  }
  streak(mult) {
    const base = 520 * Math.pow(1.26, mult - 2);
    [1, 1.25, 1.5].forEach((m, i) => this.tone({ type: 'square', f0: base * m, dur: 0.09, vol: 0.05, delay: i * 0.05 }));
  }
  bubble() { this.tone({ f0: 700 + Math.random() * 900, f1: 1800, dur: 0.04, vol: 0.03 }); }
  death(cause) {
    if (cause === 'foam') this.hiss({ dur: 0.9, vol: 0.3, type: 'lowpass', f0: 3000, f1: 300 });
    this.tone({ type: 'sawtooth', f0: 420, f1: 60, dur: 0.6, vol: 0.14 });
  }
  ui() { this.tone({ type: 'triangle', f0: 620, f1: 820, dur: 0.06, vol: 0.08 }); }
}
