(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3;

/* ---------- Shared materials: Varn desert camo ---------- */
let MT = null;
function camoCanvas(base, tones){
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    x.fillStyle = tones[i % tones.length]; x.beginPath();
    x.ellipse(Math.random()*256, Math.random()*256, 10 + Math.random()*34, 6 + Math.random()*20, Math.random()*3, 0, 7); x.fill();
  }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(0,0,0,${Math.random()*0.06})`; x.fillRect(Math.random()*256, Math.random()*256, 2, 2); }
  return c;
}
/* Armour detail sheet: panel seams, fasteners, access hatches, grime streaks, chipped edges and stencils, multiplied over the paint. */
function panelCanvas(base, tones, seed){
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  let s = seed; const R = () => (s = (s*16807) % 2147483647)/2147483647;
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  if (tones) for (let i = 0; i < 70; i++) { x.fillStyle = tones[i % tones.length]; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(R()*512, R()*512, 18 + R()*60, 10 + R()*34, R()*3, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  // plate layout: recursive splits so seams read as real panel joints
  const rects = []; const split = (x0, y0, w, h, d) => { if (d > 3 || (w < 90 && h < 90) || (d > 1 && R() < 0.25)) { rects.push([x0, y0, w, h]); return; }
    if (w > h) { const k = w*(0.3 + R()*0.4); split(x0, y0, k, h, d + 1); split(x0 + k, y0, w - k, h, d + 1); } else { const k = h*(0.3 + R()*0.4); split(x0, y0, w, k, d + 1); split(x0, y0 + k, w, h - k, d + 1); } };
  split(0, 0, 512, 512, 0);
  for (const [a, b, w, h] of rects) {
    x.fillStyle = `rgba(255,255,255,${0.03 + R()*0.06})`; x.fillRect(a + 2, b + 2, w - 4, h - 4);          // slight tone shift per plate
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2; x.strokeRect(a + 1, b + 1, w - 2, h - 2);           // seam
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1; x.strokeRect(a + 3, b + 3, w - 6, h - 6);     // lit edge
    x.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = 6; i < w - 4; i += 18) { x.fillRect(a + i, b + 5, 2, 2); x.fillRect(a + i, b + h - 7, 2, 2); }
    if (R() < 0.18 && w > 60 && h > 40) { x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; x.strokeRect(a + w*0.25, b + h*0.3, w*0.5, h*0.4); }   // hatch
  }
  for (let i = 0; i < 60; i++) { const px = R()*512, py = R()*512, l = 20 + R()*90; const g = x.createLinearGradient(px, py, px, py + l);   // grime streaks
    g.addColorStop(0, 'rgba(30,24,16,0.16)'); g.addColorStop(1, 'rgba(30,24,16,0)'); x.fillStyle = g; x.fillRect(px, py, 2 + R()*5, l); }
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '40,34,26' : '205,200,185'},${0.2 + R()*0.35})`; x.fillRect(R()*512, R()*512, 1 + R()*4, 1 + R()*3); }   // chips
  x.font = 'bold 15px "Arial Narrow",sans-serif'; x.fillStyle = 'rgba(20,18,14,0.6)';
  for (let i = 0; i < 7; i++) x.fillText(['VR-' + (10 + Math.floor(R()*89)), 'NO STEP', '▲ LIFT', 'K' + Math.floor(R()*900), 'FUEL', '7-' + Math.floor(R()*99)][i % 6], R()*450, 20 + R()*480);
  return c;
}
function mats(){
  if (MT) return MT;
  const tex = (c, r) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(r, r); return t; };
  const ground = panelCanvas('#d8d2c0', ['#7d745a', '#4c4636', '#a59c80', '#3c3a30'], 11), sky = panelCanvas('#cfd2d4', ['#8b9297', '#636b72', '#a9aeb2'], 23);
  const plain = panelCanvas('#d9d6cf', null, 37), plainT = tex(plain, 1), bump = tex(panelCanvas('#ffffff', null, 37), 1);
  // Shared Varn palette: smooth-shaded satin paint, same response as the player's craft.
  const S = o => new THREE.MeshStandardMaterial(Object.assign({roughness:0.68, metalness:0.26, envMapIntensity:0.45}, o));
  MT = {
    tan: S({color:0x9a8e6c, map:plainT, bumpMap:bump, bumpScale:0.02}), tanC: S({color:0xa39878, map:tex(ground, 1), bumpMap:bump, bumpScale:0.02}),
    khaki: S({color:0x655e48, map:plainT, bumpMap:bump, bumpScale:0.02}), olive: S({color:0x575c48, map:plainT, bumpMap:bump, bumpScale:0.02}),
    air: S({color:0x84827a, roughness:0.62, metalness:0.3, map:plainT, bumpMap:bump, bumpScale:0.015}), airC: S({color:0x8c8a80, roughness:0.62, metalness:0.3, map:tex(sky, 1), bumpMap:bump, bumpScale:0.015}),
    aceC: S({color:0x55575c, roughness:0.55, metalness:0.4, map:plainT, bumpMap:bump, bumpScale:0.015}),
    dk: S({color:0x34363a, roughness:0.8, metalness:0.3}), rub: S({color:0x1b1c1e, roughness:0.95, metalness:0.05}),
    steel: S({color:0x585a58, roughness:0.45, metalness:0.8}), red: S({color:0x7e2b25, roughness:0.65}),
    glass: S({color:0x1a262c, roughness:0.08, metalness:0.7}), redGlass: S({color:0x3a1412, roughness:0.08, metalness:0.6, emissive:0x200404}),
    conc: S({color:0x777570, roughness:0.95, metalness:0}), concD: S({color:0x4f4d49, roughness:0.95, metalness:0}),
    roof: S({color:0x545c5a, roughness:0.6, metalness:0.6}), sand: S({color:0x867a5c, roughness:1, metalness:0}),
    white: S({color:0xaeada6, roughness:0.75}), eye: S({color:0xff3a2a, emissive:0xff2010, emissiveIntensity:1.3}),
    lamp: new THREE.MeshBasicMaterial({color:0xff3020}), glow: new THREE.MeshBasicMaterial({color:0xffa060})
  };
  return MT;
}
/* Faceted armour: an eight-sided lathe with flat shading (hard chamfered planes instead of round shells), and cut-gem joints. */
const facet = (prof, seg, sx = 1, sy = 1) => {
  let g = new THREE.LatheGeometry(prof.map(([z, r]) => new THREE.Vector2(Math.max(r, 0.0001), z)), 8, Math.PI/8);
  g.rotateX(Math.PI/2); g.scale(sx, sy, 1); g = g.toNonIndexed(); g.computeVertexNormals(); return boxUV(g);
};
// Per-face box projection so the panel sheet keeps a constant scale on every facet (no stretched lathe UVs).
function boxUV(g, k = 0.32){
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count*2);
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [a, b] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i*2] = a*k; uv[i*2 + 1] = b*k; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.userData.boxUV = 1; return g;
}
const gem = (r, sx = 1, sy = 1, sz = 1) => { let g = new THREE.DodecahedronGeometry(r, 0); g.scale(sx, sy, sz); g = g.toNonIndexed(); g.computeVertexNormals(); return boxUV(g); };
const wheelGeo = (r, w) => new THREE.CylinderGeometry(r, r, w, 16).rotateZ(Math.PI/2);
const vcyl = (r1, r2, h, seg = 12) => new THREE.CylinderGeometry(r1, r2, h, seg);
function strut(a, b, r, m){
  const d = new V3().subVectors(b, a), o = new THREE.Mesh(vcyl(r, r, d.length(), 6), m);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); o.castShadow = true; return o;
}

/* Layered guns, built along +Z from the breech (origin) to the muzzle.
   cannon: stepped tapering tube, thermal-sleeve bands, fume extractor, muzzle sensor and a ported muzzle brake.
   auto:   receiver, slotted cooling jacket, tube, three-prong flash hider.
   rotary: housing, clamp plates and a ring of barrels around a spindle. */
