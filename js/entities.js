(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3;

G.ETYPES = {
  tank:{hp:240, r:4.5, cy:1.6, cash:120, xp:16, cls:'ground', name:'Battle tank'},
  apc:{hp:160, r:4.5, cy:1.6, cash:90, xp:12, cls:'ground', name:'APC'},
  aa:{hp:200, r:4.5, cy:1.8, cash:150, xp:20, cls:'ground', name:'Flak track'},
  sam:{hp:220, r:5, cy:2, cash:220, xp:28, cls:'ground', name:'SAM launcher'},
  fighter:{hp:150, r:7, cy:0, cash:260, xp:34, cls:'air', name:'Varn fighter'},
  mech:{hp:520, r:8, cy:8, cash:300, xp:40, cls:'mech', name:'Varn walker'},
  reaver:{hp:460, r:9, cy:9, cash:380, xp:50, cls:'mech', name:'Varn Reaver'},
  colossus:{hp:3800, r:17, cy:19, cash:4000, xp:600, cls:'mech', name:'The Sovereign'},
  // The Ascendant (volume 2 boss). The hull's hit sphere is only its reactor under the belly; its parts are separate targets.
  skycarrier:{hp:4200, r:22, cy:-21, cash:6000, xp:800, cls:'air', name:'The Ascendant'},
  skyflak:{hp:380, r:6, cy:2, cash:300, xp:40, cls:'air', name:'Flak turret'},
  skymis:{hp:600, r:7, cy:3, cash:420, xp:55, cls:'air', name:'Missile battery'},
  skyengine:{hp:1300, r:12, cy:0, cash:800, xp:90, cls:'air', name:'Lift engine'},
  // The Harbinger (volume 3 boss): a transforming heavy bomber three times a Kestrel's size. Its hit sphere and class change with its mode.
  harbinger:{hp:4800, r:19, cy:0, cash:0, xp:950, cls:'air', name:'The Harbinger'},
  bunker:{hp:520, r:9, cy:2, cash:160, xp:18, cls:'struct', name:'Bunker'},
  hangar:{hp:900, r:15, cy:6, cash:260, xp:30, cls:'struct', name:'Hangar'},
  tower:{hp:380, r:7, cy:12, cash:180, xp:20, cls:'struct', name:'Comms tower'},
  depot:{hp:300, r:10, cy:4, cash:150, xp:16, cls:'struct', name:'Fuel depot'},
  command:{hp:1200, r:15, cy:6, cash:400, xp:45, cls:'struct', name:'Command post'},
  civ:{hp:300, r:10, cy:10, cash:0, xp:0, cls:'building', name:'Civilian building'}
};

G.spawn = function(game, type, x, z, o = {}){
  const def = G.ETYPES[type], civ = type === 'civ';
  const mesh = civ ? G.buildBuilding(o.w, o.h, o.d, o.tint) : G.buildEnemy(type, {ace:o.tag === 'ace', v:o.v});
  const gh = game.world.height(x, z);
  const mul = civ ? 1 : (1 + 0.09*(G.save.level - 1))*(0.85 + 0.15*game.m.tier);
  const e = {type, def, cls:def.cls, team: civ ? 'neutral' : 'enemy', mesh, name: o.name || def.name,
    pos:new V3(x, o.alt !== undefined ? o.alt : Math.max(gh, 0), z), vel:new V3(), yaw: o.yaw ?? Math.random()*6.283,
    hp:def.hp*mul, maxHp:def.hp*mul, r:o.r || def.r, cy: civ ? o.h/2 : def.cy, alive:true, tag:o.tag || null,
    cd:1 + Math.random()*3, lockT:0, path:o.path || null, pathI:o.pathI || 0, home:new V3(x, 0, z), t:Math.random()*100,
    burst:0, burstCd:0, dir:null, breakT:0, vy:0, hitT:0, dmgMul:mul, w:o.w, d:o.d, h:o.h};
  e.heavy = type === 'hangar' || type === 'command' || type === 'bunker' || (civ && o.h > 30);
  if (civ) { e.r = Math.max(o.w, o.d)*0.55 + o.h*0.15; e.hp = e.maxHp = 300 + o.h*8; e.blocker = game.world.addBlocker({x, z, hw:o.w/2 + 0.6, hd:o.d/2 + 0.6, top:e.pos.y + o.h + 1, base:e.pos.y, h:o.h}); }
  mesh.position.copy(e.pos); mesh.rotation.y = e.yaw;
  mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  game.scene.add(mesh); game.ents.push(e);
  return e;
};

/* ---------- Mission layout (decided before terrain is built) ---------- */
G.planMission = function(m){
  const r = G.rng(m.seed + 99), ang = r()*Math.PI*2, dist = 500 + r()*650;
  const C = {x:Math.sin(ang)*dist, z:Math.cos(ang)*dist + 450};
  const L = {center:C, flats:[], r, groups:[], path:null};
  if (m.type === 'training') L.center = {x:0, z:0};
  if (m.type === 'base') L.flats.push({x:C.x, z:C.z, r:260});
  if (m.type === 'city') L.flats.push({x:C.x, z:C.z, r:430});
  if (m.type === 'rescue') for (let i = 0; i < m.n; i++) {
    const a = r()*Math.PI*2, d = 200 + r()*650, g = {x:C.x + Math.sin(a)*d, z:C.z + Math.cos(a)*d};
    L.groups.push(g); L.flats.push({x:g.x, z:g.z, r:70});
  }
  if (m.type === 'convoy') {
    const a = r()*Math.PI, dx = Math.sin(a), dz = Math.cos(a), pts = [];
    for (let i = 0; i <= 6; i++) { const t = -700 + i*233; pts.push({x:C.x + dx*t + (r() - 0.5)*160, z:C.z + dz*t + (r() - 0.5)*160}); }
    L.path = pts.concat(pts.slice(1, -1).reverse());
    for (const p of pts) L.flats.push({x:p.x, z:p.z, r:60});
  }
  return L;
};

/* Dry ground near (x, z): walks outward in rings until the ground is above 3 m, or null within max metres. */
G.landAt = (W, x, z, max = 600) => { if (W.height(x, z) > 3) return [x, z];
  for (let d = 15; d <= max; d += 15) for (let k = 0, n = Math.max(8, Math.round(d/8)); k < n; k++) { const a = k/n*Math.PI*2, px = x + Math.sin(a)*d, pz = z + Math.cos(a)*d; if (W.height(px, pz) > 3) return [px, pz]; }
  return null; };
G.spawnMission = function(game, L){
  const m = game.m, n = m.n, r = L.r, C = L.center, tier = m.tier, W = game.world;
  const around = (cx, cz, a0, a1) => { const a = r()*Math.PI*2, d = a0 + r()*(a1 - a0); return [cx + Math.sin(a)*d, cz + Math.cos(a)*d]; };
  const sp = (type, cx, cz, a0, a1, o) => {
    let x, z;
    for (let i = 0; i < 14; i++) { [x, z] = around(cx, cz, a0, a1); if (W.height(x, z) > 3 || type === 'fighter') return G.spawn(game, type, x, z, o); }
    const L = G.landAt(W, x, z) || G.landAt(W, cx, cz, 1200) || [x, z]; return G.spawn(game, type, L[0], L[1], o);
  };
  const air = (type, cx, cz, tag) => { const [x, z] = around(cx, cz, 100, 500); return G.spawn(game, type, x, z, {alt:W.height(x, z) + 450 + r()*250, tag}); };
  game.objTotal = n;

  switch (m.type) {
    case 'convoy': {
      const P = L.path.map(p => new V3(p.x, 0, p.z));
      for (let i = 0; i < n; i++) {
        const b = P[0], d = new V3().subVectors(P[1], P[0]).normalize();
        G.spawn(game, i % 3 === 2 ? 'apc' : 'tank', b.x - d.x*i*26, b.z - d.z*i*26, {path:P, pathI:1, tag:'obj'});
      }
      for (let i = 0; i < 1 + (tier > 1); i++) G.spawn(game, 'aa', P[0].x - 20 - i*30, P[0].z - 20, {path:P, pathI:1});
      for (let i = 0; i < tier; i++) sp('tank', C.x, C.z, 100, 500);
      if (tier === 3) sp('sam', C.x, C.z, 300, 700);
      break;
    }
    case 'base': {
      const order = ['command', 'hangar', 'hangar', 'tower', 'depot', 'bunker', 'bunker', 'depot', 'bunker', 'tower', 'hangar', 'bunker'];
      const spots = [[0, 0], [-95, 45], [95, 45], [0, -115], [-115, -80], [115, -80], [-45, 130], [60, 130], [160, -10], [-160, -10], [0, 190], [-170, 100]];
      for (let i = 0; i < n; i++) { const s = spots[i % spots.length], L = G.landAt(W, C.x + s[0], C.z + s[1], 300) || G.landAt(W, C.x, C.z, 1200) || [C.x + s[0], C.z + s[1]]; G.spawn(game, order[i % order.length], L[0], L[1], {tag:'obj', yaw:(r() < 0.5 ? 0 : Math.PI/2)}); }
      for (let i = 0; i < 2 + tier; i++) { const a = i/(2 + tier)*Math.PI*2, L = G.landAt(W, C.x + Math.sin(a)*200, C.z + Math.cos(a)*200, 160); if (L) G.spawn(game, 'aa', L[0], L[1]); }   // no flak in the sea
      for (let i = 0; i < 1 + tier; i++) sp('tank', C.x, C.z, 60, 220);
      if (tier >= 2) sp('sam', C.x, C.z, 230, 300);
      if (tier === 3) { sp('mech', C.x, C.z, 50, 200); sp('mech', C.x, C.z, 50, 200); }
      break;
    }
    case 'rescue': {
      for (const g of L.groups) {
        const mesh = G.buildCivilians(), y = W.height(g.x, g.z); mesh.position.set(g.x, y, g.z); game.scene.add(mesh);
        game.civGroups.push({pos:new V3(g.x, y, g.z), prog:0, done:false, mesh});
        sp('tank', g.x, g.z, 70, 140); sp(tier >= 2 ? 'mech' : 'tank', g.x, g.z, 70, 160);
      }
      for (let i = 0; i < tier; i++) sp('aa', C.x, C.z, 100, 600);
      break;
    }
    case 'city': {
      const tints = [0xffffff, 0xf2e6d8, 0xdfe7ef, 0xf0d9c8, 0xe0e0d0];
      for (let gx = -6; gx <= 6; gx++) for (let gz = -6; gz <= 6; gz++) {
        const x = gx*62, z = gz*62; if (Math.hypot(x, z) > 380 || r() > 0.78) continue;
        const w = 18 + r()*20, d = 18 + r()*20, h = 10 + r()*(Math.hypot(x, z) < 160 ? 55 : 25);
        G.spawn(game, 'civ', C.x + x, C.z + z, {w, d, h, tint:tints[Math.floor(r()*tints.length)], yaw:0});
      }
      const kinds = ['tank', 'mech', 'aa', 'tank', 'apc', 'mech'];
      for (let i = 0; i < n; i++) {
        const gx = Math.floor(r()*10) - 5, gz = Math.floor(r()*10) - 5, alongX = r() < 0.5;
        const x = C.x + (alongX ? gx*62 + (r() - 0.5)*40 : gx*62 + 31), z = C.z + (alongX ? gz*62 + 31 : gz*62 + (r() - 0.5)*40);
        G.spawn(game, kinds[i % kinds.length], x, z, {tag:'obj'});
      }
      if (tier >= 2) sp('sam', C.x, C.z, 480, 650);
      break;
    }
    case 'air': {
      game.wave = {left:n, cd:0, C};
      for (let i = 0; i < tier; i++) sp('aa', C.x, C.z, 50, 500);
      break;
    }
    case 'mech': {
      for (let i = 0; i < n; i++) sp('mech', C.x, C.z, 60, 520, {tag:'obj'});
      for (let i = 0; i < tier + 1; i++) sp('tank', C.x, C.z, 60, 500);
      for (let i = 0; i < tier; i++) sp('aa', C.x, C.z, 100, 600);
      break;
    }
    case 'sam': {
      for (let i = 0; i < n; i++) { const s = sp('sam', C.x, C.z, 150, 1100, {tag:'obj'}); if (tier >= 2) sp('aa', s.pos.x, s.pos.z, 30, 70); }
      sp('tank', C.x, C.z, 100, 500); sp('tank', C.x, C.z, 100, 500);
      break;
    }
    case 'recon': {
      for (let i = 0; i < n; i++) { const [x, z] = around(C.x, C.z, 50, 1150); game.waypoints.push({pos:new V3(x, W.height(x, z), z), done:false}); sp('aa', x, z, 120, 260); }
      for (let i = 0; i < tier - 1; i++) sp('sam', C.x, C.z, 200, 900);
      if (tier === 3) { air('fighter', C.x, C.z); air('fighter', C.x, C.z); }
      break;
    }
  }
  for (const s of m.sides) {
    if (s.key === 'aa') for (let i = 0; i < 3; i++) sp('aa', C.x, C.z, 250, 900, {tag:'aaside'});
    if (s.key === 'ace') game.aceT = 50;
  }
  for (let i = 0; i < 3; i++) sp('tank', 0, 0, 300, 2000);
  game.spawnWave = () => {
    const w = game.wave, k = Math.min(3 + (tier > 2 ? 1 : 0), w.left);
    for (let i = 0; i < k; i++) air('fighter', w.C.x, w.C.z, 'obj');
    w.left -= k;
    G.hud.radio('Command', `${k} bandits inbound over the objective.`);
  };
  game.spawnAces = () => {
    for (let i = 0; i < 3; i++) { const e = air('fighter', C.x, C.z, 'ace'); e.name = 'Varn ace'; e.hp *= 1.8; e.maxHp = e.hp; e.ace = true; }
    G.hud.radio(game.wing.alive ? game.wing.name : 'Bastion', 'Three fast movers, red tails. Those are aces.');
  };
};

/* ---------- Enemy AI ---------- */
const tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), UP = new V3(0, 1, 0);
const TA = new V3(), TQ = new THREE.Quaternion();
function pickTarget(game, e, range, airOnly){
  const P = game.player, W = game.wing; let best = null, bd = range;
  if (e.onlyP) return P.alive && e.pos.distanceTo(P.pos) < range ? P : null;
  if (e.zone) {
    // Ground units tied to a waypoint only fight inside that waypoint's area.
    const zr = 1500, inZ = t => Math.hypot(t.pos.x - e.zone.x, t.pos.z - e.zone.z) < zr;
    if (P.alive && (!airOnly || !P.groundClutter()) && inZ(P)) { const d = e.pos.distanceTo(P.pos)*0.8; if (d < bd) { bd = d; best = P; } }
    if (W.alive && inZ(W)) { const d = e.pos.distanceTo(W.pos); if (d < bd) { bd = d; best = W; } }
    return best;
  }
  if (P.alive && (!airOnly || !P.groundClutter())) { const d = e.pos.distanceTo(P.pos)*0.8; if (d < bd) { bd = d; best = P; } }
  if (W.alive) { const d = e.pos.distanceTo(W.pos); if (d < bd) { bd = d; best = W; } }
  return best;
}
G.pickTarget = pickTarget;

