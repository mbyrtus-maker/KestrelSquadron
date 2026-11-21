(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3, $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

/* ---------- Input ---------- */
const I = G.input = {keys:new Set(), pressed:new Set(), mx:0, my:0, lmb:false, rmb:false, an:{}, look:null, pad:false};
const GAME_KEYS = ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyF', 'KeyQ', 'KeyR', 'KeyV', 'KeyC', 'KeyG', 'KeyB', 'KeyX', 'KeyZ', 'KeyT', 'KeyJ', 'KeyE', 'KeyH', 'KeyN', 'KeyM'];
addEventListener('keydown', e => {
  if (e.code === 'KeyD' && e.ctrlKey && e.altKey) { e.preventDefault(); if (!e.repeat) showCheats(); return; }
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (state === 'mission') {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat && !(e.code === 'Escape' && paused && performance.now() - lockLostT < 400)) togglePause(); return; }
  }
  if (!e.repeat) I.pressed.add(e.code);
  I.keys.add(e.code);
});
addEventListener('keyup', e => I.keys.delete(e.code));
addEventListener('blur', () => { I.keys.clear(); I.lmb = I.rmb = false; if (state === 'mission' && !paused) togglePause(); });
/* Mouse: during a sortie the pointer is captured (pointer lock) and hidden. Raw movement feeds a virtual stick (jet)
   and mouse-look (hover / battlebot). The cursor only comes back when the game is paused (Esc). */
I.dx = 0; I.dy = 0; I.locked = false;
const lockEl = () => document.pointerLockElement === view;
let lockLostT = -1e9, lockTried = 0, lockFails = 0;
addEventListener('mousemove', e => {
  if (I.locked) {
    const k = 0.0021*(G.save.sens ?? 0.5);
    I.dx += e.movementX || 0; I.dy += e.movementY || 0;
    if (G.game && G.game.player && G.game.player.mode === 'jet') { I.mx = Math.max(-1, Math.min(1, I.mx + (e.movementX || 0)*k*1.15)); I.my = Math.max(-1, Math.min(1, I.my - (e.movementY || 0)*k*1.15*innerWidth/innerHeight)); }
  } else { I.mx = e.clientX/innerWidth*2 - 1; I.my = -(e.clientY/innerHeight*2 - 1); }
});
function grabMouse(){
  if (state !== 'mission' || paused || lockEl() || !view.requestPointerLock || lockFails > 3) return;
  lockTried = performance.now();
  try { const r = view.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {}
}
function freeMouse(){ if (lockEl() && document.exitPointerLock) document.exitPointerLock(); }
document.addEventListener('pointerlockchange', () => {
  const was = I.locked; I.locked = lockEl(); I.dx = I.dy = 0;
  if (I.locked) { I.mx = I.my = 0; lockFails = 0; return; }
  if (was) { lockLostT = performance.now(); I.lmb = I.rmb = false; if (state === 'mission' && !paused && G.game && !G.game.over) togglePause(); }
});
document.addEventListener('pointerlockerror', () => { lockFails++; if (state === 'mission' && !paused && lockFails <= 3) G.hud.flash('CLICK TO CAPTURE THE MOUSE'); });
const view = $('view');
view.addEventListener('mousedown', e => { if (state !== 'mission') return; G.audio.init(); if (!paused && !lockEl()) grabMouse(); if (e.button === 0) { I.lmb = true; I.pressed.add('Mouse0'); } if (e.button === 2) I.rmb = true; if (e.button === 1) { e.preventDefault(); I.pressed.add('Mouse1'); } });
addEventListener('mouseup', e => { if (e.button === 0) I.lmb = false; if (e.button === 2) I.rmb = false; });
addEventListener('contextmenu', e => { if (state === 'mission') e.preventDefault(); });


/* ---------- Game controller (standard-layout gamepads: Xbox, PlayStation, Switch Pro and most others) ----------
   In a sortie:  left stick  jet: fly (bank and pull) · hover/mech: move        right stick  jet: throttle (up/down) and rudder · hover/mech: look and aim
                 RT guns · LT missiles (mech: shield) · RB afterburner/boost · LB flares · A rise/jump · B descend · X head lasers (mech: missile racks)
                 Y next mode · LS click blade · RS click designate target · D-pad up camera, down missile type, left wingman attack, right wingman cover
                 Back return to base · Start pause.
   In the hangar and menus: D-pad or left stick moves between buttons, A presses, B closes a window, Start opens the briefing or resumes. */
const PADMAP = {7:'Mouse0', 4:'KeyF', 5:'ShiftLeft', 0:'Space', 1:'KeyC', 2:'KeyE', 3:'Tab', 10:'KeyQ', 11:'KeyT', 12:'KeyV', 13:'KeyH', 14:'KeyZ', 15:'KeyX', 8:'KeyR'};
const padPrev = [], PDZ = 0.16, pdz = v => Math.abs(v) < PDZ ? 0 : (v - Math.sign(v)*PDZ)/(1 - PDZ);
let padSteer = false, padNavT = 0;
addEventListener('gamepadconnected', e => { G.hud && G.hud.flash && state === 'mission' && G.hud.flash('CONTROLLER CONNECTED'); I.pad = true; const t = document.getElementById('padNote'); if (t) t.hidden = false; });
function padFocus(dir){   // menus: step through the visible buttons in reading order
  const ov = document.getElementById('overlay'), mn = document.getElementById('menu'), root = !ov.hidden ? ov : !mn.hidden ? mn : document.getElementById('hangar');
  if (!root) return; const B = [...root.querySelectorAll('button, [data-tab], input')].filter(b => b.offsetParent !== null && !b.disabled); if (!B.length) return;
  const i = B.indexOf(document.activeElement); const n = B[(i < 0 ? 0 : i + dir + B.length) % B.length]; n.focus(); n.scrollIntoView && n.scrollIntoView({block:'nearest'});
}
function pollPad(dt){
  const list = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null; for (const p of list) if (p && p.connected) { gp = p; break; }
  if (!gp) { if (I.pad && padSteer) { I.mx = I.my = 0; padSteer = false; } I.look = null; return; }
  I.pad = true;
  const bt = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4)), down = i => bt(i) && !padPrev[i];
  const lx = pdz(gp.axes[0] || 0), ly = pdz(gp.axes[1] || 0), rx = pdz(gp.axes[2] || 0), ry = pdz(gp.axes[3] || 0);
  const ov = !document.getElementById('overlay').hidden;
  if (state === 'mission' && G.game && !G.game.over && !paused && !ov) {
    const P = G.game.player, jet = P && P.mode === 'jet';
    for (const k in PADMAP) { const c = PADMAP[k], b = bt(+k);
      if (c === 'Mouse0') { if (b) I.lmb = true; else if (padPrev[k]) I.lmb = false; }
      if (b && !padPrev[k]) I.pressed.add(c);
      if (b) I.keys.add(c); else if (padPrev[k]) I.keys.delete(c); }
    { const lt = bt(6); if (lt) I.rmb = true; else if (padPrev[6]) I.rmb = false; }
    const an = I.an = {};
    if (jet) {
      if (lx || ly) { I.mx = lx; I.my = ly; padSteer = true; } else if (padSteer) { I.mx = I.my = 0; padSteer = false; }   // stick back pulls the nose up
      if (ry < 0) an.KeyW = -ry; if (ry > 0) an.KeyS = ry; if (rx > 0) an.ArrowRight = rx*0.8; if (rx < 0) an.ArrowLeft = -rx*0.8;
      I.look = null;
    } else {
      if (ly < 0) an.KeyW = -ly; if (ly > 0) an.KeyS = ly; if (lx > 0) an.KeyD = lx; if (lx < 0) an.KeyA = -lx;
      I.look = rx || ry ? {x:rx, y:ry} : null; if (padSteer) { I.mx = I.my = 0; padSteer = false; }
    }
    if (down(9)) togglePause();
  } else {
    I.an = {}; I.look = null;
    if (I.lmb && padPrev[7]) I.lmb = false; if (I.rmb && padPrev[6]) I.rmb = false;
    padNavT -= dt; const nav = down(12) || down(14) ? -1 : down(13) || down(15) ? 1 : 0, st = Math.abs(ly) > 0.5 || Math.abs(lx) > 0.5 ? Math.sign(ly || lx) : 0;
    if (nav) { padFocus(nav); padNavT = 0.3; } else if (st && padNavT <= 0) { padFocus(st); padNavT = 0.22; }
    if (down(0)) { const a = document.activeElement; if (a && a.click && a !== document.body) a.click(); else padFocus(1); }
    if (down(1) && ov) { const c = document.querySelector('#overlay [data-act=close], #overlay [data-act=resume]'); if (c) c.click(); }
    if (down(9)) { if (state === 'mission' && paused) togglePause(); else { const b = ov ? document.querySelector('#overlay [data-act=slaunch], #overlay [data-act=resume]') : document.querySelector('[data-brief]'); if (b) b.click(); } }
  }
  for (let i = 0; i < gp.buttons.length; i++) padPrev[i] = bt(i);
}
G.pollPad = pollPad;

