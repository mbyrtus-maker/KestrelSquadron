(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3, V2 = THREE.Vector2, D = Math.PI/180;

/* ---------- Mode poses (pilot's right is -x, model faces +z) ---------- */
const POSES = {
  jet:{
    body:{p:[0,0,0]}, nose:{p:[0,0.05,2.5]},
    wingL:{p:[1.15,0.12,-0.7]}, wingR:{p:[-1.15,0.12,-0.7]},
    legL:{p:[0.85,-0.25,0.4]}, legR:{p:[-0.85,-0.25,0.4]},
    armL:{p:[0.55,-0.75,-1.8], s:0.01}, armR:{p:[-0.55,-0.75,-1.8], s:0.01},
    head:{p:[0,-0.6,0.5], s:0.01}, gunpod:{p:[0,-2.05,-1.6]},
    blade:{p:[0,-0.5,-1], s:0.01}, shield:{p:[0,-0.5,-1], s:0.01}
  },
  hover:{
    body:{p:[0,0,0]}, nose:{p:[0,0.05,2.5]},
    wingL:{p:[1.15,0.12,-0.7], r:[0,15,0]}, wingR:{p:[-1.15,0.12,-0.7], r:[0,-15,0]},
    legL:{p:[1.3,0.0,-1.5], r:[-120,0,0]}, legR:{p:[-1.3,0.0,-1.5], r:[-120,0,0]},
    armL:{p:[2.15,-0.85,0.2], r:[60,8,14]}, armR:{p:[-2.15,-0.85,0.2], r:[60,-8,-14]},
    head:{p:[0,-0.95,1.1], r:[0,0,180]}, gunpod:{p:[-1.6,-1.25,4.0]},
    blade:{p:[1.6,-1.2,4], s:0.01}, shield:{p:[1.6,-1.2,3], s:0.01}
  },
  mech:{
    legL:{p:[1.02,0.3,0], r:[-90,0,0]}, legR:{p:[-1.02,0.3,0], r:[-90,0,0]},
    body:{p:[0,2.8,0], r:[-90,0,0]}, nose:{p:[0,3.0,-0.95], r:[90,180,0]},
    wingL:{p:[0.9,4.4,-1.1], r:[0,0,75]}, wingR:{p:[-0.9,4.4,-1.1], r:[0,0,-75]},
    armL:{p:[2.1,4.7,0.1], r:[48,0,0]}, armR:{p:[-2.1,4.7,0.1], r:[48,0,0]},
    head:{p:[0,5.97,0.15]}, gunpod:{p:[-1.85,2.2,2.3]},
    blade:{p:[1.85,2.2,2.3], r:[-35,0,0]}, shield:{p:[2.55,3.0,1.6], r:[48,0,0]}
  }
};
const eIn = u => u*u*u, eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < 0.5 ? 4*u*u*u : 1 - Math.pow(-2*u + 2, 3)/2;
// Sword swing keyframes: arm pitch (ax), yaw (ay), roll (az) in degrees, body twist (tw) in radians.
const SWING = [
  {t:0,    ax:48,   ay:0,   az:0,   tw:0,     ease:eIO},
  {t:0.32, ax:-120, ay:55,  az:35,  tw:0.38,  ease:eOut},
  {t:0.52, ax:30,   ay:-60, az:-25, tw:-0.42, ease:eIn},
  {t:0.68, ax:58,   ay:-80, az:-35, tw:-0.55, ease:eOut},
  {t:1,    ax:48,   ay:0,   az:0,   tw:0,     ease:eIO}
];
// Third cut of the combo: a two-handed-style overhead chop (also used for the ground strike).
const SWING_O = [
  {t:0,    ax:48,   ay:0,   az:0,   tw:0,     ease:eIO},
  {t:0.34, ax:-165, ay:8,   az:0,   tw:0.12,  ease:eOut},
  {t:0.5,  ax:62,   ay:-4,  az:0,   tw:-0.12, ease:eIn},
  {t:0.72, ax:70,   ay:-6,  az:0,   tw:-0.1,  ease:eOut},
  {t:1,    ax:48,   ay:0,   az:0,   tw:0,     ease:eIO}
];
const TGT = {}, E = new THREE.Euler(0, 0, 0, 'YXZ'), E2 = new THREE.Euler(0, 0, 0, 'ZYX');
for (const m in POSES) { TGT[m] = {}; for (const n in POSES[m]) { const d = POSES[m][n], r = d.r || [0,0,0];
  TGT[m][n] = {p:new V3(...d.p), q:new THREE.Quaternion().setFromEuler(E.set(r[0]*D, r[1]*D, r[2]*D, 'YXZ')), s:d.s ?? 1}; } }
G.CLEAR = {jet:2.0, hover:6.4, mech:6.0};
const SIT = 0.06;   // how far the mech frame settles into its bent-knee stance

/* ---------- Per-frame silhouettes ---------- */
const STYLE = {
  kestrel:  {wing:'swept',   span:5.4, nose:1.0,  bodyW:1.0,  num:'101'},
  wren:     {wing:'stub',    span:4.5, nose:0.85, bodyW:1.12, num:'012', canards:true, armor:true},
  shrike:   {wing:'delta',   span:4.7, nose:1.25, bodyW:0.95, num:'051', sharp:true},
  kestrelc: {wing:'swept',   span:5.4, nose:1.05, bodyW:1.0,  num:'001', twinSeat:true, stripes:true},
  gyrfalcon:{wing:'forward', span:5.2, nose:1.15, bodyW:1.0,  num:'X01', canards:true},
  osprey:   {wing:'cranked', span:5.9, nose:1.1,  bodyW:1.15, num:'X4',  canards:true, big:true},
  // the Varn Harbinger (volume 3 boss): a bomber planform on the same three-mode chassis, built at three times the size in targets.js
  harbinger:{wing:'bomber',  span:7.4, nose:1.3,  bodyW:1.3,  num:'V01', big:true, armor:true, varn:true,
    pose:{mech:{wingL:{p:[1.0,5.0,-1.5], r:[15,-10,-40]}, wingR:{p:[-1.0,5.0,-1.5], r:[15,10,40]}},   // the broad wing hangs off the back like a cape instead of standing up
      // jet: every fighter part folds away inside the flying-wing shell (built in targets.js), and unfolds out of it on transformation
      jet:{body:{p:[0,0,0], s:0.5}, nose:{p:[0,0,1.2], s:0.01}, wingL:{p:[1.15,0.12,-0.7], s:0.01}, wingR:{p:[-1.15,0.12,-0.7], s:0.01},
        legL:{p:[0.85,-0.25,0.4], s:0.01}, legR:{p:[-0.85,-0.25,0.4], s:0.01}, gunpod:{p:[0,-0.6,-1.0], s:0.01}}}}
};
const PLAN = {
  swept:  s => [[0,1.6],[s*5.4,-0.9],[s*5.4,-1.85],[0,-1.6]],
  stub:   s => [[0,1.5],[s*4.5,-0.3],[s*4.5,-1.5],[0,-1.6]],
  delta:  s => [[0,2.6],[s*4.7,-1.5],[s*4.7,-2.05],[0,-1.9]],
  forward:s => [[0,0.9],[s*5.2,1.6],[s*5.2,0.7],[0,-1.8]],
  cranked:s => [[0,2.8],[s*1.9,0.4],[s*5.9,-1.1],[s*5.9,-1.95],[0,-1.95]],
  bomber: s => [[0,4.4],[s*1.5,2.6],[s*7.4,-2.1],[s*7.4,-2.9],[s*5.7,-2.3],[s*4.3,-3.3],[s*2.3,-2.6],[0,-3.5]]   // blended arrowhead flying wing: kinked leading edge, saw-tooth trailing edge
};

/* ---------- Textures ---------- */
let TEX = null;
function textures(){
  if (TEX) return TEX;
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#f2f2f0'; x.fillRect(0, 0, 512, 512);
  // Service wear: mismatched touch-up panels, soot and hydraulic streaks, chipped edges.
  for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(0,0,0,${Math.random()*0.024})`; x.fillRect(Math.random()*512, Math.random()*512, 40 + Math.random()*120, 30 + Math.random()*90); }
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(255,255,255,${Math.random()*0.015})`; x.fillRect(Math.random()*512, Math.random()*512, 30 + Math.random()*70, 24 + Math.random()*50); }
  for (let i = 0; i < 34; i++) { const px = Math.random()*512, py = Math.random()*512, L = 30 + Math.random()*110, gr = x.createLinearGradient(0, py, 0, py + L); gr.addColorStop(0, `rgba(20,18,14,${0.08 + Math.random()*0.12})`); gr.addColorStop(1, 'rgba(20,18,14,0)'); x.fillStyle = gr; x.fillRect(px, py, 2 + Math.random()*5, L); }
  x.strokeStyle = 'rgba(18,22,26,0.34)'; x.lineWidth = 1.2;
  for (let r = 0; r < 8; r++) {
    const y = r*64; x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(512, y + 0.5); x.stroke();
    let px = (r % 2)*40; while (px < 512) { x.beginPath(); x.moveTo(px + 0.5, y); x.lineTo(px + 0.5, y + 64); x.stroke(); px += 90 + ((r*37 + px) % 60); }
  }
  x.fillStyle = 'rgba(25,30,36,0.25)'; for (let r = 0; r < 8; r++) for (let px = 6; px < 512; px += 12) x.fillRect(px, r*64 + 4, 1.4, 1.4);
  for (let i = 0; i < 7; i++) x.strokeRect(30 + Math.random()*440, 30 + Math.random()*440, 24 + Math.random()*30, 16 + Math.random()*20);
  const mk = (rx, ry) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; };
  const d = document.createElement('canvas'); d.width = d.height = 128; const y = d.getContext('2d');
  y.fillStyle = '#fff'; y.beginPath(); y.moveTo(14, 20); y.lineTo(64, 70); y.lineTo(114, 20); y.lineTo(114, 50); y.lineTo(64, 100); y.lineTo(14, 50); y.closePath(); y.fill();
  // Allied roundel, shared with the Bastion's palette: navy ring, light field, orange centre.
  const r = document.createElement('canvas'); r.width = r.height = 128; const z = r.getContext('2d');
  z.fillStyle = '#35424f'; z.beginPath(); z.arc(64, 64, 60, 0, 7); z.fill();
  z.fillStyle = '#a9adad'; z.beginPath(); z.arc(64, 64, 42, 0, 7); z.fill();
  z.fillStyle = '#8a4c2c'; z.beginPath(); z.arc(64, 64, 18, 0, 7); z.fill();
  TEX = {lathe:mk(1.5, 1), flat:mk(0.22, 0.22), chev:new THREE.CanvasTexture(d), roundel:new THREE.CanvasTexture(r), nums:{}};
  return TEX;
}
function numTex(n){
  const T = textures(); if (T.nums[n]) return T.nums[n];
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.font = 'bold 46px "Saira Extra Condensed","Arial Narrow",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, 64, 34);
  return (T.nums[n] = new THREE.CanvasTexture(c));
}

