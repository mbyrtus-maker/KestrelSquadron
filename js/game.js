(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3;
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), tP = new V3();
function segHit(a, b, c, r){
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const L2 = abx*abx + aby*aby + abz*abz; let t = L2 > 0 ? (acx*abx + acy*aby + acz*abz)/L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = abx*t - acx, py = aby*t - acy, pz = abz*t - acz;
  return px*px + py*py + pz*pz < r*r;
}
const LOS_A = new V3();
const CHAR = () => G.mat(0x1f1c1a, {r:1, m:0});

G.Game = class {
  constructor(renderer){ this.renderer = renderer; }
  start(m){
    this.m = m; const scene = this.scene = new THREE.Scene(); if (G.env) scene.environment = G.env;
    this.camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.5, 24000); this.camera.rotation.order = 'YXZ';
    const L = G.planMission(m);
    G.stationLive = false; this.world = m.space ? new G.SpaceWorld(scene, {seed:m.seed, station:m.station}) : new G.World(scene, {seed:m.seed, flats:L.flats});
    this.fx = new G.FX(scene); this.tracers = new G.Tracers(scene, 700);
    this.dying = []; this.bombsLive = [];
    this.ents = []; this.bullets = []; this.missiles = []; this.flares = []; this.civGroups = []; this.waypoints = [];
    this.ping = null; this.wave = null; this.aceT = -1; this.center = L.center;
    this.stats = {kills:0, killsMech:0, melee:0, cash:0, xp:0, collat:0, missiles:0, aaside:0, aces:0};
    this.timers = []; this.pickups = []; this.objDone = 0; this.objTotal = m.n; this.time = 0; this.complete = false; this.over = false; this.endT = -1; this.rescue = null;
    if (m.space && m.type !== 'training') {   // in orbit the Bastion flies too: sorties launch from its deck, which is solid ground like at sea
      L.carrier = true; const W = this.world, h0 = W.height.bind(W);
      W.height = (x, z) => { const cv = W.carrier; if (cv) { const lx = x - cv.x, lz = z - cv.z;
        if (lx > 29 && lx < 47 && lz > 6 && lz < 74) return cv.deck + 46; if (lx > -49 && lx < 49 && lz > -288 && lz < 304) return Math.max(h0(x, z), cv.deck); } return h0(x, z); }; }
    if (L.carrier) { this.world.carrier = G.CARRIER; this.carrierMesh = G.buildCarrier(!!m.space); this.carrierMesh.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); scene.add(this.carrierMesh); }
    this.player = new G.Player(this); this.wing = new G.Wingman(this);
    this.marks = [];
    if (m.space && !L.carrier) {   // space sorties without the Bastion start in flight, already in orbit
      const P = this.player, S = m.startAt || {x:0, y:120, z:-5200}; P.pos.set(S.x, S.y, S.z); P.yaw = S.yaw || 0; P.pitch = 0; P.speed = 190; P.vel.set(0, 0, 190); P.throttle = 0.65;
      this.wing.pos.set(S.x - 40, S.y + 6, S.z - 40); this.wing.dir.set(0, 0, 1); }
    if (m.type === 'training') { this.training = new G.Training(this); } else G.spawnMission(this, L);
    G.placeCaches(this);
    this.hullStart = this.player.hp/this.player.maxHp;
    this.resize();
    G.hud.begin(this);
    G.hud.radio('Command', `${m.title}, ${m.place}. ${m.goal}. Good hunting, ${G.save.callsign || 'Kestrel'}.`);
    if (m.story) G.storyRadio(this, 'start');
    if (L.carrier) this.intro = new G.Intro(this);
  }
  later(t, fn){ this.timers.push({t, fn}); }
  inCity(p){ return !!(this.cityZones && this.cityZones.some(z => Math.hypot(p.x - z.x, p.z - z.z) < z.r)); }
  holdRTB(){ return !!(this.hollowPending || this.ridgeScript || (this.hollow && this.hollow.alive)); }
  resize(){
    this.camera.aspect = innerWidth/innerHeight; this.camera.updateProjectionMatrix();
    this.fx.setScale(this.renderer.getPixelRatio()*innerHeight*0.5/Math.tan(35*Math.PI/180));
  }
  addBullet(pos, dir, speed, dmg, color, by, o = {}){
    this.bullets.push({pos:pos.clone(), vel:dir.clone().multiplyScalar(speed), life:o.life || 2.2, dmg, team:by === 'enemy' ? 'enemy' : 'player', by, color,
      len:o.len || 6, w:o.w || 0.4, splash:o.splash || 0, prox:o.prox || 0});
  }
  launchMissile(pos, dir, target, o){
    const mesh = G.buildMissile(o.team === 'enemy'); mesh.position.copy(pos); this.scene.add(mesh);
    this.missiles.push({pos:pos.clone(), dir:dir.clone().normalize(), speed:o.speed, max:o.max, turn:o.turn, target, dmg:o.dmg, team:o.team,
      by:o.by || 'enemy', life:o.life, groundMul:o.groundMul || 1, agm:o.agm || null, mesh, t:0, accel:o.accel || 220, kin:!!o.kin});
    if (o.agm) { mesh.scale.setScalar(1.6); mesh.traverse(x => { if (x.isMesh && x.material.color && x.material.color.getHex() === 0xd9d4c4) { x.material = x.material.clone(); x.material.color.setHex(0x5b6150); } }); }
    if (o.team === 'enemy') G.audio.shot(pos, 'missile');
  }
  update(dt){
    if (this.over) return;
    // Hit-stop: a sword connection freezes the action for a few frames so the blow lands with weight.
    if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.1; }
    if (this.intro) {
      this.intro.update(dt); this.world.follow(this.player.pos); this.fx.update(dt);
      if (!this.intro.done) return;
      this.intro = null; this.introEndT = this.time;
    }
    if (this.carrierMesh) this.carrierMesh.userData.spin.rotation.y += dt*1.4;
    this.time += dt; const P = this.player;
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); try { tm.fn(); } catch (err) { console.error(err); } } }
    P.lockedBy = 0;
    P.update(dt);
    this.world.follow(P.pos);
    this.wing.update(dt);
    for (const e of this.ents) if (e.alive && e.team === 'enemy') G.updateEnemy(this, e, dt);
    this.updateBullets(dt); this.updateMissiles(dt); this.updateBombs(dt); this.updateFlares(dt);
    this.fx.update(dt); this.tracers.draw(this.bullets);
    if (this.skyFall) G.skyFall(this, dt);
    G.updatePickups(this, dt); G.deckRepair(this, dt); G.xray(this, dt); if (this.world.space) G.spaceTick(this, dt);
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i]; d.t += dt; d.U.mixer.update(dt);
      if (d.t > 1.2 && !d.charred) { d.charred = true; d.mesh.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { m.color.multiplyScalar(0.28); if (m.emissive) m.emissive.setHex(0); } }); }
      if (d.t > 3) this.dying.splice(i, 1);
    }
    if (this.training) this.training.update(dt); else if (this.ops) this.ops.update(dt); else this.updateObjectives(dt);
    if (this.ping) { this.ping.t -= dt; if (this.ping.t <= 0) this.ping = null; }
    if (this.wave && this.wave.left > 0) {
      this.wave.cd -= dt;
      const alive = this.ents.filter(e => e.alive && e.tag === 'obj').length;
      if (alive < 2 && this.wave.cd <= 0) { this.spawnWave(); this.wave.cd = 8; }
    }
    if (this.aceT > 0) { this.aceT -= dt; if (this.aceT <= 0) this.spawnAces(); }
    P.outAO = Math.hypot(P.pos.x, P.pos.z) > 7000;
    if (G.input.pressed.has('KeyR') && P.alive) { if (this.complete && this.holdRTB()) { G.hud.flash('HOLLOW OVERHEAD · DRIVE HIM OFF FIRST'); } else if (this.complete) { this.end(true); return; } else G.hud.flash(this.ops ? 'WAYPOINTS INCOMPLETE · ESC TO ABORT' : 'OBJECTIVE INCOMPLETE · ESC TO ABORT'); }
    if (this.endT >= 0) { this.endT -= dt; if (this.endT < 0) this.end(false, this.downReason); }
  }
  updateBullets(dt){
    const P = this.player, W = this.wing, B = this.bullets;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.life -= dt; tP.copy(b.pos); b.pos.addScaledVector(b.vel, dt);
      let hit = false;
      if (b.team === 'enemy') {
        if (P.alive && segHit(tP, b.pos, P.pos, 5.5 + b.prox)) { hit = true; P.damage(b.dmg, tP.clone()); }
        else if (W.alive && segHit(tP, b.pos, W.pos, 7 + b.prox)) { hit = true; W.hit(b.dmg); }
      } else {
        for (const e of this.ents) {
          if (!e.alive) continue;
          const rr = e.r + 160;
          if (Math.abs(e.pos.x - b.pos.x) > rr || Math.abs(e.pos.z - b.pos.z) > rr) continue;
          tC.copy(e.pos); tC.y += e.cy;
          if (segHit(tP, b.pos, tC, e.r)) { this.damageEnt(e, b.dmg, b.by, {}); this.fx.spark(b.pos); hit = true; break; }
        }
      }
      if (!hit && !b.noGround && b.pos.y < this.world.height(b.pos.x, b.pos.z)) { hit = true; if (Math.random() < 0.6) this.fx.dust(b.pos); }
      if (hit && b.splash) { this.fx.explosion(b.pos, 0.4); this.splash(b.pos, b.splash, b.dmg*0.5, b.team, b.by); }
      if (hit || b.life <= 0) { B[i] = B[B.length - 1]; B.pop(); }
    }
  }
  updateMissiles(dt){
    const M = this.missiles, P = this.player; let incoming = 0;
    for (let i = M.length - 1; i >= 0; i--) {
      const m = M[i]; m.life -= dt; m.t += dt;
      if (m.team === 'enemy' && m.target === P && P.groundClutter() && m.t > 0.3) {
        m.target = null;
        if (this.time - (this.clutterT || -99) > 6) { this.clutterT = this.time; G.hud.flash('MISSILE LOST LOCK · GROUND CLUTTER'); }
      }
      const tg = m.target, live = tg && tg.alive;
      if (live) {
        tC.copy(tg.pos); if (tg.cy) tC.y += tg.cy;
        const dist = m.pos.distanceTo(tC);
        if (tg.vel) tC.addScaledVector(tg.vel, Math.min(1.2, dist/Math.max(m.speed, 1))*0.6);
        tD.subVectors(tC, m.pos).normalize();
        let turn = m.turn*(m.t < 0.25 ? 0.3 : 1);
        if (m.kin) turn *= Math.max(0.35, Math.min(1, m.speed/(m.max*0.75)));   // a slow missile turns wide: full agility only once it's up to speed
        if (m.team === 'enemy' && tg === P && P.jam) turn *= 0.62;
        const ang = m.dir.angleTo(tD), mx = turn*dt;
        if (ang > mx) m.dir.lerp(tD, mx/ang).normalize(); else m.dir.copy(tD);
        if (m.team === 'enemy' && tg === P) incoming++;
      }
      m.speed = Math.min(m.max, m.speed + m.accel*dt);
      m.pos.addScaledVector(m.dir, m.speed*dt);
      m.mesh.position.copy(m.pos); m.mesh.lookAt(tB.copy(m.pos).add(m.dir));
      this.fx.trail(m.pos, m.team === 'enemy' ? 1.2 : 0.9);
      let boom = false;
      if (live) {
        tA.copy(tg.pos); if (tg.cy) tA.y += tg.cy;
        const fuse = (tg.r || 5) + (m.team === 'enemy' ? 4 : 8) + m.speed*dt*0.5;
        if (m.pos.distanceTo(tA) < fuse) { boom = true; if (!m.agm) this.missileHit(m, tg); }
      }
      if (!boom && m.pos.y < this.world.height(m.pos.x, m.pos.z)) {
        boom = true;
        if (m.agm) {}
        else if (live && tg.def && m.pos.distanceTo(tA.copy(tg.pos)) < tg.r + 14) this.missileHit(m, tg);
        else this.splash(m.pos, 14, m.dmg*0.5, m.team, m.by);
      }
      if (!boom && m.life <= 0) boom = true;
      // Air-to-ground warheads: the cluster round bursts short of the target, the rest blast on impact.
      if (m.agm && m.agm.cluster && !boom && m.t > 0.6 && (live ? m.pos.distanceTo(tA.copy(tg.pos)) < 90 : m.pos.y - this.world.height(m.pos.x, m.pos.z) < 80)) {
        this.fx.explosion(m.pos, 0.4); G.audio.boom(m.pos, 0.4);
        for (let k = 0; k < m.agm.cluster; k++) {
          const inner = k < 5, a = (inner ? k/5 : (k - 5)/(m.agm.cluster - 5))*Math.PI*2 + Math.random()*0.5, s = inner ? 4 + Math.random()*8 : 20 + Math.random()*12;
          const sb = {pos:m.pos.clone(), vel:m.dir.clone().multiplyScalar(Math.min(m.speed, 90)).add(tC.set(Math.sin(a)*s, -10, Math.cos(a)*s)), w:m.agm, by:m.by, t:0, sub:true, mesh:G.buildBomb(m.agm, true)};
          this.scene.add(sb.mesh); this.bombsLive.push(sb);
        }
        this.scene.remove(m.mesh); M[i] = M[M.length - 1]; M.pop(); continue;
      }
      if (boom && m.agm) { if (!m.agm.cluster) this.blast(m.pos, m.agm.radius, m.dmg, m.by); else this.fx.explosion(m.pos, 0.6); this.scene.remove(m.mesh); M[i] = M[M.length - 1]; M.pop(); continue; }
      if (boom) { this.fx.explosion(m.pos, 0.65); G.audio.boom(m.pos, 0.6); this.scene.remove(m.mesh); M[i] = M[M.length - 1]; M.pop(); }
    }
    P.incoming = incoming;
  }
  dropBomb(pos, vel, w, by){
    const mesh = G.buildBomb(w); mesh.position.copy(pos); this.scene.add(mesh);
    this.bombsLive.push({pos:pos.clone(), vel:vel.clone(), w, by, mesh, t:0, sub:false});
  }
  updateBombs(dt){
    const B = this.bombsLive, W = this.world;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.t += dt; b.vel.y -= G.BOMB_G*dt; b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos); b.mesh.lookAt(tB.copy(b.pos).add(b.vel));
      const gh = Math.max(W.height(b.pos.x, b.pos.z), 0.4);
      if (b.w.cluster && !b.sub && b.pos.y - gh < 100 && b.t > 0.4) {
        // cluster opens: scatter bomblets over the area below
        this.scene.remove(b.mesh); B.splice(i, 1); this.fx.explosion(b.pos, 0.4); G.audio.boom(b.pos, 0.4);
        for (let k = 0; k < b.w.cluster; k++) {
          const inner = k < 5, a = (inner ? k/5 : (k - 5)/(b.w.cluster - 5))*Math.PI*2 + Math.random()*0.5, s = inner ? 4 + Math.random()*8 : 20 + Math.random()*12;
          const sb = {pos:b.pos.clone(), vel:b.vel.clone().add(tC.set(Math.sin(a)*s, -6, Math.cos(a)*s)), w:b.w, by:b.by, t:0, sub:true, mesh:G.buildBomb(b.w, true)};
          this.scene.add(sb.mesh); B.push(sb);
        }
        continue;
      }
      let hit = b.pos.y <= gh;
      if (!hit) for (const e of this.ents) { if (!e.alive) continue; tC.copy(e.pos); tC.y += e.cy; if (tC.distanceTo(b.pos) < e.r) { hit = true; b.hitEnt = e; break; } }
      if (hit || b.t > 30) {
        this.scene.remove(b.mesh); B.splice(i, 1);
        if (hit) this.blast(b.pos, b.w.radius, b.w.dmg, b.by);
      }
    }
  }
  blast(pos, r, dmg, by){
    this.fx.explosion(pos, Math.min(4, r/9)); G.audio.boom(pos, Math.min(2.5, r/14)); this.player.shake += Math.max(0, 1.5 - pos.distanceTo(this.player.pos)/400);
    for (const e of this.ents) {
      if (!e.alive) continue;
      tA.copy(e.pos); tA.y += e.cy*0.5; const d = Math.max(0, tA.distanceTo(pos) - e.r*0.6);
      if (d < r) this.damageEnt(e, dmg*(1 - 0.6*d/r), by, {bomb:true});
    }
    const P = this.player, dp = P.pos.distanceTo(pos); if (P.alive && dp < r) P.damage(dmg*0.12*(1 - dp/r), pos.clone(), 'blast');
    const Wg = this.wing, dw = Wg.pos.distanceTo(pos); if (Wg.alive && dw < r) Wg.hit(dmg*0.12*(1 - dw/r));
  }
  missileHit(m, tg){
    if (tg === this.player) this.player.damage(m.dmg, m.pos.clone().addScaledVector(m.dir, -10));
    else if (tg === this.wing) this.wing.hit(m.dmg);
    else if (tg.def) {
      // Missiles kill vehicles, aircraft and light buildings outright. Heavy buildings need bombs.
      if (tg.heavy) {
        this.damageEnt(tg, m.dmg*2, m.by, {});
        if (m.by === 'player' && this.time - (this.heavyT || -99) > 6) { this.heavyT = this.time; G.hud.flash('HEAVY STRUCTURE · H FOR GROUND MISSILES, OR FINISH WITH THE BLADE'); }
      } else this.damageEnt(tg, Math.max(m.dmg, tg.hp + 1), m.by, {});
      this.splash(m.pos, m.groundMul > 1 ? 30 : 16, m.dmg*(m.groundMul > 1 ? 1.6 : 0.6), m.team, m.by);
    }
  }
  updateFlares(dt){
    const F = this.flares;
    for (let i = F.length - 1; i >= 0; i--) {
      const f = F[i]; f.life -= dt; f.vel.y -= 9*dt; f.vel.multiplyScalar(1 - dt*0.8); f.pos.addScaledVector(f.vel, dt);
      this.fx.flare(f.pos);
      if (f.life <= 0) { f.alive = false; F.splice(i, 1); }
    }
  }
  // Line of sight from an enemy to its target, refreshed a few times a second.
  sees(e, tgt){
    if (this.time >= (e.losAt || 0) || e.losTgt !== tgt) {
      e.losAt = this.time + 0.25 + Math.random()*0.1; e.losTgt = tgt;
      const from = LOS_A.copy(e.pos); from.y += e.cls === 'air' ? 0 : Math.max(2.5, e.cy + 1.5);
      e.losRes = this.world.los(from, tgt.pos);
    }
    return e.losRes;
  }
  damageEnt(e, amt, by, info){
    if (!e.alive) return;
    if (e.armored) {   // the Ascendant's reactor: sealed behind its petals until the engines are gone (and the Harbinger while it transforms)
      e.hitT = 0.12; if (by === 'player' && e.type !== 'harbinger' && this.time - (this.armTip || -99) > (e.armorMsg ? 6 : 12)) { this.armTip = this.time; G.hud.flash(e.armorMsg || 'REACTOR SEALED · DESTROY THE SIX ENGINES'); G.audio.impact('metal', 0.6); }
      return;
    }
    // Heavy buildings shrug off everything but bombs: other weapons can't take them below 40%.
    if (e.type === 'reaver') {
      const melee = info && info.melee;
      if (!melee) { amt *= 0.3; if (by === 'player' && this.time - (this.reaverTip || -99) > 25) { this.reaverTip = this.time; G.hud.flash('REAVER PLATING SOAKS GUNFIRE · USE THE BLADE'); } }
      else if (e.st === 'windup') { e.st = 'stagger'; e.stT = 1.4; amt *= 1.5; if (by === 'player') { G.hud.flash('STAGGERED · STRIKE AGAIN'); G.audio.impact('metal', 1); } }
    }
    if (e.type === 'colossus') {   // the Sovereign: the blade and heavy ordnance bite deepest
      if (info && info.melee) { amt *= 1.6; if (by === 'player' && this.time - (this.svTip || -99) > 30) { this.svTip = this.time; G.hud.flash('BLADE HITS HARD · WATCH THE STOMP'); } }
      else if (info && info.bomb) amt *= 1.3;
    }
    if (e.heavy && !(info && (info.bomb || info.melee))) { amt *= 0.25; amt = Math.min(amt, Math.max(0, e.hp - e.maxHp*0.4)); if (amt <= 0) { e.hitT = 0.12; return; } }
    if (e.hpFloor) amt = Math.min(amt, Math.max(0, e.hp - e.hpFloor));   // the Harbinger can't be knocked past a phase until it transforms
    if (e.type === 'harbinger' && e.cls === 'mech' && info && (info.melee || info.bomb)) amt *= info.melee ? 1.5 : 1.3;
    e.hp -= amt; e.hitT = 0.12;
    if (e.retreatAt && e.hp > 0 && e.hp < e.maxHp*e.retreatAt) { if (by === 'player') G.hud.hitMark(false, e); G.hollowRetreat(this, e, true); return; }
    if (by === 'player') G.hud.hitMark(e.hp <= 0, e);
    if (e.hp <= 0) this.kill(e, by, info);
  }
  kill(e, by, info){
    e.alive = false;
    const s = {air:1.6, ground:1.3, mech:1.7, struct:2.4, building:2.0}[e.cls] || 1;
    const c = e.pos.clone(); c.y += e.cy;
    this.fx.explosion(c, s); G.audio.boom(c, s);
    if (e.team === 'enemy' && !e.part) G.maybeDrop(this, e, c);
    if (e.part) { e.mesh.traverse(o => { if (o.isMesh) o.material = CHAR(); }); if (e.mesh.userData.head) e.mesh.userData.head.rotation.x = 0.6;   // wrecked part stays on the hull, smoking
      this.fx.burner(c, e.type === 'skyengine' ? 200 : 60);
      if (e.type === 'skyengine' && e.carrier && e.carrier.alive) { const n = e.carrier.parts.filter(p => p.type === 'skyengine' && p.alive).length; G.hud.flash(n ? `ENGINE DOWN · ${n} LEFT` : 'LAST ENGINE DOWN'); } }
    else if (e.type === 'skycarrier') { e.falling = true; this.skyFall = {e, t:0, boomT:0}; for (const p of e.parts || []) if (p.alive) { p.alive = false; p.mesh.traverse(o => { if (o.isMesh) o.material = CHAR(); }); }
      G.hud.flash('THE ASCENDANT IS GOING DOWN'); this.player.shake += 2; }
    else if (e.type === 'harbinger') {   // it falls where it stands, burning, in a chain of blasts
G.hud.flash('THE HARBINGER IS DOWN');       e.mesh.traverse(o => { if (o.isMesh) o.material = CHAR(); }); this.fx.burner(c, 200);
      const gy = Math.max(this.world.height(e.pos.x, e.pos.z), 0), m = e.mesh, x0 = m.rotation.x;
      for (let i = 0; i <= 30; i++) this.later(i*0.06, () => { const k = i/30; m.rotation.x = x0 - k*k*1.4; m.position.y = e.pos.y + (gy + 8 - e.pos.y)*k*k; });
      for (let i = 1; i <= 7; i++) this.later(i*0.3, () => { const p = e.pos.clone(); p.x += (Math.random() - 0.5)*40; p.z += (Math.random() - 0.5)*40; p.y = gy + 6 + Math.random()*30; this.fx.explosion(p, 1.4 + Math.random()); G.audio.boom(p, 1.3); this.player.shake += 0.6; });
      this.later(2.4, () => { const p = e.pos.clone(); p.y = gy + 12; this.fx.explosion(p, 3.4); G.audio.boom(p, 2.2); this.player.shake += 2.2; });
      this.later(4, () => G.hud.radio(G.OFFICER ? G.OFFICER.short : 'Bastion', 'The Harbinger is down. Kestrel... the Varn high command just asked for terms.'));
    }
    else if (e.cls === 'air') this.scene.remove(e.mesh);
    else if (e.mesh.userData.mixer) {
      // Animated walker: play its death, then darken the hull where it fell.
      const U = e.mesh.userData; U.play('Death', 0.15); this.dying.push({U, t:0, mesh:e.mesh});
      this.fx.burner(c, 16);
    } else {
      e.mesh.traverse(o => { if (o.isMesh) o.material = CHAR(); });
      if (e.cls === 'mech') { e.mesh.rotation.x = (Math.random() < 0.5 ? 1 : -1)*1.35; e.mesh.rotation.z = (Math.random() - 0.5)*0.6; e.mesh.position.y += 2.2; }   // walkers topple
      else e.mesh.scale.y *= e.cls === 'struct' || e.cls === 'building' ? 0.3 : 0.6;
      if (e.blocker) e.blocker.top = e.blocker.base + e.blocker.h*0.3;
      this.fx.burner(c, e.cls === 'struct' || e.cls === 'building' ? 120 : 55);
    }
    if (this.player.sticky === e) this.player.sticky = null;
    if (e.team === 'neutral') {
      this.stats.collat++;
      if (this.time - (this.lastCollat || -99) > 8) { this.lastCollat = this.time; G.hud.radio('Command', 'Check fire! Civilian building down.'); }
      return;
    }
    if ((by === 'player' || by === 'wing') && !this.training) {
      // Close-quarters bonus: blade kills inside a city pay double.
      const cq = by === 'player' && info && info.melee && this.inCity(e.pos), cash = e.def.cash*(cq ? 2 : 1), xp = e.def.xp*(cq ? 2 : 1);
      this.stats.cash += cash; this.stats.xp += xp; G.hud.feed(cq ? e.name + ' · blade x2' : e.name, cash, by);
    }
    if (by === 'player') {
      this.stats.kills++;
      if (this.player.mode === 'mech') this.stats.killsMech++;
      if (info && info.melee) this.stats.melee++;
    }
    if (by === 'wing' && Math.random() < 0.5) { const L = this.wing.def.splash; G.hud.radio(this.wing.name, L[Math.floor(Math.random()*L.length)]); }
    if (e.boss) { G.hud.flash(`${(e.name || 'Hollow').toUpperCase()} DOWN`); G.hud.radio(e.name || 'Hollow', e.lastWords || 'Not... like this...'); }
    if (e.type === 'colossus') {   // the Sovereign comes apart in a chain of blasts before it falls
      G.hud.flash('THE SOVEREIGN IS DOWN');
      for (let i = 1; i <= 6; i++) this.later(i*0.35, () => { const p = e.pos.clone(); p.x += (Math.random() - 0.5)*30; p.z += (Math.random() - 0.5)*30; p.y += 10 + Math.random()*35; this.fx.explosion(p, 1.4 + Math.random()); G.audio.boom(p, 1.3); this.player.shake += 0.6; });
      this.later(2.6, () => { const p = e.pos.clone(); p.y += 20; this.fx.explosion(p, 3.2); G.audio.boom(p, 2); this.player.shake += 2; });
      this.later(4, () => G.hud.radio(G.OFFICER ? G.OFFICER.short : 'Bastion', 'It’s down. Kestrel, it’s down. Every Varn radio on the atoll just went quiet.'));
    }
    if (this.ops) this.ops.onKill(e); else if (e.tag === 'obj' && !this.training) this.objDone++;
    if (e.tag === 'aaside') this.stats.aaside++;
    if (e.tag === 'ace') this.stats.aces++;
  }
  splash(pos, r, dmg, team, by){
    if (team === 'enemy') {
      const P = this.player, W = this.wing;
      const d = P.pos.distanceTo(pos); if (P.alive && d < r + 5) P.damage(dmg*(1 - d/(r + 5)), pos.clone());
      const dw = W.pos.distanceTo(pos); if (W.alive && dw < r + 6) W.hit(dmg*(1 - dw/(r + 6)));
    } else {
      for (const e of this.ents) {
        if (!e.alive) continue;
        tA.copy(e.pos); tA.y += e.cy; const d = tA.distanceTo(pos) - e.r;
        if (d < r) this.damageEnt(e, dmg*(1 - Math.max(0, d)/r), by, {});
      }
    }
  }
  updateObjectives(dt){
    const m = this.m, P = this.player;
    this.rescue = null;
    if (m.type === 'rescue') {
      for (const g of this.civGroups) {
        if (g.done) continue;
        if (Math.random() < dt*8) this.fx.green(tA.set(g.pos.x + 6, g.pos.y + 4, g.pos.z));
        const hd = Math.hypot(P.pos.x - g.pos.x, P.pos.z - g.pos.z), hs = Math.hypot(P.vel.x, P.vel.z);
        if (hd < 60 && P.alive) {
          if (P.mode !== 'jet' && P.agl < 8 && hs < 22) {
            g.prog += dt*(P.mode === 'mech' ? 2 : 1); this.rescue = {p:g.prog/5, hold:true};
            if (g.prog >= 5) {
              g.done = true; this.objDone++; this.scene.remove(g.mesh); G.audio.chime();
              for (let i = 0; i < 40; i++) this.fx.green(g.pos);
              G.hud.radio('Civilians', `Everyone's aboard. Thank you, ${G.save.callsign || 'Kestrel'}! (${this.objDone}/${this.objTotal})`);
            }
          } else this.rescue = {p:g.prog/5, hold:false};
        } else if (g.prog > 0) g.prog = Math.max(0, g.prog - dt*0.5);
      }
    }
    if (m.type === 'recon') {
      this.waypoints.forEach((w, i) => {
        if (w.done) return;
        const hd = Math.hypot(P.pos.x - w.pos.x, P.pos.z - w.pos.z);
        if (hd < 95 && P.pos.y - w.pos.y < 150 && P.alive) {
          w.done = true; this.objDone++; G.audio.chime();
          G.hud.radio('Command', `Site ${i + 1} imaged. ${this.objTotal - this.objDone} to go.`);
        }
      });
    }
    if (!this.complete && this.objDone >= this.objTotal) {
      this.complete = true; G.audio.chime(); G.hud.flash('OBJECTIVE COMPLETE');
      G.hud.radio('Command', 'Objective complete. Clean up side objectives or press R to return to base.');
    }
  }
  sideStatus(s){
    const st = this.stats, P = this.player;
    switch (s.key) {
      case 'time': return this.time <= s.param ? (this.complete ? 'ok' : 'pending') : 'fail';
      case 'wingman': return this.wing.alive ? 'pending' : 'fail';
      case 'hull': return (this.hullStart - P.hp/P.maxHp) < 0.35 ? 'pending' : 'fail';
      case 'melee': return st.melee >= 2 ? 'ok' : 'pending';
      case 'mechkills': return st.killsMech >= 4 ? 'ok' : 'pending';
      case 'aa': return st.aaside >= 3 ? 'ok' : 'pending';
      case 'ace': return st.aces >= 3 ? 'ok' : 'pending';
      case 'collat': return st.collat === 0 ? 'pending' : 'fail';
      case 'nomissile': return st.missiles === 0 ? 'pending' : 'fail';
      case 'hollow': return st.hollowDriven ? 'ok' : 'pending';
    }
    return 'pending';
  }
  sideFinal(s){
    const v = this.sideStatus(s);
    if (v !== 'pending') return v;
    return ['wingman', 'hull', 'collat', 'nomissile'].includes(s.key) ? 'ok' : 'fail';
  }
  playerDown(kind){
    const P = this.player; if (!P.alive) return;
    P.alive = false; this.fx.explosion(P.pos, 2.4); this.fx.burner(P.pos, 8); G.audio.boom(P.pos, 2.2);
    P.F.root.visible = false; P.view = 'chase'; G.hud.setView('chase');
    this.endT = 3.2;
    this.downReason = kind === 'crash' ? 'Crashed into terrain' : kind === 'fall' ? 'Frame destroyed on impact' : 'Shot down';
    G.hud.radio('Command', `${G.save.callsign || 'Kestrel 1'} is down! Search and rescue is inbound.`);
  }
  end(success, reason){
    if (this.over) return;
    this.over = true;
    const m = this.m, st = this.stats, P = this.player, s = G.save;
    const lines = []; let cash = 0, xp = 0;
    if (success) { lines.push({label:'Mission reward', cash:m.reward, xp:m.xp}); cash += m.reward; xp += m.xp; }
    const bc = success ? st.cash : Math.round(st.cash*0.5), bx = success ? st.xp : Math.round(st.xp*0.5);
    lines.push({label:`Combat bounties${success ? '' : ' (50% on a failed sortie)'}`, cash:bc, xp:bx}); cash += bc; xp += bx;
    if (st.collat) { const pen = st.collat*250; lines.push({label:`Collateral damage: ${st.collat} building${st.collat > 1 ? 's' : ''}`, cash:-pen, xp:0}); cash -= pen; }
    const sides = m.sides.map(sd => {
      const ok = success && this.sideFinal(sd) === 'ok';
      if (ok) { cash += sd.cash; xp += sd.xp; }
      return {label:G.sideLabel(sd), ok, cash:sd.cash, xp:sd.xp};
    });
    let story = null;
    if (m.story) {
      const grade = G.storyGrade(success, sides.map(x => x.ok));
      if (grade === 'perfect') { lines.push({label:'Commendation: perfect mission', cash:m.perfectBonus, xp:Math.round(m.xp*0.25)}); cash += m.perfectBonus; xp += Math.round(m.xp*0.25); }
      story = {node:m.story, grade, out:G.storyOutcome(m.story, grade)};
    }
    const before = s.level;
    s.credits = Math.max(0, s.credits + cash);
    const ups = G.addXP(Math.max(0, xp));
    // Aborting resets the frame to how it launched: no new hull damage, nothing to repair.
    if (!this.aborted) s.damage = P.alive ? Math.min(1, Math.max(0, 1 - P.hp/P.maxHp)) : 1;
    s.sorties++; if (success) s.wins++; s.kills += st.kills;
    if (m.type === 'training' && success) s.trained = true;
    s.board = G.genBoard(); G.persist();
    const unlocked = [];
    if (ups) for (const cat in G.WEAPONS) for (const w of G.WEAPONS[cat]) if (w.lvl > before && w.lvl <= s.level) unlocked.push(w.name);
    for (const f of G.FRAMES) if (f.lvl > before && f.lvl <= s.level) unlocked.push(f.name + ' (for purchase)');
    G.audio.loops(null, true);
    G.ui.debrief({success, reason: reason || (success ? 'Objective complete' : 'Sortie aborted'), title:m.title, place:m.place, lines, sides, cash, xp,
      ups, level:s.level, time:this.time, kills:st.kills, hull:s.damage, unlocked, wingAlive:this.wing.alive, wingName:this.wing.name, story});
  }
  render(){
    const r = this.renderer; r.render(this.scene, this.camera);
    const P = this.player, F = P && P.F, k = F && P.mode === 'mech' && !this.over ? (F.shieldK || 0) : 0;
    if (k > 0.02 && F.P.shield) this.renderXray(k);
    if (this.xrOn) {   // enemy outlines (layer 1) go on last, over the shield's scan view and everything else
      const ac = r.autoClear, su = r.shadowMap.autoUpdate; r.autoClear = false; r.shadowMap.autoUpdate = false;
      this.camera.layers.set(1); r.render(this.scene, this.camera); this.camera.layers.set(0); r.autoClear = ac; r.shadowMap.autoUpdate = su; }
  }
  /* Raised shield: the solid shield stays where it is, and the part of the view it blocks is redrawn as a
     radar-style polygon view of what's behind it (terrain and buildings in cyan, enemies in red). */
  renderXray(k){
    const r = this.renderer, cam = this.camera, sc = this.scene, F = this.player.F, W = this.world;
    const X = this.xray || (this.xray = (() => {
      const st = {stencilWrite:true, stencilRef:1, stencilFunc:THREE.EqualStencilFunc, stencilFail:THREE.KeepStencilOp, stencilZFail:THREE.KeepStencilOp, stencilZPass:THREE.KeepStencilOp};
      const fade = m => { m.onBeforeCompile = sh => {
        sh.vertexShader = 'varying float vXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vXZ = -mvPosition.z;');
        sh.fragmentShader = 'varying float vXZ;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.a *= 1.0 - smoothstep(220.0, 1500.0, vXZ);\n#include <dithering_fragment>'); }; return m; };
      const wire = (c, skin, add = true) => fade(Object.assign(new THREE.MeshBasicMaterial({color:c, wireframe:true, transparent:true, fog:false, depthWrite:true, blending:add ? THREE.AdditiveBlending : THREE.NormalBlending}), st, {skinning:!!skin}));
      // Scan grid: surfaces drawn as faint fill with 9 m world-space grid lines, like a terrain radar return.
      const grid = skin => { const m = Object.assign(new THREE.MeshBasicMaterial({color:0x2fb8e8, transparent:true, fog:false, depthWrite:true, blending:THREE.AdditiveBlending, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1}), st, {skinning:!!skin});
        m.onBeforeCompile = sh => {
          sh.vertexShader = 'varying vec3 vWP; varying float vXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
            vXZ = -mvPosition.z; vec4 wq = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              wq = instanceMatrix*wq;
            #endif
            vWP = (modelMatrix*wq).xyz;`);
          sh.fragmentShader = 'varying vec3 vWP; varying float vXZ;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `
            vec3 q = vWP/9.0; vec3 gd = abs(fract(q - 0.5) - 0.5)/max(fwidth(q), vec3(1e-4));
            float ln = 1.0 - clamp(min(min(gd.x, gd.y), gd.z), 0.0, 1.0);
            gl_FragColor = vec4(diffuse*(0.35 + 1.1*ln), opacity*(0.1 + 0.75*ln)*(1.0 - smoothstep(220.0, 1500.0, vXZ)));
            #include <dithering_fragment>`); };
        return m; };
      const mask = new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:false, depthTest:false, stencilWrite:true, stencilRef:1, stencilFunc:THREE.AlwaysStencilFunc, stencilZPass:THREE.ReplaceStencilOp, stencilFail:THREE.ReplaceStencilOp, stencilZFail:THREE.ReplaceStencilOp});
      const maskSkin = mask.clone(); maskSkin.skinning = true;
      const tint = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), Object.assign(new THREE.MeshBasicMaterial({color:0x031a22, transparent:true, depthTest:false, depthWrite:false, fog:false}), st));
      const scan = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.012), Object.assign(new THREE.MeshBasicMaterial({color:0x5fe3ff, transparent:true, depthTest:false, depthWrite:false, fog:false, blending:THREE.AdditiveBlending}), st));
      const ui = new THREE.Scene(); ui.add(tint); ui.add(scan);
      return {mask, maskSkin, world:wire(0x46d8ff), worldSkin:wire(0x46d8ff, true), grid:grid(false), gridSkin:grid(true), foe:wire(0xff3b2b, false, false), foeSkin:wire(0xff3b2b, true, false), tint, scan, ui, ocam:new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1), swap:[], hide:[]};
    })());
    const ac = r.autoClear, su = r.shadowMap.autoUpdate; r.autoClear = false; r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = false;
    const swapIn = (root, a, b) => root.traverse(o => { if (o.isMesh && o.visible) { X.swap.push(o, o.material); o.material = o.isSkinnedMesh ? b : a; } });
    const swapOut = () => { for (let i = 0; i < X.swap.length; i += 2) X.swap[i].material = X.swap[i + 1]; X.swap.length = 0; };
    let pass = 0;
    try {
      pass = 1; // 1. Shield silhouette -> stencil.
      r.clearStencil(); swapIn(F.P.shield, X.mask, X.maskSkin); r.render(F.P.shield, cam); swapOut();
      // 2. Darken the shield area, with a sweeping scan line.
      X.tint.material.opacity = 0.86*k; X.scan.material.opacity = 0.7*k; X.scan.position.y = ((this.time*0.9)%1)*2.4 - 1.2;
      pass = 2; r.render(X.ui, X.ocam); pass = 3;
      // 3. Everything behind it as a polygon wireframe.
      r.clearDepth();
      const foes = this.ents.filter(e => e.alive && e.team === 'enemy' && e.mesh && e.mesh.visible && e.pos.distanceToSquared(this.player.pos) < 2.6e6);
      for (const c of sc.children) if (c.visible && (c === F.root || c === W.sky || c.isPoints || c.isLine || c.isSprite || (c.material && (c.material.transparent || c.material.fog === false)))) { X.hide.push(c); c.visible = false; }
      for (const e of foes) { X.hide.push(e.mesh); e.mesh.visible = false; }
      X.world.opacity = X.worldSkin.opacity = 0.75*k; X.foe.opacity = X.foeSkin.opacity = k;
      const extra = [];
      sc.traverseVisible(o => {
        if (o === sc) return;
        if (o.isMesh && !o.isSprite && o.material && !Array.isArray(o.material) && !o.material.transparent && o.material.fog !== false) { X.swap.push(o, o.material); o.material = o.isSkinnedMesh ? X.worldSkin : X.world; }
        else if (o.isMesh || o.isPoints || o.isLine || o.isSprite) extra.push(o);
      });
      for (const o of extra) { X.hide.push(o); o.visible = false; }
      const fog = sc.fog; sc.fog = null;
      X.grid.opacity = X.gridSkin.opacity = k; X.world.opacity = X.worldSkin.opacity = 0.45*k;
      for (let i = 0; i < X.swap.length; i += 2) X.swap[i].material = X.swap[i].isSkinnedMesh ? X.gridSkin : X.grid;
      r.render(sc, cam);
      for (let i = 0; i < X.swap.length; i += 2) X.swap[i].material = X.swap[i].isSkinnedMesh ? X.worldSkin : X.world;
      r.render(sc, cam); sc.fog = fog; swapOut();
      for (const c of X.hide) c.visible = true; X.hide.length = 0;
      // 4. Enemies on top in red, so they read through cover too.
      pass = 4; r.clearDepth();
      for (const e of foes) { swapIn(e.mesh, X.foe, X.foeSkin); r.render(e.mesh, cam); swapOut(); }
    } catch (err) { console.error('xray pass ' + pass, err); swapOut(); for (const c of X.hide) c.visible = true; X.hide.length = 0; }
    r.autoClear = ac; r.shadowMap.autoUpdate = su;
  }
  dispose(){
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.scene = null;
  }
};