/* ---------- Renderer ---------- */
const renderer = new THREE.WebGLRenderer({canvas:view, antialias:true, powerPreference:'high-performance', logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1)); renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
try { G.env = G.makeEnv(renderer); } catch (e) { G.env = null; }
G.renderer = renderer;
const hcam = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 0.5, 400);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false); hcam.aspect = innerWidth/innerHeight; hcam.updateProjectionMatrix();
  if (G.game && G.game.scene) G.game.resize();
});

let previewId = null;
let state = 'hangar', paused = false, Hg = null, hf = null, pose = 'jet', orbit = {a:0.7, e:0.28, r:28, idle:0, drag:null}, tab = 'story';
G.loadSave(); if (G.save.board.some(m => !m.tasks)) { G.save.board = G.genBoard(); G.persist(); } G.hud.init();

/* ---------- Hangar scene ---------- */
function buildHangarFighter(){
  if (hf) Hg.anchor.remove(hf.root);
  { const pf = G.frame(previewId || G.save.frame); hf = G.buildFighter(Object.assign({}, pf, {lasers:G.laserCount(pf)})); } hf.root.rotation.order = 'YXZ'; Hg.anchor.add(hf.root);
  hf.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  hf.setMode(pose, true); hf.setMissiles(1); hf.setGear(true, true);   // parked on its wheels in the hangar
}
function initHangar(){
  Hg = G.buildHangar(); if (G.env) Hg.scene.environment = G.env; buildHangarFighter(); Hg.refresh();
  view.addEventListener('pointerdown', e => { if (state !== 'hangar') return; orbit.drag = {x:e.clientX, y:e.clientY, a:orbit.a, e:orbit.e}; });
  addEventListener('pointermove', e => { if (!orbit.drag) return; orbit.a = orbit.drag.a - (e.clientX - orbit.drag.x)*0.006; orbit.e = Math.max(0.05, Math.min(0.9, orbit.drag.e + (e.clientY - orbit.drag.y)*0.004)); orbit.idle = 0; });
  addEventListener('pointerup', () => orbit.drag = null);
  view.addEventListener('wheel', e => { if (state !== 'hangar') return; orbit.r = Math.max(15, Math.min(42, orbit.r + e.deltaY*0.02)); }, {passive:true});
}
let hy = 2;
function updateHangar(dt, t){
  orbit.idle += dt; if (!orbit.drag && orbit.idle > 3) orbit.a += dt*0.08;
  const ty = pose === 'jet' ? 2.0 : pose === 'hover' ? 7.5 + Math.sin(t*1.6)*0.3 : 6.0;
  hy += (ty - hy)*Math.min(1, dt*3); hf.root.position.set(0, hy, 0);
  hf.ctl.thrust = pose === 'hover' ? 0.6 : 0.15; hf.update(dt);
  const look = pose === 'mech' ? 5 : 3;
  const narrow = innerWidth < 760, off = narrow ? 0 : -6;
  hcam.position.set(Math.sin(orbit.a)*orbit.r + Math.cos(orbit.a)*off, look + 2 + orbit.r*Math.sin(orbit.e), Math.cos(orbit.a)*orbit.r - Math.sin(orbit.a)*off);
  hcam.lookAt(Math.cos(orbit.a)*off, look, -Math.sin(orbit.a)*off);
}

