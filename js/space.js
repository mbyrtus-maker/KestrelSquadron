(function(){
'use strict';
/* ==========================================================================================================
   Volume 4: Space. A space world (no terrain or sea: a starfield, a planet far below and hard sunlight), the Varn
   orbital station "Tessaract" with a walkable hangar inside (artificial gravity), its reactor core and the escape
   countdown, and the Varn battlecruiser "Dominance" (the volume's last boss).
   ========================================================================================================== */
const G = window.G, V3 = THREE.Vector3;
const SV = new V3(), SV2 = new V3(), SV3 = new V3();

/* The station: a hexagonal hub with a hollow hangar inside. Seen from above the hub is a regular hexagon with flat faces
   toward ±z; its mouth opens in the -z face (toward where pilots arrive). hd (= hw) is the cavity's apothem: the distance
   from the centre to each of the six inner walls. Walls, floor slab and roof are t thick. The cavity runs from the floor
   (cy - hh) to the ceiling (cy + hh). The deck sits at y = 2 so walkers treat it as dry land (and the open space around it,
   at -900, as somewhere they cannot step). */
const ST = G.STATION = {x:0, y:62, z:1400, hw:240, hh:60, hd:240, t:22, mw:80, mh:64, hex:true};
ST.floor = ST.y - ST.hh;
const HEXN = [0, 1, 2, 3, 4, 5].map(k => [Math.sin(k*Math.PI/3), Math.cos(k*Math.PI/3)]);   // outward normals of the six walls (index 3 is the mouth face)
// "Hex radius" of a point (station-local x, z): the apothem of the hexagon it lies on. Inside the cavity it is < hd.
const hexd = G.stationHex = (lx, lz) => Math.max(Math.abs(lz), 0.8660254037844386*Math.abs(lx) + 0.5*Math.abs(lz));
G.inStation = (p, m = 0) => hexd(p.x - ST.x, p.z - ST.z) < ST.hd - m && p.y > ST.floor - 2 && p.y < ST.y + ST.hh - m;
// Pull a point back inside the cavity's footprint, m metres clear of the six walls.
G.stationClamp = (p, m = 0) => {
  let lx = p.x - ST.x, lz = p.z - ST.z, moved = false; const lim = ST.hd - m;
  for (let pass = 0; pass < 3; pass++) for (const [nx, nz] of HEXN) { const d = lx*nx + lz*nz - lim; if (d > 1e-6) { lx -= nx*d; lz -= nz*d; moved = true; } }
  if (moved) { p.x = ST.x + lx; p.z = ST.z + lz; } return moved;
};
// Solid parts of the station (six walls, roof, floor slab) plus interior pillars.
const PILLARS = [[-120, 60], [120, 60], [-120, -80], [120, -80]];   // x, z offsets from the centre; 16 m square, floor to ceiling
G.stationSolid = (p, r = 0) => {
  if (!G.stationLive) return false;
  const lx = p.x - ST.x, ly = p.y - ST.y, lz = p.z - ST.z, hx = hexd(lx, lz);
  if (hx > ST.hd + ST.t + r || Math.abs(ly) > ST.hh + ST.t + r) return false;                       // outside the hull
  const inCav = hx < ST.hd - r && ly > -ST.hh + r && ly < ST.hh - r;
  const inMouth = lz < 0 && Math.abs(lx) < ST.mw - r && ly > -ST.hh + r && ly < -ST.hh + ST.mh - r;  // the tunnel through the -z wall
  if (inMouth) return false;
  if (inCav) { for (const [px, pz] of PILLARS) if (Math.abs(lx - px) < 8 + r && Math.abs(lz - pz) < 8 + r) return true; return false; }
  return true;
};
// Push a point out of the station's solid parts; returns true if it moved.
G.stationPush = (p, r) => {
  if (!G.stationSolid(p, r)) return false;
  let lx = p.x - ST.x, ly = p.y - ST.y, lz = p.z - ST.z; const A = ST.hd, hx = hexd(lx, lz), my = -ST.hh + ST.mh;
  const put = () => { p.x = ST.x + lx; p.y = ST.y + ly; p.z = ST.z + lz; return true; };
  // In the mouth tunnel (or just outside it), brushing its sides, lintel or sill: slide back toward the middle of the opening.
  if (lz < 0 && hx >= A && Math.abs(lx) < ST.mw && ly > -ST.hh && ly < my) {
    if (Math.abs(lx) > ST.mw - r) lx = Math.sign(lx)*(ST.mw - r);
    ly = Math.max(-ST.hh + r, Math.min(my - r, ly)); return put();
  }
  // Inside the cavity: we're in a pillar, or poking into the walls, floor or roof from inside.
  if (hx < A && Math.abs(ly) < ST.hh) {
    for (const [px, pz] of PILLARS) { const dx = lx - px, dz = lz - pz;
      if (Math.abs(dx) < 8 + r && Math.abs(dz) < 8 + r) { const qx = 8 + r - Math.abs(dx), qz = 8 + r - Math.abs(dz); if (qx < qz) p.x += Math.sign(dx || 1)*qx; else p.z += Math.sign(dz || 1)*qz; p.y = ST.y + Math.max(-ST.hh + r, Math.min(ST.hh - r, ly)); return true; } }
    const lim = A - r;   // every wall we are too close to pushes back along its own normal (so corners hold)
    for (let pass = 0; pass < 3; pass++) for (const [nx, nz] of HEXN) { const d = lx*nx + lz*nz - lim; if (d > 0) { lx -= nx*d; lz -= nz*d; } }
    ly = Math.max(-ST.hh + r, Math.min(ST.hh - r, ly)); return put();
  }
  // Outside (or inside the hull's own thickness): out through the nearest outer face.
  const o = A + ST.t + r, oy = ST.hh + ST.t + r; let best = oy - ly, bx = 0, by = 1, bz = 0;
  if (oy + ly < best) { best = oy + ly; by = -1; }
  for (const [nx, nz] of HEXN) { const d = o - (lx*nx + lz*nz); if (d < best) { best = d; bx = nx; by = 0; bz = nz; } }
  lx += bx*best; ly += by*best; lz += bz*best; return put();
};

/* ---------- Space world ---------- */
function planetTexture(seed){
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'), n = G.Noise(seed), img = x.createImageData(1024, 512), d = img.data;
  for (let j = 0; j < 512; j++) for (let i = 0; i < 1024; i++) {
    const lon = i/1024*Math.PI*2, lat = (j/512 - 0.5)*Math.PI, cx = Math.cos(lat)*Math.cos(lon), cy = Math.sin(lat), cz = Math.cos(lat)*Math.sin(lon);
    const h = n(cx*2.2 + 5, cz*2.2 + cy*1.3, 5), cl = n(cx*5 + 40, cz*5 - cy*4, 4), ice = Math.abs(cy) > 0.86;
    let r, g, b;
    if (ice) { r = 225; g = 232; b = 240; }
    else if (h > 0.08) { const k = Math.min(1, (h - 0.08)*3); r = 70 + 60*k; g = 98 + 30*k; b = 52 + 20*k; }
    else { const k = Math.max(0, Math.min(1, (h + 0.4)*1.6)); r = 14 + 18*k; g = 46 + 40*k; b = 92 + 60*k; }
    const cw = Math.max(0, Math.min(1, (cl - 0.05)*2.2)); r += (240 - r)*cw*0.85; g += (244 - g)*cw*0.85; b += (248 - b)*cw*0.85;
    const o = (j*1024 + i)*4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
/* ---------- Hull kit: procedural panel textures (colour, normal and lit-window maps), a geometry batcher that merges
   every part sharing a material into one mesh (with world-scale box-projected UVs), and a flat-shaded loft. ---------- */
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
    else if (t < 0.53) { a.fillStyle = gr(v*0.6); a.fillRect(x + gp, y + gp, w - 2*gp, hh - 2*gp); }
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
function hazardTex(){
  if (TEXC.haz) return TEXC.haz;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#15161a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d8a41c';
  for (let k = -64; k < 128; k += 32) { x.beginPath(); x.moveTo(k, 64); x.lineTo(k + 16, 64); x.lineTo(k + 80, 0); x.lineTo(k + 64, 0); x.closePath(); x.fill(); }
  return TEXC.haz = canvasTex(c);
}
function solarTex(){
  if (TEXC.sol) return TEXC.sol;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#7d8798'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const gd = x.createLinearGradient(i*32, j*32, i*32 + 32, j*32 + 32); gd.addColorStop(0, '#16296a'); gd.addColorStop(1, '#0a1436'); x.fillStyle = gd; x.fillRect(i*32 + 1.5, j*32 + 1.5, 29, 29);
    x.fillStyle = 'rgba(140,170,255,0.18)'; x.fillRect(i*32 + 15.5, j*32 + 2, 1, 28); }
  return TEXC.sol = canvasTex(c);
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

G.SpaceWorld = class {
  constructor(scene, opts = {}){
    this.scene = scene; this.space = true; this.floor = -900; this.flats = []; this.hi = G.gfx && G.gfx.hi(); this.S = 18000;
    scene.fog = null; scene.background = new THREE.Color(0x02030a);
    // Stars: a few thousand points on a far sphere, a band of them denser (the galaxy).
    const N = 5200, pos = new Float32Array(N*3), col = new Float32Array(N*3); let s = (opts.seed || 7) % 2147483647 || 7; const R = () => (s = (s*16807) % 2147483647)/2147483647;
    for (let i = 0; i < N; i++) {
      let x = R()*2 - 1, y = R()*2 - 1, z = R()*2 - 1; if (i < N*0.4) y *= 0.15; const l = Math.hypot(x, y, z) || 1;
      pos[i*3] = x/l*15000; pos[i*3 + 1] = y/l*15000; pos[i*3 + 2] = z/l*15000;
      const w = 0.55 + R()*0.45, tint = R(); col[i*3] = w*(tint < 0.15 ? 0.8 : 1); col[i*3 + 1] = w*(tint > 0.85 ? 0.85 : 0.95); col[i*3 + 2] = w*(tint < 0.15 ? 1 : 0.92);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({size:1.6, sizeAttenuation:false, vertexColors:true, fog:false, depthWrite:false}));
    stars.renderOrder = -2; scene.add(stars); this.sky = stars;
    // The planet: a big sphere far below with continents, ice caps and cloud, and a thin glowing rim of atmosphere.
    const PR = 9000, pc = new V3(0, -15500, 5000);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 96, 48), new THREE.MeshStandardMaterial({map:planetTexture(opts.seed || 3), roughness:0.85, metalness:0, fog:false}));
    planet.position.copy(pc); planet.rotation.set(0.4, 1.1, 0.2); scene.add(planet); this.planet = planet;
    const atm = new THREE.Mesh(new THREE.SphereGeometry(PR*1.035, 64, 32), new THREE.ShaderMaterial({transparent:true, depthWrite:false, side:THREE.BackSide, blending:THREE.AdditiveBlending, fog:false,
      uniforms:{c:{value:new THREE.Color(0x4aa8ff)}}, vertexShader:'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader:'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(c*f*1.6, f); }'}));
    atm.position.copy(pc); scene.add(atm);
    // Hard sunlight, a faint fill from the planet, and the sun itself.
    this.sunDir = new V3(0.55, 0.42, -0.72).normalize();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(380, 32), new THREE.MeshBasicMaterial({color:0xfff6e6, fog:false})); disc.position.copy(this.sunDir).multiplyScalar(14500); disc.lookAt(0, 0, 0); scene.add(disc);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1400, 32), new THREE.MeshBasicMaterial({color:0xffe0b0, transparent:true, opacity:0.14, fog:false, depthWrite:false, blending:THREE.AdditiveBlending}));
    glow.position.copy(this.sunDir).multiplyScalar(14400); glow.lookAt(0, 0, 0); scene.add(glow);
    scene.add(new THREE.HemisphereLight(0x8fb4e0, 0x0b0d14, 0.32));
    const d = this.sun = new THREE.DirectionalLight(0xfff4e4, 1.65);
    d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
    const sc = d.shadow.camera; sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.near = 20; sc.far = 2000; d.shadow.bias = -0.0004; d.shadow.normalBias = 0.5;
    scene.add(d); scene.add(d.target);
    if (opts.station) this.buildStation(scene);
  }
  raw(){ return this.floor; } flatW(){ return 0; } shape(){ return this.floor; }
  // "Ground" is the station's deck inside its footprint, and a far-off floor everywhere else (the edge of the battle space).
  height(x, z){ if (this.station && G.stationLive && hexd(x - ST.x, z - ST.z) < ST.hd) return ST.floor; return this.floor; }
  slope(){ return 0; }
  addBlocker(b){ return b; } roof(){ return -1e9; }
  pushOut(pos, rad){ return G.stationPush(pos, rad); }
  los(a, b){
    if (!G.stationLive) return true;
    const d = a.distanceTo(b), n = Math.ceil(d/12);
    for (let i = 1; i < n; i++) { SV3.lerpVectors(a, b, i/n); if (G.stationSolid(SV3)) return false; }
    return true;
  }
  follow(p){
    const tx = 600/2048, q = this.snapP || (this.snapP = new V3());
    q.set(Math.round(p.x/tx)*tx, Math.round(p.y/tx)*tx, Math.round(p.z/tx)*tx);
    this.sun.position.copy(q).addScaledVector(this.sunDir, 1000); this.sun.target.position.copy(q); this.sun.target.updateMatrixWorld();
  }
  buildStation(scene){
    const g = new THREE.Group(); g.position.set(ST.x, ST.y, ST.z); scene.add(g); this.station = g; G.stationLive = true;
    const ps = panelSet('hull', 5, {win:0.2, cells:1, depth:7}), dk = panelSet('deck', 9, {size:512, cells:4, depth:1, min:60, vary:22, dots:true, base:170, bump:2.4});
    const std = (o, uv) => { const m = new THREE.MeshStandardMaterial(o); if (uv) m.userData.uv = uv; return m; }, basic = c => new THREE.MeshBasicMaterial({color:c});
    const hullM = std({color:0x666c75, map:ps.map, normalMap:ps.normalMap, emissive:0xffffff, emissiveMap:ps.emissiveMap, emissiveIntensity:0.9, roughness:0.68, metalness:0.3});
    const plateM = std({color:0x5b6169, map:ps.map, normalMap:ps.normalMap, roughness:0.7, metalness:0.3});
    const darkM = std({color:0x32363d, map:ps.map, normalMap:ps.normalMap, roughness:0.7, metalness:0.35});
    const trimM = std({color:0x1c1f24, roughness:0.6, metalness:0.5}), redM = std({color:0xa02c23, normalMap:ps.normalMap, roughness:0.55, metalness:0.35});
    const inM = std({color:0x747a84, map:ps.map, normalMap:ps.normalMap, roughness:0.7, metalness:0.35}, 1/72);
    const floorM = std({color:0x6a707a, map:dk.map, normalMap:dk.normalMap, roughness:0.68, metalness:0.4}, 1/24);
    const paintY = std({color:0xc9981c, roughness:0.8, metalness:0.1}), paintW = std({color:0xb9bdc2, roughness:0.8, metalness:0.1});
    const hazM = std({map:hazardTex(), roughness:0.7, metalness:0.2}, 1/6);
    const solarM = std({color:0xffffff, map:solarTex(), emissive:0x081230, roughness:0.25, metalness:0.7}, 1/20);
    const lampM = basic(0xffe6b0), redLamp = this.alarmM = basic(0xff3a2a), cyanM = basic(0x6fe3ff), winM = basic(0xffd9a0), hotM = basic(0xff8a3a), emberM = basic(0xa8481c);
    // The hub is a hexagonal prism: A is the cavity's apothem (flat faces toward ±z, the mouth in the -z face), O the outer hull's.
    const A = ST.hd, H = ST.hh, T = ST.t, O = A + T, Y1 = H + T, PI = Math.PI, R = rng(4127), T30 = Math.tan(PI/6), C30 = Math.cos(PI/6), RO = O/C30, RI = A/C30, LO = 2*O*T30, LI = 2*A*T30;
    const B = new Batch();
    const box = (w, h, d, m, x, y, z, ry = 0, rx = 0, rz = 0) => B.add(m, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
    const pr = (rt, rb, h, seg, m, x, y, z) => B.add(m, flat(new THREE.CylinderGeometry(rt, rb, h, seg)), x, y, z, 0, PI/seg, 0);         // upright prism / frustum with a flat side facing ±z
    const band = (r, h, seg, m, x, y, z) => B.add(m, new THREE.CylinderGeometry(r, r, h, seg, 1, true), x, y, z, 0, PI/seg, 0);
    const tube = (r, len, m, x, y, z, ax, seg = 14) => B.add(m, new THREE.CylinderGeometry(r, r, len, seg), x, y, z, ax === 'z' ? PI/2 : 0, 0, ax === 'x' ? PI/2 : 0);
    const disc = (r, m, x, y, z, rx, ry = 0) => B.add(m, new THREE.CircleGeometry(r, 24), x, y, z, rx, ry, 0);
    // face frame: b is the face's outward bearing (0 = +z, PI = the mouth face), r the distance out from the centre, t the offset along the face
    const rp = (b, r, t) => [Math.sin(b)*r + Math.cos(b)*t, Math.cos(b)*r - Math.sin(b)*t];
    const rbox = (w, h, d, m, b, r, t, y, rx = 0) => { const [x, z] = rp(b, r, t); box(w, h, d, m, x, y, z, b, rx); };
    const fp = (b, t, y, r) => { const [x, z] = rp(b, r, t); return [x, y, z]; };
    const FACES = [0, 1, 2, 3, 4, 5].map(k => k*PI/3), VERTS = FACES.map(b => b + PI/6), FRONT = 3;

    /* ---- the hull: hexagonal floor slab and roof, six walls, the front one in three pieces around the mouth (the collision contract) ---- */
    pr(RO, RO, T, 6, plateM, 0, -H - T/2, 0); pr(RO, RO, T, 6, plateM, 0, H + T/2, 0);
    FACES.forEach((b, k) => { if (k !== FRONT) rbox(LO, 2*H, T, hullM, b, A + T/2, 0, 0); });
    for (const s of [-1, 1]) box(LO/2 - ST.mw, 2*H, T, hullM, s*(LO/2 + ST.mw)/2, 0, -A - T/2);
    box(2*ST.mw, 2*H - ST.mh, T, hullM, 0, -H + ST.mh + (2*H - ST.mh)/2, -A - T/2);

    /* ---- exterior ---- */
    // heavy edge beams and corner posts, buttress ribs, an armour belt with a red line, window strips, and a battered skirt round the foot
    FACES.forEach((b, k) => {
      for (const sy of [-1, 1]) rbox(LO + 6, 8, 8, trimM, b, O, 0, sy*Y1);
      const [vx, vz] = rp(VERTS[k], RO, 0); box(10, 2*Y1, 10, trimM, vx, 0, vz, VERTS[k]);
      const sk = (t0, t1) => B.add(darkM, loft([t0, t1].map(q => [fp(b, q*O, -Y1 - 4, O), fp(b, q*(O + 18), -Y1 - 4, O + 18), fp(b, q*(O + 18), -Y1 + 6, O + 18), fp(b, q*O, -42, O)])));
      if (k === FRONT) { sk(-T30, -136/O); sk(136/O, T30); return; }
      sk(-T30, T30);
      for (const t of [-120, -60, 0, 60, 120]) for (const y of [-34, 44]) rbox(42, 2.2, 0.8, winM, b, O + 0.5, t, y);
      if (k === 0) return;
      for (const t of [-90, -30, 30, 90]) rbox(7, 2*Y1 - 8, 5, darkM, b, O + 2, t, 0);
      rbox(LO - 12, 22, 3, darkM, b, O + 1, 0, 8); rbox(LO - 12, 1.6, 1, redM, b, O + 2.6, 0, 8);
      if (k === 2 || k === 4) {   // a tall Varn-red banner plate on the two faces flanking the mouth
        rbox(38, 100, 1.4, redM, b, O + 3.2, 0, 12); for (const y of [64, -40]) rbox(42, 4, 2.4, trimM, b, O + 3.6, 0, y);
        for (let i = 0; i < 3; i++) rbox(22 - i*6, 3, 0.6, trimM, b, O + 4, 0, 40 - i*9); rbox(3, 44, 0.6, trimM, b, O + 4, 0, -8);
      } else for (const t of [-70, 70]) {   // tank farm on the two rear flanks
        const at = (dr, dt) => rp(b, O + dr, t + dt); let q = at(15, 0); B.add(plateM, new THREE.CylinderGeometry(15, 15, 96, 16), q[0], -18, q[1], 0, b, PI/2);
        for (const dt of [-48, 48]) { q = at(15, dt); B.add(plateM, new THREE.SphereGeometry(15, 16, 8), q[0], -18, q[1]); }
        for (const dt of [-30, 30]) { q = at(15, dt); B.add(trimM, new THREE.CylinderGeometry(15.8, 15.8, 4, 16), q[0], -18, q[1], 0, b, PI/2); } rbox(5, 5, 14, trimM, b, O + 6, t, -18); }
    });
    for (const s of [-1, 1]) {   // the mouth face: ribs and a narrower banner each side of the portal
      for (const x of [99, 145]) box(6, 2*Y1 - 8, 5, darkM, s*x, 0, -O - 2);
      box(32, 86, 1.4, redM, s*122, 17, -O - 0.7); for (const y of [62, -28]) box(36, 4, 2.4, trimM, s*122, y, -O - 1.2);
      for (let i = 0; i < 3; i++) box(20 - i*5, 3, 0.6, trimM, s*122, 44 - i*8, -O - 1.5); box(3, 38, 0.6, trimM, s*122, 2, -O - 1.5);
    }
    // three reactor exhaust vents on the back wall
    for (const x of [-92, 0, 92]) { B.add(trimM, flat(new THREE.CylinderGeometry(34, 40, 14, 12)), x, -22, O + 7, PI/2, 0, 0); disc(29, emberM, x, -22, O + 14.2, 0, 0);
      for (let i = -2; i <= 2; i++) box(Math.sqrt(29*29 - i*i*100)*2, 2.4, 2, trimM, x, -22 + i*10, O + 14.6); B.add(hotM, new THREE.TorusGeometry(31, 0.8, 6, 32), x, -22, O + 14.3); }

    // roof: a stepped hexagonal citadel with a command tower, radiator bank, mast and dome; a pad at each corner (four carry the defence turrets)
    pr(170, 190, 12, 6, plateM, 0, Y1 + 6, 0); pr(118, 118, 20, 6, hullM, 0, Y1 + 22, 30); pr(108, 118, 4, 6, trimM, 0, Y1 + 34, 30); band(118.4, 1.6, 6, winM, 0, Y1 + 24, 30);
    pr(56, 62, 44, 6, hullM, 0, Y1 + 58, 30); pr(68, 56, 6, 6, darkM, 0, Y1 + 83, 30); pr(68, 68, 10, 6, hullM, 0, Y1 + 91, 30); pr(42, 68, 8, 6, darkM, 0, Y1 + 100, 30);
    band(68.4, 2, 6, winM, 0, Y1 + 92, 30); B.add(redM, flat(new THREE.CylinderGeometry(58.6, 59, 3, 6)), 0, Y1 + 62, 30, 0, PI/6, 0);
    for (const a of VERTS) box(8, 50, 26, darkM, Math.sin(a)*62, Y1 + 59, 30 + Math.cos(a)*62, a);   // tower buttresses
    for (let i = 0; i < 7; i++) { box(2, 24, 56, darkM, -48 + i*16, Y1 + 24, -112); box(2.4, 1, 56, hotM, -48 + i*16, Y1 + 36.2, -112); }
    box(112, 4, 60, trimM, 0, Y1 + 13, -112);
    box(6, 208, 6, trimM, 0, Y1 + 136, 120); for (let y = 60; y < 240; y += 36) box(14, 2, 14, darkM, 0, Y1 + y, 120);
    for (const s of [-1, 1]) box(1.2, 150, 1.2, trimM, s*14, Y1 + 100, 120, 0, 0, s*0.09);
    box(40, 3, 40, darkM, 0, Y1 + 240, 120); B.add(plateM, new THREE.SphereGeometry(30, 20, 10, 0, PI*2, 0, PI/2.5), 0, Y1 + 232, 120);
    const pads = VERTS.map(a => [Math.sin(a)*235, Math.cos(a)*235, a]);
    for (const [x, z, a] of pads) { box(46, 0.6, 46, trimM, x, Y1 + 0.3, z, a); for (const i of [-1, 1]) for (const j of [-1, 1]) { box(5, 1.2, 5, redM, x + Math.cos(a)*i*24 + Math.sin(a)*j*24, Y1 + 0.6, z - Math.sin(a)*i*24 + Math.cos(a)*j*24, a); } }
    for (let i = 0; i < 260; i++) { const x = (R() - 0.5)*560, z = (R() - 0.5)*500, w = 8 + R()*22, d = 8 + R()*22, h = 2 + R()*R()*14, m = Math.max(w, d)/2, hx = G.stationHex(x, z);
      if (hx < 172 + m || hx > 252 - m || pads.some(([px, pz]) => Math.hypot(px - x, pz - z) < 36 + m)) continue;
      box(w, h, d, R() < 0.5 ? plateM : darkM, x, Y1 + h/2, z); if (R() < 0.35) box(w*0.5, 1.6, d*0.5, trimM, x, Y1 + h + 0.8, z); }

    // belly: an inverted stepped keel down to the reactor bulb and a long spike, with six radiator vanes
    pr(290, 190, 26, 6, darkM, 0, -Y1 - 13, 0); pr(140, 108, 34, 6, plateM, 0, -Y1 - 43, 0); pr(74, 74, 40, 6, trimM, 0, -Y1 - 80, 0); pr(62, 22, 50, 6, darkM, 0, -Y1 - 125, 0);
    B.add(trimM, new THREE.CylinderGeometry(8, 1, 120, 8), 0, -Y1 - 210, 0); band(141, 1.6, 6, hotM, 0, -Y1 - 28, 0);
    for (const b of FACES) rbox(3, 30, 1, hotM, b, 64.4, 0, -Y1 - 80);
    for (const a of VERTS) { rbox(3, 64, 120, darkM, a, 160, 0, -Y1 - 58); rbox(3.6, 1.4, 120, hotM, a, 160, 0, -Y1 - 90.5); }

    // the outer ring: a flat hexagonal band (deck at +22 for the ring turrets, underside clear of the mouth approach) on six truss spokes
    const sc = 1/C30, rsec = [[500, 4], [540, 4], [546, 9], [546, 17], [540, 22], [500, 22], [494, 17], [494, 9]], vr = 520*sc;
    B.add(hullM, loft(VERTS.map(a => rsec.map(([r, y]) => [Math.sin(a)*r*sc, y, Math.cos(a)*r*sc])), true));
    FACES.forEach((b, k) => {
      for (let t = -240; t <= 240; t += 80) rbox(56, 1.6, 0.8, winM, b, 546.3, t, 13);
      for (let t = -220; t <= 220; t += 110) rbox(50, 1.4, 0.8, winM, b, 493.7, t, 13);
      rbox(38, 0.6, 38, trimM, b, 520, 0, 22.3);
      for (const s of [-1, 1]) { rbox(8, 2, 48, trimM, b, 520, s*262, 22.6); rbox(54, 7, 28, plateM, b, 520, s*205, 25.5); rbox(40, 2, 18, darkM, b, 520, s*205, 30);
        if (k % 2) { rbox(96, 15, 16, hullM, b, 553, s*110, 13); rbox(100, 3, 18, redM, b, 553, s*110, 13); rbox(70, 9, 30, plateM, b, 520, s*100, 26.5); rbox(74, 2, 12, redM, b, 520, s*100, 31.5); }
        else { const [x, z] = rp(b, 556, s*120); B.add(plateM, new THREE.CylinderGeometry(7, 7, 60, 12), x, 13, z, 0, b, PI/2); rbox(8, 12, 4, trimM, b, 549, s*120, 13); rbox(50, 6, 26, plateM, b, 520, s*100, 25); } }
      if (k !== FRONT) rbox(150, 5, 22, darkM, b, 520, 0, 1.5);
      const a = VERTS[k], [x, z] = rp(a, vr, 0); B.add(darkM, flat(new THREE.CylinderGeometry(34, 34, 24, 6)), x, 13, z, 0, a, 0);
      box(1.6, 46, 1.6, trimM, x, 48, z); box(12, 1.2, 12, redM, x, 25.6, z, a);
      // spoke from the hub's corner to the ring's corner: a box beam, two pipes, and stays above and below
      rbox(14, 11, 266, darkM, a, 436, 0, 12);
      for (const t of [-5, 5]) { const q = rp(a, 436, t); B.add(plateM, new THREE.CylinderGeometry(1.6, 1.6, 266, 8), q[0], 19, q[1], PI/2, a, 0); }
      for (const [y0, y1] of [[80, 22], [-78, 6]]) rbox(3, 3, Math.hypot(264, y1 - y0), trimM, a, 436, 0, (y0 + y1)/2, Math.atan2(y0 - y1, 264));
    });
    // solar wings on booms off the ring's two side corners, each pair of panels canted up in a shallow V
    for (const s of [-1, 1]) { const x0 = vr + 20; box(440, 5, 5, trimM, s*(x0 + 220), 13, 0); box(10, 10, 10, darkM, s*(x0 + 440), 13, 0);
      for (let i = 0; i < 4; i++) for (const q of [-1, 1]) { const x = s*(x0 + 76 + i*96), ang = -q*0.2, y = 13 + 64*Math.sin(0.2), z = q*64*Math.cos(0.2);
        box(84, 0.8, 104, solarM, x, y, z, 0, ang); for (const e of [-42, 42]) box(2, 1.6, 106, trimM, x + e, y, z, 0, ang); box(86, 1.6, 2, trimM, x, 13 + 116*Math.sin(0.2), q*116*Math.cos(0.2), 0, ang); } }

    // hangar mouth: a massive dark portal with a red inner lip, hazard lintel, lamp columns and lit docking arms
    const mw = ST.mw, mh = ST.mh, my = -H + mh;
    for (const s of [-1, 1]) { box(12, mh + 14, 8, darkM, s*(mw + 6), -H + (mh + 14)/2, -O - 4); box(1.5, mh, 8.6, redM, s*(mw + 0.75), -H + mh/2, -O - 4.2);
      for (let y = -H + 6; y < my; y += 8) box(1.6, 3.4, 0.6, lampM, s*(mw + 7), y, -O - 8.2);
      for (const y of [-H + 20, -H + 44]) box(0.4, 1.6, 16, lampM, s*(mw - 0.1), y, -A - T/2);
      // docking arm: a truss boom with approach lights and a pad at its tip
      box(14, 14, 140, darkM, s*(mw + 40), -H + 20, -O - 70); box(16, 3, 132, trimM, s*(mw + 40), -H + 28, -O - 66); box(20, 20, 6, trimM, s*(mw + 40), -H + 20, -O - 3);
      for (let z = -O - 14; z > -O - 136; z -= 14) box(0.6, 1.2, 3, cyanM, s*(mw + 32.8), -H + 23, z);
      B.add(redM, flat(new THREE.CylinderGeometry(19, 21, 4, 8)), s*(mw + 40), -H + 29, -O - 135, 0, PI/8, 0); B.add(trimM, flat(new THREE.CylinderGeometry(14, 14, 0.6, 8)), s*(mw + 40), -H + 31.2, -O - 135, 0, PI/8, 0); }
    box(2*mw + 24, 14, 8, darkM, 0, my + 7, -O - 4); box(2*mw + 3, 1.5, 8.6, redM, 0, my + 0.75, -O - 4.2); box(2*mw + 24, 5, 8, darkM, 0, -H - 2.5, -O - 4);
    box(2*mw - 8, 3.4, 0.5, hazM, 0, my + 9, -O - 8.2); box(2*mw, 0.12, 6, hazM, 0, -H + 0.08, -O - 5); box(2*mw, 0.12, 3, hazM, 0, -H + 0.08, -A - 1.5);
    for (const x of [-50, 0, 50]) box(14, 0.4, 16, lampM, x, my - 0.1, -A - T/2);

    /* ---- interior: lining, deck, structure, lights ---- */
    pr(RI + 0.4, RI + 0.4, 0.5, 6, inM, 0, H - 0.3, 0); B.add(floorM, new THREE.CircleGeometry(RI + 0.4, 6), 0, -H + 0.05, 0, -PI/2, 0, 0);
    const fy = -H + 0.1;
    FACES.forEach((b, k) => {
      const [vx, vz] = rp(VERTS[k], RI - 2, 0); box(7, 2*H, 7, darkM, vx, 0, vz, VERTS[k]);   // a post in each corner
      if (k === FRONT) return;
      rbox(LI + 1, 2*H, 0.5, inM, b, A - 0.3, 0, 0); rbox(2*(A - 26)*T30, 0.1, 1.2, paintY, b, A - 26, 0, fy);
      for (const t of (k ? [-90, -30, 30, 90] : [-76, 76])) rbox(6, 2*H, 3, darkM, b, A - 1.6, t, 0);
      if (!k) return;
      // bays between the frames: doors, lit panels, warm strips and a red alarm strip above each
      for (const t of [-116, -60, 0, 60, 116]) { const w = Math.abs(t) > 100 ? 34 : 44;
        if (Math.abs(t) === 60) { rbox(44, 40, 1.6, darkM, b, A - 0.9, t, -H + 20); rbox(46, 2.4, 1.8, hazM, b, A - 0.9, t, -H + 41.4); rbox(1, 34, 0.5, trimM, b, A - 1.8, t, -H + 18); rbox(10, 1.2, 0.4, lampM, b, A - 1.8, t, -H + 45); }
        else if (!t) { rbox(40, 26, 1.2, darkM, b, A - 0.8, t, -H + 18); rbox(36, 1.4, 0.4, lampM, b, A - 1.5, t, -H + 34); }
        rbox(w + 2, 1, 0.4, redLamp, b, A - 0.7, t, 34); rbox(w - 4, 1.4, 0.4, lampM, b, A - 0.7, t, -14); }
      // a catwalk along each of the four side walls
      rbox(240, 1.2, 14, darkM, b, A - 8, 0, 10); rbox(240, 0.5, 0.5, trimM, b, A - 14.6, 0, 12.6); rbox(240, 0.9, 0.5, hazM, b, A - 15.1, 0, 10);
      for (let t = -116; t <= 116; t += 8) rbox(0.4, 2.2, 0.4, trimM, b, A - 14.6, t, 11.6);
      for (const t of [-90, -30, 30, 90]) rbox(2.4, 4, 14, trimM, b, A - 8, t, 7.6); for (const t of [-60, 0, 60]) rbox(22, 0.3, 1, lampM, b, A - 8, t, 9.3);
    });
    for (const s of [-1, 1]) { box(LI/2 - mw + 1, 2*H, 0.5, inM, s*(LI/2 + mw)/2, 0, -A + 0.3); box(6, 2*H, 3, darkM, s*110, 0, -A + 1.6); box(1, mh, 0.6, lampM, s*(mw + 3), -H + mh/2, -A + 0.6);
      box(1, 0.1, 330, paintY, s*40, fy, -65); for (let z = -216; z < 100; z += 26) box(1.6, 0.26, 4, cyanM, s*43, -H + 0.13, z); }
    box(2*mw, 2*H - mh, 0.5, inM, 0, my + (2*H - mh)/2, -A + 0.3); box(2*mw + 7, 1, 0.6, lampM, 0, my + 2.5, -A + 0.6);
    for (const y of [16, 27, 38]) for (const s of [-1, 1]) box(24, 2.6, 0.6, redLamp, s*9.6, y, -A + 0.7, 0, 0, s*0.6);        // "way out" chevrons over the mouth: they flash with the alarm
    for (let x = -140; x <= 140; x += 40) box(10, 0.3, 2, cyanM, x, -H + 0.25, -A + 30);                                         // landing line by the mouth
    for (let z = -224; z < 100; z += 26) box(2.5, 0.1, 13, paintW, 0, fy, z);
    // pillars: lit on all four faces, hazard banded, collared, with flared capitals under the roof
    for (const [px, pz] of PILLARS) { box(16, 2*H, 16, plateM, px, 0, pz); box(18.4, 1, 18.4, trimM, px, -H + 0.5, pz); box(16.5, 2.4, 16.5, hazM, px, -H + 3.6, pz);
      for (const y of [-H + 6, -22, 16]) box(17.2, 2, 17.2, darkM, px, y, pz);
      B.add(darkM, flat(new THREE.CylinderGeometry(21, 11.6, 10, 4)), px, H - 5, pz, 0, PI/4, 0);
      box(2, 2*H - 26, 16.4, lampM, px, -4, pz); box(16.4, 2*H - 26, 2, lampM, px, -4, pz);
      box(30, 0.1, 2, hazM, px, fy, pz - 14); box(30, 0.1, 2, hazM, px, fy, pz + 14); box(2, 0.1, 26, hazM, px - 14, fy, pz); box(2, 0.1, 26, hazM, px + 14, fy, pz); }
    const PADS = [[-130, -150], [130, -150], [-180, -8], [180, -8]];
    for (const [x, z] of PADS) { B.add(paintY, new THREE.RingGeometry(25, 27, 40), x, fy, z, -PI/2, 0, 0); B.add(paintW, new THREE.RingGeometry(9, 10, 28), x, fy, z, -PI/2, 0, 0);
      for (let i = 0; i < 4; i++) { const a = i*PI/2; box(1.2, 0.1, 12, paintW, x + Math.sin(a)*18, fy, z + Math.cos(a)*18, a); } }
    // roof structure: girders cut to the hexagon, lamp housings and a gantry crane on rails
    for (let z = -210; z <= 210; z += 60) box(2*(A - 0.5*Math.abs(z))/C30, 5, 4, darkM, 0, H - 2.5, z);
    for (const x of [-180, -60, 60, 180]) { box(4, 3, 2*Math.min(A, 2*(A - C30*Math.abs(x))), darkM, x, H - 1.5, 0);
      for (let z = -180; z <= 180; z += 60) if (G.stationHex(x, z) < A - 20) { box(36, 2.4, 10, trimM, x, H - 4.2, z); box(30, 0.6, 6, lampM, x, H - 5.6, z); } }
    for (const s of [-1, 1]) box(3, 3, 2*A - 20, trimM, s*40, H - 7, 0);
    box(88, 5, 12, darkM, 0, H - 10.5, -40); box(88, 1.6, 12.4, hazM, 0, H - 12.4, -40); box(12, 6, 10, trimM, 16, H - 15, -40); box(0.6, 18, 0.6, trimM, 16, H - 27, -40); box(5, 4, 5, hazM, 16, H - 38, -40);
    // reactor chamber at the back: octagonal steps, a cage of posts and rings, an injector hanging from the roof and conduits into the back wall
    const rz = A - 70;
    B.add(hazM, new THREE.RingGeometry(50, 54, 48), 0, fy, rz, -PI/2, 0, 0);
    pr(44, 46, 5, 8, darkM, 0, -H + 2.5, rz); band(39.5, 1, 8, cyanM, 0, -H + 5.6, rz); pr(36, 39, 7, 8, plateM, 0, -H + 8.5, rz);
    pr(8, 14, 4, 8, trimM, 0, -H + 14, rz); disc(7.4, cyanM, 0, -H + 16.1, rz, -PI/2);
    for (let i = 0; i < 8; i++) { const a = i/8*PI*2, x = Math.sin(a)*34, z = rz + Math.cos(a)*34; box(3, 2*H - 12, 3, darkM, x, 6, z, a); box(0.8, 44, 0.5, redLamp, Math.sin(a)*35.7, 0, rz + Math.cos(a)*35.7, a); box(5, 3, 5, trimM, x, -H + 13.5, z, a); }
    for (const y of [-20, 20, 48]) B.add(darkM, new THREE.TorusGeometry(34, 1.5, 6, 32), 0, y, rz, PI/2, 0, 0);
    pr(44, 20, 22, 8, darkM, 0, H - 11, rz); pr(12, 12, 8, 8, trimM, 0, H - 26, rz); pr(10, 4, 6, 8, darkM, 0, H - 33, rz); disc(3.8, cyanM, 0, H - 36.1, rz, PI/2); band(12.3, 1, 8, cyanM, 0, H - 26, rz);
    for (const s of [-1, 1]) { tube(3, 56, plateM, s*22, H - 6, A - 28, 'z'); box(9, 9, 3, trimM, s*22, H - 6, A - 1.5);
      box(40, 84, 2, darkM, s*108, -10, A - 1.6); box(32, 1, 0.5, redLamp, s*108, 26, A - 2.8); for (let i = 0; i < 4; i++) box(30, 1.4, 0.5, lampM, s*108, -44 + i*12, A - 2.8); }
    B.add(trimM, new THREE.TorusGeometry(60, 3, 8, 40), 0, 0, A - 2); disc(58, darkM, 0, 0, A - 1, 0, PI); for (const y of [-18, 0, 18]) box(Math.sqrt(54*54 - y*y)*2, 1.4, 0.5, cyanM, 0, y, A - 1.4);
    B.build(g);

    // the name over the mouth, bay numbers on the deck, and a faint containment field across the mouth
    { const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#e04a3a'; x.font = 'bold 92px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; x.textBaseline = 'middle';
      let px = 150; for (const ch of 'TESSARACT') { x.fillText(ch, px, 68); px += x.measureText(ch).width + 22; }
      x.fillRect(20, 30, 90, 14); x.fillRect(20, 56, 60, 14); x.fillRect(20, 82, 90, 14); x.fillRect(px + 10, 56, 1004 - px - 10, 14);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(150, 18.75), new THREE.MeshStandardMaterial({map:canvasTex(c, false), transparent:true, alphaTest:0.4, emissive:0x5a1208, roughness:0.6, metalness:0.2})); m.position.set(0, 38, -O - 0.5); m.rotation.y = PI; g.add(m); }
    { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#c9981c'; x.font = 'bold 110px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k < 4; k++) x.fillText('0' + (k + 1), 64 + k*128, 68);
      const t = canvasTex(c, false), nm = new THREE.MeshStandardMaterial({map:t, transparent:true, alphaTest:0.4, roughness:0.8});
      PADS.forEach(([x0, z0], k) => { const pg = new THREE.PlaneGeometry(20, 20), uv = pg.attributes.uv; for (let i = 0; i < 4; i++) uv.setX(i, (k + uv.getX(i))/4);
        const m = new THREE.Mesh(pg, nm); m.rotation.set(-PI/2, 0, PI); m.position.set(x0, fy + 0.06, z0 - 38); g.add(m); }); }
    { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#04080a'; x.fillRect(0, 0, 256, 128);
      for (let j = 0; j < 128; j += 4) { x.fillStyle = 'rgba(90,200,255,0.05)'; x.fillRect(0, j, 256, 1); }
      for (const [x0, y0, x1, y1] of [[0, 0, 26, 0], [256, 0, 230, 0], [0, 0, 0, 22], [0, 128, 0, 106]]) { const gd = x.createLinearGradient(x0, y0, x1, y1); gd.addColorStop(0, 'rgba(90,200,255,0.5)'); gd.addColorStop(1, 'rgba(90,200,255,0)'); x.fillStyle = gd; x.fillRect(0, 0, 256, 128); }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2*mw, mh), new THREE.MeshBasicMaterial({map:canvasTex(c, false), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide})); m.position.set(0, -H + mh/2, -A - T/2); g.add(m); }
    this.beacons = [];
    for (const [x, y, z] of [...[0, 2, 3, 5].map(k => [Math.sin(VERTS[k])*RO, Y1, Math.cos(VERTS[k])*RO]), [0, Y1 + 261, 120], [-vr, 70, 0], [vr, 70, 0], [mw + 40, -H + 31, -O - 135], [-mw - 40, -H + 31, -O - 135], [0, -Y1 - 276, 0], [0, Y1 + 104, 30]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), redLamp); b.position.set(x, y + 3, z); g.add(b); this.beacons.push(b); }
    // interior lights: the sun can't reach in, so the hangar has its own
    this.inLights = [];
    for (const [x, z] of [[0, -150], [0, 40], [0, 180]]) { const L = new THREE.PointLight(0xffe2b8, 1.4, 420, 1.6); L.position.set(ST.x + x, ST.y + H - 12, ST.z + z); scene.add(L); this.inLights.push(L); }
  }
  update(dt, t){
    if (this.beacons) { const on = Math.floor(t*1.2) % 2 === 0; for (const b of this.beacons) b.visible = on; }
    if (this.planet) this.planet.rotation.y += dt*0.002;
  }
};