/* ---------- Smooth geometry helpers ---------- */
const lathe = (prof, seg = 24, sx = 1, sy = 1) => {
  const g = new THREE.LatheGeometry(prof.map(([z, r]) => new V2(Math.max(r, 0.0001), z)), seg);
  g.rotateX(Math.PI/2); g.scale(sx, sy, 1); return g;
};
function rrect(s, x, y, w, h, r){ s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); }
function rbox(w, h, d, b = 0.12){
  b = Math.min(b, w/2.2, h/2.2, d/2.2); const iw = w - 2*b, ih = h - 2*b, s = new THREE.Shape();
  rrect(s, -iw/2, -ih/2, iw, ih, Math.min(iw, ih)*0.22);
  const g = new THREE.ExtrudeGeometry(s, {depth:Math.max(0.01, d - 2*b), bevelEnabled:true, bevelThickness:b, bevelSize:b, bevelSegments:3, curveSegments:4});
  g.translate(0, 0, -(d - 2*b)/2); return g;
}
function plate(pts, thick = 0.16, b = 0.05){
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth:thick - 2*b, bevelEnabled:true, bevelThickness:b, bevelSize:b*0.8, bevelSegments:2, curveSegments:2});
  g.rotateX(Math.PI/2); g.translate(0, thick/2 - b, 0); return g;
}
function fin(pts, thick = 0.14, b = 0.04){
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth:thick - 2*b, bevelEnabled:true, bevelThickness:b, bevelSize:b*0.8, bevelSegments:2, curveSegments:2});
  g.rotateY(-Math.PI/2); g.translate(thick/2 - b, 0, 0); return g;
}
const cyl = (r1, r2, len, seg = 16) => { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI/2); return g; };
const M = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };

/* ---------- Transforming fighter ---------- */
G.buildFighter = function(frame){
  const T = textures(), st = STYLE[frame.id] || STYLE.kestrel, bw = st.bodyW, L = st.nose;
  // Smooth-shaded satin paint: curved surfaces read as continuous skin, bevelled plates stay crisp.
  const S = o => new THREE.MeshStandardMaterial(Object.assign({roughness:0.62, metalness:0.32, envMapIntensity:0.55}, o));
  const hull = S({color:frame.color, map:T.lathe}), hullF = S({color:frame.color, map:T.flat}), trim = S({color:frame.trim, roughness:0.6});
  const dark = S({color:0x2a2f35, roughness:0.55, metalness:0.6}), metal = S({color:0x80888f, roughness:0.28, metalness:0.92, envMapIntensity:1.1});
  const black = S({color:0x0c0e10, roughness:0.85, metalness:0.1});
  const glass = new THREE.MeshPhysicalMaterial({color:0x1b3646, roughness:0.04, metalness:0.25, clearcoat:1, clearcoatRoughness:0.04, envMapIntensity:1.8, transparent:true, opacity:0.9});
  const visor = S({color:0x9fe9ff, emissive:0x2ab4e6, emissiveIntensity:0.9, roughness:0.2, metalness:0});
  const bladeM = S({color:0xffa040, emissive:0xff7a20, emissiveIntensity:0.8, metalness:0});
  const misM = S({color:0x9da2a3, roughness:0.55, metalness:0.2}), warhead = S({color:0x6e5a2a, roughness:0.55, metalness:0.1});
  const decalM = new THREE.MeshStandardMaterial({color:frame.trim, map:T.chev, transparent:true, roughness:0.4, metalness:0.2, polygonOffset:true, polygonOffsetFactor:-2, depthWrite:false});
  const numM = new THREE.MeshStandardMaterial({color:frame.trim === 0x1e1e22 ? 0x1e1e22 : 0x1c1f23, map:numTex(st.num), transparent:true, roughness:0.5, polygonOffset:true, polygonOffsetFactor:-2, depthWrite:false});
  const roundelM = new THREE.MeshStandardMaterial({map:T.roundel, transparent:true, roughness:0.5, metalness:0.1, polygonOffset:true, polygonOffsetFactor:-2, depthWrite:false});
  const glowM = new THREE.MeshBasicMaterial({color:0x9fe8ff, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false});
  const coreM = new THREE.MeshBasicMaterial({color:0xcff4ff});
  const root = new THREE.Group(), P = {}, missiles = [], nozzles = [], feet = [];
  const part = n => { const g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g); P[n] = g; return g; };

  /* fuselage */
  const body = part('body');
  body.add(M(lathe([[-2.66,0],[-2.6,0.5],[-2.3,0.82],[-1.4,0.98],[1.2,1.0],[2.2,0.93],[2.6,0.82],[2.64,0]], 40, 1.22*bw, 0.6), hull));
  body.add(M(rbox(1.5*bw, 0.5, 0.2, 0.06), dark, 0, 0, -2.66)); for (const s of [1, -1]) body.add(M(rbox(0.5, 0.26, 0.12, 0.04), black, s*0.4*bw, 0, -2.74));   // rear bulkhead + vents
  body.add(M(lathe([[-2.54,0],[-2.5,0.12],[-1.8,0.42],[1.2,0.48],[2.6,0.42],[2.64,0]], 18, 0.9, 0.62), hull, 0, 0.36, 0));
  body.add(M(lathe([[-1.75,1.012],[-1.45,1.012]], 28, 1.22*bw, 0.6), trim));
  body.add(M(rbox(2.25*bw, 0.44, 1.7, 0.2), hull, 0, -0.5, 1.3));                      // chest
  body.add(M(rbox(0.46, 0.2, 1.5, 0.07), trim, 0, -0.72, 1.3));                         // sternum
  for (const s of [1, -1]) { const v = M(rbox(0.62, 0.14, 0.8, 0.05), black, s*0.66*bw, -0.74, 1.5); body.add(v); body.add(M(rbox(0.7, 0.1, 0.12, 0.03), trim, s*0.66*bw, -0.76, 1.02)); }
  body.add(M(rbox(1.2, 0.4, 1.5, 0.16), dark, 0, -0.46, -0.2));                         // waist
  body.add(M(rbox(1.9*bw, 0.46, 0.95, 0.18), hull, 0, -0.5, -1.7));                     // hips
  body.add(M(rbox(0.5, 0.3, 0.9, 0.1), trim, 0, -0.7, -1.75));
  for (const s of [1, -1]) { const sk = M(rbox(0.8, 0.2, 1.05, 0.08), hull, s*0.78*bw, -0.74, -2.1); sk.rotation.x = 0.16; body.add(sk); }
  for (const s of [1, -1]) {
    body.add(M(rbox(0.86, 0.96, 2.5, 0.22), hull, s*1.4*bw, -0.12, 1.05));
    body.add(M(rbox(0.6, 0.7, 0.08, 0.03), black, s*1.4*bw, -0.12, 2.29));
    if (st.armor) body.add(M(rbox(0.22, 0.8, 2.6, 0.08), trim, s*1.86*bw, 0.05, -0.6));
  }
  if (st.stripes) for (const s of [1, -1]) body.add(M(rbox(0.16, 0.06, 4.6, 0.02), trim, s*0.32, 0.67, 0));

  /* nose + canopy */
  const nose = part('nose');
  const nz = z => z > 1.9 ? 1.9 + (z - 1.9)*L : z;
  nose.add(M(lathe([[-0.04,0],[0,0.84],[0.9,0.81],[1.9,0.69],[2.9,0.49],[3.7,0.27],[4.3,0.09],[4.5,0.005]].map(([z, r]) => [nz(z), r*(st.sharp && z > 2 ? 0.85 : 1)]), 40, 1.18*bw, st.sharp ? 0.55 : 0.64), hull));
  nose.add(M(lathe([[nz(2.25),0.64],[nz(2.45),0.6]], 28, 1.18*bw*1.0, st.sharp ? 0.56 : 0.65), trim));
  // Canopy: an ellipsoid whose front half narrows and drops so it follows the tapering nose instead of overhanging it,
  // pitched slightly nose-down and sunk into the spine. A dark rim made from the same shape seals the base.
  const cz = st.twinSeat ? 1.95 : 1.45, czc = 1.05 + (st.twinSeat ? 0.1 : 0) - (st.sharp ? 0.1 : 0);
  const shapeK = zn => zn > 0 ? 1 - 0.5*zn*zn : 1 - 0.12*zn*zn;
  const cgeo = new THREE.SphereGeometry(1, 28, 18), cp = cgeo.attributes.position;
  for (let i = 0; i < cp.count; i++) { const zn = cp.getZ(i), k = shapeK(zn); cp.setX(i, cp.getX(i)*k); cp.setY(i, cp.getY(i)*(zn > 0 ? 1 - 0.3*zn*zn : 1)); }
  cgeo.computeVertexNormals();
  const canG = new THREE.Group(); canG.position.set(0, 0.36, czc); canG.rotation.x = st.sharp ? 0.07 : 0.05; nose.add(canG);
  const can = M(cgeo, glass); can.scale.set(0.54, 0.46, cz); can.castShadow = false; canG.add(can);
  const rim = M(cgeo, dark); rim.scale.set(0.57, 0.06, cz + 0.04); rim.position.y = -0.01; rim.castShadow = false; canG.add(rim);
  const bows = st.twinSeat ? [-0.35, 0.5] : [0.2];
  for (const b of bows) { const k = shapeK(b/cz), ky = b > 0 ? 1 - 0.3*(b/cz)**2 : 1, bow = M(new THREE.TorusGeometry(1, 0.035, 6, 24, Math.PI), dark, 0, 0, b); bow.scale.set(0.545*k, 0.465*ky, 1); canG.add(bow); }
  nose.add(M(cyl(0.025, 0.025, 0.7, 6), metal, 0, 0, nz(4.5) + 0.3));
  if (st.canards) for (const s of [1, -1]) nose.add(M(plate([[0,0.45],[s*1.25,-0.25],[s*1.25,-0.55],[0,-0.45]], 0.1, 0.03), hullF, s*0.6*bw, -0.05, 1.5));

  /* wings */
  const wing = (n, s) => {
    const g = part(n), sp = st.span;
    g.add(M(plate(PLAN[st.wing](s), 0.16, 0.05), hullF));
    const tipZ = PLAN[st.wing](s).filter(p => Math.abs(p[0]) > sp - 0.01).reduce((a, p) => a + p[1], 0)/2;
    g.add(M(rbox(0.28, 0.2, 1.0, 0.07), trim, s*(sp - 0.1), 0, tipZ));
    const dc = M(new THREE.PlaneGeometry(1.2, 1.2), decalM, s*sp*0.62, 0.088, tipZ*0.55 - 0.1); dc.rotation.x = -Math.PI/2; dc.castShadow = false; g.add(dc);
    if (!st.varn) { const rd = M(new THREE.PlaneGeometry(1.15, 1.15), roundelM, s*sp*0.36, 0.089, tipZ*0.32 - 0.25); rd.rotation.x = -Math.PI/2; rd.castShadow = false; g.add(rd); }
    for (const k of [0.36, 0.53, 0.7]) {
      const ms = new THREE.Group(); ms.add(M(cyl(0.15, 0.15, 2.0, 12), misM)); ms.add(M(new THREE.ConeGeometry(0.15, 0.55, 12).rotateX(Math.PI/2), warhead, 0, 0, 1.27));
      for (const r of [0, Math.PI/2]) { const f = M(rbox(0.7, 0.04, 0.35, 0.015), dark, 0, 0, -0.85); f.rotation.z = r; ms.add(f); }
      ms.position.set(s*sp*k, -0.4, -0.25); g.add(ms); missiles.push(ms);
    }
  };
  wing('wingL', 1); wing('wingR', -1);

  /* legs / engine nacelles */
  const nr = st.big ? 1.1 : 1;
  const KNEE = -2.62, knees = {}, fores = {};
  const leg = (n, s) => {
    const g = part(n);
    // Lower leg hangs off a knee hinge: `lo` pivots at the knee, `L` keeps the original nacelle coordinates.
    const lo = new THREE.Group(); lo.position.z = KNEE; g.add(lo); knees[n] = lo;
    const L = new THREE.Group(); L.position.z = -KNEE; lo.add(L);
    g.add(M(lathe([[-2.8,0],[-2.75,0.6],[-2.62,0.66],[-2.15,0.74],[-1.1,0.83],[-0.35,0.8],[0,0.7]], 36, nr, nr), hull));        // thigh
    const mouth = M(new THREE.CircleGeometry(0.62*nr, 24), black, 0, 0, 0.01); g.add(mouth);
    g.add(M(rbox(1.4, 0.46, 1.9, 0.2), hull, 0, -0.62, -1.15));                               // thigh plate / intake fairing
    const jt = M(cyl(0.6, 0.6, 1.26, 20), dark, 0, 0, KNEE); jt.rotation.y = Math.PI/2; g.add(jt);            // knee joint drum
    const knee = M(new THREE.SphereGeometry(0.62, 18, 12), trim, 0, -0.5, KNEE); knee.scale.set(1.05, 0.8, 0.85); g.add(knee);
    L.add(M(lathe([[-6.05,0.6],[-5.75,0.82],[-5.0,0.93],[-4.0,0.87],[-3.1,0.72],[-2.62,0.64],[-2.5,0.5],[-2.46,0]], 36, nr, nr), hull));   // shin
    L.add(M(lathe([[-6.45,0.58],[-6.3,0.6],[-6.05,0.64]], 20, nr, nr), metal));
    const core = M(new THREE.CircleGeometry(0.45*nr, 20), coreM, 0, 0, -6.2); core.rotation.y = Math.PI; L.add(core);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.46*nr, 1.6, 16, 1, true).rotateX(-Math.PI/2).translate(0, 0, -0.8), glowM);
    flame.position.z = -6.3; L.add(flame); nozzles.push(flame);
    const shin = M(rbox(1.15, 0.4, 2.1, 0.18), hull, 0, -0.74, -4.25); shin.rotation.x = -0.06; L.add(shin);
    L.add(M(rbox(0.3, 0.16, 1.7, 0.06), trim, 0, -0.95, -4.3));
    L.add(M(lathe([[-6.0,0.9],[-5.55,0.97],[-5.3,0.94]], 30, nr, nr), dark));                // ankle collar
    // Feet fold flat into the nacelle in jet mode and swing out for hover and mech.
    const foot = new THREE.Group(); L.add(foot); feet.push(foot);
    // Armoured boot (foot-local: -y is the toe, -z is down to the sole at -6.1): tread sole, boot block, sloped toe cap,
    // ankle drum, side armour with vents, heel block and pistons. Dropped 0.23 so the sole meets the ground and shrouds the hover nozzle.
    const boot = new THREE.Group(); boot.position.z = -0.23; foot.add(boot);
    boot.add(M(rbox(1.56, 2.6, 0.3, 0.07), black, 0, -0.42, -5.95));                         // sole
    for (const y of [-1.5, -1.05, -0.6, -0.15, 0.3, 0.7]) boot.add(M(rbox(1.6, 0.09, 0.12, 0.02), dark, 0, y, -5.97));   // tread grooves
    boot.add(M(rbox(1.5, 1.6, 0.85, 0.16), hull, 0, -0.25, -5.48));                         // boot block
    { const tc = M(rbox(1.48, 1.05, 0.5, 0.14), hull, 0, -1.18, -5.7); tc.rotation.x = 0.38; boot.add(tc); }   // sloped toe cap
    { const tg = M(rbox(1.4, 0.2, 0.32, 0.06), trim, 0, -1.68, -5.85); tg.rotation.x = 0.38; boot.add(tg); }     // toe guard
    boot.add(M(rbox(1.0, 0.12, 0.05, 0.02), black, 0, -1.05, -5.06));                          // toe seam
    boot.add(M(rbox(1.0, 0.9, 0.5, 0.12), dark, 0, 0.2, -5.22));                              // ankle block
    { const d = M(cyl(0.3, 0.3, 1.24, 12), metal, 0, 0.12, -5.1); d.rotation.y = Math.PI/2; boot.add(d); }      // ankle drum
    for (const s of [1, -1]) {
      boot.add(M(rbox(0.14, 1.4, 0.95, 0.05), hull, s*0.8, -0.12, -5.42));                  // side armour
      for (let i = 0; i < 3; i++) boot.add(M(rbox(0.05, 0.08, 0.36, 0.01), black, s*0.88, -0.5 + i*0.22, -5.42));   // vents
      boot.add(M(cyl(0.16, 0.16, 0.06, 10), trim, s*0.8, 0.12, -5.1).rotateY(Math.PI/2));      // drum caps
      const ps = M(cyl(0.055, 0.055, 0.9, 8), metal, s*0.42, 0.6, -5.4); ps.rotation.x = 0.75; boot.add(ps);
    }
    boot.add(M(rbox(1.3, 0.65, 0.7, 0.14), dark, 0, 0.75, -5.7));                           // heel block
    boot.add(M(rbox(0.8, 0.2, 0.3, 0.06), hull, 0, 1.0, -5.62));                              // heel plate
    const fm = M(fin([[0.6,0],[-1.05,0],[-1.55,2.15],[-0.6,2.15]], 0.14, 0.04), hullF, s*0.32, 0.62, -3.9); fm.rotation.z = -s*0.3; L.add(fm);
    fm.add(M(rbox(0.16, 0.36, 1.0, 0.06), trim, 0, 2.05, -1.05));
    const num = M(new THREE.PlaneGeometry(0.9, 0.45), numM, s*0.085, 1.05, -0.55); num.rotation.y = s*Math.PI/2; num.castShadow = false; fm.add(num);
  };
  leg('legL', 1); leg('legR', -1);

  /* arms */
  const ELB = 1.62;
  const arm = n => { const g = part(n), side = n === 'armR' ? -1 : 1;
    const fo = new THREE.Group(); fo.position.z = ELB; g.add(fo); fores[n] = fo;
    const A = new THREE.Group(); A.position.z = -ELB; fo.add(A);
    const sh = M(new THREE.SphereGeometry(0.68, 24, 16), hull); sh.scale.set(1.05, 1.0, 1.12); g.add(sh);          // shoulder
    g.add(M(lathe([[-0.42,0.705],[-0.2,0.735],[0.02,0.725]], 28, 1.05, 1.0), trim));
    g.add(M(lathe([[0.26,0],[0.3,0.4],[0.9,0.43],[1.5,0.36],[1.54,0]], 20), dark));                                                   // upper arm
    const ej = M(cyl(0.46, 0.46, 0.9, 18), dark, 0, 0, ELB); ej.rotation.y = Math.PI/2; g.add(ej);                  // elbow joint
    A.add(M(lathe([[1.58,0],[1.62,0.3],[1.7,0.4],[1.95,0.6],[2.8,0.66],[3.2,0.56],[3.32,0.44],[3.36,0]], 28, 1.0, 0.92), hull));     // forearm
    A.add(M(lathe([[2.98,0.635],[3.14,0.6]], 28, 1.0, 0.92), trim));
    // Articulated hand: wrist cuff, palm on the outer side, armoured back, four three-joint fingers curled round a vertical grip, thumb over the top.
    A.add(M(rbox(0.62, 0.66, 0.2, 0.06), dark, 0, 0, 3.32));                                                   // wrist cuff
    A.add(M(rbox(0.18, 0.66, 0.6, 0.06), dark, side*0.26, 0, 3.62));                                           // palm
    A.add(M(rbox(0.08, 0.58, 0.5, 0.04), hull, side*0.38, 0, 3.6));                                            // back of hand
    for (const y of [-0.24, -0.08, 0.08, 0.24]) {
      let px = side*0.22, pz = 3.9, a = 0;
      A.add(M(rbox(0.16, 0.14, 0.1, 0.03), metal, side*0.22, y, 3.9));                                         // knuckle plate
      [[0.2, 38], [0.16, 72], [0.13, 72]].forEach(([ln, bend], j) => {
        a += bend*D; const dx = -side*Math.sin(a), dz = Math.cos(a);
        const f = M(rbox(0.13, 0.135, ln + 0.03, 0.035), j < 2 ? dark : black, px + dx*ln/2, y, pz + dz*ln/2); f.rotation.y = Math.atan2(dx, dz); A.add(f);
        px += dx*ln; pz += dz*ln;
      });
    }
    { let px = side*0.12, pz = 3.4, a = 20*D;
      for (const ln of [0.22, 0.17]) { const dx = -side*Math.sin(a), dz = Math.cos(a);
        const t = M(rbox(0.14, 0.14, ln + 0.03, 0.04), dark, px + dx*ln/2, 0.38, pz + dz*ln/2); t.rotation.y = Math.atan2(dx, dz); A.add(t);
        px += dx*ln; pz += dz*ln; a += 55*D; } } };
  arm('armL'); arm('armR');

  /* head: faceted prow-browed sensor head (flat-shaded lofted plates over a dark under-structure) */
  const head = part('head');
  const hg = new THREE.Group(); hg.scale.setScalar(1.22); head.add(hg);
  // Chamfered cross-section at depth z (half-width w, top t, bottom b, top chamfer c, bottom chamfer c2), wound CCW about +z.
  const sec = (z, w, t, b, c, c2) => [[w, b + c2, z], [w, t - c, z], [w - c, t, z], [-w + c, t, z], [-w, t - c, z], [-w, b + c2, z], [-w + c2, b, z], [w - c2, b, z]];
  // Flat-shaded solid skinned across matching cross-sections (back to front), capped at both ends.
  const loft = secs => { const v = [], uv = [], put = (...ps) => { for (const q of ps) { v.push(q[0], q[1], q[2]); uv.push(q[0]*0.6 + 0.5, q[2]*0.5 + q[1]*0.3 + 0.5); } }, n = secs[0].length;
    for (let i = 0; i < secs.length - 1; i++) for (let j = 0; j < n; j++) { const a = secs[i][j], b = secs[i][(j + 1) % n], c = secs[i + 1][(j + 1) % n], d = secs[i + 1][j]; put(a, b, c, a, c, d); }
    const s0 = secs[0], s1 = secs[secs.length - 1]; for (let j = 1; j < n - 1; j++) { put(s0[0], s0[j + 1], s0[j]); put(s1[0], s1[j], s1[j + 1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  // crown shell: widest behind the sensor, pinching forward into an overhanging prow brow
  hg.add(M(loft([sec(-0.80, 0.24, 0.27, 0.02, 0.10, 0.05), sec(-0.42, 0.50, 0.47, -0.08, 0.20, 0.08), sec(0.10, 0.57, 0.52, -0.02, 0.23, 0.06), sec(0.52, 0.48, 0.39, 0.13, 0.17, 0.04), sec(0.90, 0.13, 0.23, 0.15, 0.05, 0.02)]), hullF));
  // dark under-structure with the recessed sensor bay
  hg.add(M(loft([sec(-0.56, 0.38, 0.10, -0.40, 0.04, 0.10), sec(0.30, 0.43, 0.14, -0.44, 0.04, 0.12), sec(0.57, 0.36, 0.14, -0.38, 0.04, 0.12)]), dark));
  hg.add(M(new THREE.BoxGeometry(0.66, 0.2, 0.04), black, 0, 0.0, 0.565));
  for (const s of [1, -1]) { const v = M(new THREE.BoxGeometry(0.34, 0.1, 0.05), visor, s*0.155, 0.005, 0.585); v.rotation.y = s*0.3; hg.add(v); }   // shallow-V sensor slit
  hg.add(M(cyl(0.05, 0.05, 0.06, 6), metal, -0.27, -0.2, 0.52)); hg.add(M(cyl(0.03, 0.03, 0.07, 6), visor, -0.27, -0.2, 0.525));               // offset ranging lens
  // jaw prow + canted cheek plates
  hg.add(M(loft([sec(0.05, 0.30, -0.30, -0.56, 0.02, 0.10), sec(0.52, 0.25, -0.27, -0.55, 0.02, 0.10), sec(0.78, 0.08, -0.33, -0.50, 0.02, 0.03)]), trim));
  const cheekG = loft([[[0.52, -0.42, -0.42], [0.63, -0.02, -0.42], [0.55, 0.0, -0.42], [0.45, -0.40, -0.42]], [[0.54, -0.46, 0.3], [0.65, 0.0, 0.3], [0.57, 0.02, 0.3], [0.47, -0.44, 0.3]], [[0.36, -0.44, 0.7], [0.42, -0.14, 0.7], [0.36, -0.13, 0.7], [0.31, -0.42, 0.7]]]);
  for (const s of [1, -1]) { const ck = M(cheekG, hullF); ck.scale.x = s; hg.add(ck);
    for (let i = 0; i < 3; i++) { const vt = M(new THREE.BoxGeometry(0.03, 0.05, 0.2), black, s*(0.565 + i*0.022), -0.32 + i*0.09, -0.1); vt.rotation.z = s*0.25; hg.add(vt); }   // cheek vents
    for (const z of [-0.33, 0.2]) { const rv = M(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6), metal, s*0.635, -0.07, z); rv.rotation.z = Math.PI/2; hg.add(rv); }           // fasteners
    // swept blade antenna laid back along the head line
    const an = M(fin([[0.1, 0], [-0.12, 0], [-0.98, 0.1], [-0.9, 0.17]], 0.05, 0.015), trim, s*0.5, 0.22, -0.3); an.rotation.z = -s*0.5; an.rotation.y = -s*0.12; hg.add(an);
    hg.add(M(new THREE.BoxGeometry(0.1, 0.12, 0.26), dark, s*0.5, 0.24, -0.32)); }
  // crown details: low swept fin, panel seams, marker light
  hg.add(M(fin([[0.3, 0], [-0.6, 0], [-1.12, 0.1], [-1.04, 0.19], [-0.1, 0.09]], 0.07, 0.02), trim, 0, 0.5, 0));
  hg.add(M(new THREE.BoxGeometry(0.7, 0.02, 0.022), black, 0, 0.503, -0.16));
  { const bp = M(plate([[-0.26, 0], [0.26, 0], [0.07, 0.36], [-0.07, 0.36]], 0.03, 0.01), trim, 0, 0.385, 0.5); bp.rotation.x = 0.42; hg.add(bp); }
  hg.add(M(new THREE.BoxGeometry(0.07, 0.04, 0.1), new THREE.MeshBasicMaterial({color:0xff5a3c}), 0.33, 0.44, -0.5));
  // neck: faceted collar, ring and twin actuators
  { const ng = new THREE.CylinderGeometry(0.3, 0.4, 0.34, 8).toNonIndexed(); ng.computeVertexNormals(); hg.add(M(ng, dark, 0, -0.58, -0.08));
    hg.add(M(new THREE.CylinderGeometry(0.43, 0.43, 0.06, 8), metal, 0, -0.72, -0.08));
    for (const s of [1, -1]) { const ac = M(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), metal, s*0.2, -0.5, -0.42); ac.rotation.x = -0.3; hg.add(ac); } }
  // Head lasers: a slim pod on each side of the head, one barrel per side (twin) or two stacked (quad), all firing forward.
  const nL = frame.lasers >= 4 ? 4 : 2, rows = nL === 4 ? [0.17, -0.02] : [0.08], laserTips = [];
  for (const s of [1, -1]) {
    const ph = rows.length*0.19 + 0.06, pc = (rows[0] + rows[rows.length - 1])/2;
    hg.add(M(rbox(0.16, ph, 0.62, 0.04), dark, s*0.73, pc, 0.18));                                        // emitter pod
    hg.add(M(rbox(0.05, ph*0.7, 0.3, 0.02), trim, s*0.82, pc, 0.12));                                     // pod side plate
    for (const y of rows) {
      hg.add(M(cyl(0.034, 0.038, 0.62, 8), metal, s*0.73, y, 0.68));                                       // barrel
      hg.add(M(cyl(0.05, 0.05, 0.06, 8), dark, s*0.73, y, 0.52)); hg.add(M(cyl(0.048, 0.048, 0.05, 8), dark, s*0.73, y, 0.96));   // collars
      hg.add(M(cyl(0.022, 0.022, 0.03, 6), visor, s*0.73, y, 1.0));                                         // lens
      laserTips.push(new V3(s*0.73*1.22, y*1.22, 1.02*1.22));
    }
  }

  /* gun pod, blade, shield */
  const gp = part('gunpod'); let gunFold = null;
  // "Lanner" 57 mm autocannon. Origin is the grip centre (held in the fist); barrel along +z, up +y.
  { const k = 1.25, R = new THREE.Group(); R.scale.setScalar(k); gp.add(R);
    const B = (w, h, d, m, x, y, z, b = 0.03) => { const o = M(rbox(w, h, d, b), m, x, y, z); R.add(o); return o; };
    const Cz = (r1, r2, z0, z1, y, m, seg = 16) => R.add(M(cyl(r1, r2, Math.abs(z1 - z0), seg), m, 0, y, (z0 + z1)/2));
    const lampM = new THREE.MeshStandardMaterial({color:0xffa030, emissive:0xff8a1a, emissiveIntensity:2.2});
    const lensM = S({color:0x05070a, roughness:0.05, metalness:0.6});
    B(0.34, 0.28, 0.2, dark, 0, 0.66, -0.5, 0.06);                        // receiver rear
    B(0.46, 0.44, 0.8, dark, 0, 0.66, 0, 0.07);                           // receiver
    B(0.5, 0.6, 1.6, dark, 0, 0.6, 1.3, 0.08);                            // receiver fore section
    B(0.42, 0.5, 0.25, dark, 0, 0.61, 2.2, 0.07);                         // taper
    B(0.52, 0.62, 0.1, trim, 0, 0.6, 1.95, 0.02);                         // accent band
    B(0.38, 0.46, 1.25, hull, 0, 0.63, 2.88, 0.08);                       // cooling jacket
    B(0.28, 0.32, 0.25, hull, 0, 0.62, 3.62, 0.06);                       // jacket nose
    for (const sx of [1, -1]) for (const z of [2.5, 2.72, 2.94, 3.16, 3.38]) { const v = B(0.02, 0.26, 0.14, black, sx*0.19, 0.62, z, 0.005); v.rotation.x = -20*D; }
    Cz(0.085, 0.085, 2.0, 4.6, 0.62, metal); Cz(0.12, 0.12, 3.75, 3.95, 0.62, dark);
    B(0.3, 0.24, 0.44, black, 0, 0.62, 4.72, 0.02);                       // muzzle brake
    for (const z of [4.6, 4.72, 4.84]) B(0.32, 0.1, 0.06, metal, 0, 0.62, z, 0.01);
    Cz(0.055, 0.055, 2.1, 3.4, 0.91, metal, 10); Cz(0.07, 0.07, 3.4, 3.46, 0.91, dark, 10); Cz(0.07, 0.07, 2.04, 2.1, 0.91, dark, 10);   // recuperator
    // Grip, trigger guard, foregrip and ammo cassette hang from a fold group pivoted at the receiver's underside;
    // in jet mode it squashes up into the receiver so the stowed gun rides flush under the hull.
    const FG = new THREE.Group(); FG.position.y = 0.4; R.add(FG); gunFold = FG;
    const Bf = (w, h, d, m, x, y, z, b = 0.03) => { const o = M(rbox(w, h, d, b), m, x, y - 0.4, z); FG.add(o); return o; };
    const grip = Bf(0.2, 0.88, 0.28, black, 0, 0.02, -0.04, 0.05); grip.rotation.x = 10*D;
    Bf(0.1, 0.72, 0.08, dark, 0, 0, 0.46, 0.02); Bf(0.1, 0.07, 0.62, dark, 0, -0.39, 0.19, 0.02);   // trigger guard
    Bf(0.46, 0.5, 0.9, dark, 0, 0.07, 1.2, 0.04); Bf(0.47, 0.3, 0.1, trim, 0, 0.07, 1.5, 0.01);   // ammo cassette + stripe
    Bf(0.12, 0.14, 0.06, metal, 0, 0.2, 0.72, 0.01);                      // latch
    B(0.16, 0.08, 0.7, dark, 0, 0.38, 2.9, 0.02); Bf(0.18, 0.5, 0.26, black, 0, 0.14, 2.9, 0.04);   // rail + foregrip
    B(0.22, 0.2, 0.6, dark, 0, 1.0, 1.1, 0.04); Cz(0.07, 0.07, 1.39, 1.42, 1.0, lensM, 14);      // sight + lens
    B(0.03, 0.03, 0.08, lampM, 0.115, 1.02, 0.95, 0.005);                 // indicator lamp
    B(0.02, 0.18, 0.4, black, 0.25, 0.66, 1.55, 0.005);                   // ejection port
    Cz(0.11, 0.11, -0.72, -0.6, 0.66, dark, 14);                          // recoil buffer
    B(0.12, 0.06, 0.16, metal, 0, 0.92, 1.75, 0.01); B(0.12, 0.06, 0.16, metal, 0, 0.9, -0.2, 0.01);   // lugs
  }
  const bl = part('blade');
  // Power sword: forged steel core with a dark fuller, energised edges, and a field sheath that flickers around it.
  const steelM = S({color:0xc4c9cc, roughness:0.22, metalness:0.95, envMapIntensity:1.1}), fullerM = S({color:0x24282c, roughness:0.4, metalness:0.8});
  const edgeM = new THREE.MeshBasicMaterial({color:0xd8f4ff});
  const fieldM = new THREE.MeshBasicMaterial({color:0x4fb8ff, transparent:true, opacity:0.3, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
  const arcM = new THREE.MeshBasicMaterial({color:0xbfeaff, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false});
  bl.add(M(cyl(0.16, 0.19, 1.1, 12), dark, 0, 0, 0.15)); bl.add(M(cyl(0.21, 0.21, 0.12, 12), metal, 0, 0, -0.42));            // grip + pommel
  for (const z of [-0.1, 0.15, 0.4]) bl.add(M(cyl(0.2, 0.2, 0.06, 12), metal, 0, 0, z));
  bl.add(M(fin([[0.18,0],[0.02,0.95],[-0.2,1.05],[-0.2,-1.05],[0.02,-0.95]], 0.34, 0.08), metal, 0, 0, 0.9));                    // crossguard
  const emit = M(new THREE.SphereGeometry(0.2, 14, 10), edgeM, 0, 0, 0.9); emit.scale.set(1.15, 1, 1); bl.add(emit);           // field emitter
  const bladeShape = [[0,0.3],[5.6,0.26],[6.9,0]], full = bladeShape.concat(bladeShape.slice(0, 2).reverse().map(([z, y]) => [z, -y]));
  bl.add(M(fin(full, 0.12, 0.04), steelM, 0, 0, 1.05));                                                                        // steel core
  bl.add(M(rbox(0.14, 0.14, 4.6, 0.03), fullerM, 0, 0, 3.6));
  for (const sgn of [1, -1]) { const e = M(fin([[0,0.05],[5.6,0.05],[6.95,-0.27],[5.6,-0.02],[0,-0.02]], 0.05, 0.01), edgeM, 0, sgn*0.3, 1.05); e.scale.y = sgn; bl.add(e); }   // lit edges
  const sheath = new THREE.Mesh(fin([[-0.1,0.62],[5.7,0.56],[7.5,0],[5.7,-0.56],[-0.1,-0.62]], 0.02, 0.005), fieldM); sheath.position.z = 1.0; bl.add(sheath);
  const sheath2 = new THREE.Mesh(fin([[-0.1,0.44],[5.7,0.4],[7.2,0],[5.7,-0.4],[-0.1,-0.44]], 0.3, 0.1), fieldM); sheath2.position.z = 1.0; bl.add(sheath2);
  const arcs = []; for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 4, 14), arcM); a.rotation.y = Math.PI/2; a.scale.set(0.35, 1, 1); bl.add(a); arcs.push(a); }
  const sh = part('shield');
  // Tower shield, about twice the old one: layered plate with a raised spine, rim, boss and a sighting notch.
  sh.add(M(fin([[2.3,1.9],[1.2,3.3],[-1.2,3.3],[-2.3,1.9],[-2.3,-1.9],[-1.2,-3.3],[1.2,-3.3],[2.3,-1.9]], 0.3, 0.1), hullF));
  sh.add(M(fin([[1.9,1.7],[1.0,2.85],[-1.0,2.85],[-1.9,1.7],[-1.9,-1.7],[-1.0,-2.85],[1.0,-2.85],[1.9,-1.7]], 0.18, 0.06), hull, 0.2, 0, 0));
  sh.add(M(rbox(0.2, 5.4, 0.6, 0.08), trim, 0.32, 0, 0)); sh.add(M(rbox(0.2, 0.5, 3.7, 0.08), trim, 0.3, 1.5, 0));
  const boss = M(new THREE.SphereGeometry(0.62, 20, 12), metal, 0.3, 0, 0); boss.scale.set(0.5, 1, 1); sh.add(boss);
  sh.add(M(rbox(0.36, 0.5, 1.2, 0.1), black, 0.02, 3.05, 0));
  for (const [y, z] of [[2.2, 1.5], [2.2, -1.5], [-2.2, 1.5], [-2.2, -1.5]]) sh.add(M(cyl(0.12, 0.12, 0.1, 8).rotateY(Math.PI/2), metal, 0.32, y, z));
  sh.add(M(rbox(0.3, 0.5, 1.6, 0.1), dark, -0.28, 0, 0));

  /* Landing gear (jet only): nose gear and two main gears on the body, each a pivoted leg that swings forward into its bay.
     F.setGear(true|false, instant) sets the target; the legs cycle in about 1.2 s and are hidden when stowed or out of jet mode. */
  const gearLegs = [], wheelGeo = r => new THREE.CylinderGeometry(r, r, r*0.75, 18).rotateZ(Math.PI/2);
  const tyreM = S({color:0x161616, roughness:0.9}), hubM = S({color:0x9aa0a4, roughness:0.4, metalness:0.7});
  const gearLeg = (x, y, z, len, wr, twin, door) => {
    const pv = new THREE.Group(); pv.position.set(x, y, z); P.body.add(pv);
    pv.add(M(cyl(0.11, 0.11, 0.3, 10).rotateX(Math.PI/2), dark, 0, -0.1, 0));                                 // trunnion
    const oleo = new THREE.Group(); pv.add(oleo);
    oleo.add(M(new THREE.CylinderGeometry(0.1, 0.12, len*0.62, 10), metal, 0, -len*0.31, 0));               // upper cylinder
    oleo.add(M(new THREE.CylinderGeometry(0.065, 0.065, len*0.45, 10), S({color:0xd8dcde, roughness:0.15, metalness:0.95}), 0, -len*0.75, 0));   // chrome piston
    { const brace = M(new THREE.CylinderGeometry(0.04, 0.04, len*0.7, 6), dark, 0, -len*0.38, -0.32); brace.rotation.x = -0.45; oleo.add(brace); }   // drag brace
    oleo.add(M(rbox(0.12, 0.08, 0.5, 0.02), dark, 0, -len*0.62, 0.12));                                     // torque link
    const wy = -len - wr*0.15;
    for (const s of twin ? [1, -1] : [0]) { const wx = s*wr*0.62;
      oleo.add(M(wheelGeo(wr), tyreM, wx, wy, 0)); oleo.add(M(wheelGeo(wr*0.55).scale(1.06, 1, 1), hubM, wx, wy, 0)); }
    oleo.add(M(new THREE.CylinderGeometry(0.05, 0.05, twin ? wr*2.1 : wr*0.9, 8).rotateZ(Math.PI/2), metal, 0, wy, 0));   // axle
    if (door) { const d = M(rbox(0.05, len*0.55, 0.9, 0.02), hull, door*0.2, -len*0.28, 0); oleo.add(d); }    // gear door on the leg
    pv.visible = false; gearLegs.push(pv); return pv;
  };
  gearLeg(0, -0.45, 3.05, 1.25, 0.28, true, 0);           // nose gear (twin small wheels)
  gearLeg(1.72, -0.15, -0.55, 1.5, 0.36, false, 1);       // main gears under the wing roots
  gearLeg(-1.72, -0.15, -0.55, 1.5, 0.36, false, -1);
  const F = {root, P, missiles, nozzles, feet, laserTips, footK:0, gearK:0, gearWant:0, kneeK:0, elbK:0, carryK:0, mode:'jet', t:1, from:{}, glow:glowM,
    ctl:{aimPitch:0, aimYaw:0, walk:0, walkAmt:0, block:0, swing:-1, thrust:0.3, lp:0, lr:0, lt:0}, names:Object.keys(P)};
  const TG = st.pose ? {} : TGT;   // per-frame pose overrides on top of the shared poses
  if (st.pose) for (const m in TGT) { TG[m] = Object.assign({}, TGT[m]); for (const n in st.pose[m] || {}) { const d = st.pose[m][n], rr = d.r || [0,0,0];
    TG[m][n] = {p:new V3(...d.p), q:new THREE.Quaternion().setFromEuler(E.set(rr[0]*D, rr[1]*D, rr[2]*D, 'YXZ')), s:d.s ?? 1}; } }
  for (const n of F.names) { const t = TG.jet[n]; P[n].position.copy(t.p); P[n].quaternion.copy(t.q); P[n].scale.setScalar(t.s); }

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qx = new THREE.Quaternion(), v = new V3(), v2 = new V3(), X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1), ql = new THREE.Quaternion(), qt = new THREE.Quaternion(), ANK = new V3(0, 0, -5.7), UPPER = ['body', 'nose', 'wingL', 'wingR', 'armL', 'armR', 'head'], qu = new THREE.Quaternion(), qf = new THREE.Quaternion(), qg = new THREE.Quaternion(), vs = new V3();
  F.setMode = (m, instant) => {
    F.mode = m; F.t = instant ? 1 : 0;
    for (const n of F.names) F.from[n] = {p:P[n].position.clone(), q:P[n].quaternion.clone(), s:P[n].scale.x};
    if (instant) F.update(0);
  };
  F.update = dt => {
    F.t = Math.min(1, F.t + dt/0.7);
    { const want = F.mode === 'jet' ? 0 : 1; F.footK += Math.sign(want - F.footK)*Math.min(Math.abs(want - F.footK), dt ? dt/0.5 : 1);
      if (gunFold) gunFold.scale.y = Math.max(0.04, F.footK);
      { const want = F.mode === 'jet' && F.t >= 1 ? F.gearWant : 0, d = want - F.gearK; F.gearK += Math.sign(d)*Math.min(Math.abs(d), dt ? dt/1.2 : 1);
        const gk = F.gearK*F.gearK*(3 - 2*F.gearK);
        for (let i = 0; i < gearLegs.length; i++) { const g = gearLegs[i]; g.visible = F.gearK > 0.01; g.rotation.x = (1 - gk)*(i ? 1.55 : -1.6); g.scale.setScalar(0.6 + 0.4*gk); } }
      const k = F.footK*F.footK*(3 - 2*F.footK); for (const f of feet) { f.visible = k > 0.03; f.scale.set(0.8 + 0.2*k, Math.max(0.03, k), 1); } }
    const t = F.t, e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2, Tg = TG[F.mode];
    for (const n of F.names) {
      const p = P[n], to = Tg[n], fr = F.from[n];
      if (t >= 1 || !fr) { p.position.copy(to.p); p.quaternion.copy(to.q); p.scale.setScalar(to.s); }
      else { p.position.lerpVectors(fr.p, to.p, e); p.quaternion.slerpQuaternions(fr.q, to.q, e); p.scale.setScalar(fr.s + (to.s - fr.s)*e); }
    }
    if (F.mode === 'jet' && F.gearK > 0) P.gunpod.position.z -= 2.4*F.gearK*F.gearK*(3 - 2*F.gearK);   // stowed gun slides aft between the nacelles, clear of the nose gear
    const c = F.ctl, w = F.mode === 'jet' ? 0 : e, wm = F.mode === 'mech' ? e : 0;
    // Rifle carry: after ~1.5 s without firing or a target (c.ready is a countdown the pilot code tops up), the gun arm relaxes to a muzzle-up high-ready.
    c.ready = Math.max(0, (c.ready || 0) - (dt || 0));
    { const want = F.mode === 'mech' && !(c.ready > 0) && !(c.wpn > 0.02) && !(c.swing >= 0) ? 1 : 0, d = want - F.carryK;
      F.carryK = dt ? F.carryK + Math.max(-dt/0.16, Math.min(dt/0.6, d)) : want; }
    const cK = F.carryK*F.carryK*(3 - 2*F.carryK);
    // Standing weight: shoulders turned a touch toward the gun side, slow breathing; fades out as the stride picks up. The whole frame sits down into the bent knees.
    if (wm > 0) { const idle = wm*(1 - Math.min(1, c.walkAmt*2)), bt = F.bt || 0, tw = (-0.075 + Math.sin(bt*0.7)*0.012)*idle, br = Math.sin(bt*1.5)*0.035*idle;
      qt.setFromAxisAngle(Y, tw);
      for (const n of UPPER) { const p = P[n]; p.position.applyQuaternion(qt); p.position.y += n === 'head' ? br*1.25 : br; if (n !== 'head') p.quaternion.premultiply(qt); }
      for (const n of F.names) P[n].position.y -= SIT*wm; }
    if (w > 0) {
      // One weapon hand (the right): it holds the gun pod or the sword, never both. c.wpn 0 = gun out, 1 = sword out.
      E.set(-c.aimPitch, c.aimYaw, 0, 'YXZ'); qa.setFromEuler(E);
      const mech = F.mode === 'mech', wp = mech ? Math.min(1, Math.max(0, c.wpn || 0)) : 0, kS = wp*wp*(3 - 2*wp);
      // Gun pose: the forearm stays on the aim line, the upper arm hangs lower and the elbow takes up the difference.
      // In hover the arms hang from under the wing roots: upper arms down and forward, forearms bent back level, so the rifle rides under the nose.
      const hov = F.mode === 'hover', bR = hov ? 62*D : 0.5*F.elbK; qx.setFromAxisAngle(X, bR); qu.copy(qa).multiply(qx);
      let foreR = -bR, bL = hov ? -48*D : -0.75*F.elbK, wrist = 0; c.twist = 0;
      if (cK > 0) {   // high-ready carry: upper arm down and slightly out, elbow folded, wrist cocked so the barrel stands upright beside the head
        E.set(82*D - Math.sin(c.walk)*0.1*c.walkAmt, -16*D, 0, 'YXZ'); qb.setFromEuler(E); qu.slerp(qb, cK);
        foreR += (-126*D*F.elbK - foreR)*cK; wrist = -38*D*cK; }
      if (mech) {
        // Sword pose: elbow cocked at rest, snapping straight through a big diagonal slash.
        let ax = 48*D - Math.sin(c.walk)*0.3*c.walkAmt, ay = 0, az = 0, sw = 0;
        if (c.swing >= 0) {
          // Combo: cut 1 is the diagonal, cut 2 the mirrored backhand, cut 3 the overhead.
          const s = c.swing, SW = c.combo === 2 ? SWING_O : SWING, mr = c.combo === 1 ? -1 : 1; let a = SW[0], b = SW[1];
          for (let i = 0; i < SW.length - 1; i++) if (s >= SW[i].t && s <= SW[i + 1].t) { a = SW[i]; b = SW[i + 1]; break; }
          const u = Math.min(1, Math.max(0, (s - a.t)/(b.t - a.t))), k = b.ease(u);
          ax = (a.ax + (b.ax - a.ax)*k)*D; ay = -mr*(a.ay + (b.ay - a.ay)*k)*D; az = -mr*(a.az + (b.az - a.az)*k)*D; c.twist = -mr*(a.tw + (b.tw - a.tw)*k);
          sw = Math.min(1, s/0.3)*(1 - Math.max(0, (s - 0.72)/0.28));
        }
        E.set(ax, ay, az, 'YXZ'); qb.setFromEuler(E);
        qu.slerp(qb, kS); foreR += (-0.75*(1 - sw)*F.elbK - foreR)*kS;
      }
      // Swing the gun arm out from the torso so the upper arm and elbow clear the body (less while slashing).
      if (mech) { const ab = (13 - 9*(c.swing >= 0 ? 1 : 0))*D; qx.setFromAxisAngle(Z, -ab); qu.premultiply(qx); }
      else if (hov) { qx.setFromAxisAngle(Z, -12*D); qu.premultiply(qx); }   // hover: gun arm swung out clear of the thigh
      P.armR.quaternion.slerp(qu, w); fores.armR.rotation.x = foreR;
      qx.setFromAxisAngle(X, foreR); qf.copy(P.armR.quaternion).multiply(qx);                 // forearm frame
      v.set(0, 0, ELB).applyQuaternion(P.armR.quaternion).add(P.armR.position);                // elbow
      // Gun pod: in the hand, or holstered muzzle-down on the right hip while the sword is out.
      v2.set(0, 0, 3.62 - ELB).applyQuaternion(qf).add(v); qg.copy(qf); if (wrist) { qx.setFromAxisAngle(X, wrist); qg.multiply(qx); }
      if (kS > 0) { vs.set(-1.8, 2.7, -0.5); v2.lerp(vs, kS); qx.setFromAxisAngle(X, 92*D); qg.slerp(qx, kS); }
      P.gunpod.position.lerp(v2, w); P.gunpod.quaternion.slerp(qg, w);
      if (mech) {
        // Sword: just a hilt on the left hip until it is drawn into the hand and the blade extends.
        v2.set(0, 0, 3.4 - ELB).applyQuaternion(qf).add(v); vs.set(1.3, 2.9, -0.8).lerp(v2, kS);
        P.blade.position.lerp(vs, w); qx.setFromAxisAngle(X, -83*D); qg.copy(qf).multiply(qx); P.blade.quaternion.slerp(qg, w);
        P.blade.scale.setScalar(Math.max(0.01, kS*w));
        // Shield arm (left): tucks in across the body when blocking.
        // At rest it hangs a little out from the body with a relaxed elbow; the shield stays upright on the forearm.
        let lx = 76*D + Math.sin(c.walk)*0.3*c.walkAmt, ly = 7*D;
        if (c.block > 0) { lx += (5*D - lx)*c.block; ly += (-55*D - ly)*c.block; }
        E.set(lx, ly, 0, 'YXZ'); qb.setFromEuler(E); qx.setFromAxisAngle(Z, 15*D*(1 - c.block)); qb.premultiply(qx); P.armL.quaternion.slerp(qb, w);
        bL = (-0.32 - 0.78*c.block)*F.elbK;
        qx.setFromAxisAngle(X, bL); qf.copy(P.armL.quaternion).multiply(qx);
        v.set(0, 0, ELB).applyQuaternion(P.armL.quaternion).add(P.armL.position);
        v2.set(1.0, 0, 2.5 - ELB).applyQuaternion(qf).add(v);
        qx.setFromAxisAngle(X, -52*D*(1 - c.block)); qg.copy(qf).multiply(qx);
        P.shield.position.lerp(v2, w); P.shield.quaternion.slerp(qg, w);
        { const b = Math.min(1, Math.max(0, (c.block - 0.15)/0.6)); F.shieldK = b*b*(3 - 2*b); }
      }
      // Legs: an A-frame stance from the hips (splayed, toes out, thighs forward over bent knees) with the feet rolled back flat on the ground.
      [P.legL, P.legR].forEach((lg, i) => { const s = i ? -1 : 1, foot = feet[i];
        if (wm > 0) { const phi = -s*0.135*wm, psi = s*0.24*(1 - 0.75*Math.min(1, c.walkAmt))*wm, a = Math.min(F.kneeK, 0.32)*0.5*wm;
          ql.setFromAxisAngle(Y, phi); qx.setFromAxisAngle(Z, psi); ql.multiply(qx); qt.copy(qx);
          qx.setFromAxisAngle(X, -a); ql.multiply(qx); lg.quaternion.multiply(ql);
          qx.setFromAxisAngle(X, Math.min(F.kneeK, 0.32)*wm); ql.multiply(qx); ql.invert().multiply(qt);   // undo splay + shin lean at the ankle, keep the toe-out
          foot.quaternion.copy(ql); foot.position.copy(ANK).applyQuaternion(ql).negate().add(ANK);
          if (c.walkAmt > 0.01) { qx.setFromAxisAngle(X, s*Math.sin(c.walk)*0.5*c.walkAmt); lg.quaternion.multiply(qx); }
        } else { foot.quaternion.set(0, 0, 0, 1); foot.position.set(0, 0, 0); } });
      fores.armL.rotation.x = bL;
    } else { fores.armL.rotation.x = 0; fores.armR.rotation.x = 0; }
    // Hover: legs act as vectored thrust. lp = fore/aft push, lr = sideways push, lt = yaw (differential).
    if (F.mode === 'hover' && w > 0) {
      const th = -120*D + c.lp*0.45, ph = c.lr*0.35, sp = 0.2;   // thighs thrown forward and splayed; the knees bring the nozzles back under
      E2.set(th + c.lt*0.22, 0, ph + sp, 'ZYX'); qa.setFromEuler(E2); P.legL.quaternion.slerp(qa, w);
      E2.set(th - c.lt*0.22, 0, ph - sp, 'ZYX'); qa.setFromEuler(E2); P.legR.quaternion.slerp(qa, w);
    }
    // Knees: deep bend in hover, a slight flex standing, and a lift on each stride when walking.
    { const sm = dt ? Math.min(1, dt*6) : 1, kt = F.mode === 'hover' ? 1.0 : F.mode === 'mech' ? 0.3 : 0;
      F.kneeK += (kt - F.kneeK)*sm; F.elbK += ((F.mode === 'jet' ? 0 : 1) - F.elbK)*sm;
      const st = F.mode === 'mech' ? Math.sin(c.walk)*0.6*c.walkAmt : 0;
      knees.legL.rotation.x = F.kneeK + Math.max(0, st); knees.legR.rotation.x = F.kneeK + Math.max(0, -st); }
    { F.bt = (F.bt || 0) + (dt || 0); const hot = c.swing >= 0 ? 1 : 0, fl = 0.5 + 0.5*Math.sin(F.bt*23) * Math.sin(F.bt*7.3);
      fieldM.opacity = 0.2 + 0.08*fl + 0.3*hot; sheath.scale.y = 1 + 0.06*fl + 0.25*hot;
      arcs.forEach((a, i) => { const u = (F.bt*(1.3 + i*0.37) + i*0.27) % 1; a.position.z = 1.3 + u*6.0; const k = (1 - u*0.75)*(1 + 0.4*hot); a.scale.set(0.35, k, k); a.rotation.x = F.bt*9 + i; a.visible = ((F.bt*11 + i*1.7) % 1) < 0.6; }); }
    const g = 0.75 + c.thrust*0.45;
    for (const n of nozzles) n.scale.set(g, g, 0.15 + c.thrust*2.2);
    glowM.opacity = 0.08 + c.thrust*0.6;
  };
  F.setGear = (down, instant) => { F.gearWant = down ? 1 : 0; if (instant) F.gearK = F.gearWant; };
  F.setMissiles = frac => { const k = Math.round(frac*missiles.length); missiles.forEach((m, i) => m.visible = i < k); };
  F.cockpit = on => {
    const hide = ['body', 'nose', 'wingL', 'wingR', 'legL', 'legR', 'head'];
    for (const n of F.names) P[n].visible = !on || !hide.includes(n);
    if (on && F.mode === 'jet') for (const n of F.names) P[n].visible = false;
  };
  F.world = (n, x, y, z, out) => (out || new V3()).set(x, y, z).applyMatrix4(P[n].matrixWorld);
  return F;
};

G.geo = {lathe, rbox, plate, fin, cyl, M};

/* ---------- Reflection environment ---------- */
G.makeEnv = function(renderer){
  const s = new THREE.Scene(), g = new THREE.SphereGeometry(50, 32, 16), cols = [], c = new THREE.Color();
  const top = new THREE.Color(0xa9c2d8), mid = new THREE.Color(0x707b82), low = new THREE.Color(0x26241f), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i)/50; if (t > 0) c.copy(mid).lerp(top, Math.pow(t, 0.6)); else c.copy(mid).lerp(low, Math.min(1, -t*3)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide})));
  const lamp = new THREE.MeshBasicMaterial({color:0xffffff});
  for (const [x, y, z, w, h] of [[0, 40, 0, 30, 8], [30, 20, 20, 6, 20], [-30, 18, -20, 6, 16]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lamp); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); }
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.02).texture; pm.dispose();
  return tex;
};
})();