/* ---------- Hangar UI ---------- */
function stat(cat, w){
  const st = G.stats();
  return {gun:`${w.dmg} dmg · ${w.rof} rds/s`, missile:`${w.dmg} dmg · ${Math.round(w.cap*st.rack)} rounds · salvo ${w.salvo}`, pod:`${w.dmg} dmg · ${w.rof} rds/s`,
    laser:`${w.dmg} dmg · ${w.cd}s cycle`, bomb:`${w.cluster ? w.cluster + ' × ' : ''}${w.dmg} dmg · ${w.radius} m blast · ${Math.max(1, Math.round(w.cap*(0.75 + 0.25*st.rack)))} carried`, melee:`${w.dmg} dmg · ${w.range} m reach`, shield:`${Math.round(w.block*100)}% frontal block`}[cat];
}
const pips = (r, m) => Array.from({length:m}, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('');
const bar = (v, lbl) => `<div class="fbar"><span>${lbl}</span><i><i style="width:${Math.round(Math.min(1, v)*100)}%"></i></i></div>`;

/* ---------- Story campaign ---------- */
const GRADE = {perfect:'Perfect', success:'Success', fail:'Failure'};
const WSTAT = {active:'Available', captured:'Captured', kia:'Killed in action', locked:'Not yet in the squadron'};
function arkQuip(st){
  if (st.ending) { const v = G.ENDINGS[st.ending].vol; return v === 3 ? 'Three wars. I am going to sleep for a month. Don’t call me.' : v === 2 ? 'Two wars, two medals, one very tired operations officer.' : 'The war is over. Don’t get comfortable. I certainly won’t let you.'; }
  if (st.node === 'v3n1') return 'A year of quiet. I knew it couldn’t last. Sit. Read.';
  if (st.node === 'v2n1') return 'Six months of peace. I was starting to like it. Sit down, something has come up.';
  if (!st.log.length) return 'You’re late. The briefing is on the table. Read it before you ask me questions I’ve already answered.';
  const last = st.log[st.log.length - 1].grade;
  return last === 'perfect' ? 'Don’t smile at me like that. Read your orders.' : last === 'fail' ? 'We’re not done. Not even close. Next orders are on the table.' : 'New orders. Same rules: you fly, I think, everyone comes home.';
}
function wingCards(st, inBrief){
  const node = st.node && G.STORY[st.node], forced = node && node.wing;
  return Object.values(G.WINGMEN).map(W => {
    const status = st.roster[W.id] || 'locked', known = status !== 'locked', cur = (forced || G.activeWing()) === W.id;
    const btn = status !== 'active' ? '' : cur ? `<span class="w-on">${forced ? 'Assigned for this mission' : 'On your wing'}</span>` : forced ? '' : `<button class="ghost" data-wing="${W.id}"${inBrief ? ' data-inbrief="1"' : ''}>Fly with ${esc(W.name)}</button>`;
    return `<div class="wcard ${status}${cur ? ' cur' : ''}"><div class="wc-h"><b>${known ? esc(W.name) : '???'}</b><span class="wst">${WSTAT[status]}</span></div>
      ${known ? `<small>${esc(W.full)} · ${esc(W.trait)}</small><p>${esc(W.bio)}</p>` : '<p>Unknown pilot. Keep flying.</p>'}${btn}</div>`;
  }).join('');
}
function storyPanel(){
  const s = G.save, st = s.story; let h = '';
  h += `<div class="ark-head">${G.portrait(st.ending ? G.ENDINGS[st.ending].mood : 'stern', 'sm')}<div><small>${esc(G.OFFICER.role)}</small><b>${esc(G.OFFICER.name)}</b><p>“${esc(arkQuip(st))}”</p></div></div>`;
  if (st.ending) {
    const E = G.ENDINGS[st.ending];
    h += `<article class="sortie story"><div class="s-top"><span class="s-tag">Volume ${E.vol || 1} complete</span><span class="threat">${esc(E.grade)}</span></div><h3>${esc(E.title)}</h3>
      ${E.text(st).map(t => `<p class="s-brief">${esc(t)}</p>`).join('')}<div class="s-foot" style="flex-wrap:wrap;gap:8px"><button class="ghost" data-story="reset">Replay from Volume 1</button>${(E.vol || 1) >= 2 ? `<button class="ghost" data-story="vol" data-v="2">Replay Volume 2</button>` : ''}${(E.vol || 1) >= 3 ? `<button class="launch" data-story="vol" data-v="3">Replay Volume 3</button>` : `<button class="launch" data-story="vol" data-v="${(E.vol || 1) + 1}">Begin Volume ${(E.vol || 1) + 1} · ${(E.vol || 1) === 1 ? 'Ascendant' : 'Harbinger'}</button>`}</div></article>`;
    if (!E.vol) h += `<p class="panel-note">Volume 2 · Ascendant: five new missions. Six months after the armistice, something enormous crosses Cinder Reach. Your wingmen and story choices carry over.</p>`;
    if (E.vol === 2) h += `<p class="panel-note">Volume 3 · Harbinger: five new missions. The Varn have rebuilt a salvaged Kestrel three times over, as a bomber that stands up and walks.</p>`;
  } else {
    const m = G.storyMission(st.node), node = G.STORY[st.node];
    h += `<article class="sortie story"><div class="s-top"><span class="s-tag">${esc(node.chapter)}</span><span class="threat">Mission ${G.storyStep()}</span></div>
      <h3>${esc(m.title)}</h3><p class="s-place">${esc(m.place)} · Wingman: ${esc(G.WINGMEN[m.wing].name)}</p>
      <p class="s-threat threat">Threat <b>${'■'.repeat(m.tier)}<s>${'■'.repeat(3 - m.tier)}</s></b> <span>${['', 'Low', 'Moderate', 'High'][m.tier]}</span></p><p class="s-brief">“${esc(m.briefLines[0])}”</p>
      <ol class="s-wps">${m.tasks.map((t, i) => `<li><b>WP${i + 1}</b><span>${esc(G.taskText(t))}</span></li>`).join('')}<li><b>RTB</b><span>Return to the Bastion</span></li></ol>
      <div class="s-foot"><div class="pay"><b>${G.money(m.reward)}</b><small>${m.xp} XP · +${G.money(m.perfectBonus)} if perfect</small></div><button class="launch" data-brief="1">Briefing</button></div></article>`;
  }
  h += `<h4 class="ph">Wingmen</h4>${wingCards(st, false)}`;
  if (st.log.length) h += `<h4 class="ph">Campaign record</h4><ol class="slog">${st.log.map(l => `<li><span>${esc(l.title)}</span><b class="grade g-${l.grade}">${GRADE[l.grade]}</b></li>`).join('')}</ol>`;
  h += `<p class="panel-note">Story missions pay far more than contracts. Complete every side objective for a perfect grade and a 50% bonus. How each mission ends decides where the war goes next.</p>`;
  return h;
}
function showBriefing(){
  const st = G.save.story; if (!st.node) return;
  const m = G.storyMission(st.node), node = G.STORY[st.node];
  overlay(`<div class="br-grid"><div class="br-por">${G.portrait(node.mood)}<p class="br-name">${esc(G.OFFICER.name)}<small>${esc(G.OFFICER.role)}</small></p></div>
    <div class="br-text"><small class="br-ch">${esc(node.chapter)} · ${esc(m.place)}</small><h2>${esc(m.title)}</h2>
    ${m.briefLines.map(l => `<p class="quote">${esc(l)}</p>`).join('')}
    <h4 class="ph">Waypoints</h4><ol class="s-wps">${m.tasks.map((t, i) => `<li><b>WP${i + 1}</b><span>${esc(G.taskText(t))}</span></li>`).join('')}<li><b>RTB</b><span>Return to the Bastion</span></li></ol>
    <h4 class="ph">For a perfect grade</h4><ul class="s-sides">${m.sides.map(sd => `<li><span>${esc(G.sideLabel(sd))}</span><b>+${G.money(sd.cash)}</b></li>`).join('')}</ul>
    <div class="br-pay"><div><small>Reward</small><b>${G.money(m.reward)}</b></div><div><small>Perfect bonus</small><b>+${G.money(m.perfectBonus)}</b></div><div><small>Experience</small><b>${m.xp} XP</b></div></div>
    <h4 class="ph">Wingman</h4><div class="br-wings">${wingCards(st, true)}</div>
    <div class="ov-actions"><button class="ghost" data-act="close">Not yet</button><button data-act="slaunch">Launch</button></div></div></div>`, 'wide brief');
}
function showEnding(key){
  const E = G.ENDINGS[key], st = G.save.story;
  overlay(`<div class="br-grid"><div class="br-por">${G.portrait(E.mood)}<p class="br-name">${esc(G.OFFICER.name)}</p></div><div class="br-text"><small class="br-ch">Volume ${E.vol || 1} complete · ${esc(E.grade)}</small><h2>${esc(E.title)}</h2>
    ${E.text(st).map(t => `<p>${esc(t)}</p>`).join('')}<h4 class="ph">Your war</h4><ol class="slog">${st.log.map(l => `<li><span>${esc(l.title)}</span><b class="grade g-${l.grade}">${GRADE[l.grade]}</b></li>`).join('')}</ol>
    ${(E.vol || 1) < 3 ? `<p>Volume ${(E.vol || 1) + 1} · ${(E.vol || 1) === 1 ? 'Ascendant' : 'Harbinger'} is now open in the Story tab.</p>` : ''}<div class="ov-actions"><button data-act="close">Back to the hangar</button></div></div></div>`, 'wide brief');
}

function renderPanel(){
  const s = G.save, lvl = s.level, p = $('panel'); let h = '';
  if (tab === 'story') h += storyPanel();
  else if (tab === 'sorties') {
    const tm = G.trainingMission();
    h += `<article class="sortie train">
      <div class="s-top"><span class="s-tag">Training</span><span class="threat">${G.save.trained ? 'Completed' : 'Start here'}</span></div>
      <h3>Flight Training</h3><p class="s-place">Kestrel Range · 15 steps · about 10 minutes</p>
      <p class="s-brief">${esc(tm.brief)}</p>
      <div class="s-foot"><div class="pay"><b>${tm.reward ? G.money(tm.reward) : 'Practice'}</b><small>${tm.xp ? tm.xp + ' XP' : 'no pay'}</small></div><button class="launch" data-train="1">Start training</button></div>
    </article>`;
    h += `<p class="panel-note">Accept a sortie to launch. Finish the objective, then press <kbd>R</kbd> in flight to return. Side objectives pay extra.</p>`;
    h += s.board.map(m => `<article class="sortie">
      <div class="s-top"><span class="s-tag">${esc(m.tag)}</span><span class="threat" title="Threat ${m.tier} of 3">Threat <b>${'■'.repeat(m.tier)}<s>${'■'.repeat(3 - m.tier)}</s></b></span></div>
      <h3>${esc(m.title)}</h3><p class="s-place">${esc(m.place)}</p>
      <p class="s-brief">${esc(m.brief)}</p>
      ${m.tasks ? `<ol class="s-wps">${m.tasks.map((t, i) => `<li><b>WP${i + 1}</b><span>${esc(G.taskText(t))}</span></li>`).join('')}<li><b>RTB</b><span>Return to the Bastion</span></li></ol>` : ''}
      <ul class="s-sides">${m.sides.map(sd => `<li><span>${esc(G.sideLabel(sd))}</span><b>+${G.money(sd.cash)} · ${sd.xp} XP</b></li>`).join('')}</ul>
      <div class="s-foot"><div class="pay"><b>${G.money(m.reward)}</b><small>${m.xp} XP</small></div><button class="launch" data-launch="${m.id}">Launch</button></div>
    </article>`).join('');
    h += `<button class="ghost wide" id="btnReroll">Request new orders</button>`;
  } else if (tab === 'loadout') {
    h += `<p class="panel-note">New weapons unlock as your pilot level rises. Equipping is free.</p>`;
    h += G.SLOTS.map(sl => `<div class="slot"><div class="slot-h"><h3>${sl.label}</h3><span class="mtag">${sl.mode}</span></div>
      ${G.WEAPONS[sl.key].map(w => { const locked = w.lvl > lvl, on = s.load[sl.key] === w.id;
        return `<button class="wpn${on ? ' on' : ''}" data-slot="${sl.key}" data-w="${w.id}" ${locked ? 'disabled' : ''}>
          <span class="w-name">${esc(w.name)}</span><span class="w-lvl">${locked ? 'Locked · LV ' + w.lvl : on ? 'Equipped' : 'LV ' + w.lvl}</span>
          <span class="w-desc">${esc(w.desc)}</span><span class="w-stat">${stat(sl.key, w)}</span></button>`; }).join('')}</div>`).join('');
  } else if (tab === 'upgrades') {
    h += `<p class="panel-note">Upgrades carry over to every airframe.</p>`;
    h += G.UPGRADES.map(u => { const r = s.up[u.id] || 0, max = r >= u.max, cost = G.upCost(u, r), ll = u.lvl && lvl < u.lvl;
      return `<div class="upg"><div class="u-h"><h3>${u.name}</h3><span class="pips">${pips(r, u.max)}</span></div><p>${u.desc}</p>
        <button class="buy" data-up="${u.id}" ${max || ll || s.credits < cost ? 'disabled' : ''}>${max ? 'Maxed' : ll ? 'Requires LV ' + u.lvl : 'Upgrade · ' + G.money(cost)}</button></div>`; }).join('');
  } else {
    h += `<p class="panel-note">Preview any frame in the bay, then switch Jet, Hover and Mech below to see it transform.</p>`;
    h += G.FRAMES.map(f => { const own = s.owned.includes(f.id), cur = s.frame === f.id, locked = f.lvl > lvl, shown = (previewId || s.frame) === f.id;
      const act = cur ? '<button class="buy" disabled>Your frame</button>' : own ? `<button class="buy" data-sel="${f.id}">Roll out</button>`
        : locked ? `<button class="buy" disabled>Requires LV ${f.lvl}</button>` : `<button class="buy" data-buy="${f.id}" ${s.credits < f.cost ? 'disabled' : ''}>Buy · ${G.money(f.cost)}</button>`;
      const pv = shown ? `<button class="ghost" disabled>${previewId === f.id ? 'Previewing' : 'In the bay'}</button>` : `<button class="ghost" data-prev="${f.id}">Preview in bay</button>`;
      const img = thumbs[f.id] ? `<img class="thumb" src="${thumbs[f.id]}" alt="${esc(f.name)} in jet mode">` : `<div class="thumb wait">Rendering preview</div>`;
      return `<div class="frm${cur ? ' cur' : ''}${previewId === f.id ? ' prev' : ''}"><div class="f-h"><span class="sw" style="--a:#${f.color.toString(16).padStart(6, '0')};--b:#${f.trim.toString(16).padStart(6, '0')}"></span><h3>${esc(f.name)}</h3></div>
        ${img}<p>${esc(f.desc)}</p><div class="fbars">${bar(f.hp/2900, 'Hull ' + f.hp)}${bar(f.speed/1.6, 'Speed')}${bar(f.agility/1.6, 'Agility')}${bar(f.hard/2, 'Hardpoints')}${bar(f.lasers/4, 'Head lasers ' + f.lasers)}</div>
        <div class="f-btns">${pv}${act}</div></div>`; }).join('');
    if (!thumbsDone) setTimeout(makeThumbs, 30);
  }
  p.innerHTML = h;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
}
const thumbs = {}; let thumbsDone = false;
function makeThumbs(){
  if (thumbsDone) return; thumbsDone = true;
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; let r;
  try { r = new THREE.WebGLRenderer({canvas:c, antialias:true, alpha:true, preserveDrawingBuffer:true}); } catch (e) { return; }
  try {
    const sc = new THREE.Scene(); sc.environment = G.makeEnv(r);
    sc.add(new THREE.HemisphereLight(0xcfe0f0, 0x2a2622, 0.6));
    const k = new THREE.DirectionalLight(0xfff2e0, 1.3); k.position.set(6, 10, 8); sc.add(k);
    const rim = new THREE.DirectionalLight(0x8fc8ff, 0.7); rim.position.set(-8, 4, -10); sc.add(rim);
    const cam = new THREE.PerspectiveCamera(28, 16/9, 0.5, 200); cam.position.set(15, 8.5, 15.5); cam.lookAt(0, -0.4, 0.2);
    for (const f of G.FRAMES) {
      const F = G.buildFighter(f); F.setMode('jet', true); F.setMissiles(1); F.root.rotation.y = -0.25; sc.add(F.root);
      r.render(sc, cam); thumbs[f.id] = c.toDataURL('image/png');
      sc.remove(F.root); F.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
  } catch (e) { console.error(e); }
  r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
  if (tab === 'frames') { const st = $('panel').scrollTop; renderPanel(); $('panel').scrollTop = st; }
}
function renderStatus(){
  const s = G.save, st = G.stats();
  $('pLvl').textContent = s.level; $('pCash').textContent = G.money(s.credits);
  $('pXp').textContent = `${s.xp.toLocaleString('en-US')} / ${G.xpNeed(s.level).toLocaleString('en-US')} XP`;
  $('pXpBar').style.width = Math.round(s.xp/G.xpNeed(s.level)*100) + '%';
  const shown = G.frame(previewId || s.frame);
  $('sFrame').textContent = shown.name; $('hgSub').textContent = `${G.save.callsign || 'Kestrel 1'} · Hangar Bay 03`;
  const lab = document.querySelector('.frame-name small');
  lab.textContent = previewId ? (s.owned.includes(previewId) ? 'Preview · owned' : 'Preview · not owned') : 'In the bay'; lab.classList.toggle('prev', !!previewId);
  const ep = $('btnEndPrev'); ep.hidden = !previewId; ep.textContent = `Back to ${G.frame().name}`;
  const hp = 1 - s.damage; $('sHull').style.width = Math.round(hp*100) + '%'; $('sHullN').textContent = Math.round(hp*100) + '%';
  $('sHull').parentNode.classList.toggle('crit', hp < 0.35);
  const cost = G.repairCost(), b = $('btnRepair');
  if (s.damage <= 0.001) { b.textContent = 'Hull fully repaired'; b.disabled = true; }
  else if (s.credits >= cost) { b.textContent = `Repair hull · ${G.money(cost)}`; b.disabled = false; }
  else if (s.credits > 0) { b.textContent = `Partial repair · ${G.money(s.credits)}`; b.disabled = false; }
  else if (s.damage > 0.6) { b.textContent = 'Field patch to 40% · free'; b.disabled = false; }
  else { b.textContent = `Repair · ${G.money(cost)}`; b.disabled = true; }
  $('sStats').textContent = `${Math.round(st.maxHp*(1 - s.damage))} / ${st.maxHp} HP · ${s.sorties} sorties · ${s.kills} kills`;
  document.querySelectorAll('.poses button').forEach(x => x.classList.toggle('on', x.dataset.pose === pose));
}
let coopBooted = false;
function refreshHangar(){ renderPanel(); renderStatus(); if (Hg) Hg.refresh(); if (!coopBooted) { coopBooted = true; setTimeout(() => G.coop.boot(), 300); } }

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  G.audio.init(); G.audio.ui();
  const s = G.save;
  if (b.dataset.tab) { tab = b.dataset.tab; renderPanel(); $('panel').scrollTop = 0; return; }
  if (b.dataset.pose) { pose = b.dataset.pose; hf.setMode(pose); G.audio.transform(pose); renderStatus(); return; }
  if (b.dataset.slot) { s.load[b.dataset.slot] = b.dataset.w; G.persist(); refreshHangar(); return; }
  if (b.dataset.up) { const u = G.UPGRADES.find(x => x.id === b.dataset.up), r = s.up[u.id] || 0, c = G.upCost(u, r); if (s.credits >= c && r < u.max) { s.credits -= c; s.up[u.id] = r + 1; G.persist(); refreshHangar(); } return; }
  if (b.dataset.prev) { previewId = b.dataset.prev === s.frame ? null : b.dataset.prev; buildHangarFighter(); G.audio.transform(pose); refreshHangar(); return; }
  if (b.id === 'btnEndPrev') { previewId = null; buildHangarFighter(); refreshHangar(); return; }
  if (b.dataset.buy) { previewId = null; const f = G.frame(b.dataset.buy); if (s.credits >= f.cost) { s.credits -= f.cost; s.owned.push(f.id); s.frame = f.id; s.damage = 0; G.persist(); buildHangarFighter(); refreshHangar(); } return; }
  if (b.dataset.sel) { previewId = null; s.frame = b.dataset.sel; s.damage = 0; G.persist(); buildHangarFighter(); refreshHangar(); return; }
  if (b.dataset.brief) { showBriefing(); return; }
  if (b.dataset.wing) { s.story.wing = b.dataset.wing; G.persist(); if (b.dataset.inbrief) showBriefing(); else renderPanel(); return; }
  if (b.dataset.story === 'vol') { G.storyVol(+b.dataset.v); renderPanel(); showBriefing(); return; }
  if (b.dataset.story === 'reset') { overlay(`<h2>Replay the campaign?</h2><p>The war starts over from Chapter 1. Your pilot level, money, frames and upgrades all stay.</p><div class="ov-actions"><button class="ghost" data-act="close">Cancel</button><button data-act="sreset">Replay from Chapter 1</button></div>`, 'slim'); return; }
  if (b.dataset.train) { tryLaunch(G.trainingMission()); return; }
  if (b.dataset.launch) { const m = s.board.find(x => x.id === b.dataset.launch); if (m) tryLaunch(m); return; }
  if (b.id === 'btnReroll') { s.board = G.genBoard(); G.persist(); renderPanel(); return; }
  if (b.id === 'btnRepair') {
    const cost = G.repairCost();
    if (s.credits >= cost) { s.credits -= cost; s.damage = 0; }
    else if (s.credits > 0) { const frac = s.credits/cost; s.damage = s.damage*(1 - frac); s.credits = 0; }
    else if (s.damage > 0.6) s.damage = 0.6;
    G.persist(); renderStatus(); return;
  }
  if (b.id === 'btnManual') { showManual(); return; }
  if (b.id === 'btnCoop') { G.coop.open(); return; }
  if (b.id === 'btnMenu') { showMenu(); return; }
  if (b.id === 'mContinue') { const c = cleanCall(); if (c) s.callsign = c; G.persist(); enterHangar(); return; }
  if (b.id === 'mNew') { const c = cleanCall(); if (!c) { $('mErr').hidden = false; $('mCall').focus(); return; } if (hasSave()) { $('mConfirmName').textContent = c; $('mConfirm').hidden = false; $('mYes').focus(); } else newGame(c); return; }
  if (b.id === 'mYes') { newGame(cleanCall() || 'Kestrel 1'); return; }
  if (b.id === 'mNo') { $('mConfirm').hidden = true; return; }
  if (b.id === 'mQuit') { $('menuMain').hidden = true; $('menuBye').hidden = false; return; }
  if (b.id === 'mBack') { $('menuBye').hidden = true; $('menuMain').hidden = false; return; }
  if (b.dataset.act) act(b.dataset.act);
});