/* ---------- Entities: reactor core, shield generator, battlecruiser ---------- */
Object.assign(G.ETYPES, {
  stationcore:{hp:2600, r:15, cy:0, cash:0, xp:500, cls:'struct', name:'Reactor core'},
  shieldgen:{hp:1500, r:11, cy:3, cash:700, xp:90, cls:'air', name:'Shield generator'},
  cruiser:{hp:6000, r:44, cy:0, cash:0, xp:1200, cls:'struct', name:'Battlecruiser Dominance'}
});
const baseBuild = G.buildEnemy;
G.buildEnemy = function(type, o = {}){
  if (type === 'stationcore') return buildCore();
  if (type === 'shieldgen') return buildGen();
  if (type === 'cruiser') return buildCruiser();
  return baseBuild(type, o);
};
function buildCore(){
  const g = new THREE.Group(), u = g.userData;
  const coreM = u.coreM = new THREE.MeshStandardMaterial({color:0x7fe9ff, emissive:0x36c9ff, emissiveIntensity:2.2, roughness:0.2, flatShading:true});
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(12, 1), coreM));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(13.6, 1)), new THREE.LineBasicMaterial({color:0x10151a})));
  const ringM = new THREE.MeshStandardMaterial({color:0x3a3f47, roughness:0.5, metalness:0.6}), nodeM = new THREE.MeshStandardMaterial({color:0x8a2a22, roughness:0.5, metalness:0.4});
  u.rings = [];
  for (let k = 0; k < 3; k++) { const r = new THREE.Group(), B = new Batch(), rad = 17 + k*3;
    B.add(ringM, flat(new THREE.TorusGeometry(rad, 0.9, 6, 48)));
    for (let i = 0; i < 6; i++) { const a = i/6*Math.PI*2; B.add(i % 3 ? ringM : nodeM, new THREE.BoxGeometry(2.6, 3.4, 2.4), Math.cos(a)*rad, Math.sin(a)*rad, 0, 0, 0, a); }
    B.build(r, false); r.rotation.set(k*1.1, k*0.7, 0); g.add(r); u.rings.push(r); }
  u.light = new THREE.PointLight(0x5fd8ff, 2.2, 260, 1.5); g.add(u.light);
  return g;
}
function buildGen(){
  const g = new THREE.Group(), u = g.userData, B = new Batch(), PI = Math.PI;
  const dk = new THREE.MeshStandardMaterial({color:0x30343b, roughness:0.6, metalness:0.5}), tr = new THREE.MeshStandardMaterial({color:0x191b20, roughness:0.6, metalness:0.5}), rd = new THREE.MeshStandardMaterial({color:0x9a2a22, roughness:0.55, metalness:0.35});
  const tip = new THREE.MeshBasicMaterial({color:0x9fe8ff});
  B.add(dk, flat(new THREE.CylinderGeometry(9.6, 11, 3, 8)), 0, 1.5, 0, 0, PI/8, 0); B.add(rd, flat(new THREE.CylinderGeometry(9.2, 9.2, 0.8, 8)), 0, 3.4, 0, 0, PI/8, 0); B.add(tr, flat(new THREE.CylinderGeometry(8, 9, 1.4, 8)), 0, 4.4, 0, 0, PI/8, 0);
  for (let k = 0; k < 4; k++) { const a = k*PI/2 + PI/4, x = Math.sin(a), z = Math.cos(a); B.add(dk, new THREE.BoxGeometry(1.4, 9, 3.2), x*9, 7, z*9, 0, a + PI/2, 0.22); B.add(tr, new THREE.BoxGeometry(2, 2, 4), x*9.6, 3.6, z*9.6, 0, a + PI/2, 0); B.add(tip, new THREE.BoxGeometry(0.9, 1.6, 1.2), x*8.1, 11.6, z*8.1, 0, a + PI/2, 0); }
  B.build(g, false);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, PI*2, 0, PI/2), u.domeM = new THREE.MeshStandardMaterial({color:0x7fe0ff, emissive:0x2bb8ff, emissiveIntensity:1.4, roughness:0.15}));
  dome.position.y = 5; g.add(dome);
  { const rb = new Batch(); rb.add(dk, flat(new THREE.TorusGeometry(10, 0.8, 6, 32))); for (let i = 0; i < 8; i++) { const a = i/8*PI*2; rb.add(i % 2 ? tr : rd, new THREE.BoxGeometry(2.2, 1.8, 1.8), Math.cos(a)*10, Math.sin(a)*10, 0, 0, 0, a); }
    u.ring = new THREE.Group(); rb.build(u.ring, false); u.ring.rotation.x = PI/2; u.ring.position.y = 7; g.add(u.ring); }
  return g;
}
/* The Dominance: a 420 m Varn battlecruiser. A faceted arrowhead hull with a knife-edged armour belt, a raised spine, a forked
   prow gripping the spinal cannon, drooped weapon wings, a raked bridge tower aft, four main engines, a starboard hangar,
   and a shield bubble that holds while its generators live. */