function shoot(game, e, from, tgt, speed, dmg, o = {}){
  if (e.noFire) return;
  const dist = from.distanceTo(tgt.pos), lead = (o.lead ?? 0.7)*dist/speed;
  if (tgt === game.player && tgt.mode === 'mech') o.err = (o.err || 4)*1.7;   // a mech on the ground is a small, hard target
  tmp.copy(tgt.pos).addScaledVector(tgt.vel, lead);
  tmp.x += (Math.random() - 0.5)*(o.err || 4); tmp.y += (Math.random() - 0.5)*(o.err || 4); tmp.z += (Math.random() - 0.5)*(o.err || 4);
  const v = tmp.sub(from).normalize().multiplyScalar(speed);
  game.bullets.push({pos:from.clone(), vel:v.clone(), life:o.life || 4, dmg:dmg*e.dmgMul*0.9, team:'enemy', by:'enemy', color:o.color || 0xff8a5a,
    len:o.len || 4, w:o.w || 0.5, splash:o.splash || 0, prox:o.prox || 0, noGround:!!e.noTerrain});
}

/* SAM sites and flak tracks can't track a mech in ground clutter, but their crews carry a close-in machine gun:
   inside 650 m with a clear line of sight they hose the mech with short bursts. */
function smallArms(game, e, dt){
  const P = game.player;
  if (e.saCd === undefined) { e.saCd = 0.6 + Math.random()*1.6; e.saT = 0; e.saRof = 0; }
  e.saCd -= dt;
  if (e.saT > 0) {
    e.saT -= dt; e.saRof -= dt;
    const tur = e.mesh.userData.turret; if (tur) tur.rotation.y = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z) - e.yaw;
    if (e.saRof <= 0 && P.alive) {
      e.saRof = 0.085;
      if (game.sees(e, P)) {
        const s = Math.random() < 0.5 ? 1 : -1, c = Math.cos(e.yaw), sn = Math.sin(e.yaw);
        shoot(game, e, tmp2.set(e.pos.x + c*1.6*s, e.pos.y + 3.1, e.pos.z - sn*1.6*s), P, 700, 6.5, {err:4 + e.pos.distanceTo(P.pos)*0.011, color:0xfff0b0, len:2.6, w:0.26, lead:1, life:1.6});
        G.audio.shot(e.pos, 'mg');
      }
    }
    return true;
  }
  if (!P.alive || !P.groundClutter() || e.saCd > 0) return false;
  if (e.zone && Math.hypot(P.pos.x - e.zone.x, P.pos.z - e.zone.z) > 1500) return false;
  if (e.pos.distanceTo(P.pos) > 650 || !game.sees(e, P)) { e.saCd = 0.4; return false; }
  e.saT = 0.9 + Math.random()*0.6; e.saCd = 2 + Math.random()*1.5;
  if (game.time - (game.smallArmsT ?? -99) > 12) { game.smallArmsT = game.time; G.hud.flash('SMALL ARMS FIRE · AA CREWS ENGAGING'); }
  return true;
}

/* ---------- The Ascendant (volume 2 boss) ----------
   A flying carrier circling the battle at about 650 m. Its parts are separate enemies riding on its mesh:
   flak turrets (bursts of airburst rounds), missile batteries (homing salvos) and six lift engines.
   The reactor under the belly sits behind armoured petals: it takes no damage until every engine is gone; then the petals open,
   the carrier slows, sags and lists, and the reactor can be shot. The bow hangar launches pairs of fighters throughout.
   Flying into the hull hurts and bounces you off. */