/* ---------- Volume ---------- */
const gfxRow = () => `<div class="volrow gfxrow"><span>Graphics</span><button class="gfxbtn${(G.save.gfx || 'high') === 'high' ? ' on' : ''}" data-gfx="high">High</button><button class="gfxbtn${G.save.gfx === 'low' ? ' on' : ''}" data-gfx="low">Low</button><b>${G.gfx.ready ? '' : G.gfx.failed ? 'High failed to load' : (G.save.gfx || 'high') === 'high' ? 'loading…' : ''}</b></div>`;
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-gfx]'); if (!b) return;
  G.save.gfx = b.dataset.gfx; G.persist(); if (G.save.gfx === 'high') G.gfx.load();
  for (const x of document.querySelectorAll('[data-gfx]')) x.classList.toggle('on', x.dataset.gfx === G.save.gfx);
  G.audio.ui && G.audio.ui();
  if (state === 'mission') G.hud.flash('GRAPHICS CHANGE APPLIES NEXT SORTIE');
});
const sensRow = () => `<label class="volrow" for="pSens"><span>Mouse</span><input type="range" id="pSens" class="sens" min="10" max="200" value="${Math.round((G.save.sens ?? 0.5)*100)}"><b>${Math.round((G.save.sens ?? 0.5)*100)}%</b></label>`;
document.addEventListener('input', e => {
  if (!e.target.classList || !e.target.classList.contains('sens')) return;
  G.save.sens = e.target.value/100; G.persist(); e.target.nextElementSibling.textContent = e.target.value + '%';
});
const volRow = id => `<label class="volrow" for="${id}"><span>Volume</span><input type="range" id="${id}" class="vol" min="0" max="100" value="${Math.round(G.audio.vol()*100)}"><b>${Math.round(G.audio.vol()*100)}</b></label>`;
document.addEventListener('input', e => {
  if (!e.target.classList || !e.target.classList.contains('vol')) return;
  const v = +e.target.value/100; G.audio.init(); G.audio.setVolume(v);
  const b = e.target.parentNode.querySelector('b'); if (b) b.textContent = e.target.value;
});
document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('vol')) G.audio.ui(); });