function buildCruiser(){
  const g = new THREE.Group(), u = g.userData, B = new Batch(), R = rng(1777), PI = Math.PI;
  const ps = panelSet('hull', 5, {win:0.2, cells:1, depth:7});
  const std = (o, uv) => { const m = new THREE.MeshStandardMaterial(o); if (uv) m.userData.uv = uv; return m; }, basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({color:c}, o));
  const hullM = std({color:0x626871, map:ps.map, normalMap:ps.normalMap, emissive:0xffffff, emissiveMap:ps.emissiveMap, emissiveIntensity:0.9, roughness:0.66, metalness:0.3}, 1/80);
  const darkM = std({color:0x2e3239, map:ps.map, normalMap:ps.normalMap, roughness:0.7, metalness:0.35}, 1/80), trimM = std({color:0x191b20, roughness:0.6, metalness:0.5});
  const redM = std({color:0xa02c23, normalMap:ps.normalMap, roughness:0.55, metalness:0.3}, 1/80), hazM = std({map:hazardTex(), roughness:0.7, metalness:0.2}, 1/5);
  const lampM = basic(0xffb38a), engM = basic(0xc8ecff), hotM = basic(0xff5a2a), bayM = basic(0x2c1709), navR = basic(0xff3a2a), navG = basic(0x58ff8a);
  const plumeM = basic(0x6fc8ff, {transparent:true, opacity:0.22, depthWrite:false, blending:THREE.AdditiveBlending}), plumeM2 = basic(0xd8f0ff, {transparent:true, opacity:0.4, depthWrite:false, blending:THREE.AdditiveBlending});
  const bx = (w, h, d, m, x, y, z, ry = 0, rx = 0, rz = 0) => B.add(m, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  const zc = (rf, rb, len, seg, m, x, y, z, fl) => { const c = new THREE.CylinderGeometry(rf, rb, len, seg).rotateX(PI/2); B.add(m, fl ? flat(c) : c, x, y, z); };   // a cylinder along z; rf is the forward radius
  // cross-sections: hull (keel flat, lower chine, belt, upper chine, deck), plus simple rectangles in each plane
  const hs = (z, wk, wb, wd, yk, yl, yh, yd) => [[wk, yk, z], [wb, yl, z], [wb, yh, z], [wd, yd, z], [-wd, yd, z], [-wb, yh, z], [-wb, yl, z], [-wk, yk, z]];
  const zs = (z, x0, x1, y0, y1) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];                 // rectangle at a z station
  const ys = (y, hw, zf, zb, cx = 0) => [[cx + hw, y, zf], [cx + hw, y, zb], [cx - hw, y, zb], [cx - hw, y, zf]];   // rectangle at a height
  const xs = (x, zf, zb, y0, y1) => [[x, y1, zf], [x, y1, zb], [x, y0, zb], [x, y0, zf]];                  // rectangle at an x station
  B.add(hullM, loft([hs(206, 7, 13, 9, -11, -6, 2, 8), hs(132, 26, 40, 35.5, -20, -7, 4, 22), hs(40, 32, 47, 43, -22, -7, 5, 22), hs(-150, 34, 47, 43, -22, -7, 5, 22), hs(-206, 24, 36, 32, -17, -6, 6, 20)]));
  B.add(hullM, loft([[[6, 12, 170], [3, 16.5, 170], [-3, 16.5, 170], [-6, 12, 170]], [[20, 20, 138], [13, 30, 138], [-13, 30, 138], [-20, 20, 138]], [[22, 20, -120], [14, 30, -120], [-14, 30, -120], [-22, 20, -120]], [[14, 20, -178], [9, 27, -178], [-9, 27, -178], [-14, 20, -178]]]));   // raised spine
  B.add(darkM, loft([[[6, -14, 150], [3, -20, 150], [-3, -20, 150], [-6, -14, 150]], [[14, -19, 100], [8, -31, 100], [-8, -31, 100], [-14, -19, 100]], [[14, -21, -140], [8, -34, -140], [-8, -34, -140], [-14, -21, -140]], [[8, -19, -192], [4, -28, -192], [-4, -28, -192], [-8, -19, -192]]]));   // keel
  for (const z of [84, 0]) bx(22, 0.9, 34, darkM, 0, 30.3, z); bx(4, 0.6, 250, trimM, 0, 30.2, 0);
  // forked prow: two jaws either side of the spinal cannon, with glowing rails on their inner faces
  for (const s of [-1, 1]) { B.add(hullM, loft([zs(150, s*10, s*24, -12, 8), zs(212, s*10.5, s*19, -8, 4), zs(256, s*11, s*13.5, -4, 0)])); bx(0.5, 1.2, 44, hotM, s*10.3, -2, 230); bx(1, 2, 40, redM, s*19.6, -2, 176, -s*0.08); }
  zc(6, 8, 72, 16, darkM, 0, -2, 230); for (const z of [214, 231, 248]) zc(11.5, 11.5, 3, 8, trimM, 0, -2, z, true); zc(7.4, 7.4, 6, 12, trimM, 0, -2, 264); B.add(basic(0x7a2a12), new THREE.RingGeometry(3.4, 6, 16), 0, -2, 267.1); B.add(basic(0x0a0506), new THREE.CircleGeometry(3.4, 16), 0, -2, 267.1);
  for (const s of [-1, 1]) bx(0.5, 1, 46, hotM, s*7.2, -2, 226, -s*0.028);
  u.muzzle = new THREE.Object3D(); u.muzzle.position.set(0, -2, 268); g.add(u.muzzle);
  u.chargeM = new THREE.MeshBasicMaterial({color:0xff6a3a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending});
  u.charge = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 10), u.chargeM); u.charge.position.copy(u.muzzle.position); g.add(u.charge);
  // drooped weapon wings with tip gun pods, red leading edges and nav lights
  for (const s of [-1, 1]) {
    B.add(hullM, loft([xs(s*42, 32, -92, -6, 5), xs(s*98, -66, -110, -9, -5)])); B.add(redM, loft([xs(s*43, 33.6, 29, 2.6, 5.5), xs(s*98.4, -64.6, -69, -7.4, -4.5)]));
    B.add(darkM, loft([zs(-56, s*96, s*102, -10, -4), zs(-68, s*93, s*105, -13, -1), zs(-112, s*93, s*105, -13, -1), zs(-122, s*95, s*103, -11, -3)]));
    for (const dx of [-2.6, 2.6]) zc(1.1, 1.3, 28, 8, trimM, s*99 + dx, -7, -44); bx(0.8, 3, 34, redM, s*105.2, -7, -90); bx(0.6, 1, 2.4, s > 0 ? navG : navR, s*105.4, -3, -112);
    bx(26, 1, 30, darkM, s*62, 1.8, -52, 0, 0, -s*0.18); bx(10, 5, 60, darkM, s*47, -1, -50);
    // armour belt: slabs, a red line and running lights down each flank
    for (let z = -140; z <= 0; z += 28) { if (z !== -56 && z !== -28) bx(2, 8, 18, darkM, s*47.2, -2.6, z); bx(0.6, 1, 3, lampM, s*47.5, 3.6, z + 14); }
    bx(0.8, 1.4, 150, redM, s*47.3, 2, -75);
    for (const z of [-70, -10, 50, 105]) bx(0.5, 0.6, 38, lampM, s*(z > 60 ? 21.4 : 22.6), 22.2, z);
    // stern stabilisers
    B.add(darkM, loft([xs(s*34, -160, -204, 2, 7), xs(s*62, -196, -216, 13, 15)]));
  }
  // bridge tower: raked body, overhanging bridge with a window band, mast and aerials
  B.add(hullM, loft([ys(28, 16, -86, -134), ys(50, 12, -98, -130)])); B.add(hullM, loft([ys(50, 15, -95, -131), ys(54, 18, -90, -133), ys(60, 18, -92, -133), ys(64, 13, -101, -129)]));
  bx(31, 1.8, 0.6, lampM, 0, 57, -90.7); for (const s of [-1, 1]) { bx(0.6, 1.8, 36, lampM, s*18.1, 57, -112); bx(1, 3, 30, redM, s*14.6, 40, -112, 0, 0, s*0.18); }
  bx(22, 1.4, 22, trimM, 0, 64.6, -115); bx(3, 34, 3, trimM, 0, 82, -120); bx(16, 1.4, 1.4, trimM, 0, 93, -120); bx(1, 22, 1, trimM, -6, 76, -125); bx(1, 16, 1, trimM, 7, 73, -108); bx(10, 5, 1.6, darkM, 0, 68.5, -106, 0, -0.3);
  B.add(darkM, loft([ys(28, 9, -130, -150), ys(46, 5, -128, -134)]));
  // dorsal and ventral fins
  B.add(hullM, loft([ys(26, 3, -146, -212), ys(78, 1, -196, -232)])); B.add(redM, loft([ys(60, 2, -178.4, -225.4), ys(66, 1.8, -184.2, -227.7)])); B.add(darkM, loft([ys(-20, 3, -150, -205), ys(-50, 1, -185, -220)]));
  // engines: a dark stern block, four flared nozzles with white-hot throats, and layered plumes
  B.add(trimM, loft([hs(-204, 22, 33, 29, -15, -5, 5, 18), hs(-215, 20, 30, 26, -13, -4, 4, 16)])); bx(2, 34, 14, trimM, 0, 1, -216); bx(60, 2, 14, trimM, 0, 1, -216);
  for (const [x, y] of [[-21, -7], [21, -7], [-19, 9.5], [19, 9.5]]) { zc(9, 11.5, 22, 16, darkM, x, y, -219); zc(11.8, 12, 3, 16, trimM, x, y, -229);
    B.add(engM, new THREE.CircleGeometry(9.6, 16).rotateY(PI), x, y, -227); B.add(plumeM, new THREE.ConeGeometry(10, 80, 16, 1, true).rotateX(-PI/2), x, y, -270); B.add(plumeM2, new THREE.ConeGeometry(6, 38, 12, 1, true).rotateX(-PI/2), x, y, -248); }
  // starboard hangar (fighters launch from here) and a port sensor blister
  bx(8, 20, 72, darkM, 46.4, -1, 40); bx(0.3, 12, 54, bayM, 50.5, -1, 40); bx(0.4, 1, 54, lampM, 50.6, -6.4, 40); for (const dz of [-28.5, 28.5]) bx(0.5, 12, 3, hazM, 50.6, -1, 40 + dz);
  for (let z = 14; z <= 66; z += 8) bx(1, 1.5, 3, lampM, 50.5, 7, z); for (let z = 22; z <= 58; z += 9) bx(0.4, 9, 0.8, lampM, 50.6, -0.5, z);
  for (let z = -120; z <= 90; z += 30) { bx(0.8, 0.5, 7, lampM, 0, -34.2, z); for (const s of [-1, 1]) bx(0.6, 0.6, 3, z % 60 ? lampM : navR, s*29, -22.2, z + 10); }
  u.bay = new THREE.Object3D(); u.bay.position.set(60, 0, 40); g.add(u.bay);
  bx(6, 14, 52, darkM, -46, -1, 40); bx(0.8, 2, 46, redM, -49.2, -1, 40); for (const z of [22, 40, 58]) B.add(trimM, new THREE.SphereGeometry(3.2, 10, 6), -48.6, 4, z);
  // mounts (local): heavy turrets along the flanks, missile batteries on the spine, three shield generators; each sits on a barbette
  u.mounts = {flak:[[-30, 22, 125], [30, 22, 125], [-36, 22, 40], [36, 22, 40], [-38, 22, -50], [38, 22, -50], [-34, 22, -150], [34, 22, -150]],
    mis:[[0, 30, 120], [0, 30, -40]], gen:[[0, 30, 40], [-30, 22, -100], [30, 22, -100]]};
  const all = [...u.mounts.flak, ...u.mounts.mis, ...u.mounts.gen];
  u.mounts.flak.forEach(([x, y, z]) => B.add(trimM, flat(new THREE.CylinderGeometry(6, 7, 1, 8)), x, y + 0.2, z, 0, PI/8, 0));
  [...u.mounts.mis, ...u.mounts.gen].forEach(([x, y, z]) => { B.add(trimM, flat(new THREE.CylinderGeometry(12.5, 13.5, 1, 8)), x, y + 0.2, z, 0, PI/8, 0); B.add(redM, flat(new THREE.CylinderGeometry(13.8, 13.8, 0.5, 8)), x, y - 0.1, z, 0, PI/8, 0); });
  // deck and belly clutter (kept clear of the mounts and the tower)
  for (let i = 0; i < 150; i++) { const z = -150 + R()*270, s = R() < 0.5 ? -1 : 1, wd = z > 40 ? 43 - (z - 40)/92*7.5 : 43, w = 3 + R()*8, d = 4 + R()*14, h = 0.8 + R()*2.4, x = s*(25 + R()*(wd - 27 - w/2));
    if (all.some(([mx, , mz]) => Math.hypot(mx - x, mz - z) < 17 + d/2)) continue; bx(w, h, d, R() < 0.5 ? darkM : hullM, x, 22 + h/2, z); if (R() < 0.3) bx(w*0.4, 0.8, d*0.6, trimM, x, 22 + h + 0.4, z); }
  for (let i = 0; i < 50; i++) { const z = -140 + R()*240, s = R() < 0.5 ? -1 : 1, w = 3 + R()*7, d = 5 + R()*16, h = 0.8 + R()*2, x = s*(16 + R()*(z > 40 ? 6 : 12)); bx(w, h, d, R() < 0.6 ? darkM : hullM, x, -22 - h/2 + (z > 40 ? (z - 40)/92*2 + 0.4 : 0), z); }
  for (const z of [60, -60]) { B.add(trimM, new THREE.SphereGeometry(5, 12, 6, 0, PI*2, PI/2, PI/2), 0, -34, z); }
  B.build(g);
  // shield bubble
  u.shieldM = new THREE.ShaderMaterial({transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, uniforms:{a:{value:1}, t:{value:0}},
    vertexShader:'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }',
    fragmentShader:'uniform float a; uniform float t; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hx = 0.5 + 0.5*sin(vP.z*0.25 + t*3.0)*sin(vP.x*0.4 + vP.y*0.4); gl_FragColor = vec4(vec3(0.35,0.8,1.0)*(f*1.2 + 0.05 + 0.08*hx), (f*0.9 + 0.04)*a); }'});
  u.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), u.shieldM); u.shield.scale.set(80, 70, 260); g.add(u.shield);
  return g;
}

