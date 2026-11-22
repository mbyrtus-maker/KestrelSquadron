(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3;
const C = G.CARRIER = {x:0, z:-6400, deck:62};

/* ---------- Waypoint task catalogue ---------- */
G.TASKS = {
  patrol: {label:'Patrol for enemy aircraft', short:'Patrol', n:t => 2 + t, reward:700, xp:90},
  armor:  {label:'Destroy the armor column', short:'Armor column', n:t => 3 + 2*t, reward:1100, xp:140},
  rescue: {label:'Rescue civilians', short:'Rescue', n:t => 1 + (t > 1 ? 1 : 0), reward:1300, xp:160},
  base:   {label:'Destroy the forward base', short:'Forward base', n:t => 3 + t, reward:1400, xp:170},
  sam:    {label:'Knock out SAM launchers', short:'SAM sites', n:t => 2 + t, reward:1100, xp:140},
  walkers:{label:'Destroy the walker squad', short:'Walkers', n:t => 2 + t, reward:1200, xp:150},
  recon:  {label:'Photograph sites below 150 m', short:'Recon', n:t => 2 + t, reward:800, xp:110},
  city:   {label:'Liberate the town', short:'Town', n:t => 4 + t, reward:1600, xp:190},
  air:    {label:'Intercept incoming fighters', short:'Intercept', n:t => 3 + t, reward:1200, xp:150},
  boss:   {label:'Shoot down Hollow', short:'Hollow', n:() => 1, reward:2600, xp:320},
  sovereign:{label:'Destroy the Sovereign', short:'Sovereign', n:() => 1, reward:3400, xp:420},
  rival:  {label:'Shoot down the rival ace', short:'Rival ace', n:() => 1, reward:2800, xp:340},
  skycarrier:{label:'Bring down the flying carrier', short:'Ascendant', n:() => 1, reward:5200, xp:600},
  harbinger:{label:'Bring down the Harbinger', short:'Harbinger', n:() => 1, reward:5600, xp:650}
};
G.taskText = T => {
  const n = T.n; if (T.text) return T.text;
  return {harbinger:`Bring down the Harbinger over ${T.place}`, skycarrier:`Bring down the Ascendant over ${T.place}`, rival:`Shoot down ${T.who || 'the rival ace'} over ${T.place}`, sovereign:`Destroy the Sovereign at ${T.place}`, boss:`Shoot down Hollow over ${T.place}`, patrol:`Patrol ${T.place} for enemy aircraft`, armor:`Destroy the armor column at ${T.place} (${n} vehicles)`, rescue:`Rescue ${n} civilian group${n > 1 ? 's' : ''} at ${T.place}`,
    base:`Destroy the forward base at ${T.place} (${n} structures)`, sam:`Knock out ${n} SAM launchers at ${T.place}`, walkers:`Destroy ${n} walkers at ${T.place}`,
    recon:`Photograph ${n} sites at ${T.place}, below 150 m`, city:`Liberate ${T.place}: clear ${n} hostiles`, air:`Intercept ${n} fighters over ${T.place}`}[T.kind];
};
const OPS = ['Iron Lantern','Grey Harbor','Saltwind','Hollow Crown','Long Ember','Quiet Anvil','Red Meridian','Night Heron','Cold Ledger','Brass Compass','Tidewatch','Glass Orchard'];
const ISLES = ['Halvorsen Isle','Cobalt Island','Sable Key','Orrin Atoll','Kettle Island','Grayhook Isle','Tamsin Island','Corran Isle'];
const SECTORS = ['North Ridge','the Old Quarry','Mill Valley','East Shore','Radio Hill','Dry Lake','Pine Hollow','Lighthouse Point','Twin Peaks','Saddle Pass','Fisher Bay','Ash Flats'];
const TOWNS = ['New Calder','Port Teague','Vey','Marrow Point','Ashford','Lindqvist'];
const BIAS = {convoy:'armor', base:'base', rescue:'rescue', city:'city', air:'air', mech:'walkers', sam:'sam', recon:'recon'};
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

G.genMission = (type, level) => {
  const R = Math.random, tier = 1 + Math.floor(R()*3), sc = 1 + 0.16*(level - 1);
  const count = 2 + (tier >= 2 ? 1 : 0) + (level >= 5 && R() < 0.4 ? 1 : 0);
  const kinds = [];
  if (R() < 0.55) kinds.push('patrol');
  const want = BIAS[type]; if (want && !kinds.includes(want)) kinds.push(want);
  const pool = Object.keys(G.TASKS);
  while (kinds.length < count) {
    const k = pool[Math.floor(R()*pool.length)];
    if (kinds.includes(k) || (k === 'city' && kinds.includes('base')) || (k === 'base' && kinds.includes('city'))) continue;
    kinds.push(k);
  }
  const sectors = shuffle(SECTORS.slice()), town = TOWNS[Math.floor(R()*TOWNS.length)];
  const tasks = kinds.map((k, i) => ({kind:k, n:G.TASKS[k].n(tier) + Math.floor(level/6), place: k === 'city' ? town : sectors[i]}));
  const reward = Math.round((tasks.reduce((a, t) => a + G.TASKS[t.kind].reward + 60*t.n, 0) + 600*tier)*sc/50)*50;
  const xp = Math.round((tasks.reduce((a, t) => a + G.TASKS[t.kind].xp + 8*t.n, 0) + 80*tier)*(1 + 0.1*(level - 1)));
  let sp = ['time','wingman','hull','melee','mechkills','aa','ace','nomissile']; if (kinds.includes('city')) sp.push('collat', 'collat', 'melee', 'melee', 'mechkills');
  const sides = [];
  while (sides.length < (tier >= 2 ? 2 : 1) && sp.length) {
    const k = sp.splice(Math.floor(R()*sp.length), 1)[0]; if (sides.some(s => s.key === k)) continue;
    sides.push({key:k, param: k === 'time' ? Math.round((320 + tasks.length*300)/10)*10 : 0, cash:Math.round(reward*(0.14 + 0.05*tier)/50)*50, xp:Math.round(xp*0.25)});
  }
  const isle = ISLES[Math.floor(R()*ISLES.length)], op = OPS[Math.floor(R()*OPS.length)];
  return {id:Date.now().toString(36) + R().toString(36).slice(2, 6), type:'ops', tier, n:tasks.length, tasks, place:isle, city:town, reward, xp, sides,
    seed:Math.floor(R()*1e9), title:`Operation ${op}`, tag:`${tasks.length} waypoints`,
    brief:`Launch from the Bastion and work through ${tasks.length} waypoints on ${isle}, then fly home and set down on the carrier.`,
    goal:`${tasks.length} waypoints, then return to the Bastion`};
};

/* ---------- Layout (decided before the terrain is built) ---------- */
const basePlanMission = G.planMission;
G.planMission = function(m){
  if (m.type !== 'ops') return basePlanMission(m);
  const r = G.rng(m.seed + 99), L = {flats:[], r, center:{x:0, z:0}, tasks:[], carrier:true};
  const pts = [], probe = {noise:G.Noise(m.seed)}, land = (x, z) => G.World.prototype.raw.call(probe, x, z);
  for (let i = 0; i < m.tasks.length; i++) {
    if (m.tasks[i].at) continue;
    let p, tries = 0;
    const gap = tries => tries < 150 ? 2600 : tries < 300 ? 2000 : 1500;
    do { const a = r()*Math.PI*2, d = 600 + r()*3300; p = {x:Math.sin(a)*d, z:Math.cos(a)*d}; tries++; }
    while (tries < 400 && (land(p.x, p.z) < 15 || pts.some(q => Math.hypot(q.x - p.x, q.z - p.z) < gap(tries))));
    pts.push(p);
  }
  let cur = {x:C.x, z:C.z}; const order = [], left = pts.slice();
  for (const t of m.tasks) {
    if (t.at) { order.push(t.at); cur = t.at; continue; }
    left.sort((a, b) => Math.hypot(a.x - cur.x, a.z - cur.z) - Math.hypot(b.x - cur.x, b.z - cur.z)); cur = left.shift(); order.push(cur);
  }
  m.tasks.forEach((t, i) => {
    const P = order[i], T = Object.assign({}, t, {i, C:P, groups:[], path:null});
    if (t.kind === 'base') L.flats.push({x:P.x, z:P.z, r:240});
    if (t.kind === 'city') L.flats.push({x:P.x, z:P.z, r:500});
    if (t.kind === 'rescue') for (let k = 0; k < t.n; k++) { const a = r()*6.283, d = 140 + r()*280, g = {x:P.x + Math.sin(a)*d, z:P.z + Math.cos(a)*d}; T.groups.push(g); L.flats.push({x:g.x, z:g.z, r:70}); }
    if (t.kind === 'armor') {
      const a = r()*Math.PI, dx = Math.sin(a), dz = Math.cos(a), pp = [];
      for (let k = 0; k <= 5; k++) { const s = -500 + k*200; pp.push({x:P.x + dx*s + (r() - 0.5)*120, z:P.z + dz*s + (r() - 0.5)*120}); }
      T.path = pp.concat(pp.slice(1, -1).reverse()); for (const q of pp) L.flats.push({x:q.x, z:q.z, r:55});
    }
    L.tasks.push(T);
  });
  L.center = order[0];
  return L;
};

/* ---------- Spawning ---------- */
const baseSpawnMission = G.spawnMission;
G.spawnMission = function(game, L){
  if (game.m.type !== 'ops') return baseSpawnMission(game, L);
  const m = game.m, tier = m.tier, W = game.world, r = L.r;
  const around = (cx, cz, a0, a1) => { const a = r()*Math.PI*2, d = a0 + r()*(a1 - a0); return [cx + Math.sin(a)*d, cz + Math.cos(a)*d]; };
  // ground units never stand in the sea: landAt walks outward in rings from a spot until it finds dry ground (above 3 m)
  const landAt = (x, z, max = 600) => { if (W.height(x, z) > 3) return [x, z];
    for (let d = 15; d <= max; d += 15) for (let k = 0, n = Math.max(8, Math.round(d/8)); k < n; k++) { const a = k/n*Math.PI*2, px = x + Math.sin(a)*d, pz = z + Math.cos(a)*d; if (W.height(px, pz) > 3) return [px, pz]; }
    return null; };
  const sp = (type, cx, cz, a0, a1, o) => { let x, z; for (let i = 0; i < 20; i++) { [x, z] = around(cx, cz, a0, a1); if (W.height(x, z) > 3) return G.spawn(game, type, x, z, o); }
    const L = landAt(x, z) || landAt(cx, cz, 1200) || [x, z]; return G.spawn(game, type, L[0], L[1], o); };
  const tag = (e, i) => { e.tag = 'obj'; e.task = i; return e; };
  for (const T of L.tasks) {
    const P = T.C, i = T.i;
    switch (T.kind) {
      case 'patrol': case 'boss': case 'sovereign': case 'rival': case 'skycarrier': case 'harbinger': break;
      case 'air': for (let k = 0; k < Math.min(2, tier); k++) sp('aa', P.x, P.z, 120, 450); break;
      case 'armor': {
        const path = T.path.map(p => new V3(p.x, 0, p.z)), d = new V3().subVectors(path[1], path[0]).normalize();
        for (let k = 0; k < T.n; k++) tag(G.spawn(game, k % 3 === 2 ? 'apc' : 'tank', path[0].x - d.x*k*26, path[0].z - d.z*k*26, {path, pathI:1}), i);
        G.spawn(game, 'aa', path[0].x - d.x*(T.n*26 + 20), path[0].z - d.z*(T.n*26 + 20), {path, pathI:1});
        break;
      }
      case 'rescue':
        for (const g of T.groups) {
          const mesh = G.buildCivilians(), y = W.height(g.x, g.z); mesh.position.set(g.x, y, g.z); game.scene.add(mesh);
          game.civGroups.push({pos:new V3(g.x, y, g.z), prog:0, done:false, mesh, task:i});
          sp('tank', g.x, g.z, 70, 140); if (tier >= 2) sp('mech', g.x, g.z, 70, 160);
        }
        break;
      case 'base': {
        const kinds = ['command','hangar','tower','depot','bunker','hangar','bunker','depot','tower'];
        const spots = [[0,0],[-95,45],[95,45],[0,-115],[-115,-80],[115,-80],[-45,130],[60,130],[160,-10]];
        for (let k = 0; k < T.n; k++) { const s = spots[k % spots.length], L = landAt(P.x + s[0], P.z + s[1], 300) || landAt(P.x, P.z, 1200) || [P.x + s[0], P.z + s[1]]; tag(G.spawn(game, kinds[k % kinds.length], L[0], L[1], {yaw: k % 2 ? 0 : Math.PI/2}), i); }
        for (let k = 0; k < 1 + tier; k++) { const a = k/(1 + tier)*Math.PI*2, L = landAt(P.x + Math.sin(a)*190, P.z + Math.cos(a)*190, 160); if (L) G.spawn(game, 'aa', L[0], L[1]); }   // a flak gun with no dry ground near its spot is left out
        if (tier >= 2) sp('reaver', P.x, P.z, 40, 160);
        sp('tank', P.x, P.z, 60, 200); if (tier >= 2) sp('sam', P.x, P.z, 220, 280);
        break;
      }
      case 'sam': for (let k = 0; k < T.n; k++) { const s = tag(sp('sam', P.x, P.z, 80, 480), i); if (tier >= 2) sp('aa', s.pos.x, s.pos.z, 30, 70); } break;
      case 'walkers': for (let k = 0; k < T.n; k++) tag(sp(k % 3 === 1 ? 'reaver' : 'mech', P.x, P.z, 60, 350), i); sp('tank', P.x, P.z, 60, 300); for (let k = 0; k < tier - 1; k++) sp('reaver', P.x, P.z, 80, 300); break;
      case 'recon':
        for (let k = 0; k < T.n; k++) { const [x, z] = around(P.x, P.z, 60, 480); game.waypoints.push({pos:new V3(x, W.height(x, z), z), done:false, task:i}); }
        sp('aa', P.x, P.z, 150, 420); if (tier === 3) sp('sam', P.x, P.z, 200, 500);
        break;
      case 'city': {
        const tints = [0xcfccc4, 0xb6ad9c, 0xa3a9ad, 0xb09a8a, 0x93958f, 0xc2bba8];
        // Downtown grid: 78 m blocks, ~30 m streets. Every building out-tops a 12 m mech; the core climbs to 100 m.
        const SP = 78;
        for (let gx = -5; gx <= 5; gx++) for (let gz = -5; gz <= 5; gz++) {
          const x = gx*SP, z = gz*SP, dist = Math.hypot(x, z); if (dist > 420 || (dist > 60 && r() < 0.1)) continue;
          const core = dist < 170, h = core ? 45 + r()*55 : 16 + r()*(dist < 300 ? 30 : 16);
          G.spawn(game, 'civ', P.x + x, P.z + z, {w:30 + r()*18, d:30 + r()*18, h, tint:tints[Math.floor(r()*tints.length)], yaw:0});
        }
        // City fights are close-quarters: mostly Reavers hunting through the streets, a walker or two, light armour, no flak.
        game.cityZones = game.cityZones || []; game.cityZones.push({x:P.x, z:P.z, r:520});
        const kinds = ['reaver','reaver','mech','reaver','tank','reaver','apc','reaver'];
        for (let k = 0; k < T.n; k++) {
          let x, z;
          for (let tries = 0; tries < 30; tries++) {
            const gx = Math.floor(r()*9) - 4, gz = Math.floor(r()*9) - 4, alongX = r() < 0.5;
            x = P.x + (alongX ? gx*SP + (r() - 0.5)*SP : gx*SP + SP/2); z = P.z + (alongX ? gz*SP + SP/2 : gz*SP + (r() - 0.5)*SP);
            if (game.world.roof(x, z) < -1e8) break;
          }
          tag(G.spawn(game, kinds[k % kinds.length], x, z), i);
        }
        for (let k = 0; k < tier; k++) { const a = r()*6.28, L = landAt(P.x + Math.sin(a)*120, P.z + Math.cos(a)*120, 300); if (L) G.spawn(game, 'reaver', L[0], L[1]); }   // a roaming pack on top of the objectives
        break;
      }
    }
  }
  const last = L.tasks[L.tasks.length - 1].C;
  for (const s of m.sides) {
    if (s.key === 'aa') { const ground = L.tasks.filter(t => t.kind !== 'patrol' && t.kind !== 'air'), T = ground.length ? ground[Math.floor(r()*ground.length)] : L.tasks[0]; for (let k = 0; k < 3; k++) sp('aa', T.C.x, T.C.z, 250, 700, {tag:'aaside'}); }
    if (s.key === 'ace') game.aceT = 80;
  }
  // Every ground unit belongs to its waypoint's zone and only fights there.
  for (const e of game.ents) if (e.team === 'enemy' && e.cls !== 'air') { let best = null, bd = 1e9; for (const T of L.tasks) { const d = Math.hypot(e.pos.x - T.C.x, e.pos.z - T.C.z); if (d < bd) { bd = d; best = T.C; } } e.zone = best; }
  game.spawnAces = () => {
    const P = game.player.pos;
    for (let k = 0; k < 3; k++) { const a = r()*6.28, x = P.x + Math.sin(a)*1500, z = P.z + Math.cos(a)*1500; const e = G.spawn(game, 'fighter', x, z, {alt:P.y + 300, tag:'ace'}); e.name = 'Varn ace'; e.hp *= 1.8; e.maxHp = e.hp; e.ace = true; }
    G.hud.radio(game.wing.alive ? game.wing.name : 'Bastion', 'Three fast movers, red tails. Those are aces.');
  };
  game.ops = new G.Ops(game, L);
};

/* ---------- Waypoint controller ---------- */
G.Ops = class {
  constructor(game, L){
    this.g = game; this.cur = 0; this.rtb = false; this.mark = null;
    this.tasks = L.tasks.map(T => Object.assign(T, {killed:0, done:false, arrived:false, t:0, spawnedN:0, hostiles: T.hostiles !== undefined ? T.hostiles : L.r() < 0.6}));
    game.objTotal = this.tasks.length; game.objDone = 0;
  }
  text(T){ return G.taskText(T); }
  onKill(e){ if (e.task === undefined) return; const T = this.tasks[e.task]; if (T) T.killed++; }
  alive(T){ let n = 0; for (const e of this.g.ents) if (e.alive && e.task === T.i) n++; return n; }
  progress(T){
    const g = this.g;
    if (T.kind === 'rescue') return [g.civGroups.filter(c => c.task === T.i && c.done).length, T.n];
    if (T.kind === 'recon') return [g.waypoints.filter(w => w.task === T.i && w.done).length, T.n];
    if (T.kind === 'patrol') return T.arrived ? (T.hostiles ? [T.killed, T.n] : [1, 1]) : [0, 1];
    return [Math.min(T.killed, T.n), T.n];
  }
  isDone(T){
    if (T.kind === 'patrol') return T.arrived && (T.hostiles ? (T.spawnedN >= T.n && this.alive(T) === 0) : T.t > 3);
    if (T.kind === 'air' || T.kind === 'boss' || T.kind === 'sovereign' || T.kind === 'rival' || T.kind === 'skycarrier' || T.kind === 'harbinger') return T.spawnedN >= T.n && this.alive(T) === 0;
    const [d, n] = this.progress(T); return d >= n;
  }
  fighters(T, k){
    const g = this.g, P = g.player.pos;
    for (let j = 0; j < k; j++) {
      const a = Math.random()*6.283, x = T.C.x + Math.sin(a)*700, z = T.C.z + Math.cos(a)*700;
      const e = G.spawn(g, 'fighter', x, z, {alt:Math.max(g.world.height(x, z), 0) + 400 + Math.random()*250}); e.tag = 'obj'; e.task = T.i;
      e.dir = new V3(P.x - x, 0, P.z - z).normalize();
    }
    T.spawnedN += k;
  }
  update(dt){
    const g = this.g, P = g.player, T = this.tasks[this.cur];
    if (T && !this.rtb) {
      const d = Math.hypot(P.pos.x - T.C.x, P.pos.z - T.C.z);
      if (!T.arrived && d < (T.kind === 'skycarrier' ? 3800 : T.kind === 'harbinger' ? 3000 : T.kind === 'patrol' || T.kind === 'air' ? 1000 : 1300)) {
        T.arrived = true;
        if (T.kind === 'patrol') {
          if (T.hostiles) { this.fighters(T, T.n); G.hud.radio('Bastion', `Contacts at waypoint ${T.i + 1}. ${T.n} bandits, engage.`); }
          else G.hud.radio('Bastion', `Waypoint ${T.i + 1} is quiet. No contacts. Hold a moment, then move on.`);
        } else if (T.kind === 'boss') {
          G.spawnHollow(g, {task:T.i, hpMul:7, escorts:T.escorts || 2, at:T.C}); T.spawnedN = 1; G.hud.flash('RED TAILS · HOLLOW INBOUND');
          G.hud.radio('Hollow', `There you are, ${G.save.callsign || 'Kestrel'}. Just you and me now.`);
        } else if (T.kind === 'rival') {
          G.spawnHollow(g, {task:T.i, at:T.C, escorts:T.escorts || 2, name:T.who, hpMul:T.hpMul || 6, lastWords:T.lastWords}); T.spawnedN = 1;
          G.hud.flash(`RED TAILS · ${String(T.who).toUpperCase()} INBOUND`); if (T.hello) G.hud.radio(T.who, T.hello.replace(/\{cs\}/g, G.save.callsign || 'Kestrel'));
        } else if (T.kind === 'skycarrier') {
          G.spawnSkyCarrier(g, {task:T.i, at:T.C, flak:T.flak, launchMul:T.launchMul, cap:T.cap, hpMul:T.hpMul}); T.spawnedN = 1;
          G.hud.flash('THE ASCENDANT · DEAD AHEAD');
          G.hud.radio(G.OFFICER.short, 'There she is. Kill the flak, then the six engines. Her reactor is sealed until the engines are gone. And watch the bow: that hangar never stops launching.');
          if (T.corvid) g.later(20, () => { const h = G.spawnHollow(g, {at:T.C, escorts:1, name:'Corvid', hpMul:5, lastWords:'Tell Hollow... I tried...'}); G.hud.radio('Corvid', 'Did you think I would let you touch her? Come here, Kestrel.'); });
        } else if (T.kind === 'harbinger') {
          G.spawnHarbinger(g, {task:T.i, at:T.C, hpMul:T.hpMul, dmg:T.dmg, escorts:T.escorts}); T.spawnedN = 1;
          G.hud.flash('THE HARBINGER · INBOUND ON A BOMBING RUN');
          G.hud.radio(G.OFFICER.short, 'There it is. Three times your size and it flies like a jet. It changes shape when it’s hurt, Kestrel: jet, then hover, then on its feet. Break it three times.');
          if (T.lancer) g.later(25, () => { G.spawnHollow(g, {at:T.C, escorts:1, name:'Lancer', hpMul:5, lastWords:'Marshal... I am sorry...'}); G.hud.radio('Lancer', 'The Marshal flies alone for no one. I am here, Kestrel.'); });
        } else if (T.kind === 'sovereign') {
          G.spawnSovereign(g, {task:T.i, at:T.C}); T.spawnedN = 1; G.hud.flash('THE PLATEAU IS MOVING');
          G.hud.radio(G.OFFICER.short, 'Kestrel, the ground under the plateau just split open. Something is climbing out of it. Something big.');
          g.later(6, () => G.hud.radio('Varn command', 'Sovereign is awake. All units, fall back and let it work.'));
        } else if (T.kind !== 'air') G.hud.radio('Bastion', `Waypoint ${T.i + 1}: ${this.text(T)}.`);
        if (g.m.story) G.storyRadio(g, 'arrive', T.i);
      }
      if (T.arrived) T.t += dt;
      if (T.kind === 'air' && T.arrived && T.spawnedN < T.n) {
        T.waveCd = (T.waveCd || 0) - dt;
        if (this.alive(T) < 2 && T.waveCd <= 0) { const k = Math.min(3, T.n - T.spawnedN); this.fighters(T, k); T.waveCd = 8; G.hud.radio('Bastion', `${k} fighters inbound on waypoint ${T.i + 1}.`); }
      }
    }
    this.rescueRecon(dt);
    for (const X of this.tasks) if (!X.done && this.isDone(X)) {
      X.done = true; G.audio.chime(); G.hud.flash(`WAYPOINT ${X.i + 1} COMPLETE`);
      const nx = this.tasks.find(t => !t.done && t !== X);
      G.hud.radio('Bastion', `Waypoint ${X.i + 1} complete.${nx ? ` Proceed to waypoint ${nx.i + 1}: ${this.text(nx)}.` : ''}`);
      if (g.m.story) G.storyRadio(g, 'done', X.i);
    }
    while (this.cur < this.tasks.length && this.tasks[this.cur].done) this.cur++;
    g.objDone = this.tasks.filter(t => t.done).length;
    if (this.cur >= this.tasks.length && !this.rtb) {
      this.rtb = true; g.complete = true; G.audio.chime();
      G.hud.radio('Bastion', 'All waypoints complete. Return to the Bastion and set down on the deck. R lets you skip the flight home.');
    }
    this.marks();
    if (this.rtb && P.alive) {
      const dc = Math.hypot(P.pos.x - C.x, P.pos.z - C.z);
      if (dc < 300 && P.pos.y < C.deck + 140) {
        if (g.holdRTB()) { if (g.time - (this.holdT || -99) > 8) { this.holdT = g.time; G.hud.radio(G.OFFICER.short, 'Deck is closed while Hollow is overhead. Deal with him first.'); } }
        else { G.hud.radio('Bastion', 'Wheels down. Welcome home.'); g.end(true, 'Returned to the Bastion'); }
      }
    }
  }
  marks(){
    const g = this.g;
    const want = this.rtb ? {pos:new V3(C.x, C.deck + 20, C.z), label:'HOME', color:'#6dff9a'} : (() => { const T = this.tasks[this.cur]; if (!T) return null; return {pos:new V3(T.C.x, Math.max(g.world.height(T.C.x, T.C.z), 0) + 60, T.C.z), label:`WP${T.i + 1}`, color:'#ffb238'}; })();
    const key = want ? want.label : '';
    if (key === this.markKey) return;
    if (this.mark) { const k = g.marks.indexOf(this.mark); if (k >= 0) g.marks.splice(k, 1); }
    this.mark = want; this.markKey = key; if (want) g.marks.push(want);
  }
  rescueRecon(dt){
    const g = this.g, P = g.player; g.rescue = null;
    for (const c of g.civGroups) {
      if (c.done) continue;
      if (Math.random() < dt*8) g.fx.green(new V3(c.pos.x + 6, c.pos.y + 4, c.pos.z));
      const hd = Math.hypot(P.pos.x - c.pos.x, P.pos.z - c.pos.z), hs = Math.hypot(P.vel.x, P.vel.z);
      if (hd < 60 && P.alive) {
        if (P.mode !== 'jet' && P.agl < 8 && hs < 22) {
          c.prog += dt*(P.mode === 'mech' ? 2 : 1); g.rescue = {p:c.prog/5, hold:true};
          if (c.prog >= 5) { c.done = true; g.scene.remove(c.mesh); G.audio.chime(); for (let i = 0; i < 40; i++) g.fx.green(c.pos); const TT = this.tasks[c.task], node = g.m.story && G.STORY[g.m.story]; if (TT && TT.who && node && node.boardLine) G.hud.radio(TT.who, node.boardLine); else G.hud.radio(TT && TT.who || 'Civilians', `Everyone's aboard. Thank you, ${G.save.callsign || 'Kestrel'}!`); }
        } else g.rescue = {p:c.prog/5, hold:false};
      } else if (c.prog > 0) c.prog = Math.max(0, c.prog - dt*0.5);
    }
    for (const w of g.waypoints) {
      if (w.done) continue;
      if (Math.hypot(P.pos.x - w.pos.x, P.pos.z - w.pos.z) < 95 && P.pos.y - w.pos.y < 150 && P.alive) { w.done = true; G.audio.chime(); G.hud.radio('Bastion', 'Site imaged.'); }
    }
  }
};

/* ---------- The Bastion: an island-sized battle carrier ---------- */
let deckTex = null, panelTex = null, numTex = null;
function deckTexture(){
  if (deckTex) return deckTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 3072; const x = c.getContext('2d');
  x.fillStyle = '#41474d'; x.fillRect(0, 0, 512, 3072);
  for (let i = 0; i < 9000; i++) { const v = Math.random() < 0.5 ? 255 : 0; x.fillStyle = `rgba(${v},${v},${v},${Math.random()*0.035})`; x.fillRect(Math.random()*512, Math.random()*3072, 2 + Math.random()*5, 2 + Math.random()*10); }
  x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2; for (let y = 0; y < 3072; y += 52) { x.beginPath(); x.moveTo(0, y); x.lineTo(512, y); x.stroke(); }
  for (let xx = 0; xx < 512; xx += 128) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, 3072); x.stroke(); }
  // tyre marks along the catapult track
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + Math.random()*0.06})`; x.fillRect(180 + Math.random()*40, 300 + Math.random()*2400, 4, 120 + Math.random()*300); }
  x.fillStyle = '#e8e6de'; for (let y = 120; y < 3000; y += 120) x.fillRect(250, y, 12, 60);
  x.fillStyle = '#e8c23a'; x.fillRect(168, 440, 10, 2520); x.fillRect(8, 0, 10, 3072); x.fillRect(494, 0, 10, 3072);
  x.fillStyle = '#d8662a'; for (let y = 0; y < 3072; y += 40) { x.fillRect(0, y, 8, 20); x.fillRect(504, y + 20, 8, 20); }
  x.save(); x.translate(256, 2760); x.fillStyle = 'rgba(232,230,222,0.92)'; x.font = 'bold 190px "Saira Extra Condensed","Arial Narrow",sans-serif'; x.textAlign = 'center'; x.rotate(Math.PI); x.fillText('01', 0, 0); x.restore();
  for (let i = 0; i < 3; i++) { x.strokeStyle = '#e8e6de'; x.lineWidth = 7; x.beginPath(); x.arc(340, 600 + i*760, 52, 0, 7); x.stroke(); x.fillStyle = '#e8e6de'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.fillText('H', 340, 618 + i*760); }
  deckTex = new THREE.CanvasTexture(c); deckTex.anisotropy = 8; return deckTex;
}
function panelTexture(){
  if (panelTex) return panelTex;
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 130; i++) { x.fillStyle = `rgba(0,0,0,${Math.random()*0.08})`; x.fillRect(Math.random()*512, Math.random()*512, 30 + Math.random()*140, 20 + Math.random()*90); }
  for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(92,52,26,${0.04 + Math.random()*0.14})`; const px = Math.random()*512; x.fillRect(px, Math.random()*512, 2 + Math.random()*5, 30 + Math.random()*150); }
  x.strokeStyle = 'rgba(20,26,32,0.32)'; x.lineWidth = 2;
  for (let r = 0; r < 8; r++) { const y = r*64; x.beginPath(); x.moveTo(0, y + 1); x.lineTo(512, y + 1); x.stroke(); let px = (r % 2)*48; while (px < 512) { x.beginPath(); x.moveTo(px + 1, y); x.lineTo(px + 1, y + 64); x.stroke(); px += 96 + ((r*41 + px) % 70); } }
  x.fillStyle = 'rgba(20,26,32,0.28)'; for (let r = 0; r < 8; r++) for (let px = 8; px < 512; px += 16) x.fillRect(px, r*64 + 5, 2, 2);
  panelTex = new THREE.CanvasTexture(c); panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping; panelTex.repeat.set(1/36, 1/36); panelTex.anisotropy = 8; return panelTex;
}
function hullNumber(){
  if (numTex) return numTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.font = 'bold 230px "Saira Extra Condensed","Arial Narrow",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('01', 256, 140);
  numTex = new THREE.CanvasTexture(c); return numTex;
}
/* Hull kit (the same helpers space.js uses for the Varn ships): tiling panel textures with normal and lit-window maps, a batcher
   that merges every part sharing a material into one mesh with box-projected UVs, and a flat-shaded loft over cross-sections. */
