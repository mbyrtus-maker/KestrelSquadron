(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3, D = Math.PI/180;

/* ---------- Synth audio ---------- */
const A = G.audio = {
  ctx:null, last:{},
  init(){
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = 0.5*this.vol(); this.master.connect(c.destination);
      this.loadClips();
      const nb = this.nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
      const mk = (type, f) => { const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.3; g.gain.value = 0; o.connect(lp).connect(g).connect(this.master); o.start(); return {o, g}; };
      this.lockL = mk('triangle', 520); this.warnL = mk('triangle', 420); this.gpwsL = mk('triangle', 300);
      // Engine: looped brown noise (airflow rumble) + a soft sine turbine tone. No harsh harmonics, no pulsing.
      const N = c.sampleRate*4, eb = c.createBuffer(1, N, c.sampleRate), ed = eb.getChannelData(0); let last = 0, pk = 0;
      for (let i = 0; i < N; i++) { last = (last + 0.02*(Math.random()*2 - 1))/1.02; ed[i] = last; }
      const drift = ed[N - 1] - ed[0]; for (let i = 0; i < N; i++) { ed[i] -= drift*i/N; pk = Math.max(pk, Math.abs(ed[i])); }
      for (let i = 0; i < N; i++) ed[i] /= pk;
      const src = c.createBufferSource(); src.buffer = eb; src.loop = true;
      const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 500; ef.Q.value = 0.4;
      const tone = c.createOscillator(); tone.type = 'sine'; tone.frequency.value = 180; const tg = c.createGain(); tg.gain.value = 0;
      const eg = c.createGain(); eg.gain.value = 0;
      src.connect(ef).connect(eg).connect(this.master); tone.connect(tg).connect(this.master); src.start(); tone.start();
      this.eng = {f:ef, g:eg, o:tone, tg};
    } catch (err) { this.ctx = null; }
  },
  vol(){ const v = G.save && G.save.vol; return v === undefined ? 0.55 : v; },
  setVolume(v){ G.save.vol = v; G.persist(); if (this.master) this.master.gain.setTargetAtTime(0.5*v, this.ctx.currentTime, 0.05); },
  step(s){
    if (this.thr('step', 120)) return;
    // Recorded mech footfalls: ten steps half a second apart; play a random one (never the same twice running) with slight pitch drift.
    const c = this.ctx, buf = this.clips && this.clips.steps;
    if (c && buf) {
      let k; do { k = Math.floor(Math.random()*10); } while (k === this.lastStep); this.lastStep = k;
      const src = c.createBufferSource(), g = c.createGain(); src.buffer = buf; src.playbackRate.value = 0.94 + Math.random()*0.12; g.gain.value = 0.75*s;
      src.connect(g).connect(this.master); src.start(c.currentTime, k*0.5 + 0.03, 0.46); return;
    }
    this.noise(0.28, 'lowpass', 160, 1, 0.42*s, 45); this.tone(58, 0.22, 'sine', 0.22*s, 38);
    this.tone(310, 0.16, 'triangle', 0.028*s, 0, 0.02); this.tone(487, 0.12, 'triangle', 0.018*s, 0, 0.02);
    this.noise(0.12, 'bandpass', 2400, 3, 0.03*s, 1200, 0.06);
  },
  thr(k, gap){ const n = performance.now(); if (n - (this.last[k] || 0) < gap) return true; this.last[k] = n; return false; },
  noise(dur, type, f0, q, gain, f1, delay = 0){
    const c = this.ctx; if (!c || gain < 0.003) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.nb; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()*0.4); s.stop(t + dur + 0.05);
  },
  tone(f0, dur, type, gain, f1, delay = 0){
    const c = this.ctx; if (!c || gain < 0.003) return; const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  att(pos, range = 1600){ const g = G.game; if (!g || !g.player) return 0.5; return Math.max(0, 1 - g.player.pos.distanceTo(pos)/range); },
  gun(id){
    // Every gun uses the recorded machine gun; pitch sets each weapon apart, and slow-cycling guns get short bursts with their tail.
    const RATE = {gun_m20:1, gun_m30:0.84, gun_pl2:1.18, pod_gp40:0.92, pod_rp7:0.7, pod_br9:1.08};
    if (RATE[id]) { const w = [...G.WEAPONS.gun, ...G.WEAPONS.pod].find(x => x.id === id); if (this.cannon(RATE[id], w ? 1000/w.rof + 45 : 140)) return; }
    if (this.thr('gun', 40)) return;
    if (id === 'pod_rp7') { this.tone(220, 0.3, 'square', 0.18, 50); this.noise(0.25, 'lowpass', 2000, 1, 0.4, 200); }
    else if (id === 'gun_pl2' || id === 'pod_br9') this.tone(1600, 0.1, 'sawtooth', 0.07, 380);
    else this.noise(0.07, 'bandpass', id === 'gun_m30' ? 900 : 1500, 1.2, 0.2);
  },
  shot(pos, kind){
    const a = this.att(pos); if (!a || this.thr('shot' + kind, 70)) return;
    if (kind === 'shell') this.noise(0.35, 'lowpass', 700, 1, 0.5*a, 120);
    else if (kind === 'bolt') this.tone(520, 0.2, 'sawtooth', 0.12*a, 180);
    else if (kind === 'mg') this.noise(0.05, 'bandpass', 1500, 1.6, 0.16*a);
    else if (kind === 'missile') this.noise(0.8, 'bandpass', 600, 1, 0.3*a, 200);
  },
  missile(){ this.noise(0.8, 'bandpass', 1100, 0.9, 0.35, 260); },
  boom(pos, s = 1){ const a = this.att(pos, 2600); if (!a || this.thr('boom', 50)) return; this.noise(1.2 + s*0.3, 'lowpass', 500, 0.8, 0.5*a*Math.min(1.4, s), 50); },
  laser(){ this.tone(2400, 0.26, 'sawtooth', 0.09, 300); },
  /* Mechanical transformation: servo whine, ratcheting gears, metal clanks, lock-in thunk. Pitched per mode. */
  /* Decode the embedded transformation clip once; until it is ready the synthesised servo sound stands in. */
  loadClips(){
    const c = this.ctx; if (!c || this.clipsAsked || !G.SFX) return; this.clipsAsked = true; this.clips = {};
    for (const k in G.SFX) try { const bin = atob(G.SFX[k]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const ok = b => { this.clips[k] = b; if (k === 'transform') this.xfBuf = b; }, p = c.decodeAudioData(u8.buffer, ok, () => {}); if (p && p.catch) p.then(ok).catch(() => {}); } catch (e) {}
  },
  /* Carrier launch: the recorded take-off roar, started at engine run-up and faded when the cinematic hands over. */
  takeoff(){
    const c = this.ctx, buf = this.clips && this.clips.takeoff; if (!c || !buf || this.toSrc) return;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; g.gain.value = 2.4; s.connect(g).connect(this.master); s.start();
    this.toSrc = s; this.toGain = g; s.onended = () => { if (this.toSrc === s) this.toSrc = null; };
  },
  takeoffStop(fade = 2){
    const c = this.ctx, s = this.toSrc, g = this.toGain; if (!c || !s) return; this.toSrc = null;
    const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + fade); try { s.stop(t + fade + 0.05); } catch (e) {}
  },
  /* Jet cannon: loop the sustained-fire part of the recorded burst while the trigger is held, then let its real tail ring out. */
  cannon(rate, hold = 140){
    const c = this.ctx, buf = this.clips && this.clips.cannon; if (!c || !buf) return false;
    const now = c.currentTime, vol = 0.34;
    if (this.gunSrc && this.gunRate !== rate) { this.gunSrc.playbackRate.value = rate; }
    this.gunRate = rate;
    if (!this.gunSrc) {
      const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.loop = true; s.loopStart = 0.25; s.loopEnd = 2.55; s.playbackRate.value = rate;
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol, now + 0.02); s.connect(g).connect(this.master); s.start(now, 0.25 + Math.random()*1.8);
      this.gunSrc = s; this.gunGain = g;
    }
    clearTimeout(this.gunTimer);
    this.gunTimer = setTimeout(() => {
      const s = this.gunSrc, g = this.gunGain, t = c.currentTime; this.gunSrc = null; if (!s) return;
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.025); s.stop(t + 0.2);
      const tail = c.createBufferSource(), tg = c.createGain(); tail.buffer = buf; tail.playbackRate.value = rate; tg.gain.value = vol*0.9; tail.connect(tg).connect(this.master); tail.start(t, 2.66, 1.1);
    }, Math.max(140, hold));
    return true;
  },
  transform(mode){
    const c = this.ctx; if (!c || this.thr('xf', 250)) return;
    this.loadClips();
    if (this.xfBuf) { const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.xfBuf; s.playbackRate.value = 0.82; g.gain.value = 0.5; s.connect(g).connect(this.master); s.start(); return; }
    const p = mode === 'jet' ? 1.22 : mode === 'mech' ? 0.8 : 1.0, t0 = c.currentTime + 0.01;
    const servo = (start, dur, f0, f1, g) => {
      const t = t0 + start, o = c.createOscillator(), bp = c.createBiquadFilter(), gn = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f0*p, t); o.frequency.exponentialRampToValueAtTime(f1*p, t + dur);
      bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.setValueAtTime(f0*p*2, t); bp.frequency.exponentialRampToValueAtTime(f1*p*2, t + dur);
      lfo.frequency.value = 38; lg.gain.value = f0*p*0.05; lfo.connect(lg).connect(o.frequency);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.04); gn.gain.setValueAtTime(g, t + dur - 0.05); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(bp).connect(gn).connect(this.master); o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    };
    servo(0, 0.28, 220, 520, 0.12); servo(0.3, 0.22, 430, 260, 0.1); servo(0.55, 0.3, 300, 780, 0.12);
    for (let i = 0; i < 16; i++) this.noise(0.018, 'highpass', 4200, 1, 0.22, 0, 0.02 + i*0.05 + (i > 7 ? 0.06 : 0));
    const clank = (when, base, g) => {
      for (const [m, a] of [[1, 1], [1.59, 0.6], [2.41, 0.4], [3.76, 0.25]]) this.tone(base*m*p, 0.38, 'triangle', g*a, base*m*p*0.97, when);
      this.noise(0.08, 'bandpass', 1800*p, 2, g*1.6, 0, when);
    };
    clank(0.27, 180, 0.12); clank(0.53, 140, 0.12);
    this.noise(0.35, 'lowpass', 260, 1, 0.75, 50, 0.86); this.tone(70*p, 0.32, 'sine', 0.38, 40*p, 0.86);
    this.tone(1900*p, 0.25, 'triangle', 0.07, 0, 0.9); this.noise(0.45, 'highpass', 3500, 0.7, 0.12, 0, 0.93);
  },
  thump(s = 1){ this.noise(0.3, 'lowpass', 180, 1, 0.6*s, 40); },
  swoosh(){ this.noise(0.32, 'bandpass', 1800, 2, 0.35, 350); },
  /* One-shot recorded clip with a little pitch variation so repeats don't sound identical. */
  clip(k, vol = 1, rate = 1, vary = 0.06){
    const c = this.ctx, buf = this.clips && this.clips[k]; if (!c || !buf) return false;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.playbackRate.value = rate*(1 + (Math.random()*2 - 1)*vary); g.gain.value = vol;
    s.connect(g).connect(this.master); s.start(); return true;
  },
  // Power sword: ignition when drawn, a hum-whoosh per cut (peak lands on the strike), a crackling clash on contact.
  saberOn(){ if (!this.clip('saberOn', 0.9, 1, 0.02)) this.tone(240, 0.2, 'triangle', 0.08, 520); },
  saberSwing(heavy){ if (this.thr('sbs', 120)) return; if (!this.clip('saberSwing', heavy ? 1.0 : 0.8, heavy ? 0.85 : 1.05)) this.swoosh(); },
  saberHit(heavy){ if (this.thr('sbh', 90)) return; this.clip('saberHit', heavy ? 1.1 : 0.85, heavy ? 0.9 : 1.0, 0.08); },
  dash(){ this.noise(0.5, 'lowpass', 900, 0.8, 0.45, 160); this.noise(0.25, 'bandpass', 2400, 1.5, 0.12, 700); this.tone(90, 0.3, 'sine', 0.18, 50); },
  clang(){ this.tone(900, 0.25, 'triangle', 0.14); this.tone(1347, 0.18, 'triangle', 0.08); },
  /* Noise through a soft-clipping shaper and a sweeping filter, optionally chopped by a fast LFO: tearing / crunching textures. */
  dirty(dur, type, f0, f1, q, gain, delay = 0, chop = 0){
    const c = this.ctx; if (!c || gain < 0.003) return; const t = c.currentTime + delay;
    if (!this.shp) { const n = 1024, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const v = i/(n - 1)*2 - 1; cv[i] = Math.tanh(v*7); } this.shp = cv; }
    const s = c.createBufferSource(); s.buffer = this.nb; const ws = c.createWaveShaper(); ws.curve = this.shp;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    let out = g;
    if (chop) { const am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); am.gain.value = 0.55; lfo.type = 'square'; lfo.frequency.setValueAtTime(chop, t); lfo.frequency.linearRampToValueAtTime(chop*0.45, t + dur); lg.gain.value = 0.45; lfo.connect(lg).connect(am.gain); g.connect(am); out = am; lfo.start(t); lfo.stop(t + dur + 0.05); }
    s.connect(ws).connect(f).connect(g); out.connect(this.master); s.start(t, Math.random()*0.5); s.stop(t + dur + 0.05);
  },
  /* Blade impact. 'metal': heavy plate shearing — low thud, inharmonic hull ring, distorted grinding tear.
     'concrete': crunch, cracking chips and a rubble rumble, with a little rebar ring. */
  impact(mat, s = 1){
    if (!this.ctx || this.thr('imp' + mat, 60)) return;
    this.tone(82, 0.42, 'sine', 0.55*s, 30); this.tone(41, 0.5, 'sine', 0.35*s, 26);
    this.noise(0.035, 'highpass', 2600, 0.7, 0.55*s);
    this.dirty(0.2, 'lowpass', 1400, 260, 0.8, 0.5*s);
    if (mat === 'metal') {
      for (const [m, a, d] of [[1, 1, 0.7], [2.29, 0.75, 0.5], [3.61, 0.5, 0.38], [5.17, 0.32, 0.28], [6.93, 0.2, 0.2]]) this.tone(176*m, d, 'sine', 0.075*a*s, 176*m*0.97, 0.004);
      this.dirty(0.38, 'bandpass', 4200, 900, 2.2, 0.34*s, 0.01, 52);
      this.dirty(0.22, 'highpass', 5200, 2600, 0.8, 0.12*s, 0.02, 90);
    } else {
      this.dirty(0.55, 'lowpass', 1800, 180, 0.6, 0.55*s, 0.01, 34);
      for (let i = 0; i < 16; i++) { const k = 1 - i/18; this.noise(0.015 + Math.random()*0.035, 'bandpass', 900 + Math.random()*3600, 1.4, (0.14 + Math.random()*0.22)*s*k, 0, 0.025 + Math.random()*0.5*(0.4 + i/16)); }
      this.noise(1.1, 'lowpass', 260, 0.7, 0.32*s, 70, 0.08);
      this.tone(232, 0.32, 'sine', 0.035*s, 220, 0.02); this.tone(611, 0.22, 'sine', 0.02*s, 590, 0.02);
    }
  },
  lowAmmo(){ if (this.thr('lowammo', 900)) return; this.tone(440, 0.09, 'triangle', 0.08); this.tone(330, 0.14, 'triangle', 0.08, 0, 0.12); },
  flare(){ this.noise(0.25, 'highpass', 2200, 1, 0.3); this.noise(0.25, 'highpass', 2600, 1, 0.25, 0, 0.08); },
  chime(){ this.tone(880, 0.18, 'sine', 0.18); this.tone(1320, 0.3, 'sine', 0.16, 0, 0.12); },
  radio(){ this.noise(0.09, 'bandpass', 2600, 3, 0.15); },
  ping(){ this.tone(1200, 0.1, 'sine', 0.16); this.tone(1800, 0.14, 'sine', 0.14, 0, 0.1); },
  say(text, gap){
    try { const ss = window.speechSynthesis; if (!ss || this.thr('say' + text, gap)) return;
      const u = new SpeechSynthesisUtterance(text); u.rate = 1.1; u.pitch = 0.5; u.volume = 0.9; ss.cancel(); ss.speak(u); } catch (e) {}
  },
  /* Menu click: a heavy console switch rather than a beep. Low thump, muffled body click, then a faint latch tick. */
  ui(){
    if (this.thr('ui', 30)) return;
    this.tone(150, 0.11, 'sine', 0.12, 58);
    this.tone(92, 0.16, 'sine', 0.05, 70, 0.005);
    this.noise(0.03, 'lowpass', 1700, 0.8, 0.11, 500);
    this.noise(0.012, 'bandpass', 3200, 2.5, 0.03, 2600, 0.028);
  },
  loops(game, paused){
    if (!this.ctx) return;
    const t = performance.now()/1000, set = (L, v) => L.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015);
    if (!game || paused || !game.player.alive || game.over) { set(this.lockL, 0); set(this.warnL, 0); set(this.eng, 0); set({g:this.eng.tg}, 0); set(this.gpwsL, 0); return; }
    const P = game.player, locked = P.lockedList.length > 0, seeking = P.locks.size > 0;
    set(this.lockL, locked ? 0.06 : seeking && (t*6 % 1) < 0.35 ? 0.05 : 0);
    this.lockL.o.frequency.value = locked ? 660 : 520;
    let w = 0;
    if (P.incoming > 0) { w = (t*5 % 1) < 0.55 ? 0.08 : 0.04; this.warnL.o.frequency.value = (t*5 % 2) < 1 ? 520 : 400; }
    else if (P.lockedBy > 0) { w = (t*2.5 % 1) < 0.3 ? 0.06 : 0; this.warnL.o.frequency.value = 400; }
    set(this.warnL, w);
    if (P.gpws === 2) { const ph = (t*2.2) % 1; this.gpwsL.o.frequency.value = 240 + ph*260; set(this.gpwsL, ph < 0.8 ? 0.06 : 0); this.say(P.mode === 'mech' ? 'Thrusters' : 'Pull up', 2200); }
    else if (P.gpws === 1 && P.mode === 'jet') { set(this.gpwsL, (t*2 % 1) < 0.15 ? 0.04 : 0); this.gpwsL.o.frequency.value = 330; this.say('Terrain', 2600); }
    else set(this.gpwsL, 0);
    const now = this.ctx.currentTime, on = this.engOn !== false;
    const jet = P.mode === 'jet', hov = P.mode === 'hover', thr = P.thrusting;
    const cut = jet ? 320 + P.throttle*700 + (P.boost ? 700 : 0) : hov ? 650 : thr ? 1400 : 300;
    const pitch = jet ? 160 + P.throttle*140 + (P.boost ? 60 : 0) : hov ? 260 : 120;
    const g = !on ? 0 : jet ? 0.09 + P.throttle*0.06 + (P.boost ? 0.06 : 0) : hov ? 0.1 : thr ? 0.14 : 0;
    const tgv = !on ? 0 : jet ? 0.006 + P.throttle*0.006 : hov ? 0.012 : 0;
    this.eng.f.frequency.setTargetAtTime(cut, now, 0.25); this.eng.o.frequency.setTargetAtTime(pitch, now, 0.4);
    this.eng.g.gain.setTargetAtTime(g, now, 0.2); this.eng.tg.gain.setTargetAtTime(tgv, now, 0.3);
  }
};