/* ---------- Overlays ---------- */
function overlay(html, cls = ''){ const o = $('overlay'); $('ovCard').className = 'ov-card ' + cls; $('ovCard').innerHTML = html; o.hidden = false; const f = $('ovCard').querySelector('button'); if (f) f.focus(); }
function closeOverlay(){ $('overlay').hidden = true; }

/* ---------- Cheat screen (Ctrl+Alt+D) ---------- */
function showCheats(){
  if (!G.save || state === 'menu' || state === 'debrief') return;
  if (state === 'mission' && !paused) { paused = true; I.keys.clear(); I.lmb = I.rmb = false; }
  const s = G.save, inM = state === 'mission';
  overlay(`<h2>Cheats</h2><p class="muted">Pilot level <b>${s.level}</b> · ${G.money(s.credits)}${inM ? ' · mission paused' : ''}</p>
    <h4 class="ph">Levels</h4><div class="ov-actions" style="justify-content:flex-start;margin-top:6px"><button data-cheat="lv1">+1 level</button><button data-cheat="lv5">+5 levels</button><button data-cheat="lvmax" class="ghost">Max (level 15)</button></div>
    <h4 class="ph">Money</h4><div class="ov-actions" style="justify-content:flex-start;margin-top:6px"><button data-cheat="c10">+$10,000</button><button data-cheat="c100">+$100,000</button><button data-cheat="c1m" class="ghost">+$1,000,000</button></div>
    <h4 class="ph">Other</h4><div class="ov-actions" style="justify-content:flex-start;margin-top:6px"><button data-cheat="frames" class="ghost">Unlock all frames</button><button data-cheat="fix" class="ghost">${inM ? 'Repair and rearm now' : 'Free repair'}</button></div>
    <h4 class="ph">Story missions</h4><p class="muted" style="margin:2px 0 0">${inM ? 'Finish or abort this sortie to jump.' : 'Sets the next story mission in the hangar. Your story choices so far are kept.'}</p>
    <div class="ov-actions" style="justify-content:flex-start;margin-top:6px;flex-wrap:wrap">${Object.keys(G.STORY).map(id => { const N = G.STORY[id], cur = s.story && s.story.node === id && !s.story.ending;
      return `<button data-cheat="story" data-node="${id}" class="${cur ? '' : 'ghost'}" style="font-size:12px;padding:6px 10px;letter-spacing:0.04em" ${inM ? 'disabled' : ''} title="${esc(N.place)}">${esc(N.chapter.replace(/^Chapter /, 'Ch '))}: ${esc(N.title)}${cur ? ' ✓' : ''}</button>`; }).join('')}</div>
    <div class="ov-actions"><button data-cheat="close">${inM ? 'Close and resume' : 'Close'}</button></div>`, 'slim');
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-cheat]'); if (!b) return;
  const s = G.save, k = b.dataset.cheat, inM = state === 'mission';
  if (k === 'close') { closeOverlay(); if (inM) { paused = false; } if (state === 'hangar') refreshHangar(); return; }
  const lv = n => { for (let i = 0; i < n; i++) { if (s.level >= 15) break; s.level++; } s.xp = 0; };
  if (k === 'lv1') lv(1); if (k === 'lv5') lv(5); if (k === 'lvmax') lv(99);
  if (k === 'c10') s.credits += 10000; if (k === 'c100') s.credits += 100000; if (k === 'c1m') s.credits += 1000000;
  if (k === 'frames') s.owned = G.FRAMES.map(f => f.id);
  if (k === 'story' && !inM) {   // jump the campaign to any story mission
    const id = b.dataset.node, N = G.STORY[id]; if (!N) return;
    if (!s.story) s.story = G.newStory();
    s.story.node = id; s.story.ending = null; if (N.vol) s.story.vol = N.vol;
    if (N.wing) { s.story.roster[N.wing] = 'active'; s.story.wing = N.wing; }
  }
  if (k === 'fix') { s.damage = 0; if (inM) { const P = G.game.player; P.hp = P.maxHp; P.mis = P.maxMis; P.bombs = P.maxBombs; P.flares = P.st.flares; P.fuel = P.st.fuel; P.F.setMissiles(1); } }
  G.persist(); G.audio.ui(); showCheats(); if (state === 'hangar') refreshHangar();
});
const MANUAL = `
  <div class="man-grid">
    <section><h3>All modes</h3><dl>
      <dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> / <kbd>Tab</kbd></dt><dd>Jet · Hover · Mech. Works in mid-air.</dd>
      <dt><kbd>F</kbd></dt><dd>Flares. Decoys incoming missiles.</dd>
      <dt><kbd>J</kbd></dt><dd>Toggle ECM jammer (if fitted).</dd>
      <dt><kbd>T</kbd></dt><dd>Designate / release target.</dd>
      <dt><kbd>V</kbd></dt><dd>Cockpit or chase camera.</dd>
      <dt><kbd>N</kbd></dt><dd>Radar range: 1, 2, 4 or 8 km.</dd>
      <dt><kbd>M</kbd></dt><dd>Engine sound on or off.</dd>
      <dt><kbd>R</kbd></dt><dd>Return to base once the objective is done.</dd>
      <dt><kbd>Esc</kbd> / <kbd>P</kbd></dt><dd>Pause, or abort the sortie.</dd></dl></section>
    <section><h3>Jet</h3><dl>
      <dt>Mouse</dt><dd>Steer: offset from screen center sets pitch and turn.</dd>
      <dt><kbd>W</kbd> <kbd>S</kbd></dt><dd>Throttle. <kbd>Shift</kbd> afterburner.</dd>
      <dt><kbd>A</kbd> <kbd>D</kbd></dt><dd>Rudder.</dd>
      <dt>Left click</dt><dd>Fixed nose guns.</dd>
      <dt>Right click</dt><dd>Missiles. Hold targets in the forward cone to lock. They kill vehicles and light buildings, not heavy ones.</dd>
      <dt><kbd>H</kbd> / middle click</dt><dd>Switch missiles between air-to-air and air-to-ground (jet and hover). Right click fires the selected type (E in mech mode). Hold the trigger and sweep across several targets to lock up to six, then let go to fire one missile at each. Air-to-air missiles lock aircraft only; ground missiles lock everything on the ground, level heavy buildings and break up vehicle groups. Without a lock, ground missiles fly to your aim point.</dd></dl></section>
    <section><h3>Hover</h3><dl>
      <dt>Mouse</dt><dd>Aim anywhere. Push toward the screen edge to turn or look up and down.</dd>
      <dt><kbd>W A S D</kbd></dt><dd>Move. <kbd>Space</kbd> climb, <kbd>C</kbd> descend.</dd>
      <dt>Left click</dt><dd>Gun pod, aimed by the arm.</dd>
      <dt>Right click</dt><dd>Missiles. Targets inside the dashed circle around your cursor lock on.</dd>
      <dt><kbd>E</kbd></dt><dd>Head laser.</dd></dl></section>
    <section><h3>Mech</h3><dl>
      <dt><kbd>W A S D</kbd></dt><dd>Walk. <kbd>Shift</kbd> run. Double-tap a direction to thruster-dash that way (uses thruster fuel).</dd>
      <dt><kbd>Space</kbd></dt><dd>Jump. Hold in the air for thrusters. Use them to break a fall: landing faster than 30 m/s damages the frame.</dd>
      <dt>Left click</dt><dd>Gun pod. <kbd>Q</kbd> swaps the weapon hand between gun pod and sword. With the sword drawn, left click slashes: it lunges forward, hits everything in the arc, and can finish heavy buildings.</dd>
      <dt>One weapon hand</dt><dd>The gun and the sword share the right hand. <kbd>Q</kbd> swaps them (about half a second); left click fires or swings whichever is in hand. <kbd>E</kbd> fires the back-mounted missiles in mech mode, and <kbd>H</kbd> switches them between air and ground.</dd>
      <dt>Shield charge</dt><dd>Hold right click to raise the shield, then double-tap <kbd>W</kbd> to ram the marked enemy with it. The text under your reticle turns cyan and reads CHARGE READY (with a short ping) when you can charge; grey means it's recharging or low on thrust. A hit throws the target back and staggers it, and leaves it open for the sword.</dd>
      <dt>Sword combo</dt><dd>With the blade out, the nearest enemy you can reach is marked with an orange diamond. Left click dashes you in at it and cuts; click again (or hold) to chain three cuts: diagonal, backhand, then an overhead finisher that knocks the target back and staggers it.</dd>
      <dt>Mouse</dt><dd>The mouse is captured during a sortie. In hover and mech it turns the view directly; in the jet it moves the stick. <kbd>Esc</kbd> pauses and frees the cursor. Mouse sensitivity is in the pause menu.</dd>
      <dt>Reavers</dt><dd>Varn melee walkers that sprint and leap at you, then slash with arm blades. Their plating soaks about 70% of gunfire and missiles, but blades hit them in full. Raise the shield (right click) when one winds up, its visor flares, or hit it with the sword during the wind-up to stagger it. Cities are full of them, ground missiles are off-limits over civilians, and blade kills in a city pay double.</dd>
      <dt>Ground strike</dt><dd>Jump (hold a direction to leap that way), then left click in the air with the sword drawn: the mech plunges its blade into the ground and the shockwave hits everything within about 40 m. Landings from jump-pack height only jolt the frame; falls after transforming high in the air still hurt.</dd>
      <dt>Right click</dt><dd>Hold to raise the shield.</dd>
      <dt>Advantages</dt><dd>On or near the ground, anti-air guns and SAMs can't track you and missiles lose lock, but within about 650 m their crews open fire with machine guns. Takes 40% less damage. Gun pod is braced: +40% damage, much tighter spread. Civilians board twice as fast.</dd></dl></section>
    <section><h3>Wingman</h3><dl>
      <dt><kbd>Z</kbd></dt><dd>Attack my target.</dd>
      <dt><kbd>X</kbd></dt><dd>Cover me. Engages threats near you.</dd>
      <dt><kbd>G</kbd></dt><dd>Ping the map where you are aiming. Your wingman moves there and engages.</dd>
      <dt><kbd>B</kbd></dt><dd>Form up on me.</dd></dl></section>
    <section><h3>Controller</h3><dl>
      <dt>Left stick</dt><dd>Jet: fly (pull back to climb). Hover and mech: move.</dd>
      <dt>Right stick</dt><dd>Jet: throttle (up/down) and rudder. Hover and mech: look and aim.</dd>
      <dt>RT / LT</dt><dd>Guns / missiles (mech: shield).</dd>
      <dt>RB / LB</dt><dd>Boost / flares.</dd>
      <dt>A / B</dt><dd>Rise or jump / descend.</dd>
      <dt>X / Y</dt><dd>Head lasers (mech: missile racks) / next mode.</dd>
      <dt>Stick clicks</dt><dd>Left: draw the blade. Right: designate target.</dd>
      <dt>D-pad</dt><dd>Up: camera. Down: missile type. Left: wingman attack. Right: wingman cover.</dd>
      <dt>Back / Start</dt><dd>Return to base / pause. In menus, the D-pad moves, A presses, B closes.</dd></dl></section>
  </div>
  <label class="chk"><input type="checkbox" id="optInvert" ${G.save.invert ? 'checked' : ''}> Invert pitch (mouse up = nose down)</label>
  <p class="muted">Enemy mechs, fighters and tanks: CC0 models by Quaternius and pixelmannen, recoloured for this game.</p>`;
