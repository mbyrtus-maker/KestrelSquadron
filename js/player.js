(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3, D = Math.PI/180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dz = (v, z) => Math.abs(v) < z ? 0 : (v - Math.sign(v)*z)/(1 - z);
const wrap = a => { while (a > Math.PI) a -= Math.PI*2; while (a < -Math.PI) a += Math.PI*2; return a; };
const rnd = () => Math.random() - 0.5;
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), CQ = new THREE.Quaternion(), CE = new THREE.Euler(0, 0, 0, 'YXZ');

G.Player = class {
  constructor(game){
    this.g = game; const st = this.st = G.stats(), L = G.save.load;
    this.w = {gun:G.weapon('gun', L.gun), missile:G.weapon('missile', L.missile), pod:G.weapon('pod', L.pod), bomb:G.weapon('bomb', L.bomb),
      laser:G.weapon('laser', L.laser), melee:G.weapon('melee', L.melee), shield:G.weapon('shield', L.shield)};
    this.maxHp = st.maxHp; this.hp = Math.max(this.maxHp*0.05, st.maxHp*(1 - G.save.damage)); this.alive = true;
    this.fuel = st.fuel; this.flares = st.flares; this.maxMis = Math.round(this.w.missile.cap*st.rack); this.mis = this.maxMis;
    this.maxBombs = Math.max(1, Math.round(this.w.bomb.cap*(0.75 + 0.25*st.rack))); this.bombs = this.maxBombs;
    this.jamOwned = st.jammer; this.jam = st.jammer;
    this.F = G.buildFighter(Object.assign({}, G.frame(), {lasers:G.stats().lasers})); this.F.root.rotation.order = 'YXZ'; game.scene.add(this.F.root);
    this.pos = new V3(0, 420, -2300); this.vel = new V3(0, 0, 180); this.yaw = 0; this.pitch = 0; this.roll = 0; this.speed = 180; this.throttle = 0.6;
    this.mode = 'jet'; this.F.setMode('jet', true);
    this.camPitch = 0; this.camOff = new V3(0, 7, -30); this.aimPoint = new V3(0, 0, 1000); this.aimEnt = null; this.target = null; this.sticky = null;
    this.locks = new Map(); this.lockedList = []; this.tapT = {}; this.dashCd = 0; this.dashT = 0; this.dashDir = new V3(); this.yawRate = 0; this.pitchRate = 0; this.stall = 0; this.aimDir = new V3(0, 0, 1);
    this.cd = {gun:0, pod:0, mis:0, las:0, mel:0, flare:0, mode:0, bomb:0, man:0}; this.gunSide = 0;
    this.msl = 'air'; this.onGround = false; this.jumpT = 0; this.swing = -1; this.combo = 0; this.chain = false; this.swingDur = 0.46; this.meleeTgt = null; this.meleeCand = null; this.meleeHit = false; this.block = 0; this.walk = 0; this.wpn = 0; this.wpnWant = 0; this.qSwing = false;
    this.shake = 0; this.lockedBy = 0; this.hits = []; this.gh = 0; this.agl = 400; this.pullUp = false; this.gpws = 0; this.gpwsT = 99; this.boost = false;
    this.view = G.save.view || 'cockpit'; this.ray = new THREE.Raycaster(); this.thrusting = false;
    this.F.setMissiles(1); this.F.cockpit(this.view === 'cockpit');
  }
  airborne(){ return this.mode !== 'mech' || !this.onGround; }
  // Mech mode near the ground hides in ground clutter: anti-air radars and missile seekers can't hold it.
  groundClutter(){ return this.mode === 'mech' && this.agl < 35; }
  fwd(out){ return out.set(Math.sin(this.yaw)*Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw)*Math.cos(this.pitch)); }
  heading(out){ return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  setMode(m){
    if (m === this.mode || this.cd.mode > 0 || !this.alive) return;
    const prev = this.mode; this.prevMode = prev; this.mode = m; this.cd.mode = 0.75;
    this.F.setMode(m); this.F.cockpit(this.view === 'cockpit');
    G.audio.transform(m); G.hud.setMode(m, true);
    if (m === 'jet') {
      const hs = Math.hypot(this.vel.x, this.vel.z);
      this.speed = Math.max(hs, 85);
      this.pitch = clamp(Math.atan2(this.vel.y, Math.max(hs, 1)), -0.5, 0.5);
      if (this.agl < 25) { this.pitch = Math.max(this.pitch, 0.32); this.pos.y = Math.max(this.pos.y, this.gh + 8); }
      this.throttle = Math.max(this.throttle, 0.55); this.locks.clear(); this.camPitch = 0; this.yawRate = this.pitchRate = 0; this.rb = 0; this.man = null; this.manRoll = 0;
    } else {
      if (prev === 'jet') { this.vel.y -= m === 'hover' ? 16 : 6; this.camPitch = clamp(this.pitch*0.6, -0.6, 0.6); }
      if (m === 'mech') { this.onGround = false; this.jumpT = 1; this.airPeak = this.pos.y; this.dropped = true; this.slam = 0; }
    }
  }

  update(dt){
    const I = G.input, K = c => Math.max(I.keys.has(c) ? 1 : 0, (I.an && I.an[c]) || 0), g = this.g, st = this.st;   // keys, or a controller's analog sticks
    for (const k in this.cd) this.cd[k] -= dt;
    this.hits = this.hits.filter(h => (h.t -= dt*0.8) > 0);
    if (!this.alive) { this.F.update(dt); this.camera(dt); return; }
    if (I.pressed.has('Digit1')) this.setMode('jet');
    if (I.pressed.has('Digit2')) this.setMode('hover');
    if (I.pressed.has('Digit3')) this.setMode('mech');
    if (I.pressed.has('Tab')) this.setMode({jet:'hover', hover:'mech', mech:'jet'}[this.mode]);
    if (I.pressed.has('KeyV')) { this.view = this.view === 'cockpit' ? 'chase' : 'cockpit'; G.save.view = this.view; this.F.cockpit(this.view === 'cockpit'); G.hud.setView(this.view); }
    if (I.pressed.has('KeyJ') && this.jamOwned) { this.jam = !this.jam; G.hud.radio('ECM', this.jam ? 'Jammer active.' : 'Jammer off.'); }
    if (I.pressed.has('KeyF')) this.popFlares();

    if (this.mode !== 'jet' && g.world.pushOut(this.pos, 4.5, this.pos.y - G.CLEAR[this.mode])) { this.vel.x *= 0.5; this.vel.z *= 0.5; }
    const h = g.world.height(this.pos.x, this.pos.z);
    const space = g.world.space, cv = g.world.carrier, onDeck = cv && Math.abs(this.pos.x - cv.x) < 49 && this.pos.z - cv.z > -288 && this.pos.z - cv.z < 304 && this.pos.y < cv.deck + 40, zeroG = this.zeroG = space && !onDeck && !(G.inStation && G.inStation(this.pos));   // space: no sea level; outside the station's hangar, no gravity
    const gh = this.gh = space ? h : this.mode === 'mech' ? Math.max(h, -3) : Math.max(h, 0.4);
    const clr = G.CLEAR[this.mode]; this.agl = this.pos.y - gh - clr;
    const inv = G.save.invert ? -1 : 1, F = this.F, root = F.root;
    this.boost = !!(K('ShiftLeft') || K('ShiftRight'));
    let thrust = 0.3; this.thrusting = false; this.pullUp = false;

    if (this.mode === 'jet') {
      I.dx = I.dy = 0;
      const mx = dz(I.mx, 0.05), my = dz(I.my, 0.05);
      let turnIn = (mx*0.9 + (K('KeyD') - K('KeyA'))*0.6 + (K('ArrowRight') - K('ArrowLeft'))*0.6)*st.agility;
      let pitchIn = (my*0.95*st.agility + (K('ArrowUp') - K('ArrowDown'))*0.7)*inv;
      const resp = Math.min(1, dt*2.6);
      this.maneuverKeys(I, g, zeroG, gh);
      const MV = this.man; if (MV && MV.k !== 'roll') turnIn = 0;
      this.yawRate += (turnIn - this.yawRate)*resp; this.pitchRate += (pitchIn - this.pitchRate)*resp;
      if (MV) this.maneuver(MV, dt);
      const auth = clamp((this.speed - 55)/60, 0.35, 1), stall = zeroG ? 0 : clamp((85 - this.speed)/30, 0, 1);
      // Bank-and-pull: sideways input banks hard (up to ~80 deg at the screen edge) and turns; the pitch input acts in the
      // cockpit frame, so pulling while banked tightens the turn toward the low wing instead of climbing.
      // rb is the roll the jet settles to with no stick: 0 upright, pi inverted (after going over the top of a loop)
      this.rb = this.rb || 0;
      if (Math.abs(this.rb) > 1 && Math.abs(pitchIn) < 0.15 && !this.man) { this.invT = (this.invT || 0) + dt; if (this.invT > 1.2) this.rb = 0; } else this.invT = 0;   // let go while inverted: half-roll upright
      this.roll += wrap(this.rb + clamp(turnIn*1.45, -1.4, 1.4) - this.roll)*Math.min(1, dt*3.4); this.roll = wrap(this.roll);
      const cr = Math.cos(this.roll), sr = Math.sin(this.roll);
      this.yaw -= (this.yawRate + this.pitchRate*sr*0.9)*auth*dt;
      this.pitch += this.pitchRate*cr*auth*dt - stall*0.6*dt;
      // past vertical: the same attitude written the other way up (heading turned round, rolled inverted), so a held pull flies a full loop
      if (Math.abs(this.pitch) > Math.PI/2) { this.pitch = Math.sign(this.pitch)*Math.PI - this.pitch; this.yaw = wrap(this.yaw + Math.PI); this.roll = wrap(this.roll + Math.PI); this.rb = wrap(this.rb + Math.PI); }
      this.throttle = clamp(this.throttle + (K('KeyW') - K('KeyS'))*0.5*dt, 0, 1);
      const target = (75 + this.throttle*145)*st.speed*(this.boost ? 1.32 : 1);
      this.speed += clamp(target - this.speed, -22*dt, 28*dt);
      if (!zeroG) this.speed = Math.max(45, this.speed - Math.sin(this.pitch)*48*dt);
      this.vel.copy(this.fwd(tA)).multiplyScalar(this.speed);
      if (!zeroG) this.vel.y -= stall*22 + 2;
      this.pos.addScaledVector(this.vel, dt);
      this.stall = stall;
      thrust = 0.3 + this.throttle*0.45 + (this.boost ? 0.45 : 0);
      if (space && zeroG && this.pos.y < gh + clr) { this.pos.y = gh + clr; this.pitch = Math.max(this.pitch, 0.25); if (g.time - (this.floorT || -9) > 3) { this.floorT = g.time; G.hud.flash('EDGE OF THE BATTLE SPACE · CLIMB'); } }
      else if (this.pos.y < gh + clr) {
        const impact = this.speed*Math.max(0.25, -Math.sin(this.pitch));
        this.damage(impact*4, null, 'crash'); this.pos.y = gh + clr + 1.5; this.pitch = Math.max(this.pitch, 0.3); this.rb = 0; this.man = null; this.manRoll = 0; this.shake += 1.2;
        G.hud.flash('TERRAIN IMPACT'); g.fx.explosion(this.pos, 0.6);
      }
      root.position.copy(this.pos); root.rotation.set(-this.pitch, this.yaw, this.roll + (this.manRoll || 0), 'YXZ');
    } else {
      if (I.locked) {
        // Captured mouse: direct mouse-look. The aim point is screen centre.
        const k = 0.0021*(G.save.sens ?? 0.5), lookYaw = I.dx*k;
        this.yaw -= lookYaw; this.yawRate += ((K('ArrowRight') - K('ArrowLeft'))*1.0*st.agility - this.yawRate)*Math.min(1, dt*3.5); this.yaw -= this.yawRate*dt;
        this.lookRate = dt > 0 ? lookYaw/dt : 0;
        this.camPitch = clamp(this.camPitch - I.dy*k*0.85*inv + (K('ArrowUp') - K('ArrowDown'))*0.9*dt, -1.0, 1.05);
        I.mx = 0; I.my = 0;
      } else {
        const ex = dz(I.mx, 0.34), ey = dz(I.my, 0.42);
        this.yawRate += ((ex*1.3 + (K('ArrowRight') - K('ArrowLeft'))*1.0)*st.agility - this.yawRate)*Math.min(1, dt*3.5);
        this.yaw -= this.yawRate*dt; this.lookRate = 0;
        this.camPitch = clamp(this.camPitch + (ey*1.0*inv + (K('ArrowUp') - K('ArrowDown'))*0.9)*dt, -1.0, 1.05);
      }
      if (I.look) { const k = 0.9 + 1.8*(G.save.sens ?? 0.5); this.yaw -= I.look.x*2.0*k*dt; this.lookRate = I.look.x*2.0*k; this.camPitch = clamp(this.camPitch - I.look.y*1.4*k*dt*inv, -1.0, 1.05); }   // controller: right stick looks and aims
      I.dx = I.dy = 0;
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), fw = K('KeyW') - K('KeyS'), sr = K('KeyD') - K('KeyA');
      const n = Math.hypot(fw, sr) || 1;
      if (this.mode === 'hover') {
        const sp = 50*st.speed*(this.boost ? 1.45 : 1);
        const dx = (fx*fw - fz*sr)/n*sp, dzv = (fz*fw + fx*sr)/n*sp, k = Math.min(1, dt*1.0);
        const ax = (dx - this.vel.x)/sp, az = (dzv - this.vel.z)/sp, vUp = K('Space') ? 1 : K('KeyC') ? -1 : 0;
        const af = clamp((ax*fx + az*fz)*1.6 + fw*0.15 - vUp*0.15, -1, 1), ar = clamp((-ax*fz + az*fx)*1.6 + sr*0.15, -1, 1);
        const lk = Math.min(1, dt*4);
        F.ctl.lp += (af - F.ctl.lp)*lk; F.ctl.lr += (ar - F.ctl.lr)*lk; F.ctl.lt += (clamp((this.yawRate + (this.lookRate || 0)*0.5)*0.8, -1, 1) - F.ctl.lt)*lk;
        this.vel.x += (dx - this.vel.x)*k; this.vel.z += (dzv - this.vel.z)*k;
        const up = K('Space') - (K('KeyC') ? 1 : 0);
        this.vel.y += ((up > 0 ? 22 : up < 0 ? -20 : zeroG ? 0 : -1.5) - this.vel.y)*Math.min(1, dt*0.9);
        this.pos.addScaledVector(this.vel, dt);
        if (this.pos.y < gh + clr) {
          if (this.vel.y < -26) { this.damage((-this.vel.y - 26)*14, null, 'fall'); G.hud.flash('HARD LANDING'); this.shake += 1; }
          this.pos.y = gh + clr; this.vel.y = Math.max(0, this.vel.y); this.onGround = true;
        } else this.onGround = false;
        const hs = Math.hypot(this.vel.x, this.vel.z);
        thrust = 0.4 + 0.3*Math.min(1, hs/60) + (up > 0 ? 0.3 : 0);
        const lf = (this.vel.x*fx + this.vel.z*fz)/sp, lr = (-this.vel.x*fz + this.vel.z*fx)/sp;
        root.position.copy(this.pos); root.rotation.set(clamp(lf*0.2, -0.3, 0.3), this.yaw, clamp(lr*0.3, -0.35, 0.35), 'YXZ');
        if (Math.random() < dt*30) for (const nz of F.nozzles) { nz.getWorldPosition(tB); nz.getWorldDirection(tC).negate(); g.fx.thrust(tB, tC, 0.8); }
      } else {
        const onG = this.onGround;
        const sp = 21*st.speed*(this.boost && onG ? 1.6 : 1)*(this.block > 0.5 ? 0.45 : 1);
        const dx = (fx*fw - fz*sr)/n*sp, dzv = (fz*fw + fx*sr)/n*sp, k = Math.min(1, dt*(onG ? 5 : 0.6));
        // Thruster dash: double-tap W, A, S or D.
        const now = this.g.time;
        for (const [key, f, r] of [['KeyW', 1, 0], ['KeyS', -1, 0], ['KeyD', 0, 1], ['KeyA', 0, -1]]) {
          if (!I.pressed.has(key)) continue;
          const last = this.tapT[key] || -9; this.tapT[key] = now;
          if (now - last < 0.28 && key === 'KeyW' && this.block >= 0.5 && this.chargeReady()) {
            // Shield charge: shield up + double-tap W rams the marked target (or straight ahead).
            this.fuel -= 20; this.dashCd = 1.6; this.chargeT = 0.9; this.tapT[key] = -9; this.chargeTgt = this.findMeleeTarget(); this.chargeHit = false;
            this.dashDir.set(fx, 0, fz);
            if (onG) { this.vel.y = Math.max(this.vel.y, 3); this.onGround = false; }
            G.audio.dash(); G.audio.tone(70, 0.4, 'sawtooth', 0.12, 40); this.shake += 0.5;
            for (let i = 0; i < 10; i++) g.fx.dust(tB.set(this.pos.x + rnd()*6, this.gh, this.pos.z + rnd()*6));
            continue;
          }
          if (now - last < 0.28 && this.dashCd <= 0 && this.fuel >= 15 && this.block < 0.5) {
            this.fuel -= 15; this.dashCd = 0.7; this.dashT = 0.5; this.tapT[key] = -9;
            this.dashDir.set(fx*f - fz*r, 0, fz*f + fx*r).normalize();
            if (onG) { this.vel.y = Math.max(this.vel.y, 5); this.onGround = false; }
            G.audio.dash(); this.shake += 0.35;
            for (let i = 0; i < 8; i++) g.fx.dust(tB.set(this.pos.x + rnd()*6, this.gh, this.pos.z + rnd()*6));
          }
        }
        this.dashCd -= dt;
        if (this.chargeT > 0) {
          this.chargeT -= dt; const ct = this.chargeTgt;
          if (ct && ct.alive) { tA.set(ct.pos.x - this.pos.x, 0, ct.pos.z - this.pos.z).normalize(); this.dashDir.lerp(tA, Math.min(1, dt*10)).normalize(); this.yaw += clamp(wrap(Math.atan2(this.dashDir.x, this.dashDir.z) - this.yaw), -1, 1)*Math.min(1, dt*12); }
          const ds = 95*st.speed*(0.6 + 0.4*Math.max(0, this.chargeT)/0.9);
          this.vel.x = this.dashDir.x*ds; this.vel.z = this.dashDir.z*ds; this.thrusting = true;
          for (const nz of F.nozzles) { nz.getWorldPosition(tB); g.fx.thrust(tB, tC.copy(this.dashDir).negate().setY(-0.3), 2, [0.5, 0.8, 1]); }
          if (!this.chargeHit) this.shieldBash();
          if (this.chargeT <= 0) this.chargeTgt = null;
        } else if (this.dashT > 0) {
          this.dashT -= dt; const ds = 62*st.speed*(0.45 + 0.55*Math.max(0, this.dashT)/0.5);
          this.vel.x = this.dashDir.x*ds; this.vel.z = this.dashDir.z*ds; this.thrusting = true;
          for (const nz of F.nozzles) { nz.getWorldPosition(tB); g.fx.thrust(tB, tC.copy(this.dashDir).negate().setY(-0.3), 1.5, [1, 0.6, 0.25]); }
        } else if (!this.lunging) { this.vel.x += (dx - this.vel.x)*k; this.vel.z += (dzv - this.vel.z)*k; }
        this.lunging = false;
        this.vel.y -= 40*dt; this.jumpT += dt;
        if (onG) { this.airPeak = this.pos.y; this.dropped = false; } else this.airPeak = Math.max(this.airPeak ?? this.pos.y, this.pos.y);
        // Ground strike: Q in mid-air plunges the drawn blade into the ground.
        if (this.slam && !onG) {
          if (this.wpn >= 0.98) {
            if (this.slam !== 2) { this.combo = 2; this.swingDur = 0.62; this.meleeTgt = null; }
            this.slam = 2; this.swing = 0.3; this.meleeHit = true;
            this.vel.y = Math.min(this.vel.y, -58); this.vel.x *= 1 - Math.min(1, dt*1.5); this.vel.z *= 1 - Math.min(1, dt*1.5);
            if (Math.random() < dt*40) for (const z of [3.5, 5.5, 7.4]) { F.world('blade', 0, 0, z, tB); g.fx.fire.emit(tB.x, tB.y, tB.z, 0, 0, 0, 2.4 + z*0.25, 0.22, 0.45, 0.78, 1, 0.85, -4); }
          }
        }
        // Jumps follow the stick: hold a direction and the mech leaps that way, standing still it goes straight up.
        const mv = fw !== 0 || sr !== 0, jx = mv ? (fx*fw - fz*sr)/n : 0, jz = mv ? (fz*fw + fx*sr)/n : 0;
        if (I.pressed.has('Space') && onG) {
          this.vel.y = (mv ? 19 : 22)*st.jump; this.onGround = false; this.jumpT = 0; G.audio.thump(0.5);
          if (mv) { const lj = 38*st.speed*st.jump; this.vel.x = jx*lj; this.vel.z = jz*lj;
            for (let i = 0; i < 6; i++) g.fx.dust(tB.set(this.pos.x + rnd()*6, this.gh, this.pos.z + rnd()*6)); }
        }
        if (K('Space') && !this.onGround && this.jumpT > 0.2 && this.fuel > 0) {
          this.vel.y += 72*dt; this.fuel = Math.max(0, this.fuel - 14*dt); this.thrusting = true;
          // Thrusters also carry the leap: steer and extend it in the held direction.
          if (mv) { const cap = 46*st.speed, h = Math.hypot(this.vel.x, this.vel.z), push = 34*dt;
            this.vel.x += jx*push; this.vel.z += jz*push; const h2 = Math.hypot(this.vel.x, this.vel.z); if (h2 > Math.max(cap, h)) { const s = Math.max(cap, h)/h2; this.vel.x *= s; this.vel.z *= s; } }
        }
        if (this.onGround) this.fuel = Math.min(st.fuel, this.fuel + 28*dt);
        this.pos.addScaledVector(this.vel, dt);
        const floor = gh + clr;
        if (this.pos.y <= floor || (this.onGround && this.vel.y <= 0 && this.pos.y - floor < 1.6)) {
          if (!this.onGround) {
            this.lastImpact = -this.vel.y;
            const fallH = (this.airPeak ?? this.pos.y) - floor, packFall = !this.dropped;   // anything reached on the jump pack (fallH kept for tuning)
            if (this.slam === 2) { this.slamImpact(gh); this.vel.x *= 0.2; this.vel.z *= 0.2; }
            else if (packFall) {
              // Anything the jump pack can reach, the legs are built to absorb: at most a light jolt.
              if (this.vel.y < -42) { this.damage(Math.min(this.maxHp*0.03, (-this.vel.y - 42)*2), null, 'fall'); this.shake += 0.8; G.audio.thump(0.9); }
              else if (this.vel.y < -10) { this.shake += 0.35; G.audio.thump(0.7); }
            }
            else if (this.vel.y < -28) { this.damage((-this.vel.y - 28)*10, null, 'fall'); G.hud.flash('HARD LANDING'); this.shake += 1.5; G.audio.thump(1); }
            else if (this.vel.y < -10) { this.shake += 0.25; G.audio.thump(0.6); }
            if (this.vel.y < -10) for (let i = 0; i < 6; i++) g.fx.dust(tA.set(this.pos.x + rnd()*8, gh, this.pos.z + rnd()*8));
          }
          this.pos.y = floor; this.vel.y = 0; this.onGround = true; this.slam = 0; this.dropped = false;
        } else if (this.pos.y > floor + 1.6) this.onGround = false;
        const hs = Math.hypot(this.vel.x, this.vel.z);
        const wTarget = this.onGround && hs > 1.5 ? Math.min(1, hs/16) : 0;
        F.ctl.walkAmt += (wTarget - F.ctl.walkAmt)*Math.min(1, dt*5);
        if (F.ctl.walkAmt > 0.02) this.walk += dt*Math.max(hs, 6)*0.24*Math.min(1, F.ctl.walkAmt*2);
        F.ctl.walk = this.walk;
        const stepIdx = Math.floor(this.walk/Math.PI);
        if (stepIdx !== this.stepIdx) {
          this.stepIdx = stepIdx;
          if (this.onGround && F.ctl.walkAmt > 0.25) {
            G.audio.step(0.5 + 0.5*F.ctl.walkAmt);
            const foot = F.nozzles[stepIdx % 2]; foot.getWorldPosition(tB); tB.y = this.gh + 0.3; g.fx.dust(tB);
            if (this.view === 'cockpit') this.shake += 0.12*F.ctl.walkAmt;
          }
        }
        this.block += ((I.rmb ? 1 : 0) - this.block)*Math.min(1, dt*8);
        if (this.swing >= 0) {
          this.swing += dt/(this.swingDur || 0.5);
          const mt = this.meleeTgt, s0 = this.swing;
          if (mt && mt.alive && s0 < 0.5 && !this.slam) {
            // Blade magnetism: square up to the target and dash in so the slash lands at sword's reach.
            tA.set(mt.pos.x - this.pos.x, 0, mt.pos.z - this.pos.z); const hd = tA.length() || 1, want = Math.atan2(tA.x, tA.z);
            this.yaw += clamp(wrap(want - this.yaw), -1, 1)*Math.min(1, dt*16);
            const gap = hd - (mt.r + 7.5);
            if (s0 > 0.02) {
              const left = Math.max(0.05, (0.46 - s0)*(this.swingDur || 0.5)), vs = gap > 0 ? Math.min(170, gap/left) : 0;
              this.lunging = true;
              tA.multiplyScalar(1/hd); this.vel.x = tA.x*vs; this.vel.z = tA.z*vs;
              if (vs > 30 && Math.random() < 0.6) for (const nz of F.nozzles) { nz.getWorldPosition(tB); nz.getWorldDirection(tC).negate(); g.fx.thrust(tB, tC, 1.6); }
              if (vs > 30) this.thrusting = true;
            }
          }
          if (this.swing > 0.34 && this.swing < 0.68) {
            // blade trail through the strike
            for (const z of [2.5, 4, 5.5, 7, 8.4]) { F.world('blade', 0, 0, z, tB); g.fx.fire.emit(tB.x, tB.y, tB.z, 0, 0, 0, 2.6 + z*0.3, 0.28, 0.45, 0.78, 1, 0.85, -4); }
            if (!this.swooshed) { this.swooshed = true; G.audio.saberSwing(this.combo === 2); if (!mt) { this.heading(tA); this.vel.x += tA.x*14; this.vel.z += tA.z*14; } }
          }
          if (!this.meleeHit && this.swing >= 0.46) { this.meleeHit = true; this.meleeStrike(this.combo); }
          // Combo: click again (or keep holding) during the follow-through to chain the next cut. Third cut is the finisher.
          if (I.pressed.has('Mouse0') && this.swing > 0.12) this.chain = true;
          if (this.swing >= 0.64 && this.combo < 2 && (this.chain || (I.lmb && this.wpnWant === 1)) && !this.slam) this.startSwing(this.combo + 1);
          else if (this.swing >= 1) { this.swing = -1; this.cd.mel = this.combo === 2 ? 0.4 : 0.12; this.combo = 0; this.meleeTgt = null; }
        }
        // Blade-out targeting: the nearest enemy you can reach is bracketed on the HUD.
        this.meleeCand = this.wpnWant === 1 || this.block > 0.3 ? this.findMeleeTarget() : null;
        // Ready cue: a short ping the moment a shield charge becomes available on a marked target.
        const cr = this.block >= 0.5 && this.meleeCand && this.chargeReady();
        if (cr && !this.crWas) G.audio.tone(1320, 0.08, 'sine', 0.06, 1760);
        this.crWas = cr;
        thrust = this.thrusting ? 1 : 0.12;
        if (this.thrusting) for (const nz of F.nozzles) { nz.getWorldPosition(tB); nz.getWorldDirection(tC).negate(); g.fx.thrust(tB, tC, 1.3); }
        const wa = F.ctl.walkAmt, ph = this.walk;
        root.position.copy(this.pos); root.position.y -= Math.abs(Math.sin(ph))*0.32*wa;
        root.rotation.set(0.07*wa*Math.min(1, hs/20), this.yaw + (F.ctl.twist || 0), Math.sin(ph)*0.035*wa, 'YXZ');
      }
    }
    // Soft boundary: steer back toward the operations area before the edge mountains.
    const dC = Math.hypot(this.pos.x, this.pos.z);
    if (dC > 7100) {
      const k = clamp((dC - 7100)/200, 0, 1);
      if (this.mode === 'jet') { const d = wrap(Math.atan2(-this.pos.x, -this.pos.z) - this.yaw); this.yaw += clamp(d, -1, 1)*k*1.8*dt; this.pitch += (0.12 - this.pitch)*k*dt; this.rb = 0; }
      else { const nx = this.pos.x/dC, nz = this.pos.z/dC, out = this.vel.x*nx + this.vel.z*nz; if (out > 0) { this.vel.x -= nx*out*k; this.vel.z -= nz*out*k; } }
    }
    if (I.pressed.has('KeyM')) { G.audio.engOn = G.audio.engOn === false; G.hud.radio('HUD', G.audio.engOn === false ? 'Engine sound off (M).' : 'Engine sound on (M).'); }
    this.gpwsCheck();
    if (this.mode !== 'mech') { this.block = 0; this.swing = -1; this.wpn = 0; this.wpnWant = 0; this.qSwing = false; }
    else this.wpn += Math.sign(this.wpnWant - this.wpn)*Math.min(Math.abs(this.wpnWant - this.wpn), dt/0.55);   // one weapon hand: stow one, draw the other
    F.ctl.block = this.block; F.ctl.swing = this.swing; F.ctl.combo = this.combo; F.ctl.wpn = this.wpn; F.ctl.thrust = thrust;
    if (this.mode === 'jet' && this.boost && Math.random() < dt*40) for (const nz of F.nozzles) { nz.getWorldPosition(tB); this.fwd(tC).negate(); g.fx.thrust(tB, tC, 1.2, [1, 0.6, 0.25]); }
    F.update(dt); root.updateMatrixWorld(true);
    this.camera(dt);
    this.updateAim();
    this.weapons(dt);
    this.commands();
  }

  gpwsCheck(){
    if (this.gpwsGrace > 0) { this.gpwsGrace -= 1/60; this.gpws = 0; this.pullUp = false; return; }
    const W = this.g.world, clr = G.CLEAR[this.mode], v = this.vel; let tt = 99;
    if (this.mode === 'mech') { this.gpws = 0; this.pullUp = false; return; }   // mech can't fly: no terrain warnings
    if (this.zeroG) { this.gpws = 0; this.pullUp = false; return; }   // nothing to fly into in open space
    const pad = this.mode === 'jet' ? 18 : 1.5, horizon = this.mode === 'jet' ? 7 : 5;
    for (let t = 0.25; t <= horizon; t += 0.25) {
      const px = this.pos.x + v.x*t, pz = this.pos.z + v.z*t;
      let py = this.pos.y + v.y*t; if (this.mode === 'mech') py -= 20*t*t;
      const floor = Math.max(W.height(px, pz), this.mode === 'mech' ? -3 : 0.4) + clr + pad;
      if (py < floor) { tt = t; break; }
    }
    let lvl = 0;
    if (this.mode === 'jet') { lvl = tt <= 3.5 ? 2 : tt <= 7 ? 1 : 0; if (!lvl && this.agl < 40 && v.y < -2) lvl = 1; }
    else if (this.mode === 'hover') { if (v.y < -27 && tt <= 2.2) lvl = 2; }
    else { const impact = -(v.y - 40*Math.min(tt, 5)); if (tt <= 2 && impact > 31) lvl = 2; else if (tt <= 3.5 && impact > 34) lvl = 1; }
    this.gpws = lvl; this.gpwsT = tt; this.pullUp = lvl === 2;
  }

  camera(dt){
    const cam = this.g.camera, F = this.F, jet = this.mode === 'jet';
    let fov;
    if (this.view === 'cockpit' && this.alive) {
      // Blend the eye point between the nose canopy and the mech head while the frame transforms.
      const e = F.t < 0.5 ? 2*F.t*F.t : 1 - Math.pow(-2*F.t + 2, 2)/2;
      const wm = m => m === 'mech' ? 1 : 0, b = wm(this.prevMode || this.mode) + (wm(this.mode) - wm(this.prevMode || this.mode))*e;
      F.world('nose', 0, 0.62, 1.3, tA); F.world('head', 0, 0.15, 0.35, tB); tA.lerp(tB, b);
      cam.position.copy(tA);
      CE.set(jet ? this.pitch : this.camPitch, this.yaw + Math.PI, jet ? -this.roll : 0, 'YXZ'); CQ.setFromEuler(CE);
      if (F.t < 1) cam.quaternion.slerp(CQ, Math.min(1, dt*9)); else cam.quaternion.copy(CQ);
      fov = jet ? 72 + (this.boost ? 6 : 0) : this.mode === 'hover' ? 70 : 66;
    } else {
      const look = tB;
      if (jet) {
        this.fwd(tC); tD.copy(tC).multiplyScalar(-30); tD.y += 7;
        look.copy(this.pos).addScaledVector(tC, 60);
      } else {
        const cp = this.camPitch, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), dist = this.mode === 'hover' ? 28 : 22;
        tD.set(-fx*dist*Math.cos(cp), (this.mode === 'hover' ? 8 : 9) - dist*Math.sin(cp), -fz*dist*Math.cos(cp));
        if (this.mode === 'mech') { tD.x += -fz*3.5; tD.z += fx*3.5; }
        look.set(this.pos.x + fx*Math.cos(cp)*80, this.pos.y + 4 + Math.sin(cp)*80, this.pos.z + fz*Math.cos(cp)*80);
      }
      if (!this.alive) tD.set(40, 25, -40);
      this.camOff.lerp(tD, 1 - Math.exp(-dt*(jet ? 5 : 7)));
      cam.position.copy(this.pos).add(this.camOff);
      const ch = this.g.world.height(cam.position.x, cam.position.z) + 2;
      if (cam.position.y < ch) cam.position.y = ch;
      cam.lookAt(look);
      fov = jet ? 70 + (this.boost ? 7 : 0) : this.mode === 'hover' ? 68 : 64;
    }
    if (this.shake > 0) { const s = Math.min(this.shake, 2)*0.5; cam.position.x += rnd()*s; cam.position.y += rnd()*s; cam.position.z += rnd()*s; this.shake = Math.max(0, this.shake - dt*2.5); }
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov)*Math.min(1, dt*4); cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }

  updateAim(){
    const g = this.g, I = G.input;
    let auto = null;
    if (this.mode === 'jet') {
      const f = this.fwd(tA); this.aimPoint.copy(this.pos).addScaledVector(f, 900);
      let ba = 0.44;
      for (const e of g.ents) {
        if (!e.alive || e.team !== 'enemy') continue;
        tB.copy(e.pos); tB.y += e.cy; tB.sub(this.pos); if (tB.length() > this.st.radar) continue;
        const a = f.angleTo(tB); if (a < ba) { ba = a; auto = e; }
      }
      this.aimEnt = auto;
    } else {
      this.ray.setFromCamera({x:I.mx, y:I.my}, g.camera);
      const o = this.ray.ray.origin, d = this.ray.ray.direction; this.aimDir.copy(d);
      let best = null, bt = 2600, ba = 0.12;
      for (const e of g.ents) {
        if (!e.alive) continue;
        tB.copy(e.pos); tB.y += e.cy; tB.sub(o); const t = tB.dot(d);
        if (t < 0) continue;
        const perp2 = tB.lengthSq() - t*t;
        if (t < bt && perp2 < (e.r + 1.5)*(e.r + 1.5)) { best = e; bt = t; }
        if (e.team === 'enemy' && t < 2600) { const a = Math.sqrt(Math.max(0, perp2))/t; if (a < ba) { ba = a; auto = e; } }
      }
      let tg = -1;
      for (let t = 8; t < bt; t += 10) { const x = o.x + d.x*t, y = o.y + d.y*t, z = o.z + d.z*t; if (y < g.world.height(x, z)) { tg = t; break; } }
      if (tg > 0) { this.aimPoint.copy(o).addScaledVector(d, tg); this.aimEnt = null; }
      else if (best) { this.aimPoint.copy(o).addScaledVector(d, bt); this.aimEnt = best; }
      else { this.aimPoint.copy(o).addScaledVector(d, 2000); this.aimEnt = null; }
      if (this.aimEnt && this.aimEnt.team === 'enemy') auto = this.aimEnt;
      tA.subVectors(this.aimPoint, this.pos); tA.y -= this.mode === 'mech' ? 1.5 : -0.8;
      this.F.ctl.aimYaw = clamp(wrap(Math.atan2(tA.x, tA.z) - this.yaw), -0.8, 0.8);
      this.F.ctl.aimPitch = clamp(Math.atan2(tA.y, Math.hypot(tA.x, tA.z)), -1.2, 1.3);
    }
    if (this.sticky && !this.sticky.alive) this.sticky = null;
    if (I.pressed.has('KeyT')) {
      if (this.sticky) { this.sticky = null; G.hud.radio('HUD', 'Target released.'); }
      else if (auto) { this.sticky = auto; G.hud.radio('HUD', `Target designated: ${auto.name}.`); }
    }
    this.target = this.sticky || auto || (this.lockedList[0] || null);
    if (auto) this.F.ctl.ready = 1.5;   // an enemy near the crosshair brings the rifle down from its carry
  }

  /* H (or middle click) flips the missile selector between air-to-air and air-to-ground; right click fires whichever is selected. */
  missileTrigger(I, held){
    if (I.pressed.has('KeyH') || I.pressed.has('Mouse1')) {
      this.msl = this.msl === 'air' ? 'gnd' : 'air'; this.locks.clear(); this.lockedList = []; this.painting = false;
      G.hud.flash(this.msl === 'gnd' ? `AIR-TO-GROUND · ${this.w.bomb.name.toUpperCase()}` : `AIR-TO-AIR · ${this.w.missile.name.toUpperCase()}`); G.audio.ui();
    }
    const gnd = this.msl === 'gnd', ammo = gnd ? this.bombs : this.mis;
    // Hold the trigger and sweep the reticle across targets to lock several; let go to fire one missile at each.
    if (held && !this.trigWas) { this.painting = true; this.paintN = 0; }
    this.paintMax = Math.max(1, Math.min(6, ammo));
    if (this.painting && held) {
      if (this.lockedList.length > this.paintN) { this.paintN = this.lockedList.length; G.audio.tone(880 + this.paintN*90, 0.06, 'triangle', 0.05); }
    }
    // Rules of engagement: no heavy ordnance over a city full of civilians.
    if (gnd && held && this.g.inCity(this.pos) && this.g.cityZones.some(z => Math.hypot(this.aimPoint.x - z.x, this.aimPoint.z - z.z) < z.r)) {
      this.painting = false; this.trigWas = held; this.locks.clear(); this.lockedList = [];
      if (this.g.time - (this.roeT || -99) > 3) { this.roeT = this.g.time; G.hud.flash('ROE · NO GROUND MISSILES OVER THE CITY · USE GUN OR BLADE'); G.audio.lowAmmo(); }
      return;
    }
    if (!held && this.trigWas) {
      this.painting = false;
      if (this.cd.mis > 0) { this.trigWas = held; return; }
      if (ammo <= 0) { this.cd.mis = 0.6; G.hud.flash(gnd ? 'NO GROUND MISSILES · H FOR AIR' : 'NO MISSILES · H FOR GROUND'); }
      else this.ripple(gnd);
    }
    this.trigWas = held;
  }

  /* Fire at every locked target, one missile each, a tenth of a second apart. One target with a pair-firing missile gets the pair. */
  ripple(gnd){
    const L = this.lockedList.slice(), sticky = this.sticky && (gnd ? this.sticky.cls !== 'air' : this.sticky.cls === 'air') ? this.sticky : null;
    const T = L.length ? L : [sticky];
    let shots = gnd ? T.length : (T.length > 1 ? T.length : Math.max(1, this.w.missile.salvo));
    if (!gnd && this.w.missile.salvo >= 6) shots = this.w.missile.salvo;   // swarm pods split a full salvo across the locks
    shots = Math.min(shots, gnd ? this.bombs : this.mis);
    for (let i = 0; i < shots; i++) this.g.later(i*0.11, () => { if (!this.alive) return; const t = T[i % T.length]; gnd ? this.launchAGM(t && t.alive ? t : null, i) : this.launchAA(t && t.alive ? t : null, i); });
    this.cd.mis = 0.35 + shots*0.11;
    if (T.length > 1) G.hud.flash(`${shots} MISSILES · ${T.length} TARGETS`);
    else if (gnd && !L.length && !sticky) G.hud.flash('NO LOCK · FIRING ON THE AIM POINT');
  }

  updateLocks(dt){
    const gnd = this.msl === 'gnd', w = gnd ? {salvo:1, lock:this.w.bomb.lock} : this.w.missile, f = this.mode === 'jet' ? this.fwd(tA) : tA.copy(this.aimDir), maxN = this.painting ? this.paintMax || 1 : gnd ? 1 : Math.max(w.salvo, 2), range = gnd || this.painting ? this.st.radar*0.85 : this.mode === 'jet' ? this.st.radar*1.06 : Math.min(this.st.radar*0.85, 900), c = [];
    const lockMul = gnd || this.painting ? 1 : this.mode === 'jet' ? 0.5 : 1.6;   // air-to-air missiles are a fighter's weapon: fast, long locks in jet, slow short ones hovering
    for (const e of this.g.ents) {
      if (!e.alive || e.team !== 'enemy' || e.noLock || (gnd ? e.cls === 'air' : e.cls !== 'air')) continue;   // air-to-air locks aircraft only, air-to-ground everything else
      tB.copy(e.pos); tB.y += e.cy; tB.sub(this.pos); const d = tB.length();
      if (d > range || d < 60) continue;
      const a = f.angleTo(tB); if (a < (this.painting ? 0.4 : 0.27)) c.push({e, a: e === this.sticky ? -1 : a});   // sweeping uses a wider cone
    }
    c.sort((a, b) => a.a - b.a);
    // While painting, finished locks stay locked after the reticle moves on; new ones fill the remaining slots.
    const keep = new Set();
    if (this.painting) for (const [e, p] of this.locks) if (p >= 1 && e.alive && keep.size < maxN && e.pos.distanceTo(this.pos) < range) keep.add(e);
    for (const x of c) { if (keep.size >= maxN) break; keep.add(x.e); }
    for (const e of [...this.locks.keys()]) if (!keep.has(e)) this.locks.delete(e);
    for (const e of keep) {
      // Lock-ons need a clear line of sight; the target stays selected, it just can't lock through a hill or building.
      if ((this.losAt || 0) <= this.g.time) { this.losAt = this.g.time + 0.2; this.losMap = new Map(); }
      if (!this.losMap.has(e)) { tC.copy(e.pos); tC.y += e.cy; this.losMap.set(e, this.g.world.los(this.pos, tC)); }
      const seen = this.losMap.get(e); e.occluded = !seen;
      this.locks.set(e, seen ? Math.min(1, (this.locks.get(e) || 0) + dt/(w.lock*lockMul*(this.painting ? 0.35 : 1))) : Math.max(0, (this.locks.get(e) || 0) - dt*1.5));
    }
    this.lockedList = [...this.locks].filter(([, p]) => p >= 1).map(([e]) => e);
  }

  weapons(dt){
    const I = G.input, g = this.g, st = this.st;
    if (this.cd.mode > 0.3) return;
    if (this.mode === 'jet') {
      this.updateLocks(dt);
      if (I.lmb && this.cd.gun <= 0) {
        const w = this.w.gun; this.cd.gun = 1/w.rof; this.gunSide ^= 1;
        const m = this.F.world('nose', this.gunSide ? 0.45 : -0.45, -0.3, 3.0, new V3());
        const dir = tA.subVectors(this.aimPoint, m).normalize();
        dir.x += rnd()*w.spread; dir.y += rnd()*w.spread; dir.z += rnd()*w.spread; dir.normalize();
        g.addBullet(m, dir, w.speed + this.speed, w.dmg*st.dmg, w.color, 'player', {len:8, w:0.35});
        G.audio.gun(w.id);
      }
      this.missileTrigger(I, I.rmb);
    } else {
      if (this.mode === 'mech' && I.lmb && this.wpnWant === 1) {
        // Sword in hand: left click swings it, or drives it into the ground from a jump.
        if (!this.onGround && this.agl > 6 && !this.slam && this.swing < 0) { this.slam = 1; this.qSwing = false; G.hud.flash('GROUND STRIKE'); G.audio.saberSwing(true); }
        else if (!this.slam) this.qSwing = true;
      }
      if (I.lmb && this.cd.pod <= 0 && !(this.mode === 'mech' && this.wpn > 0.02)) {
        const w = this.w.pod; this.cd.pod = 1/w.rof; this.F.ctl.ready = 1.5;
        const m = this.F.world('gunpod', 0, 0.05, 3.9, new V3());
        const dir = tA.subVectors(this.aimPoint, m).normalize(), braced = this.mode === 'mech' && this.onGround, sp = w.spread*(braced ? 0.35 : 1);
        dir.x += rnd()*sp; dir.y += rnd()*sp; dir.z += rnd()*sp; dir.normalize();
        const rail = w.id === 'pod_rp7', beam = w.id === 'pod_br9';
        g.addBullet(m, dir, w.speed, w.dmg*st.dmg*(braced ? 1.4 : 1), w.color, 'player', {len:rail ? 18 : beam ? 10 : 6, w:rail ? 0.5 : beam ? 0.7 : 0.45});
        G.audio.gun(w.id); g.fx.spark(m, [1, 0.9, 0.6]);
      }
      this.updateLocks(dt);
      if (this.mode === 'hover') {
        this.missileTrigger(I, I.rmb);
        if (I.keys.has('KeyE') && this.cd.las <= 0) this.fireLaser();
      } else this.missileTrigger(I, I.keys.has('KeyE'));     // mech: E fires the back-mounted missile racks (right click is the shield)
      if (this.mode === 'mech' && I.pressed.has('KeyQ') && this.swing < 0 && !this.slam) {
        // Q swaps the weapon hand: gun -> sword, sword -> gun.
        if (this.wpnWant === 0) { this.wpnWant = 1; G.hud.flash('GUN STOWED · BLADE OUT'); G.audio.saberOn(); }
        else { this.wpnWant = 0; this.qSwing = false; G.hud.flash('BLADE STOWED · GUN OUT'); G.audio.tone(180, 0.18, 'triangle', 0.08, 120); }
      }
      if (this.mode === 'mech' && this.qSwing && this.wpn >= 1 && this.cd.mel <= 0 && this.swing < 0) { this.qSwing = false; this.startSwing(0); }
    }
  }

  launchDir(i){
    const jet = this.mode === 'jet', f = jet ? this.fwd(new V3()) : new V3().copy(this.aimDir);
    f.x += rnd()*0.06; f.y += rnd()*0.06 + (jet ? -0.02 : this.mode === 'mech' ? 0.35 : 0.04); return f.normalize();
  }
  launchAA(tgt, i){
    if (this.mis <= 0) return;
    const w = this.w.missile, g = this.g, side = i % 2 ? 1 : -1, jet = this.mode === 'jet';
    const p = this.F.world(side > 0 ? 'wingL' : 'wingR', side*(2.4 + (i % 3)*0.6), -0.6, rnd()*0.8, new V3());
    const v0 = jet ? this.speed : Math.hypot(this.vel.x, this.vel.z);
    // Kinematics: a missile off a fast jet inherits its speed and flies far; one off a hovering Kestrel starts slow,
    // builds speed lazily, tops out lower and burns out sooner (about 60% of the reach), and turns wide until it's fast.
    g.launchMissile(p, this.launchDir(i), tgt, jet ? {team:'player', by:'player', speed:v0 + 20, max:w.speed + v0*0.5, accel:220, turn:w.turn, dmg:w.dmg*this.st.dmg, groundMul:w.groundMul || 1, life:9, kin:true}
      : {team:'player', by:'player', speed:v0 + 40, max:w.speed*0.8 + v0*0.3, accel:110, turn:w.turn*0.6, dmg:w.dmg*this.st.dmg, groundMul:w.groundMul || 1, life:6.5, kin:true});
    const before = this.mis; this.mis--; g.stats.missiles++;
    G.audio.missile(); this.F.setMissiles(this.mis/this.maxMis);
    const low = Math.max(2, Math.ceil(this.maxMis*0.25));
    if (this.mis === 0) { G.hud.flash('MISSILES EXPENDED'); G.audio.lowAmmo(); }
    else if (before > low && this.mis <= low) { G.hud.flash(`MISSILES LOW · ${this.mis} LEFT`); G.audio.lowAmmo(); }
  }
  launchAGM(tgt, i){
    if (this.bombs <= 0) return;
    const w = this.w.bomb, g = this.g, side = (this.bombs + i) % 2 ? 1 : -1, jet = this.mode === 'jet';
    const p = this.mode === 'mech' ? this.F.world(side > 0 ? 'wingL' : 'wingR', side*2.6, -0.6, 0, new V3()) : this.F.world('body', side*0.9, -1.1, -0.4, new V3());
    const f = this.launchDir(i); if (this.mode !== 'mech') { f.y -= 0.05; f.normalize(); }
    const v0 = jet ? this.speed : Math.hypot(this.vel.x, this.vel.z);
    g.launchMissile(p, f, tgt, {team:'player', by:'player', speed:v0 + 15, max:Math.max(290, v0*0.9 + 120), turn:2.4, dmg:w.dmg*this.st.dmg, life:14, agm:w});
    this.bombs--; G.audio.missile(); G.audio.thump(0.3);
    if (this.bombs === 0) { G.hud.flash('GROUND MISSILES EXPENDED'); G.audio.lowAmmo(); }
    else if (this.bombs === 1) { G.hud.flash('LAST GROUND MISSILE'); G.audio.lowAmmo(); }
  }
  fireMissiles(){ this.ripple(false); }
  fireAGM(){ this.ripple(true); }

  dropBomb(){
    if (this.cd.bomb > 0) return;
    if (this.bombs <= 0) { this.cd.bomb = 1; G.hud.flash('NO BOMBS'); return; }
    this.bombs--; this.cd.bomb = 0.45;
    const p = this.F.world('body', (this.bombs % 2 ? 1 : -1)*0.8, -1.1, -0.4, new V3());
    this.g.dropBomb(p, this.vel.clone().add(tA.set(0, -4, 0)), this.w.bomb, 'player');
    G.audio.thump(0.4);
    if (this.bombs === 0) { G.hud.flash('BOMBS EXPENDED'); G.audio.lowAmmo(); }
    else if (this.bombs === 1) { G.hud.flash('LAST BOMB'); G.audio.lowAmmo(); }
  }

  fireLaser(){
    const w = this.w.laser, n = this.st.lasers, g = this.g; this.cd.las = w.cd;
    // Damage is per beam: twin = 2 beams, quad = 4. Each beam leaves its own barrel on the side of the head.
    const dmg = w.dmg*n*this.st.dmg, tips = this.F.laserTips || [];
    for (let i = 0; i < n; i++) { const t = tips[i % Math.max(1, tips.length)] || {x:0, y:0.42, z:1.45}; g.fx.beam(this.F.world('head', t.x, t.y, t.z, tB), this.aimPoint, 0x9dff9a, n > 2 ? 0.26 : 0.32, 0.2); }
    if (this.aimEnt && this.aimEnt.alive && this.pos.distanceTo(this.aimPoint) < 1800) g.damageEnt(this.aimEnt, dmg, 'player', {});
    else g.fx.dust(this.aimPoint);
    g.fx.spark(this.aimPoint, [0.6, 1, 0.6]); G.audio.laser();
  }

  startSwing(n){
    this.combo = n; this.swing = 0; this.meleeHit = false; this.swooshed = false; this.chain = false; this.qSwing = false;
    this.swingDur = n === 2 ? 0.62 : 0.46;
    const t = this.findMeleeTarget(); if (t) this.meleeTgt = t; else if (!this.meleeTgt || !this.meleeTgt.alive) this.meleeTgt = null;
    if (n === 2) G.audio.tone(130, 0.25, 'sawtooth', 0.05, 60);
  }
  chargeReady(){ return this.dashCd <= 0 && this.fuel >= 20 && !(this.chargeT > 0) && this.swing < 0; }
  /* Shield charge contact: everything in front of the shield takes a heavy bash, is thrown back and staggered. */
  shieldBash(){
    const g = this.g, w = this.w.melee, f = this.dashDir; let hit = 0;
    for (const e of g.ents) {
      if (!e.alive || e.team !== 'enemy' || (e.cls !== 'ground' && e.cls !== 'mech')) continue;
      tB.set(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z); const hd = tB.length();
      if (hd > e.r + 9 || Math.abs(e.pos.y + e.cy - this.pos.y) > 14 + e.r) continue;
      if (hd > 3 && f.angleTo(tB) > 1.0) continue;
      g.damageEnt(e, w.dmg*this.st.dmg*0.9*(e.cls === 'mech' ? 1.2 : 1), 'player', {melee:true});
      if (e.alive) { tB.normalize(); e.kb = (e.kb || new V3()).set(tB.x, 0, tB.z).multiplyScalar(48); e.stun = Math.max(e.stun || 0, 1.5); if (e.type === 'reaver') { e.st = 'stagger'; e.stT = 1.5; } }
      tA.copy(e.pos); tA.y += e.cy; g.fx.spark(tA, [0.6, 0.85, 1]); g.fx.spark(tA, [1, 0.8, 0.4]); g.fx.explosion(tA, 0.2); hit++;
    }
    if (hit) {
      this.chargeHit = true; this.chargeT = Math.min(this.chargeT, 0.08); this.vel.x *= -0.15; this.vel.z *= -0.15;
      this.shake += 1.2; g.hitStop = Math.max(g.hitStop || 0, 0.14); G.audio.impact('metal', 1.3); G.hud.flash('SHIELD CHARGE · STAGGERED');
    }
  }
  /* Best enemy within dash reach, weighted toward what you're looking at. */
  findMeleeTarget(){
    const g = this.g, f = this.heading(tC); let best = null, bs = 1e9;
    for (const e of g.ents) {
      if (!e.alive || e.team !== 'enemy' || e.cls === 'air') continue;
      tB.set(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z); const hd = tB.length();
      if (hd > 78 + e.r || Math.abs(e.pos.y + e.cy - this.pos.y) > 24 + e.r) continue;
      const a = hd > 4 ? f.angleTo(tB) : 0; if (a > 0.95) continue;
      const sc = hd + a*55 - (e === this.aimEnt ? 25 : 0) - (e.cls === 'mech' ? 8 : 0);
      if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }
  meleeStrike(n){
    n = n || 0;
    const w = this.w.melee, g = this.g, f = this.heading(new V3()), fin = n === 2; let hit = 0, metal = false, stone = false, killed = 0;
    const mul = fin ? 1.75 : n === 1 ? 1.1 : 1, reach = w.range + (fin ? 4 : 2);
    for (const e of g.ents) {
      if (!e.alive) continue;
      tA.copy(e.pos); tA.y += e.cy; tB.subVectors(tA, this.pos);
      const hd = Math.hypot(tB.x, tB.z);
      if (hd > reach + e.r || Math.abs(tB.y) > 16 + e.r) continue;
      tB.y = 0; if (hd > 3 && f.angleTo(tB) > (fin ? 1.3 : 1.15)) continue;
      const vsStruct = e.cls === 'struct' || e.cls === 'building';
      g.damageEnt(e, w.dmg*this.st.dmg*mul*(e.cls === 'mech' ? 1.3 : vsStruct ? 2.2 : 1), 'player', {melee:true});
      if (!e.alive) killed++;
      if (e.heavy && vsStruct && e.alive) G.hud.flash(`${Math.round(e.hp/e.maxHp*100)}% · KEEP CUTTING`);
      if ((e.cls === 'ground' || e.cls === 'mech') && e.alive && e.team === 'enemy') {
        // Knock the target back and rock it; the finisher sends it flying and staggers it.
        tB.normalize(); e.kb = (e.kb || new V3()).set(tB.x, 0, tB.z).multiplyScalar(fin ? 34 : 9);
        e.stun = Math.max(e.stun || 0, fin ? 1.2 : 0.28);
        if (e.type === 'reaver' && fin) { e.st = 'stagger'; e.stT = 1.2; }
      }
      g.fx.spark(tA, [1, 0.7, 0.3]); g.fx.spark(tA, [1, 0.9, 0.6]); g.fx.spark(tA, [0.6, 0.85, 1]); hit++;
      if (fin) g.fx.explosion(tA, 0.22);
      if (vsStruct) { stone = true; g.fx.dust(tA); } else metal = true;
    }
    if (hit) {
      this.shake += (stone ? 0.85 : 0.7)*(fin ? 1.6 : 1);
      g.hitStop = Math.max(g.hitStop || 0, fin ? 0.13 : killed ? 0.1 : 0.06);
      if (stone) G.audio.impact('concrete', metal ? 0.8 : 1); if (metal) G.audio.impact('metal', (stone ? 0.8 : 1)*(fin ? 0.9 : 0.6));
      G.audio.saberHit(fin);   // blade contact
      if (fin && hit) G.hud.flash(killed ? 'FINISHER' : 'STAGGERED');
      if (this.meleeTgt && this.meleeTgt.alive) { this.vel.x *= 0.2; this.vel.z *= 0.2; }
    }
  }

  /* Leap-and-plunge: shockwave around the landing point. Full blade damage x2.6 at the centre, 40% of that at the rim. */
  slamImpact(gh){
    const w = this.w.melee, g = this.g, R = 34 + w.range*0.4, c = tC.set(this.pos.x, gh + 1, this.pos.z); let hit = 0, killed = 0;
    for (const e of g.ents) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - c.x, e.pos.z - c.z) - e.r*0.5; if (d > R || Math.abs(e.pos.y + e.cy - c.y) > 22 + e.r) continue;
      const vsStruct = e.cls === 'struct' || e.cls === 'building', amt = w.dmg*this.st.dmg*2.6*(1 - 0.6*Math.max(0, d)/R)*(e.cls === 'mech' ? 1.3 : vsStruct ? 2.2 : 1);
      g.damageEnt(e, amt, 'player', {melee:true}); hit++; if (!e.alive) killed++;
      tA.copy(e.pos); tA.y += e.cy; g.fx.spark(tA, [1, 0.75, 0.4]);
    }
    for (let i = 0; i < 40; i++) { const a = i/40*Math.PI*2, r = 6 + Math.random()*R*0.9; g.fx.dust(tA.set(c.x + Math.cos(a)*r, gh, c.z + Math.sin(a)*r)); }
    for (let i = 0; i < 26; i++) { const a = Math.random()*Math.PI*2; g.fx.fire.emit(c.x, c.y, c.z, Math.cos(a)*60, 8 + Math.random()*14, Math.sin(a)*60, 2.6, 0.45, 0.5, 0.8, 1, 0.9, 0, 1.5, 0); }
    g.fx.explosion(c, 0.45); this.shake += 2.2; G.audio.boom(c, 1.2); G.audio.impact('concrete', 1); if (hit) G.audio.impact('metal', 0.8);
    this.swing = 0.46; this.swooshed = true;
    G.hud.flash(hit ? `GROUND STRIKE · ${hit} HIT${killed ? ` · ${killed} DESTROYED` : ''}` : 'GROUND STRIKE');
  }

  /* Jet maneuvers on quick keys: Q / E barrel roll left / right (jinks sideways; timed inside 600 m it shakes off
     incoming missiles), Space = Immelmann (half loop up, roll upright: reverses heading and climbs), C = split-S
     (roll inverted, pull through: reverses heading, trades altitude for speed). */
  maneuverKeys(I, g, zeroG, gh){
    const want = I.pressed.has('KeyQ') ? ['roll', -1] : I.pressed.has('KeyE') ? ['roll', 1] : I.pressed.has('Space') ? ['imm', 0] : I.pressed.has('KeyC') ? ['splits', 0] : null;
    if (!want || this.man || g.time - (g.introEndT ?? -9) < 0.6) return;   // the key that skipped the launch cinematic isn't a maneuver
    if ((this.cd.man || 0) > 0) { G.hud.flash(`MANEUVER RECHARGING · ${this.cd.man.toFixed(1)} s`); return; }
    const [k, dir] = want;
    if (k !== 'roll' && this.speed < 110) { G.hud.flash('TOO SLOW TO MANEUVER · OPEN THE THROTTLE'); return; }
    if (k === 'splits' && !zeroG && this.pos.y - gh < 380) { G.hud.flash('TOO LOW FOR A SPLIT-S · CLIMB'); return; }
    this.man = {k, dir, t:0, ph:0, rb0:this.rb || 0}; this.cd.man = k === 'roll' ? 2.5 : 4.5; this.invT = 0;
    if (k === 'roll') {
      let n = 0; for (const m of g.missiles) if (m.team === 'enemy' && m.target === this && m.pos.distanceTo(this.pos) < 600 && Math.random() < (this.jam ? 0.95 : 0.85)) { m.target = null; n++; }
      G.hud.flash(n ? `MISSILE${n > 1 ? 'S' : ''} DEFEATED · BARREL ROLL` : `BARREL ROLL ${dir < 0 ? 'LEFT' : 'RIGHT'}`);
      G.audio.tone(320, 0.3, 'sawtooth', 0.04, 520);
    } else { G.hud.flash(k === 'imm' ? 'IMMELMANN' : 'SPLIT-S'); G.audio.tone(240, 0.5, 'sawtooth', 0.04, 420); }
  }
  maneuver(M, dt){
    M.t += dt; const fin = () => { this.man = null; this.manRoll = 0; };
    if (M.k === 'roll') {
      const dur = 0.75, u = Math.min(1, M.t/dur), e = u*u*(3 - 2*u);
      this.manRoll = M.dir*Math.PI*2*e;
      const side = M.dir*110*Math.sin(Math.PI*u);   // sideways jink, ~50 m over the roll
      this.pos.x += -Math.cos(this.yaw)*side*dt; this.pos.z += Math.sin(this.yaw)*side*dt;
      if (u >= 1) fin(); return;
    }
    if (M.t > 4) { this.rb = 0; return fin(); }
    if (M.k === 'splits' && M.ph === 0) { this.rb = Math.PI; this.pitchRate = 0; if (M.t > 0.6) { M.ph = 1; M.rb0 = this.rb; } return; }
    this.pitchRate = 2.3;   // full back stick, held through the half loop
    const flipped = Math.abs(wrap(this.rb - M.rb0)) > 1;
    if (flipped && (M.k === 'imm' ? this.pitch < 0.1 : this.pitch > -0.1)) { if (M.k === 'imm') this.rb = 0; this.pitchRate = 0; this.pitch = M.k === 'imm' ? Math.max(this.pitch, 0) : Math.min(this.pitch, 0); fin(); }
  }

  popFlares(){
    if (this.flares <= 0 || this.cd.flare > 0) { if (this.flares <= 0) G.hud.flash('NO FLARES'); return; }
    this.flares--; this.cd.flare = 0.9; const g = this.g, start = g.flares.length; if (this.flares === 3) G.hud.flash('FLARES LOW · 3 LEFT'); else if (this.flares === 0) G.hud.flash('FLARES EXPENDED');
    for (let i = 0; i < 5; i++) g.flares.push({pos:this.pos.clone(), vel:this.vel.clone().multiplyScalar(0.3).add(new V3(rnd()*50, -12 - Math.random()*20, rnd()*50)), life:3.2, alive:true});
    for (const m of g.missiles) if (m.team === 'enemy' && m.target === this && Math.random() < (this.jam ? 0.9 : 0.75)*(this.vel.length() < 60 ? 0.5 : 1)) m.target = g.flares[start + Math.floor(Math.random()*5)];
    G.audio.flare(); if (G.coop) G.coop.flare(g);
  }

  damage(amt, src, kind){
    if (!this.alive || this.g.intro) return;
    if (this.mode === 'mech') amt *= 0.6;   // heavy armour in mech mode
    if (src && this.mode === 'mech' && this.block > 0.6) {
      this.heading(tA); tB.subVectors(src, this.pos); tB.y = 0; tB.normalize();
      if (tA.dot(tB) > Math.cos(70*D)) { amt *= 1 - this.w.shield.block*this.block; this.blocks = (this.blocks || 0) + 1; this.g.fx.spark(this.F.P.shield.getWorldPosition(tC), [0.7, 0.9, 1]); G.audio.clang(); }
    }
    if (this.g.training) { amt *= 0.3; amt = Math.max(0, Math.min(amt, this.hp - this.maxHp*0.2)); }
    this.hp -= amt; this.shake = Math.min(2.2, this.shake + amt/110);
    if (src) this.hits.push({a: wrap(Math.atan2(src.x - this.pos.x, src.z - this.pos.z) - this.yaw), t:1});
    G.hud.hurt(amt/this.maxHp);
    if (this.hp <= 0) { this.hp = 0; this.g.playerDown(kind); }
  }

  commands(){
    const I = G.input, W = this.g.wing, g = this.g;
    if (!W.alive) { if (['KeyZ', 'KeyX', 'KeyG', 'KeyB'].some(k => I.pressed.has(k))) G.hud.radio('Command', `${W.name} is down. You are flying solo.`); return; }
    if (I.pressed.has('KeyZ')) {
      const t = this.target;
      if (t && t.team === 'enemy') W.order('attack', t); else G.hud.radio(W.name, 'No target designated. Put your reticle on one or press T.');
    }
    if (I.pressed.has('KeyX')) W.order('cover');
    if (I.pressed.has('KeyB')) W.order('follow');
    if (I.pressed.has('KeyG')) {
      const p = new V3();
      if (this.mode === 'jet') {
        const f = this.fwd(tA); let hit = false;
        for (let t = 50; t < 2600; t += 20) { p.copy(this.pos).addScaledVector(f, t); if (p.y < g.world.height(p.x, p.z)) { hit = true; break; } }
        if (!hit) { p.copy(this.pos).addScaledVector(tB.set(f.x, 0, f.z).normalize(), 900); }
      } else p.copy(this.aimPoint);
      p.y = Math.max(g.world.height(p.x, p.z), 0);
      g.ping = {pos:p, t:45}; W.order('move', g.ping); G.audio.ping();
    }
  }
};