/* ---------- Field repairs ----------
   Repair canisters: a destroyed supply depot or command post always leaves one, anything else sometimes (bosses always).
   A canister floats where the wreck fell under a tall green beacon for 50 s; fly or walk through it (within 45 m) to restore
   30% of the hull. Each pilot sees and collects their own (in co-op the guest's game drops its own when the host reports a kill).
   Deck repair: hover or stand within 600 m of the Bastion, below 300 m, and the deck crews patch 6% of the hull a second. */
const PICK_GEO = {}, PV = new V3();
G.maybeDrop = (game, e, at) => {
  const always = /^(depot|command)$/.test(e.type) || e.bossBar || e.boss;
  const chance = always ? 1 : e.cls === 'air' ? 0.1 : e.cls === 'struct' || e.cls === 'building' ? 0.3 : 0.14;
  if (Math.random() > chance) return;
  const W = game.world, gy = Math.max(W.height(at.x, at.z), 0), y = e.cls === 'air' ? Math.max(at.y, gy + 40) : gy + 6;
  G.makePickup(game, at.x, y, at.z, {life:50});
};
// Supply caches: every mission and map starts with at least two permanent canisters placed between the start and the
// fight. A taken cache is replaced elsewhere after a while, so there are always two out there to fall back on.
G.placeCache = (game, i, n) => {
  const P = game.player, W = game.world, en = game.ents.filter(e => e.alive && e.team === 'enemy');
  const tx = en.length ? en.reduce((a, e) => a + e.pos.x, 0)/en.length : (game.center ? game.center.x : P.pos.x);
  const tz = en.length ? en.reduce((a, e) => a + e.pos.z, 0)/en.length : (game.center ? game.center.z : P.pos.z + 3000);
  const ty = en.length ? en.reduce((a, e) => a + e.pos.y, 0)/en.length : P.pos.y;
  let dx = tx - P.pos.x, dz = tz - P.pos.z; const d = Math.hypot(dx, dz);
  if (d < 900) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
  const span = Math.max(d, 1800), f = n > 1 ? 0.3 + 0.4*i/(n - 1) : 0.5, side = (i % 2 ? 1 : -1)*(450 + Math.random()*350);
  for (let tries = 0; tries < 12; tries++) {
    const j = tries*90, x = P.pos.x + dx*span*f - dz*side + (Math.random() - 0.5)*j, z = P.pos.z + dz*span*f + dx*side + (Math.random() - 0.5)*j;
    let y;
    if (W.space) { y = P.pos.y + (ty - P.pos.y)*f + 40; if (G.stationSolid && G.stationSolid(new THREE.Vector3(x, y, z), 30)) continue; }
    else { const gy = W.height(x, z); if (gy > 900) continue; y = Math.max(gy, 0) + 6; }
    if (game.pickups.some(k => k.pos.distanceTo(new THREE.Vector3(x, y, z)) < 400)) continue;
    return G.makePickup(game, x, y, z, {cache:true});
  }
  return G.makePickup(game, P.pos.x + dx*span*f, W.space ? P.pos.y + 40 : Math.max(W.height(P.pos.x + dx*span*f, P.pos.z + dz*span*f), 0) + 6, P.pos.z + dz*span*f, {cache:true});
};
G.placeCaches = game => {
  const n = 2; for (let i = 0; i < n; i++) G.placeCache(game, i, n);
  const S = G.STATION; if (game.world.space && G.stationLive && S) G.makePickup(game, S.x + 60, S.y - S.hh + 14, S.z - 60, {cache:true, inside:true});
};
G.makePickup = (game, x, y, z, o = {}) => {
  if (!PICK_GEO.box) { PICK_GEO.box = new THREE.BoxGeometry(3.2, 2.2, 3.2); PICK_GEO.band = new THREE.BoxGeometry(3.3, 0.5, 3.3); PICK_GEO.beam = new THREE.CylinderGeometry(0.7, 0.7, 160, 8, 1, true);
    PICK_GEO.mBox = new THREE.MeshStandardMaterial({color:0xdfe6e2, roughness:0.5, metalness:0.3}); PICK_GEO.mBand = new THREE.MeshBasicMaterial({color:0x4dff8a});
    PICK_GEO.mBeam = new THREE.MeshBasicMaterial({color:0x4dff8a, transparent:true, opacity:0.28, depthWrite:false, blending:THREE.AdditiveBlending}); }
  const g = new THREE.Group(), box = new THREE.Mesh(PICK_GEO.box, PICK_GEO.mBox); g.add(box); g.add(new THREE.Mesh(PICK_GEO.band, PICK_GEO.mBand));
  const beam = new THREE.Mesh(PICK_GEO.beam, PICK_GEO.mBeam); beam.position.y = 80; g.add(beam);
  if (o.cache) g.scale.setScalar(1.5);
  g.position.set(x, y, z); game.scene.add(g); const k = {g, pos:g.position, t:0, life:o.cache ? Infinity : o.life || 50, amt:0.3, cache:!!o.cache, inside:!!o.inside};
  game.pickups.push(k); return k;
};
G.updatePickups = (game, dt) => {
  const P = game.player;
  for (const k of game.pickups) {
    k.t += dt; k.g.rotation.y += dt*1.5; k.g.children[0].position.y = Math.sin(k.t*2)*0.6;
    if (k.t > k.life - 5) k.g.visible = Math.floor(k.t*6) % 2 === 0;   // blinks before it expires
    if (P.alive && P.pos.distanceTo(k.pos) < 45) {
      k.done = true; const add = P.maxHp*k.amt; P.hp = Math.min(P.maxHp, P.hp + add);
      P.mis = Math.min(P.maxMis, P.mis + Math.ceil(P.maxMis*0.5)); P.bombs = Math.min(P.maxBombs, P.bombs + Math.ceil(P.maxBombs*0.5));
      P.flares = Math.min(P.st.flares, P.flares + Math.ceil(P.st.flares*0.5)); if (P.F && P.F.setMissiles) P.F.setMissiles(P.mis/P.maxMis);
      G.hud.flash(`HULL REPAIRED +${Math.round(k.amt*100)}% · AMMO RESUPPLIED`);
      if (k.cache && !k.inside) game.later(60, () => { if (!game.over) { G.placeCache(game, Math.floor(Math.random()*2), 2); G.hud.radio('Bastion', 'Fresh supply cache dropped. Look for the green beacon.'); } }); G.audio.tone(660, 0.18, 'sine', 0.07, 990); G.audio.tone(990, 0.22, 'sine', 0.05, 1320);
    }
    if (k.done || k.t > k.life) game.scene.remove(k.g);
  }
  game.pickups = game.pickups.filter(k => !k.done && k.t <= k.life);
};
G.deckRepair = (game, dt) => {
  const P = game.player, C = G.CARRIER; if (!P.alive || !game.carrierMesh || P.mode === 'jet' || P.hp >= P.maxHp || game.over) { game.deckFix = false; return; }
  const near = Math.hypot(P.pos.x - C.x, P.pos.z - C.z) < 600 && P.pos.y < C.deck + 300;
  if (!near) { game.deckFix = false; return; }
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp*0.06*dt);
  if (!game.deckFix) { game.deckFix = true; G.hud.flash('DECK CREWS REPAIRING · HOLD STATION'); }
  if (P.hp >= P.maxHp) G.hud.flash('HULL FULLY REPAIRED');
};