function showManual(after){
  overlay(`<h2>Flight manual</h2>${MANUAL}<div class="ov-actions"><button data-act="${after || 'close'}">${after === 'go' ? 'Launch sortie' : 'Close'}</button></div>`, 'wide');
  $('optInvert').addEventListener('change', e => { G.save.invert = e.target.checked; G.persist(); });
}
let pendingMission = null;
function tryLaunch(m){
  if (G.save.damage > 0.85) { overlay(`<h2>Frame not airworthy</h2><p>Hull is at ${Math.round((1 - G.save.damage)*100)}%. Repair before you launch.</p><div class="ov-actions"><button data-act="close">Back to hangar</button></div>`); return; }
  pendingMission = m;
  if (previewId) { previewId = null; buildHangarFighter(); refreshHangar(); }
  if (!G.save.seenManual && m.type !== 'training') { G.save.seenManual = true; G.persist(); showManual('go'); return; }
  launch();
}
function launch(){
  const m = pendingMission; if (!m) return;
  const gfxWait = G.gfx.wanted() && !G.gfx.ready && !G.gfx.failed;
  overlay(`<p class="loading">${gfxWait ? 'Loading high-detail scenery' : G.assets.ready || G.assets.failed ? 'Launching' : 'Loading models'} · ${esc(m.title)}</p>`, 'slim');
  G.assets.whenReady(() => G.gfx.whenReady(() => setTimeout(() => {
    try {
      const g = G.game = new G.Game(renderer); g.start(m);
      state = 'mission'; paused = false; $('hangar').hidden = true; closeOverlay(); grabMouse();
      if (matchMedia('(pointer: coarse)').matches) G.hud.flash('KEYBOARD AND MOUSE REQUIRED');
    } catch (err) {
      console.error(err); overlay(`<h2>Launch failed</h2><p>${esc(err.message)}</p><div class="ov-actions"><button data-act="close">Back</button></div>`);
    }
  }, 40)));
}
function togglePause(){
  if (state !== 'mission' || G.game.over) return;
  paused = !paused;
  if (paused) {
    I.keys.clear(); I.lmb = I.rmb = false; freeMouse();
    overlay(`<h2>Paused</h2><p class="muted">${esc(G.game.m.title)} · ${esc(G.game.m.place)}</p>
      <div class="ov-actions col"><button data-act="resume">Resume</button><button data-act="manual" class="ghost">Flight manual</button>
      ${G.game.complete && !G.game.holdRTB() ? '<button data-act="rtb" class="ghost">Return to base</button>' : ''}<button data-act="abort" class="danger">Abort sortie</button><button data-act="quit" class="ghost">Quit to main menu</button></div>
      <p class="muted">Quitting abandons this sortie with no rewards.${G.coop.live(G.game) ? ' <b>Co-op: the sortie keeps running while this menu is open.</b>' : ''}</p>${volRow('pVol')}${sensRow()}${gfxRow()}`, 'slim');
  } else { closeOverlay(); grabMouse(); }
}
function act(a){
  if (a === 'close') { closeOverlay(); return; }
  if (a === 'go') { closeOverlay(); launch(); return; }
  if (a === 'resume') { paused = false; closeOverlay(); grabMouse(); return; }
  if (a === 'manual') { overlay(`<h2>Flight manual</h2>${MANUAL}<div class="ov-actions"><button data-act="pause">Back</button></div>`, 'wide'); $('optInvert').addEventListener('change', e => { G.save.invert = e.target.checked; G.persist(); }); return; }
  if (a === 'pause') { paused = false; togglePause(); return; }
  if (a === 'abort') { paused = false; closeOverlay(); G.game.aborted = true; G.game.end(false, 'Sortie aborted · hull reset, no repairs'); return; }
  if (a === 'rtb') { paused = false; closeOverlay(); G.game.end(true); return; }
  if (a === 'hangar') { closeOverlay(); toHangar(); return; }
  if (a === 'slaunch') { closeOverlay(); tryLaunch(G.storyMission(G.save.story.node)); return; }
  if (a === 'sreset') { G.storyReset(); closeOverlay(); tab = 'story'; renderPanel(); return; }
  if (a === 'scommit' || a === 'sretry') {
    const r = storyResult; storyResult = null; closeOverlay(); toHangar(); tab = 'story';
    if (!r) { renderPanel(); return; }
    if (a === 'sretry') { renderPanel(); tryLaunch(G.storyMission(r.node)); return; }
    const end = G.storyCommit(r.node, r.grade); refreshHangar(); if (end) showEnding(end); return;
  }
  if (a === 'quit') { paused = false; closeOverlay(); if (G.game) { G.game.over = true; G.audio.loops(null, true); G.game.dispose(); G.game = null; } G.hud.hide(); showMenu(); return; }
}
let storyResult = null;
G.ui = {
  overlay, closeOverlay, refresh(){ if (state === 'hangar') refreshHangar(); },
  // co-op: the lead launched; start the same sortie here as their wingman
  coopLaunch(m){
    if (state === 'mission' && G.game && !G.game.over) return;
    if (state === 'debrief' || state === 'menu') { $('menu').hidden = true; }
    paused = false; closeOverlay(); pendingMission = m; launch();
  },
  debrief(r){
    storyResult = r.story || null;
    state = 'debrief'; G.hud.hide(); freeMouse();
    const mm = `${Math.floor(r.time/60)}:${String(Math.floor(r.time % 60)).padStart(2, '0')}`;
    const row = l => `<tr><td>${esc(l.label)}</td><td class="${l.cash < 0 ? 'neg' : ''}">${G.money(l.cash)}</td><td>${l.xp} XP</td></tr>`;
    overlay(`<div class="db-head ${r.success ? 'ok' : 'bad'}"><small>${esc(r.title)} · ${esc(r.place)}</small><h2>${r.success ? 'Mission successful' : 'Mission failed'}</h2><p>${esc(r.reason)} · ${mm} flight time · ${r.kills} kills</p></div>
      <table class="db"><tbody>${r.lines.map(row).join('')}
      ${r.sides.map(sd => `<tr class="side ${sd.ok ? 'ok' : 'bad'}"><td><span class="mk">${sd.ok ? '✓' : '✕'}</span>${esc(sd.label)}</td><td>${sd.ok ? G.money(sd.cash) : '—'}</td><td>${sd.ok ? sd.xp + ' XP' : '—'}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Total</td><td>${G.money(r.cash)}</td><td>${r.xp} XP</td></tr></tfoot></table>
      ${r.ups ? `<div class="promo"><b>Promoted to pilot level ${r.level}</b>${r.unlocked.length ? `<span>Unlocked: ${esc(r.unlocked.join(', '))}</span>` : ''}</div>` : ''}
      ${r.story ? `<div class="db-story">${G.portrait(r.story.out.mood, 'sm')}<div><span class="grade g-${r.story.grade}">${GRADE[r.story.grade]}</span><p class="quote">${esc(r.story.out.say)}</p>${r.story.out.then ? `<p class="then">${esc(r.story.out.then)}</p>` : ''}</div></div>` : ''}
      <p class="muted">Hull at ${Math.round((1 - r.hull)*100)}%. ${r.hull > 0.001 ? `Repairs cost ${G.money(G.repairCost())}.` : ''} ${r.wingAlive || r.story ? '' : `${esc(r.wingName)} was shot down but ejected safely.`}</p>
      <div class="ov-actions">${r.story ? (r.story.grade === 'fail' ? '<button class="ghost" data-act="sretry">Retry mission</button><button data-act="scommit">Accept and continue</button>' : '<button data-act="scommit">Continue the story</button>') : '<button data-act="hangar">Return to hangar</button>'}</div>`, 'debrief');
  }
};
/* ---------- Main menu ---------- */
const hasSave = () => !!(G.save.started || G.save.sorties > 0);
const cleanCall = () => $('mCall').value.replace(/[^\w .\-]/g, '').trim().slice(0, 16);
function showMenu(){
  state = 'menu'; $('hangar').hidden = true; $('menu').hidden = false; $('menuMain').hidden = false; $('menuBye').hidden = true;
  $('mConfirm').hidden = true; $('mErr').hidden = true;
  const s = G.save, has = hasSave();
  $('mCall').value = has ? (s.callsign || '') : '';
  $('mContinue').hidden = !has; $('mContinue').textContent = has ? `Continue as ${s.callsign || 'Kestrel 1'}` : 'Continue';
  $('mNew').className = has ? 'ghost' : 'launch';
  $('mVolWrap').innerHTML = volRow('mVol') + gfxRow();
  $('mMeta').textContent = has ? `Pilot level ${s.level} · ${G.money(s.credits)} · ${s.sorties} sortie${s.sorties === 1 ? '' : 's'} · ${G.frame().name}` : 'New pilots start with the AVF-1 Kestrel and $6,000.';
  setTimeout(() => { try { $('mCall').focus(); } catch (e) {} }, 50);
}
function enterHangar(){
  $('menu').hidden = true; state = 'hangar'; $('hangar').hidden = false;
  G.save.started = true; G.persist(); previewId = null; buildHangarFighter(); refreshHangar();
}
function newGame(call){
  G.resetSave(); G.save.callsign = call; G.save.started = true; G.persist();
  pose = 'jet'; enterHangar();
}
$('mCall').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return; e.preventDefault();
  if (!$('mConfirm').hidden) { $('mYes').click(); return; }
  (hasSave() ? $('mContinue') : $('mNew')).click();
});
$('mCall').addEventListener('input', () => { $('mErr').hidden = true; });

function toHangar(){
  freeMouse();
  if (G.game) { G.game.dispose(); G.game = null; }
  state = 'hangar'; $('hangar').hidden = false; G.hud.hide(); document.body.dataset.mode = 'hangar';
  I.keys.clear(); I.lmb = I.rmb = false; refreshHangar();
}

/* ---------- Loop ---------- */
let last = performance.now();
function loop(t){
  const dt = Math.min(0.05, (t - last)/1000); last = t;
  try { pollPad(dt); } catch (err) {}
  try {
    if (state === 'hangar' || state === 'menu') { updateHangar(dt, t/1000); renderer.render(Hg.scene, hcam); }
    else if (state === 'mission' && G.game) {
      if (!paused || G.coop.live(G.game)) G.game.update(dt);   // co-op: one pilot's pause menu doesn't stop the sky for the other
      if (G.game && !G.game.over) { G.hud.update(G.game, paused ? 0 : dt); G.audio.loops(G.game, paused); }
      if (G.game && G.game.scene) G.game.render();
    } else if (state === 'debrief' && G.game && G.game.scene) { G.game.fx.update(dt); G.game.render(); }
  } catch (err) { console.error(err); }
  I.pressed.clear();
  requestAnimationFrame(loop);
}
initHangar(); refreshHangar(); document.body.dataset.mode = 'hangar'; showMenu();
try { G.assets.load(); } catch (e) { console.warn(e); }
try { if (G.gfx.wanted()) G.gfx.load(); } catch (e) { console.warn(e); }
requestAnimationFrame(loop);
})();