const SK = new V3(), SK2 = new V3();
G.updateSkyCarrier = function(game, e, dt){
  const S = e.sc, U = e.mesh.userData, P = game.player;
  if (e.falling) return;
  const eng = e.parts.filter(p => p.type === 'skyengine' && p.alive).length;
  // orbit: slower and lower as engines die
  const sp = eng ? 26 + 3*eng : 12; S.alt += ((S.alt0 - (6 - eng)*30) - S.alt)*Math.min(1, dt*0.3);
  S.ang += sp/S.R*dt;
  e.pos.set(S.cx + Math.sin(S.ang)*S.R, S.alt + Math.sin(e.t*0.4)*3, S.cz + Math.cos(S.ang)*S.R);
  e.yaw = Math.atan2(Math.cos(S.ang), -Math.sin(S.ang));
  const roll = -0.06 + (6 - eng)*0.024 + (eng ? 0 : Math.sin(e.t*0.7)*0.03), pitch = eng ? 0 : 0.03;
  e.mesh.position.copy(e.pos); e.mesh.rotation.set(pitch, e.yaw, roll);
  e.mesh.updateMatrixWorld(true);
  for (const p of e.parts) { p.mesh.getWorldPosition(p.pos); p.yaw = e.yaw; }
  // exposure
  if (!S.exposed && eng === 0) {
    S.exposed = true; e.armored = false; e.noLock = false;
    G.hud.flash('REACTOR EXPOSED · HIT THE BELLY'); G.audio.boom(e.pos, 1.6); P.shake += 0.8;
    G.hud.radio(G.OFFICER.short, 'All six engines are gone! She’s sagging. The armour under the belly just opened. That glow is the reactor. Put everything you have into it!');
  }
  if (U.petals) for (const ph of U.petals) ph.rotation.x += ((S.exposed ? -1.25 : 0) - ph.rotation.x)*Math.min(1, dt*1.5);
  if (U.glow) U.glow.emissiveIntensity = (S.exposed ? 2.6 : 1.0) + Math.sin(e.t*(S.exposed ? 8 : 2))*(S.exposed ? 0.8 : 0.2);
  // fighter launches from the bow hangar
  S.launchCd -= dt;
  if (S.launchCd <= 0 && !e.noFire) {
    const out = game.ents.filter(x => x.alive && x.fromCarrier).length;
    S.launchCd = (S.exposed ? 10 : 15)*S.launchMul;
    if (out < S.cap) {
      U.bay.getWorldPosition(SK); const fwd = SK2.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      for (let k = 0; k < 2; k++) { const f = G.spawn(game, 'fighter', SK.x + fwd.z*k*12, SK.z - fwd.x*k*12, {alt:SK.y - 4}); f.fromCarrier = true; f.dir = fwd.clone(); f.zone = null; }
      G.hud.flash('FIGHTERS LAUNCHING'); G.audio.tone(320, 0.5, 'square', 0.05, 200);
    }
  }
  // the hull is solid: bounce the player off it
  if (P.alive) {
    SK.copy(P.pos); e.mesh.worldToLocal(SK);
    if (Math.abs(SK.x) < 32 && SK.y > -22 && SK.y < 17 && Math.abs(SK.z) < 116) {
      const up = SK.y > 0; SK.y = up ? 18 : -23; e.mesh.localToWorld(SK); P.pos.copy(SK);
      P.vel.y = up ? Math.abs(P.vel.y) + 18 : -Math.abs(P.vel.y) - 18; if (P.speed !== undefined) P.speed *= 0.7;
      P.damage(60, e.pos.clone(), 'impact'); P.shake += 0.6; G.hud.flash('HULL CONTACT');
    }
  }
};
// The carrier's death: it noses over and falls into the sea in a chain of blasts, then sinks.
G.skyFall = function(game, dt){
  const F = game.skyFall, e = F.e, m = e.mesh; F.t += dt;
  const vy = Math.min(70, 6 + F.t*9); e.pos.y -= vy*dt; e.pos.x += Math.sin(e.yaw)*14*dt; e.pos.z += Math.cos(e.yaw)*14*dt;
  m.position.copy(e.pos); m.rotation.x = Math.min(0.45, m.rotation.x + dt*0.05); m.rotation.z += dt*0.03;
  F.boomT -= dt;
  if (F.boomT <= 0 && !F.splashed) { F.boomT = 0.35 + Math.random()*0.4; SK.set((Math.random() - 0.5)*60, (Math.random() - 0.3)*30, (Math.random() - 0.5)*200); m.localToWorld(SK);
    game.fx.explosion(SK.clone(), 1.6 + Math.random()*1.4); G.audio.boom(SK, 1.4); }
  const sea = Math.max(game.world.height(e.pos.x, e.pos.z), 0);
  if (!F.splashed && e.pos.y < sea + 20) { F.splashed = true;
    for (let i = 0; i < 8; i++) { SK.set((Math.random() - 0.5)*80, 0, (Math.random() - 0.5)*220); m.localToWorld(SK); SK.y = sea + 4; game.fx.explosion(SK.clone(), 3 + Math.random()*1.5); }
    G.audio.boom(e.pos, 2.4); game.player.shake += 2.5;
    game.later(2.5, () => G.hud.radio(G.OFFICER.short, 'She’s in the sea. The Ascendant is gone. Kestrel... every ship in the fleet is sounding its horn.')); }
  if (F.splashed && e.pos.y < sea - 70) { game.scene.remove(m); game.skyFall = null; }
};
G.updateSkyPart = function(game, e, dt){
  const C = e.carrier, U = e.mesh.userData;
  if (!C || !C.alive || C.falling) return;
  if (U.fan) U.fan.rotation.y += dt*(e.alive ? 7 : 0);
  if (e.type === 'skyengine' || e.noFire) return;
  const tgt = G.pickTarget(game, e, e.type === 'skyflak' ? 1500 : 2400, false); if (!tgt) return;
  // aim the head at the target in the mount's own frame
  if (U.head) { SK.copy(tgt.pos); U.head.parent.worldToLocal(SK); U.head.rotation.y += (Math.atan2(SK.x, SK.z) - U.head.rotation.y)*Math.min(1, dt*3); }
  if (e.type === 'skyflak') {
    if (e.burst > 0) { e.burst -= dt; e.burstCd -= dt;
      if (e.burstCd <= 0) { e.burstCd = 0.11; U.muzzle.getWorldPosition(SK2); shoot(game, e, SK2.clone(), tgt, 560, 14, {color:0xffc070, len:4, w:0.9, err:16, splash:9}); } }
    else if ((e.cd -= dt) <= 0) { e.burst = 0.7; e.cd = 2.2 + Math.random()*1.5; G.audio.shot(e.pos, 'bolt'); }
  } else if ((e.cd -= dt) <= 0) {   // missile battery: a pair, then reload
    e.cd = 7 + Math.random()*3;
    for (let k = 0; k < 2; k++) game.later(k*0.25, () => { if (!e.alive) return; game.launchMissile(e.pos.clone().add(SK.set(0, 4, 0)), SK2.set((Math.random() - 0.5)*0.5, 1, (Math.random() - 0.5)*0.5).normalize().clone(), tgt, {team:'enemy', speed:130, max:300, turn:1.8, dmg:85*e.dmgMul, life:11}); G.audio.missile(); });
  }
};

/* ---------- The Sovereign (chapter 6 boss) ----------
   Slow, heavy walker that always faces its target. Four attacks, each telegraphed:
   beam cannon (capacitor rings glow for 1.5 s, then a 1.4 s stream of heavy bolts), shoulder missile salvo (pods pitch up first),
   talon rotary bursts between the big attacks, and a stomp shockwave when a grounded mech or hover gets inside 80 m (leg lifts for 0.9 s).
   Below half health it vents its core, calls two Reavers once, and everything cycles faster. */