const baseUpdate = G.updateEnemy;
G.updateEnemy = function(game, e, dt){
  if (e.type === 'stationcore') return updateCore(game, e, dt);
  if (e.type === 'shieldgen') { e.t += dt; if (e.hitT > 0) e.hitT -= dt; const U = e.mesh.userData; U.ring.rotation.z += dt*(e.alive ? 2 : 0); U.domeM.emissiveIntensity = 1.2 + Math.sin(e.t*4)*0.3; return; }
  if (e.type === 'cruiser') { e.t += dt; if (e.hitT > 0) e.hitT -= dt; return updateCruiser(game, e, dt); }
  const r = baseUpdate(game, e, dt);
  if (game.world.space) {
    if (e.inStation && e.alive) {   // station security bots never leave the hangar
      G.stationClamp(e.pos, 12);
      if (e.pos.y < ST.floor) e.pos.y = ST.floor; G.stationPush(e.pos, e.r*0.6); e.mesh.position.copy(e.pos);
    } else if (e.cls === 'air' && e.alive && !e.part && !e.onStation && G.stationPush(e.pos, e.r)) e.mesh.position.copy(e.pos);
  }
  return r;
};

/* Reactor core: shielded while any security bot is alive; spins faster as it takes damage. */
function updateCore(game, e, dt){
  e.t += dt; if (e.hitT > 0) e.hitT -= dt; const U = e.mesh.userData;
  const bots = game.ents.filter(x => x.alive && x.inStation).length;
  e.armored = bots > 0; e.armorMsg = `CORE SHIELDED · ${bots} SECURITY BOT${bots === 1 ? '' : 'S'} STILL ACTIVE`;
  const k = 1 - e.hp/e.maxHp;
  U.rings.forEach((r, i) => { r.rotation.x += dt*(0.4 + i*0.3)*(1 + k*4); r.rotation.y += dt*(0.3 + i*0.2)*(1 + k*4); });
  U.coreM.emissiveIntensity = (e.armored ? 1.2 : 2.4) + Math.sin(e.t*(3 + k*14))*0.6;
  U.coreM.emissive.setHex(e.armored ? 0x36c9ff : 0xff6a3a); U.light.color.setHex(e.armored ? 0x5fd8ff : 0xff8a5a);
  e.mesh.position.copy(e.pos);
}