function gunBuild(kind, len, r, m){
  const {rbox, cyl, M} = G.geo, g = new THREE.Group(), S = m.steel, D = m.dk, K = m.rub;
  if (kind === 'cannon') {
    const brake = r*2.6, tube = len - brake, seg = [[0, 0.36, 1.25], [0.36, 0.72, 1.1], [0.72, 1, 1.0]];
    for (const [a, b, k] of seg) g.add(M(cyl(r*k*0.97, r*k, tube*(b - a), 12), S, 0, 0, tube*(a + b)/2));
    for (const f of [0.36, 0.72]) g.add(M(cyl(r*1.32, r*1.32, r*0.5, 12), D, 0, 0, tube*f));          // sleeve clamp bands
    g.add(M(cyl(r*1.25, r*1.25, r*0.9, 12), D, 0, 0, r*0.45));                                         // breech collar
    const fz = tube*0.56; g.add(M(cyl(r*1.25, r*1.7, r*0.9, 12), S, 0, 0, fz - r*1.6)); g.add(M(cyl(r*1.7, r*1.7, r*2.2, 12), S, 0, 0, fz)); g.add(M(cyl(r*1.1, r*1.7, r*0.9, 12), S, 0, 0, fz + r*1.6));   // fume extractor
    g.add(M(rbox(r*0.7, r*0.5, r*1.0, r*0.1), D, 0, r*1.25, tube - r*0.9));                             // muzzle reference sensor
    const bz = tube + brake/2; g.add(M(rbox(r*2.0, r*1.8, brake, r*0.2), S, 0, 0, bz));                 // muzzle brake body
    for (const s of [1, -1]) for (const dz of [-0.22, 0.18]) g.add(M(rbox(r*0.25, r*1.2, brake*0.26, r*0.05), K, s*r*1.0, 0, bz + dz*brake));   // baffle ports
    g.add(M(cyl(r*0.85, r*0.85, r*0.3, 12), K, 0, 0, tube + brake + r*0.05));                           // bore
  } else if (kind === 'auto') {
    g.add(M(rbox(r*3.4, r*3.6, len*0.2, r*0.5), D, 0, 0, len*0.1));                                     // receiver
    g.add(M(rbox(r*1.2, r*1.6, len*0.12, r*0.2), K, r*2.2, -r*0.5, len*0.08));                          // feed chute
    const jz = len*0.2, jl = len*0.42;
    g.add(M(cyl(r*1.75, r*1.75, jl, 10), S, 0, 0, jz + jl/2));                                         // cooling jacket
    for (let i = 0; i < 5; i++) for (const a of [0, Math.PI/2, Math.PI, Math.PI*1.5]) {
      const sl = M(rbox(r*0.5, r*0.3, jl*0.11, r*0.05), K, Math.cos(a)*r*1.72, Math.sin(a)*r*1.72, jz + jl*(0.13 + i*0.185)); sl.rotation.z = a; g.add(sl); }
    for (const f of [0, 1]) g.add(M(cyl(r*2.0, r*2.0, r*0.6, 10), D, 0, 0, jz + f*jl));                // jacket end rings
    g.add(M(cyl(r*0.9, r, len*0.34, 10), S, 0, 0, len*0.79));                                          // exposed tube
    const hz = len*0.96; g.add(M(cyl(r*1.3, r*1.3, len*0.08, 10), D, 0, 0, hz));                         // flash hider
    for (let i = 0; i < 3; i++) { const a = i*Math.PI*2/3; g.add(M(rbox(r*0.45, r*0.45, len*0.07, r*0.05), D, Math.cos(a)*r*1.1, Math.sin(a)*r*1.1, len + len*0.02)); }
  } else {   // rotary
    g.add(M(cyl(r*1.6, r*1.8, len*0.3, 10), D, 0, 0, len*0.15));                                        // drive housing
    g.add(M(rbox(r*1.1, r*1.4, len*0.2, r*0.2), K, r*1.6, r*0.4, len*0.12));                            // feed
    g.add(M(cyl(r*0.35, r*0.35, len*0.7, 8), D, 0, 0, len*0.65));                                       // spindle
    for (const f of [0.42, 0.68, 0.95]) g.add(M(cyl(r*1.45, r*1.45, r*0.35, 10), f > 0.9 ? S : D, 0, 0, len*f));   // clamp plates
    for (let i = 0; i < 6; i++) { const a = i*Math.PI/3, x = Math.cos(a)*r*0.95, y = Math.sin(a)*r*0.95;
      g.add(M(cyl(r*0.27, r*0.3, len*0.72, 8), S, x, y, len*0.64)); g.add(M(cyl(r*0.18, r*0.18, r*0.1, 8), K, x, y, len + r*0.02)); }
  }
  return g;
}
const gunAt = (parent, kind, len, r, m, x, y, z, rx = 0) => { const gg = gunBuild(kind, len, r, m); gg.position.set(x, y, z); gg.rotation.x = rx; parent.add(gg); return gg; };

/* Varn spade foot under an ankle at y0 (group-local: +z forward, -y down; sole = ground contact): a tread slab, a boot block,
   a sloped wedge plate over the front, bumper, heel block, side armour and ankle pistons. */
function spadeFoot(L, y0, sole, sc, plateM, m){
  const {rbox, M} = G.geo, b = sole;
  L.add(M(new THREE.CylinderGeometry(0.42*sc, 0.55*sc, 0.3*sc, 8), m.dk, 0, y0 - 0.15*sc, 0.1*sc));                    // ankle collar
  L.add(M(rbox(1.6*sc, 0.3*sc, 2.7*sc, 0.08*sc), m.dk, 0, b + 0.15*sc, 0.3*sc));                                          // tread slab
  for (let i = 0; i < 6; i++) L.add(M(rbox(1.64*sc, 0.08*sc, 0.1*sc, 0.02*sc), m.rub, 0, b + 0.15*sc, (-0.85 + i*0.42)*sc));   // tread grooves
  L.add(M(rbox(1.3*sc, 0.6*sc, 1.5*sc, 0.14*sc), plateM, 0, b + 0.55*sc, 0.05*sc));                                       // boot block
  { const w = M(rbox(1.52*sc, 0.18*sc, 1.35*sc, 0.05*sc), plateM, 0, b + 0.52*sc, 1.15*sc); w.rotation.x = 0.42; L.add(w); }   // wedge plate
  L.add(M(rbox(1.56*sc, 0.26*sc, 0.3*sc, 0.06*sc), m.dk, 0, b + 0.16*sc, 1.68*sc));                                      // bumper
  L.add(M(rbox(1.56*sc, 0.07*sc, 0.12*sc, 0.02*sc), m.red, 0, b + 0.31*sc, 1.7*sc));                                     // warning stripe
  L.add(M(rbox(1.15*sc, 0.5*sc, 0.75*sc, 0.12*sc), plateM, 0, b + 0.45*sc, -0.95*sc));                                    // heel block
  for (const s of [1, -1]) {
    L.add(M(rbox(0.12*sc, 0.55*sc, 1.3*sc, 0.04*sc), m.khaki, s*0.72*sc, b + 0.6*sc, 0.1*sc));                             // side armour
    for (let i = 0; i < 3; i++) L.add(M(rbox(0.04*sc, 0.3*sc, 0.07*sc, 0.01*sc), m.rub, s*0.79*sc, b + 0.62*sc, (-0.25 + i*0.2)*sc));
    L.add(strut(new V3(s*0.4*sc, y0 + 0.2*sc, -0.1*sc), new V3(s*0.48*sc, b + 0.75*sc, 0.75*sc), 0.06*sc, m.steel));        // ankle pistons
  }
}

function tracks(g, L, W, m, M, rbox){
  for (const s of [1, -1]) {
    g.add(M(rbox(0.9, 1.1, L, 0.3), m.rub, s*(W/2 - 0.45), 0.6, 0));
    for (let i = 0; i < 6; i++) { const z = -L/2 + 0.9 + i*(L - 1.8)/5; g.add(M(wheelGeo(0.42, 0.25), m.dk, s*(W/2 - 0.02), 0.5, z)); g.add(M(wheelGeo(0.16, 0.27), m.steel, s*(W/2 - 0.0), 0.5, z)); }
    g.add(M(wheelGeo(0.36, 0.3), m.steel, s*(W/2 - 0.1), 0.85, L/2 - 0.35)); g.add(M(wheelGeo(0.32, 0.3), m.dk, s*(W/2 - 0.1), 0.8, -L/2 + 0.35));
    g.add(M(rbox(0.12, 0.5, L*0.9, 0.04), m.tan, s*(W/2 + 0.08), 1.05, 0));
  }
}

const SHIPS = ['ship_striker', 'ship_spitfire', 'ship_executioner'], MECHS = ['mech_stan', 'mech_george', 'mech_mike', 'mech_leela'];
const fromAsset = (type, o) => {
  return null;   // the cast is hand-built now so everything shares one smooth, sculpted style
  const A = G.assets; if (!A || !A.ready) return null;
  if (type === 'fighter') { const k = o.ace ? 'ship_zenith' : SHIPS[Math.floor(Math.random()*SHIPS.length)]; return A.has(k) ? A.make(k) : null; }
  if (type === 'mech') {
    const k = MECHS[Math.floor(Math.random()*MECHS.length)]; if (!A.has(k)) return null;
    const g = A.make(k, true), src = A.lib[k];
    if (!src.height) { const bb = new THREE.Box3().setFromObject(src.scene); src.height = Math.max(1, bb.max.y - bb.min.y); }
    g.children[0].scale.setScalar(14.5/src.height);   // walkers stand a head taller than your mech
    g.userData.model = k; return g;
  }
  if (type === 'tank' || type === 'aa') {
    if (!A.has('tank')) return null;
    const g = A.make('tank'), gun = g.getObjectByName('gun');
    g.children[0].rotation.y = Math.PI;   // the source model faces -Z
    if (type === 'tank') g.userData.turret = gun;
    else {
      gun.visible = false; const m = mats(), {rbox, cyl, M} = G.geo, tur = new THREE.Group(); tur.position.set(-gun.position.x, gun.position.y, -gun.position.z); g.add(tur); g.userData.turret = tur;
      tur.add(M(rbox(2.4, 1.2, 2.3, 0.2), m.tan, 0, 0.6, 0));
      const guns = new THREE.Group(); guns.position.set(0, 0.8, 0.5); guns.rotation.x = -0.75; tur.add(guns);
      for (const s of [1, -1]) { guns.add(M(rbox(0.4, 0.5, 1.2, 0.08), m.dk, s*1.4, 0, 0.2)); for (const of of [-0.1, 0.12]) gunAt(guns, 'auto', 3.2, 0.06, m, s*1.4 + of, 0.05, 0.6); }
      const spin = new THREE.Group(); spin.position.set(0, 1.5, -0.7); tur.add(spin); g.userData.spin = spin;
      spin.add(M(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), m.dk, 0, 0.3, 0));
      const dish = M(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI*2, 0, Math.PI/3.2), m.white, 0, 0.9, 0.2); dish.rotation.x = -1.35; spin.add(dish);
      tur.add(M(rbox(2.42, 0.16, 0.4, 0.04), m.red, 0, 1.0, -0.8));
    }
    return g;
  }
  return null;
};
G.sandbags = (x, y, z, yaw) => { const A = G.assets; if (!A || !A.has('sandbags')) return null; const s = A.make('sandbags'); s.position.set(x, y, z); s.rotation.y = yaw || 0; return s; };