const SV = new V3(), SV2 = new V3();
G.updateSovereign = function(game, e, dt){
  const W = game.world, P = game.player, U = e.mesh.userData;
  if (!e.sv) e.sv = {beamCd:4, misCd:8, gunCd:2, stompCd:3, st:'idle', stT:0, burst:0, ph:1, walk:0};
  const S = e.sv, ph2 = e.hp < e.maxHp*0.5, fast = ph2 ? 0.65 : 1;
  if (ph2 && S.ph === 1) {
    S.ph = 2; G.hud.flash('SOVEREIGN · CORE VENTING'); G.audio.boom(e.pos, 1.4); game.fx.explosion(SV.copy(e.pos).setY(e.pos.y + 40), 1.6);
    G.hud.radio(G.OFFICER ? G.OFFICER.short : 'Bastion', 'Its core is venting. It’s hurt, Kestrel, and it’s calling for help. Finish it!');
    for (let k = 0; k < 2; k++) { const a = e.yaw + (k ? 1 : -1)*1.2, x = e.pos.x + Math.sin(a)*90, z = e.pos.z + Math.cos(a)*90;
      if (W.height(x, z) > 0) { const r = G.spawn(game, 'reaver', x, z, {}); r.zone = e.zone; } }
  }
  const tgt = G.pickTarget(game, e, 2200, false), vis = tgt ? game.sees(e, tgt) : false;
  let moving = false, d = 1e9;
  if (tgt) {
    SV.set(tgt.pos.x - e.pos.x, 0, tgt.pos.z - e.pos.z); d = SV.length();
    // turn toward the target at a heavy, readable rate
    let dy = Math.atan2(SV.x, SV.z) - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    e.yaw += Math.max(-dt*0.7, Math.min(dt*0.7, dy));
    if (S.st === 'idle' && !e.frozen && d > 420) { SV.multiplyScalar(1/d); const nx = e.pos.x + SV.x*7*dt, nz = e.pos.z + SV.z*7*dt; if (W.height(nx, nz) > 0) { e.pos.x = nx; e.pos.z = nz; moving = true; } }
  }
  S.beamCd -= dt; S.misCd -= dt; S.gunCd -= dt; S.stompCd -= dt; if (S.st !== 'idle') S.stT -= dt;
  const grounded = P.alive && P.mode !== 'jet' && P.pos.y - Math.max(W.height(P.pos.x, P.pos.z), 0) < 30;
  const pd = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  if (S.st === 'idle' && tgt && !e.noFire) {
    if (grounded && pd < 80 && S.stompCd <= 0) { S.st = 'stomp'; S.stT = 0.9; G.hud.flash('STOMP · GET CLEAR'); G.audio.tone(70, 0.9, 'sawtooth', 0.12, 40); }
    else if (vis && S.beamCd <= 0 && d < 1700) { S.st = 'charge'; S.stT = 1.5; G.audio.tone(180, 1.5, 'sawtooth', 0.09, 900); if (tgt === P) G.hud.flash('BEAM CHARGING'); }
    else if (vis && S.misCd <= 0 && d < 2000) { S.st = 'salvo'; S.stT = 1.2; S.fired = 0; }
  }
  // beam: charge glow, then stream
  if (S.st === 'charge') { U.beamM.emissiveIntensity = 0.3 + 4*(1 - S.stT/1.5); if (S.stT <= 0) { S.st = 'beam'; S.stT = 1.4; S.bCd = 0; G.audio.shot(e.pos, 'shell'); } }
  else if (S.st === 'beam') {
    U.beamM.emissiveIntensity = 4 + Math.random()*1.5; S.bCd -= dt;
    if (tgt && S.bCd <= 0) { S.bCd = 0.055; U.muzzle.getWorldPosition(SV2);
      shootFrom(game, e, SV2, tgt, 760, 16, {color:0xff4a20, len:12, w:2.2, err:3.5, lead:0.6, splash:5}); }
    if (S.stT <= 0) { S.st = 'idle'; S.beamCd = 7.5*fast; U.beamM.emissiveIntensity = 0.3; }
  } else if (U.beamM.emissiveIntensity > 0.3 && S.st !== 'charge') U.beamM.emissiveIntensity = Math.max(0.3, U.beamM.emissiveIntensity - dt*6);
  // missile salvo: pods pitch up, then launch one missile every 0.18 s
  if (S.st === 'salvo') {
    const n = ph2 ? 8 : 5, k = 1 - S.stT/1.2;
    if (U.pods) U.pods.forEach(p => p.rotation.x = -0.35 - 0.6*Math.min(1, k*3));
    if (k > 0.3 && S.fired < n && tgt && (S.mCd = (S.mCd || 0) - dt) <= 0) { S.mCd = 0.16;
      const pod = U.pods[S.fired % 2]; pod.getWorldPosition(SV2); SV2.y += 4;
      game.launchMissile(SV2.clone(), SV.set((Math.random() - 0.5)*0.4, 1, (Math.random() - 0.5)*0.4).normalize(), tgt, {team:'enemy', speed:125, max:300, turn:1.7, dmg:95*e.dmgMul, life:11});
      S.fired++; G.audio.missile(); }
    if (S.stT <= 0 && S.fired >= n) { S.st = 'idle'; S.misCd = 11*fast; if (U.pods) U.pods.forEach(p => p.rotation.x = -0.35); }
    else if (S.stT <= -2) { S.st = 'idle'; S.misCd = 11*fast; }
  }
  // stomp: raise a leg, slam, shockwave
  if (S.st === 'stomp') {
    const k = Math.max(0, S.stT/0.9);
    if (U.legs) for (const i of [0, 1]) U.legs[i].rotation.x = -0.4*(1 - k)*(S.stT > 0 ? 1 : 0);   // rears up on its front legs
    if (S.stT <= 0) {
      S.st = 'idle'; S.stompCd = 8*fast; if (U.legs) for (const L of U.legs) L.rotation.x = 0;
      const c = SV2.set(e.pos.x, Math.max(W.height(e.pos.x, e.pos.z), 0) + 2, e.pos.z);
      game.fx.explosion(c, 1.8); for (let i = 0; i < 10; i++) { const a = i/10*6.283; game.fx.dust(SV.set(c.x + Math.sin(a)*45, c.y, c.z + Math.cos(a)*45)); }
      G.audio.boom(c, 1.6); P.shake = (P.shake || 0) + 2.5;
      if (grounded && pd < 85) { P.damage(170*e.dmgMul*(1 - pd/100), c.clone(), 'blast');
        SV.set(P.pos.x - e.pos.x, 0, P.pos.z - e.pos.z).normalize(); P.vel.x += SV.x*55; P.vel.z += SV.z*55; P.vel.y += 22; }
      { const Wg = game.wing, wd = Math.hypot(Wg.pos.x - e.pos.x, Wg.pos.z - e.pos.z);   // the wingman (or a co-op guest) gets stomped too
        if (Wg.alive && Wg.mode !== 'jet' && Wg.pos.y - Math.max(W.height(Wg.pos.x, Wg.pos.z), 0) < 30 && wd < 85) Wg.hit(170*e.dmgMul*(1 - wd/100)); }
    }
  }
  // talon rotary: short bursts whenever nothing bigger is happening
  if (S.st === 'idle' && tgt && vis && !e.noFire && d < 1300) {
    if (S.burst > 0) { S.burst -= dt; S.rCd = (S.rCd || 0) - dt;
      if (S.rCd <= 0) { S.rCd = 0.08; S.side = !S.side; const gun = S.side && U.gun2 ? U.gun2 : U.gun; gun.getWorldPosition(SV2);   // rotary and twin autocannon trade shots
        shootFrom(game, e, SV2, tgt, gun === U.gun ? 620 : 700, gun === U.gun ? 9 : 12, {color:gun === U.gun ? 0xffb070 : 0xffd080, len:5, w:0.8, err:9}); } }
    else if (S.gunCd <= 0) { S.burst = 1.3; S.gunCd = 3.2*fast; G.audio.shot(e.pos, 'bolt'); }
  }
  // gait, core pulse, arm aim
  const gh = Math.max(W.height(e.pos.x, e.pos.z), -1); e.pos.y = gh;
  if (moving) { S.walk += dt*2.2; if (Math.sin(S.walk) * Math.sin(S.walk - dt*2.2) < 0) { G.audio.boom(e.pos, 0.5); P.shake = (P.shake || 0) + (pd < 400 ? 0.4 : 0); } }
  if (U.legs && S.st !== 'stomp') U.legs.forEach((L, i) => {   // four legs in diagonal pairs: lift, swing, plant
    const ph = S.walk + (i === 0 || i === 3 ? 0 : Math.PI), lift = moving ? Math.max(0, Math.sin(ph))*0.22 : 0;
    L.rotation.x += (-lift - L.rotation.x)*Math.min(1, dt*8); L.rotation.y = (L.userData.yaw0 || 0) + (moving ? Math.cos(ph)*0.1*(i < 2 ? 1 : -1) : 0); });
  if (U.hull) { U.hull.position.y = 7.4 + (moving ? Math.abs(Math.sin(S.walk))*0.25 : 0); U.hull.rotation.z = moving ? Math.sin(S.walk)*0.03 : 0; }
  if (U.glow) U.glow.emissiveIntensity = (ph2 ? 2.6 : 1.2) + Math.sin(e.t*(ph2 ? 9 : 3))*(ph2 ? 0.9 : 0.3);
  if (U.fores && tgt) { const up = Math.atan2((tgt.pos.y + (tgt.cy || 0)) - (e.pos.y + 30), Math.max(d, 1)); U.fores.forEach(f => f.rotation.x += (Math.max(-0.9, Math.min(0.5, -up)) - f.rotation.x)*Math.min(1, dt*3)); }
  e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw;
};

/* ---------- The Harbinger (volume 3 boss) ----------
   Three phases, one per mode, each ending at a third of its health (damage can't carry it past a phase until it has transformed):
   JET: big bombing runs at about 280 m over the target, strings of bombs, a dorsal gun that covers its tail, and missile pairs.
   HOVER: hangs 110 m up and circles the target at 420 m, raking it with its gun pod and firing six-missile salvos.
   MECH: lands on solid ground and walks at the target, firing heavy shells and missiles, and stomps anything grounded inside 110 m.
   Each transformation takes 1.6 s, during which it is armoured and doesn't fire. */