/* ---------- HUD ---------- */
const COL = {jet:'#8dffb0', hover:'#72e4ff', mech:'#ffbf57'}, RED = '#ff5a48', AMB = '#ffb238', RANGES = [1, 2, 4, 8];
const $ = id => document.getElementById(id);
const CP = new V3(), CV = new V3(), pv = new V3(), pv2 = new V3(), LP = new V3(), LM = new V3(), LD = new V3(), LF = new V3(), LG = new V3(), tv = new V3();

const H = G.hud = {
  init(){
    this.cv = $('hud'); this.x = this.cv.getContext('2d'); this.rc = $('radar').getContext('2d');
    this.ri = 2; this.flashT = 0; this.hurtT = 0; this.hitT = 0; this.feedList = []; this.radioList = [];
    addEventListener('resize', () => this.resize()); this.resize();
  },
  resize(){
    const dpr = Math.min(2, devicePixelRatio || 1); this.dpr = dpr;
    this.cv.width = innerWidth*dpr; this.cv.height = innerHeight*dpr; this.x.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  begin(game){
    this.g = game; $('hudui').hidden = false; this.cv.hidden = false;
    $('hTitle').textContent = game.m.title; $('hGoal').textContent = game.m.goal;
    $('hSides').innerHTML = game.m.sides.map((s, i) => `<li data-i="${i}"><span class="st"></span>${G.sideLabel(s)}</li>`).join('');
    $('hTrain').hidden = !game.training; $('hSides').hidden = !!game.training;
    const wl = $('hWps'); wl.hidden = !game.ops;
    if (game.ops) wl.innerHTML = game.ops.tasks.map(T => `<li data-i="${T.i}"><span class="wn">WP${T.i + 1}</span><span class="wt"></span><b class="wp"></b></li>`).join('') + `<li data-i="rtb"><span class="wn">RTB</span><span class="wt">${game.world.space ? 'Burn for home' : 'Return to the Bastion'}</span><b class="wp"></b></li>`;
    if (game.ops) game.ops.tasks.forEach(T => { wl.children[T.i].querySelector('.wt').textContent = G.TASKS[T.kind].short + ' · ' + T.place; });
    $('hRadio').innerHTML = ''; $('hFeed').innerHTML = ''; this.radioList = []; this.feedList = [];
    $('hWingName').textContent = game.wing.name;
    this.setMode(game.player.mode, false); this.setView(game.player.view);
  },
  hide(){ $('hudui').hidden = true; this.cv.hidden = true; $('cockpit').hidden = true; document.body.classList.remove('ck'); },
  setMode(m, anim){
    document.body.dataset.mode = m;
    $('hMode').textContent = {jet:'Jet', hover:'Hover', mech:'Mech'}[m];
    $('hPerk').textContent = {jet:'Fastest · lock-on missiles · out-turns enemy jets', hover:'Aimed gun pod · missiles · head laser · can land', mech:'Hidden from AA radar and SAMs on the ground (crews still use small arms up close) · 40% less damage · braced pod +40% · double-tap W A S D to dash'}[m];
    const ck = $('cockpit'); ck.dataset.mode = m;
    if (anim) { document.body.classList.remove('xform'); void document.body.offsetWidth; document.body.classList.add('xform'); }
    $('hFuelLbl').textContent = m === 'jet' ? 'THROTTLE' : m === 'hover' ? 'LIFT' : 'THRUSTERS';
  },
  setView(v){ $('cockpit').hidden = v !== 'cockpit'; document.body.classList.toggle('ck', v === 'cockpit'); },
  radio(from, text){
    const el = document.createElement('div'); el.className = 'line';
    el.innerHTML = `<b></b><span></span>`; el.firstChild.textContent = from; el.lastChild.textContent = text;
    if (from === 'Arkwright') el.classList.add('ark'); else if (from === 'Hollow') el.classList.add('foe');
    const box = $('hRadio'); box.appendChild(el); this.radioList.push({el, t:9});
    while (box.children.length > 4) { box.removeChild(box.firstChild); this.radioList.shift(); }
    if (from !== 'HUD') G.audio.radio();
  },
  flash(t){ this.flashText = t; this.flashT = 2.4; },
  intro(on, title, sub){
    const el = $('introUi'); el.hidden = !on;
    $('hudui').hidden = on; this.cv.hidden = on; if (on) $('cockpit').hidden = true;
    if (on) { $('iTitle').textContent = title || ''; $('iSub').textContent = sub || ''; }
  },
  train(i, n, title, text, why){
    $('tStep').textContent = `Step ${i} of ${n}`; $('tTitle').textContent = title; $('tText').textContent = text; $('tWhy').textContent = why || '';
    $('hGoal').textContent = title; const el = $('hTrain'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  },
  trainProg(t){ const e = $('tProg'); if (e.textContent !== t) e.textContent = t; },
  hurt(f){ this.hurtT = Math.min(1, this.hurtT + f*5 + 0.08); },
  /* Hit markers sit on the target that was hit (tracking it as it moves); one marker per target, refreshed on each hit. */
  hitMark(kill, e){
    const L = this.hits || (this.hits = []);
    let m = e && L.find(h => h.e === e); if (!m) { m = {e, p:new THREE.Vector3()}; L.push(m); if (L.length > 12) L.shift(); }
    if (e) m.p.set(e.pos.x, e.pos.y + (e.cy || 0), e.pos.z);
    m.t = kill ? 0.45 : 0.16; m.T = m.t; m.kill = kill;
  },
  feed(name, cash, by){
    const el = document.createElement('div'); el.className = 'kf' + (by === 'wing' ? ' w' : '');
    el.textContent = `${by === 'wing' ? G.wingName() + ': ' : ''}${name} +${G.money(cash)}`;
    const box = $('hFeed'); box.prepend(el); this.feedList.push({el, t:4});
    while (box.children.length > 5) box.removeChild(box.lastChild);
  },
  proj(v, cam){
    pv.copy(v).project(cam);
    return {x:(pv.x + 1)/2*innerWidth, y:(1 - pv.y)/2*innerHeight, on: pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1, behind: pv.z > 1};
  },
  edgeArrow(x, v, cam, label, color){
    pv.copy(v).applyMatrix4(cam.matrixWorldInverse);
    const a = Math.atan2(-pv.y, pv.x), W = innerWidth, Hh = innerHeight, r = Math.min(W, Hh)*0.36;
    const px = W/2 + Math.cos(a)*r, py = Hh/2 + Math.sin(a)*r;
    x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = color; x.beginPath(); x.moveTo(12, 0); x.lineTo(-6, -8); x.lineTo(-6, 8); x.closePath(); x.fill(); x.restore();
    if (label) { x.fillStyle = color; x.fillText(label, px + 14, py + 4); }
  },
  update(game, dt){
    const x = this.x, P = game.player, cam = game.camera, W = innerWidth, Hh = innerHeight, I = G.input;
    const col = COL[P.mode]; x.clearRect(0, 0, W, Hh);
    try { this.radar(game, dt); } catch (e) { console.error('radar', e); }
    x.lineWidth = 1.5; x.strokeStyle = col; x.fillStyle = col; x.font = '13px "Share Tech Mono", ui-monospace, monospace'; x.textAlign = 'left';
    const cx = W/2, cy = Hh/2, heading = ((-P.yaw/D) % 360 + 360) % 360;
    if (P.alive) {
      if (P.mode === 'jet') {
        const ppd = Hh/cam.fov;
        x.save(); x.translate(cx, cy); x.rotate(-P.roll); x.beginPath(); x.rect(-260, -Hh*0.32, 520, Hh*0.64); x.clip();
        x.globalAlpha = 0.75;
        for (let a = -80; a <= 80; a += 10) {
          const y = (P.pitch/D - a)*ppd; if (Math.abs(y) > Hh*0.32) continue;
          x.setLineDash(a < 0 ? [8, 6] : []); x.beginPath();
          if (a === 0) { x.moveTo(-250, y); x.lineTo(-70, y); x.moveTo(70, y); x.lineTo(250, y); }
          else { x.moveTo(-140, y); x.lineTo(-70, y); x.lineTo(-70, y + (a > 0 ? 8 : -8)); x.moveTo(140, y); x.lineTo(70, y); x.lineTo(70, y + (a > 0 ? 8 : -8)); x.fillText(String(a), 146, y + 4); }
          x.stroke();
        }
        x.setLineDash([]); x.restore(); x.globalAlpha = 1;
        x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.moveTo(cx - 22, cy); x.lineTo(cx - 9, cy); x.moveTo(cx + 9, cy); x.lineTo(cx + 22, cy); x.moveTo(cx, cy - 9); x.lineTo(cx, cy - 16); x.stroke();
        const mx = (I.mx + 1)/2*W, my = (1 - I.my)/2*Hh;
        x.globalAlpha = 0.5; x.setLineDash([3, 5]); x.beginPath(); x.moveTo(cx, cy); x.lineTo(mx, my); x.stroke(); x.setLineDash([]);
        x.beginPath(); x.arc(mx, my, 7, 0, 7); x.stroke(); x.globalAlpha = 1;
      } else {
        const mx = (I.mx + 1)/2*W, my = (1 - I.my)/2*Hh;
        x.globalAlpha = I.locked ? 0 : 0.25;
        if (!I.locked) for (const s of [-1, 1]) { const ex = cx + s*0.34*W/2; x.beginPath(); x.moveTo(ex, cy - 30); x.lineTo(ex, cy + 30); x.stroke(); const ey = cy + s*0.42*Hh/2; x.beginPath(); x.moveTo(cx - 30, ey); x.lineTo(cx + 30, ey); x.stroke(); }
        x.globalAlpha = 1;
        if (P.mode === 'hover') {
          x.beginPath(); x.arc(mx, my, 18, 0, 7); x.moveTo(mx - 28, my); x.lineTo(mx - 10, my); x.moveTo(mx + 10, my); x.lineTo(mx + 28, my); x.moveTo(mx, my + 10); x.lineTo(mx, my + 26); x.stroke();
          const lr = Math.tan(0.27)/Math.tan(cam.fov*Math.PI/360)*Hh/2; x.save(); x.globalAlpha = 0.35; x.setLineDash([6, 8]); x.beginPath(); x.arc(mx, my, lr, 0, 7); x.stroke(); x.restore();
          const lc = Math.max(0, P.cd.las/P.w.laser.cd); if (lc > 0) { x.beginPath(); x.arc(mx, my, 24, -Math.PI/2, -Math.PI/2 + (1 - lc)*Math.PI*2); x.stroke(); }
        } else {
          const s = 16;
          x.beginPath();
          for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { x.moveTo(mx + a*s, my + b*s*0.4); x.lineTo(mx + a*s, my + b*s); x.lineTo(mx + a*s*0.4, my + b*s); }
          x.stroke(); x.fillRect(mx - 1.5, my - 1.5, 3, 3);
          if (P.block > 0.5) { x.textAlign = 'center'; x.fillText('SHIELD UP', mx, my + 36); x.textAlign = 'left'; }
        }
      }
      x.save(); x.beginPath(); x.rect(cx - 160, 8, 320, 34); x.clip();
      for (let d = -40; d <= 40; d += 5) {
        const hd = Math.round(heading/5)*5 + d, px = cx + (hd - heading)*4;
        x.beginPath(); x.moveTo(px, 16); x.lineTo(px, hd % 15 === 0 ? 26 : 21); x.stroke();
        if (hd % 15 === 0) { const v = ((hd % 360) + 360) % 360; x.textAlign = 'center'; x.fillText(({0:'N', 90:'E', 180:'S', 270:'W'})[v] || String(v).padStart(3, '0'), px, 39); }
      }
      x.restore(); x.textAlign = 'center'; x.fillText('▼', cx, 12); x.textAlign = 'left';
      const spd = Math.round((P.mode === 'jet' ? P.speed : Math.hypot(P.vel.x, P.vel.z))*3.6), alt = Math.round(P.pos.y);
      x.strokeRect(cx - 250, cy - 12, 70, 24); x.fillText(String(spd).padStart(4, ' '), cx - 240, cy + 5);
      const sp = game.world.space;   // no altimeter in orbit: there's no up or down out there
      if (!sp) { x.strokeRect(cx + 180, cy - 12, 70, 24); x.fillText(String(alt).padStart(5, ' '), cx + 188, cy + 5); }
      x.globalAlpha = 0.6; x.fillText('KM/H', cx - 250, cy - 18); if (!sp) x.fillText('ALT M', cx + 180, cy - 18); x.globalAlpha = 1;      this.stores(x, P, cx, cy, col);
    }
    // world markers
    const range = P.st.radar;
    for (const e of game.ents) {
      if (!e.alive || e.team !== 'enemy') continue;
      pv2.copy(e.pos); pv2.y += e.cy; const dist = pv2.distanceTo(P.pos); if (dist > range) continue;
      const s = this.proj(pv2, cam); if (!s.on) continue;
      const c = e.tag === 'obj' || e.tag === 'ace' || e.tag === 'aaside' ? AMB : RED, r = 7;
      x.strokeStyle = c; x.fillStyle = c; x.beginPath();
      if (e.cls === 'air') { x.moveTo(s.x, s.y - r); x.lineTo(s.x + r, s.y + r*0.7); x.lineTo(s.x - r, s.y + r*0.7); x.closePath(); }
      else if (e.cls === 'mech') { x.moveTo(s.x, s.y - r); x.lineTo(s.x + r, s.y); x.lineTo(s.x, s.y + r); x.lineTo(s.x - r, s.y); x.closePath(); }
      else x.rect(s.x - r*0.8, s.y - r*0.8, r*1.6, r*1.6);
      e.hitT > 0 ? x.fill() : x.stroke();
      const lk = P.locks.get(e);
      if (lk !== undefined) {
        if (lk >= 1) { x.strokeStyle = RED; x.lineWidth = 2.5; x.beginPath(); x.moveTo(s.x, s.y - 20); x.lineTo(s.x + 20, s.y); x.lineTo(s.x, s.y + 20); x.lineTo(s.x - 20, s.y); x.closePath(); x.stroke(); x.fillStyle = RED; x.fillText('LOCK', s.x + 22, s.y - 12); x.lineWidth = 1.5; }
        else { x.beginPath(); x.arc(s.x, s.y, 34 - 20*lk, 0, 7); x.stroke(); }
      }
      if (e === P.target) {
        const b = 22; x.strokeStyle = c; x.lineWidth = 2; x.beginPath();
        for (const [a, d] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { x.moveTo(s.x + a*b, s.y + d*b*0.5); x.lineTo(s.x + a*b, s.y + d*b); x.lineTo(s.x + a*b*0.5, s.y + d*b); }
        x.stroke(); x.lineWidth = 1.5; x.fillStyle = c;
        x.fillText(`${e.name}${P.sticky === e ? ' [T]' : ''}`, s.x + b + 6, s.y - 6); x.fillText(`${Math.round(dist)} m`, s.x + b + 6, s.y + 9);
        if (e.occluded && P.mode !== 'mech') { x.fillStyle = '#9aa3a8'; x.fillText('NO LINE OF SIGHT', s.x + b + 6, s.y + 24); x.fillStyle = c; }
        x.fillRect(s.x - b, s.y + b + 5, 2*b*Math.max(0, e.hp/e.maxHp), 3);
      }
    }
    if (P.target && P.target.alive) { pv2.copy(P.target.pos); pv2.y += P.target.cy; const s = this.proj(pv2, cam); if (!s.on) this.edgeArrow(x, pv2, cam, 'TGT', AMB); }
    if (P.alive) this.leads(x, game, P, cam);
    const mark = (pos, label, color, dia) => {
      const s = this.proj(pos, cam), d = Math.round(pos.distanceTo(P.pos));
      if (!s.on) { this.edgeArrow(x, pos, cam, label, color); return; }
      x.strokeStyle = color; x.fillStyle = color; x.beginPath();
      if (dia) { x.moveTo(s.x, s.y - 12); x.lineTo(s.x + 12, s.y); x.lineTo(s.x, s.y + 12); x.lineTo(s.x - 12, s.y); x.closePath(); } else x.arc(s.x, s.y, 11, 0, 7);
      x.stroke(); x.textAlign = 'center'; x.fillText(`${label} ${d > 999 ? (d/1000).toFixed(1) + ' km' : d + ' m'}`, s.x, s.y - 18); x.textAlign = 'left';
    };
    for (const g of game.civGroups) if (!g.done) mark(pv2.copy(g.pos).setY(g.pos.y + 3), 'CIV', '#6dff9a', true);
    for (const w of game.waypoints) if (!w.done) mark(pv2.copy(w.pos).setY(w.pos.y + 20), 'RECON', AMB, true);
    if (game.ping) mark(game.ping.pos, 'MARK', '#6dff9a', false);
    for (const mk of game.marks || []) mark(mk.pos, mk.label, mk.color, true);
    if (game.wing.alive) { const s = this.proj(game.wing.pos, cam); if (s.on) { x.fillStyle = '#72e4ff'; x.strokeStyle = '#72e4ff'; x.beginPath(); x.arc(s.x, s.y, 6, 0, 7); x.stroke(); x.fillText('RIDGE', s.x + 9, s.y + 4); } }
    if (['base', 'city', 'mech', 'sam', 'convoy', 'air'].includes(game.m.type) && !game.complete) {
      pv2.set(game.center.x, game.world.height(game.center.x, game.center.z) + 40, game.center.z);
      if (pv2.distanceTo(P.pos) > 900) mark(pv2, 'AO', AMB, false);
    }
    // hits & warnings
    for (const h of P.hits) { x.strokeStyle = `rgba(255,70,50,${h.t})`; x.lineWidth = 5; x.beginPath(); const a = -h.a - Math.PI/2; x.arc(cx, cy, 120, a - 0.3, a + 0.3); x.stroke(); }
    x.lineWidth = 1.5;
    if (P.alive && P.painting) {
      const n = P.lockedList.length, mx = P.paintMax || 1, ag = P.msl === 'gnd';
      x.save(); x.textAlign = 'center'; x.font = '600 15px "Share Tech Mono", ui-monospace, monospace'; x.shadowColor = 'rgba(0,0,0,0.85)'; x.shadowBlur = 4;
      x.fillStyle = n ? RED : col; x.fillText(`${ag ? 'A-G' : 'A-A'} · LOCKS ${n}/${mx}${n ? ' · RELEASE TO FIRE' : ' · SWEEP ACROSS TARGETS'}`, cx, cy + 58);
      for (let k = 0; k < mx; k++) { x.beginPath(); x.rect(cx - mx*9 + k*18 + 3, cy + 66, 12, 6); k < n ? x.fill() : (x.strokeStyle = col, x.stroke()); }
      x.restore();
    }
    const shUp = P.mode === 'mech' && P.block >= 0.5, cRdy = shUp && P.chargeReady && P.chargeReady();
    const mc = P.mode === 'mech' && (P.wpnWant === 1 || shUp) ? (P.chargeT > 0 && P.chargeTgt && P.chargeTgt.alive ? P.chargeTgt : P.swing >= 0 && P.meleeTgt && P.meleeTgt.alive ? P.meleeTgt : P.meleeCand) : null;
    if (shUp) {
      // Shield charge status under the reticle.
      x.save(); x.font = '700 12px ui-monospace, monospace'; x.textAlign = 'center';
      const why = P.chargeT > 0 ? 'CHARGING' : cRdy ? (mc ? 'CHARGE READY · W W' : 'CHARGE READY · W W (no target)') : P.fuel < 20 ? 'CHARGE · LOW THRUST' : 'CHARGE RECHARGING';
      x.fillStyle = cRdy || P.chargeT > 0 ? (mc ? '#7df9ff' : '#9fd8e0') : '#7d8a90'; x.globalAlpha = cRdy && mc ? 0.75 + 0.25*Math.sin(game.time*10) : 0.85;
      x.fillText(why, W/2, Hh/2 + 78);
      if (!cRdy && !(P.chargeT > 0)) { const f = Math.max(0, Math.min(1, 1 - Math.max(0, P.dashCd)/1.6)); x.fillRect(W/2 - 40, Hh/2 + 84, 80*f, 3); x.globalAlpha = 0.3; x.fillRect(W/2 - 40, Hh/2 + 84, 80, 3); }
      x.restore();
    }
    if (mc) {
      // Blade target: a rotating diamond on whatever the next cut will dash to.
      tv.set(mc.pos.x, mc.pos.y + (mc.cy || 0), mc.pos.z); const s = this.proj(tv, cam);
      if (s.on) {
        const d = Math.hypot(mc.pos.x - P.pos.x, mc.pos.z - P.pos.z), r = 22 + Math.min(14, 900/Math.max(30, d)), rot = (game.time*2.4)%(Math.PI*2);
        const cc = shUp && P.wpnWant !== 1 || P.chargeT > 0 ? (cRdy || P.chargeT > 0 ? '#7df9ff' : '#7d8a90') : '#ffb347';
        x.save(); x.translate(s.x, s.y); x.strokeStyle = cc; x.fillStyle = cc; x.lineWidth = 2; x.globalAlpha = 0.9;
        x.save(); x.rotate(Math.PI/4 + (P.swing >= 0 ? rot*3 : 0)); x.beginPath();
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { x.moveTo(a*r, b*r*0.45); x.lineTo(a*r, b*r); x.lineTo(a*r*0.45, b*r); } x.stroke(); x.restore();
        x.font = '600 11px ui-monospace, monospace'; x.textAlign = 'center';
        x.fillText(shUp ? (cRdy ? `CHARGE ${Math.round(d)}m` : `${Math.round(d)}m`) : d < 20 + mc.r ? 'IN REACH' : `LUNGE ${Math.round(d)}m`, 0, r + 18);
        if (P.swing >= 0) { for (let i = 0; i < 3; i++) { x.globalAlpha = i <= P.combo ? 1 : 0.25; x.fillRect(-16 + i*12, -r - 14, 8, 4); } }
        x.restore(); x.textAlign = 'left';
      }
    }
    if (this.hits && this.hits.length) {
      x.save(); x.lineCap = 'round';
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i]; h.t -= dt; if (h.t <= 0) { this.hits.splice(i, 1); continue; }
        if (h.e && h.e.alive) h.p.set(h.e.pos.x, h.e.pos.y + (h.e.cy || 0), h.e.pos.z);
        const s = h.e ? this.proj(h.p, cam) : {x:cx, y:cy, on:true}; if (!s.on) continue;
        const d = Math.max(60, cam.position.distanceTo(h.p)), sz = Math.max(0.7, Math.min(1.6, 260/d)), k = h.t/h.T, g = h.kill ? 1 + (1 - k)*0.8 : 1;
        x.globalAlpha = Math.min(1, k*2.2); x.strokeStyle = h.kill ? RED : '#ffffff'; x.lineWidth = h.kill ? 3 : 2.2; x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 3;
        x.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { x.moveTo(s.x + a*7*sz*g, s.y + b*7*sz*g); x.lineTo(s.x + a*16*sz*g, s.y + b*16*sz*g); } x.stroke();
      }
      x.restore(); x.lineWidth = 1.5;
    }
    if (game.rescue) {
      x.strokeStyle = '#6dff9a'; x.fillStyle = '#6dff9a'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy + 90, 26, -Math.PI/2, -Math.PI/2 + game.rescue.p*Math.PI*2); x.stroke(); x.lineWidth = 1.5;
      x.textAlign = 'center'; x.fillText(game.rescue.hold ? `BOARDING ${Math.round(game.rescue.p*100)}%` : 'LAND OR HOVER LOW AND SLOW TO BOARD', cx, cy + 136); x.textAlign = 'left';
    }
    let warn = '', wc = AMB;
    if (P.alive) {
      if (P.gpws === 2) { warn = P.mode === 'jet' ? '' : P.mode === 'mech' ? 'PULL UP · HOLD SPACE FOR THRUSTERS' : 'PULL UP · SINK RATE'; wc = RED; }
      else if (P.incoming > 0) { warn = 'MISSILE · F FLARES'; wc = RED; }
      else if (P.gpws === 1) warn = P.mode === 'jet' ? 'TERRAIN · TERRAIN' : P.mode === 'mech' ? 'FALLING · READY THRUSTERS' : 'SINK RATE';
      else if (P.mode === 'jet' && P.stall > 0.3) warn = 'STALL · THROTTLE UP OR NOSE DOWN';
      else if (P.lockedBy > 0) warn = 'LOCK WARNING';
      else if (P.outAO) warn = Math.hypot(P.pos.x, P.pos.z) > 7100 ? 'AREA BOUNDARY · TURNING BACK' : 'LEAVING AREA OF OPERATIONS';
      else if (P.hp/P.maxHp < 0.25) { warn = game.pickups && game.pickups.length ? 'HULL CRITICAL · GREEN BEACON = REPAIRS' : 'HULL CRITICAL'; wc = RED; }
      if (!game.world.space) this.ralt(x, P, cx, cy, Hh, W, col);
    }
    if (P.alive && P.gpws === 2 && (performance.now() % 500) < 330) {
      x.save(); x.strokeStyle = RED; x.fillStyle = RED; x.lineWidth = 3; x.textAlign = 'center';
      x.font = '700 46px "Saira Extra Condensed", "Arial Narrow", sans-serif';
      x.strokeRect(cx - 110, cy + 48, 220, 58); x.fillText('PULL UP', cx, cy + 94); x.restore();
    }
    x.textAlign = 'center';
    if (warn && (performance.now() % 600) < 420) { x.font = '600 26px "Saira Extra Condensed", "Arial Narrow", sans-serif'; x.fillStyle = wc; x.fillText(warn, cx, Hh*0.27); }
    // Boss health bar (the Sovereign, Hollow): top centre while the boss is alive and engaged.
    { const B = [game.cruiser, game.harbinger, game.skycarrier, game.sovereign, game.hollow].find(b => b && b.alive);
      if (B) { const bw = Math.min(560, W*0.5), bx = cx - bw/2, by = 58, f = Math.max(0, B.hp/B.maxHp), half = B.type === 'colossus';
        x.save(); x.globalAlpha = 0.92; x.fillStyle = 'rgba(10,12,14,0.55)'; x.fillRect(bx - 4, by - 4, bw + 8, 18);
        x.fillStyle = f < 0.5 ? '#ff5a3c' : '#ffb238'; x.fillRect(bx, by, bw*f, 10);
        if (half) { x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(bx + bw*0.5 - 1, by - 2, 2, 14); }
        if (B.type === 'harbinger') { x.fillStyle = 'rgba(255,255,255,0.6)'; for (const t of [1/3, 2/3]) x.fillRect(bx + bw*t - 1, by - 2, 2, 14); }
        x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 1; x.strokeRect(bx, by, bw, 10);
        x.font = '600 15px "Saira Extra Condensed", "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffe2c0';
        let lab = B.bossBar || (B.boss ? 'HOLLOW' : B.name.toUpperCase());
        if (B.fm) lab += ` · ${B.fm.toUpperCase()} MODE${B.armored ? ' · TRANSFORMING' : ''}`;
        if (B.type === 'cruiser') { const n = B.parts.filter(p => p.type === 'shieldgen' && p.alive).length; lab += n ? ` · GENERATORS ${n}/3 · SHIELD UP` : ' · SHIELD DOWN'; }
        if (B.parts && B.type === 'skycarrier') { const n = B.parts.filter(p => p.type === 'skyengine' && p.alive).length; lab += n ? ` · ENGINES ${n}/6 · REACTOR SEALED` : ' · REACTOR EXPOSED'; }
        x.fillText(lab, cx, by - 9); x.restore(); x.textAlign = 'center'; } }
    if (this.flashT > 0) { this.flashT -= dt; x.font = '600 22px "Saira Extra Condensed", "Arial Narrow", sans-serif'; x.fillStyle = col; x.globalAlpha = Math.min(1, this.flashT); x.fillText(this.flashText, cx, Hh*0.33); x.globalAlpha = 1; }
    if (game.complete && P.alive) { const hold = game.holdRTB && game.holdRTB(); x.font = '600 18px "Saira Extra Condensed", "Arial Narrow", sans-serif'; x.fillStyle = hold ? RED : '#6dff9a'; x.fillText(hold ? 'RED TAILS OVERHEAD · DRIVE HOLLOW OFF BEFORE LANDING' : 'OBJECTIVE COMPLETE · PRESS R TO RETURN TO BASE', cx, 66); }
    x.textAlign = 'left';
    try { this.dom(game, dt); } catch (e) { console.error('hud', e); }
    try { this.cockpitLive(game); } catch (e) { console.error('cockpit', e); }
  },
  cockpitLive(game){
    if ($('cockpit').hidden) return;
    this.ckN = (this.ckN || 0) + 1; if (this.ckN % 2) return;
    const P = game.player, m = P.mode, ck = this.ck || (this.ck = {});
    const q = id => (id in ck) ? ck[id] : (ck[id] = document.getElementById(id));
    const t = (id, v) => { const e = q(id); if (e && e.textContent !== v) e.textContent = v; };
    const at = (id, k, v) => { const e = q(id); if (e) e.setAttribute(k, v); };
    const L = (id, on) => { const e = q(id); if (e) e.classList.toggle('on', !!on); };
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const hdg = Math.round(((-P.yaw*180/Math.PI) % 360 + 360) % 360), hs = Math.hypot(P.vel.x, P.vel.z), hull = P.hp/P.maxHp;
    const spd = Math.round((m === 'jet' ? P.speed : hs)*3.6), agl = Math.max(0, Math.round(P.agl)), sp = !!(P.g && P.g.world && P.g.world.space);
    const tg = P.target && P.target.alive ? P.target : null;
    const needle = (id, frac, cx, cy) => at(id, 'transform', `rotate(${(-135 + 270*cl(frac, 0, 1)).toFixed(1)} ${cx} ${cy})`);
    if (m === 'jet') {
      at('jAdi', 'transform', `rotate(${(-P.roll*180/Math.PI).toFixed(1)} 800 772) translate(0 ${(P.pitch*180/Math.PI*2.6).toFixed(1)})`);
      t('jSpd', String(spd)); t('jAlt', sp ? '---' : String(Math.round(P.pos.y))); t('jAgl', sp ? '---' : String(agl)); t('jHdg', String(hdg).padStart(3, '0'));
      const th = cl(P.throttle, 0, 1); at('jThr', 'y', (860 - 120*th).toFixed(1)); at('jThr', 'height', (120*th).toFixed(1));
      at('jThrLever', 'transform', `translate(0 ${(-th*80).toFixed(1)})`);
      needle('jVsiN', 0.5 + P.vel.y/100, 655, 812); t('jVsiT', String(Math.round(P.vel.y)));
      const gl = 1 + Math.abs(P.roll)*1.6 + (P.boost ? 0.6 : 0); needle('jGN', gl/9, 945, 812); t('jGT', gl.toFixed(1));
      t('jGun', P.bombs ? `${P.bombs}/${P.maxBombs}` : 'OUT'); t('jMis', P.mis ? `${P.mis}/${P.maxMis}` : 'OUT'); t('jFlr', P.flares ? String(P.flares) : 'OUT');
      for (const [id, n, m] of [['jGun', P.bombs, P.maxBombs], ['jMis', P.mis, P.maxMis], ['jFlr', P.flares, P.st.flares]]) { const el = $(id), c = n === 0 ? '#ff5a48' : n/m <= 0.25 ? '#ffb238' : ''; if (el.style.fill !== c) el.style.fill = c; } t('jEcm', P.jamOwned ? (P.jam ? 'ON' : 'OFF') : 'N/F');
      at('jHullBar', 'width', (200*cl(hull, 0, 1)).toFixed(1));
      L('jL_cau', hull < 0.35 || P.gpws || P.incoming); L('jL_msl', P.incoming > 0); L('jL_lock', P.lockedBy > 0); L('jL_gpws', P.gpws > 0);
      L('jL_arm', P.lockedList.length > 0); L('jL_ecm', P.jam);
    } else if (m === 'hover') {
      needle('hSpdN', spd/300, 225, 772); t('hSpdT', String(spd));
      needle('hAltN', sp ? 0 : agl/300, 365, 806); t('hAltT', sp ? '---' : String(agl));
      needle('hVsiN', 0.5 + P.vel.y/60, 1235, 806); t('hVsiT', String(Math.round(P.vel.y)));
      at('hHdgCard', 'transform', `rotate(${-hdg} 1375 772)`); t('hHdgT', String(hdg).padStart(3, '0'));
      at('hColl', 'transform', `translate(0 ${(-cl(P.vel.y/30, -1, 1)*40).toFixed(1)})`);
      t('hMis', String(P.mis)); t('hLas', P.cd.las > 0 ? 'CYC' : 'RDY'); t('hHullCk', String(Math.round(hull*100))); L('hL_hull', hull < 0.35);
      L('hL_lock', P.lockedBy > 0); L('hL_msl', P.incoming > 0); L('hL_gpws', P.gpws > 0); L('hL_ecm', P.jam); L('hL_low', P.agl < 15);
    } else {
      t('mHdg', String(hdg).padStart(3, '0') + '°'); t('mStance', P.onGround ? (hs > 2 ? 'WALKING' : 'GROUNDED') : 'AIRBORNE');
      t('mTgt', tg ? `${Math.round(tg.pos.distanceTo(P.pos))} M` : '-');
      t('mHull', Math.round(hull*100) + '%'); at('mBody', 'style', `fill:${hull > 0.6 ? '#6dff9a' : hull > 0.3 ? '#ffb238' : '#ff5a48'}`);
      const fu = cl(P.fuel/P.st.fuel, 0, 1); at('mFuelBar', 'y', (702 + 140*(1 - fu)).toFixed(1)); at('mFuelBar', 'height', (140*fu).toFixed(1)); t('mFuel', String(Math.round(P.fuel)));
      t('mPod', P.w.pod.name.split(' ')[0]); t('mMel', P.cd.mel > 0 ? 'SWING' : 'READY'); t('mShd', P.block > 0.5 ? 'UP' : 'DOWN'); t('mFlr', String(P.flares));
      t('mTgtN', tg ? tg.name.toUpperCase() : 'NO TARGET'); t('mTgtD', tg ? `${Math.round(tg.pos.distanceTo(P.pos))} m` : '-');
      at('mTgtBar', 'width', tg ? (168*cl(tg.hp/tg.maxHp, 0, 1)).toFixed(1) : '0');
      t('mVs', String(Math.round(P.vel.y))); t('mAgl', sp ? '---' : String(agl));
      L('mL_msl', P.incoming > 0); L('mL_lock', P.lockedBy > 0); L('mL_gpws', P.gpws > 0); L('mL_shd', P.block > 0.5); L('mL_ecm', P.jam);
    }
  },
  /* Bomb pipper: where a bomb released now would land */
  ccip(x, game, P, cam){
    const W = game.world, p = CP.copy(P.pos), v = CV.copy(P.vel); v.y -= 4; let t = 0, hit = false;
    for (; t < 25; t += 0.05) { v.y -= G.BOMB_G*0.05; p.addScaledVector(v, 0.05); if (p.y <= Math.max(W.height(p.x, p.z), 0.4)) { hit = true; break; } }
    if (!hit) return;
    const s = this.proj(p, cam); if (!s.on) return;
    const w = P.w.bomb, dist = p.distanceTo(cam.position), rpx = Math.max(6, (w.cluster ? 45 : w.radius)/dist/Math.tan(cam.fov*Math.PI/360)*innerHeight/2);
    let onT = false; for (const e of game.ents) if (e.alive && e.team === 'enemy' && e.cls !== 'air' && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < (w.cluster ? 45 : w.radius)) { onT = true; break; }
    x.save(); x.strokeStyle = x.fillStyle = onT ? '#6dff9a' : '#ffffff'; x.lineWidth = 1.5; x.globalAlpha = 0.9;
    x.setLineDash([5, 5]); x.beginPath(); x.arc(s.x, s.y, rpx, 0, 7); x.stroke(); x.setLineDash([]);
    x.beginPath(); x.moveTo(s.x - 9, s.y); x.lineTo(s.x + 9, s.y); x.moveTo(s.x, s.y - 9); x.lineTo(s.x, s.y + 9); x.stroke();
    x.font = '600 12px "Share Tech Mono", ui-monospace, monospace'; x.textAlign = 'center';
    x.fillText(`BOMB ${t.toFixed(1)}s${onT ? ' · RELEASE' : ''}`, s.x, s.y + rpx + 16); x.textAlign = 'left'; x.restore();
  },
  /* Gun lead: where to aim so rounds and target meet */
  leadPoint(P, e, out){
    const jet = P.mode === 'jet', s = jet ? P.w.gun.speed + P.speed : P.w.pod.speed;
    const M = jet ? P.pos : P.F.world('gunpod', 0, 0.05, 3.9, LM);
    LD.copy(e.pos); LD.y += e.cy; LD.sub(M);
    const V = e.vel, a = V.dot(V) - s*s, b = 2*LD.dot(V), c = LD.dot(LD);
    let t;
    if (Math.abs(a) < 1e-6) t = -c/b; else { const disc = b*b - 4*a*c; if (disc < 0) return null; const r = Math.sqrt(disc), t1 = (-b - r)/(2*a), t2 = (-b + r)/(2*a); t = Math.min(t1 > 0 ? t1 : 1e9, t2 > 0 ? t2 : 1e9); }
    if (!(t > 0) || t > 2.0) return null;
    out.copy(e.pos); out.y += e.cy; out.addScaledVector(V, t); out.t = t; return out;
  },
  leads(x, game, P, cam){
    const I = G.input, jet = P.mode === 'jet', W = innerWidth, Hh = innerHeight;
    const range = Math.min(1700, (jet ? P.w.gun.speed + P.speed : P.w.pod.speed)*2.0);
    const list = [];
    if (P.target && P.target.alive) list.push(P.target);
    for (const e of game.ents) if (e.alive && e.team === 'enemy' && e.cls === 'air' && e !== P.target && e.pos.distanceTo(P.pos) < 1100) list.push(e);
    const mx = (I.mx + 1)/2*W, my = (1 - I.my)/2*Hh;
    for (const e of list.slice(0, 4)) {
      const dist = e.pos.distanceTo(P.pos); if (dist > range) continue;
      const lp = this.leadPoint(P, e, LP); if (!lp) continue;
      const s = this.proj(lp, cam); if (!s.on) continue;
      pv2.copy(e.pos); pv2.y += e.cy; const ts = this.proj(pv2, cam);
      const main = e === P.target, rad = main ? 11 : 7;
      let onTarget;
      if (jet) { const f = P.fwd(LF); LG.subVectors(lp, P.pos); onTarget = f.angleTo(LG) < Math.max(0.012, (e.r + 2)/Math.max(dist, 1)); }
      else { const px = (e.r + 2)/Math.max(dist, 1)/Math.tan(cam.fov*Math.PI/360)*Hh/2; onTarget = Math.hypot(mx - s.x, my - s.y) < Math.max(10, px); }
      const c = onTarget ? '#6dff9a' : (main ? '#ffffff' : 'rgba(255,255,255,0.7)');
      x.save(); x.strokeStyle = c; x.fillStyle = c; x.lineWidth = main ? 2 : 1.5;
      if (ts.on && Math.hypot(ts.x - s.x, ts.y - s.y) > rad + 4) { x.setLineDash([4, 5]); x.globalAlpha = 0.6; x.beginPath(); x.moveTo(ts.x, ts.y); x.lineTo(s.x, s.y); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; }
      x.beginPath(); x.arc(s.x, s.y, rad, 0, 7); x.stroke();
      x.beginPath(); x.arc(s.x, s.y, 2.2, 0, 7); x.fill();
      if (main) {
        for (const a of [0, Math.PI/2, Math.PI, Math.PI*1.5]) { x.beginPath(); x.moveTo(s.x + Math.cos(a)*(rad + 3), s.y + Math.sin(a)*(rad + 3)); x.lineTo(s.x + Math.cos(a)*(rad + 8), s.y + Math.sin(a)*(rad + 8)); x.stroke(); }
        x.font = '600 12px "Share Tech Mono", ui-monospace, monospace'; x.textAlign = 'center';
        x.fillText(onTarget ? 'FIRE' : 'LEAD', s.x, s.y + rad + 20); x.textAlign = 'left';
      }
      if (onTarget && main) { x.globalAlpha = 0.25; x.beginPath(); x.arc(s.x, s.y, rad, 0, 7); x.fill(); x.globalAlpha = 1; }
      x.restore();
    }
  },
  /* Stores readout beside the reticle: count + one pip per round (grouped when the rack is big). Amber at 25%, blinking red when empty. */
  stores(x, P, cx, cy, col){
    const w = P.w, rows = [], blink = (performance.now() % 600) < 400;
    rows.push({lbl:'HULL', hull:Math.max(0, P.hp/P.maxHp)});
    const cnt = (lbl, n, max, shape) => rows.push({lbl, n, max, shape});
    const txt = (lbl, t, f) => rows.push({lbl, t, f});
    const sa = P.msl === 'air' ? '▸' : ' ', sg = P.msl === 'gnd' ? '▸' : ' ';
    if (P.mode === 'jet') { txt('GUN', '∞'); cnt(sa + 'A-A', P.mis, P.maxMis, 'bar'); cnt(sg + 'A-G', P.bombs, P.maxBombs, 'bomb'); }
    else if (P.mode === 'hover') { txt('POD', '∞'); cnt(sa + 'A-A', P.mis, P.maxMis, 'bar'); cnt(sg + 'A-G', P.bombs, P.maxBombs, 'bomb'); txt('LSR', P.cd.las > 0 ? '' : 'READY', 1 - Math.max(0, P.cd.las/w.laser.cd)); }
    else { txt('POD', P.wpnWant ? 'STOWED' : P.wpn > 0.02 ? 'DRAW' : '∞'); cnt(sa + 'A-A', P.mis, P.maxMis, 'bar'); cnt(sg + 'A-G', P.bombs, P.maxBombs, 'bomb'); txt('BLD', !P.wpnWant ? 'STOWED' : P.wpn < 1 ? 'DRAW' : P.cd.mel > 0 ? '' : 'READY', 1 - Math.max(0, P.cd.mel/0.9)); }
    cnt('FLR', P.flares, P.st.flares, 'dot');
    const x0 = cx - 340, px0 = x0 + 74, pw = cx - 182 - px0, cy0 = cy - 21;
    x.save(); x.font = '13px "Share Tech Mono", ui-monospace, monospace'; x.textAlign = 'left'; x.shadowColor = 'rgba(0,0,0,0.85)'; x.shadowBlur = 4;
    rows.forEach((r, i) => {
      const y = cy0 + 44 + i*21;
      if (r.hull !== undefined) {
        const f = r.hull, c = f < 0.25 ? (blink ? RED : 'rgba(255,90,72,0.5)') : f < 0.5 ? AMB : col;
        x.fillStyle = c; x.strokeStyle = c; x.globalAlpha = 0.7; x.fillText(r.lbl, x0, y); x.globalAlpha = 1;
        x.font = '600 15px "Share Tech Mono", ui-monospace, monospace'; x.fillText(String(Math.round(f*100)).padStart(3, ' ') + '%', x0 + 34, y + 1); x.font = '13px "Share Tech Mono", ui-monospace, monospace';
        x.globalAlpha = 0.3; x.fillRect(px0 + 14, y - 10, pw - 14, 8); x.globalAlpha = 1; x.fillRect(px0 + 14, y - 10, (pw - 14)*f, 8);
        return;
      }
      let c = col;
      if (r.max !== undefined) { const f = r.max ? r.n/r.max : 0; if (r.n === 0) c = blink ? RED : 'rgba(255,90,72,0.35)'; else if (f <= 0.25) c = AMB; }
      x.fillStyle = c; x.strokeStyle = c; x.globalAlpha = 0.7; x.fillText(r.lbl, x0, y); x.globalAlpha = 1;
      if (r.max === undefined) {
        if (r.t) x.fillText(r.t, x0 + 34, y);
        else { x.globalAlpha = 0.35; x.fillRect(x0 + 34, y - 6, pw + 40, 3); x.globalAlpha = 1; x.fillRect(x0 + 34, y - 6, (pw + 40)*r.f, 3); }
        return;
      }
      x.font = '600 15px "Share Tech Mono", ui-monospace, monospace'; x.fillText(r.n === 0 ? 'OUT' : String(r.n).padStart(2, ' '), x0 + 34, y + 1); x.font = '13px "Share Tech Mono", ui-monospace, monospace';
      const per = r.shape === 'bomb' ? 11 : 6, grp = Math.max(1, Math.ceil(r.max/Math.floor(pw/per))), np = Math.ceil(r.max/grp), have = Math.ceil(r.n/grp);
      for (let k = 0; k < np; k++) {
        const on = k < have, px = px0 + k*per;
        x.globalAlpha = on ? 1 : 0.28;
        if (r.shape === 'bomb') { x.beginPath(); x.ellipse(px + 4, y - 5, 3.2, 4.6, 0, 0, 7); on ? x.fill() : x.stroke(); x.fillRect(px + 2.5, y - 12, 3, 2); }
        else if (r.shape === 'dot') { x.beginPath(); x.arc(px + 2, y - 5, 2, 0, 7); on ? x.fill() : x.stroke(); }
        else on ? x.fillRect(px, y - 11, 4, 11) : x.strokeRect(px + 0.5, y - 10.5, 3, 10);
      }
      x.globalAlpha = 1;
    });
    x.restore();
  },
  ralt(x, P, cx, cy, Hh, W, col){
    const tx = Math.min(cx + 340, W - 70), top = cy - 110, h = 220, max = 300, agl = Math.max(0, P.agl);
    const danger = P.mode === 'jet' ? 60 : 15, ymap = v => top + h - Math.min(v, max)/max*h;
    x.save(); x.lineWidth = 1.5; x.strokeStyle = col; x.fillStyle = col; x.globalAlpha = 0.85;
    x.beginPath(); x.moveTo(tx, top); x.lineTo(tx, top + h); x.stroke();
    x.fillStyle = 'rgba(255,90,72,0.35)'; x.fillRect(tx - 6, ymap(danger), 6, top + h - ymap(danger));
    x.fillStyle = col; x.font = '12px "Share Tech Mono", ui-monospace, monospace'; x.textAlign = 'left';
    for (let v = 0; v <= max; v += 50) { const y = ymap(v); x.beginPath(); x.moveTo(tx, y); x.lineTo(tx + (v % 100 ? 6 : 11), y); x.stroke(); if (v % 100 === 0) x.fillText(String(v), tx + 14, y + 4); }
    const y = ymap(agl), low = agl < danger && !(P.mode === 'mech' && P.onGround);
    x.globalAlpha = 1; x.fillStyle = low ? RED : col;
    x.beginPath(); x.moveTo(tx - 2, y); x.lineTo(tx - 14, y - 7); x.lineTo(tx - 14, y + 7); x.closePath(); x.fill();
    x.textAlign = 'right'; x.font = '600 15px "Share Tech Mono", ui-monospace, monospace';
    x.fillText((agl > max ? '>' : '') + Math.round(Math.min(agl, 9999)) + ' R', tx - 18, y + 5);
    x.textAlign = 'center'; x.font = '11px "Share Tech Mono", ui-monospace, monospace'; x.fillStyle = col; x.fillText('RALT', tx, top - 10);
    x.restore();
  },
  radar(game, dt){
    const I = G.input;
    if (I.pressed.has('KeyN')) { this.ri = (this.ri + 1) % RANGES.length; G.audio.ui(); }
    const x = this.rc, P = game.player, S = 400, c = S/2, Rp = c - 22, R = RANGES[this.ri]*1000, sc = Rp/R;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), col = COL[P.mode], detect = P.st.radar*2;
    this.sweep = ((this.sweep || 0) + dt*2.4) % (Math.PI*2);
    x.clearRect(0, 0, S, S);
    x.fillStyle = 'rgba(4,12,10,0.8)'; x.beginPath(); x.arc(c, c, c - 2, 0, 7); x.fill();
    x.strokeStyle = col; x.lineWidth = 2;
    x.globalAlpha = 0.9; x.beginPath(); x.arc(c, c, Rp, 0, 7); x.stroke();
    x.globalAlpha = 0.28; for (const k of [0.25, 0.5, 0.75]) { x.beginPath(); x.arc(c, c, Rp*k, 0, 7); x.stroke(); }
    x.beginPath(); x.moveTo(c, c - Rp); x.lineTo(c, c + Rp); x.moveTo(c - Rp, c); x.lineTo(c + Rp, c); x.stroke();
    // sweep
    x.save(); x.translate(c, c); x.rotate(this.sweep - Math.PI/2);
    for (let i = 0; i < 14; i++) { x.globalAlpha = 0.22*(1 - i/14); x.fillStyle = col; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, Rp, -i*0.045 - 0.045, -i*0.045); x.closePath(); x.fill(); }
    x.restore(); x.globalAlpha = 1;
    // cardinal letters on the rim
    x.font = '600 22px "Share Tech Mono", ui-monospace, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [lbl, wx, wz] of [['N', 0, 1], ['E', -1, 0], ['S', 0, -1], ['W', 1, 0]]) {
      const rx = -wx*fz + wz*fx, ry = -(wx*fx + wz*fz);
      x.fillStyle = lbl === 'N' ? AMB : col; x.fillText(lbl, c + rx*(Rp + 12), c + ry*(Rp + 12));
    }
    const to = (wx, wz) => { const dx = wx - P.pos.x, dz = wz - P.pos.z; return [(-dx*fz + dz*fx)*sc, -(dx*fx + dz*fz)*sc]; };
    const place = (wx, wz) => { let [px, py] = to(wx, wz); const d = Math.hypot(px, py), out = d > Rp - 6; if (out) { px *= (Rp - 6)/d; py *= (Rp - 6)/d; } return [c + px, c + py, out]; };
    const swept = (px, py) => { let a = Math.atan2(py - c, px - c) + Math.PI/2; a = ((this.sweep - a) % (Math.PI*2) + Math.PI*2) % (Math.PI*2); return 0.55 + 0.45*Math.max(0, 1 - a/2.2); };
    const glyph = (px, py, kind, color, sz, out, alpha) => {
      x.globalAlpha = out ? 0.75 : alpha; x.fillStyle = color; x.strokeStyle = color; x.lineWidth = 3; x.beginPath();
      if (out) { const a = Math.atan2(py - c, px - c); x.moveTo(px + Math.cos(a)*8, py + Math.sin(a)*8); x.lineTo(px + Math.cos(a + 2.4)*8, py + Math.sin(a + 2.4)*8); x.lineTo(px + Math.cos(a - 2.4)*8, py + Math.sin(a - 2.4)*8); x.closePath(); x.fill(); }
      else if (kind === 'air') { x.moveTo(px, py - sz); x.lineTo(px + sz, py + sz*0.8); x.lineTo(px - sz, py + sz*0.8); x.closePath(); x.fill(); }
      else if (kind === 'mech') { x.moveTo(px, py - sz); x.lineTo(px + sz, py); x.lineTo(px, py + sz); x.lineTo(px - sz, py); x.closePath(); x.fill(); }
      else if (kind === 'ring') { x.arc(px, py, sz, 0, 7); x.stroke(); }
      else if (kind === 'x') { x.moveTo(px - sz, py - sz); x.lineTo(px + sz, py + sz); x.moveTo(px + sz, py - sz); x.lineTo(px - sz, py + sz); x.stroke(); }
      else if (kind === 'dot') { x.arc(px, py, sz, 0, 7); x.fill(); }
      else x.fillRect(px - sz*0.8, py - sz*0.8, sz*1.6, sz*1.6);
      x.globalAlpha = 1;
    };
    x.save(); x.beginPath(); x.arc(c, c, Rp + 4, 0, 7); x.clip();
    const ao = to(0, 0); x.strokeStyle = 'rgba(255,178,56,0.55)'; x.lineWidth = 2; x.setLineDash([10, 8]); x.beginPath(); x.arc(c + ao[0], c + ao[1], 7000*sc, 0, 7); x.stroke(); x.setLineDash([]);
    for (const e of game.ents) if (e.alive && e.team === 'neutral') { const [px, py, out] = place(e.pos.x, e.pos.z); if (!out) glyph(px, py, 'sq', 'rgba(200,200,190,0.4)', 3, false, 1); }
    if (!game.complete && ['base', 'city', 'mech', 'sam', 'convoy', 'air'].includes(game.m.type)) { const [px, py, out] = place(game.center.x, game.center.z); glyph(px, py, 'ring', AMB, 12, out, 0.9); }
    for (const g of game.civGroups) if (!g.done) { const [px, py, out] = place(g.pos.x, g.pos.z); glyph(px, py, 'mech', '#6dff9a', 9, out, 1); }
    for (const w of game.waypoints) if (!w.done) { const [px, py, out] = place(w.pos.x, w.pos.z); glyph(px, py, 'mech', AMB, 9, out, 1); }
    if (game.ping) { const [px, py, out] = place(game.ping.pos.x, game.ping.pos.z); glyph(px, py, 'x', '#6dff9a', 8, out, 1); }
    for (const k of game.pickups || []) { const [px, py, out] = place(k.pos.x, k.pos.z); if (!out) { glyph(px, py, 'ring', '#4dff8a', 7, false, 1); glyph(px, py, 'dot', '#4dff8a', 3, false, 1); } }   // repair canisters
    for (const mk of game.marks || []) { const [px, py, out] = place(mk.pos.x, mk.pos.z); glyph(px, py, 'mech', mk.color, 9, out, 1); }
    for (const e of game.ents) {
      if (!e.alive || e.team !== 'enemy') continue;
      if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > detect && e.tag !== 'obj') continue;
      const [px, py, out] = place(e.pos.x, e.pos.z), obj = e.tag === 'obj' || e.tag === 'ace' || e.tag === 'aaside';
      glyph(px, py, e.cls === 'air' ? 'air' : e.cls === 'mech' ? 'mech' : 'sq', obj ? AMB : RED, e.cls === 'air' ? 9 : 6, out, swept(px, py));
      if (!out && e.cls === 'air') { const dh = e.pos.y - P.pos.y; if (Math.abs(dh) > 120) { x.fillStyle = RED; x.font = '600 18px "Share Tech Mono", monospace'; x.fillText(dh > 0 ? '+' : '−', px + 14, py); } }
      if (!out && e === P.target) { x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.strokeRect(px - 12, py - 12, 24, 24); }
    }
    for (const m of game.missiles) if (m.team === 'enemy' && m.target === P && (performance.now() % 300) < 180) { const [px, py, out] = place(m.pos.x, m.pos.z); glyph(px, py, 'dot', RED, 5, out, 1); }
    if (game.wing.alive) { const [px, py, out] = place(game.wing.pos.x, game.wing.pos.z); glyph(px, py, 'air', '#72e4ff', 8, out, 1); }
    x.restore();
    x.fillStyle = col; x.beginPath(); x.moveTo(c, c - 12); x.lineTo(c + 8, c + 9); x.lineTo(c, c + 4); x.lineTo(c - 8, c + 9); x.closePath(); x.fill();
    x.font = '600 20px "Share Tech Mono", ui-monospace, monospace'; x.fillStyle = col; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    let near = null, nd = 1e9;
    for (const e of game.ents) if (e.alive && e.team === 'enemy') { const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d < nd) { nd = d; near = e; } }
    if (near) { x.textAlign = 'center'; x.fillStyle = RED; x.font = '600 18px "Share Tech Mono", ui-monospace, monospace'; x.fillText(`HOSTILE ${nd > 999 ? (nd/1000).toFixed(1) + ' KM' : Math.round(nd) + ' M'}`, c, c + Rp*0.62); x.font = '600 20px "Share Tech Mono", ui-monospace, monospace'; x.fillStyle = col; x.textAlign = 'left'; }
    x.fillText(`${RANGES[this.ri]} KM`, 10, S - 8); x.textAlign = 'right'; x.fillText('N RANGE', S - 10, S - 8); x.textAlign = 'center';
    x.fillText(String(Math.round(((-P.yaw*180/Math.PI) % 360 + 360) % 360)).padStart(3, '0') + '°', c, 18);
    x.textAlign = 'left';
  },
  dom(game, dt){
    const P = game.player, pct = v => Math.round(Math.max(0, Math.min(1, v))*100) + '%';
    $('hProg').textContent = `${Math.min(game.objDone, game.objTotal)} / ${game.objTotal}`;
    if (game.ops) {
      const O = game.ops, wl = $('hWps');
      const cur = O.tasks[O.cur];
      const goal = O.rtb ? (game.world.space ? 'Objectives complete · burning for home' : 'Return to the Bastion and set down on the deck') : cur ? G.taskText(cur) : '';
      if ($('hGoal').textContent !== goal) $('hGoal').textContent = goal;
      O.tasks.forEach(T => { const li = wl.children[T.i]; if (!li) return; li.dataset.st = T.done ? 'ok' : T === cur ? 'cur' : 'todo';
        const [d, n] = O.progress(T); const pt = T.done ? 'done' : T.kind === 'patrol' ? (T.arrived ? (T.hostiles ? `${d}/${n}` : 'clear') : '') : `${d}/${n}`;
        const b = li.querySelector('.wp'); if (b.textContent !== pt) b.textContent = pt; });
      const r = wl.children[O.tasks.length]; if (r) { r.dataset.st = O.rtb ? 'cur' : 'todo'; const b = r.querySelector('.wp'), dist = O.rtb ? (Math.hypot(game.player.pos.x - G.CARRIER.x, game.player.pos.z - G.CARRIER.z)/1000).toFixed(1) + ' km' : ''; if (b.textContent !== dist) b.textContent = dist; }
    }
    $('hTime').textContent = `${Math.floor(game.time/60)}:${String(Math.floor(game.time % 60)).padStart(2, '0')}`;
    game.m.sides.forEach((s, i) => { const li = $('hSides').children[i]; if (li) li.dataset.st = game.sideStatus(s); });
    $('hHull').style.width = pct(P.hp/P.maxHp); $('hHullN').textContent = pct(P.hp/P.maxHp);
    $('hHull').parentNode.classList.toggle('crit', P.hp/P.maxHp < 0.25);
    const fv = P.mode === 'jet' ? P.throttle : P.mode === 'hover' ? Math.min(1, Math.max(0, 0.5 + P.vel.y/60)) : P.fuel/P.st.fuel;
    $('hFuel').style.width = pct(fv); $('hFuelN').textContent = pct(fv);
    $('hSpd').textContent = Math.round((P.mode === 'jet' ? P.speed : Math.hypot(P.vel.x, P.vel.z))*3.6) + ' km/h';
    $('hAlt').textContent = Math.round(P.pos.y) + ' m'; $('hAgl').textContent = Math.max(0, Math.round(P.agl)) + ' m';
    const w = P.w, md = P.mode, rows = [];
    const meter = (n, max) => { const grp = Math.max(1, Math.ceil(max/24)), np = Math.ceil(max/grp), have = Math.ceil(n/grp); let h = '<i class="am">'; for (let k = 0; k < np; k++) h += k < have ? '<i class="on"></i>' : '<i></i>'; return h + '</i>'; };
    const lvl = (n, max) => n === 0 ? 'out' : n/max <= 0.25 ? 'low' : '';
    rows.push(['LMB', md === 'jet' ? w.gun.name : w.pod.name, md === 'mech' && P.wpn > 0.02 ? (P.wpnWant ? 'STOWED · Q SWAPS' : 'DRAWING') : '∞ UNLIMITED', '', md === 'mech' && P.wpnWant ? 'off' : '']);
    const aAir = P.msl === 'air', aGnd = P.msl === 'gnd', fk = md === 'mech' ? 'E' : 'RMB';
    rows.push([aAir ? fk : 'H', w.missile.name, P.mis ? `${P.mis} / ${P.maxMis}` : `OUT · 0 / ${P.maxMis}`, meter(P.mis, P.maxMis), lvl(P.mis, P.maxMis) + (aAir ? '' : ' off')]);
    rows.push([aGnd ? fk : 'H', w.bomb.name, P.bombs ? `${P.bombs} / ${P.maxBombs}` : `OUT · 0 / ${P.maxBombs}`, meter(P.bombs, P.maxBombs), lvl(P.bombs, P.maxBombs) + (aGnd ? '' : ' off')]);
    if (md === 'hover') rows.push(['E', w.laser.name, P.cd.las > 0 ? 'CYCLING' : 'READY', '', '']);
    if (md === 'mech') { rows.push([P.wpnWant ? 'LMB' : 'Q', w.melee.name, P.wpn < 1 ? (P.wpnWant ? 'DRAWING' : 'STOWED · Q SWAPS') : P.cd.mel > 0 ? 'SWINGING' : 'READY', '', P.wpnWant ? '' : 'off']); rows.push(['RMB', w.shield.name, P.block > 0.5 ? 'UP' : 'HOLD', '', '']); }
    rows.push(['F', 'Flares', P.flares ? `${P.flares} / ${P.st.flares}` : `OUT · 0 / ${P.st.flares}`, meter(P.flares, P.st.flares), lvl(P.flares, P.st.flares)]);
    rows.push(['J', 'ECM jammer', P.jamOwned ? (P.jam ? 'ON' : 'OFF') : 'NOT FITTED', '', '']);
    const html = rows.map(r => `<div class="ar ${r[4]}"><kbd${r[5] ? ` title="${r[5]}"` : ''}>${r[5] ? (r[5] === 'JET ONLY' ? 'JET' : 'J/G') : r[0]}</kbd><span>${r[1]}</span><b>${r[2]}</b>${r[3]}</div>`).join('');
    if (html !== this.armsHtml) { $('hArms').innerHTML = html; this.armsHtml = html; }
    const Wg = game.wing;
    $('hWingOrder').textContent = Wg.alive ? {follow:'Formation', cover:'Covering you', attack:'Attacking target', move:'Moving to mark'}[Wg.orderName] : 'Ejected';
    $('hWingHp').style.width = pct(Wg.alive ? Wg.hp/Wg.maxHp : 0);
    for (const r of this.radioList) { r.t -= dt; r.el.style.opacity = Math.max(0.15, Math.min(1, r.t/2)); }
    for (let i = this.feedList.length - 1; i >= 0; i--) { const f = this.feedList[i]; f.t -= dt; f.el.style.opacity = Math.max(0, Math.min(1, f.t)); if (f.t <= 0) { f.el.remove(); this.feedList.splice(i, 1); } }
    this.hurtT = Math.max(0, this.hurtT - dt*1.2); $('hHurt').style.opacity = this.hurtT.toFixed(3);
  }
};
})();
