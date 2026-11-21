(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3;

G.trainingMission = () => {
  const first = !G.save.trained;
  return {id:'training', type:'training', tier:1, n:15, place:'Kestrel Range', city:'', reward:first ? 1500 : 0, xp:first ? 400 : 0, sides:[],
    seed:4242, title:'Flight Training', tag:'Training', goal:'Complete each training step',
    brief:'Run through every control and learn where Jet, Hover and Mech each excel. Drones are unarmed and your hull cannot drop below 20%.' +
      (first ? ' First completion pays $1,500 and 400 XP.' : ' Replays pay nothing but sharpen your hands.')};
};

const GREEN = '#6dff9a', AMB = '#ffb238';

G.Training = class {
  constructor(game){
    this.g = game; this.i = -1; this.t = 0; this.wait = 0; this.spawned = []; this.meshes = []; this.s = {};
    this.steps = STEPS;
  }
  get P(){ return this.g.player; }
  /* helpers */
  ahead(dist, side = 0){
    const P = this.P, dc = Math.hypot(P.pos.x, P.pos.z);
    // Keep drills inside the range: past 700 m from the middle, place them toward the middle instead of straight ahead.
    const f = dc > 700 ? new V3(-P.pos.x/dc, 0, -P.pos.z/dc) : new V3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), r = new V3(-f.z, 0, f.x);
    const p = P.pos.clone().addScaledVector(f, dist).addScaledVector(r, side); p.y = Math.max(this.g.world.height(p.x, p.z), 0.5); return p;
  }
  drone(type, pos, o = {}){
    const e = G.spawn(this.g, type, pos.x, pos.z, {alt:o.alt, tag:'obj'});
    e.noFire = o.fire ? false : true; e.slow = true; e.frozen = !!o.frozen; e.name = o.name || ('Training ' + e.def.name.toLowerCase());
    if (o.dmgMul !== undefined) e.dmgMul = o.dmgMul;
    if (type === 'fighter') { e.dir = new V3(Math.sin(this.P.yaw), 0, Math.cos(this.P.yaw)); e.breakT = 4; e.breakDir = e.dir.clone(); }
    this.spawned.push(e); return e;
  }
  alive(){ return this.spawned.filter(e => e.alive).length; }
  ring(pos, next){
    const m = new THREE.Mesh(new THREE.TorusGeometry(42, 2.6, 8, 48), new THREE.MeshBasicMaterial({color:0xffb238, transparent:true, opacity:0.9}));
    m.position.copy(pos); m.lookAt(next || pos.clone().add(new V3(0, 0, 1))); this.g.scene.add(m); this.meshes.push(m);
    const mk = {pos:pos.clone(), label:'RING', color:AMB}; this.g.marks.push(mk); return {m, mk, pos:pos.clone(), done:false};
  }
  pad(pos, label = 'PAD'){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(36, 36, 0.6, 40), new THREE.MeshBasicMaterial({color:0x6dff9a, transparent:true, opacity:0.35}));
    m.position.set(pos.x, pos.y + 0.6, pos.z); this.g.scene.add(m); this.meshes.push(m);
    const mk = {pos:pos.clone().setY(pos.y + 4), label, color:GREEN}; this.g.marks.push(mk); return mk;
  }
  clear(){
    for (const e of this.spawned) if (e.alive) { e.alive = false; this.g.scene.remove(e.mesh); }
    this.spawned = [];
    for (const m of this.meshes) this.g.scene.remove(m);
    this.meshes = []; this.g.marks.length = 0; this.homeMk = null;
  }
  next(){
    this.clear(); this.i++; this.t = 0; this.s = {}; this.wait = 0;
    const g = this.g;
    if (this.i >= this.steps.length) return;
    const st = this.steps[this.i];
    g.objDone = this.i; g.objTotal = this.steps.length;
    if (st.setup) st.setup(this, this.s);
    G.hud.train(this.i + 1, this.steps.length, st.title, st.text, st.why);
    if (this.i > 0) G.audio.chime();
    if (st.radio) G.hud.radio('Instructor', st.radio);
  }
  update(dt){
    const P = this.P, dc = Math.hypot(P.pos.x, P.pos.z);
    if (dc > 1900) {
      if (!this.homeMk) { this.homeMk = {pos:new V3(0, Math.max(this.g.world.height(0, 0), 0) + 80, 0), label:'RANGE', color:'#6dff9a'}; this.g.marks.push(this.homeMk); }
      if (this.g.time - (this.homeT || -99) > 15) { this.homeT = this.g.time; G.hud.radio('Instructor', 'You are drifting off the range. Follow the RANGE marker back.'); }
    } else if (this.homeMk && dc < 1200) { const i = this.g.marks.indexOf(this.homeMk); if (i >= 0) this.g.marks.splice(i, 1); this.homeMk = null; }
    if (this.i < 0) { this.next(); return; }
    if (this.i >= this.steps.length || this.finished) return;
    const st = this.steps[this.i];
    this.t += dt;
    if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) this.next(); return; }
    const res = st.check(this, this.s, dt);
    G.hud.trainProg(st.prog ? st.prog(this, this.s) : '');
    if (res) {
      this.g.objDone = this.i + 1;
      G.hud.trainProg('Done');
      G.hud.flash('STEP COMPLETE');
      if (this.i === this.steps.length - 1) { this.finished = true; return; }
      this.wait = 1.6;
    }
  }
};