const HB = new V3(), HB2 = new V3(), HB3 = new V3();
G.HARB_MODES = ['jet', 'hover', 'mech'];
G.harbSetMode = (e, mode) => {   // shared by the host and co-op guests
  const F = e.mesh.userData.F; e.fm = mode; F.setMode(mode);
  e.cls = mode === 'mech' ? 'mech' : 'air'; e.r = mode === 'mech' ? 16 : mode === 'hover' ? 17 : 19; e.cy = mode === 'mech' ? 9 : 0;
};
G.updateHarbinger = function(game, e, dt){
  const W = game.world, P = game.player, U = e.mesh.userData, F = U.F, m = e.mesh;
  if (!e.hb) { e.hb = {st:'run', stT:0, pt:null, bombCd:0, gunCd:3, misCd:8, burst:0, burstCd:0, tailCd:2, tf:0, orb:Math.random()*6.28, stompCd:4, stomp:0, walk:0, dir:new V3(Math.sin(e.yaw), 0, Math.cos(e.yaw)), spd:120, roll:0};
    m.rotation.order = 'YXZ'; G.harbSetMode(e, 'jet'); F.setMode('jet', true); }
  const S = e.hb, C = e.hc || e.home, gh = (x, z) => Math.max(W.height(x, z), 0);
  const tgt = G.pickTarget(game, e, 3500, false), fire = !e.noFire && !game.over;
  // phase change when health reaches the floor
  const frac = e.hp/e.maxHp;
  if (S.tf <= 0 && ((e.fm === 'jet' && e.hp <= e.maxHp*0.667 + 0.5) || (e.fm === 'hover' && e.hp <= e.maxHp*0.334 + 0.5 && S.landed))) {
    const next = e.fm === 'jet' ? 'hover' : 'mech'; S.tf = 1.6; e.armored = true; G.harbSetMode(e, next); S.st = next;
    G.hud.flash(`THE HARBINGER IS TRANSFORMING · ${next.toUpperCase()} MODE`); G.audio.transform(next); G.audio.tone(70, 1.0, 'sawtooth', 0.06, 50); P.shake += 0.5;
    G.hud.radio(G.OFFICER.short, next === 'hover' ? 'It’s changing shape! Kestrel, it’s stopping in mid-air. Watch that gun pod.' : 'It’s landing. It’s standing up. Kestrel, that thing is the size of a building. Keep moving and stay off the ground near its feet.');
    if (next === 'mech') { for (let i = 0; i < 10; i++) { const a = i/10*6.283; game.fx.dust(HB.set(e.pos.x + Math.sin(a)*30, gh(e.pos.x, e.pos.z), e.pos.z + Math.cos(a)*30)); } G.audio.boom(e.pos, 1.6); P.shake += 1.2; }
  }
  if (e.fm === 'hover' && e.hp <= e.maxHp*0.334 + 0.5 && !S.landed && S.st !== 'descend') { S.st = 'descend'; G.hud.flash('THE HARBINGER IS LOOKING FOR GROUND · ARMOUR HOLDING'); }
  if (S.tf > 0) { S.tf -= dt; if (S.tf <= 0) e.armored = false; }
  e.hpFloor = e.fm === 'jet' ? e.maxHp*0.667 : e.fm === 'hover' ? e.maxHp*0.334 : 0;
  const ctl = F.ctl; ctl.walkAmt = 0; ctl.thrust = 0.5;
  if (e.fm === 'jet') {
    // fly: bombing runs over the target (or the waypoint), then extend and come round again
    const rx = S.pt ? S.pt.x - e.pos.x : 0, rz = S.pt ? S.pt.z - e.pos.z : 0, rd = Math.hypot(rx, rz);
    if (S.st === 'run') S.runT = (S.runT || 0) + dt;
    if (!S.pt || S.st === 'run' && (rd < 140 || (rd < 400 && rx*S.dir.x + rz*S.dir.z < 0) || S.runT > 25)) {   // the point is overhead, passed abeam, or the run has gone on too long
      if (S.pt) { S.st = 'extend'; S.stT = 7; } S.runT = 0;
      const T = tgt && Math.hypot(tgt.pos.x - C.x, tgt.pos.z - C.z) < 2500 ? tgt.pos : C; S.pt = {x:T.x, z:T.z};
    }
    if (S.st === 'extend' && (S.stT -= dt) <= 0) { S.st = 'run'; const T = tgt ? tgt.pos : C; S.pt = {x:T.x, z:T.z}; }
    const alt = gh(e.pos.x, e.pos.z) + 280, des = HB;
    if (S.st === 'run') des.set(S.pt.x - e.pos.x, 0, S.pt.z - e.pos.z).normalize(); else des.copy(S.dir).setY(0).normalize();
    des.y = Math.max(-0.3, Math.min(0.3, (alt - e.pos.y)/300));
    // turn at a fixed rate (half a radian a second), always the same way when the target is dead astern
    const y0 = Math.atan2(S.dir.x, S.dir.z); let err = Math.atan2(des.x, des.z) - y0; err = Math.atan2(Math.sin(err), Math.cos(err)); if (Math.abs(err) > 3.0) err = Math.abs(err);
    const dy = Math.max(-0.5*dt, Math.min(0.5*dt, err)), ny = y0 + dy, hz = Math.sqrt(Math.max(0, 1 - des.y*des.y));
    S.dir.y += (des.y - S.dir.y)*Math.min(1, dt*0.8); const h2 = Math.sqrt(Math.max(0, 1 - S.dir.y*S.dir.y)); S.dir.x = Math.sin(ny)*h2; S.dir.z = Math.cos(ny)*h2;
    S.roll += (Math.max(-0.7, Math.min(0.7, -dy/dt*1.6 || 0)) - S.roll)*Math.min(1, dt*2);
    e.pos.addScaledVector(S.dir, S.spd*dt); e.yaw = Math.atan2(S.dir.x, S.dir.z);
    m.rotation.set(-Math.asin(S.dir.y), e.yaw, S.roll); ctl.thrust = 0.9;
    // bombs: a string while over the run's target
    if (fire && S.st === 'run' && Math.hypot(S.pt.x - e.pos.x, S.pt.z - e.pos.z) < 300 && (S.bombCd -= dt) <= 0) {
      S.bombCd = 0.22; HB2.copy(e.pos); HB2.y -= 5;
      game.bullets.push({pos:HB2.clone(), vel:HB3.copy(S.dir).multiplyScalar(S.spd*0.5).add(HB.set((Math.random() - 0.5)*8, -95, (Math.random() - 0.5)*8)).clone(), life:7, dmg:150*e.dmgMul, team:'enemy', by:'enemy', color:0x60564a, len:2.5, w:1.4, splash:24});
      if (game.time - (S.bombT || -99) > 6) { S.bombT = game.time; G.hud.flash('BOMBS FALLING'); }
    }
    // the dorsal gun covers its tail
    if (fire && tgt && (S.tailCd -= dt) <= 0) {
      HB.copy(tgt.pos).sub(e.pos); const d = HB.length();
      if (d < 900 && HB.dot(S.dir) < -0.2*d) { if (S.burst <= 0) S.burst = 1.2; }
      if (S.burst > 0) { S.burst -= dt; S.burstCd -= dt;
        if (S.burstCd <= 0) { S.burstCd = 0.09; HB2.set(0, 1.2*3, -2*3).applyQuaternion(m.quaternion).add(e.pos); shoot(game, e, HB2.clone(), tgt, 760, 9, {err:14, color:0xff8a5a, len:4, w:0.5}); G.audio.shot(e.pos, 'mg'); }
        if (S.burst <= 0) S.tailCd = 2.5; }
      if (U.turret) { HB.copy(tgt.pos); U.turret.parent.worldToLocal(HB); U.turret.rotation.y = Math.atan2(HB.x, HB.z) + Math.PI; }
    }
    if (fire && tgt && (S.misCd -= dt) <= 0 && e.pos.distanceTo(tgt.pos) < 2200) {
      S.misCd = 11;
      for (let k = 0; k < 2; k++) game.later(k*0.3, () => { if (!e.alive) return; game.launchMissile(F.world(k ? 'wingL' : 'wingR', (k ? 1 : -1)*3, 0, 0), S.dir.clone(), tgt, {team:'enemy', speed:150, max:330, turn:1.9, dmg:90*e.dmgMul, life:11}); G.audio.missile(); });
    }
  } else {
    // hover and mech: face the target
    if (tgt) { let dy = Math.atan2(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z) - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += Math.max(-dt*0.9, Math.min(dt*0.9, dy));
      HB.copy(tgt.pos).sub(e.pos); HB.y -= e.fm === 'mech' ? 27 : 0; ctl.aimPitch = Math.max(-1.0, Math.min(1.2, Math.atan2(HB.y, Math.hypot(HB.x, HB.z)))); ctl.aimYaw = 0; ctl.ready = 1.5; ctl.wpn = 0; }
    if (e.fm === 'hover') {
      let gx, gz, ga, sp = 45;
      if (S.st === 'descend') {   // look for a landing spot near the waypoint, fly there, then come down
        if (!S.lz) S.lz = G.harbLandSpot(W, e.pos, C);
        gx = S.lz.x; gz = S.lz.z; ga = Math.hypot(gx - e.pos.x, gz - e.pos.z) < 40 ? gh(gx, gz) + 3*G.CLEAR.mech : gh(gx, gz) + 110; sp = 70;
        if (Math.hypot(gx - e.pos.x, gz - e.pos.z) < 40 && e.pos.y < gh(gx, gz) + 3*G.CLEAR.mech + 4) S.landed = true;
      } else {
        S.orb += dt*0.12; const T = tgt ? tgt.pos : C; gx = T.x + Math.sin(S.orb)*420; gz = T.z + Math.cos(S.orb)*420; ga = Math.max(gh(gx, gz), gh(e.pos.x, e.pos.z)) + 110;
      }
      HB.set(gx - e.pos.x, ga - e.pos.y, gz - e.pos.z); const d = HB.length(); if (d > 1) e.pos.addScaledVector(HB, Math.min(d, sp*dt)/d);
      m.rotation.set(0.05, e.yaw, Math.sin(e.t*0.8)*0.03); ctl.thrust = 0.7;
      if (fire && tgt && S.tf <= 0 && S.st !== 'descend') {
        const vis = game.sees(e, tgt);
        if (S.burst > 0) { S.burst -= dt; S.burstCd -= dt; if (vis && S.burstCd <= 0) { S.burstCd = 0.1; shoot(game, e, F.world('gunpod', 0, 0.05, 3.9), tgt, 780, 17, {err:10, color:0xffa060, len:6, w:0.9}); G.audio.shot(e.pos, 'shell'); } }
        else if ((S.gunCd -= dt) <= 0 && vis) { S.burst = 1.4; S.gunCd = 3.4; }
        if ((S.misCd -= dt) <= 0) { S.misCd = 9.5; G.hud.flash('MISSILE SALVO');
          for (let k = 0; k < 6; k++) game.later(k*0.18, () => { if (!e.alive) return; const sd = k % 2 ? 1 : -1; game.launchMissile(F.world(sd > 0 ? 'wingL' : 'wingR', sd*(2 + k*0.4), 0.6, -1), HB2.set(sd*0.4, 1, 0).normalize().clone(), tgt, {team:'enemy', speed:140, max:320, turn:1.8, dmg:70*e.dmgMul, life:11}); G.audio.missile(); });
        }
      }
    } else {
      // mech: walk toward the target over solid ground
      const d = tgt ? Math.hypot(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z) : 0;
      if (tgt && S.stomp <= 0 && d > 200) { const vx = Math.sin(e.yaw), vz = Math.cos(e.yaw), nx = e.pos.x + vx*13*dt, nz = e.pos.z + vz*13*dt;
        let ok = W.height(nx, nz) > 0.5, ax = vx, az = vz;
        for (const da of [0.8, -0.8, 1.6, -1.6]) { if (ok) break; ax = Math.sin(e.yaw + da); az = Math.cos(e.yaw + da); ok = W.height(e.pos.x + ax*13*dt*8, e.pos.z + az*13*dt*8) > 0.5; }   // water ahead: try a slant to either side
        if (ok) { e.pos.x += ax*13*dt; e.pos.z += az*13*dt; S.walk += dt*2.2; ctl.walkAmt = 1; } }
      ctl.walk = S.walk; e.pos.y = gh(e.pos.x, e.pos.z) + 3*G.CLEAR.mech; m.rotation.set(0, e.yaw, 0); ctl.thrust = 0.12;
      const grounded = P.alive && P.mode !== 'jet' && P.pos.y - gh(P.pos.x, P.pos.z) < 30, pd = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
      if (S.stomp > 0) { S.stomp -= dt;
        if (S.stomp <= 0) { S.stompCd = 6; G.audio.boom(e.pos, 2); P.shake += 2;
          for (let i = 0; i < 14; i++) { const a = i/14*6.283; game.fx.dust(HB.set(e.pos.x + Math.sin(a)*70, gh(e.pos.x, e.pos.z), e.pos.z + Math.cos(a)*70)); }
          if (P.alive && P.mode !== 'jet' && P.pos.y - gh(P.pos.x, P.pos.z) < 30 && pd < 130) P.damage(160*(1 - pd/150)*e.dmgMul, e.pos.clone(), 'impact');
          const Wg = game.wing, wd = Math.hypot(Wg.pos.x - e.pos.x, Wg.pos.z - e.pos.z); if (Wg.alive && Wg.mode !== 'jet' && Wg.pos.y - gh(Wg.pos.x, Wg.pos.z) < 30 && wd < 130) Wg.hit(160*(1 - wd/150)*e.dmgMul); } }
      else if (fire && (grounded && pd < 110 || (game.wing.alive && game.wing.mode !== 'jet' && game.wing.pos.y - gh(game.wing.pos.x, game.wing.pos.z) < 30 && Math.hypot(game.wing.pos.x - e.pos.x, game.wing.pos.z - e.pos.z) < 110)) && (S.stompCd -= dt) <= 0) { S.stomp = 1.0; G.hud.flash('STOMP · GET CLEAR'); G.audio.tone(90, 0.9, 'sawtooth', 0.07, 60); }
      if (fire && tgt && S.tf <= 0 && S.stomp <= 0) {
        if ((S.gunCd -= dt) <= 0 && game.sees(e, tgt)) { S.gunCd = 2.3; shoot(game, e, F.world('gunpod', 0, 0.05, 3.9), tgt, 520, 55, {err:9, color:0xffb070, len:7, w:1.1, splash:12}); G.audio.shot(e.pos, 'shell'); }
        if ((S.misCd -= dt) <= 0) { S.misCd = 11;
          for (let k = 0; k < 4; k++) game.later(k*0.2, () => { if (!e.alive) return; game.launchMissile(F.world(k % 2 ? 'wingL' : 'wingR', (k % 2 ? 1 : -1)*2.5, 0.6, 0), HB2.set(0, 1, 0).clone(), tgt, {team:'enemy', speed:140, max:320, turn:1.8, dmg:80*e.dmgMul, life:11}); G.audio.missile(); });
        }
      }
    }
  }
  m.position.copy(e.pos); F.update(dt); U.sync(dt); m.updateMatrixWorld(true);   // muzzles and launchers read world matrices this frame
  // its bulk is solid: push the player out of the hit sphere
  if (P.alive) { HB.copy(P.pos).sub(HB2.copy(e.pos).setY(e.pos.y + e.cy)); const d = HB.length(), R = e.r + 4;
    if (d < R && d > 0.01) { P.pos.addScaledVector(HB, (R - d)/d); if (game.time - (S.bumpT || -99) > 1) { S.bumpT = game.time; P.damage(30, e.pos.clone(), 'impact'); P.shake += 0.4; } } }
  { const Wg = game.wing; if (Wg.alive) { HB.copy(Wg.pos).sub(HB2.copy(e.pos).setY(e.pos.y + e.cy)); const d = HB.length(), R = e.r + 4;
    if (d < R && d > 0.01 && game.time - (S.wbumpT || -99) > 1) { S.wbumpT = game.time; Wg.hit(30); } } }
};
G.harbLandSpot = (W, from, C) => {
  let best = null, bd = 1e9;
  for (const R of [1800, 4000, 9000]) { if (best) break;   // widen the search until solid ground turns up
    for (let i = 0; i < 200; i++) { const a = Math.random()*6.283, r = 100 + Math.random()*R, x = C.x + Math.sin(a)*r, z = C.z + Math.cos(a)*r;
      if (W.height(x, z) > 6 && W.slope(x, z) < 0.3) { const d = Math.hypot(x - from.x, z - from.z); if (d < bd) { bd = d; best = {x, z}; } } } }
  return best || {x:from.x, z:from.z};
};
function shootFrom(game, e, from, tgt, speed, dmg, o){ shoot(game, e, from, tgt, speed, dmg, o); }

