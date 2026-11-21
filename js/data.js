(function(){
'use strict';
const G = window.G = window.G || {};

/* ---------- Weapons (unlocked by pilot level, free to equip) ---------- */
G.WEAPONS = {
  gun: [
    {id:'gun_m20', name:'M20 Twin Cannon', lvl:1, dmg:10, rof:16, speed:1000, spread:0.010, color:0xffe08a, desc:'Fixed nose cannons. High rate, light punch.'},
    {id:'gun_m30', name:'M30 Heavy Cannon', lvl:4, dmg:18, rof:10, speed:1050, spread:0.008, color:0xffc060, desc:'Slower, heavier rounds that crack armor.'},
    {id:'gun_pl2', name:'PL-2 Pulse Lasers', lvl:9, dmg:15, rof:20, speed:1800, spread:0.003, color:0x9affff, desc:'Near-instant bolts with no drop.'}
  ],
  missile: [   // air-to-air: these lock aircraft only
    {id:'msl_hornet', name:'Hornet Micro-Missiles', lvl:1, dmg:70, cap:16, salvo:2, turn:3.4, speed:430, lock:0.55, desc:'Light all-aspect air-to-air missiles fired in pairs. One hit kills most fighters.'},
    {id:'msl_lancer', name:'Lancer Long-Range AAM', lvl:3, dmg:300, cap:8, salvo:1, turn:2.2, speed:520, lock:0.8, desc:'Fast, heavy air-to-air missile. Kills aces and Hollow\'s escorts in one hit.'},
    {id:'msl_swarm', name:'Swarm Pods', lvl:7, dmg:55, cap:42, salvo:6, turn:4.2, speed:470, lock:0.35, desc:'Six-round air-to-air salvos split across every locked aircraft.'}
  ],
  bomb: [   // air-to-ground missiles (kept under the 'bomb' slot so old saves still load)
    {id:'agm_spear', name:'AGM-9 Spear', lvl:1, dmg:3200, radius:32, cap:10, lock:1.0, desc:'Guided heavy air-to-ground missile. Levels heavy buildings and anything parked around them.'},
    {id:'agm_scatter', name:'AGM-14 Scatter', lvl:3, dmg:900, radius:18, cap:6, cluster:14, lock:0.8, desc:'Bursts 90 m short of its target into 14 submunitions that blanket about 45 m. Wipes out vehicle groups; weak against heavy buildings.'},
    {id:'agm_breaker', name:'AGM-20 Breaker', lvl:6, dmg:8000, radius:26, cap:5, lock:1.2, desc:'Hardened penetrator warhead. One hit destroys any heavy building.'}
  ],
  pod: [
    {id:'pod_gp40', name:'GP-40 Autocannon Pod', lvl:1, dmg:16, rof:9, speed:760, spread:0.012, color:0xffd27a, desc:'Hand-held autocannon. The workhorse.'},
    {id:'pod_rp7', name:'RP-7 Rail Pod', lvl:5, dmg:72, rof:1.8, speed:2400, spread:0.001, color:0xbfe8ff, desc:'Magnetic slugs. Devastating, slow cycle.'},
    {id:'pod_br9', name:'BR-9 Beam Rifle', lvl:10, dmg:34, rof:6, speed:2000, spread:0.002, color:0xff8af0, desc:'Sustained energy fire.'}
  ],
  laser: [
    // dmg is per beam; barrels = emitters fitted (one or two each side of the head). Frames built with a quad head always fire four.
    {id:'las_s', name:'Head Lasers, Twin', lvl:1, dmg:50, cd:1.6, barrels:2, desc:'Hover mode, E key. One emitter each side of the head, hitscan.'},
    {id:'las_t', name:'Head Lasers, Quad', lvl:6, dmg:40, cd:1.2, barrels:4, desc:'Second emitter on each side: four beams per burst.'},
    {id:'las_q', name:'Head Lasers, Quad Rapid', lvl:12, dmg:32, cd:0.55, barrels:4, desc:'Quad emitters on an overclocked cycle, near-continuous fire.'}
  ],
  melee: [
    {id:'mel_knife', name:'Combat Knife', lvl:1, dmg:160, range:16, desc:'Mech-mode melee. Short reach. Blades can finish heavy buildings that guns and missiles only scar.'},
    {id:'mel_vibro', name:'Vibro Blade', lvl:4, dmg:280, range:19, desc:'Oscillating edge, longer reach.'},
    {id:'mel_plasma', name:'Plasma Saber', lvl:9, dmg:460, range:23, desc:'Superheated blade that cuts through hulls.'}
  ],
  shield: [
    {id:'shd_comp', name:'Composite Shield', lvl:1, block:0.6, desc:'Blocks 60% of frontal damage while raised.'},
    {id:'shd_react', name:'Reactive Shield', lvl:5, block:0.78, desc:'Explosive plates shed 78% of frontal hits.'},
    {id:'shd_field', name:'Field Projector', lvl:11, block:0.92, desc:'Energy screen. Blocks 92% of frontal damage.'}
  ]
};
G.SLOTS = [
  {key:'gun', label:'Fixed guns', mode:'Jet'},
  {key:'missile', label:'Air-to-air missiles', mode:'Jet · Hover'},
  {key:'bomb', label:'Ground missiles', mode:'Jet · Hover (H)'},
  {key:'pod', label:'Gun pod', mode:'Hover · Mech'},
  {key:'laser', label:'Head laser', mode:'Hover (E)'},
  {key:'melee', label:'Melee', mode:'Mech'},
  {key:'shield', label:'Shield', mode:'Mech'}
];

/* ---------- Airframes ---------- */
G.FRAMES = [
  {id:'kestrel', name:'AVF-1 Kestrel', lvl:1, cost:0, hp:1450, speed:1.0, agility:1.0, jump:1.0, hard:1.0, lasers:2, color:0x8b9197, trim:0x35465a, desc:'The line fighter every pilot learns on. Forgiving in all three modes.'},
  {id:'wren', name:'AVF-0 Wren', lvl:3, cost:16000, hp:1750, speed:0.95, agility:0.95, jump:1.05, hard:1.3, lasers:2, color:0x565c50, trim:0xa3923f, desc:'Prototype-era airframe. Heavy plating and extra hardpoints.'},
  {id:'shrike', name:'SX-51 Shrike', lvl:5, cost:38000, hp:1300, speed:1.22, agility:1.3, jump:1.25, hard:1.5, lasers:2, color:0x2c2f33, trim:0x8a2e27, desc:'Captured strike frame. Fast and missile-heavy, but thin-skinned.'},
  {id:'kestrelc', name:'AVF-1C Kestrel Command', lvl:7, cost:62000, hp:1950, speed:1.12, agility:1.12, jump:1.15, hard:1.35, lasers:4, color:0xa2a7aa, trim:0x1e1e22, desc:'Flight-lead variant with a quad-laser head and reinforced frame.'},
  {id:'gyrfalcon', name:'AVF-X Gyrfalcon', lvl:10, cost:115000, hp:2300, speed:1.35, agility:1.45, jump:1.4, hard:1.6, lasers:2, color:0x6f767c, trim:0x9c5a26, desc:'Next-generation testbed. Exceptional thrust and turn rate.'},
  {id:'osprey', name:'AVF-X4 Osprey', lvl:14, cost:210000, hp:2900, speed:1.55, agility:1.6, jump:1.6, hard:2.0, lasers:4, color:0x232932, trim:0x2f8d9a, desc:'Classified heavy frame. Top speed, top armor, double racks.'}
];

/* ---------- Upgrades ---------- */
G.UPGRADES = [
  {id:'armor', name:'Armor plating', max:5, base:2600, desc:'+12% hull per rank.'},
  {id:'engine', name:'Engine tuning', max:5, base:3000, desc:'+7% speed and thrust per rank.'},
  {id:'fcs', name:'Fire control', max:5, base:3400, desc:'+10% weapon damage per rank.'},
  {id:'racks', name:'Extended racks', max:5, base:2400, desc:'+20% missile capacity per rank.'},
  {id:'fuel', name:'Thruster reserve', max:5, base:1800, desc:'+20% thruster fuel per rank.'},
  {id:'flares', name:'Flare dispenser', max:5, base:1400, desc:'+2 flare charges per sortie.'},
  {id:'radar', name:'Radar array', max:3, base:2200, desc:'+25% radar and lock range per rank.'},
  {id:'jammer', name:'ECM jammer', max:1, base:14000, lvl:3, desc:'Halves enemy lock speed and degrades missile tracking in every mode.'}
];
G.upCost = (u, rank) => Math.round(u.base * Math.pow(1.65, rank) / 100) * 100;

/* ---------- Save ---------- */
const KEY = 'kestrel-squadron-save-1';
G.newSave = () => ({
  v:1, credits:6000, xp:0, level:1, owned:['kestrel'], frame:'kestrel', up:{},
  load:{gun:'gun_m20', missile:'msl_hornet', bomb:'agm_spear', pod:'pod_gp40', laser:'las_s', melee:'mel_knife', shield:'shd_comp'},
  damage:0, board:null, sorties:0, wins:0, kills:0, invert:false, view:'cockpit', story:G.newStory ? G.newStory() : null
});
G.loadSave = () => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch(e) { s = null; }
  G.save = Object.assign(G.newSave(), s || {});
  if (!G.save.board || !G.save.board.length) G.save.board = G.genBoard();
  if (!G.save.story && G.newStory) G.save.story = G.newStory();
};
G.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(G.save)); } catch(e) {} };
G.resetSave = () => { G.save = G.newSave(); G.save.board = G.genBoard(); G.persist(); };

