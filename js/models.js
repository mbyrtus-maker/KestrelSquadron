(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3, D = Math.PI/180;

const cache = {};
G.mat = (hex, o = {}) => {
  const k = hex + '|' + JSON.stringify(o);
  if (!cache[k]) cache[k] = new THREE.MeshStandardMaterial({color:hex, flatShading:true, roughness:o.r ?? 0.6, metalness:o.m ?? 0.2,
    emissive:o.e ?? 0x000000, emissiveIntensity:o.ei ?? 1});
  return cache[k];
};
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
const cylZ = (r1, r2, len, m, x = 0, y = 0, z = 0, seg = 8) => { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI/2); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const cylY = (r1, r2, len, m, x = 0, y = 0, z = 0, seg = 8) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg), m); o.position.set(x, y, z); o.castShadow = true; return o; };
G.box = box; G.cylZ = cylZ; G.cylY = cylY;

/* ---------- Enemy models (Varn) ---------- */
G.buildEnemy = function(type){
  const g = new THREE.Group(), E1 = G.mat(0x857456), E2 = G.mat(0x5a4c3b), RED = G.mat(0xb8372b, {e:0x2a0400});
  const DK = G.mat(0x2b2a28, {r:0.8}), EYE = G.mat(0xff3a2a, {e:0xff2010}), GL = G.mat(0x3a1210, {r:0.1, m:0.6, e:0x200000});
  const u = g.userData;
  if (type === 'tank' || type === 'aa' || type === 'apc' || type === 'sam') {
    if (type === 'apc') { g.add(box(3.6, 2.0, 7, E1, 0, 1.6, 0)); g.add(box(3.8, 0.9, 6.6, DK, 0, 0.55, 0)); g.add(box(1.2, 0.5, 1.2, E2, 0, 2.85, 1)); g.add(cylZ(0.1, 0.1, 1.6, DK, 0, 2.9, 2)); }
    else g.add(box(4.2, 1.4, 6.4, E1, 0, 1.2, 0)), g.add(box(1.1, 1.2, 6.6, DK, 2.2, 0.6, 0)), g.add(box(1.1, 1.2, 6.6, DK, -2.2, 0.6, 0));
    const tur = new THREE.Group(); tur.position.y = type === 'apc' ? 2.7 : 2.2; g.add(tur); u.turret = tur;
    if (type === 'tank') { tur.add(box(2.6, 1.0, 2.8, E2)); tur.add(cylZ(0.18, 0.18, 4, DK, 0, 0.1, 3)); tur.add(box(2.62, 0.15, 0.4, RED, 0, 0.4, -0.9)); }
    if (type === 'aa') { tur.add(box(2.4, 1.2, 2.4, E2)); for (const x of [-0.6, 0.6]) { const b = cylZ(0.12, 0.12, 3.2, DK, x, 1.6, 1.0); b.rotation.x = -0.9; tur.add(b); } tur.add(box(2.42, 0.15, 0.3, RED, 0, 0.5, 0)); }
    if (type === 'sam') { const l = new THREE.Group(); l.position.set(0, 0.6, -0.5); l.rotation.x = -0.6; tur.add(l); l.add(box(2.6, 1.6, 4.4, E2, 0, 0, 1.6));
      for (const x of [-0.6, 0.6]) for (const y of [-0.4, 0.4]) l.add(cylZ(0.32, 0.32, 0.1, RED, x, y, 3.85)); u.launcher = l; }
  } else if (type === 'fighter') {
    g.add(cylZ(0.25, 1.15, 10, E2, 0, 0, 0.5, 6));
    const s = new THREE.Shape(); s.moveTo(0, 2.5); s.lineTo(6, -3.5); s.lineTo(6, -4.4); s.lineTo(-6, -4.4); s.lineTo(-6, -3.5); s.closePath();
    const wg = new THREE.ExtrudeGeometry(s, {depth:0.2, bevelEnabled:false}); wg.rotateX(Math.PI/2); const w = new THREE.Mesh(wg, E1); w.position.y = -0.2; g.add(w);
    for (const x of [-1.6, 1.6]) { const f = box(0.15, 2.4, 2.0, E1, x, 1.2, -3.6); f.rotation.z = x > 0 ? -0.35 : 0.35; g.add(f); g.add(box(0.17, 0.5, 1.0, RED, x*1.22, 2.3, -3.8)); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), GL); c.scale.set(1, 0.8, 2.2); c.position.set(0, 0.7, 2.6); g.add(c);
  } else if (type === 'mech') {
    const hull = new THREE.Group(); hull.position.y = 6.2; g.add(hull); u.hull = hull;
    const hb = box(4.0, 2.8, 4.0, E1); hb.rotation.y = Math.PI/4; hull.add(hb);
    hull.add(box(2.6, 0.8, 2.6, E2, 0, 1.7, 0)); hull.add(box(1.4, 0.7, 0.4, DK, 0, 0.3, 2.6));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), EYE); eye.position.set(0, 0.35, 2.85); hull.add(eye);
    for (const x of [-2.2, 2.2]) { hull.add(box(1.0, 1.0, 1.6, E2, x, 1.1, 0)); hull.add(cylZ(0.25, 0.25, 2.6, DK, x, 1.1, 1.6, 6)); }
    hull.add(box(4.02, 0.2, 0.5, RED, 0, -0.4, 0));
    u.legs = [];
    for (const x of [-1.3, 1.3]) { const L = new THREE.Group(); L.position.set(x, 5.2, 0); g.add(L); u.legs.push(L);
      const th = box(0.9, 3.0, 1.0, E2, 0, -1.4, 0.4); th.rotation.x = 0.35; L.add(th);
      const sh = box(1.0, 3.2, 1.0, E1, 0, -3.6, 0.2); sh.rotation.x = -0.25; L.add(sh); L.add(box(1.6, 0.5, 2.4, DK, 0, -5.0, 0.4)); }
  } else if (type === 'bunker') {
    g.add(box(16, 4, 12, G.mat(0x6d6a60), 0, 2, 0)); g.add(box(10, 1.6, 0.6, DK, 0, 2.4, 6.1)); g.add(box(17, 0.6, 13, G.mat(0x58554d), 0, 4.3, 0));
  } else if (type === 'hangar') {
    const hg = new THREE.CylinderGeometry(13, 13, 30, 12, 1, false, 0, Math.PI); hg.rotateZ(Math.PI/2); hg.rotateY(Math.PI/2);
    const h = new THREE.Mesh(hg, G.mat(0x707a72)); h.position.y = 0; g.add(h); g.add(box(18, 9, 0.5, DK, 0, 4.5, 15));
  } else if (type === 'tower') {
    g.add(cylY(1.2, 2.2, 28, G.mat(0x8a8f8c), 0, 14, 0, 6)); g.add(box(5, 3, 5, E2, 0, 26, 0));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 6, 0, Math.PI*2, 0, Math.PI/3), G.mat(0xd8d8d0)); dish.rotation.x = -1.2; dish.position.set(0, 29, 2); g.add(dish);
    g.add(box(0.4, 4, 0.4, RED, 0, 30, 0));
  } else if (type === 'depot') {
    for (const [x, z] of [[-5, -4], [5, -4], [0, 5]]) { g.add(cylY(4, 4, 7, G.mat(0xb8b2a0), x, 3.5, z, 12)); g.add(box(8.1, 0.6, 1, RED, x, 5, z)); }
  } else if (type === 'command') {
    g.add(box(26, 9, 20, G.mat(0x6a6e66), 0, 4.5, 0)); g.add(box(12, 6, 10, E2, 0, 12, 0)); g.add(box(26.2, 1, 3, RED, 0, 8, 0)); g.add(cylY(0.3, 0.3, 10, DK, 4, 20, 0, 5));
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
};