G.updateEnemy = function(game, e, dt){
  const W = game.world, P = game.player;
  e.t += dt; e.cd -= dt; if (e.hitT > 0) e.hitT -= dt;
  const jam = P.jam;
  const px0 = e.pos.x, py0 = e.pos.y, pz0 = e.pos.z;
  if (e.type === 'colossus' || e.type === 'harbinger') { e.kb = null; e.stun = 0; }   // far too heavy to knock back or stagger
  // Sword knockback and stagger (ground units and walkers).
  if (e.kb) {
    e.pos.x += e.kb.x*dt; e.pos.z += e.kb.z*dt; e.kb.multiplyScalar(Math.exp(-dt*5));
    if (e.kb.lengthSq() < 0.5) e.kb = null;
  }
  if (e.stun > 0) {
    e.stun -= dt;
    const gh = Math.max(W.height(e.pos.x, e.pos.z), -1); e.pos.y = Math.max(gh, e.pos.y - 30*dt);
    W.pushOut && W.pushOut(e.pos, e.r*0.6, e.pos.y);
    e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw;
    e.mesh.rotation.x = -Math.min(0.3, e.stun*0.35); e.mesh.rotation.z = Math.sin(e.t*34)*0.05*Math.min(1, e.stun*2);
    if (e.stun <= 0) { e.mesh.rotation.x = 0; e.mesh.rotation.z = 0; }
    if (dt > 0) e.vel.set((e.pos.x - px0)/dt, (e.pos.y - py0)/dt, (e.pos.z - pz0)/dt);
    return;
  }
  switch (e.type) {
    case 'colossus': { G.updateSovereign(game, e, dt); break; }
    case 'skycarrier': { G.updateSkyCarrier(game, e, dt); break; }
    case 'harbinger': { G.updateHarbinger(game, e, dt); break; }
    case 'skyflak': case 'skymis': case 'skyengine': { G.updateSkyPart(game, e, dt); break; }
    case 'tank': case 'apc': case 'aa': case 'sam': {
      const spd = e.type === 'apc' ? 11 : 8;
      if (e.path) {
        const t = e.path[e.pathI]; tmp.set(t.x - e.pos.x, 0, t.z - e.pos.z);
        const d = tmp.length();
        if (d < 14) e.pathI = (e.pathI + 1) % e.path.length;
        else { tmp.multiplyScalar(1/d); e.pos.addScaledVector(tmp, spd*dt); e.yaw = Math.atan2(tmp.x, tmp.z); }
      } else if (e.type === 'tank' || e.type === 'apc') {
        if (!e.wp || e.t > e.wpT) { e.wp = new V3(e.home.x + (Math.random() - 0.5)*180, 0, e.home.z + (Math.random() - 0.5)*180); e.wpT = e.t + 12 + Math.random()*10; }
        tmp.set(e.wp.x - e.pos.x, 0, e.wp.z - e.pos.z); const d = tmp.length();
        if (d > 8) { tmp.multiplyScalar(1/d); const nx = e.pos.x + tmp.x*spd*0.6*dt, nz = e.pos.z + tmp.z*spd*0.6*dt;
          if (W.height(nx, nz) > 1) { e.pos.x = nx; e.pos.z = nz; e.yaw = Math.atan2(tmp.x, tmp.z); } else e.wpT = 0; }
      }
      if (W.pushOut(e.pos, 4.5, e.pos.y)) e.wpT = 0;
      e.pos.y = Math.max(W.height(e.pos.x, e.pos.z), -1);
      e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw;
      if (e.mesh.userData.spin) e.mesh.userData.spin.rotation.y += dt*2.6;
      const airOnly = e.type === 'aa' || e.type === 'sam';
      if (airOnly && !e.noFire) smallArms(game, e, dt);
      const range = {tank:950, apc:600, aa:1100, sam:1900}[e.type];
      const tgt = pickTarget(game, e, range, airOnly);
      if (!tgt || e.noFire) { e.lockT = Math.max(0, e.lockT - dt); break; }
      const tur = e.mesh.userData.turret;
      if (tur && !(e.saT > 0)) tur.rotation.y = Math.atan2(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z) - e.yaw;
      const muzzle = tmp2.copy(e.pos); muzzle.y += 2.6;
      const vis = game.sees(e, tgt);   // hills and buildings block fire and lock-ons
      if (e.type === 'tank' && vis && e.cd <= 0) {
        shoot(game, e, muzzle, tgt, 320, 42, {color:0xffb070, len:6, w:0.7, splash:9, err:7});
        e.cd = 2.8 + Math.random()*1.4; G.audio.shot(e.pos, 'shell');
      }
      if (e.type === 'apc') {
        if (e.burst > 0) { e.burst -= dt; e.burstCd -= dt; if (vis && e.burstCd <= 0) { e.burstCd = 0.12; shoot(game, e, muzzle, tgt, 620, 5, {err:14, color:0xffd080, len:3, w:0.3}); } }
        else if (vis && e.cd <= 0) { e.burst = 1; e.cd = 3 + Math.random()*2; }
      }
      if (e.type === 'aa') {
        if (e.burst > 0) { e.burst -= dt; e.burstCd -= dt; if (vis && e.burstCd <= 0) { e.burstCd = 0.1; shoot(game, e, muzzle, tgt, 720, 4.5, {err:22, color:0xffe0a0, len:4, w:0.45, prox:8, lead:0.9}); } }
        else if (vis && e.cd <= 0) { e.burst = 1.4; e.cd = 2.2 + Math.random(); }
      }
      if (e.type === 'sam') {
        const l = e.mesh.userData.launcher; if (l) l.rotation.x = -0.4 - Math.min(0.6, Math.max(0, (tgt.pos.y - e.pos.y)/800));
        if (vis) { e.lockT += dt*(tgt === P && jam ? 0.5 : 1); if (tgt === P) P.lockedBy++; } else e.lockT = Math.max(0, e.lockT - dt*1.5);
        if (vis && e.lockT >= 2.8 && e.cd <= 0) { game.launchMissile(muzzle.clone().add(tmp3.set(0, 3, 0)), UP, tgt, {team:'enemy', speed:140, max:330, turn:1.9, dmg:170*e.dmgMul, life:12}); e.cd = 9; e.lockT = 0; }
      }
      break;
    }
    case 'fighter': {
      if (!e.dir) e.dir = new V3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      const tgt = pickTarget(game, e, 6000, false);
      const des = tmp;
      // Missile defence: a Kestrel missile closing inside 450 m makes the fighter break hard across its path, and it may
      // pop flares. A fast missile off a jet usually still gets there; a slow one off a hovering Kestrel usually doesn't.
      if (e.evCd > 0) e.evCd -= dt;
      else for (const m of game.missiles) {
        if (m.team !== 'player' || m.target !== e) continue;
        const dm = m.pos.distanceTo(e.pos); if (dm > 450 || dm < 25) continue;
        e.evCd = 4 + Math.random()*2; e.evading = 1.8; e.breakT = 1.8; e.tRate = Math.max(e.tRate || 0, 0.9);
        const side = Math.random() < 0.5 ? 1 : -1;
        e.breakDir = new V3(-m.dir.z*side, (Math.random() - 0.3)*0.5, m.dir.x*side).normalize();
        const slow = m.speed < 390, pf = (e.ace ? 0.55 : 0.3)*(slow ? 1.7 : 1);
        if (Math.random() < pf) {
          const start = game.flares.length;
          for (let k = 0; k < 4; k++) game.flares.push({pos:e.pos.clone(), vel:e.vel.clone().multiplyScalar(0.3).add(new V3((Math.random() - 0.5)*60, -15 - Math.random()*20, (Math.random() - 0.5)*60)), life:3, alive:true});
          for (const m2 of game.missiles) if (m2.team === 'player' && m2.target === e && Math.random() < (slow ? 0.9 : 0.6)) m2.target = game.flares[start + Math.floor(Math.random()*4)];
        }
        break;
      }
      if (e.evading > 0) e.evading -= dt;
      if (e.breakT > 0) { e.breakT -= dt; des.copy(e.breakDir); }
      else if (tgt) {
        des.copy(tgt.pos).addScaledVector(tgt.vel, 0.8).sub(e.pos);
        // A Kestrel that stops to hover is a sitting duck: fighters set up diving strafing runs from above, then zoom
        // climb away and come round again instead of turning circles in front of its gun.
        const duck = tgt === P && P.mode !== 'jet' && !P.onGround, dl = des.length();
        if (duck && dl > 650) des.y += Math.min(260, dl*0.25);
        if (dl < (duck ? 280 : 160)) { e.breakT = duck ? 3.2 : 3.6; e.breakDir = duck ? new V3(e.dir.x + (Math.random() - 0.5)*0.8, 0.6, e.dir.z + (Math.random() - 0.5)*0.8).normalize() : new V3(Math.random() - 0.5, 0.25, Math.random() - 0.5).normalize(); }
      } else des.set(Math.sin(e.t*0.2), 0, Math.cos(e.t*0.2));
      des.normalize();
      const gh = Math.max(W.height(e.pos.x, e.pos.z), 0);
      // Terrain look-ahead along the current flight path: pull up before hills, not after.
      const spdNow = Math.max(e.vel.length(), 100); let need = gh + 140 - e.pos.y, danger = e.pos.y < gh + 120;
      for (const t of [1, 2, 3.5, 5]) {
        const px = e.pos.x + e.dir.x*spdNow*t, pz = e.pos.z + e.dir.z*spdNow*t, py = e.pos.y + e.dir.y*spdNow*t;
        const hh = Math.max(W.height(px, pz), 0) + 110;
        if (py < hh) { danger = true; need = Math.max(need, hh - py); }
      }
      if (danger) { e.breakT = 0; des.y = Math.max(des.y, Math.min(0.75, 0.3 + need/300)); }
      e.pullUp = danger;
      if (e.pos.y > gh + 1400) des.y = Math.min(des.y, -0.2);
      des.y = Math.max(-0.45, Math.min(0.6, des.y)); des.normalize();
      // Turn like an aircraft: limited turn rate that builds up and eases off, no instant flicks.
      const prev = tmp3.copy(e.dir), ang = e.dir.angleTo(des), maxRate = e.pullUp ? 1.1 : e.evading > 0 ? (e.ace ? 1.15 : 0.95) : e.ace ? 0.62 : 0.46;
      const wantRate = Math.min(maxRate, ang*1.1);
      e.tRate = (e.tRate || 0) + (wantRate - (e.tRate || 0))*Math.min(1, dt*1.1);
      const maxA = e.tRate*dt;
      if (ang > maxA) {
        TA.crossVectors(e.dir, des); if (TA.lengthSq() < 1e-6) TA.set(0, 1, 0);   // target dead astern: pick a turn direction
        TQ.setFromAxisAngle(TA.normalize(), maxA); e.dir.applyQuaternion(TQ).normalize();
      } else e.dir.copy(des);
      e.turnSign = Math.sign(prev.x*des.z - prev.z*des.x) || 0;
      const spd = ((e.ace ? 190 : 165) + game.m.tier*5)*(e.slow ? 0.62 : 1);
      e.vel.copy(e.dir).multiplyScalar(spd); e.pos.addScaledVector(e.vel, dt);
      // Failsafe: never let a jet pass through the ground.
      const floor = Math.max(W.height(e.pos.x, e.pos.z), 0) + 25;
      if (e.pos.y < floor) { e.pos.y = floor; if (e.dir.y < 0.25) { e.dir.y = 0.25; e.dir.normalize(); } }
      const wantBank = -e.turnSign*Math.min(1.05, e.tRate*2.2);
      e.bank = (e.bank || 0) + (wantBank - (e.bank || 0))*Math.min(1, dt*1.6);
      e.mesh.position.copy(e.pos); e.mesh.lookAt(tmp2.copy(e.pos).add(e.dir)); e.mesh.rotateZ(e.bank);
      if (tgt && !e.noFire) {
        const vis = game.sees(e, tgt);
        tmp2.subVectors(tgt.pos, e.pos); const d = tmp2.length(), a = vis ? e.dir.angleTo(tmp2) : 9;
        const duck = tgt === P && P.mode !== 'jet' && !P.onGround, dk = duck ? 1.2 : 1;   // a hovering Kestrel takes a little more from fighters
        if (a < (duck ? 0.1 : 0.07) && d < (duck ? 900 : 720)) { e.burstCd -= dt; if (e.burstCd <= 0) { e.burstCd = 0.13; shoot(game, e, e.pos.clone().addScaledVector(e.dir, 6), tgt, 950, 6.5*dk, {err:6, color:0xff7766, len:5, w:0.4, lead:1}); } }
        if (a < 0.5 && d > 350 && d < 1700) { e.lockT += dt*(tgt === P && jam ? 0.5 : 1)*(duck ? 1.8 : 1); if (tgt === P) P.lockedBy++; } else e.lockT = Math.max(0, e.lockT - dt);
        if (e.lockT > 2.6 && e.cd <= 0) { game.launchMissile(e.pos.clone().addScaledVector(e.dir, 4), e.dir, tgt, {team:'enemy', speed:spd, max:370, turn:2.1, dmg:150*e.dmgMul*dk, life:10}); e.cd = 13; e.lockT = 0; }
      }
      break;
    }
    case 'reaver': {
      /* Melee hunter: sprints at its target, leaps to close distance, winds up (visor flares, blades raised) and slashes.
         A sword hit during the wind-up staggers it. Its reactive plating soaks most gunfire (see damageEnt). */
      const tgt = pickTarget(game, e, 1600, false), U = e.mesh.userData, P = game.player;
      const gh0 = Math.max(W.height(e.pos.x, e.pos.z), -1); let moving = false;
      e.st = e.st || 'chase'; e.stT = (e.stT || 0) - dt; e.atkCd = (e.atkCd || 0) - dt; e.leapCd = (e.leapCd ?? 2) - dt;
      if (e.st === 'stagger') { if (e.stT <= 0) e.st = 'chase'; }
      else if (tgt) {
        tmp.set(tgt.pos.x - e.pos.x, 0, tgt.pos.z - e.pos.z); const d = tmp.length(), high = tgt.pos.y - gh0 > 55;
        const want = Math.atan2(tmp.x, tmp.z); e.yaw += Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw))*Math.min(1, dt*(e.st === 'windup' ? 2 : 8));
        if (e.st === 'windup') {
          if (e.stT <= 0) {
            e.st = 'strike'; e.stT = 0.35; G.audio.swoosh && G.audio.swoosh();
            if (d < 25 && Math.abs(tgt.pos.y - e.pos.y) < 18) {
              const amt = 150*e.dmgMul;
              if (tgt === P) { P.damage(amt, e.pos, 'melee'); tmp.multiplyScalar(1/Math.max(d, 1)); P.vel.x += tmp.x*14; P.vel.z += tmp.z*14; P.shake += 0.9; G.audio.impact('metal', 0.9); }
              else tgt.hit(amt);
            }
          }
        } else if (e.st === 'strike') { if (e.stT <= 0) { e.st = 'chase'; e.atkCd = 1.1; } }
        else {
          if (d < 20 && e.atkCd <= 0 && !high && e.onGround !== false) { e.st = 'windup'; e.stT = 0.5; G.audio.tone(140, 0.45, 'sawtooth', 0.05, 320); }
          else if (!e.frozen) {
            if (e.onGround !== false && e.leapCd <= 0 && d > 45 && d < 220 && !high) {
              // Leap: cover the gap in one arcing jump.
              const T = 1.3; e.vy = 30*T/2 + (tgt.pos.y - gh0)/T; e.onGround = false; e.leapV = new V3(tmp.x/T, 0, tmp.z/T); e.leapCd = 3.5 + Math.random()*2; G.audio.thump(0.6);
            } else if (e.onGround !== false && d > 16) {
              const sp = d > 400 ? 30 : 24; tmp.multiplyScalar(1/d); const nx = e.pos.x + tmp.x*sp*dt, nz = e.pos.z + tmp.z*sp*dt;
              if (W.height(nx, nz) > 0) { e.pos.x = nx; e.pos.z = nz; moving = true; }
            }
          }
        }
      }
      if (e.leapV && e.onGround === false) { e.pos.x += e.leapV.x*dt; e.pos.z += e.leapV.z*dt; }
      W.pushOut(e.pos, 5, e.pos.y);
      const gh = Math.max(W.height(e.pos.x, e.pos.z), -1);
      e.vy -= 30*dt; e.pos.y += e.vy*dt;
      if (e.pos.y <= gh) { if (e.onGround === false && e.leapV) { e.leapV = null; game.fx.dust(tmp2.set(e.pos.x, gh, e.pos.z)); } e.pos.y = gh; e.vy = 0; e.onGround = true; }
      e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw;
      // Pose: running gait, blades raised in the wind-up, cross-body slash on the strike, slumped when staggered.
      const k = e.st === 'windup' ? 1 - Math.max(0, e.stT)/0.5 : 0, run = moving ? Math.sin(e.t*7) : 0;
      if (U.legs) { const a = moving ? run*0.6 : e.onGround === false ? 0.5 : 0; U.legs[0].rotation.x = a; U.legs[1].rotation.x = e.onGround === false ? -0.3 : -a; }
      if (U.hull) { U.hull.position.y = 6.0 + (moving ? Math.abs(run)*0.35 : 0); U.hull.rotation.x = e.st === 'stagger' ? -0.35 : moving ? 0.22 : e.st === 'windup' ? -0.15*k : 0.08; }
      if (U.arms) U.arms.forEach((A, i) => { const s = i ? 1 : -1;
        if (e.st === 'windup') { A.rotation.x = -1.9*k; A.rotation.z = s*0.4*k; }
        else if (e.st === 'strike') { const q = 1 - Math.max(0, e.stT)/0.35; A.rotation.x = -1.9 + 2.9*Math.min(1, q*2.2); A.rotation.z = s*(0.4 - 0.9*q); }
        else { A.rotation.x = moving ? 0.5 - run*s*0.3 : 0.25; A.rotation.z = 0; } });
      if (U.visor) U.visor.scale.set(1, e.st === 'windup' ? 1 + 2*k : 1, 1);
      break;
    }
    case 'mech': {
      const tgt = pickTarget(game, e, 1400, false), vis = tgt ? game.sees(e, tgt) : false;
      let moving = false;
      if (tgt) {
        tmp.set(tgt.pos.x - e.pos.x, 0, tgt.pos.z - e.pos.z); const d = tmp.length();
        e.yaw = Math.atan2(tmp.x, tmp.z);
        const gh0 = Math.max(W.height(e.pos.x, e.pos.z), -1);
        if (!e.frozen && (d > 320 || (!vis && d > 60)) && tgt.pos.y - gh0 < 380) { tmp.multiplyScalar(1/d); const nx = e.pos.x + tmp.x*13*dt, nz = e.pos.z + tmp.z*13*dt; if (W.height(nx, nz) > 0) { e.pos.x = nx; e.pos.z = nz; moving = true; } }
        if (e.burst > 0) { e.burst -= dt; e.burstCd -= dt; if (vis && e.burstCd <= 0) { e.burstCd = 0.28;
          const side = (e.side = -(e.side || 1)), s = Math.sin(e.yaw), c = Math.cos(e.yaw);
          shoot(game, e, tmp2.set(e.pos.x + c*3.4*side + s*3, e.pos.y + 11.5, e.pos.z - s*3.4*side + c*3), tgt, 360, 26, {color:0xff5a3c, len:5, w:1.1, err:5}); } }
        else if (!e.noFire && vis && e.cd <= 0 && d < 1200) { e.burst = 0.6; e.cd = 1.9 + Math.random(); G.audio.shot(e.pos, 'bolt'); }
      }
      W.pushOut(e.pos, 6, e.pos.y);
      const gh = Math.max(W.height(e.pos.x, e.pos.z), -1);
      if (!e.frozen && e.onGround !== false && Math.random() < dt*0.06) { e.vy = 20; e.onGround = false; }
      e.vy -= 30*dt; e.pos.y += e.vy*dt;
      if (e.pos.y <= gh) { e.pos.y = gh; e.vy = 0; e.onGround = true; }
      e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw;
      const legs = e.mesh.userData.legs; if (legs) { const a = moving ? Math.sin(e.t*5)*0.45 : 0; legs[0].rotation.x = a; legs[1].rotation.x = -a; }
      if (e.mesh.userData.hull) e.mesh.userData.hull.position.y = 6.2 + (moving ? Math.abs(Math.sin(e.t*5))*0.3 : 0);
      const U = e.mesh.userData;
      if (U.mixer) {
        const st = !e.onGround ? 'Jump' : e.burst > 0 ? 'Shoot' : moving ? 'Walk' : 'Idle';
        U.play(st, st === 'Shoot' ? 0.12 : 0.25);
        if (U.actions.Walk) U.actions.Walk.timeScale = 1.1;
        U.mixer.update(dt);
      }
      break;
    }
  }
  if (e.type !== 'fighter' && dt > 0) e.vel.set((e.pos.x - px0)/dt, (e.pos.y - py0)/dt, (e.pos.z - pz0)/dt);
};
})();