/* Escape: once the core goes, the station blows in 75 s. Anyone still within 2.5 km of it when it does is lost. */
G.coreDown = (game) => {
  const S = game.escape = {t:75, done:false};
  G.hud.flash('CORE BREACH · 75 SECONDS · GET OUT'); G.audio.boom(new V3(ST.x, ST.y, ST.z), 2); game.player.shake += 1.5;
  G.hud.radio(G.OFFICER.short, 'Core’s gone critical! That whole station is going up in seventy-five seconds. Out the way you came in, Kestrel. Now!');
  game.later(30, () => { if (!S.done) G.hud.radio(G.OFFICER.short, 'Forty-five seconds. Don’t stop to sightsee.'); });
  game.later(60, () => { if (!S.done) G.hud.radio(G.OFFICER.short, 'Fifteen! Burn, burn, burn!'); });
};
G.stationBlow = (game) => {
  const S = game.escape; S.done = true; const W = game.world, P = game.player, c = new V3(ST.x, ST.y, ST.z);
  for (let i = 0; i < 26; i++) game.later(i*0.12, () => { SV.set(ST.x + (Math.random() - 0.5)*900, ST.y + (Math.random() - 0.5)*300, ST.z + (Math.random() - 0.5)*900); game.fx.explosion(SV.clone(), 3 + Math.random()*4); });
  game.fx.explosion(c, 8); G.audio.boom(c, 3); P.shake += 3;
  game.later(0.8, () => { if (W.station) { W.scene.remove(W.station); for (const L of W.inLights) W.scene.remove(L); } G.stationLive = false; game.stationBlown = true; });
  for (const e of game.ents) if (e.alive && (e.inStation || e.onStation)) { e.alive = false; game.scene.remove(e.mesh); }
  const d = P.pos.distanceTo(c);
  if (P.alive && d < 2500) { P.damage(1e6, c.clone(), 'blast'); G.hud.flash('CAUGHT IN THE BLAST'); }
  else if (P.alive) { G.hud.flash('THE TESSARACT IS GONE'); game.later(1.5, () => G.hud.radio(G.OFFICER.short, 'Station destroyed and I can still hear you breathing. Lovely work, Kestrel.')); }
};