/* ---------- Civilian city ---------- */
const winTex = {};
/* Facade textures. 'conc': stained concrete with recessed dark windows, a few lit.
   'glass': curtain wall of dull blue-grey panes in a dark mullion grid. One tile = 4 floors x 4 bays. */
const windowTexture = kind => {
  if (winTex[kind]) return winTex[kind];
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'), R = Math.random;
  if (kind === 'glass') {
    x.fillStyle = '#23292e'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 78 + R()*40 | 0; x.fillStyle = R() < 0.06 ? '#9c8a58' : `rgb(${v - 12},${v},${v + 12})`; x.fillRect(2 + i*32, 3 + j*32, 28, 26);
      x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(2 + i*32, 3 + j*32, 28, 5);
    }
  } else {
    x.fillStyle = '#d6d2ca'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(0,0,0,${R()*0.07})`; x.fillRect(R()*128, R()*128, 1 + R()*3, 1 + R()*3); }
    for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(0,0,0,0.13)'; x.fillRect(0, j*32 + 29, 128, 3); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const px = 7 + i*32, py = 7 + j*32, lit = R() < 0.07;
      x.fillStyle = '#14191d'; x.fillRect(px - 1, py - 1, 20, 19);
      x.fillStyle = lit ? '#a8935a' : R() < 0.12 ? '#0c0f11' : '#2a343b'; x.fillRect(px, py, 18, 17);
      if (!lit) { x.fillStyle = 'rgba(160,175,185,0.14)'; x.fillRect(px, py, 18, 5); }
      const gr = x.createLinearGradient(0, py + 18, 0, py + 26); gr.addColorStop(0, `rgba(30,26,20,${0.12 + R()*0.22})`); gr.addColorStop(1, 'rgba(30,26,20,0)');
      x.fillStyle = gr; x.fillRect(px + R()*6, py + 18, 3 + R()*8, 8);
    }
  }
  for (let i = 0; i < 9; i++) { const px = R()*128, gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, `rgba(20,18,14,${0.05 + R()*0.1})`); gr.addColorStop(1, 'rgba(20,18,14,0)'); x.fillStyle = gr; x.fillRect(px, 0, 2 + R()*6, 128); }
  const t = winTex[kind] = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
};
const bmats = {};
const block = (w, h, d, tint, y0, kind = 'conc') => {
  if (G.gfx && G.gfx.hi()) {
    // High graphics: facades baked in Blender. Concrete blocks pick office, apartment brick or war-damaged walls.
    const fk = kind === 'glass' ? 'glass' : ['conc', 'brick', 'damaged', 'conc', 'brick'][Math.floor(Math.random()*5)];
    const m = G.gfx.facadeBox(w, h, d, y0, G.gfx.facade(fk, tint), G.gfx.roofMat()); m.position.y = y0 + h/2; return m;
  }
  const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const f = Math.floor(i/4), sx = f < 2 ? d : w, sy = f === 2 || f === 3 ? d : h; uv.setXY(i, uv.getX(i)*sx/14, uv.getY(i)*sy/14); }
  const k = (tint || 0xffffff) + kind;
  if (!bmats[k]) bmats[k] = new THREE.MeshStandardMaterial({map:windowTexture(kind), color:kind === 'glass' ? 0xc4ccd0 : tint || 0xffffff, roughness:kind === 'glass' ? 0.35 : 0.9, metalness:kind === 'glass' ? 0.45 : 0.03, envMapIntensity:kind === 'glass' ? 0.7 : 0.2, flatShading:true});
  const roofM = G.mat(0x5b5a56, {r:0.95, m:0}), sideM = bmats[k];
  const m = new THREE.Mesh(geo, [sideM, sideM, roofM, roofM, sideM, sideM]); m.position.y = y0 + h/2; m.castShadow = m.receiveShadow = true; return m;
};
G.buildBuilding = (w, h, d, tint) => {
  const g = new THREE.Group(), R = Math.random, roofM = G.mat(0x5b5a56, {r:0.95, m:0}), dk = G.mat(0x35373a, {r:0.8}), lt = G.mat(0x8d8e87, {r:0.8});
  // ground-floor plinth, main block, and a stepped tower on the tall ones; the tallest get glass curtain walls
  const kind = h > 62 && R() < 0.7 ? 'glass' : 'conc';
  if (G.gfx && G.gfx.hi()) { const p = G.gfx.facadeBox(w + 1.2, 4.5, d + 1.2, 0, G.gfx.facade('shop', 0x9a968e), G.gfx.roofMat()); p.position.y = 2.25; p.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2) a[i] = v*10.5/13.5; }); g.add(p); }
  else g.add(box(w + 1.2, 4.5, d + 1.2, G.mat(0x4b4946, {r:0.95, m:0}), 0, 2.25, 0));
  g.add(box(w + 1.3, 0.5, d + 1.3, G.mat(0x2b2c2d, {r:0.9}), 0, 4.6, 0));
  let top = h, tw = w, td = d;
  if (h > 55) {
    const base = h*0.55; g.add(block(w, base - 4.5, d, tint, 4.5, kind === 'glass' && R() < 0.5 ? 'conc' : kind)); g.add(box(w + 0.8, 0.8, d + 0.8, roofM, 0, base + 0.4, 0));
    tw = w*0.66; td = d*0.66; g.add(block(tw, h - base, td, tint, base, kind));
  } else g.add(block(w, h - 4.5, d, tint, 4.5, kind));
  g.add(box(tw + 0.6, 1.0, td + 0.6, roofM, 0, top + 0.5, 0));
  for (let i = 0; i < 2 + Math.floor(R()*3); i++) g.add(box(2 + R()*3, 1.6 + R()*1.6, 2 + R()*3, i % 2 ? dk : lt, (R() - 0.5)*tw*0.6, top + 1.8, (R() - 0.5)*td*0.6));
  if (R() < 0.4) { const wt = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.2, 10), G.mat(0x4f4638, {r:0.95})); wt.position.set(tw*0.25, top + 4.6, -td*0.2); g.add(wt); }
  if (h > 45) { g.add(box(0.4, 10, 0.4, dk, -tw*0.3, top + 6, td*0.3)); g.add(box(0.7, 0.7, 0.7, new THREE.MeshBasicMaterial({color:0xff3020}), -tw*0.3, top + 11.2, td*0.3)); }
  return g;
};
G.buildCivilians = () => {
  const g = new THREE.Group(), cols = [0xd04a3a, 0x3a7ad0, 0xe0c040, 0x5aa050, 0xe8e8e8, 0x8a4ab0];
  for (let i = 0; i < 9; i++) { const p = cylY(0.35, 0.35, 1.7, G.mat(cols[i % 6]), Math.cos(i*2.4)*(2 + i*0.5), 0.85, Math.sin(i*2.4)*(2 + i*0.5), 5); g.add(p); }
  g.add(cylY(0.1, 0.1, 4, G.mat(0xdddddd), 6, 2, 0, 4)); g.add(box(0.8, 0.5, 0.05, G.mat(0x45e070, {e:0x20a040}), 6.4, 3.7, 0));
  return g;
};

/* ---------- Bomb mesh ---------- */
G.BOMB_G = 24;
G.buildBomb = (w, small) => {
  const g = new THREE.Group(), s = small ? 0.45 : w.id === 'bmb_bb' ? 1.25 : 1;
  const body = w.id === 'bmb_cbu' ? 0xc9c4b4 : w.id === 'bmb_bb' ? 0x4a5058 : 0x5f6a54;
  g.add(cylZ(0.32*s, 0.32*s, 2.4*s, G.mat(body))); g.add(cylZ(0.02, 0.32*s, 0.7*s, G.mat(body), 0, 0, 1.55*s));
  g.add(cylZ(0.24*s, 0.1*s, 0.5*s, G.mat(0x2b2d30), 0, 0, -1.45*s));
  for (const r of [0, Math.PI/2]) { const f = box(1.1*s, 0.05, 0.5*s, G.mat(0x2b2d30), 0, 0, -1.4*s); f.rotation.z = r; g.add(f); }
  g.add(box(0.66*s, 0.08*s, 0.18*s, G.mat(0xd8c24a), 0, 0.3*s, 0.6*s));
  return g;
};

/* ---------- Missile mesh ---------- */
G.buildMissile = (enemy) => {
  const g = new THREE.Group();
  g.add(cylZ(0.18, 0.18, 2.2, G.mat(enemy ? 0x6f5f48 : 0xd9d4c4))); g.add(cylZ(0.01, 0.18, 0.5, G.mat(enemy ? 0x4a1a12 : 0xb53a2a), 0, 0, 1.35));
  g.add(box(0.8, 0.05, 0.4, G.mat(0x444444), 0, 0, -0.9)); g.add(box(0.05, 0.8, 0.4, G.mat(0x444444), 0, 0, -0.9));
  return g;
};

/* ---------- Hangar bay ---------- */
const floorTexture = () => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = '#34383a'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(8,8,8,${0.05 + Math.random()*0.16})`; x.beginPath(); x.ellipse(Math.random()*1024, Math.random()*1024, 14 + Math.random()*70, 8 + Math.random()*36, Math.random()*3, 0, 7); x.fill(); }
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random()*0.05})`; x.fillRect(Math.random()*1024, Math.random()*1024, 3 + Math.random()*10, 3 + Math.random()*10); }
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; for (let i = 0; i <= 1024; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 1024); x.moveTo(0, i); x.lineTo(1024, i); x.stroke(); }
  x.save(); x.translate(512, 512); x.strokeStyle = '#d8a63a'; x.lineWidth = 10; x.beginPath(); x.arc(0, 0, 230, 0, Math.PI*2); x.stroke();
  x.setLineDash([30, 22]); x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 260, 0, Math.PI*2); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(216,166,58,0.85)'; x.font = 'bold 110px "Saira Extra Condensed", "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.fillText('BAY 03', 0, 380); x.restore();
  for (let i = 0; i < 1024; i += 40) { x.fillStyle = (i/40) % 2 ? '#1c1c1c' : '#d8a63a'; x.fillRect(i, 980, 40, 26); x.fillRect(i, 18, 40, 26); }
  const t = new THREE.CanvasTexture(c); return t;
};
G.buildHangar = function(){
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d1216); scene.fog = new THREE.Fog(0x0d1216, 60, 160);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({map:floorTexture(), roughness:0.85, metalness:0.1}));
  floor.receiveShadow = true; scene.add(floor);
  const wallM = G.mat(0x262d32, {r:0.9}), ribM = G.mat(0x343d44, {r:0.7, m:0.4});
  scene.add(box(90, 30, 1, wallM, 0, 15, 45)); scene.add(box(1, 30, 90, wallM, -45, 15, 0)); scene.add(box(1, 30, 90, wallM, 45, 15, 0));
  scene.add(box(24, 30, 1, wallM, -33, 15, -45)); scene.add(box(24, 30, 1, wallM, 33, 15, -45)); scene.add(box(42, 8, 1, wallM, 0, 26, -45));
  const out = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshBasicMaterial({color:0x9c8a76, fog:false})); out.position.set(0, 20, -120); scene.add(out);
  const out2 = new THREE.Mesh(new THREE.PlaneGeometry(200, 30), new THREE.MeshBasicMaterial({color:0x4c545e, fog:false})); out2.position.set(0, 52, -119); scene.add(out2);
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(200, 80).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x1f2326, fog:false})); tarmac.position.set(0, -0.05, -85); scene.add(tarmac);
  for (let i = 0; i < 14; i++) { const l = box(0.6, 0.3, 0.6, new THREE.MeshBasicMaterial({color:i % 2 ? 0x8fe2ff : 0xffd27a}), -36 + i*5.5, 0.2, -70); scene.add(l); }
  for (let z = -40; z <= 40; z += 16) { scene.add(box(1.6, 30, 1.6, ribM, -43.5, 15, z)); scene.add(box(1.6, 30, 1.6, ribM, 43.5, 15, z)); scene.add(box(90, 1.4, 1.2, ribM, 0, 29, z)); }
  const lampM = new THREE.MeshBasicMaterial({color:0xfff2d8});
  for (let z = -30; z <= 30; z += 15) for (const x of [-14, 14]) scene.add(box(6, 0.3, 1.2, lampM, x, 27.5, z));
  scene.add(new THREE.HemisphereLight(0xbcd2e8, 0x2a2622, 0.55));
  const key = new THREE.SpotLight(0xfff1dc, 2.2, 120, 0.55, 0.5, 1.2); key.position.set(10, 28, 14); key.target.position.set(0, 2, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xd9a070, 0.55); rim.position.set(0, 12, -40); scene.add(rim);
  const fill = new THREE.PointLight(0x6fb0ff, 0.6, 80); fill.position.set(-20, 10, 10); scene.add(fill);

  // weapon racks along both walls
  const props = {}, rackM = G.mat(0x4a5258, {r:0.6, m:0.5});
  const cats = ['gun', 'missile', 'pod', 'laser', 'melee', 'shield'];
  const md = G.mat(0x2a2f35, {r:0.7, m:0.4});
  const makeProp = (cat, w) => {
    const g = new THREE.Group();
    if (cat === 'gun') { for (const x of [-0.4, 0.4]) g.add(cylZ(0.14, 0.14, 2.6, md, x, 1.0, 0)); g.add(box(1.4, 0.6, 1.2, md, 0, 0.6, -1)); }
    if (cat === 'missile') { const n = w.salvo > 3 ? 6 : w.salvo > 1 ? 4 : 2, big = w.groundMul ? 1.5 : 1;
      for (let i = 0; i < n; i++) { const m = G.buildMissile(false); m.scale.setScalar(big); m.position.set((i % 2 ? 0.5 : -0.5)*big, 0.5 + Math.floor(i/2)*0.6*big, 0); g.add(m); } }
    if (cat === 'pod') { g.add(box(0.55, 0.75, 3.0, md, 0, 1, 0.4)); g.add(box(0.75, 0.95, 1.0, md, 0, 0.9, -1)); g.add(cylZ(0.16, 0.16, 1.4, md, 0, 1.05, 2.6, 6));
      if (w.id === 'pod_rp7') g.add(box(0.2, 0.2, 3.2, G.mat(0x8fd4ff, {e:0x2a6a90}), 0, 1.45, 0.6)); if (w.id === 'pod_br9') g.add(box(0.7, 0.3, 2.0, G.mat(0xff8af0, {e:0x80305a}), 0, 1.5, 0.3)); }
    if (cat === 'laser') { g.add(box(1.1, 0.95, 1.2, md, 0, 0.8, 0)); const n = w.barrels || 2;
      for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1, row = Math.floor(i/2); g.add(cylZ(0.07, 0.07, 1.1, G.mat(0xb0b8bd), s*0.66, 1.2 + row*0.26, 0.4, 6)); } }
    if (cat === 'melee') { const len = 2.4 + w.range*0.08; g.add(box(0.18, 0.32, 0.8, md, 0, 0.6, -len/2)); g.add(box(0.08, 0.36, len, G.mat(w.id === 'mel_plasma' ? 0xffa040 : 0xc8ced2, w.id === 'mel_knife' ? {m:0.8, r:0.3} : {e:w.id === 'mel_plasma' ? 0xff7a20 : 0x334455}), 0, 0.6, 0.4)); g.rotation.y = 0.4; }
    if (cat === 'shield') { const s = box(0.3, 3.0, 2.2, G.mat(w.id === 'shd_field' ? 0x6fe6ff : 0xb5b9b2, w.id === 'shd_field' ? {e:0x1e6070} : {}), 0, 1.6, 0); s.rotation.y = Math.PI/2; g.add(s); }
    return g;
  };
  cats.forEach((cat, ci) => {
    const side = ci < 3 ? -1 : 1, row = ci % 3, z = -22 + row*16;
    G.WEAPONS[cat].forEach((w, i) => {
      const x = side*(36 - i*0.2), zz = z + (i - 1)*4.4;
      const table = box(4.4, 1.0, 3.6, rackM, x, 0.5, zz); scene.add(table);
      const prop = makeProp(cat, w); prop.position.set(x, 1.0, zz); prop.rotation.y += side > 0 ? -Math.PI/2 : Math.PI/2;
      prop.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.base = o.material.color.getHex(); } });
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.6, 28).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0xffb238, transparent:true, opacity:0.9}));
      ring.position.set(x, 1.02, zz); scene.add(ring); scene.add(prop);
      props[w.id] = {prop, ring, w, cat};
    });
  });
  const anchor = new THREE.Group(); scene.add(anchor);
  const H = {scene, anchor, props};
  H.refresh = () => {
    const lvl = G.save.level, L = G.save.load;
    for (const id in props) {
      const p = props[id], ok = p.w.lvl <= lvl, eq = L[p.cat] === id;
      p.ring.visible = eq;
      p.prop.traverse(o => { if (o.isMesh) { o.material.transparent = !ok; o.material.opacity = ok ? 1 : 0.28; o.material.color.setHex(ok ? o.userData.base : 0x30363a); } });
    }
  };
  return H;
};
})();