G.xpNeed = l => Math.round(700 * Math.pow(l, 1.45));
G.addXP = n => {
  const s = G.save; s.xp += n; let ups = 0;
  while (s.xp >= G.xpNeed(s.level)) { s.xp -= G.xpNeed(s.level); s.level++; ups++; }
  return ups;
};
G.weapon = (cat, id) => G.WEAPONS[cat].find(w => w.id === id) || G.WEAPONS[cat][0];
G.frame = id => G.FRAMES.find(f => f.id === (id || G.save.frame)) || G.FRAMES[0];
G.money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

// Head laser barrels: the fitted laser's count, or four on frames built with a quad head.
G.laserCount = f => Math.max(G.weapon('laser', G.save && G.save.load && G.save.load.laser).barrels || 2, f && f.lasers >= 4 ? 4 : 2);
G.stats = () => {
  const f = G.frame(), u = G.save.up, r = id => u[id] || 0;
  return {
    maxHp: Math.round(f.hp * (1 + 0.12 * r('armor'))),
    speed: f.speed * (1 + 0.07 * r('engine')),
    agility: f.agility, jump: f.jump,
    dmg: 1 + 0.1 * r('fcs'),
    rack: f.hard * (1 + 0.2 * r('racks')),
    fuel: 120 * (1 + 0.2 * r('fuel')),
    flares: 6 + 2 * r('flares'),
    radar: 2200 * (1 + 0.25 * r('radar')),
    jammer: r('jammer') > 0,
    lasers: G.laserCount(f)
  };
};
G.repairCost = () => Math.round(G.save.damage * G.stats().maxHp * 4 / 10) * 10;