function rng(seed){ let s = seed % 2147483647 || 7; return () => (s = (s*16807) % 2147483647)/2147483647; }
const TEXC = {};
function canvasTex(c, rep){ const t = new THREE.CanvasTexture(c); if (rep !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
function panelSet(key, seed, o = {}){
  if (TEXC[key]) return TEXC[key];
  const N = o.size || 1024, R = rng(seed), min = o.min || 56, base = o.base || 176, vary = o.vary === undefined ? 26 : o.vary;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const ca = mk(), ch = mk(), ce = mk(), a = ca.getContext('2d'), h = ch.getContext('2d'), e = ce.getContext('2d');
  const gr = v => { v = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${v},${v},${v})`; };
  a.fillStyle = gr(base*0.5); a.fillRect(0, 0, N, N); h.fillStyle = gr(30); h.fillRect(0, 0, N, N); e.fillStyle = '#000'; e.fillRect(0, 0, N, N);
  const panels = [];
  const split = (x, y, w, hh, d) => {
    if (d > 0 && R() < 0.9) {
      if (w >= hh && w >= min*2) { const k = Math.max(min, Math.min(w - min, Math.round(w*(0.3 + R()*0.4)/8)*8)); split(x, y, k, hh, d - 1); split(x + k, y, w - k, hh, d - 1); return; }
      if (hh >= min*2) { const k = Math.max(min, Math.min(hh - min, Math.round(hh*(0.3 + R()*0.4)/8)*8)); split(x, y, w, k, d - 1); split(x, y + k, w, hh - k, d - 1); return; }
    }
    panels.push([x, y, w, hh]);
  };
  const C = o.cells || 4, cs = N/C; for (let i = 0; i < C; i++) for (let j = 0; j < C; j++) split(i*cs, j*cs, cs, cs, o.depth === undefined ? 3 : o.depth);
  for (const [x, y, w, hh] of panels) {
    const v = base + (R() - 0.5)*vary, lvl = 130 + R()*70, t = R(), gp = o.gap || 2;
    a.fillStyle = gr(v); a.fillRect(x + gp, y + gp, w - 2*gp, hh - 2*gp); h.fillStyle = gr(lvl); h.fillRect(x + gp, y + gp, w - 2*gp, hh - 2*gp);
    a.fillStyle = 'rgba(255,255,255,0.07)'; a.fillRect(x + gp, y + gp, w - 2*gp, 2); a.fillStyle = 'rgba(0,0,0,0.12)'; a.fillRect(x + gp, y + hh - gp - 3, w - 2*gp, 3);
    if (o.win && w >= 72 && hh >= 40 && t < o.win) {
      const rows = Math.min(3, Math.floor((hh - 18)/20));
      for (let r = 0; r < rows; r++) { const y0 = y + 12 + r*20; if (R() < 0.25) continue;
        for (let x0 = x + 12; x0 < x + w - 18; x0 += 15) { a.fillStyle = gr(26); a.fillRect(x0 - 1, y0 - 1, 10, 7); h.fillStyle = gr(lvl - 70); h.fillRect(x0 - 1, y0 - 1, 10, 7);
          if (R() < 0.6) { const c = R(); e.fillStyle = c < 0.7 ? '#ffd9a0' : c < 0.9 ? '#fff2d8' : '#a8d8ff'; e.globalAlpha = 0.55 + R()*0.45; e.fillRect(x0, y0, 8, 5); e.globalAlpha = 1; } } }
    } else if (t < 0.34) { a.fillStyle = gr(v + 9); a.fillRect(x + 9, y + 9, w - 18, hh - 18); h.fillStyle = gr(lvl + 34); h.fillRect(x + 9, y + 9, w - 18, hh - 18); }
    else if (t < 0.46 && w > 40 && hh > 30) { for (let yy = y + 10; yy < y + hh - 10; yy += 7) { a.fillStyle = gr(v*0.4); a.fillRect(x + 10, yy, w - 20, 3); h.fillStyle = gr(lvl - 80); h.fillRect(x + 10, yy, w - 20, 3); } }
    else if (t < 0.53) { a.fillStyle = gr(v*(o.dark || 0.6)); a.fillRect(x + gp, y + gp, w - 2*gp, hh - 2*gp); }
    else if (t < 0.62 && o.dots) { for (let yy = y + 10; yy < y + hh - 8; yy += 12) for (let xx = x + 10; xx < x + w - 8; xx += 12) { h.fillStyle = gr(lvl + 50); h.fillRect(xx, yy, 5, 5); a.fillStyle = gr(v + 12); a.fillRect(xx, yy, 5, 5); } }
    h.fillStyle = gr(lvl + 40); for (const [px, py] of [[x + 6, y + 6], [x + w - 9, y + 6], [x + 6, y + hh - 9], [x + w - 9, y + hh - 9]]) h.fillRect(px, py, 3, 3);
  }
  // grime: soft blotches and streaks, drawn wrapped so the tile repeats cleanly
  const wrap = (fn) => { for (const dx of [0, -N]) for (const dy of [0, -N]) fn(dx, dy); };
  for (let i = 0; i < 260; i++) { const x = R()*N, y = R()*N, w = 20 + R()*200, hh = 10 + R()*120, c = R() < 0.6 ? 0 : 255, al = 0.02 + R()*0.05; a.fillStyle = `rgba(${c},${c},${c},${al})`; wrap((dx, dy) => a.fillRect(x + dx, y + dy, w, hh)); }
  for (let i = 0; i < 90; i++) { const x = R()*N, y = R()*N, hh = 40 + R()*220; a.fillStyle = `rgba(0,0,0,${0.04 + R()*0.06})`; wrap((dx, dy) => a.fillRect(x + dx, y + dy, 2 + R()*4, hh)); }
  // normal map from the height canvas (one 3×3 blur first so panel edges read as small bevels)
  const hd = h.getImageData(0, 0, N, N).data, H0 = new Float32Array(N*N), H1 = new Float32Array(N*N);
  for (let i = 0; i < N*N; i++) H0[i] = hd[i*4]/255;
  for (let j = 0; j < N; j++) { const jm = ((j - 1 + N) % N)*N, j0 = j*N, jp = ((j + 1) % N)*N;
    for (let i = 0; i < N; i++) { const im = (i - 1 + N) % N, ip = (i + 1) % N; H1[j0 + i] = (H0[jm + im] + H0[jm + i] + H0[jm + ip] + H0[j0 + im] + H0[j0 + i] + H0[j0 + ip] + H0[jp + im] + H0[jp + i] + H0[jp + ip])/9; } }
  const cn = mk(), nx = cn.getContext('2d'), img = nx.createImageData(N, N), d = img.data, s = o.bump || 2.6;
  for (let j = 0; j < N; j++) { const jm = ((j - 1 + N) % N)*N, j0 = j*N, jp = ((j + 1) % N)*N;
    for (let i = 0; i < N; i++) { const im = (i - 1 + N) % N, ip = (i + 1) % N; let x = -(H1[j0 + ip] - H1[j0 + im])*s, y = (H1[jp + i] - H1[jm + i])*s; const l = 1/Math.hypot(x, y, 1), k = (j0 + i)*4;
      d[k] = (x*l*0.5 + 0.5)*255; d[k + 1] = (y*l*0.5 + 0.5)*255; d[k + 2] = (l*0.5 + 0.5)*255; d[k + 3] = 255; } }
  nx.putImageData(img, 0, 0);
  return TEXC[key] = {map:canvasTex(ca), normalMap:canvasTex(cn), emissiveMap:canvasTex(ce)};
}
const BM = new THREE.Matrix4(), BN = new THREE.Matrix3(), BQ = new THREE.Quaternion(), BE = new THREE.Euler(0, 0, 0, 'YXZ'), BP = new V3(), BS = new V3(1, 1, 1), BV = new V3(), BA = new V3(), BB = new V3();
const flat = geo => { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; };
class Batch {
  constructor(){ this.map = new Map(); }
  // rotation order is yaw (ry) after pitch (rx) after roll (rz)
  add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0){
    const gi = geo.index ? geo.toNonIndexed() : geo, P = gi.attributes.position, Nn = gi.attributes.normal;
    BM.compose(BP.set(x, y, z), BQ.setFromEuler(BE.set(rx, ry, rz, 'YXZ')), BS); BN.getNormalMatrix(BM);
    let e = this.map.get(mat); if (!e) this.map.set(mat, e = {p:[], n:[]});
    for (let i = 0; i < P.count; i++) { BV.fromBufferAttribute(P, i).applyMatrix4(BM); e.p.push(BV.x, BV.y, BV.z); BV.fromBufferAttribute(Nn, i).applyMatrix3(BN).normalize(); e.n.push(BV.x, BV.y, BV.z); }
    return this;
  }
  build(parent, shadow = true){
    const out = [];
    for (const [mat, e] of this.map) {
      if (this.warp) for (let i = 0; i < e.p.length; i += 3) e.p[i] = this.warp(e.p[i], e.p[i + 1], e.p[i + 2]);   // a smooth bend applied to the merged parts
      const g = new THREE.BufferGeometry(), p = e.p; g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(e.n, 3));
      if (mat.map || mat.normalMap) {   // box-projected UVs: each triangle is mapped along its dominant axis, at a fixed number of tiles per metre
        const k = mat.userData.uv || 1/96, uv = new Float32Array(p.length/3*2);
        for (let i = 0; i < p.length; i += 9) {
          BA.set(p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]); BB.set(p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]); BA.cross(BB);
          const ax = Math.abs(BA.x), ay = Math.abs(BA.y), az = Math.abs(BA.z), o = i/3*2;
          for (let v = 0; v < 3; v++) { const X = p[i + v*3], Y = p[i + v*3 + 1], Z = p[i + v*3 + 2];
            if (ax >= ay && ax >= az) { uv[o + v*2] = Z*k; uv[o + v*2 + 1] = Y*k; } else if (ay >= az) { uv[o + v*2] = X*k; uv[o + v*2 + 1] = Z*k; } else { uv[o + v*2] = X*k; uv[o + v*2 + 1] = Y*k; } }
        }
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      const m = new THREE.Mesh(g, mat), lit = shadow && !mat.isMeshBasicMaterial && !mat.transparent; m.castShadow = m.receiveShadow = lit; parent.add(m); out.push(m);
    }
    return out;
  }
}
// A flat-shaded skin over a row of cross-sections (each a closed polygon of [x, y, z] with the same point count), capped at both ends.
function loft(secs, closed){
  const pos = [], n = secs[0].length, L = secs.length;
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < (closed ? L : L - 1); i++) { const s0 = secs[i], s1 = secs[(i + 1) % L];
    for (let j = 0; j < n; j++) { const k = (j + 1) % n; tri(s0[j], s0[k], s1[k]); tri(s0[j], s1[k], s1[j]); } }
  if (!closed) for (const i of [0, L - 1]) { const s = secs[i], c = [0, 0, 0]; for (const q of s) { c[0] += q[0]/n; c[1] += q[1]/n; c[2] += q[2]/n; }
    for (let j = 0; j < n; j++) { const k = (j + 1) % n; if (i) tri(c, s[j], s[k]); else tri(c, s[k], s[j]); } }
  let vol = 0; const out = [];
  for (let i = 0; i < pos.length; i += 9) vol += pos[i]*(pos[i + 4]*pos[i + 8] - pos[i + 5]*pos[i + 7]) - pos[i + 1]*(pos[i + 3]*pos[i + 8] - pos[i + 5]*pos[i + 6]) + pos[i + 2]*(pos[i + 3]*pos[i + 7] - pos[i + 4]*pos[i + 6]);
  for (let i = 0; i < pos.length; i += 9) {   // drop zero-area triangles; turn everything outward if the winding came out inside-out
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2], vx = pos[i + 6] - pos[i], vy = pos[i + 7] - pos[i + 1], vz = pos[i + 8] - pos[i + 2];
    if (Math.hypot(uy*vz - uz*vy, uz*vx - ux*vz, ux*vy - uy*vx) < 1e-4) continue;
    if (vol < 0) out.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 6], pos[i + 7], pos[i + 8], pos[i + 3], pos[i + 4], pos[i + 5]); else for (let k = 0; k < 9; k++) out.push(pos[i + k]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals(); return g;
}
G.buildCarrier = function(space){
  /* The Bastion: a battle carrier that sails and flies, built so you can see how it would unfold into a giant mech (it never
     does in play). The deep central hull under the flight deck is the torso. The two lance hulls outboard are its arms, stowed
     pointing forward: shoulder pivots on the quarters, an elbow hinge, an armoured forearm with a rail battery, and a closed
     fist at each tip; locking clamps hold them to the hull. The stern is the pair of legs folded aft: hip pivots, thighs,
     knees, shins, and feet whose soles are the main engines. The citadel on the pelvis is the chest, with the head on lift
     rams above it. Allied palette: light grey hull, slate-blue armour, navy trim, orange safety markings, a red boot line.
     Fixed by gameplay (launch sequence, landing, world.height): the flight deck plane and its lanes, the island's footprint,
     the elevator, the blast deflector, and the clear air over the deck's middle and ahead of the bow. */
  const g = new THREE.Group(), D = C.deck, u = g.userData, PI = Math.PI, B = new Batch(), R = rng(6101);
  // The lance hulls toe in toward the bow, so the ship is wide at the stern and narrows forward: everything outboard of
  // the hull (|x| > 70, blending in from 52) is bent inward by 7 cm per metre forward of z = -150 (their tips end about 43 m off the centreline, below the deck).
  const TOE = 0.07, warp = (x, y, z) => { const ax = Math.abs(x), t = Math.max(0, Math.min(1, (ax - 52)/18)), w = t*t*(3 - 2*t); return x - Math.sign(x)*w*Math.max(0, z + 150)*TOE; };
  B.warp = warp;
  const ps = panelSet('ally', 31, {win:0.12, cells:1, depth:7, base:206, vary:11, dark:0.88, bump:2.2});
  const S = (o, uv) => { const m = new THREE.MeshStandardMaterial(Object.assign({roughness:0.64, metalness:0.3}, o)); m.userData.uv = uv || 1/70; return m; }, basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({color:c}, o));
  const hull = S({color:0xa4abb1, map:ps.map, normalMap:ps.normalMap, emissive:0xffffff, emissiveMap:ps.emissiveMap, emissiveIntensity:0.8});
  const plate = S({color:0x8d959c, map:ps.map, normalMap:ps.normalMap}), hullD = S({color:0x474f57, map:ps.map, normalMap:ps.normalMap});
  const armour = S({color:0x4f6a85, map:ps.map, normalMap:ps.normalMap}), navy = S({color:0x223450, map:ps.map, normalMap:ps.normalMap}), trim = S({color:0x1b2026, roughness:0.6, metalness:0.45});
  const orange = S({color:0xc8652a, roughness:0.7, metalness:0.15}), red = S({color:0x9a3127, roughness:0.7, metalness:0.15}), white = S({color:0xd0d2cc, roughness:0.6, metalness:0.2}), glass = S({color:0x16283a, roughness:0.08, metalness:0.75});
  const lamp = basic(0xfff0b0), lampG = basic(0x7dff9a), redLamp = basic(0xff4a30), glowM = basic(0x9fdcff), bayM = basic(0x2a2318), bayL = basic(0xffe2a8), railM = basic(0x6fe3ff);
  const bx = (w, h, d, m, x, y, z, ry = 0, rx = 0, rz = 0) => B.add(m, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  const zc = (rf, rb, len, seg, m, x, y, z, fl) => { const c = new THREE.CylinderGeometry(rf, rb, len, seg).rotateX(PI/2); B.add(m, fl ? flat(c) : c, x, y, z); };   // cylinder along z; rf = forward radius
  const yc = (rt, rb, h, seg, m, x, y, z, fl) => { const c = new THREE.CylinderGeometry(rt, rb, h, seg); B.add(m, fl ? flat(c) : c, x, y, z, 0, PI/seg, 0); };
  const ys = (y, hw, zf, zb, cx = 0) => [[cx + hw, y, zf], [cx + hw, y, zb], [cx - hw, y, zb], [cx - hw, y, zf]];   // rectangle at a height
  const lerp = (a, b, k) => a + (b - a)*k;
  // a small twin-barrel turret, merged into the batch
  const turret = (x, y, z, yaw, k = 1) => { const c = Math.cos(yaw), s = Math.sin(yaw), at = (dx, dz) => [x + dx*c + dz*s, z - dx*s + dz*c];
    B.add(hullD, flat(new THREE.CylinderGeometry(3*k, 3.5*k, 1.6*k, 8)), x, y + 0.8*k, z, 0, yaw, 0); bx(4.4*k, 2.6*k, 5*k, plate, x, y + 2.9*k, z, yaw); bx(4.6*k, 0.5*k, 2*k, armour, x, y + 4.3*k, z, yaw);
    for (const o of [-0.9, 0.9]) { const q = at(o*k, 5*k); B.add(trim, new THREE.CylinderGeometry(0.28*k, 0.28*k, 7*k, 6), q[0], y + 3.1*k, q[1], PI/2, yaw, 0); } };

  /* ---- central hull: upper works in grey, underwater body in navy, a red boot line between ---- */
  // stations: z, half-widths at the gallery (top), at mid height (y 30), at the waterline (y 4) and at the bottom; top and bottom heights
  const ST = [[-300, 62, 68, 58, 36, D - 5, -16], [-252, 47, 51, 47, 31, D - 5, -18], [-200, 46, 50, 46, 30, D - 5, -18], [120, 46, 50, 46, 30, D - 5, -18], [220, 41, 38, 30, 14, D - 5, -17], [292, 35, 25, 14, 5, D - 5.5, -15], [342, 19, 11, 5, 2, D - 6, -12]];
  const up = ([z, wT, wM, wW, , yT]) => [[wW, 4, z], [wM, 30, z], [wT, yT, z], [-wT, yT, z], [-wM, 30, z], [-wW, 4, z]];
  const lo = ([z, , , wW, wB, , yB]) => [[wB, yB, z], [wW, 4, z], [-wW, 4, z], [-wB, yB, z]];
  const prowU = [[1, 4, 358], [1.6, 30, 376], [2.4, D - 6.6, 392], [-2.4, D - 6.6, 392], [-1.6, 30, 376], [-1, 4, 358]], prowL = [[0.6, -9, 346], [1, 4, 358], [-1, 4, 358], [-0.6, -9, 346]];
  B.add(hull, loft([...ST.map(up), prowU])); B.add(navy, loft([...ST.map(lo), prowL]));
  const wAt = (z, y) => { let i = 0; while (i < ST.length - 2 && z > ST[i + 1][0]) i++; const a = ST[i], b = ST[i + 1], k = Math.max(0, Math.min(1, (z - a[0])/(b[0] - a[0]))), f = j => lerp(a[j], b[j], k);
    return y < 30 ? lerp(f(3), f(2), (y - 4)/26) : lerp(f(2), f(1), (y - 30)/(D - 35)); };
  const slab = (m, z0, z1, y0, y1, out, n = 8) => B.add(m, loft(Array.from({length:n + 1}, (_, i) => { const z = lerp(z0, z1, i/n), a = wAt(z, y0) + out, b = wAt(z, y1) + out; return [[a, y0, z], [b, y1, z], [-b, y1, z], [-a, y0, z]]; })));
  slab(red, -300, 340, 3, 5.6, 0.35, 14);                                    // boot line
  slab(armour, -214, 196, 12, 34, 1.6, 10); slab(orange, -214, 196, 35.2, 36.2, 0.5, 10);      // armour belt and its safety line
  for (let z = -200; z <= 190; z += 30) for (const s of [-1, 1]) { const w = wAt(z, 23) + 2.2; bx(1.6, 23, 2.4, hullD, s*w, 23, z, 0, 0, s*0.14); }
  // the flight-deck slab and its edge galleries
  bx(100.6, 4.6, 590.6, navy, 0, D - 2.3, 8); bx(101.4, 0.5, 591.4, orange, 0, D - 4.4, 8);
  for (const s of [-1, 1]) for (const [z0, z1] of (s < 0 ? [[-212, 300], [-286, -248]] : [[-286, 300]])) { const L = z1 - z0, zm = (z0 + z1)/2;
    bx(4.4, 0.5, L, hullD, s*52.4, D - 2.6, zm); bx(0.3, 1.6, L, trim, s*54.5, D - 1.6, zm); bx(0.36, 0.3, L, orange, s*54.5, D - 0.8, zm);
    for (let z = z0 + 6; z < z1; z += 24) bx(4.4, 3, 1, trim, s*52.4, D - 4.2, z, 0, 0, s*0.5); }
  for (const s of [-1, 1]) for (const z of [232, 262, 290]) bx(3, 3, 26 - (z - 232)*0.1, hullD, s*(wAt(z, D - 12) + 8), D - 12, z, 0, 0, s*0.9);   // braces under the bow overhang
  for (let z = -170; z <= 170; z += 34) for (const s of [-1, 1]) { if (s < 0 && z < -200) continue; const w = wAt(z, 46) + 0.5; bx(0.6, 5, 20, bayM, s*w, 46, z, 0, 0, s*0.07); bx(0.5, 0.6, 18, lamp, s*(w + 0.3), 49.2, z); }   // lit gallery openings
  // prow: stem band, hawse recesses, bow number
  for (const s of [-1, 1]) { bx(1, 5, 7, trim, s*(wAt(318, 40) + 0.3), 40, 318, -s*0.36); bx(0.8, 2, 30, orange, s*(wAt(322, 50) + 0.3), 50, 322, -s*0.36); }
  // forecastle ahead of the flight deck, one level down: breakwater, capstans, a bow turret (all below deck level, so the launch path stays clear)
  for (const s of [-1, 1]) { bx(1, 2.4, 22, hullD, s*9, D - 4.6, 330, s*0.9); yc(1.6, 1.8, 1.6, 8, trim, s*8, D - 5, 352, true); bx(0.5, 0.3, 60, orange, s*4, D - 5.75, 350, -s*0.2); }
  turret(0, D - 5.9, 316, 0, 0.95); bx(2, 0.6, 20, trim, 0, D - 5.6, 372);
  // keel: a long ventral fin with a sensor gondola (it only shows in orbit)
  B.add(armour, loft([[[3, -14, 210], [1, -26, 196], [-1, -26, 196], [-3, -14, 210]], [[10, -14, 150], [4, -38, 140], [-4, -38, 140], [-10, -14, 150]], [[10, -14, -220], [4, -40, -210], [-4, -40, -210], [-10, -14, -220]], [[4, -14, -268], [1, -30, -250], [-1, -30, -250], [-4, -14, -268]]]));
  bx(8.6, 1.2, 330, orange, 0, -27, -35); zc(4, 6, 60, 10, hullD, 0, -43, -20, true); B.add(white, new THREE.SphereGeometry(5.6, 14, 8), 0, -44, 16);
  for (const z of [80, -120]) { yc(5, 4, 3, 8, hullD, 0, -41, z, true); bx(5, 2.4, 6, plate, 0, -43.5, z); for (const o of [-1, 1]) zc(0.3, 0.3, 8, 6, trim, o, -43.8, z + 6); }
  for (let z = -180; z <= 160; z += 40) for (const s of [-1, 1]) bx(0.8, 0.5, 4, z % 80 ? lamp : redLamp, s*(wAt(z, 4)*0.62), lerp(-17.6, -18.3, 0.5), z);

  /* ---- the two lance hulls are the arms, stowed pointing forward: shoulder pivot on the hull's quarter, upper arm, elbow hinge,
          armoured forearm carrying the rail battery, wrist collar and a closed fist. Locking clamps tie them to the hull. ---- */
  const LX = 84, lsec = (z, k, yb, y1, y2, yt, s) => [[6*k, yb], [14*k, y1], [14*k, y2], [9*k, yt], [-9*k, yt], [-14*k, y2], [-14*k, y1], [-6*k, yb]].map(([x, y]) => [s*LX + x, y, z]);
  const xc = (r, len, seg, m, x, y, z, fl) => { const c = new THREE.CylinderGeometry(r, r, len, seg).rotateZ(PI/2); B.add(m, fl ? flat(c) : c, x, y, z); };   // cylinder across the ship (a hinge drum)
  // a hinge: drum, hub caps, orange index rings and a ring of bolts on each face
  const hinge = (x, y, z, r, len) => { xc(r, len, 20, hullD, x, y, z); xc(r*0.5, len + 3, 12, trim, x, y, z); for (const o of [-1, 1]) { xc(r*1.04, 1.4, 20, orange, x + o*(len/2 - 1.6), y, z); xc(r*0.3, len + 5, 8, white, x, y, z);
      for (let i = 0; i < 8; i++) { const a = i*PI/4; bx(0.8, 1.2, 1.2, trim, x + o*(len/2 + 0.3), y + Math.sin(a)*r*0.76, z + Math.cos(a)*r*0.76); } } };
  const piston = (x, y, z0, z1, r = 1.5) => { const L = Math.abs(z1 - z0), zm = (z0 + z1)/2; zc(r, r, L, 8, white, x, y, zm); zc(r*1.7, r*1.7, L*0.45, 8, hullD, x, y, z0 + (z1 - z0)*0.26); for (const z of [z0, z1]) bx(r*3, r*3, r*2.4, trim, x, y, z); };
  for (const s of [-1, 1]) {
    // shoulder: a clavicle stub out of the hull, the pivot drum, and a pauldron over it
    bx(26, 24, 44, hullD, s*58, 22, -150); bx(26.6, 1.2, 45, orange, s*58, 35, -150); bx(22, 3, 50, plate, s*58, 36.5, -150);
    hinge(s*LX, 20, -150, 21, 34);
    B.add(armour, loft([ys(34, 19.5, -112, -188, s*LX), ys(44, 18, -116, -184, s*LX), ys(52, 12, -128, -174, s*LX)])); bx(24.6, 1, 60, orange, s*LX, 44.6, -150); bx(6, 1.6, 30, hullD, s*LX, 52.6, -151);
    B.add(navy, loft([ys(-12, 9, -128, -172, s*LX), ys(6, 17, -116, -184, s*LX)]));
    // upper arm
    B.add(armour, loft([lsec(-120, 0.86, -6, 9, 31, 37, s), lsec(-106, 1, -10, 8, 32, 40, s), lsec(66, 1, -10, 8, 32, 40, s), lsec(80, 0.84, -5, 10, 30, 36, s)]));
    B.add(navy, loft([-106, 66].map(z => [[s*LX + 6.3, -10.4, z], [s*LX + 12.7, 4, z], [s*LX - 12.7, 4, z], [s*LX - 6.3, -10.4, z]])));
    bx(15, 1.2, 164, plate, s*LX, 40.4, -20); bx(18.6, 0.4, 164, orange, s*LX, 39.6, -20); bx(29.2, 2.2, 150, hullD, s*LX, 20, -22); bx(29.6, 0.6, 150, orange, s*LX, 27, -22);
    for (const z of [-96, -58, -20, 18, 56]) bx(29.4, 22, 2.6, hullD, s*LX, 20, z);
    // elbow: hinge drum between two cheek plates, pistons bridging the joint above and outboard
    hinge(s*LX, 15, 96, 15, 31); for (const o of [-1, 1]) { bx(1.6, 30, 44, plate, s*LX + o*15.2, 16, 96); bx(2, 4, 48, orange, s*LX + o*15.3, 32, 96); piston(s*LX + o*5, 43.4, 52, 138); }
    piston(s*(LX + 16.4), 8, 60, 132, 1.3);
    // forearm: a heavier armoured gauntlet
    B.add(armour, loft([lsec(110, 0.9, -6, 9, 31, 37, s), lsec(124, 1.1, -11, 7, 33, 41, s), lsec(300, 1.1, -11, 7, 33, 41, s), lsec(350, 0.96, -8, 8, 32, 39, s), lsec(362, 0.8, -3, 10, 30, 36, s)]));
    B.add(navy, loft([124, 300].map(z => [[s*LX + 6.9, -11.4, z], [s*LX + 13.6, 4, z], [s*LX - 13.6, 4, z], [s*LX - 6.9, -11.4, z]])));
    bx(16.4, 1.2, 190, plate, s*LX, 41.5, 222); bx(32, 2.4, 170, hullD, s*LX, 20, 214); bx(32.4, 0.6, 170, orange, s*LX, 27.4, 214);
    for (const z of [140, 178, 216, 254, 292]) { bx(32.2, 24, 2.6, hullD, s*LX, 20, z); for (const o of [-1, 1]) bx(0.8, 0.8, 0.8, o*s > 0 && z % 4 ? redLamp : lamp, s*LX + o*16.2, 31, z + 19); }
    bx(27.6, 1.6, 420, red, s*LX, 4.6, 125);                                                               // boot line
    for (const z of [-60, 20]) turret(s*LX, 41, z, 0, 1.5); turret(s*LX, 42.1, 160, 0, 1.5);
    for (const z of [-22, 222]) { const y = z > 100 ? 42.2 : 41.1; bx(7, 0.5, 26, trim, s*(LX + s*5.2), y, z); for (let i = -2; i <= 2; i++) bx(5, 0.4, 3.6, hullD, s*(LX + s*5.2), y + 0.35, z + i*5); bx(7.6, 0.3, 27, orange, s*(LX + s*5.2), y - 0.15, z); }   // missile hatches
    // forearm battery: a housing on the gauntlet with two rails running out over the fist
    B.add(hullD, loft([ys(41, 8, 372, 262, s*LX), ys(49, 5.6, 368, 276, s*LX)])); bx(11.6, 0.8, 80, orange, s*LX, 45, 322);
    bx(2.4, 5, 64, trim, s*LX, 45.4, 402); for (const o of [-1, 1]) { bx(1.8, 3.4, 72, hullD, s*LX + o*3.5, 45.4, 404); bx(0.5, 1.4, 62, railM, s*LX + o*2.4, 45.4, 406); } bx(10, 7.6, 3, orange, s*LX, 45.4, 373);
    // wrist collar and the fist: knuckle guard, four folded fingers, a thumb on the inboard side
    zc(12.6, 12.6, 5, 10, trim, s*LX, 17, 365, true); zc(13.4, 13.4, 1.6, 10, orange, s*LX, 17, 365, true);
    bx(22, 24, 30, hullD, s*LX, 17, 384); bx(23, 7, 9, plate, s*LX, 26.5, 398); bx(23.4, 1, 4, orange, s*LX, 29.6, 371.5);
    for (let i = 0; i < 4; i++) { const fx = s*LX - 8.1 + i*5.4; bx(4.6, 9, 9, plate, fx, 19, 402.5); bx(4.6, 9, 7, armour, fx, 10.4, 401.5); xc(2.2, 4.8, 8, trim, fx, 23.6, 404, true); xc(1.8, 4.8, 8, trim, fx, 14.6, 404.6, true); }
    bx(5, 9, 18, plate, s*(LX - 13.2), 12, 388, 0, 0.1); bx(5.2, 6, 8, armour, s*(LX - 13.2), 12.6, 400); xc(2.6, 6, 8, trim, s*(LX - 13.2), 13, 378, true);
    // locking clamps: an aft pair and a forward pair of armoured spans that hold the stowed arms, hangar doors glowing underneath
    for (const [zf, zb] of [[-34, -104], [196, 126]]) {
      B.add(armour, loft([[[s*42, 46, zf + 8], [s*42, 46, zb - 8], [s*42, 22, zb - 4], [s*42, 22, zf + 4]], [[s*74, 39, zf], [s*74, 39, zb], [s*74, 24, zb], [s*74, 24, zf]]]));
      const zm = (zf + zb)/2; bx(20, 1, zf - zb - 14, plate, s*59, 43.6, zm, 0, 0, -s*0.2); bx(24, 0.5, 2, orange, s*59, 43.9, zf - 5, 0, 0, -s*0.2); bx(24, 0.5, 2, orange, s*59, 43.9, zb + 5, 0, 0, -s*0.2);
      for (const o of [-1, 1]) { bx(5, 9, 6, hullD, s*72, 42, zm + o*(zf - zb)*0.3); bx(5.4, 2, 6.4, orange, s*72, 45.6, zm + o*(zf - zb)*0.3); }                         // latch blocks biting the arm
      bx(18, 0.5, zf - zb - 24, bayM, s*60, 22.6, zm); for (const o of [-1, 1]) bx(16, 0.4, 1, bayL, s*60, 22.3, zm + o*(zf - zb - 30)/2);
    }
    const fo = new THREE.MeshBasicMaterial({color:0xeef4f4, transparent:true, opacity:0.3, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4});
    if (!space) { for (const [x, len, zc0] of [[s*48, 560, 0], [s*(LX + 15), 480, 130], [s*(LX - 15), 480, 130]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(3.4, len), fo), lance = Math.abs(x) > 60; w.rotation.set(-PI/2, 0, lance ? -Math.sign(x)*TOE : 0); w.position.set(lance ? warp(x, 0, zc0) : x, 1.4, zc0); g.add(w); } }
  }

  /* ---- stern: the legs, folded aft. A pelvis block on the centreline; either side of it a hip pivot, an armoured thigh, a knee
          hinge with its kneecap, a shin, and a foot whose sole is the main engine nozzle with toe plates folded back around it.
          This is the widest part of the ship (about 145 m). The command citadel rides on the pelvis as chest and head. ---- */
  const rect = (z, x0, x1, y0, y1) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  B.add(hullD, loft([rect(-298, -25, 25, -14, D - 6), rect(-346, -24, 24, -13, D - 9), rect(-392, -19, 19, -8, D - 15)])); bx(40, 3, 80, navy, 0, -13.5, -340); bx(52, 0.8, 4, orange, 0, 40, -393);
  for (const z of [-316, -340, -364]) bx(50.6, 30, 2.4, trim, 0, 22, z);
  const NOZ = [[-11, 31, 10], [11, 31, 10], [-11, 9, 7], [11, 9, 7], [-48, 23, 15.5], [48, 23, 15.5]];
  for (const s of [-1, 1]) { const cx = s*48;
    hinge(cx, 22, -302, 23, 47);                                                                                       // hip pivot
    B.add(armour, loft([rect(-308, s*29, s*69, 3, 48), rect(-318, s*28, s*72, 1, 50), rect(-336, s*28, s*72, 1, 50), rect(-342, s*30, s*68, 4, 46)]));     // thigh
    bx(44.6, 1, 22, orange, cx, 50.2, -327); bx(30, 3, 16, plate, cx, 51, -327); bx(2, 30, 20, plate, s*72.6, 26, -327); bx(2.4, 2, 24, orange, s*72.7, 42, -327);
    hinge(cx, 22, -352, 16, 43); B.add(plate, loft([ys(38, 15, -340, -364, cx), ys(46, 11, -344, -360, cx)])); bx(22.4, 0.8, 16, orange, cx, 46.3, -352);        // knee and kneecap
    B.add(hull, loft([rect(-360, s*31, s*67, 3, 47), rect(-368, s*29, s*70, 1, 49), rect(-390, s*30, s*68, 3, 46), rect(-398, s*32, s*64, 6, 41)]));        // shin
    for (const z of [-374, -384]) bx(40.6, 46, 1.6, hullD, cx, 25, z); bx(2, 26, 18, armour, s*70.4, 26, -379);
    for (const y of [9, 39]) piston(s*74.2, y, -322, -378, 1.5);
    B.add(navy, loft([rect(-310, s*31, s*67, -12, 3), rect(-340, s*31, s*67, -12, 4)])); B.add(navy, loft([rect(-362, s*33, s*65, -10, 3), rect(-392, s*34, s*62, -6, 6)])); bx(44.8, 1.6, 30, red, cx, 3.6, -327); bx(41.6, 1.6, 26, red, cx, 3.6, -377);
    // foot: toe plates folded back over and under the nozzle, each on its own small hinge
    for (const [y, rx] of [[45.4, 0.1], [2.4, -0.1]]) { bx(28, 2.6, 30, armour, cx, y, -396, 0, rx); bx(28.4, 0.6, 4, orange, cx, y + Math.sign(rx)*1.5, -408, 0, rx); xc(2.8, 30, 10, trim, cx, y - Math.sign(rx)*1.8, -381, true); }
    for (const o of [-1, 1]) bx(2.4, 30, 26, armour, cx + o*17.6, 24, -398, o*0.1);
  }
  for (const [x, y, r] of NOZ) {
    zc(r*0.86, r*1.14, r*1.7, 16, hullD, x, y, -394 - r*0.6); zc(r*1.2, r*1.2, r*0.22, 16, trim, x, y, -394 - r*1.4); zc(r*0.96, r*0.96, 3, 16, armour, x, y, -392);
    B.add(space ? glowM : trim, new THREE.CircleGeometry(r*0.9, 16).rotateY(PI), x, y, -394 - r*1.42);
  }
  if (space) { const pm = basic(0x6fc8ff, {transparent:true, opacity:0.24, depthWrite:false, blending:THREE.AdditiveBlending}), pm2 = basic(0xd8f0ff, {transparent:true, opacity:0.4, depthWrite:false, blending:THREE.AdditiveBlending}), PB = new Batch();
    for (const [x, y, r] of NOZ) { const z = -394 - r*1.42; PB.add(pm, new THREE.ConeGeometry(r*0.86, r*6, 14, 1, true).rotateX(-PI/2), x, y, z - r*3); PB.add(pm2, new THREE.ConeGeometry(r*0.5, r*2.8, 12, 1, true).rotateX(-PI/2), x, y, z - r*1.4); }
    PB.build(g); }
  // chest: an armoured podium on the pelvis with a breastplate, two slatted intakes and a collar
  B.add(hull, loft([ys(D - 9, 33, -292, -378), ys(D + 14, 29, -297, -372)])); bx(59, 1.2, 76, navy, 0, D + 14.6, -334.5);
  B.add(armour, loft([ys(D + 15, 23, -300, -366), ys(D + 34, 18, -310, -360)])); for (const s of [-1, 1]) { B.add(hullD, loft([ys(D + 15, 5, -316, -350, s*26), ys(D + 30, 3, -322, -346, s*20)]));
    bx(13, 9, 1.4, trim, s*11, D + 24, -304.4, 0, -0.44); for (let i = 0; i < 4; i++) bx(12, 0.8, 1.8, plate, s*11, D + 20.8 + i*2.2, -303.2 - i*1.05, 0, -0.44); bx(0.8, 0.8, 0.8, s > 0 ? redLamp : lampG, s*30, D + 16, -300); }
  bx(5, 12, 1.6, orange, 0, D + 24, -304.6, 0, -0.44);
  yc(15, 17, 3, 10, trim, 0, D + 35.5, -334, true); yc(15.6, 15.6, 0.8, 10, orange, 0, D + 36.6, -334, true); for (const [x, z] of [[-11, -322], [11, -322], [-11, -346], [11, -346]]) { yc(1.1, 1.1, 7, 8, white, x, D + 39, z); yc(1.9, 1.9, 3, 8, hullD, x, D + 37.6, z); }   // collar and lift rams under the head
  // head: a faceted unit that could ride up on those rams. Visor band across the front, cheek guards, sensor pods as ears, a raked crest
  B.add(hull, loft([ys(D + 39, 13, -312, -352), ys(D + 43, 17, -306, -356), ys(D + 51, 17, -308, -356), ys(D + 57, 11, -318, -352)]));
  bx(30, 2.6, 0.7, glass, 0, D + 47.4, -306.9, 0, -0.06); for (const s of [-1, 1]) { bx(0.7, 2.6, 22, glass, s*17.1, D + 47.4, -318); bx(1.6, 9, 20, armour, s*17.6, D + 45.4, -340, 0, 0, s*0.08); bx(8, 5, 2, armour, s*11, D + 42, -306.4, 0, -0.3, s*0.25);
    xc(4.4, 5, 10, hullD, s*20, D + 47, -338, true); xc(3.4, 1, 10, white, s*22.6, D + 47, -338, true); yc(0.3, 0.5, 14, 6, white, s*20, D + 56, -338); }
  bx(10, 4.6, 3, hullD, 0, D + 41.2, -308.4, 0, -0.5); bx(34.4, 0.7, 48, orange, 0, D + 51.3, -332);
  B.add(armour, loft([ys(D + 56, 2.4, -316, -350), ys(D + 68, 0.8, -334, -356)])); B.add(orange, loft([ys(D + 64.6, 1.6, -328.6, -354.3), ys(D + 68.2, 1.2, -334, -356.2)]));
  yc(0.9, 1.5, 34, 8, white, -9, D + 74, -346); bx(14, 0.8, 0.8, white, -9, D + 82, -346); bx(9, 0.6, 0.6, white, -9, D + 87, -346); bx(1.4, 1.4, 1.4, redLamp, -9, D + 91.6, -346);
  B.add(white, new THREE.SphereGeometry(4, 14, 8), 10, D + 60, -346); yc(2.2, 2.6, 8, 8, hullD, 0, D + 61, -326, true);
  for (const [x, z] of [[-27, -300], [27, -300], [-27, -368], [27, -368]]) turret(x, D + 14.6, z, z > -330 ? 0 : PI, 1.2);
  const spin = new THREE.Group(); spin.position.set(0, D + 70, -326); g.add(spin); u.spin = spin;
  { const SB = new Batch(); SB.add(white, new THREE.BoxGeometry(28, 5, 1.6), 0, 0, 0, 0.12, 0, 0); SB.add(hullD, new THREE.BoxGeometry(26, 3.6, 0.6), 0, 0, 1, 0.12, 0, 0); SB.add(white, new THREE.BoxGeometry(1.8, 6, 1.8), 0, -5, 0); SB.build(spin); }

  /* ---- flight deck: plane and markings, lanes, edge lights, island, gun tubs, elevator, blast deflector ---- */
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(100, 590), new THREE.MeshStandardMaterial({map:deckTexture(), roughness:0.88, metalness:0.08}));
  deck.rotation.x = -PI/2; deck.position.set(0, D + 0.05, 8); g.add(deck);
  for (const x of [-12, 12]) bx(3, 0.3, 400, trim, x, D + 0.12, 40);
  for (let z = -280; z <= 300; z += 20) for (const s of [1, -1]) bx(0.8, 0.5, 0.8, z % 40 ? lamp : lampG, s*49.5, D + 0.3, z);
  // flight-control island, port side: everything stays inside x 29..47, z 6..74, below deck + 46 (that box is solid)
  B.add(armour, loft([ys(D, 8.8, 73, 7, 38), ys(D + 17, 8.2, 70, 11, 38)])); B.add(hull, loft([ys(D + 17, 8.6, 68, 16, 38), ys(D + 20, 8.9, 71, 15, 38), ys(D + 27, 8.9, 70, 16, 38), ys(D + 30, 6.5, 64, 20, 38)]));
  bx(17.2, 2, 0.5, glass, 38, D + 23.6, 70.6, 0, -0.14); bx(0.5, 2, 52, glass, 46.75, D + 23.6, 43); bx(0.5, 2, 52, glass, 29.4, D + 23.6, 43); bx(17.6, 0.6, 54, orange, 38, D + 27.3, 43);
  bx(8, 9, 14, hullD, 38, D + 34.5, 34); bx(9, 1, 15, navy, 38, D + 39.5, 34); yc(0.5, 0.8, 9, 6, white, 35, D + 41.4, 52); yc(0.4, 0.6, 6, 6, white, 41, D + 43, 30); B.add(white, new THREE.SphereGeometry(2.4, 10, 6), 40, D + 33, 54);
  bx(0.4, 6, 8, orange, 29.4, D + 9, 20); bx(0.4, 3, 30, navy, 29.4, D + 13, 45);
  // gun tubs outboard of the deck edge
  for (const [x0, z] of [[57, -236], [57, -120], [57, 110], [57, 244], [-57, -150], [-57, -20], [-57, 110], [-57, 244]]) { const s = Math.sign(x0); let x = x0; for (let i = 0; i < 12; i++) x += x0 - warp(x, 0, z);   // pre-compensate the toe-in bend so the tubs stay at the deck edge
    B.add(plate, flat(new THREE.CylinderGeometry(7.5, 5, 6, 8)), x, D - 3.2, z, 0, PI/8, 0); bx(8, 3, 3, hullD, x - s*5, D - 6, z, 0, 0, s*0.6); turret(x, D - 0.2, z, s > 0 ? 0.5 : -0.5, 1.1); }
  // deck-edge elevator on the starboard side, with the hangar opening behind it
  bx(1.5, 22, 34, bayM, -48.6, D - 14, -230); for (const z of [-243, -230, -217]) bx(0.5, 0.6, 6, bayL, -49.5, D - 4, z);
  for (const z of [-248.5, -211.5]) { bx(2.4, 30, 2.4, hullD, -49.6, D - 15, z); bx(0.5, 28, 0.6, orange, -51, D - 15, z); }
  bx(3, 3, 40, hullD, -49.8, D - 29.4, -230);
  const elev = new THREE.Group(); elev.position.set(-60, D - 26, -230); g.add(elev); u.elevator = elev;
  { const EBt = new Batch(); EBt.add(hullD, new THREE.BoxGeometry(24, 1.6, 32), 0, -0.8, 0); for (const z of [15.6, -15.6]) EBt.add(orange, new THREE.BoxGeometry(24.4, 0.3, 0.6), 0, 0.1, z); EBt.add(orange, new THREE.BoxGeometry(0.6, 0.3, 32), -11.9, 0.1, 0); EBt.add(trim, new THREE.BoxGeometry(22, 1.2, 2), 0, -2.2, 0); EBt.build(elev); }
  const jbd = new THREE.Group(); jbd.position.set(-12, D + 0.2, -196); g.add(jbd); u.jbd = jbd;
  jbd.add(new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 7).translate(0, 0.4, -3.5), new THREE.MeshStandardMaterial({color:0x8a8f92, metalness:0.7, roughness:0.5})));
  B.build(g);
  const nm = new THREE.MeshStandardMaterial({color:0xf2f0e8, map:hullNumber(), transparent:true, roughness:0.6, polygonOffset:true, polygonOffsetFactor:-2, depthWrite:false});
  for (const s of [1, -1]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), nm); n.position.set(warp(s*(LX + 15.75), 20, 330), 20, 330); n.rotation.y = s*PI/2 - s*TOE; g.add(n); }
  g.position.set(C.x, 0, C.z);
  return g;
};

/* ---------- Launch sequence ---------- */
const ease = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
G.Intro = class {
  constructor(game){
    this.g = game; this.t = 0; this.done = false;
    const P = game.player, W = game.wing;
    P.mode = 'jet'; P.F.setMode('jet', true); P.F.cockpit(false); P.F.setMissiles(P.mis/P.maxMis); P.F.setGear(true, true); W.F.setGear && W.F.setGear(true, true);
    this.cam = new V3(C.x - 125, C.deck + 6, C.z - 175);
    W.F.root.visible = true; W.F.root.position.set(C.x + 12, C.deck + 2, C.z - 170); W.F.root.rotation.set(0, 0, 0, 'YXZ');
    this.wSpeed = 0; this.wz = C.z - 170; this.wy = C.deck + 2;
    this.z = C.z - 180; this.y = C.deck + 2; this.speed = 0; this.pitch = 0;
    G.hud.intro(true, 'BASTION · FLIGHT DECK', 'Bringing your fighter up from the hangar');
    G.audio.elevator && G.audio.elevator();
  }
  skip(){ this.t = 99; }
  update(dt){
    const g = this.g, P = g.player, F = P.F, cam = g.camera, I = G.input, car = g.carrierMesh.userData;
    if (I.pressed.has('Space') || I.pressed.has('Enter') || (I.lmb && this.t > 0.6)) this.skip();
    this.t += dt; const t = this.t;
    car.spin.rotation.y += dt*1.4;
    const ex = C.x - 60, ez = C.z - 230, sx = C.x - 12;
    let pos = new V3(), yaw = 0, look = new V3(), camT = new V3();
    if (t < 3.5) {
      const k = ease(Math.min(1, t/3.5)); car.elevator.position.y = C.deck - 26 + 26*k;
      pos.set(ex, C.deck - 26 + 26*k + 2, ez); yaw = Math.PI/2;
      camT.set(C.x - 125, C.deck + 6, C.z - 175); look.copy(pos).add(new V3(10, 0, 0));
    } else if (t < 6.2) {
      const k = ease((t - 3.5)/2.7), a = new V3(ex, 0, ez), b = new V3(sx, 0, ez), c2 = new V3(sx, 0, this.z);
      const p1 = a.clone().lerp(b, k), p2 = b.clone().lerp(c2, k); pos.copy(p1.lerp(p2, k)); pos.y = C.deck + 2;
      const tan = p2.sub(a.clone().lerp(b, k)); yaw = Math.atan2(tan.x, tan.z);
      if (t > 4.2 && !this.cap1) { this.cap1 = true; G.hud.intro(true, 'BASTION · FLIGHT DECK', 'Taxi to catapult one'); }
      camT.set(C.x + 70, C.deck + 40, C.z - 280); look.copy(pos);
    } else if (t < 7.4) {
      pos.set(sx, C.deck + 2, this.z); yaw = 0;
      car.jbd.rotation.x = -1.05*ease(Math.min(1, (t - 6.2)/0.8));
      F.ctl.thrust = 0.3 + (t - 6.2)*0.6;
      if (!this.cap2) { this.cap2 = true; G.hud.intro(true, 'CATAPULT ONE', 'Run-up. Stand by to launch'); G.audio.takeoff && G.audio.takeoff(); }
      if (Math.random() < dt*40) g.fx.thrust(F.world('legL', 0, 0, -6.3, new V3()), new V3(0, 0, -1), 1.4, [1, 0.6, 0.25]);
      camT.set(sx + 10, C.deck + 6, this.z - 34); look.set(sx, C.deck + 3, this.z + 40);
    } else {
      if (!this.cap3) { this.cap3 = true; G.hud.intro(true, '', ''); G.audio.boom(P.pos, 0.6); }
      const tt = t - 7.4;
      this.speed = Math.min(165, this.speed + (tt < 2.4 ? 72 : 20)*dt);
      this.z += this.speed*dt;
      if (this.z > C.z + 290) { this.pitch = Math.min(0.32, this.pitch + dt*0.2); this.y += Math.sin(this.pitch)*this.speed*dt; }
      if (this.y > C.deck + 14) F.setGear(false);   // positive climb: gear up
      pos.set(sx, this.y, this.z); yaw = 0; F.ctl.thrust = 1;
      if (Math.random() < dt*50) for (const nz of F.nozzles) { nz.getWorldPosition(camT); g.fx.thrust(camT, new V3(0, 0, -1), 1.6, [1, 0.6, 0.25]); }
      if (tt < 2.2) camT.set(sx + 14, C.deck + 7, this.z - 36); else camT.set(sx + 70, this.y + 12, this.z + 30);
      look.copy(pos);
      car.jbd.rotation.x = -1.05*(1 - Math.min(1, Math.max(0, tt - 3)/1));
    }
    // Ridge launches from catapult two a few seconds later
    if (t > 9.4 && this.t < 90) { this.wSpeed = Math.min(165, this.wSpeed + 72*dt); this.wz += this.wSpeed*dt; if (this.wz > C.z + 290) this.wy += 0.2*this.wSpeed*dt; if (this.wy > C.deck + 14 && g.wing.F.setGear) g.wing.F.setGear(false); }
    g.wing.F.root.position.set(C.x + 12, this.wy, this.wz); g.wing.F.ctl.thrust = t > 8.4 ? 1 : 0.3; g.wing.F.update(dt);
    if (t >= 99 || (t > 7.4 && this.y > C.deck + 260)) { this.finish(); return; }
    P.pos.copy(pos); F.root.position.copy(pos); F.root.rotation.set(-this.pitch, yaw, 0, 'YXZ');
    F.update(dt); F.root.updateMatrixWorld(true);
    this.cam.lerp(camT, 1 - Math.exp(-dt*(t < 7.4 ? 2.5 : 5)));
    cam.position.copy(this.cam); cam.lookAt(look); cam.updateMatrixWorld();
  }
  finish(){
    const g = this.g, P = g.player, W = g.wing, car = g.carrierMesh.userData;
    G.audio.takeoffStop && G.audio.takeoffStop(this.t >= 99 ? 0.4 : 3);   // quick cut on skip, long fade into flight otherwise
    car.elevator.position.y = C.deck - 26; car.jbd.rotation.x = 0; P.F.setGear(false, true); W.F.setGear && W.F.setGear(false, true);
    const z = Math.max(this.z, C.z + 700);
    P.pos.set(C.x - 12, Math.max(this.y, C.deck + 260), z); P.yaw = 0; P.pitch = 0.08; P.roll = 0; P.speed = 175; P.throttle = 0.75; P.gpwsGrace = 4;
    P.vel.set(0, 0, 165); P.F.ctl.thrust = 0.6; P.F.cockpit(P.view === 'cockpit'); P.camOff.set(0, 7, -30);
    W.pos.set(C.x + 40, P.pos.y + 6, z - 60); W.dir.set(0, 0.05, 1).normalize(); W.speed = 165; W.vel.set(0, 0, 165);
    this.done = true; G.hud.intro(false); G.hud.setView(P.view);
    const T = g.ops && g.ops.tasks[0];
    G.hud.radio('Bastion', `${G.save.callsign || 'Kestrel'}, you are clear. ${T ? `Waypoint 1: ${G.taskText(T)}.` : ''}`);
  }
};
})();