/* Battlecruiser: closes on the target at a crawl, turns slowly to bring its spinal cannon to bear, fires it after a
   3.5 s charge along a fixed line (fly out of it), launches fighters from its side hangar, and is shielded until all
   three generators die. Its hull is solid. */
function updateCruiser(game, e, dt){
  const S = e.bc, U = e.mesh.userData, P = game.player, m = e.mesh;
  if (e.dead) return;
  const gens = e.parts.filter(p => p.type === 'shieldgen' && p.alive).length;
  if (!S.exposed && gens === 0) {
    S.exposed = true; e.armored = false; e.noLock = false;
    G.hud.flash('SHIELD DOWN · HIT THE HULL'); G.audio.boom(e.pos, 2); P.shake += 0.8;
    G.hud.radio(G.OFFICER.short, 'Her shield’s gone! Everything you have, into that hull. Aim for the bridge tower if you can.');
  }
  U.shieldM.uniforms.t.value = e.t; U.shieldM.uniforms.a.value += ((S.exposed ? 0 : 1) - U.shieldM.uniforms.a.value)*Math.min(1, dt*2); U.shield.visible = U.shieldM.uniforms.a.value > 0.02;
  // steer: toward the target, slowly; close to 1.4 km, then hold and turn to keep the bow on it
  const tgt = G.pickTarget(game, e, 6000, false) || P;
  SV.copy(tgt.pos).sub(e.pos); const dist = SV.length(), want = Math.atan2(SV.x, SV.z);
  let dy = want - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += Math.max(-0.07*dt, Math.min(0.07*dt, dy));
  const pitchW = Math.max(-0.35, Math.min(0.35, Math.atan2(SV.y, Math.hypot(SV.x, SV.z)))); S.pitch += (pitchW - S.pitch)*Math.min(1, dt*0.15);
  const spd = dist > 1400 ? 22 : 4;
  e.pos.x += Math.sin(e.yaw)*Math.cos(S.pitch)*spd*dt; e.pos.z += Math.cos(e.yaw)*Math.cos(S.pitch)*spd*dt; e.pos.y += Math.sin(S.pitch)*spd*dt;
  m.position.copy(e.pos); m.rotation.set(-S.pitch, e.yaw, Math.sin(e.t*0.2)*0.02); m.updateMatrixWorld(true);
  for (const p of e.parts) { p.mesh.getWorldPosition(p.pos); p.yaw = e.yaw; }
  // spinal cannon
  if (!e.noFire) {
    S.gunCd -= dt;
    if (S.charge < 0 && S.gunCd <= 0 && dist < 5000 && Math.abs(dy) < 0.5) { S.charge = 0; G.hud.flash('MAIN CANNON CHARGING · GET OUT OF ITS LINE'); G.audio.tone(90, 3.4, 'sawtooth', 0.06, 520); }
    if (S.charge >= 0) {
      S.charge += dt; U.chargeM.opacity = Math.min(1, S.charge/3.5); U.charge.scale.setScalar(0.5 + S.charge*0.6);
      if (S.charge >= 3.5) {
        S.charge = -1; S.gunCd = S.cd; U.chargeM.opacity = 0;
        U.muzzle.getWorldPosition(SV2); const dir = SV3.set(0, 0, 1).applyQuaternion(m.quaternion).normalize(), end = SV2.clone().addScaledVector(dir, 6000);
        game.fx.beam(SV2.clone(), end, 0xff7a4a, 14, 0.6); game.fx.beam(SV2.clone(), end, 0xffe0c0, 5, 0.5); G.audio.boom(SV2, 2.2); P.shake += 1;
        for (const who of [P, game.wing]) { if (!who.alive) continue; SV.copy(who.pos).sub(SV2); const along = SV.dot(dir); if (along < 0) continue; SV.addScaledVector(dir, -along);
          if (SV.length() < 34) { if (who === P) { P.damage(520*e.dmgMul, SV2.clone(), 'beam'); G.hud.flash('HIT BY THE MAIN CANNON'); } else who.hit(520*e.dmgMul); } }
      }
    }
    // fighters out of the side hangar
    S.launchCd -= dt;
    if (S.launchCd <= 0) { S.launchCd = 16*S.launchMul; const out = game.ents.filter(x => x.alive && x.fromCarrier).length;
      if (out < S.cap) { U.bay.getWorldPosition(SV); const side = SV2.set(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
        for (let k = 0; k < 2; k++) { const f = G.spawn(game, 'fighter', SV.x + side.x*k*16, SV.z + side.z*k*16 + k*12, {alt:SV.y}); f.fromCarrier = true; f.dir = side.clone(); f.zone = null; }
        G.hud.flash('FIGHTERS LAUNCHING'); } }
  }
  // the hull is solid
  for (const who of [P, game.wing]) {
    if (!who.alive) continue; SV.copy(who.pos); m.worldToLocal(SV);
    if (Math.abs(SV.x) < 48 && SV.y > -36 && SV.y < 34 && SV.z > -225 && SV.z < 260) {
      const up = SV.y > 0; SV.y = up ? 36 : -38; m.localToWorld(SV); who.pos.copy(SV);
      if (who === P) { P.vel.y = up ? Math.abs(P.vel.y) + 16 : -Math.abs(P.vel.y) - 16; if (P.speed !== undefined) P.speed *= 0.7;
        if (game.time - (S.bumpT || -9) > 1) { S.bumpT = game.time; P.damage(70, e.pos.clone(), 'impact'); P.shake += 0.6; G.hud.flash('HULL CONTACT'); } }
    }
  }
}
G.spawnCruiser = (game, o = {}) => {
  const P = game.player.pos, C = o.at || {x:P.x, z:P.z}, a = Math.atan2(P.x - C.x, P.z - C.z) + Math.PI*0.85, R = 4200;
  const e = G.spawn(game, 'cruiser', C.x + Math.sin(a)*R, C.z + Math.cos(a)*R, {alt:(o.alt || 120), tag:o.task !== undefined ? 'obj' : null});
  e.mesh.rotation.order = 'YXZ'; e.yaw = Math.atan2(C.x - e.pos.x, C.z - e.pos.z);
  e.armored = true; e.noLock = true; e.armorMsg = 'SHIELD UP · DESTROY THE THREE SHIELD GENERATORS'; e.bossBar = 'BATTLECRUISER DOMINANCE'; e.cash = 0;
  e.hp *= o.hpMul || 1; e.maxHp = e.hp; if (o.task !== undefined) e.task = o.task;
  e.bc = {pitch:0, charge:-1, gunCd:14, cd:o.gunCd || 15, launchCd:10, launchMul:o.launchMul || 1, cap:o.cap || 4, exposed:false};
  e.parts = []; const U = e.mesh.userData;
  const add = (type, mnt) => { const p = G.spawn(game, type, e.pos.x, e.pos.z, {alt:e.pos.y}); p.part = true; p.carrier = e; p.zone = null;
    if (type === 'shieldgen') { p.hp *= o.genMul || 1; p.maxHp = p.hp; }
    game.scene.remove(p.mesh); p.mesh.position.set(mnt[0], mnt[1], mnt[2]); p.mesh.rotation.set(0, 0, 0); p.mesh.scale.setScalar(type === 'shieldgen' ? 1.3 : 1.25); e.mesh.add(p.mesh); e.parts.push(p); return p; };
  U.mounts.flak.slice(0, o.flak || 8).forEach(mt => add('skyflak', mt)); U.mounts.mis.forEach(mt => add('skymis', mt)); U.mounts.gen.forEach(mt => add('shieldgen', mt));
  game.cruiser = e;
  return e;
};

/* Every frame in space: the station is solid to the player, wingman, bullets and missiles; mech mode needs a deck;
   the escape countdown runs; beacons blink. */
G.spaceTick = (game, dt) => {
  const W = game.world, P = game.player;
  W.update(dt, game.time);
  if (G.stationLive) {
    for (const who of [P, game.wing]) if (who.alive && G.stationPush(who.pos, 5)) {
      if (who === P && P.mode === 'jet') { if (game.time - (game.wallT || -9) > 0.8) { game.wallT = game.time; P.damage(40, null, 'impact'); P.shake += 0.6; G.hud.flash('HULL CONTACT'); } P.speed *= 0.6; }
    }
    for (const b of game.bullets) if (b.life > 0 && G.stationSolid(b.pos)) { b.life = 0; if (Math.random() < 0.3) game.fx.spark(b.pos.clone(), [1, 0.8, 0.5]); }
    for (const mi of game.missiles) if (mi.life > 0 && G.stationSolid(mi.pos)) { mi.life = 0; game.fx.explosion(mi.pos.clone(), 0.8); }
  }
  // no deck, no mech: outside the station's hangar the Kestrel switches to hover
  const onDeck = who => { const cv = W.carrier; return cv && Math.abs(who.pos.x - cv.x) < 49 && who.pos.z - cv.z > -288 && who.pos.z - cv.z < 304 && who.pos.y < cv.deck + 40 && who.pos.y > cv.deck - 2; };   // the Bastion's deck has gravity plating too
  const inside = (G.stationLive && G.inStation(P.pos)) || onDeck(P);
  if (P.alive && P.mode === 'mech' && !inside) { P.cd.mode = 0; P.setMode('hover'); G.hud.flash('NO DECK · MECH NEEDS GRAVITY'); }
  if (game.wing.alive && game.wing.mode === 'mech' && !(G.stationLive && G.inStation(game.wing.pos)) && !onDeck(game.wing)) game.wing.setMode('hover');
  if (game.escape && !game.escape.done) {
    game.escape.t -= dt; const t = game.escape.t;
    if (W.alarmM) W.alarmM.color.setHex(Math.floor(game.time*4) % 2 ? 0xff3a2a : 0x330a08);
    if (Math.random() < dt*3 && G.stationLive) { SV.set(ST.x + (Math.random() - 0.5)*2*ST.hw, ST.floor + Math.random()*ST.hh*2, ST.z + (Math.random() - 0.5)*2*ST.hd); game.fx.explosion(SV.clone(), 1.2 + Math.random()); }
    if (Math.floor(t) !== Math.floor(t + dt) && t < 10 && t > 0) G.audio.tone(880, 0.12, 'square', 0.05);
    if (t <= 0) G.stationBlow(game);
  }
};
})();
(function(){
const G = window.G, V3 = THREE.Vector3, ST = G.STATION;
/* Deaths: the core starts the escape countdown; a shield generator reports how many remain; the battlecruiser breaks
   up in a chain of blasts down its length and is gone. */
const baseKill = G.Game.prototype.kill;
G.Game.prototype.kill = function(e, by, info){
  if (e.type === 'cruiser') {
    e.dead = true; const m = e.mesh;
    for (const p of e.parts || []) if (p.alive) { p.alive = false; }
    for (let i = 0; i < 22; i++) this.later(i*0.18, () => { const q = new V3((Math.random() - 0.5)*80, (Math.random() - 0.5)*50, 220 - i*20); m.localToWorld(q); this.fx.explosion(q, 3 + Math.random()*3); G.audio.boom(q, 1.6); this.player.shake += 0.3; });
    this.later(4.2, () => { const c = e.pos.clone(); this.fx.explosion(c, 10); G.audio.boom(c, 3); this.player.shake += 2.5; this.scene.remove(m); });
    this.later(6, () => G.hud.radio(G.OFFICER.short, 'The Dominance is gone. That was the last ship they had up here. Kestrel... bring her home.'));
    G.hud.flash('BATTLECRUISER DOMINANCE IS BREAKING UP');
  }
  const r = baseKill.call(this, e, by, info);
  if (e.type === 'stationcore') { const c = e.pos.clone(); this.fx.explosion(c, 5); G.coreDown(this); this.scene.remove(e.mesh); }
  if (e.type === 'shieldgen' && e.carrier) { const n = e.carrier.parts.filter(p => p.type === 'shieldgen' && p.alive).length; if (n) G.hud.flash(`SHIELD GENERATOR DOWN · ${n} LEFT`); }
  return r;
};

/* ---------- Missions in space ---------- */
Object.assign(G.TASKS, {
  stationguns:{label:'Knock out the station’s defence turrets', short:'Station guns', n:() => 6, reward:1600, xp:200},
  dock:{label:'Land in the station’s hangar', short:'Dock', n:() => 1, reward:900, xp:120},
  bots:{label:'Destroy the security bots', short:'Security bots', n:() => 8, reward:1800, xp:220},
  core:{label:'Destroy the reactor core', short:'Reactor core', n:() => 1, reward:2200, xp:260},
  escape:{label:'Escape before the station blows', short:'Escape', n:() => 1, reward:1500, xp:200},
  cruiser:{label:'Destroy the battlecruiser', short:'Battlecruiser', n:() => 1, reward:6200, xp:700}
});
const baseText = G.taskText;
G.taskText = T => ({stationguns:`Knock out ${T.n} defence turrets on ${T.place}`, dock:`Fly into ${T.place}’s hangar and land on the deck`, bots:`Destroy ${T.n} security bots inside ${T.place}`,
  core:`Destroy the reactor core at the back of the hangar`, escape:`Get 2.5 km clear of ${T.place} before it blows`, cruiser:`Destroy the battlecruiser Dominance`})[T.kind] || baseText(T);

const basePlan = G.planMission;
G.planMission = function(m){
  if (!m.space) return basePlan(m);
  const r = G.rng(m.seed + 99), L = {flats:[], r, center:{x:ST.x, z:ST.z}, tasks:[], carrier:false, space:true};
  m.tasks.forEach((t, i) => {
    const at = t.at || ({stationguns:{x:ST.x, z:ST.z}, dock:{x:ST.x, z:ST.z - ST.hd + 40}, bots:{x:ST.x, z:ST.z}, core:{x:ST.x, z:ST.z + ST.hd - 70}, escape:{x:ST.x, z:ST.z - 2900}}[t.kind])
      || (() => { const a = r()*Math.PI*2, d = 1500 + r()*2200; return {x:Math.sin(a)*d, z:Math.cos(a)*d}; })();
    const markY = {stationguns:ST.y + ST.hh + 60, dock:ST.floor + 30, bots:ST.floor + 30, core:ST.floor + 40, escape:ST.y}[t.kind] ?? (t.y ?? 200);
    L.tasks.push(Object.assign({}, t, {i, C:at, markY, groups:[], path:null}));
  });
  return L;
};

const baseSpawn = G.spawnMission;
G.spawnMission = function(game, L){
  if (!L.space) return baseSpawn(game, L);
  const r = L.r, tag = (e, i) => { e.tag = 'obj'; e.task = i; return e; };
  for (const T of L.tasks) {
    if (T.kind === 'stationguns') {   // turrets on the roof corners and the ring
      const spots = [[-117.5, -203.5], [117.5, -203.5], [-117.5, 203.5], [117.5, 203.5], [0, -520], [0, 520], [-450.3, 260], [450.3, -260]];   // roof-corner pads, then the middle of ring sides
      for (let k = 0; k < T.n; k++) { const s = spots[k % spots.length], y = Math.abs(s[0]) > 300 || Math.abs(s[1]) > 300 ? ST.y + 22 : ST.y + ST.hh + ST.t;
        const e = tag(G.spawn(game, k % 3 === 2 ? 'skymis' : 'skyflak', ST.x + s[0], ST.z + s[1], {alt:y}), T.i); e.carrier = {alive:true}; e.onStation = true; e.zone = null; }
    } else if (T.kind === 'bots') {
      for (let k = 0; k < T.n; k++) { const q = {x:ST.x + (r() - 0.5)*2*(ST.hw - 40), z:ST.z - ST.hd*0.2 + r()*(ST.hd*1.0)}; G.stationClamp(q, 30); const x = q.x, z = q.z;
        const e = tag(G.spawn(game, k % 3 === 2 ? 'reaver' : 'mech', x, z, {}), T.i); e.inStation = true; e.pos.y = ST.floor; e.zone = {x:ST.x, z:ST.z}; }
    } else if (T.kind === 'core') {
      const e = tag(G.spawn(game, 'stationcore', ST.x, ST.z + ST.hd - 70, {alt:ST.floor + 40}), T.i); e.pos.y = ST.floor + 40; e.mesh.position.copy(e.pos); e.onStation = true; e.zone = null;
    } else if (T.kind === 'air' && T.early) {
      for (let k = 0; k < T.n; k++) { const a = r()*6.28, e = tag(G.spawn(game, 'fighter', T.C.x + Math.sin(a)*600, T.C.z + Math.cos(a)*600, {alt:150 + r()*300}), T.i); }
      T.spawnedN = T.n;
    }
  }
  game.spawnAces = () => {};
  game.ops = new G.Ops(game, L);
};

const baseDone = G.Ops.prototype.isDone, baseProg = G.Ops.prototype.progress, baseUpd = G.Ops.prototype.update, baseMarks = G.Ops.prototype.marks;
G.Ops.prototype.isDone = function(T){
  const g = this.g, P = g.player;
  if (T.kind === 'dock') return !!T.docked;
  if (T.kind === 'escape') return !!(g.escape && g.escape.done && P.alive);
  if (T.kind === 'cruiser') return T.spawnedN >= 1 && this.alive(T) === 0;
  return baseDone.call(this, T);
};
G.Ops.prototype.progress = function(T){
  if (T.kind === 'dock') return [T.docked ? 1 : 0, 1];
  if (T.kind === 'escape') return [this.g.escape && this.g.escape.done ? 1 : 0, 1];
  return baseProg.call(this, T);
};
G.Ops.prototype.update = function(dt){
  const g = this.g, P = g.player;
  if (!g.world.space) return baseUpd.call(this, dt);
  const T = this.tasks[this.cur];
  if (T && !this.rtb) {
    if (T.kind === 'dock' && !T.docked) {
      const ins = G.inStation(P.pos) && P.pos.y < ST.floor + 30 && P.mode !== 'jet';
      T.dockT = ins ? (T.dockT || 0) + dt : 0;
      if (T.dockT > 1.5) { T.docked = true; G.hud.flash('DOCKED · ARTIFICIAL GRAVITY'); G.hud.radio(G.OFFICER.short, 'You’re in. Gravity plating’s working in there, so the mech will hold. Find their security bots before they find you.'); }
    }
    if (T.kind === 'escape' && !T.arrived) { T.arrived = true; T.spawnedN = 1; }
    if (T.kind === 'cruiser' && !T.arrived && Math.hypot(P.pos.x - T.C.x, P.pos.z - T.C.z) < 4000) {
      T.arrived = true; G.spawnCruiser(g, {task:T.i, at:T.C, hpMul:T.hpMul, genMul:T.genMul, launchMul:T.launchMul, cap:T.cap, gunCd:T.gunCd, flak:T.flak}); T.spawnedN = 1;
      G.hud.flash('BATTLECRUISER DOMINANCE · BEARING DOWN');
      G.hud.radio(G.OFFICER.short, 'There she is. Four hundred metres of trouble. Shield generators first, three of them on her back, then the hull. And whatever you do, don’t sit in front of that bow when it starts glowing.');
      if (T.vesper) g.later(25, () => { G.spawnHollow(g, {at:T.C, escorts:1, name:'Vesper', hpMul:5, lastWords:'Again... you...'}); G.hud.radio('Vesper', 'You left me drifting, Kestrel. I came back for you.'); });
      if (g.m.story) G.storyRadio(g, 'arrive', T.i);
    }
  }
  const wasRtb = this.rtb;
  baseUpd.call(this, dt);
  if (this.rtb && !wasRtb) {   // in space there is no deck to land on: the sortie ends a few seconds after the last objective
    G.hud.radio('Bastion', 'All objectives complete. Burn for home, Kestrel. We’ll pick you up on the way down.');
    g.later(5, () => { if (!g.over) g.end(true, 'All objectives complete'); });
  }
};
G.Ops.prototype.marks = function(){
  const g = this.g;
  if (!g.world.space) return baseMarks.call(this);
  const T = this.tasks[this.cur], want = !this.rtb && T ? {pos:new V3(T.C.x, T.markY, T.C.z), label:`WP${T.i + 1}`, color:'#ffb238'} : null, key = want ? want.label : '';
  if (key === this.markKey) return;
  if (this.mark) { const k = g.marks.indexOf(this.mark); if (k >= 0) g.marks.splice(k, 1); }
  this.mark = want; this.markKey = key; if (want) g.marks.push(want);
};
})();