G.buildEnemy = function(type, o = {}){
  const asset = fromAsset(type, o); if (asset) return asset;
  const m = mats(), {rbox, fin, plate, lathe, cyl, M} = G.geo, g = new THREE.Group(), u = g.userData;
  if (type === 'tank') {
    tracks(g, 6.8, 3.9, m, M, rbox);
    g.add(M(fin([[3.45,0.95],[2.5,1.75],[-3.1,1.75],[-3.45,1.25],[-3.3,0.95]], 3.7, 0.1), m.tan));
    g.add(M(rbox(0.5, 0.3, 0.9, 0.08), m.dk, 1.2, 1.85, -2.6)); g.add(M(rbox(0.5, 0.3, 0.9, 0.08), m.dk, -1.2, 1.85, -2.6));
    const tur = new THREE.Group(); tur.position.set(0, 1.75, -0.3); g.add(tur); u.turret = tur;
    tur.add(M(fin([[1.9,0],[1.25,0.9],[-1.7,0.9],[-2.2,0.4],[-1.9,0]], 2.7, 0.1), m.tan));
    tur.add(M(rbox(1.0, 0.75, 0.6, 0.12), m.tan, 0, 0.42, 1.95));
    gunAt(tur, 'cannon', 4.7, 0.14, m, 0, 0.45, 2.0); tur.add(M(rbox(0.9, 0.62, 0.35, 0.1), m.dk, 0, 0.45, 2.15));   // mantlet + layered main gun
    tur.add(M(vcyl(0.42, 0.46, 0.35, 14), m.tan, 0.6, 1.05, -0.6)); tur.add(M(vcyl(0.36, 0.36, 0.06, 14), m.dk, 0.6, 1.25, -0.6));
    tur.add(M(cyl(0.04, 0.04, 1.1, 6), m.dk, 0.6, 1.4, -0.1));
    tur.add(M(vcyl(0.02, 0.02, 2.6, 4), m.dk, -0.8, 2.15, -1.5));
    for (const s of [1, -1]) for (let i = 0; i < 2; i++) tur.add(M(cyl(0.08, 0.08, 0.35, 8), m.dk, s*(1.15 + i*0.18), 0.6, 1.2));
    tur.add(M(rbox(2.72, 0.16, 0.5, 0.04), m.red, 0, 0.5, -0.8));
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const e = M(rbox(0.5, 0.32, 0.28, 0.03), m.khaki, s*(0.45 + i*0.42), 0.32 + j*0.34, 1.6 - i*0.12); e.rotation.y = s*0.5; tur.add(e); }   // reactive armour
    tur.add(M(rbox(2.3, 0.6, 0.7, 0.05), m.khaki, 0, 0.55, -2.05)); for (const s of [1, -1]) tur.add(M(rbox(0.6, 0.5, 1.4, 0.05), m.olive, s*1.55, 0.55, -1.2));   // bustle rack + bins
    g.add(M(rbox(0.6, 0.4, 1.0, 0.05), m.khaki, 1.3, 1.95, -2.2)); g.add(M(cyl(0.22, 0.22, 1.4, 10), m.olive, -1.2, 2.0, -2.3));
  } else if (type === 'apc') {
    g.add(M(fin([[3.9,0.95],[3.0,2.0],[-3.6,2.0],[-3.95,1.45],[-3.7,0.95]], 3.2, 0.12), m.tan));
    for (const s of [1, -1]) for (const z of [-2.6, -1.3, 1.1, 2.4]) { g.add(M(wheelGeo(0.58, 0.45), m.rub, s*1.55, 0.58, z)); g.add(M(wheelGeo(0.22, 0.47), m.steel, s*1.56, 0.58, z)); }
    for (const s of [1, -1]) g.add(M(rbox(0.1, 0.5, 6.4, 0.04), m.tan, s*1.62, 1.2, 0));
    g.add(M(rbox(1.2, 0.4, 0.12, 0.04), m.glass, 0, 1.75, 3.4));
    const tur = new THREE.Group(); tur.position.set(0, 2.0, 0.6); g.add(tur); u.turret = tur;
    tur.add(M(rbox(1.5, 0.6, 1.6, 0.18), m.tan, 0, 0.3, 0)); gunAt(tur, 'auto', 2.4, 0.07, m, 0, 0.35, 0.6); tur.add(M(rbox(0.3, 0.2, 0.3, 0.05), m.glass, 0.45, 0.62, 0.4));
    g.add(M(rbox(3.22, 0.14, 0.4, 0.04), m.red, 0, 1.6, -1.6));
    for (const s of [1, -1]) { for (let i = 0; i < 3; i++) g.add(M(rbox(0.12, 0.62, 1.7, 0.03), m.khaki, s*1.68, 1.35, -2.4 + i*1.75));   // bolt-on side armour
      g.add(M(rbox(0.2, 0.15, 0.25, 0.03), m.glass, s*0.9, 2.05, 2.7)); }
    g.add(M(rbox(1.6, 0.5, 0.9, 0.05), m.olive, 0, 2.2, -2.6)); g.add(M(vcyl(0.03, 0.03, 2.4, 4), m.dk, -1.2, 3.2, -2.4));
  } else if (type === 'aa') {
    tracks(g, 6.2, 3.7, m, M, rbox);
    g.add(M(fin([[3.15,0.95],[2.4,1.7],[-2.9,1.7],[-3.15,1.2],[-3.0,0.95]], 3.5, 0.1), m.tan));
    const tur = new THREE.Group(); tur.position.set(0, 1.7, -0.2); g.add(tur); u.turret = tur;
    tur.add(M(vcyl(1.3, 1.4, 0.4, 18), m.dk, 0, 0.2, 0)); tur.add(M(rbox(2.5, 1.3, 2.3, 0.22), m.tan, 0, 1.0, 0));
    const guns = new THREE.Group(); guns.position.set(0, 1.1, 0.6); guns.rotation.x = -0.75; tur.add(guns);
    for (const s of [1, -1]) { guns.add(M(rbox(0.4, 0.5, 1.2, 0.08), m.dk, s*1.45, 0, 0.2)); for (const o of [-0.1, 0.12]) gunAt(guns, 'auto', 3.2, 0.06, m, s*1.45 + o, 0.05, 0.6); }
    const spin = new THREE.Group(); spin.position.set(0, 1.9, -0.8); tur.add(spin); u.spin = spin;
    spin.add(M(vcyl(0.08, 0.08, 0.7, 6), m.dk, 0, 0.3, 0));
    const dish = M(new THREE.SphereGeometry(0.9, 14, 8, 0, Math.PI*2, 0, Math.PI/3.2), m.white, 0, 0.9, 0.2); dish.rotation.x = -1.35; spin.add(dish);
    tur.add(M(rbox(2.52, 0.16, 0.4, 0.04), m.red, 0, 1.4, -0.9));
  } else if (type === 'sam') {
    g.add(M(rbox(2.5, 0.5, 8.4, 0.1), m.dk, 0, 1.1, 0));
    const cab = M(rbox(2.5, 1.8, 2.0, 0.3), m.tan, 0, 2.1, 3.1); g.add(cab);
    g.add(M(rbox(2.2, 0.7, 0.1, 0.05), m.glass, 0, 2.45, 4.12)); for (const s of [1, -1]) g.add(M(rbox(0.08, 0.6, 1.0, 0.03), m.glass, s*1.26, 2.45, 3.2));
    for (const s of [1, -1]) for (const z of [3.0, -1.2, -2.8]) { g.add(M(wheelGeo(0.62, 0.5), m.rub, s*1.25, 0.62, z)); g.add(M(wheelGeo(0.24, 0.52), m.steel, s*1.26, 0.62, z)); }
    g.add(M(rbox(2.4, 0.5, 4.6, 0.1), m.tan, 0, 1.5, -1.4));
    const tur = new THREE.Group(); tur.position.set(0, 1.75, -1.2); g.add(tur); u.turret = tur;
    tur.add(M(vcyl(0.9, 1.0, 0.4, 16), m.dk, 0, 0.2, 0));
    const l = new THREE.Group(); l.position.set(0, 0.7, -1.4); l.rotation.x = -0.6; tur.add(l); u.launcher = l;
    l.add(M(rbox(2.0, 0.3, 4.8, 0.08), m.dk, 0, -0.35, 2.2));
    for (const x of [-0.45, 0.45]) for (const y of [0.05, 0.85]) { l.add(M(cyl(0.38, 0.38, 5.0, 14), m.tanC, x, y, 2.4)); l.add(M(cyl(0.3, 0.3, 0.06, 14), m.red, x, y, 4.93)); }
  } else if (type === 'fighter') {
    // Varn jets. v0 line fighter (cropped delta), v1 interceptor (long nose, swept wing, tailplanes, conformal tanks), ace: dark, canards, red tails.
    // Faceted, chined fuselage; caret intakes; petal nozzles; layered missiles on pylons.
    const ace = !!o.ace, v = ace ? 2 : (o.v ?? Math.floor(Math.random()*2)), skin = ace ? m.aceC : m.airC, flat = ace ? m.aceC : m.air;
    const nl = v === 1 ? 1.2 : 0;   // interceptor's stretched nose
    g.add(M(facet([[-6.3,0.55],[-5.6,0.85],[-3.8,1.05],[-0.5,1.08],[1.8,0.95],[3.6+nl*0.5,0.64],[5.2+nl,0.32],[6.6+nl,0.03]], 0, 1.15, 0.72), skin));
    g.add(M(facet([[-5.2,0.2],[-3.5,0.5],[0.5,0.55],[2.2,0.3]], 0, 0.75, 0.62), flat, 0, 0.5, 0));                 // dorsal spine
    for (const s of [1, -1]) { const ch = M(plate([[0,4.2+nl],[s*0.5,1.6],[s*0.5,-0.5],[0,-0.8]], 0.06, 0.02), flat, s*0.98, -0.02, 0.6 + nl*0.3); g.add(ch); }   // nose chines
    g.add(M(facet([[5.0+nl*0.9,0.36],[5.25+nl*0.9,0.3]], 0, 1.15, 0.72), m.red));
    // canopy: faceted bubble with a frame bow and a sill
    { const cn = M(facet([[-1.5,0.04],[-1.0,0.34],[-0.2,0.44],[0.6,0.38],[1.2,0.22],[1.45,0.03]], 0, 1.0, 0.9), m.redGlass, 0, 0.5, 2.7 + nl*0.4); cn.rotation.x = 0.06; g.add(cn); }
    g.add(M(rbox(0.07, 0.34, 0.09, 0.02), m.dk, 0, 0.7, 2.45 + nl*0.4)); g.add(M(rbox(0.86, 0.08, 2.4, 0.03), m.dk, 0, 0.47, 2.5 + nl*0.4));
    // nose probe: collar, tapered boom, vanes
    { const nz = 6.6 + nl; g.add(M(cyl(0.07, 0.11, 0.35, 8), m.dk, 0, 0, nz + 0.12)); g.add(M(cyl(0.022, 0.045, 1.1, 6), m.steel, 0, 0, nz + 0.8));
      for (const a of [0, Math.PI/2]) { const vn = M(rbox(0.22, 0.02, 0.12, 0.005), m.dk, 0, 0, nz + 0.95); vn.rotation.z = a; g.add(vn); } }
    // gun port on the right cheek
    g.add(M(rbox(0.12, 0.28, 0.9, 0.04), m.rub, 0.86, 0.12, 3.8 + nl*0.3)); g.add(M(cyl(0.05, 0.05, 0.3, 6), m.dk, 0.88, 0.12, 4.3 + nl*0.3));
    // dorsal hump avionics / ace sensor
    g.add(M(rbox(0.5, 0.18, 0.8, 0.06), m.dk, 0, 0.98, -0.6)); if (ace) g.add(M(gem(0.22, 1, 0.7, 1.4), m.redGlass, 0, 0.93, 0.6));
    const missile = (len, r, x, y, z, big) => {   // seeker, body, mid strakes, tail fins, pylon
      const q = new THREE.Group(); q.position.set(x, y, z); g.add(q);
      q.add(M(cyl(r, r, len*0.78, 8), big ? m.khaki : m.white, 0, 0, 0));
      q.add(M(new THREE.ConeGeometry(r, len*0.16, 8).rotateX(Math.PI/2), m.red, 0, 0, len*0.47));
      q.add(M(cyl(r*1.02, r*1.02, len*0.05, 8), m.dk, 0, 0, len*0.36));
      q.add(M(cyl(r*0.6, r*0.9, len*0.06, 8), m.dk, 0, 0, -len*0.42));
      for (let i = 0; i < 4; i++) { const a = i*Math.PI/2 + Math.PI/4;
        const tf = M(rbox(r*2.6, 0.02, len*0.14, 0.005), m.dk, Math.cos(a)*r*1.2, Math.sin(a)*r*1.2, -len*0.32); tf.rotation.z = a; q.add(tf);
        const mf = M(rbox(r*1.4, 0.02, len*0.2, 0.005), m.dk, Math.cos(a)*r*0.8, Math.sin(a)*r*0.8, len*0.12); mf.rotation.z = a; q.add(mf); }
      q.add(M(rbox(0.06, 0.18, len*0.4, 0.02), m.dk, 0, r + 0.08, 0));   // pylon
      return q;
    };
    for (const s of [1, -1]) {
      // caret intake: angled box trunk with a raked lip and dark throat
      g.add(M(rbox(0.95, 0.95, 4.4, 0.14), flat, s*1.12, -0.25, 0.2));
      const lip = M(rbox(1.0, 0.1, 0.9, 0.03), flat, s*1.12, 0.26, 2.3); lip.rotation.x = 0.35; g.add(lip); g.add(M(rbox(1.0, 0.1, 0.5, 0.03), m.dk, s*1.12, -0.74, 2.2));   // raked lip + lower ramp
      g.add(M(rbox(0.72, 0.72, 0.1, 0.05), m.rub, s*1.12, -0.25, 2.38));
      g.add(M(rbox(0.08, 0.8, 0.5, 0.02), m.dk, s*0.66, -0.25, 2.2));   // boundary-layer splitter
      const wingPts = v === 1 ? [[0,1.2],[s*4.6,-3.4],[s*4.6,-4.4],[s*2.2,-3.6],[0,-3.2]] : [[0,2.2],[s*5.0,-2.6],[s*5.0,-3.6],[0,-3.6]];
      g.add(M(plate(wingPts, 0.18, 0.06), flat, s*0.8, -0.22, -0.8));
      g.add(M(plate(v === 1 ? [[0,-3.0],[s*3.6,-3.95],[s*3.6,-4.3],[0,-3.4]] : [[0,-3.2],[s*4.0,-3.25],[s*4.0,-3.55],[0,-3.55]], 0.2, 0.02), m.dk, s*0.8, -0.24, -0.8));   // flaperons
      g.add(M(plate([[0,3.4],[s*0.55,1.0],[0,0.6]], 0.12, 0.04), flat, s*0.85, -0.16, 0.6));                      // leading-edge extension
      const wx = s*(v === 1 ? 5.4 : 5.8);
      g.add(M(rbox(0.16, 0.2, 2.6, 0.04), m.dk, wx, -0.22, -3.4)); missile(1.9, 0.08, wx, -0.42, -3.2);           // wingtip rail + missile
      if (v === 1) { for (const k of [0.38, 0.62]) missile(2.6, 0.15, s*(0.8 + 4.6*k), -0.62, -1.9 - k, true);
        g.add(M(facet([[-4.6,0.05],[-4.2,0.36],[0.6,0.4],[1.4,0.05]], 0, 1.0, 0.7), skin, s*0.75, 0.62, 0));       // conformal tank
        g.add(M(plate([[0,0.6],[s*2.3,-1.0],[s*2.3,-1.6],[0,-1.2]], 0.12, 0.04), flat, s*0.9, -0.05, -5.0)); }
      else for (const k of [0.42, 0.68]) missile(1.9, 0.13, s*(0.8 + 4.6*k), -0.55, -1.6 - k);
      if (ace) g.add(M(plate([[0,0.6],[s*1.7,-0.5],[s*1.7,-0.9],[0,-0.7]], 0.1, 0.03), flat, s*0.75, 0.1, 3.3));
      const t = M(fin([[0.2,0],[-2.2,0],[-3.0,2.7],[-2.0,2.7]], 0.14, 0.04), flat, s*1.05, 0.4, -3.2); t.rotation.z = -s*(v === 1 ? 0.12 : 0.34); g.add(t);
      t.add(M(rbox(0.16, ace ? 1.3 : 0.5, 1.05, 0.05), m.red, 0, ace ? 2.05 : 2.45, -2.45));
      t.add(M(rbox(0.18, 1.2, 0.35, 0.02), m.dk, 0, 1.3, -2.75));    // rudder hinge
      if (v === 0) { const vf = M(fin([[0,0],[-1.6,0],[-2.0,-0.9],[-1.2,-0.9]], 0.1, 0.03), flat, s*1.0, -0.65, -3.6); vf.rotation.z = s*0.5; g.add(vf); }   // ventral fins
      // petal nozzle: shroud, petals, flame-holder ring, glow
      const nx = s*0.55, nzE = -6.3;
      g.add(M(facet([[nzE+0.5,0.56],[nzE,0.58],[nzE-0.15,0.6]], 0), m.dk, nx, 0, 0));
      g.add(M(new THREE.CylinderGeometry(0.5, 0.56, 0.95, 12, 1, true).rotateX(Math.PI/2), m.steel, nx, 0, nzE - 0.6));                                   // converging nozzle
      for (let i = 0; i < 12; i++) { const a = i*Math.PI/6; g.add(M(rbox(0.04, 0.03, 0.9, 0.005), m.dk, nx + Math.cos(a)*0.535, Math.sin(a)*0.535, nzE - 0.6)); }   // petal seams
      g.add(M(new THREE.TorusGeometry(0.5, 0.045, 6, 16), m.dk, nx, 0, nzE - 1.08));                                    // trailing ring
      g.add(M(new THREE.CylinderGeometry(0.44, 0.44, 0.9, 12, 1, true).rotateX(Math.PI/2), (m.liner || (m.liner = new THREE.MeshStandardMaterial({color:0x151515, side:THREE.BackSide}))), nx, 0, nzE - 0.62));   // dark liner
      g.add(M(cyl(0.22, 0.22, 0.06, 10), m.dk, nx, 0, nzE - 0.32));                                    // flame-holder hub
      const fl = M(new THREE.CircleGeometry(0.43, 16), m.glow, nx, 0, nzE - 0.2); fl.rotation.y = Math.PI; g.add(fl);
    }
    if (ace) g.scale.setScalar(1.1);
  } else if (type === 'mech') {
    // Varn walkers: a hunched, armoured hull on reverse-jointed legs. v0 trooper, v1 gunner (shoulder cannon), v2 heavy (missile pods).
    const v = o.v ?? Math.floor(Math.random()*3), heavy = v === 2, skin = heavy ? m.olive : m.tanC, plateM = heavy ? m.khaki : m.tan;
    const hull = new THREE.Group(); hull.position.y = 6.2; g.add(hull); u.hull = hull;
    hull.add(M(facet([[-2.4,0.5],[-2.0,1.3],[-0.9,1.9],[0.5,2.0],[1.6,1.6],[2.3,0.9],[2.6,0.3],[2.66,0]], 36, heavy ? 1.2 : 1.08, 0.76), skin));
    hull.add(M(facet([[-1.3,1.84],[-1.08,1.9]], 36, heavy ? 1.2 : 1.08, 0.76), m.red));
    hull.add(M(rbox(2.3, 0.4, 2.7, 0.18), plateM, 0, 1.3, -0.5));                                   // dorsal armour
    hull.add(M(rbox(1.2, 0.3, 1.2, 0.12), m.dk, 0, 1.6, -0.9));
    hull.add(M(rbox(2.1, 0.95, 1.3, 0.3), plateM, 0, 0.25, 2.05));                                  // sensor housing
    hull.add(M(rbox(1.6, 0.34, 0.3, 0.1), m.rub, 0, 0.32, 2.62));                                   // visor slot + single eye
    hull.add(M(new THREE.SphereGeometry(0.2, 18, 12), m.eye, 0.34, 0.32, 2.72));
    hull.add(M(rbox(2.3, 0.2, 0.9, 0.08), m.khaki, 0, 0.82, 2.2));                                  // brow plate
    hull.add(M(rbox(1.5, 0.45, 0.8, 0.18), m.dk, 0, -0.5, 2.0));                                    // chin
    for (const s of [1, -1]) gunAt(hull, 'auto', 1.5, 0.07, m, s*0.5, -0.62, 2.0);
    hull.add(M(rbox(2.3, 1.3, 1.1, 0.3), m.khaki, 0, 0.25, -2.25));                                 // engine pack
    for (const s of [1, -1]) { const nz = M(facet([[-0.7,0.34],[-0.4,0.42],[0,0.4]], 16), m.steel, s*0.6, 0.2, -2.8); nz.rotation.x = 0.5; hull.add(nz); hull.add(M(rbox(0.7, 0.12, 0.1, 0.03), m.rub, s*0.6, 0.72, -2.82)); }
    hull.add(M(vcyl(0.03, 0.03, 2.0, 4), m.dk, 0.9, 2.4, -1.5));
    hull.add(M(vcyl(0.85, 1.0, 0.9, 8), m.dk, 0, -1.35, -0.1));                                    // waist ring
    for (const s of [-1, 1]) {
      const sx = s*(heavy ? 2.65 : 2.4);
      const sh = M(gem(0.85, 0.95, 0.95, 1.2), plateM, sx, 0.5, 0); hull.add(sh);
      hull.add(M(facet([[-0.6,0],[-0.5,0.5],[0.3,0.64],[1.6,0.6],[2.3,0.46],[2.36,0]], 20), plateM, sx + s*0.1, -0.35, 0.5));   // forearm housing
      gunAt(hull, 'rotary', 2.5, 0.24, m, sx + s*0.1, -0.35, 2.3);
      if (heavy) { hull.add(M(rbox(1.3, 1.0, 1.9, 0.2), m.khaki, sx, 1.75, -0.2)); for (const a of [-0.3, 0.3]) for (const b of [-0.22, 0.22]) hull.add(M(cyl(0.17, 0.17, 0.1, 10), m.red, sx + a, 1.75 + b, 0.76)); }
    }
    for (const s of [-1, 1]) {   // angled pauldrons, chest plates, flank vents
      const sx = s*(heavy ? 2.65 : 2.4);
      const pl = M(rbox(1.9, 0.26, 2.3, 0.05), m.khaki, sx + s*0.1, 1.35, 0.05); pl.rotation.z = -s*0.42; hull.add(pl);
      const pl2 = M(rbox(1.5, 0.18, 1.6, 0.04), plateM, sx + s*0.55, 0.85, 0.15); pl2.rotation.z = -s*0.95; hull.add(pl2);
      const cp = M(rbox(1.05, 1.1, 0.22, 0.05), plateM, s*0.62, 0.95, 1.55); cp.rotation.set(-0.55, s*0.32, 0); hull.add(cp);
      for (let i = 0; i < 4; i++) hull.add(M(rbox(0.08, 0.5, 0.12, 0.02), m.rub, s*1.86, 0.2, -1.2 + i*0.3));
      hull.add(M(rbox(0.12, 0.7, 1.5, 0.03), m.red, s*1.84, -0.35, 0.9));
    }
    if (v === 1) { hull.add(M(rbox(0.9, 0.8, 1.6, 0.2), m.khaki, -1.5, 1.9, -0.6)); gunAt(hull, 'cannon', 5.4, 0.16, m, -1.5, 1.95, 0.1); hull.add(M(rbox(0.8, 0.6, 0.9, 0.15), m.dk, 1.4, 1.75, -0.6)); }
    g.add(M(rbox(3.3, 0.9, 1.4, 0.32), m.dk, 0, 5.2, 0));                                           // pelvis
    u.legs = [];
    for (const x of [-1.4, 1.4]) {
      const L = new THREE.Group(); L.position.set(x, 5.2, 0); g.add(L); u.legs.push(L);
      L.add(M(gem(0.62), m.steel));
      const th = M(facet([[-0.1,0],[0,0.5],[0.6,0.74],[1.5,0.7],[2.3,0.52],[2.7,0.44],[2.75,0]], 20, 1, 0.9), plateM); th.rotation.x = 1.19; L.add(th);
      L.add(M(gem(0.52), m.dk, 0, -2.5, 1.0));
      const kg = M(rbox(0.95, 0.8, 0.5, 0.2), m.khaki, 0, -2.45, 1.5); kg.rotation.x = -0.2; L.add(kg);
      const sh = M(facet([[-0.05,0],[0,0.44],[0.5,0.74],[1.3,0.7],[2.0,0.5],[2.4,0.4],[2.45,0]], 20, 1, 0.9), plateM, 0, -2.5, 1.0); sh.rotation.x = 1.96; L.add(sh);
      const sg = M(rbox(0.9, 1.7, 0.36, 0.14), m.khaki, 0, -3.55, 1.05); sg.rotation.x = -0.39; L.add(sg);
      L.add(M(gem(0.42), m.steel, 0, -4.7, 0.1));
      spadeFoot(L, -4.7, -5.23, 1.0, plateM, m);
    }
  } else if (type === 'colossus') {
    // The Sovereign: the fortress guardian. A spider-built super-heavy: an armoured abdomen slung between four splayed legs,
    // an upright torso carrying four weapon arms, and a low spider head with eight eyes over heavy mandible plates.
    // Built at walker scale, then scaled about 2x (about 34 m tall). u.glow is the core/eye light, u.beamM the beam capacitor glow.
    const plateM = m.tan, heavyM = m.khaki, skin = m.tanC, Zv = new V3(0, 0, 1);
    const glow = new THREE.MeshStandardMaterial({color:0x3a0a06, emissive:0xff3a1a, emissiveIntensity:1.2, roughness:0.4}); u.glow = glow;
    const beamM = new THREE.MeshStandardMaterial({color:0x2a0805, emissive:0xff5a20, emissiveIntensity:0.3, roughness:0.4}); u.beamM = beamM;
    // armoured beam between two points (parent-local)
    const seg = (P, a, b, w, h, mat, rad = 0.2) => { const d = b.clone().sub(a), o = M(rbox(w, h, d.length(), rad), mat); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(Zv, d.normalize()); P.add(o); return o; };
    const hull = new THREE.Group(); hull.position.y = 7.4; g.add(hull); u.hull = hull;   // everything above the legs (hull-local y = world y - 7.4)
    // abdomen: long faceted carapace behind, ridged plates and the reactor vents on top
    hull.add(M(facet([[-7.5, 0.4], [-6.6, 2.0], [-4.6, 3.0], [-1.8, 3.1], [0.6, 2.5], [1.6, 1.6], [1.9, 0]], 0, 1.35, 0.72), skin, 0, 1.6, -2.4));
    for (let i = 0; i < 4; i++) { const pl = M(rbox(5.6 - i*0.7, 0.35, 1.5, 0.1), i % 2 ? m.red : heavyM, 0, 3.75 - i*0.18, -1.6 - i*1.55); pl.rotation.x = -0.12 - i*0.05; hull.add(pl); }
    for (const s of [1, -1]) { hull.add(M(vcyl(0.45, 0.6, 2.6, 8), m.dk, s*1.7, 4.0, -5.0)); hull.add(M(vcyl(0.36, 0.36, 0.2, 8), glow, s*1.7, 5.32, -5.0));
      for (let i = 0; i < 5; i++) hull.add(M(rbox(0.1, 0.8, 0.5, 0.02), m.rub, s*3.95, 1.6, -5.2 + i*0.8)); }
    // back missile rack
    const rack = new THREE.Group(); rack.position.set(0, 4.6, -2.6); hull.add(rack); rack.add(M(rbox(2.6, 1.2, 2.0, 0.2), heavyM));
    for (let a = 0; a < 4; a++) for (let b2 = 0; b2 < 2; b2++) { rack.add(M(cyl(0.17, 0.17, 0.1, 10), m.rub, -0.9 + a*0.6, -0.25 + b2*0.55, 1.01)); rack.add(M(cyl(0.09, 0.09, 0.12, 8), m.red, -0.9 + a*0.6, -0.25 + b2*0.55, 1.03)); }
    rack.rotation.x = -0.35;
    // upright torso at the front with the reactor core
    hull.add(M(rbox(5.4, 2.4, 3.2, 0.45), skin, 0, 3.0, 2.6));                                      // lower torso
    hull.add(M(rbox(6.6, 2.4, 3.4, 0.5), skin, 0, 5.3, 2.8));                                       // chest
    hull.add(M(rbox(7.0, 0.45, 3.8, 0.15), heavyM, 0, 6.6, 2.7));                                    // collar
    for (const s of [1, -1]) { const cp = M(rbox(2.9, 2.2, 0.38, 0.08), plateM, s*1.5, 5.2, 4.55); cp.rotation.set(-0.1, s*0.4, s*0.1); hull.add(cp); }
    hull.add(M(vcyl(0.95, 0.95, 0.5, 10).rotateX(Math.PI/2), m.dk, 0, 4.4, 4.45)); hull.add(M(gem(0.68, 1, 1, 0.7), glow, 0, 4.4, 4.7));
    // spider head: low faceted dome, eight eyes in rows, mandible plates beneath, a short swept crest
    const head = new THREE.Group(); head.position.set(0, 7.5, 5.0); head.scale.setScalar(1.3); hull.add(head); u.head = head;
    hull.add(M(rbox(2.4, 1.2, 1.6, 0.3), m.dk, 0, 6.9, 4.0));                                        // neck
    head.add(M(gem(1.5, 1.25, 0.72, 1.15), plateM));
    head.add(M(rbox(2.6, 0.5, 1.4, 0.2), m.dk, 0, -0.55, 0.6));                                      // under-jaw
    const eyeM = glow;
    for (const [x, y, z, r] of [[0.42, 0.05, 1.62, 0.34], [-0.42, 0.05, 1.62, 0.34], [0.95, 0.28, 1.3, 0.24], [-0.95, 0.28, 1.3, 0.24],
                                 [1.32, -0.05, 0.95, 0.17], [-1.32, -0.05, 0.95, 0.17], [0.3, 0.62, 1.3, 0.15], [-0.3, 0.62, 1.3, 0.15]]) {
      head.add(M(new THREE.SphereGeometry(r*1.35, 12, 8), m.dk, x, y, z - 0.08)); head.add(M(new THREE.SphereGeometry(r, 14, 10), eyeM, x, y, z)); }
    for (const s of [1, -1]) { const md = M(fin([[0.5, 0], [-0.3, 0], [-0.1, -1.6], [0.35, -1.3]], 0.22, 0.06), heavyM, s*0.55, -0.6, 1.5); md.rotation.y = -Math.PI/2; md.rotation.z = s*0.18; head.add(md);
      head.add(M(rbox(0.16, 0.5, 0.16, 0.04), m.steel, s*0.55, -1.8, 1.45)); }                     // mandibles with steel tips
    // four weapon arms: upper pair from the shoulders, lower pair from the waist
    u.fores = [];
    const arm = (sx, sy, sz, kind) => {
      const s = Math.sign(sx), A = new THREE.Group(); A.position.set(sx, sy, sz); hull.add(A);
      A.add(M(gem(kind.upper ? 1.15 : 0.9), m.steel));
      if (kind.upper) for (let k = 0; k < 2; k++) { const pd = M(rbox(2.4 - k*0.4, 0.38, 2.8 - k*0.3, 0.08), k ? m.red : plateM, s*0.4, 0.95 + k*0.4, -0.1); pd.rotation.z = -s*0.4; A.add(pd); }
      const elbow = new V3(s*1.2, kind.upper ? -2.6 : -2.0, 0.6);
      seg(A, new V3(0, 0, 0), elbow, kind.upper ? 1.5 : 1.2, kind.upper ? 1.5 : 1.2, plateM, 0.3);
      A.add(M(gem(kind.upper ? 0.75 : 0.6), m.dk, elbow.x, elbow.y, elbow.z));
      const F = new THREE.Group(); F.position.copy(elbow); A.add(F); u.fores.push(F);
      kind.build(F);
      return A;
    };
    arm(4.2, 5.4, 2.8, {upper:true, build:F => {        // upper left: beam cannon
      F.add(M(facet([[-0.5, 0.85], [0, 1.1], [2.2, 1.1], [2.8, 0.85], [2.9, 0]], 0, 1, 1), heavyM));
      for (let k = 0; k < 4; k++) F.add(M(cyl(0.92, 0.92, 0.22, 12), beamM, 0, 0, 3.1 + k*0.6));
      F.add(M(cyl(0.55, 0.7, 2.6, 12), m.dk, 0, 0, 4.0)); gunAt(F, 'cannon', 4.4, 0.4, m, 0, 0, 4.4);
      u.muzzle = new THREE.Object3D(); u.muzzle.position.set(0, 0, 9.0); F.add(u.muzzle); }});
    arm(-4.2, 5.4, 2.8, {upper:true, build:F => {       // upper right: missile launcher arm
      F.add(M(facet([[-0.5, 0.8], [0, 1.0], [1.8, 1.0], [2.2, 0.7], [2.3, 0]], 0, 1, 1), plateM));
      const pod = new THREE.Group(); pod.position.set(0, 0.2, 3.0); F.add(pod); pod.add(M(rbox(2.0, 1.8, 2.2, 0.25), heavyM));
      for (let a = 0; a < 3; a++) for (let b2 = 0; b2 < 3; b2++) { pod.add(M(cyl(0.2, 0.2, 0.1, 10), m.rub, -0.6 + a*0.6, -0.55 + b2*0.55, 1.11)); pod.add(M(cyl(0.1, 0.1, 0.12, 8), m.red, -0.6 + a*0.6, -0.55 + b2*0.55, 1.13)); }
      u.pods = [pod, rack]; }});
    arm(3.3, 3.0, 3.4, {upper:false, build:F => {       // lower left: rotary gun
      F.add(M(facet([[-0.4, 0.7], [0, 0.85], [1.8, 0.85], [2.2, 0.6], [2.3, 0]], 0, 1, 1), plateM));
      gunAt(F, 'rotary', 3.4, 0.38, m, 0, 0, 1.6);
      u.gun = new THREE.Object3D(); u.gun.position.set(0, 0, 5.0); F.add(u.gun); }});
    arm(-3.3, 3.0, 3.4, {upper:false, build:F => {      // lower right: twin autocannon
      F.add(M(facet([[-0.4, 0.7], [0, 0.85], [1.8, 0.85], [2.2, 0.6], [2.3, 0]], 0, 1, 1), plateM));
      for (const dx of [-0.32, 0.32]) gunAt(F, 'auto', 3.6, 0.17, m, dx, 0.1, 1.5);
      u.gun2 = new THREE.Object3D(); u.gun2.position.set(0, 0.1, 5.1); F.add(u.gun2); }});
    // four splayed spider legs: hip at the body's corners, knee high and outboard, armoured pad on the ground
    u.legs = [];
    for (const [hx, hz, yaw] of [[2.6, -0.2, 1.2], [-2.6, -0.2, -1.2], [2.6, -3.8, 2.2], [-2.6, -3.8, -2.2]]) {   // front legs swing out sideways, clear of the arms
      const L = new THREE.Group(); L.position.set(hx, 8.4, hz); L.rotation.order = 'YXZ'; L.rotation.y = yaw; L.userData.yaw0 = yaw; g.add(L); u.legs.push(L);   // leg-local: +z points outward along the leg
      const knee = new V3(0, 5.0, 5.2), foot = new V3(0, -8.4, 9.6);
      L.add(M(gem(1.0), m.steel));
      seg(L, new V3(0, 0, 0), knee, 1.4, 1.6, plateM, 0.35);
      seg(L, new V3(0, 0.9, 0.3), knee.clone().add(new V3(0, 0.9, -0.2)), 0.9, 0.4, heavyM, 0.1);      // dorsal leg plate
      L.add(M(gem(0.85), m.dk, knee.x, knee.y, knee.z));
      { const kp = M(rbox(1.5, 1.4, 0.9, 0.25), heavyM, knee.x, knee.y + 0.6, knee.z + 0.3); kp.rotation.x = -0.4; L.add(kp); }   // knee cap
      seg(L, knee, foot.clone().add(new V3(0, 1.0, 0)), 1.25, 1.4, plateM, 0.3);
      seg(L, knee.clone().add(new V3(0, -0.6, 0.6)), foot.clone().add(new V3(0, 1.6, 0.6)), 0.6, 0.5, heavyM, 0.1);   // shin guard
      L.add(strut(new V3(0, -0.4, 0.6), knee.clone().add(new V3(0, -1.2, -0.6)), 0.12, m.steel));                 // piston
      const FG = new THREE.Group(); FG.position.copy(foot); L.add(FG);
      FG.add(M(gem(0.6), m.steel, 0, 1.0, 0)); spadeFoot(FG, 1.0, 0, 1.2, plateM, m);
    }
    g.add(M(rbox(5.6, 1.6, 6.0, 0.4), m.dk, 0, 8.4, -1.0));                                          // leg girdle
    g.scale.setScalar(2.05);
  } else if (type === 'skycarrier') {
    // The Ascendant: a Varn flying carrier, about 230 m long and 250 m across the wings (real metres, no scaling).
    // A dark blade-shaped hull with a straight flight deck, no single wing: six separate armoured fan pods on open truss booms (the fans attach later
    // as the four engine entities), canted wingtip fins, an underslung command gondola under the bow, stern thrust nozzles,
    // and the reactor slung under the belly behind armoured petals that open once its engines are gone.
    const hullM = new THREE.MeshStandardMaterial({color:0x6b7178, metalness:0.55, roughness:0.42, map:m.airC.map, bumpMap:m.air.bumpMap, bumpScale:0.015}),
      plateM = new THREE.MeshStandardMaterial({color:0x5a6067, metalness:0.5, roughness:0.48, map:m.air.map, bumpMap:m.air.bumpMap, bumpScale:0.015}), deckM = m.dk;
    const glow = new THREE.MeshStandardMaterial({color:0x2a0805, emissive:0xff4a1a, emissiveIntensity:1.0, roughness:0.4}); u.glow = glow;
    const win = new THREE.MeshStandardMaterial({color:0x101010, emissive:0xffb070, emissiveIntensity:0.9, roughness:0.3});
    g.add(M(facet([[-110, 9], [-100, 18], [-60, 21], [40, 20], [78, 15], [104, 6], [118, 0]], 0, 1.4, 0.62), hullM));
    g.add(M(facet([[-96, 3], [-88, 9], [30, 10], [70, 5], [84, 0]], 0, 1.1, 0.6), plateM, 0, -9, 0));               // ventral keel
    g.add(M(rbox(40, 2.0, 200, 1.0), deckM, 0, 13.4, -6));                                                          // flight deck
    for (let i = 0; i < 9; i++) g.add(M(rbox(1.0, 0.3, 10, 0.1), m.white, 0, 14.5, -84 + i*20));
    for (const sx of [-19, 19]) g.add(M(rbox(0.8, 0.3, 196, 0.1), m.red, sx, 14.5, -6));
    // no single wing: each side carries three separate armoured fan pods on open truss booms, with sky showing between hull, booms and pods
    const beam = (x0, z0, x1, z1, y, w, h, mat) => { const L = Math.hypot(x1 - x0, z1 - z0), bm = M(rbox(w, h, L, Math.min(w, h)*0.25), mat, (x0 + x1)/2, y, (z0 + z1)/2); bm.rotation.y = Math.atan2(x1 - x0, z1 - z0); g.add(bm); return bm; };
    const pod = (x, z, s) => {
      g.add(M(new THREE.CylinderGeometry(25, 25, 8, 8, 1, true).rotateY(Math.PI/8), hullM, x, 0.5, z));                 // octagonal outer wall
      g.add(M(new THREE.CylinderGeometry(19, 19, 8, 28, 1, true), deckM, x, 0.5, z));                                  // duct wall
      for (const y of [4.5, -3.5]) g.add(M(new THREE.RingGeometry(19, 25, 8, 1).rotateX(-Math.PI/2).rotateY(Math.PI/8), plateM, x, y, z));   // rims
      g.add(M(new THREE.TorusGeometry(19.2, 1.0, 6, 32).rotateX(Math.PI/2), m.red, x, 4.8, z));
      for (let k = 0; k < 8; k += 2) { const a = Math.PI/8 + k*Math.PI/4, ar = M(rbox(14, 9, 2.4, 0.6), plateM, x + Math.sin(a)*25.6, 0.5, z + Math.cos(a)*25.6); ar.rotation.y = a; g.add(ar); }   // armour bands
      g.add(M(rbox(2.4, 1.2, 1.2, 0.2), m.lamp, x + s*25.8, 3, z));                                                    // nav light
    };
    for (const s of [1, -1]) {
      pod(s*60, 48, s); pod(s*76, -10, s); pod(s*62, -68, s);
      g.add(M(plate([[0, 40], [s*12, 26], [s*12, -70], [0, -84]], 4, 1.0), plateM, s*20, -2, 0));                  // hull sponson strake
      beam(s*28, 56, s*38, 56, 0.5, 4.5, 4, hullM); beam(s*28, 40, s*38, 40, 0.5, 4.5, 4, hullM);                          // forward pod: twin booms
      beam(s*30, -2, s*54, -2, 0.5, 5, 4, hullM); beam(s*30, -18, s*54, -18, 0.5, 5, 4, hullM);                         // middle pod: twin booms
      beam(s*28, -60, s*40, -60, 0.5, 4.5, 4, hullM); beam(s*28, -76, s*40, -76, 0.5, 4.5, 4, hullM);                   // aft pod: twin booms
      beam(s*66, 24, s*70, 14, 0.5, 3, 3, m.dk); beam(s*70, -34, s*67, -44, 0.5, 3, 3, m.dk);                           // braces between pods
      beam(s*31, -2, s*45, -18, 0.5, 1.2, 1.2, m.dk);                   // truss lacing
      const tip = M(fin([[0, 0], [-18, 0], [-24, 12], [-12, 12]], 1.6, 0.4), hullM, s*102, 2, -2); tip.rotation.y = -Math.PI/2; tip.rotation.z = -s*0.35; g.add(tip);   // canted fin on the outer pod
      const can = M(plate([[0, 12], [s*20, -2], [s*22, -12], [0, -8]], 3, 0.8), plateM, s*20, 6, 82); g.add(can);        // small separate canard by the bow
    }
    // island: low, raked superstructure with a lit window band
    g.add(M(rbox(9, 12, 34, 1.5), plateM, 14, 20, -30)); { const r = M(rbox(8, 6, 18, 1.2), plateM, 14, 28, -34); r.rotation.x = -0.12; g.add(r); }
    g.add(M(rbox(9.2, 1.0, 30, 0.1), win, 14, 23, -30)); g.add(M(vcyl(0.4, 0.6, 12, 6), m.dk, 14, 36, -36)); g.add(M(gem(1.0), m.eye, 14, 42, -36));
    // command gondola under the bow, with a window strip
    g.add(M(facet([[-20, 2], [-14, 9], [16, 10], [28, 6], [34, 0]], 0, 1.4, 0.8), hullM, 0, -14, 58));
    g.add(M(rbox(24, 1.2, 22, 0.2), win, 0, -12, 72));
    // bow hangar mouth with red guide lights
    g.add(M(rbox(24, 8, 4, 0.5), m.rub, 0, 3, 104)); for (const x of [-9, -3, 3, 9]) g.add(M(rbox(1.4, 1.4, 0.6, 0.2), m.lamp, x, 7.5, 106));
    u.bay = new THREE.Object3D(); u.bay.position.set(0, 3, 114); g.add(u.bay);
    // stern thrust nozzles
    for (const s of [1, -1]) { g.add(M(cyl(8, 9.5, 12, 14), m.dk, s*14, -1, -110)); for (let k = 0; k < 3; k++) g.add(M(cyl(7 - k*1.6, 7 - k*1.6, 0.5, 14), glow, s*14, -1, -116.3 - k*0.2)); }
    // reactor under the belly: glowing core inside a ring, six armoured petals that swing open when exposed
    const R = new THREE.Group(); R.position.set(0, -17, -20); g.add(R); u.reactor = R;
    R.add(M(vcyl(13, 13, 3, 16), m.dk)); R.add(M(new THREE.SphereGeometry(8, 20, 14), glow, 0, -3, 0));
    u.petals = [];
    for (let i = 0; i < 6; i++) { const pv = new THREE.Group(); pv.rotation.y = i*Math.PI/3; R.add(pv); const ph = new THREE.Group(); ph.position.set(0, -1.5, 9); pv.add(ph);
      ph.add(M(rbox(9, 1.6, 10, 0.4), plateM, 0, 0, -5)); u.petals.push(ph); }
    // hardpoints (carrier-local): turrets on the deck edges and wing roots, missile cells on the deck, lift fans in the wings
    u.mounts = {
      flak:[[-19, 15, 80], [19, 15, 56], [-19, 15, -44], [19, 15, -86], [-76, 5, 64], [76, 5, 64], [-78, 5, -84], [78, 5, -84]],
      mis:[[0, 15, 90], [0, 15, -70]],
      eng:[[-60, 0.5, 48], [60, 0.5, 48], [-76, 0.5, -10], [76, 0.5, -10], [-62, 0.5, -68], [62, 0.5, -68]]};
  } else if (type === 'skyflak') {
    // twin-barrel flak turret on a ring mount; u.head turns, u.muzzle is the gun tip
    g.add(M(vcyl(3.6, 4.2, 2.2, 12), m.dk)); const H = new THREE.Group(); H.position.y = 2.0; g.add(H); u.head = H;
    H.add(M(gem(2.8, 1.2, 0.7, 1.2), m.air)); H.add(M(rbox(3.6, 1.6, 2.6, 0.4), m.khaki, 0, 0.4, 1.8));
    for (const x of [-0.9, 0.9]) gunAt(H, 'auto', 6, 0.26, m, x, 0.5, 1.6);
    u.muzzle = new THREE.Object3D(); u.muzzle.position.set(0, 0.5, 8); H.add(u.muzzle);
  } else if (type === 'skymis') {
    // missile battery: an armoured box of twelve cells that tilts up to fire
    g.add(M(rbox(9, 2, 9, 0.6), m.dk)); const H = new THREE.Group(); H.position.y = 2.5; g.add(H); u.head = H;
    H.add(M(rbox(8, 4.5, 7, 0.6), m.khaki));
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) { H.add(M(cyl(0.7, 0.7, 0.3, 10), m.rub, -2.7 + a*1.8, -1.2 + b*1.5, 3.55)); H.add(M(cyl(0.35, 0.35, 0.32, 8), m.red, -2.7 + a*1.8, -1.2 + b*1.5, 3.6)); }
    H.rotation.x = -0.5;
  } else if (type === 'skyengine') {
    // lift fan set into the wing: a horizontal ducted rotor (u.fan spins about the vertical), stator ring, hub, glowing downwash
    const glow = new THREE.MeshStandardMaterial({color:0x2a0805, emissive:0xff6a2a, emissiveIntensity:1.4, roughness:0.4, side:THREE.DoubleSide}); u.glow = glow;
    g.add(M(new THREE.CylinderGeometry(18.4, 18.4, 3, 28, 1, true), m.steel, 0, 1, 0));
    for (let i = 0; i < 6; i++) { const st = M(rbox(36, 0.8, 1.2, 0.2), m.dk, 0, -2, 0); st.rotation.y = i*Math.PI/6; g.add(st); }   // stator spokes below the rotor
    const fan = new THREE.Group(); fan.position.y = 0.5; g.add(fan); u.fan = fan;
    for (let i = 0; i < 9; i++) { const pv = new THREE.Group(); pv.rotation.y = i*Math.PI*2/9; fan.add(pv); const bl = M(rbox(2.6, 0.4, 16, 0.1), m.steel, 0, 0, 9); bl.rotation.z = 0.45; pv.add(bl); }
    fan.add(M(vcyl(4, 4.5, 2.4, 14), m.dk)); fan.add(M(vcyl(2, 2, 2.6, 10), m.red));
    g.add(M(new THREE.CircleGeometry(17, 28).rotateX(Math.PI/2), glow, 0, -3.6, 0));                                  // downwash glow
  } else if (type === 'reaver') {
    // Varn Reaver: a lean melee walker. Hunched sprinter's hull, a slit visor, and a long blade on each forearm.
    const blade = m.blade || (m.blade = new THREE.MeshStandardMaterial({color:0xb9bec0, roughness:0.25, metalness:0.9})), edge = new THREE.MeshBasicMaterial({color:0xff4a30});
    const hull = new THREE.Group(); hull.position.y = 6.0; g.add(hull); u.hull = hull;
    hull.add(M(facet([[-2.0,0.4],[-1.6,1.1],[-0.6,1.6],[0.6,1.65],[1.6,1.25],[2.2,0.6],[2.3,0]], 32, 0.95, 0.85), m.tanC));
    hull.add(M(rbox(1.8, 0.55, 2.4, 0.2), m.khaki, 0, 1.25, -0.2));
    for (const s of [1, -1]) { const sp = M(new THREE.ConeGeometry(0.22, 1.4, 8), m.dk, s*0.55, 1.75, -0.6 - Math.abs(s)*0.3); sp.rotation.x = -0.5; hull.add(sp); }
    hull.add(M(rbox(1.7, 0.9, 1.2, 0.3), m.tan, 0, 0.35, 1.9));
    hull.add(M(rbox(1.5, 0.16, 0.24, 0.05), m.rub, 0, 0.42, 2.52)); u.visor = M(rbox(1.2, 0.08, 0.1, 0.02), m.eye, 0, 0.42, 2.66); hull.add(u.visor);
    hull.add(M(vcyl(0.7, 0.85, 0.8, 8), m.dk, 0, -1.1, 0));
    { const br = M(rbox(1.95, 0.2, 1.0, 0.04), m.khaki, 0, 0.88, 2.0); br.rotation.x = 0.28; hull.add(br); }   // hooded brow over the visor
    for (const s of [-1, 1]) { const fl = M(rbox(0.2, 1.1, 2.6, 0.04), m.khaki, s*1.05, 0.2, 0.2); fl.rotation.z = s*0.35; hull.add(fl);
      for (let i = 0; i < 3; i++) hull.add(M(rbox(0.07, 0.4, 0.1, 0.02), m.rub, s*1.25, 0.25, -0.4 + i*0.28)); }
    u.arms = [];
    for (const s of [-1, 1]) {
      const A = new THREE.Group(); A.position.set(s*1.95, 0.6, 0.2); hull.add(A); u.arms.push(A);
      const sh = M(gem(0.75, 0.95, 1, 1.15), m.khaki); A.add(sh);
      A.add(M(facet([[-0.3,0],[-0.2,0.45],[0.6,0.55],[1.8,0.48],[2.3,0.4],[2.36,0]], 18), m.tan, s*0.15, -0.3, 0.6));
      A.add(M(fin([[0,0.32],[4.6,0.18],[5.6,0],[4.6,-0.1],[0,-0.14]], 0.12, 0.03), blade, s*0.15, -0.3, 2.6));
      A.add(M(fin([[0,0.04],[4.6,0.04],[5.65,-0.02],[4.6,-0.01],[0,-0.01]], 0.05, 0.01), edge, s*0.15, -0.02, 2.6));
    }
    g.add(M(rbox(2.8, 0.8, 1.2, 0.3), m.dk, 0, 5.0, 0));
    u.legs = [];
    for (const x of [-1.2, 1.2]) {
      const L = new THREE.Group(); L.position.set(x, 5.0, 0); g.add(L); u.legs.push(L);
      L.add(M(gem(0.52), m.steel));
      const th = M(facet([[-0.1,0],[0,0.42],[0.6,0.62],[2.3,0.4],[2.6,0]], 18, 1, 0.9), m.tan); th.rotation.x = 1.15; L.add(th);
      L.add(M(gem(0.44), m.dk, 0, -2.4, 1.0));
      const sh2 = M(facet([[-0.05,0],[0,0.4],[0.5,0.62],[2.0,0.42],[2.4,0]], 18, 1, 0.9), m.tan, 0, -2.4, 1.0); sh2.rotation.x = 1.96; L.add(sh2);
      spadeFoot(L, -4.55, -5.05, 0.85, m.tan, m);
    }
    g.scale.setScalar(1.35);   // stands a head taller than the player's Battlebot
  } else if (type === 'bunker') {
    g.add(M(fin([[7,0],[5.4,4.2],[-5.6,4.2],[-7,0]], 16, 0.3), m.conc));
    const slit = M(rbox(9, 0.55, 0.3, 0.05), m.dk, 0, 2.6, 6.05); slit.rotation.x = -0.36; g.add(slit);
    g.add(M(rbox(16.6, 0.5, 11.6, 0.15), m.concD, 0, 4.35, 0));
    { const sb = G.sandbags(0, 0, 8.6); if (sb) { sb.scale.set(1.6, 1, 1); g.add(sb); } else for (let row = 0; row < 2; row++) for (let i = -8; i <= 8; i++) g.add(M(rbox(0.95, 0.42, 0.55, 0.15), m.sand, i*0.98 + (row ? 0.45 : 0), 0.22 + row*0.42, 8.3)); }
    g.add(M(rbox(2.2, 2.6, 0.3, 0.05), m.dk, 0, 1.3, -7.05));
    g.add(M(vcyl(0.04, 0.04, 4, 4), m.dk, 5, 6.5, -3));
  } else if (type === 'hangar') {
    const shell = new THREE.CylinderGeometry(13, 13, 30, 24, 1, true, 0, Math.PI); shell.rotateZ(Math.PI/2); shell.rotateY(Math.PI/2);
    const sm = new THREE.Mesh(shell, new THREE.MeshStandardMaterial({color:0x545c5a, roughness:0.65, metalness:0.55, side:THREE.DoubleSide})); sm.castShadow = sm.receiveShadow = true; g.add(sm);
    for (let z = -14; z <= 14; z += 4.6) { const r = M(new THREE.TorusGeometry(13.08, 0.16, 5, 24, Math.PI), m.dk, 0, 0, z); g.add(r); }
    const back = M(new THREE.CircleGeometry(13, 24, 0, Math.PI), m.concD, 0, 0, -15); back.rotation.y = Math.PI; g.add(back);
    const front = new THREE.Shape(); front.absarc(0, 0, 13, 0, Math.PI, false); front.lineTo(-13, 0);
    const door = new THREE.Path(); door.moveTo(-8, 0); door.lineTo(8, 0); door.lineTo(8, 9); door.lineTo(-8, 9); door.closePath(); front.holes.push(door);
    g.add(M(new THREE.ShapeGeometry(front, 20), m.concD, 0, 0, 15));
    g.add(M(rbox(9, 9, 0.3, 0.05), m.roof, -6, 4.5, 15.3));
    g.add(M(rbox(17, 0.6, 0.6, 0.1), m.red, 0, 9.3, 15.1));
    g.add(M(rbox(16, 0.05, 10, 0.02), m.dk, 0, 0.03, 20));
  } else if (type === 'tower') {
    const top = 27, base = 3.2, tw = 1.1, legs = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    const P = (i, y) => { const k = base + (tw - base)*(y/top); return new V3(legs[i][0]*k, y, legs[i][1]*k); };
    for (let i = 0; i < 4; i++) g.add(strut(P(i, 0), P(i, top), 0.16, m.steel));
    for (let y = 0; y < top; y += 4.5) for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; g.add(strut(P(i, y), P(j, y + 4.5), 0.06, m.steel)); g.add(strut(P(j, y), P(i, y + 4.5), 0.06, m.steel)); }
    g.add(M(rbox(3.6, 0.3, 3.6, 0.05), m.dk, 0, top, 0)); g.add(M(rbox(2.4, 2.2, 2.4, 0.15), m.tan, 0, top + 1.25, 0));
    const dish = M(new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI*2, 0, Math.PI/3.2), new THREE.MeshStandardMaterial({color:0xaeada6, roughness:0.7, side:THREE.DoubleSide}), 1.2, top + 2.0, 1.6);
    dish.rotation.x = -1.2; g.add(dish);
    for (let i = 0; i < 6; i++) g.add(M(vcyl(0.12, 0.12, 1.2, 6), i % 2 ? m.white : m.red, 0, top + 2.95 + i*1.2, 0));
    g.add(M(new THREE.SphereGeometry(0.22, 8, 6), m.lamp, 0, top + 10.3, 0));
  } else if (type === 'depot') {
    for (const [x, z] of [[-5.5, -4], [5.5, -4], [0, 5.5]]) {
      g.add(M(vcyl(4, 4, 7, 22), m.white, x, 3.5, z)); g.add(M(new THREE.SphereGeometry(4, 22, 8, 0, Math.PI*2, 0, Math.PI/5), m.white, x, 4.5, z));
      g.add(M(new THREE.TorusGeometry(4.02, 0.22, 6, 26).rotateX(Math.PI/2), m.red, x, 5.2, z));
      for (let y = 0.4; y < 7; y += 0.6) g.add(M(rbox(0.6, 0.06, 0.06, 0.02), m.dk, x + 4.15, y, z));
    }
    g.add(M(cyl(0.3, 0.3, 11, 10).rotateY(Math.PI/2), m.steel, 0, 1.2, -4));
    g.add(strut(new V3(-5.5, 1.2, -4), new V3(0, 1.2, 5.5), 0.3, m.steel));
    for (const [x, z, w, d] of [[0, -11, 24, 0.6], [0, 11.5, 24, 0.6], [-12, 0, 0.6, 22], [12, 0, 0.6, 22]]) g.add(M(rbox(w, 1.2, d, 0.1), m.concD, x, 0.6, z));
  } else if (type === 'command') {
    g.add(M(rbox(26, 8, 20, 0.3), m.conc, 0, 4, 0));
    g.add(M(rbox(26.15, 1.3, 20.15, 0.05), m.glass, 0, 5.4, 0)); g.add(M(rbox(26.15, 1.0, 20.15, 0.05), m.glass, 0, 2.2, 0));
    g.add(M(rbox(14, 5, 11, 0.25), m.conc, 0, 10.5, -1)); g.add(M(rbox(14.15, 1.4, 11.15, 0.05), m.glass, 0, 11, -1));
    g.add(M(rbox(26.4, 0.6, 20.4, 0.1), m.concD, 0, 8.2, 0)); g.add(M(rbox(14.3, 0.5, 11.3, 0.1), m.concD, 0, 13.2, -1));
    g.add(M(rbox(26.3, 0.8, 0.3, 0.05), m.red, 0, 7.2, 10.05));
    g.add(M(vcyl(0.12, 0.18, 12, 6), m.steel, 4, 19, -2)); g.add(M(vcyl(0.05, 0.05, 6, 4), m.dk, -5, 16.4, 2));
    const dish = M(new THREE.SphereGeometry(1.8, 14, 8, 0, Math.PI*2, 0, Math.PI/3.2), m.white, -3, 14.6, -4); dish.rotation.x = -1.1; g.add(dish);
    g.add(M(vcyl(0.08, 0.08, 9, 6), m.steel, 11, 4.5, 13)); const flag = M(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({color:0x7e2b25, side:THREE.DoubleSide}), 12.3, 8.1, 13); g.add(flag);
    g.add(M(rbox(6, 0.3, 3, 0.05), m.concD, 0, 3.2, 11.4)); g.add(M(rbox(4, 3, 0.2, 0.05), m.dk, 0, 1.5, 10.1));
    { const a = G.sandbags(-8, 0, 14.6), b = G.sandbags(8, 0, 14.6); if (a && b) { g.add(a); g.add(b); } else for (let i = -6; i <= 6; i++) for (let row = 0; row < 2; row++) g.add(M(rbox(0.95, 0.42, 0.55, 0.15), m.sand, i*1.0 + (row ? 0.5 : 0) + (i > 0 ? 3 : -3), 0.22 + row*0.42, 14.5)); }
  }
  if (type === 'mech') g.scale.setScalar(1.8);   // fallback walker sized like the imported ones
  // Constant-scale panel sheet on every armour part (box-projected UVs, scaled by each part's own size).
  g.traverse(o => { if (o.isMesh && o.material && o.material.map && o.geometry && !o.geometry.userData.boxUV) { o.geometry.userData.boxUV = 1; boxUV(o.geometry, 0.32); } });
  return g;
};
})();