/* ---------- Lesson plan ---------- */
const STEPS = [
  { title:'Steering and throttle', mode:'jet',
    text:'Move the mouse away from screen center to steer. W and S set throttle, Shift is the afterburner. Fly through the three rings.',
    why:'Jet mode is your fastest way across the map and the only mode that can run down enemy fighters.',
    radio:'Welcome to Kestrel Range. Everything out here is unarmed, so relax and fly.',
    setup(T, s){
      const P = T.P, base = P.pos.clone(), pts = [new V3(0, 0, 650), new V3(260, -40, 1250), new V3(-160, -70, 1850)].map(o => base.clone().add(o));
      for (const p of pts) p.y = Math.max(p.y, T.g.world.height(p.x, p.z) + 160);
      s.rings = pts.map((p, i) => T.ring(p, pts[i + 1] || p.clone().add(new V3(0, 0, 100)))); s.k = 0;
    },
    check(T, s){
      const r = s.rings[s.k]; if (!r) return true;
      if (T.P.pos.distanceTo(r.pos) < 48) { r.m.material.color.setHex(0x6dff9a); r.done = true; const i = T.g.marks.indexOf(r.mk); if (i >= 0) T.g.marks.splice(i, 1); s.k++; G.audio.ping(); }
      return s.k >= s.rings.length;
    },
    prog:(T, s) => `Rings ${s.k} / 3` },
  { title:'Nose guns', mode:'jet',
    text:'Two drones ahead. A lead circle shows where your rounds will meet the drone. Steer until the center cross sits on the circle; it turns green and reads FIRE. Then hold left click.',
    why:'Guns never run dry. Use them to finish damaged targets and save missiles.',
    setup(T){ T.P.mode === 'jet' || T.P.setMode('jet'); for (const s of [-120, 120]) { const p = T.ahead(900, s); T.drone('fighter', p, {alt:T.P.pos.y + 30}); } },
    check:T => T.alive() === 0, prog:T => `Drones left ${T.alive()}` },
  { title:'Missile lock', mode:'jet',
    text:'Keep a drone inside the forward cone until its diamond turns solid red and says LOCK, then right click. Air-to-air missiles (the default) lock aircraft only.',
    why:'Jet missiles are the best answer to aircraft and fast targets. Your racks refill in the hangar.',
    setup(T){ T.P.msl = 'air'; T.P.mis = T.P.maxMis; T.P.F.setMissiles(1); for (const s of [-200, 0, 200]) T.drone('fighter', T.ahead(1100, s), {alt:T.P.pos.y + 60}); },
    check:T => T.alive() === 0, prog:T => `Drones left ${T.alive()}` },
  { title:'Ground missiles', mode:'jet',
    text:'A bunker with armour parked around it. Air-to-air missiles cannot bring a heavy building down. Press H (or middle click) to switch to ground missiles, hold the bunker in your sights until it locks, then right click.',
    why:'Ground missiles level heavy buildings (hangars, command posts, bunkers, tall towers) and wipe out vehicle groups in one blast. Air-to-air missiles only lock aircraft.',
    setup(T){ T.P.bombs = T.P.maxBombs; const c = T.ahead(1300, 0); T.drone('bunker', c, {frozen:true, name:'Training bunker'}); for (const [dx, dz] of [[-18, -10], [16, -12], [0, 18]]) T.drone('tank', c.clone().add(new V3(dx, 0, dz)), {frozen:true}); },
    check(T){ if (T.P.bombs <= 0 && !T.g.bombsLive.length && !T.g.missiles.some(m => m.agm) && T.alive() > 0) { T.P.bombs = 2; G.hud.radio('Instructor', 'Two more ground missiles on the rails. Your guns work on the tanks too.'); } return T.alive() === 0; },
    prog:T => `Targets left ${T.alive()} · ground missiles ${T.P.bombs} · ${T.P.msl === 'gnd' ? 'A-G selected' : 'press H'}` },
  { title:'Flares', mode:'jet',
    text:'A practice missile is coming for you. When MISSILE flashes, press F to drop flares and turn away.',
    why:'Flares work in every mode. The ECM jammer upgrade makes enemy locks slower and their missiles easier to shake.',
    setup(T, s){ T.P.flares = Math.max(T.P.flares, 4); s.launch = () => { const p = T.ahead(1000, 300); p.y += 30; T.g.launchMissile(p, new V3(0, 1, 0), T.P, {team:'enemy', speed:140, max:330, turn:1.9, dmg:40, life:12}); s.m = T.g.missiles[T.g.missiles.length - 1]; s.f0 = T.P.flares; }; s.delay = 1.5; },
    check(T, s, dt){
      if (!s.m) { s.delay -= dt; if (s.delay <= 0) s.launch(); return false; }
      if (T.g.missiles.includes(s.m)) return false;
      if (T.P.flares < s.f0) { G.hud.radio('Instructor', 'Clean break. That is how you beat a lock.'); T.P.flares = T.P.st.flares; return true; }
      G.hud.radio('Instructor', 'It caught you. Drop flares sooner. Here comes another.'); s.m = null; s.delay = 2; return false;
    } },
  { title:'Transform to Hover', mode:'jet',
    text:'Press 2 to switch to Hover. The wings stop flying and you will sink for a moment, so watch the RALT altitude tape on the right.',
    why:'Hover trades speed for control: hold position, aim anywhere with the mouse, and set down anywhere.',
    check(T, s, dt){ s.h = T.P.mode === 'hover' ? (s.h || 0) + dt : 0; return s.h > 2; } },
  { title:'Hover flight', mode:'hover',
    text:'Fly to the green pad with W A S D. Push the mouse to the screen edge to turn. Descend with C and hold below 15 m for 3 seconds.',
    why:'Only Hover and Mech can stop on a spot. That is how you pick up civilians on rescue sorties.',
    setup(T, s){ s.pad = T.ahead(380, 0); s.mk = T.pad(s.pad, 'PAD'); s.h = 0; },
    check(T, s, dt){
      const P = T.P, d = Math.hypot(P.pos.x - s.pad.x, P.pos.z - s.pad.z);
      s.h = d < 40 && P.agl < 15 && P.mode !== 'jet' ? s.h + dt : Math.max(0, s.h - dt); return s.h >= 3;
    },
    prog:(T, s) => `Holding ${Math.min(3, s.h).toFixed(1)} / 3 s` },
  { title:'Aimed gun pod', mode:'hover',
    text:'Three tank hulks ahead. The arm follows your cursor, so put the cursor on the lead circle and left click. You can fire sideways and downward without turning.',
    why:'Hover is the best ground-attack mode: stop out of reach, aim down, and pick targets apart.',
    setup(T){ for (const s of [-60, 0, 60]) T.drone('tank', T.ahead(230, s), {frozen:true}); },
    check:T => T.alive() === 0, prog:T => `Targets left ${T.alive()}` },
  { title:'Hover missiles and laser', mode:'hover',
    text:'Ground missiles are selected for you (H switches). Right click fires at the target locked inside the dashed circle around your cursor. E fires the head laser. Use both.',
    why:'Hover keeps missile access, so you can lock ground targets while holding still.',
    setup(T){ T.P.mis = T.P.maxMis; T.P.F.setMissiles(1); T.P.bombs = Math.max(T.P.bombs, 6); T.P.msl = 'gnd'; T.drone('apc', T.ahead(420, -70), {frozen:true}); T.drone('aa', T.ahead(450, 70), {frozen:true}); T.drone('sam', T.ahead(520, 0), {frozen:true}); },
    check:T => T.alive() === 0, prog:T => `Targets left ${T.alive()}` },
  { title:'Transform to Mech', mode:'hover',
    text:'Get low first, then press 3. Mech mode cannot fly. It walks, runs and jumps.',
    why:'Switching to Mech high up means a long fall. You will practice that later.',
    check(T, s, dt){ const P = T.P; s.h = P.mode === 'mech' && P.onGround ? (s.h || 0) + dt : 0; return s.h > 1; } },
  { title:'Walking and jumping', mode:'mech',
    text:'Walk with W A S D, Shift to run. Double-tap a direction to thruster-dash. Space jumps; hold Space in the air to fire the thrusters. Reach the marker.',
    why:'Mech fits where aircraft cannot: city streets, forests and behind cover.',
    setup(T, s){ s.pad = T.ahead(140, 30); T.pad(s.pad, 'GO'); },
    check(T, s){ return Math.hypot(T.P.pos.x - s.pad.x, T.P.pos.z - s.pad.z) < 30; },
    prog:(T, s) => `${Math.round(Math.hypot(T.P.pos.x - s.pad.x, T.P.pos.z - s.pad.z))} m to go` },
  { title:'Melee strike', mode:'mech',
    text:'Two training walkers ahead. Close in and press Q to swap your gun for the blade, then left click to swing it. Q swaps back to the gun.',
    why:'Mech is the close-quarters mode. Melee hits harder than anything except missiles, and walkers take extra damage from it.',
    setup(T){ T.drone('mech', T.ahead(60, -18), {frozen:true}); T.drone('mech', T.ahead(80, 22), {frozen:true}); },
    check:T => T.alive() === 0, prog:T => `Walkers left ${T.alive()}` },
  { title:'Shield', mode:'mech',
    text:'A practice tank will fire light rounds at you. Face it and hold right click to raise your shield. Block 4 hits, then destroy it.',
    why:'Mech is the tank of the three: 40% less damage, a shield, and anti-air guns and SAMs cannot track you on the ground, though their crews will open up with machine guns if you walk within about 650 m. Missiles chasing you lose lock when you land in Mech.',
    setup(T, s){ T.P.blocks = 0; s.tank = T.drone('tank', T.ahead(170, 0), {fire:true, frozen:true, dmgMul:0.25, name:'Practice tank'}); s.tank.hp = s.tank.maxHp = 1e6; s.tank.cd = 1.5; s.tank.onlyP = true; s.tank.noTerrain = true; },
    check(T, s){
      if (T.P.blocks >= 4 && s.tank.maxHp > 1e5) { s.tank.hp = s.tank.maxHp = 240; s.tank.noFire = true; G.hud.radio('Instructor', 'Good blocking. Now take it out.'); }
      return !s.tank.alive;
    },
    prog:(T, s) => T.P.blocks < 4 ? `Blocked ${T.P.blocks || 0} / 4` : 'Destroy the tank' },
  { title:'Falling transform', mode:'mech',
    text:'Press 1 for Jet and climb above 200 m. Then press 3. Hold Space to fire thrusters and touch down slower than 28 m/s.',
    why:'You can switch modes mid-air, but Mech drops like a rock. The PULL UP warning tells you when to fire thrusters.',
    check(T, s){
      const P = T.P;
      if (!s.high) { if (P.mode === 'jet' && P.agl > 200) { s.high = true; G.hud.radio('Instructor', 'Altitude good. Now press 3.'); } return false; }
      if (!s.drop) { if (P.mode === 'mech' && !P.onGround) { s.drop = true; P.lastImpact = null; } return false; }
      if (P.mode === 'mech' && P.onGround && P.lastImpact != null) {
        if (P.lastImpact < 28) { G.hud.radio('Instructor', `Touchdown at ${Math.round(P.lastImpact)} m/s. Nice and soft.`); return true; }
        G.hud.radio('Instructor', `Too hard: ${Math.round(P.lastImpact)} m/s. Climb back up and try again.`); s.high = s.drop = false; P.lastImpact = null; P.hp = Math.max(P.hp, P.maxHp*0.6);
      }
      return false;
    },
    prog:(T, s) => !s.high ? 'Climb above 200 m in Jet' : !s.drop ? 'Press 3' : 'Hold Space to slow the fall' },
  { title:'Wingman and radar', mode:'any',
    text:'Two targets are on your radar. Press N to change radar range. Aim at a target, press T to designate it, then Z to send your wingman. G pings a spot for them.',
    why:'Your wingman can clear one target while you handle another. X makes them cover you, B brings them back into formation.',
    setup(T){ T.drone('tank', T.ahead(650, -150), {frozen:true}); T.drone('apc', T.ahead(700, 150), {frozen:true}); },
    check:T => T.alive() === 0, prog:T => `Targets left ${T.alive()}` },
  { title:'Training complete', mode:'any',
    text:'Jet: speed, air-to-air and fast strikes. Hover: precise ground attack, missiles while holding still, rescues. Mech: close combat, shield, walkers and cities. Press R to return to base.',
    why:'Mix modes in a single fight. Approach in Jet, attack in Hover, finish in Mech.',
    setup(T){ T.g.complete = true; },
    check:() => true }
];
})();