/* ---------- Wingman: "Ridge" ---------- */
G.Wingman = class {
  constructor(game){
    const D = this.def = G.WINGMEN[game.m.wing && G.WINGMEN[game.m.wing] ? game.m.wing : G.activeWing()];
    this.g = game; this.name = D.name; this.team = 'ally'; this.r = 7; this.cy = 0;
    this.F = G.buildFighter({id:'kestrel', color:D.color, trim:D.trim, lasers:2}); this.F.root.rotation.order = 'YXZ'; game.scene.add(this.F.root);
    this.F.setMode('jet', true);
    this.pos = new V3(-45, 425, -2335); this.dir = new V3(0, 0, 1); this.vel = new V3(0, 0, 180); this.speed = 180;
    this.maxHp = D.hp; this.hp = this.maxHp; this.alive = true; this.orderName = 'follow'; this.tgt = null; this.cur = null; this.ping = null;
    this.gunCd = 0; this.misCd = 3; this.extendT = 0; this.roll = 0; this.t = 0; this.scanT = 0; this.warned = false;
    this.mode = 'jet'; this.pendMode = null; this.walk = 0; this.yawG = 0; this.onGround = false;
  }
  setMode(m){
    const prev = this.mode; this.mode = m; this.F.setMode(m);
    if (m === 'jet') {
      const hs = Math.hypot(this.vel.x, this.vel.z), yaw = hs > 1 ? Math.atan2(this.vel.x, this.vel.z) : this.yawG;
      this.dir.set(Math.sin(yaw), 0.35, Math.cos(yaw)).normalize(); this.speed = Math.max(hs, 120); this.extendT = 0;
      const gh = Math.max(this.g.world.height(this.pos.x, this.pos.z), 0.4); this.pos.y = Math.max(this.pos.y, gh + 10);
    } else {
      if (prev === 'jet') { this.vel.copy(this.dir).multiplyScalar(this.speed); this.yawG = Math.atan2(this.dir.x, this.dir.z); }
      this.onGround = false;
    }
    if (this.g.time - (this.xfT || -99) > 10 && Math.random() < 0.6) {
      this.xfT = this.g.time;
      G.hud.radio(this.name, this.def.modes[m]);
    }
  }
  groundUpdate(dt, tgt){
    const g = this.g, P = g.player, W = g.world, F = this.F, mech = this.mode === 'mech', clr = G.CLEAR[this.mode];
    const gh = mech ? Math.max(W.height(this.pos.x, this.pos.z), -3) : Math.max(W.height(this.pos.x, this.pos.z), 0.4);
    const goal = tA;
    if (tgt) {
      tB.set(this.pos.x - tgt.pos.x, 0, this.pos.z - tgt.pos.z); const d = tB.length() || 1; tB.multiplyScalar(1/d);
      const stand = mech ? 200 : 300;
      if (d < stand) goal.set(this.pos.x, 0, this.pos.z); else goal.set(tgt.pos.x + tB.x*stand, 0, tgt.pos.z + tB.z*stand);
    } else if (this.orderName === 'move' && this.ping) { const a = this.t*0.15; goal.set(this.ping.pos.x + Math.sin(a)*60, 0, this.ping.pos.z + Math.cos(a)*60); }
    else { const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); goal.set(P.pos.x + fz*30 - fx*18, 0, P.pos.z - fx*30 - fz*18); }
    tC.set(goal.x - this.pos.x, 0, goal.z - this.pos.z); const dist = tC.length();
    const want = Math.min(mech ? 22 : 55, dist*0.6); if (dist > 0.5) tC.multiplyScalar(want/dist); else tC.set(0, 0, 0);
    const k = Math.min(1, dt*(mech ? (this.onGround ? 4 : 0.6) : 1.2));
    if (!mech) {
      const fx = Math.sin(this.yawG), fz = Math.cos(this.yawG), dvx = tC.x - this.vel.x, dvz = tC.z - this.vel.z, lk = Math.min(1, dt*4);
      F.ctl.lp += (clamp((dvx*fx + dvz*fz)/30, -1, 1) - F.ctl.lp)*lk; F.ctl.lr += (clamp((-dvx*fz + dvz*fx)/30, -1, 1) - F.ctl.lr)*lk; F.ctl.lt *= 1 - lk;
    }
    this.vel.x += (tC.x - this.vel.x)*k; this.vel.z += (tC.z - this.vel.z)*k;
    if (mech) {
      this.vel.y -= 40*dt;
      if (!this.onGround && this.vel.y < 0) { const agl = this.pos.y - gh - clr, tv = -clamp(agl*0.7, 6, 60); if (this.vel.y < tv) this.vel.y += (tv - this.vel.y)*Math.min(1, dt*3); }
      if (this.onGround && dist > 40 && Math.random() < dt*0.04) { this.vel.y = 22; this.onGround = false; }
    } else {
      let ty = gh + clr + 30; if (P.mode === 'hover') ty = Math.max(ty, P.pos.y); ty = Math.min(ty, gh + clr + 220);
      this.vel.y += (clamp((ty - this.pos.y)*0.8, -18, 18) - this.vel.y)*Math.min(1, dt*1.5);
    }
    this.pos.addScaledVector(this.vel, dt);
    W.pushOut(this.pos, 4.5, this.pos.y - clr);
    if (this.pos.y <= gh + clr) { this.pos.y = gh + clr; this.vel.y = Math.max(0, this.vel.y); this.onGround = mech; }
    else if (mech && this.pos.y > gh + clr + 1.5) this.onGround = false;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let face = this.yawG;
    if (tgt && tgt.pos.distanceTo(this.pos) < 1000) face = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
    else if (hs > 2) face = Math.atan2(this.vel.x, this.vel.z);
    this.yawG += clamp(wrap(face - this.yawG), -2*dt, 2*dt);
    if (tgt) {
      tD.copy(tgt.pos); tD.y += tgt.cy; const d = tD.distanceTo(this.pos);
      tC.subVectors(tD, this.pos); const rel = wrap(Math.atan2(tC.x, tC.z) - this.yawG);
      F.ctl.aimYaw = clamp(rel, -0.8, 0.8); F.ctl.aimPitch = clamp(Math.atan2(tC.y, Math.hypot(tC.x, tC.z)), -1.2, 1.3);
      if (d < 850 && Math.abs(rel) < 0.6 && this.gunCd <= 0) {
        this.gunCd = 0.14; F.ctl.ready = 1.5; const m = F.world('gunpod', 0, 0.05, 3.9, new V3());
        tD.addScaledVector(tgt.vel, d/760*0.8); const dir = tD.sub(m).normalize(); dir.x += rnd()*0.02; dir.y += rnd()*0.02; dir.z += rnd()*0.02;
        g.addBullet(m, dir.normalize(), 760, 9*this.def.dmg, 0xa0ffd0, 'wing', {len:6, w:0.45});
      }
      if (!mech && d > 250 && d < 1400 && this.misCd <= 0) {
        g.launchMissile(F.world('wingL', 2.4, -0.6, 0, new V3()), tC.normalize(), tgt, {team:'player', by:'wing', speed:120, max:430, turn:3, dmg:130*this.def.dmg, life:9});
        this.misCd = (6 + Math.random()*2)*this.def.mis;
      }
    } else { F.ctl.aimYaw *= 0.9; F.ctl.aimPitch *= 0.9; }
    if (mech) {
      const wt = this.onGround && hs > 1.5 ? Math.min(1, hs/16) : 0;
      F.ctl.walkAmt += (wt - F.ctl.walkAmt)*Math.min(1, dt*5);
      this.walk += dt*Math.max(hs, 6)*0.24*Math.min(1, F.ctl.walkAmt*2); F.ctl.walk = this.walk;
      F.ctl.thrust = !this.onGround && this.vel.y < 0 ? 0.8 : 0.12;
    } else { F.ctl.walkAmt = 0; F.ctl.thrust = 0.5; }
    F.root.position.copy(this.pos); if (mech) F.root.position.y -= Math.abs(Math.sin(this.walk))*0.32*F.ctl.walkAmt;
    const lf = mech ? 0 : clamp((this.vel.x*Math.sin(this.yawG) + this.vel.z*Math.cos(this.yawG))/55*0.2, -0.3, 0.3);
    F.root.rotation.set(lf, this.yawG, 0, 'YXZ'); F.update(dt);
  }
  order(o, arg){
    const R = (t) => G.hud.radio(this.name, t);
    this.orderName = o; this.extendT = 0;
    if (o === 'attack') { this.tgt = arg; R(`Copy. Engaging the ${arg.name.toLowerCase()}.`); }
    if (o === 'cover') { this.tgt = null; R('On your six. Clearing anything that comes at you.'); }
    if (o === 'move') { this.tgt = null; this.ping = arg; R(`Moving to your mark, ${Math.round(arg.pos.distanceTo(this.pos))} m out.`); }
    if (o === 'follow') { this.tgt = null; R('Forming up on you.'); }
    G.audio.radio();
  }
  hit(amt){
    if (!this.alive) return;
    this.hp -= amt;
    if (this.hp <= 0) {
      this.alive = false; this.g.fx.explosion(this.pos, 1.6); this.g.scene.remove(this.F.root);
      G.hud.radio(this.name, this.downLine || this.def.down); G.audio.boom(this.pos, 1.5);
    } else if (this.hp < this.maxHp*0.35 && !this.warned) { this.warned = true; G.hud.radio(this.name, this.def.hurt); }
  }
  update(dt){
    if (!this.alive) return;
    const g = this.g, P = g.player, W = g.world;
    this.t += dt; this.gunCd -= dt; this.misCd -= dt; this.scanT -= dt;
    let tgt = null;
    if (this.orderName === 'attack') {
      if (this.tgt && this.tgt.alive) tgt = this.tgt;
      else { this.orderName = 'cover'; if (this.tgt) G.hud.radio(this.name, 'Target down. Back on your wing.'); this.tgt = null; }
    }
    if (!tgt) {
      if (this.scanT <= 0 || (this.cur && !this.cur.alive)) {
        this.scanT = 1.5; this.cur = null;
        const anchor = this.orderName === 'move' && this.ping ? this.ping.pos : P.pos;
        let bd = this.orderName === 'cover' ? 1100 : this.orderName === 'move' ? 750 : 450;
        for (const e of g.ents) {
          if (!e.alive || e.team !== 'enemy') continue;
          let d = e.pos.distanceTo(anchor); if (e.cls === 'air') d *= 0.6; if (e.type === 'sam' || e.type === 'aa') d *= 0.8;
          if (d < bd) { bd = d; this.cur = e; }
        }
      }
      tgt = this.cur && this.cur.alive ? this.cur : null;
    } else this.cur = tgt;
    // Match the lead's mode after a short reaction delay.
    if (P.alive && P.mode !== this.mode && P.mode !== this.pendMode) { this.pendMode = P.mode; this.pendT = 0.5 + Math.random()*0.7; }
    if (this.pendMode) { this.pendT -= dt; if (this.pendT <= 0) { if (this.pendMode !== this.mode) this.setMode(this.pendMode); this.pendMode = null; } }
    if (this.mode !== 'jet') { this.groundUpdate(dt, tgt); return; }
    const des = tA, tp = tB;
    let spd = 185;
    if (this.extendT > 0) { this.extendT -= dt; des.copy(this.extDir); }
    else if (tgt) {
      tp.copy(tgt.pos); tp.y += tgt.cy; if (tgt.cls === 'air') tp.addScaledVector(tgt.vel, 0.7);
      des.subVectors(tp, this.pos);
      if (des.length() < (tgt.cls === 'air' ? 120 : 240)) { this.extendT = 3.2; this.extDir = new V3(this.dir.x, 0.5, this.dir.z).normalize(); }
    } else if (this.orderName === 'move' && this.ping) {
      const a = this.t*0.4, c = this.ping.pos;
      tp.set(c.x + Math.sin(a)*240, 0, c.z + Math.cos(a)*240); tp.y = Math.max(W.height(tp.x, tp.z), 0) + 170;
      des.subVectors(tp, this.pos);
    } else if (P.alive && P.mode === 'jet') {
      const f = P.fwd(tC); tD.set(f.z, 0, -f.x).normalize();
      tp.copy(P.pos).addScaledVector(tD, 40).addScaledVector(f, -35); tp.y += 6; tp.y = Math.max(tp.y, Math.max(W.height(tp.x, tp.z), 0.4) + 90);
      const along = tC.copy(tp).sub(this.pos).dot(f);
      spd = clamp(P.speed + along*0.8, 70, 290);
      des.copy(tp).addScaledVector(P.fwd(tC), 90).sub(this.pos);
    } else {
      const a = this.t*0.35, c = P.pos;
      tp.set(c.x + Math.sin(a)*260, c.y + 140, c.z + Math.cos(a)*260); des.subVectors(tp, this.pos);
    }
    des.normalize();
    const gh = Math.max(W.height(this.pos.x, this.pos.z), 0.4);
    let pull = this.pos.y < gh + 60;
    for (const t of [1, 2, 3.5]) { const sp = Math.max(this.speed, 100), px = this.pos.x + this.dir.x*sp*t, pz = this.pos.z + this.dir.z*sp*t; if (this.pos.y + this.dir.y*sp*t < Math.max(W.height(px, pz), 0.4) + 110) pull = true; }
    if (pull) { des.y = Math.max(des.y, 0.6); this.extendT = 0; }
    des.normalize();
    const prevYaw = Math.atan2(this.dir.x, this.dir.z), ang = this.dir.angleTo(des), maxA = (pull ? 1.6 : 1.15)*dt;
    if (ang > maxA) this.dir.lerp(des, maxA/ang).normalize(); else this.dir.copy(des);
    this.speed += clamp(spd - this.speed, -60*dt, 60*dt);
    this.vel.copy(this.dir).multiplyScalar(this.speed); this.pos.addScaledVector(this.vel, dt);
    { const fl = Math.max(W.height(this.pos.x, this.pos.z), 0.4) + 20; if (this.pos.y < fl) { this.pos.y = fl; if (this.dir.y < 0.25) { this.dir.y = 0.25; this.dir.normalize(); } } }
    if (tgt && this.extendT <= 0) {
      tC.subVectors(tp, this.pos); const d = tC.length(), a = this.dir.angleTo(tC);
      if (a < 0.07 && d < 900 && this.gunCd <= 0) {
        this.gunCd = 0.11; tC.normalize(); tC.x += rnd()*0.02; tC.y += rnd()*0.02; tC.z += rnd()*0.02;
        g.addBullet(this.pos.clone().addScaledVector(this.dir, 6), tC.normalize(), 1000 + this.speed, 8, 0xa0ffd0, 'wing', {len:7, w:0.35});
      }
      if (a < 0.35 && d > 300 && d < 1600 && this.misCd <= 0) {
        g.launchMissile(this.pos.clone().addScaledVector(this.dir, 3), this.dir, tgt, {team:'player', by:'wing', speed:this.speed, max:440, turn:3, dmg:130, life:9});
        this.misCd = 5 + Math.random()*2;
      }
    }
    const yaw = Math.atan2(this.dir.x, this.dir.z), pitch = Math.asin(clamp(this.dir.y, -1, 1));
    const turn = wrap(yaw - prevYaw)/Math.max(dt, 1e-4);
    this.roll += (clamp(-turn*0.9, -1.2, 1.2) - this.roll)*Math.min(1, dt*3);
    this.F.root.position.copy(this.pos); this.F.root.rotation.set(-pitch, yaw, this.roll, 'YXZ');
    this.F.ctl.thrust = 0.6; this.F.update(dt);
  }
};
})();