/* ---------- Mission board ---------- */
const PLACES = ['Halvorsen Flats','Cobalt Ridge','Mercy Valley','Sable Coast','Orrin Basin','Kettle Pass','Grayhook Delta','Tamsin Highlands','Low Ember Steppe','Vantage Bluffs','Corran Fjord','Saltmarsh Reach'];
const CITIES = ['New Calder','Port Teague','Vey','Marrow Point','Ashford Reach','Lindqvist','Harlow Cross'];

G.MTYPES = {
  convoy:{label:'Armor Interdiction', tag:'Ground strike',
    brief:(n,p)=>`A Varn armored column is moving through ${p}. Catch it in the open and destroy ${n} vehicles.`,
    goal:n=>`Destroy ${n} convoy vehicles`},
  base:{label:'Forward Base Strike', tag:'Strike',
    brief:(n,p)=>`Recon found a Varn forward base dug in at ${p}. Level ${n} structures. Expect flak and SAM cover.`,
    goal:n=>`Destroy ${n} base structures`},
  rescue:{label:'Civilian Evacuation', tag:'Rescue',
    brief:(n,p)=>`${n} groups of civilians are pinned down near ${p}, marked with green smoke. Clear the guards, set down beside each group in hover or mech mode, and hold until they board.`,
    goal:n=>`Rescue ${n} civilian groups`},
  city:{label:'City Liberation', tag:'Liberation',
    brief:(n,p,c)=>`Varn units have occupied ${c}. Clear ${n} hostiles from the streets and keep your fire off the buildings. People still live there.`,
    goal:(n,c)=>`Liberate ${c}: clear ${n} hostiles`},
  air:{label:'Air Superiority', tag:'Air-to-air',
    brief:(n,p)=>`Varn fighters are contesting the sky over ${p}. They will come in waves. Shoot down ${n}.`,
    goal:n=>`Shoot down ${n} fighters`},
  mech:{label:'Walker Hunt', tag:'Anti-armor',
    brief:(n,p)=>`A Varn walker group is advancing through ${p}. Destroy ${n} walkers before they reach the line.`,
    goal:n=>`Destroy ${n} walkers`},
  sam:{label:'SAM Suppression', tag:'SEAD',
    brief:(n,p)=>`SAM launchers around ${p} are closing the air corridor. Knock out ${n} of them. Use flares and terrain.`,
    goal:n=>`Destroy ${n} SAM launchers`},
  recon:{label:'Low-Level Recon', tag:'Recon',
    brief:(n,p)=>`Command needs eyes on ${n} sites around ${p}. Overfly each marker below 150 m above the ground.`,
    goal:n=>`Overfly ${n} recon markers`}
};