/* ---------- Shield x-ray ----------
   With the mech's shield raised it fills the view ahead, so every enemy within 1.6 km is drawn as a glowing red edge
   outline on top of everything. Edge lines are built once per enemy (a few per frame), shared per geometry, and fade
   with the shield. */
const XRM = new THREE.LineBasicMaterial({color:0xff5a3c, transparent:true, opacity:0, depthTest:false, depthWrite:false, fog:false});
G.xray = (game, dt) => {
  const P = game.player, on = P.alive && P.mode === 'mech' && P.block > 0.3;
  const want = on ? Math.min(1, P.block*1.2) : 0; XRM.opacity += (want*0.9 - XRM.opacity)*Math.min(1, dt*10);
  if (XRM.opacity < 0.02 && !on) { if (game.xrOn) { for (const e of game.ents) if (e.xr) for (const l of e.xr) l.visible = false; game.xrOn = false; } return; }
  game.xrOn = true; let built = 0;
  for (const e of game.ents) {
    if (!e.alive || e.team !== 'enemy' || !e.mesh) { if (e.xr) for (const l of e.xr) l.visible = false; continue; }
    const vis = on && PV.copy(e.pos).sub(P.pos).lengthSq() < 1600*1600;
    if (vis && !e.xr && built < 3) {
      built++; e.xr = [];
      e.mesh.traverse(o => {
        if (!o.isMesh || o.isSkinnedMesh || !o.geometry || o.material === XRM) return;
        const gd = o.geometry; if (!gd.userData.edges) gd.userData.edges = new THREE.EdgesGeometry(gd, 32);
        const l = new THREE.LineSegments(gd.userData.edges, XRM); l.layers.set(1); l.frustumCulled = false; l.raycast = () => {}; o.add(l); e.xr.push(l);
      });
      if (!e.xr.length) {   // animated (skinned) models: a box around them instead
        const B = new THREE.Box3().setFromObject(e.mesh), sz = B.getSize(new V3()), l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sz.x, sz.y, sz.z)), XRM);
        l.layers.set(1); l.frustumCulled = false; B.getCenter(l.position); e.mesh.worldToLocal(l.position); l.scale.divide(e.mesh.scale); e.mesh.add(l); e.xr.push(l); }
    }
    if (e.xr) for (const l of e.xr) l.visible = vis;
  }
};
})();
