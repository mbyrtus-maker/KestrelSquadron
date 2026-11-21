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
  skycarrier:{label:'Bring down the flying carrier', short:'Ascendant', n:() => 1, reward:5200, xp:600}
};
G.taskText = T => {
  const n = T.n; if (T.text) return T.text;
  return {skycarrier:`Bring down the Ascendant over ${T.place}`, rival:`Shoot down ${T.who || 'the rival ace'} over ${T.place}`, sovereign:`Destroy the Sovereign at ${T.place}`, boss:`Shoot down Hollow over ${T.place}`, patrol:`Patrol ${T.place} for enemy aircraft`, armor:`Destroy the armor column at ${T.place} (${n} vehicles)`, rescue:`Rescue ${n} civilian group${n > 1 ? 's' : ''} at ${T.place}`,
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
  const sp = (type, cx, cz, a0, a1, o) => { let x, z; for (let i = 0; i < 14; i++) { [x, z] = around(cx, cz, a0, a1); if (W.height(x, z) > 3) break; } return G.spawn(game, type, x, z, o); };
  const tag = (e, i) => { e.tag = 'obj'; e.task = i; return e; };
  for (const T of L.tasks) {
    const P = T.C, i = T.i;
    switch (T.kind) {
      case 'patrol': case 'boss': case 'sovereign': case 'rival': case 'skycarrier': break;
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
        for (let k = 0; k < T.n; k++) { const s = spots[k % spots.length]; tag(G.spawn(game, kinds[k % kinds.length], P.x + s[0], P.z + s[1], {yaw: k % 2 ? 0 : Math.PI/2}), i); }
        for (let k = 0; k < 1 + tier; k++) { const a = k/(1 + tier)*Math.PI*2; G.spawn(game, 'aa', P.x + Math.sin(a)*190, P.z + Math.cos(a)*190); }
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
        for (let k = 0; k < tier; k++) { const a = r()*6.28; G.spawn(game, 'reaver', P.x + Math.sin(a)*120, P.z + Math.cos(a)*120); }   // a roaming pack on top of the objectives
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
    if (T.kind === 'air' || T.kind === 'boss' || T.kind === 'sovereign' || T.kind === 'rival' || T.kind === 'skycarrier') return T.spawnedN >= T.n && this.alive(T) === 0;
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
      if (!T.arrived && d < (T.kind === 'skycarrier' ? 3800 : T.kind === 'patrol' || T.kind === 'air' ? 1000 : 1300)) {
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
G.buildCarrier = function(){
  const {rbox, fin, cyl, M} = G.geo, g = new THREE.Group(), D = C.deck, u = g.userData;
  // Allied palette, flat-shaded like the rest of the cast: light grey hull, navy boot stripe, orange safety trim.
  const S = o => new THREE.MeshStandardMaterial(Object.assign({roughness:0.68, metalness:0.3, flatShading:true}, o));
  const hull = S({color:0x7e868b, map:panelTexture()}), hullD = S({color:0x444c53, map:panelTexture()}), glass = S({color:0x1b2c3c, roughness:0.08, metalness:0.7}), red = S({color:0x2c4a6e});
  const orange = S({color:0xa5562a}), navy = S({color:0x2a3a4e}), white = S({color:0xb4b4ac}), lamp = new THREE.MeshBasicMaterial({color:0xfff0b0}), lampG = new THREE.MeshBasicMaterial({color:0x7dff9a});
  g.add(M(fin([[-280,-20],[250,-20],[305,26],[305,D - 1.6],[-290,D - 1.6],[-296,18]], 96, 1.5), hull));
  g.add(M(fin([[-260,-20],[240,-20],[290,8],[-280,6]], 98, 1), red));
  g.add(M(fin([[-286,D - 9],[302,D - 9],[303,D - 6],[-287,D - 6]], 96.6, 0.3), navy));
  for (const s of [1, -1]) g.add(M(rbox(3, 6, 560, 1), hullD, s*48.5, D - 6, 6));
  for (const s of [1, -1]) g.add(M(rbox(0.4, 0.8, 560, 0.1), orange, s*50.1, D - 3.2, 6));
  const nm = new THREE.MeshStandardMaterial({color:0xf2f0e8, map:hullNumber(), transparent:true, roughness:0.6, polygonOffset:true, polygonOffsetFactor:-2, depthWrite:false});
  for (const s of [1, -1]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), nm); n.position.set(s*48.2, D - 26, 230); n.rotation.y = s*Math.PI/2; g.add(n); }
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(100, 590), S({map:deckTexture(), roughness:0.88, metalness:0.08}));
  deck.rotation.x = -Math.PI/2; deck.position.set(0, D + 0.05, 8); deck.receiveShadow = true; g.add(deck);
  g.add(M(rbox(3, 1, 400, 0.3), S({color:0x1a1d20}), -12, D + 0.1, 40));
  for (let z = -280; z <= 300; z += 20) for (const s of [1, -1]) g.add(M(new THREE.BoxGeometry(0.8, 0.5, 0.8), z % 40 ? lamp : lampG, s*49.5, D + 0.3, z));
  // command island on the port side
  g.add(M(rbox(20, 34, 70, 1.2), hull, 38, D + 17, 40)); g.add(M(rbox(20.3, 3, 70.3, 0.2), glass, 38, D + 28, 40)); g.add(M(rbox(20.4, 1.2, 70.4, 0.2), navy, 38, D + 33.2, 40));
  g.add(M(rbox(15, 20, 44, 1), hull, 38, D + 44, 36)); g.add(M(rbox(15.4, 4, 44.4, 0.2), glass, 38, D + 48, 36));
  g.add(M(rbox(12, 6, 26, 0.8), hullD, 38, D + 57, 32)); g.add(M(rbox(12.2, 0.8, 26.2, 0.2), orange, 38, D + 60.2, 32));
  g.add(M(new THREE.CylinderGeometry(0.7, 1.2, 30, 8), white, 38, D + 75, 32));
  const spin = new THREE.Group(); spin.position.set(38, D + 84, 32); g.add(spin); u.spin = spin;
  spin.add(M(rbox(16, 3, 1.2, 0.3), white)); spin.add(M(rbox(1.2, 6, 1.2, 0.3), white, 0, -3, 0));
  g.add(M(new THREE.SphereGeometry(3.4, 16, 10), white, 38, D + 64, 50));
  g.add(M(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({color:0xff3020}), 38, D + 90.5, 32));
  // point-defense turrets along the edges
  for (const [x, z] of [[44, -230], [44, 160], [-44, 120], [-44, 260], [44, 270], [-44, -120]]) {
    const t = new THREE.Group(); t.position.set(x, D, z); g.add(t);
    t.add(M(new THREE.CylinderGeometry(3, 3.4, 2, 14), hullD, 0, 1, 0)); t.add(M(rbox(4, 2.4, 4.4, 0.5), hull, 0, 3, 0));
    for (const o of [-0.8, 0.8]) t.add(M(cyl(0.25, 0.25, 6, 8), hullD, o, 3.4, 4));
    t.rotation.y = x > 0 ? -0.6 : 0.6;
  }
  // deck-edge elevator on the starboard side, with the hangar opening behind it
  g.add(M(rbox(1.5, 22, 34, 0.3), new THREE.MeshBasicMaterial({color:0x2a2318}), -48.6, D - 14, -230));
  for (const z of [-243, -230, -217]) g.add(M(new THREE.BoxGeometry(0.5, 0.6, 6), new THREE.MeshBasicMaterial({color:0xffe2a8}), -49.5, D - 4, z));
  const elev = new THREE.Group(); elev.position.set(-60, D - 26, -230); g.add(elev); u.elevator = elev;
  elev.add(M(rbox(24, 1.6, 32, 0.4), hullD, 0, -0.8, 0)); elev.add(M(rbox(24.4, 0.3, 0.6, 0.1), orange, 0, 0.1, 15.6)); elev.add(M(rbox(24.4, 0.3, 0.6, 0.1), orange, 0, 0.1, -15.6));
  // jet blast deflector behind the catapult
  const jbd = new THREE.Group(); jbd.position.set(-12, D + 0.2, -196); g.add(jbd); u.jbd = jbd;
  jbd.add(M(rbox(16, 0.8, 7, 0.3), S({color:0x8a8f92, metalness:0.7}), 0, 0.4, -3.5));
  // wake
  const foam = new THREE.MeshBasicMaterial({color:0xeef4f4, transparent:true, opacity:0.55, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4});
  for (const s of [1, -1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(6, 520), foam); w.rotation.x = -Math.PI/2; w.position.set(s*50, 1.4, 0); g.add(w); }
  const st = new THREE.Mesh(new THREE.PlaneGeometry(110, 200), foam); st.rotation.x = -Math.PI/2; st.position.set(0, 1.3, -390); g.add(st);
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