const mmss = s => `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`;
G.SIDES = {
  time:{label:p=>`Finish in under ${mmss(p)}`},
  wingman:{label:()=>`Bring ${G.wingName ? G.wingName() : 'your wingman'} home alive`},
  hollow:{label:()=>'Drive Hollow off (damage him by half)'},
  hull:{label:()=>'Lose less than 35% hull'},
  melee:{label:()=>'Destroy 2 enemies with melee'},
  mechkills:{label:()=>'Destroy 4 enemies in mech mode'},
  aa:{label:()=>'Destroy 3 extra flak tracks'},
  ace:{label:()=>'Shoot down 3 enemy aces'},
  collat:{label:()=>'No civilian buildings destroyed'},
  nomissile:{label:()=>'Fire no missiles'}
};
G.sideLabel = s => G.SIDES[s.key].label(s.param);

G.genMission = (type, level) => {
  const R = Math.random, pick = a => a[Math.floor(R()*a.length)];
  const tier = 1 + Math.floor(R()*3);
  const sc = 1 + 0.16*(level-1);
  const base = {convoy:5+2*tier, base:4+tier, rescue:1+tier, city:5+2*tier, air:3+2*tier, mech:2+2*tier, sam:2+tier, recon:3+tier}[type];
  const n = base + Math.floor(level/4);
  const reward = Math.round((1800 + 1100*tier + 120*n)*sc/50)*50;
  const xp = Math.round((220 + 160*tier + 18*n)*(1 + 0.1*(level-1)));
  const place = pick(PLACES), city = pick(CITIES), T = G.MTYPES[type];
  let pool = ['time','wingman','hull','melee','mechkills','aa','ace','nomissile'];
  if (type === 'city') pool.push('collat','collat');
  if (type === 'air') pool = pool.filter(k => k !== 'ace' && k !== 'melee' && k !== 'mechkills');
  const count = tier >= 2 ? 2 : 1, sides = [];
  while (sides.length < count && pool.length) {
    const k = pool.splice(Math.floor(R()*pool.length), 1)[0];
    if (sides.some(s => s.key === k)) continue;
    const param = k === 'time' ? Math.round((150 + n*40 + (type==='rescue'?150:0) + (type==='recon'?60:0))/10)*10 : 0;
    sides.push({key:k, param, cash:Math.round(reward*(0.18+0.06*tier)/50)*50, xp:Math.round(xp*0.3)});
  }
  return {
    id: Date.now().toString(36) + R().toString(36).slice(2,6), type, tier, n, place, city, reward, xp, sides,
    seed: Math.floor(R()*1e9), title:T.label, tag:T.tag, brief:T.brief(n, place, city), goal:T.goal(n, city)
  };
};
G.genBoard = () => {
  const lvl = (G.save && G.save.level) || 1;
  const types = Object.keys(G.MTYPES).sort(() => Math.random() - 0.5).slice(0, 5);
  return types.map(t => G.genMission(t, lvl));
};
})();
