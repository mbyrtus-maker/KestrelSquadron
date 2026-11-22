(function(){
'use strict';
/* ==========================================================================================================
   Volume 4: Space. A space world (no terrain or sea: a starfield, a planet far below and hard sunlight), the Varn
   orbital station "Tessaract" with a walkable hangar inside (artificial gravity), its reactor core and the escape
   countdown, and the Varn battlecruiser "Dominance" (the volume's last boss).
   ========================================================================================================== */
const G = window.G, V3 = THREE.Vector3;
const SV = new V3(), SV2 = new V3(), SV3 = new V3();

/* The station: a hub box with a hollow hangar inside. Its mouth opens on the -z face (toward where pilots arrive).
   Cavity: x and z within hw/hd of the centre, y from the floor (cy - hh) to the ceiling (cy + hh). Walls are t thick.
   The deck sits at y = 2 so walkers treat it as dry land (and the open space around it, at -900, as somewhere they cannot step). */
const ST = G.STATION = {x:0, y:62, z:1400, hw:240, hh:60, hd:240, t:22, mw:80, mh:64};
ST.floor = ST.y - ST.hh;
G.inStation = (p, m = 0) => Math.abs(p.x - ST.x) < ST.hw - m && Math.abs(p.z - ST.z) < ST.hd - m && p.y > ST.floor - 2 && p.y < ST.y + ST.hh - m;
// Solid parts of the station (walls, roof, floor slab) plus interior pillars. Returns the push-out vector length or 0.
const PILLARS = [[-120, 60], [120, 60], [-120, -80], [120, -80]];   // x, z offsets from the centre; 16 m square, floor to ceiling
G.stationSolid = (p, r = 0) => {
  if (!G.stationLive) return false;
  const lx = p.x - ST.x, ly = p.y - ST.y, lz = p.z - ST.z;
  const ox = ST.hw + ST.t + r, oy = ST.hh + ST.t + r, oz = ST.hd + ST.t + r;
  if (Math.abs(lx) > ox || Math.abs(ly) > oy || Math.abs(lz) > oz) return false;                  // outside the hull
  const inCav = Math.abs(lx) < ST.hw - r && Math.abs(lz) < ST.hd - r && ly > -ST.hh + r && ly < ST.hh - r;
  const inMouth = lz < 0 && Math.abs(lx) < ST.mw - r && ly > -ST.hh + r && ly < -ST.hh + ST.mh - r;  // the tunnel through the -z wall
  if (inMouth) return false;
  if (inCav) { for (const [px, pz] of PILLARS) if (Math.abs(lx - px) < 8 + r && Math.abs(lz - pz) < 8 + r) return true; return false; }
  return true;
};
// Push a point out of the station's solid parts along the shallowest axis; returns true if it moved.
G.stationPush = (p, r) => {
  if (!G.stationSolid(p, r)) return false;
  const lx = p.x - ST.x, ly = p.y - ST.y, lz = p.z - ST.z;
  // Inside the cavity footprint: we're in a pillar, or poking into the floor/roof/walls from inside.
  const inside = Math.abs(lx) < ST.hw && Math.abs(lz) < ST.hd && Math.abs(ly) < ST.hh;
  if (inside) {
    for (const [px, pz] of PILLARS) { const dx = lx - px, dz = lz - pz;
      if (Math.abs(dx) < 8 + r && Math.abs(dz) < 8 + r) { const qx = 8 + r - Math.abs(dx), qz = 8 + r - Math.abs(dz); if (qx < qz) p.x += Math.sign(dx || 1)*qx; else p.z += Math.sign(dz || 1)*qz; return true; } }
    const c = [[ST.hw - r - lx, 'x', -1], [lx + ST.hw - r, 'x', 1], [ST.hh - r - ly, 'y', -1], [ly + ST.hh - r, 'y', 1], [ST.hd - r - lz, 'z', -1], [lz + ST.hd - r, 'z', 1]];
    let best = null; for (const k of c) if (k[0] < 0 && (!best || k[0] > best[0])) best = k;
    if (!best) return false; p[best[1]] += best[2]*best[0]; return true;
  }
  const ox = ST.hw + ST.t + r, oy = ST.hh + ST.t + r, oz = ST.hd + ST.t + r;
  const c = [[ox - lx, 'x', 1], [ox + lx, 'x', -1], [oy - ly, 'y', 1], [oy + ly, 'y', -1], [oz - lz, 'z', 1], [oz + lz, 'z', -1]];
  let best = c[0]; for (const k of c) if (k[0] < best[0]) best = k;
  p[best[1]] += best[2]*best[0]; return true;
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
function hullTexture(base, line, seed){
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); let s = seed; const R = () => (s = (s*16807) % 2147483647)/2147483647;
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) { { const v = R() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${0.03 + R()*0.06})`; } x.fillRect(R()*512, R()*512, 20 + R()*160, 10 + R()*90); }
  x.strokeStyle = line; x.lineWidth = 2; for (let k = 0; k < 512; k += 64) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 512); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(512, k); x.stroke(); }
  for (let i = 0; i < 40; i++) { x.strokeRect(Math.floor(R()*8)*64 + 4, Math.floor(R()*8)*64 + 4, 56, 24 + Math.floor(R()*2)*32); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
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
  height(x, z){ if (this.station && G.stationLive && Math.abs(x - ST.x) < ST.hw && Math.abs(z - ST.z) < ST.hd) return ST.floor; return this.floor; }
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
    const {rbox, cyl, M} = G.geo, g = new THREE.Group(); g.position.set(ST.x, ST.y, ST.z); scene.add(g); this.station = g; G.stationLive = true;
    const tex = hullTexture('#8d939a', 'rgba(20,24,30,0.35)', 5); tex.repeat.set(6, 6);
    const hullM = new THREE.MeshStandardMaterial({color:0x9aa0a8, map:tex, roughness:0.6, metalness:0.45});
    const darkM = new THREE.MeshStandardMaterial({color:0x2a2e35, roughness:0.7, metalness:0.4}), redM = new THREE.MeshStandardMaterial({color:0x8a2e27, roughness:0.6, metalness:0.3});
    const ftex = hullTexture('#4a4f57', 'rgba(255,200,80,0.25)', 9); ftex.repeat.set(10, 10);
    const floorM = new THREE.MeshStandardMaterial({color:0x5a6069, map:ftex, roughness:0.75, metalness:0.35});
    const inM = new THREE.MeshStandardMaterial({color:0x6c727b, map:tex, roughness:0.7, metalness:0.35, side:THREE.DoubleSide});
    const lampM = new THREE.MeshBasicMaterial({color:0xffe6b0}), redLamp = this.alarmM = new THREE.MeshBasicMaterial({color:0xff3a2a}), cyanM = new THREE.MeshBasicMaterial({color:0x6fe3ff});
    const W = ST.hw, H = ST.hh, D = ST.hd, T = ST.t;
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
    // walls: floor slab, roof, the two sides, the back, and the front wall in three pieces around the mouth
    box(2*W + 2*T, T, 2*D + 2*T, hullM, 0, -H - T/2, 0); box(2*W + 2*T, T, 2*D + 2*T, hullM, 0, H + T/2, 0);
    box(T, 2*H, 2*D + 2*T, hullM, -W - T/2, 0, 0); box(T, 2*H, 2*D + 2*T, hullM, W + T/2, 0, 0); box(2*W, 2*H, T, hullM, 0, 0, D + T/2);
    box(W - ST.mw, 2*H, T, hullM, -(W + ST.mw)/2, 0, -D - T/2); box(W - ST.mw, 2*H, T, hullM, (W + ST.mw)/2, 0, -D - T/2);
    box(2*ST.mw, 2*H - ST.mh, T, hullM, 0, -H + ST.mh + (2*H - ST.mh)/2, -D - T/2);
    // interior surfaces (a darker lining so the inside reads as a hangar), the deck, pillars, catwalks and ceiling lights
    const lin = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), inM); b.position.set(x, y, z); b.receiveShadow = true; g.add(b); };
    lin(2*W, 0.5, 2*D, 0, H - 0.3, 0); lin(0.5, 2*H, 2*D, -W + 0.3, 0, 0); lin(0.5, 2*H, 2*D, W - 0.3, 0, 0); lin(2*W, 2*H, 0.5, 0, 0, D - 0.3);
    { const fl = new THREE.Mesh(new THREE.PlaneGeometry(2*W, 2*D), floorM); fl.rotation.x = -Math.PI/2; fl.position.y = -H + 0.05; fl.receiveShadow = true; g.add(fl); }
    for (const [px, pz] of PILLARS) { box(16, 2*H, 16, hullM, px, 0, pz); box(17, 2, 17, darkM, px, -H + 1, pz); box(17, 2, 17, darkM, px, H - 1, pz); box(2, 2*H - 6, 17.2, lampM, px, 0, pz).castShadow = false; }
    for (const s of [-1, 1]) { box(14, 1.2, 2*D - 40, darkM, s*(W - 8), 10, 0); for (let z = -D + 30; z < D - 20; z += 40) box(1, 10, 1, darkM, s*(W - 14), 15, z); }   // catwalks along the side walls
    for (let x = -W + 60; x < W; x += 120) for (let z = -D + 60; z < D; z += 120) box(30, 0.6, 6, lampM, x, H - 1, z).castShadow = false;
    for (let x = -W + 20; x < W; x += 40) { box(10, 0.3, 2, cyanM, x, -H + 0.25, -D + 30).castShadow = false; }   // landing line by the mouth
    // hangar mouth: lit frame and hazard stripes; "TESSARACT" in Varn red
    for (const s of [-1, 1]) { box(4, ST.mh, 3, redM, s*(ST.mw + 2), -H + ST.mh/2, -D - T - 1.5); for (let y = -H + 4; y < -H + ST.mh; y += 8) box(1.2, 4, 1, lampM, s*(ST.mw + 4.5), y, -D - T - 3).castShadow = false; }
    box(2*ST.mw + 8, 4, 3, redM, 0, -H + ST.mh + 2, -D - T - 1.5);
    // exterior detail: lit window bands on every wall, roof modules and radiator fins, docking arms beside the mouth
    const winM = new THREE.MeshBasicMaterial({color:0xffd9a0});
    for (const y of [-30, 10, 40]) { for (const s of [-1, 1]) { const b = box(1, 3, 2*D - 40, winM, s*(W + T + 0.6), y, 0); b.castShadow = false; }
      const bb = box(2*W - 40, 3, 1, winM, 0, y, D + T + 0.6); bb.castShadow = false; }
    for (const [x, z, w, h, d] of [[-150, -120, 70, 18, 50], [140, -60, 60, 26, 80], [-60, 130, 90, 14, 60], [160, 150, 40, 34, 40], [-170, 40, 30, 12, 110]]) { box(w, h, d, hullM, x, H + T + h/2, z); box(w + 2, 2, d + 2, darkM, x, H + T + h + 1, z); }
    for (let k = 0; k < 6; k++) box(2, 30, 60, darkM, -40 + k*16, H + T + 15, -150);
    for (const s of [-1, 1]) { box(14, 14, 140, darkM, s*(ST.mw + 40), -H + 20, -D - T - 70); box(30, 4, 30, redM, s*(ST.mw + 40), -H + 29, -D - T - 135); }
    // the outer ring on spokes, solar arrays, antenna mast and beacons
    const ring = new THREE.Mesh(new THREE.TorusGeometry(520, 22, 12, 96), hullM); ring.rotation.x = Math.PI/2; ring.castShadow = true; g.add(ring);
    for (let k = 0; k < 4; k++) { const a = k*Math.PI/2 + Math.PI/4, sp = new THREE.Mesh(new THREE.BoxGeometry(16, 14, 520 - 320), darkM); sp.position.set(Math.sin(a)*420, 0, Math.cos(a)*420); sp.rotation.y = a; sp.castShadow = true; g.add(sp); }
    for (let k = 0; k < 24; k++) { const a = k/24*Math.PI*2, b = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 40), k % 4 ? hullM : redM); b.position.set(Math.sin(a)*520, 0, Math.cos(a)*520); b.rotation.y = a; g.add(b); }   // ring habitat modules
    const solarM = new THREE.MeshStandardMaterial({color:0x1a2a55, emissive:0x0a1430, roughness:0.25, metalness:0.7});
    for (const s of [-1, 1]) { box(400, 6, 10, darkM, s*(560 + 200), 0, 0);
      for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(80, 1.2, 220), solarM); p.position.set(s*(620 + k*90), 0, 0); p.castShadow = true; g.add(p); } }
    box(6, 240, 6, darkM, 0, H + T + 120, 120); box(40, 3, 40, darkM, 0, H + T + 240, 120); const dish = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 10, 0, Math.PI*2, 0, Math.PI/2.5), hullM); dish.position.set(0, H + T + 250, 120); g.add(dish);
    this.beacons = [];
    for (const [x, y, z] of [[W + T, H + T, -D - T], [-W - T, H + T, -D - T], [W + T, H + T, D + T], [-W - T, H + T, D + T], [0, H + T + 245, 120], [-520, 22, 0], [520, 22, 0]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), redLamp); b.position.set(x, y + 3, z); g.add(b); this.beacons.push(b); }
    // interior lights: the sun can't reach in, so the hangar has its own
    this.inLights = [];
    for (const [x, z] of [[0, -150], [0, 40], [0, 180]]) { const L = new THREE.PointLight(0xffe2b8, 1.4, 420, 1.6); L.position.set(ST.x + x, ST.y + H - 12, ST.z + z); scene.add(L); this.inLights.push(L); }
    // the reactor chamber at the back: a stepped pedestal and cage (the core itself is an entity)
    box(80, 6, 80, darkM, 0, -H + 3, D - 70); box(60, 6, 60, hullM, 0, -H + 9, D - 70);
    for (let k = 0; k < 8; k++) { const a = k/8*Math.PI*2; box(3, 2*H - 12, 3, darkM, Math.sin(a)*34, 0, D - 70 + Math.cos(a)*34); }
    for (const y of [-20, 20, 48]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(34, 1.5, 6, 32), darkM); rg.rotation.x = Math.PI/2; rg.position.set(0, y, D - 70); g.add(rg); }
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
  const coreM = u.coreM = new THREE.MeshStandardMaterial({color:0x7fe9ff, emissive:0x36c9ff, emissiveIntensity:2.2, roughness:0.2});
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(12, 2), coreM));
  u.rings = [];
  for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(17 + k*3, 0.9, 8, 48), new THREE.MeshStandardMaterial({color:0x3a3f47, roughness:0.5, metalness:0.6})); r.rotation.set(k*1.1, k*0.7, 0); g.add(r); u.rings.push(r); }
  u.light = new THREE.PointLight(0x5fd8ff, 2.2, 260, 1.5); g.add(u.light);
  return g;
}
function buildGen(){
  const {rbox, cyl, M} = G.geo, g = new THREE.Group(), u = g.userData;
  const dk = new THREE.MeshStandardMaterial({color:0x30343b, roughness:0.6, metalness:0.5});
  g.add(M(cyl(9, 11, 5, 16), dk, 0, 2.5, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI*2, 0, Math.PI/2), u.domeM = new THREE.MeshStandardMaterial({color:0x7fe0ff, emissive:0x2bb8ff, emissiveIntensity:1.4, roughness:0.15}));
  dome.position.y = 5; g.add(dome);
  u.ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.8, 6, 32), dk); u.ring.rotation.x = Math.PI/2; u.ring.position.y = 7; g.add(u.ring);
  for (let k = 0; k < 4; k++) { const a = k*Math.PI/2, f = M(rbox(1.2, 9, 3, 0.2), dk, Math.sin(a)*9, 6, Math.cos(a)*9); f.rotation.y = a; g.add(f); }
  return g;
}
/* The Dominance: a 420 m Varn battlecruiser. Arrowhead hull with a raised spine, a bridge tower aft, a spinal cannon
   through the bow, four main engines, a side hangar, and a shield bubble that holds while its generators live. */
function buildCruiser(){
  const g = new THREE.Group(), u = g.userData;
  const tex = hullTexture('#9aa0a8', 'rgba(0,0,0,0.4)', 17); tex.repeat.set(0.02, 0.02); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const hullM = new THREE.MeshStandardMaterial({color:0x8c929b, map:tex, roughness:0.5, metalness:0.55}), darkM = new THREE.MeshStandardMaterial({color:0x22262c, roughness:0.6, metalness:0.5});
  const redM = new THREE.MeshStandardMaterial({color:0x9a2e26, roughness:0.55, metalness:0.3}), lampM = new THREE.MeshBasicMaterial({color:0xffb38a}), engM = new THREE.MeshBasicMaterial({color:0x9fd8ff});
  const ext = (pts, y0, h, m) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z));
    const geo = new THREE.ExtrudeGeometry(sh, {depth:h, bevelEnabled:true, bevelThickness:2, bevelSize:2, bevelSegments:1}); geo.rotateX(-Math.PI/2); geo.translate(0, y0, 0);
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh; };
  ext([[0, 215], [42, 110], [46, -150], [32, -205], [-32, -205], [-46, -150], [-42, 110]], -22, 44, hullM);                  // main hull
  ext([[0, 170], [22, 90], [26, -120], [16, -170], [-16, -170], [-26, -120], [-22, 90]], 22, 8, hullM);                      // raised spine
  ext([[0, 150], [12, 60], [12, -160], [-12, -160], [-12, 60]], -34, 12, darkM);                                             // keel
  const bx = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  // swept weapon wings amidships, dark armour belts, a stern dorsal fin and a ventral fin
  for (const s of [-1, 1]) { const wg = ext([[s*44, 30], [s*96, -70], [s*100, -110], [s*44, -90]].map(([x, z]) => [x, z]), -6, 6, hullM);
    bx(10, 10, 46, darkM, s*92, -2, -95); bx(4, 4, 30, redM, s*92, 5, -95);
    for (let z = 150; z > -190; z -= 34) bx(2.5, 30, 22, darkM, s*45.2, -4, z); }
  { const df = new THREE.Shape(); df.moveTo(0, 0); df.lineTo(-60, 0); df.lineTo(-80, 46); df.lineTo(-44, 46); const dg = new THREE.ExtrudeGeometry(df, {depth:4, bevelEnabled:false}); dg.rotateY(-Math.PI/2); dg.translate(2, 30, -150);
    const fm = new THREE.Mesh(dg, hullM); fm.castShadow = true; g.add(fm); const vg = dg.clone(); vg.scale(1, -0.6, 1); const vm = new THREE.Mesh(vg, darkM); vm.position.y = 0; g.add(vm); }
  bx(28, 26, 34, hullM, 0, 44, -110); bx(32, 6, 38, darkM, 0, 59, -110); bx(26, 3, 1, lampM, 0, 52, -92.6);                   // bridge tower and its window band
  bx(4, 40, 4, darkM, 0, 82, -118); bx(18, 2, 2, darkM, 0, 96, -118);                                                       // mast
  for (const s of [-1, 1]) { bx(2, 6, 300, redM, s*45.5, 0, -20); bx(1, 2, 260, lampM, s*44.5, 14, -20); }                   // red flank stripes and running lights
  // spinal cannon: barrel out of the bow with a charge glow at the muzzle
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 70, 16).rotateX(Math.PI/2), darkM); barrel.position.set(0, -2, 230); g.add(barrel);
  for (let k = 0; k < 4; k++) bx(18, 18, 3, hullM, 0, -2, 205 + k*14);
  u.muzzle = new THREE.Object3D(); u.muzzle.position.set(0, -2, 268); g.add(u.muzzle);
  u.chargeM = new THREE.MeshBasicMaterial({color:0xff6a3a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending});
  u.charge = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 10), u.chargeM); u.charge.position.copy(u.muzzle.position); g.add(u.charge);
  // engines
  for (const [x, y] of [[-24, -8], [24, -8], [-24, 12], [24, 12]]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 24, 16).rotateX(Math.PI/2), darkM); n.position.set(x, y, -214); g.add(n);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(9.5, 16).rotateY(Math.PI), engM); gl.position.set(x, y, -226.2); g.add(gl);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 16, 1, true).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x6fc8ff, transparent:true, opacity:0.35, depthWrite:false, blending:THREE.AdditiveBlending})); plume.position.set(x, y, -258); g.add(plume); }
  // side hangar (starboard) and its lights; fighters launch from here
  bx(2, 18, 60, darkM, 46.8, 0, 40); for (let z = 14; z <= 66; z += 8) bx(1, 1.5, 3, lampM, 47.9, 10, z);
  u.bay = new THREE.Object3D(); u.bay.position.set(60, 0, 40); g.add(u.bay);
  // shield bubble
  u.shieldM = new THREE.ShaderMaterial({transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, uniforms:{a:{value:1}, t:{value:0}},
    vertexShader:'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }',
    fragmentShader:'uniform float a; uniform float t; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hx = 0.5 + 0.5*sin(vP.z*0.25 + t*3.0)*sin(vP.x*0.4 + vP.y*0.4); gl_FragColor = vec4(vec3(0.35,0.8,1.0)*(f*1.2 + 0.05 + 0.08*hx), (f*0.9 + 0.04)*a); }'});
  u.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), u.shieldM); u.shield.scale.set(80, 70, 260); g.add(u.shield);
  // mounts (local): heavy turrets along the flanks, missile batteries on the spine, three shield generators
  u.mounts = {flak:[[-30, 22, 125], [30, 22, 125], [-36, 22, 40], [36, 22, 40], [-38, 22, -50], [38, 22, -50], [-34, 22, -150], [34, 22, -150]],
    mis:[[0, 30, 120], [0, 30, -40]], gen:[[0, 30, 40], [-30, 22, -100], [30, 22, -100]]};
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
      e.pos.x = Math.max(ST.x - ST.hw + 12, Math.min(ST.x + ST.hw - 12, e.pos.x)); e.pos.z = Math.max(ST.z - ST.hd + 12, Math.min(ST.z + ST.hd - 12, e.pos.z));
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
  const inside = G.stationLive && G.inStation(P.pos);
  if (P.alive && P.mode === 'mech' && !inside) { P.cd.mode = 0; P.setMode('hover'); G.hud.flash('NO DECK · MECH NEEDS GRAVITY'); }
  if (game.wing.alive && game.wing.mode === 'mech' && !(G.stationLive && G.inStation(game.wing.pos))) game.wing.setMode('hover');
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
      const spots = [[-200, -200], [200, -200], [-200, 200], [200, 200], [0, -520], [0, 520], [-520, 0], [520, 0]];
      for (let k = 0; k < T.n; k++) { const s = spots[k % spots.length], y = Math.abs(s[0]) > 300 || Math.abs(s[1]) > 300 ? ST.y + 22 : ST.y + ST.hh + ST.t;
        const e = tag(G.spawn(game, k % 3 === 2 ? 'skymis' : 'skyflak', ST.x + s[0], ST.z + s[1], {alt:y}), T.i); e.carrier = {alive:true}; e.onStation = true; e.zone = null; }
    } else if (T.kind === 'bots') {
      for (let k = 0; k < T.n; k++) { const x = ST.x + (r() - 0.5)*2*(ST.hw - 40), z = ST.z - ST.hd*0.2 + r()*(ST.hd*1.0);
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
