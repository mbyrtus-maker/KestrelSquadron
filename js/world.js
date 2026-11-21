(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3;

G.rng = function(seed){
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};
G.Noise = function(seed){
  const r = G.rng(seed), perm = new Uint8Array(512), val = new Float32Array(256);
  const p = []; for (let i = 0; i < 256; i++) { p.push(i); val[i] = r()*2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r()*(i+1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const h = (a, b) => val[perm[(perm[a & 255] + b) & 255]];
  const n2 = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
    const a = h(xi, zi), b = h(xi+1, zi), c = h(xi, zi+1), d = h(xi+1, zi+1);
    return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
  };
  return (x, z, oct = 4) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += n2(x*f + i*17.3, z*f - i*9.1)*amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  };
};

/* ---------- Terrain world ---------- */
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };
let DETAIL = null;
function detailTex(){
  if (DETAIL) return DETAIL;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#d2d0cc'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 12000; i++) { const v = 120 + Math.random()*135 | 0; x.fillStyle = `rgba(${v},${v},${v},0.55)`; x.fillRect(Math.random()*256, Math.random()*256, 1 + Math.random()*2, 1 + Math.random()*2); }
  for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + Math.random()*0.08})`; x.beginPath(); x.ellipse(Math.random()*256, Math.random()*256, 6 + Math.random()*24, 4 + Math.random()*14, Math.random()*3, 0, 7); x.fill(); }
  DETAIL = new THREE.CanvasTexture(c); DETAIL.wrapS = DETAIL.wrapT = THREE.RepeatWrapping; DETAIL.repeat.set(260, 260); DETAIL.anisotropy = 8;
  return DETAIL;
}

G.World = class {
  constructor(scene, opts){
    this.scene = scene; this.noise = G.Noise(opts.seed); this.rand = G.rng(opts.seed + 7);
    this.flats = (opts.flats || []).map(f => Object.assign({}, f));
    for (const f of this.flats) if (f.h === undefined) f.h = Math.max(this.raw(f.x, f.z), 14);
    const S = this.S = 18000, N = this.N = 512, st = this.step = S / N, W = N + 1;
    this.h = new Float32Array(W*W);
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      let h = this.shape(-S/2 + ix*st, -S/2 + iz*st);
      if (h < 1.6) h -= (1.6 - h)*1.3;   // drop the shoreline away from the waterline so the two never overlap
      this.h[iz*W + ix] = h;
    }

    const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI/2);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count*3), n = this.noise;
    const HI = this.hi = G.gfx && G.gfx.hi(), spA = HI ? new Float32Array(pos.count*4) : null, spB = HI ? new Float32Array(pos.count*4) : null;
    for (let i = 0; i < pos.count; i++) {
      const ix = i % W, iz = (i / W) | 0, hh = this.h[i], x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, hh);
      const hx1 = this.h[iz*W + Math.min(ix + 1, N)], hx0 = this.h[iz*W + Math.max(ix - 1, 0)];
      const hz1 = this.h[Math.min(iz + 1, N)*W + ix], hz0 = this.h[Math.max(iz - 1, 0)*W + ix];
      const slope = Math.hypot(hx1 - hx0, hz1 - hz0)/(2*st);
      const v1 = n(x*0.0035, z*0.0035, 3), v2 = n(x*0.025 + 9, z*0.025, 2), lum = 0.92 + v2*0.16;
      const dry = sm(-0.25, 0.35, v1 + (hh - 60)/400);
      // Muted olive-drab scrub that dries to khaki, broken up by churned bare earth.
      let r = (0.215 + 0.125*dry)*lum, g = (0.255 + 0.06*dry)*lum, b = (0.145 + 0.055*dry)*lum;
      const forest = sm(0.0, 0.2, n(x*0.003 + 31, z*0.003 - 17, 3));
      r -= 0.05*forest; g -= 0.035*forest; b -= 0.035*forest;
      const mud = sm(0.12, 0.42, n(x*0.0075 + 50, z*0.0075 - 80, 3))*0.6;
      r += (0.27*lum - r)*mud; g += (0.225*lum - g)*mud; b += (0.165*lum - b)*mud;
      const sand = sm(4, 0.5, hh);
      r += (0.47 - r)*sand; g += (0.44 - g)*sand; b += (0.36 - b)*sand;
      if (hh < -2) { const w = sm(-2, -12, hh); r += (0.33 - r)*w; g += (0.35 - g)*w; b += (0.3 - b)*w; }
      const rock = Math.min(1, sm(0.32, 0.7, slope) + sm(170, 245, hh)*0.55);
      const rl = 0.9 + v2*0.2; r += (0.34*rl - r)*rock; g += (0.33*rl - g)*rock; b += (0.31*rl - b)*rock;
      const snow = sm(340, 400, hh + v1*40)*(1 - sm(0.7, 1.0, slope));
      r += (0.93 - r)*snow; g += (0.94 - g)*snow; b += (0.97 - b)*snow;
      const fs = this.flatW(x, z);
      if (fs > 0) { const fl = 0.82 + v2*0.2; r += (0.37*fl - r)*fs; g += (0.36*fl - g)*fs; b += (0.335*fl - b)*fs; }   // oil-stained hardstand
      cols[i*3] = r; cols[i*3 + 1] = g; cols[i*3 + 2] = b;
      if (HI) {
        // Splat weights for the photo-textured ground: grass, dirt, rock, sand | snow, hardstand, forest shade, brightness.
        let wg = 1, wd = Math.min(1, mud*1.5 + dry*0.55), wr = 0, ws = 0, wn = 0, wp = 0;
        wg -= wd;
        const sw = Math.max(sand, hh < -2 ? 1 : 0), mixIn = (k) => { wg *= 1 - k; wd *= 1 - k; wr *= 1 - k; ws *= 1 - k; wn *= 1 - k; wp *= 1 - k; };
        mixIn(sw); ws += sw; mixIn(rock); wr += rock; mixIn(snow); wn += snow; mixIn(fs); wp += fs;
        spA[i*4] = wg; spA[i*4 + 1] = wd; spA[i*4 + 2] = wr; spA[i*4 + 3] = ws;
        spB[i*4] = wn; spB[i*4 + 1] = wp; spB[i*4 + 2] = forest*(1 - rock)*(1 - fs); spB[i*4 + 3] = lum;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    if (HI) { geo.setAttribute('splatA', new THREE.BufferAttribute(spA, 4)); geo.setAttribute('splatB', new THREE.BufferAttribute(spB, 4)); }
    this.terrain = new THREE.Mesh(geo, HI ? G.gfx.terrainMaterial() : new THREE.MeshStandardMaterial({vertexColors:true, map:detailTex(), roughness:0.97, metalness:0}));
    this.terrain.receiveShadow = true; scene.add(this.terrain);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(S*4, S*4).rotateX(-Math.PI/2),
      HI ? new THREE.MeshStandardMaterial({color:0x101d22, roughness:0.12, metalness:0.2, envMapIntensity:1.0, normalMap:G.gfx.tex.sand_n, normalScale:new THREE.Vector2(0.18, 0.18)})
         : new THREE.MeshStandardMaterial({color:0x14262d, roughness:0.3, metalness:0.1, envMapIntensity:0.3}));
    if (HI) { const nm = water.material.normalMap = G.gfx.tex.sand_n.clone(); nm.needsUpdate = true; nm.repeat.set(1400, 1400); this.waterNM = nm; }
    water.position.y = 0.4; water.receiveShadow = false; scene.add(water);

    this.buildSky(); this.buildTrees(); this.buildRocks(); this.buildClouds();
  }
  raw(x, z){
    const n = this.noise;
    const wx = x + n(x*0.0004 + 3, z*0.0004, 3)*650, wz = z + n(x*0.0004, z*0.0004 + 7, 3)*650;
    // Mostly broad, rolling lowland with a few gentle hills...
    let h = 30 + n(wx*0.00038, wz*0.00038, 4)*70;
    h += n(x*0.0016 + 5, z*0.0016 - 9, 3)*17;
    // ...and only a couple of mountain massifs, confined by a sparse low-frequency mask.
    const mk = Math.min(1, Math.max(0, (n(wx*0.0002 + 17, wz*0.0002 - 5, 2) - 0.12)/0.3)), m = mk*mk*(3 - 2*mk);
    if (m > 0) { const rr = 1 - Math.abs(n(wx*0.0009 + 40, wz*0.0009 - 20, 4)); h += m*(70 + rr*rr*120); }
    h += n(x*0.006, z*0.006, 2)*2.5 + n(x*0.022, z*0.022, 2)*0.5;
    const d = Math.hypot(x, z);
    // Island: a wobbly coastline around 1.9-2.4 km, then the sea floor drops away.
    const coast = 4700 + n(Math.cos(Math.atan2(z, x))*1.7 + 9, Math.sin(Math.atan2(z, x))*1.7 - 4, 3)*800;
    if (d > coast - 250) { const k = Math.min(1, (d - coast + 250)/250); h = h*(1 - k*0.6) - Math.max(0, d - coast)*0.32 - k*6; }
    h = Math.max(h, -70);
    return h;
  }
  flatW(x, z){
    let w = 0;
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r*1.8) { const t = d < f.r ? 1 : 1 - (d - f.r)/(f.r*0.8); w = Math.max(w, t*t*(3 - 2*t)); }
    }
    return w;
  }
  shape(x, z){
    let h = this.raw(x, z);
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r*1.8) { const t = d < f.r ? 1 : 1 - (d - f.r)/(f.r*0.8); const s = t*t*(3 - 2*t); h = h*(1 - s) + f.h*s; }
    }
    return h;
  }
  height(x, z){
    const S = this.S, st = this.step, N = this.N, W = N + 1;
    let fx = (x + S/2)/st, fz = (z + S/2)/st;
    fx = Math.min(Math.max(fx, 0), N - 0.0001); fz = Math.min(Math.max(fz, 0), N - 0.0001);
    const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, H = this.h;
    const ha = H[iz*W + ix], hb = H[(iz + 1)*W + ix], hc = H[(iz + 1)*W + ix + 1], hd = H[iz*W + ix + 1];
    const h = u + v <= 1 ? ha + (hd - ha)*u + (hb - ha)*v : hc + (hb - hc)*(1 - u) + (hd - hc)*(1 - v);
    if (this.bgrid) { const r = this.roof(x, z); if (r > h) return r; }
    const cv = this.carrier;
    if (cv) {
      const lx = x - cv.x, lz = z - cv.z;
      if (lx > 29 && lx < 47 && lz > 6 && lz < 74) return cv.deck + 46;
      if (lx > -49 && lx < 49 && lz > -288 && lz < 304) return Math.max(h, cv.deck);
    }
    return h;
  }
  /* ---- Solid buildings: roofs count as ground, walls push things out, both block line of sight ---- */
  addBlocker(b){
    const g = this.bgrid || (this.bgrid = new Map()), C = 64;
    for (let cx = Math.floor((b.x - b.hw)/C); cx <= Math.floor((b.x + b.hw)/C); cx++)
      for (let cz = Math.floor((b.z - b.hd)/C); cz <= Math.floor((b.z + b.hd)/C); cz++) {
        const k = cx*100003 + cz; if (!g.has(k)) g.set(k, []); g.get(k).push(b);
      }
    return b;
  }
  roof(x, z){
    if (!this.bgrid) return -1e9;
    const L = this.bgrid.get(Math.floor(x/64)*100003 + Math.floor(z/64)); if (!L) return -1e9;
    let t = -1e9; for (const b of L) if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd && b.top > t) t = b.top;
    return t;
  }
  pushOut(pos, rad, feet){
    if (!this.bgrid) return false;
    const seen = new Set(); let pushed = false;
    for (const ox of [-rad, rad]) for (const oz of [-rad, rad]) {
      const L = this.bgrid.get(Math.floor((pos.x + ox)/64)*100003 + Math.floor((pos.z + oz)/64)); if (!L) continue;
      for (const b of L) {
        if (seen.has(b)) continue; seen.add(b);
        if (feet > b.top - 1.5) continue;
        const dx = pos.x - b.x, dz = pos.z - b.z, px = b.hw + rad - Math.abs(dx), pz = b.hd + rad - Math.abs(dz);
        if (px <= 0 || pz <= 0) continue;
        if (px < pz) pos.x += Math.sign(dx || 1)*px; else pos.z += Math.sign(dz || 1)*pz;
        pushed = true;
      }
    }
    return pushed;
  }
  los(a, b){
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (d < 20) return true;
    const n = Math.ceil(d/10);
    for (let i = 1; i < n; i++) {
      const t = i/n; if (t*d < 9 || (1 - t)*d < 9) continue;
      const x = a.x + dx*t, z = a.z + dz*t;
      if (a.y + dy*t < this.height(x, z) - 0.8) return false;
    }
    return true;
  }
  slope(x, z){ return Math.hypot(this.height(x + 6, z) - this.height(x - 6, z), this.height(x, z + 6) - this.height(x, z - 6))/12; }
  buildSky(){
    if (this.hi) return this.buildSkyHi();
    const g = new THREE.SphereGeometry(16000, 32, 16), c = [], top = new THREE.Color(0x50667e), hor = new THREE.Color(0xb2b4ae), tmp = new THREE.Color();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i)/16000); tmp.copy(hor).lerp(top, Math.pow(t, 0.5)); c.push(tmp.r, tmp.g, tmp.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false}));
    sky.renderOrder = -1; this.scene.add(sky); this.sky = sky;
    this.sunDir = new V3(0.5, 0.82, 0.32).normalize();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(460, 24), new THREE.MeshBasicMaterial({color:0xefe8d8, fog:false}));
    disc.position.copy(this.sunDir).multiplyScalar(14000); disc.lookAt(0, 0, 0); this.scene.add(disc);
    this.scene.fog = new THREE.Fog(0xb2b4ae, 900, 9500);   // battlefield haze
    this.scene.add(new THREE.HemisphereLight(0xc6ccd2, 0x3b372f, 0.68));
    const d = this.sun = new THREE.DirectionalLight(0xffe9cf, 1.12);
    d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
    const sc = d.shadow.camera; sc.left = -240; sc.right = 240; sc.top = 240; sc.bottom = -240; sc.near = 20; sc.far = 1600;
    d.shadow.bias = -0.0004; d.shadow.normalBias = 0.5;
    this.scene.add(d); this.scene.add(d.target);
  }
  buildSkyHi(){
    const X = G.gfx, el = X.SUN_ELEV, az = Math.atan2(0.32, 0.5);
    this.sunDir = new V3(Math.cos(el)*Math.cos(az), Math.sin(el), Math.cos(el)*Math.sin(az)).normalize();
    // Panorama dome, turned so the sun in the photo sits where the shadow-casting light comes from.
    const sky = new THREE.Mesh(new THREE.SphereGeometry(16000, 64, 32), new THREE.MeshBasicMaterial({map:X.tex.sky, side:THREE.BackSide, fog:false, depthWrite:false}));
    const phi = X.SKY_SUN_U*Math.PI*2, skyAz = Math.atan2(Math.sin(phi), -Math.cos(phi));
    sky.rotation.y = skyAz - az; sky.renderOrder = -1; this.scene.add(sky); this.sky = sky;
    const env = X.envFor(); if (env) this.scene.environment = env;
    this.scene.fog = new THREE.Fog(X.FOG, 1100, 11000);
    this.scene.add(new THREE.HemisphereLight(0xb9c4cf, 0x3a362e, 0.55));
    const d = this.sun = new THREE.DirectionalLight(0xfff0dc, 1.25);
    d.castShadow = true; d.shadow.mapSize.set(4096, 4096);
    const sc = d.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 20; sc.far = 1600;
    d.shadow.bias = -0.0003; d.shadow.normalBias = 0.4;
    this.scene.add(d); this.scene.add(d.target);
  }
  follow(p){
    // Snap the shadow camera to whole shadow-map texels so shadows don't shimmer as you move.
    const tx = 480/2048, q = this.snapP || (this.snapP = new V3());
    q.set(Math.round(p.x/tx)*tx, Math.round(p.y/tx)*tx, Math.round(p.z/tx)*tx);
    this.sun.position.copy(q).addScaledVector(this.sunDir, 800); this.sun.target.position.copy(q); this.sun.target.updateMatrixWorld();
  }
  buildTrees(){ if (this.hi) return this.buildTreesHi();
    const NC = 4200, NB = 1700, R = this.rand, n = this.noise;
    const layer = (r, h, y) => new THREE.ConeGeometry(r, h, 7).translate(0, y, 0);
    const conM = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9});
    const trunkM = new THREE.MeshStandardMaterial({color:0x4a3a2a, roughness:1});
    const meshes = [
      new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.5, 5, 6).translate(0, 2.5, 0), trunkM, NC + NB),
      new THREE.InstancedMesh(layer(3.8, 7, 5.5), conM, NC), new THREE.InstancedMesh(layer(3.0, 6, 8.8), conM, NC), new THREE.InstancedMesh(layer(2.0, 5, 11.8), conM, NC),
      new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1).translate(0, 0, 0), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9}), NB)
    ];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), col = new THREE.Color(), up = new V3(0, 1, 0);
    let kc = 0, kb = 0, kt = 0;
    for (let i = 0; i < (NC + NB)*6 && (kc < NC || kb < NB); i++) {
      const a = R()*Math.PI*2, d = Math.sqrt(R())*5600, x = Math.sin(a)*d, z = Math.cos(a)*d, h = this.height(x, z);
      if (h < 5 || h > 205 || this.flatW(x, z) > 0.05 || this.slope(x, z) > 0.55) continue;
      const dens = n(x*0.003 + 31, z*0.003 - 17, 3);
      if (dens < -0.08 && R() > 0.12) continue;
      const conifer = h > 120 ? R() < 0.92 : R() < 0.55;
      const sc = 0.7 + R()*0.8;
      q.setFromAxisAngle(up, R()*6.28);
      if (conifer && kc < NC) {
        s.set(sc, sc*(0.9 + R()*0.3), sc); m.compose(new V3(x, h - 0.3, z), q, s);
        meshes[0].setMatrixAt(kt++, m); for (let L = 1; L <= 3; L++) meshes[L].setMatrixAt(kc, m);
        col.setRGB(0.10 + R()*0.04, 0.165 + R()*0.05, 0.11 + R()*0.035); for (let L = 1; L <= 3; L++) meshes[L].setColorAt(kc, col); kc++;
      } else if (!conifer && kb < NB) {
        s.set(sc*0.9, sc, sc*0.9); m.compose(new V3(x, h - 0.3, z), q, s); meshes[0].setMatrixAt(kt++, m);
        const r = (3.6 + R()*1.8)*sc; s.set(r, r*(0.8 + R()*0.3), r); m.compose(new V3(x, h + 5*sc + r*0.6, z), q, s); meshes[4].setMatrixAt(kb, m);
        if (R() < 0.14) col.setRGB(0.3 + R()*0.06, 0.23 + R()*0.04, 0.13 + R()*0.03); else col.setRGB(0.19 + R()*0.08, 0.24 + R()*0.06, 0.12 + R()*0.04); meshes[4].setColorAt(kb, col); kb++;
      }
    }
    meshes[0].count = kt; for (let L = 1; L <= 3; L++) meshes[L].count = kc; meshes[4].count = kb;
    for (const me of meshes) { me.castShadow = true; me.receiveShadow = true; this.scene.add(me); }
  }
  /* High mode trees: a few hand-shaped variants, instanced. Conifers are stacked star-skirted tiers that droop at the tips;
     broadleaf crowns are clusters of lumpy blobs over a forked trunk. Shading (dark interior, lit tips) is baked into vertex
     colours and multiplied by a per-tree tint. */
  buildTreesHi(){
    const NC = 4200, NB = 1700, R = this.rand, n = this.noise, TR = (() => { let s = 7; return () => (s = (s*16807) % 2147483647)/2147483647; })();
    const merge = parts => { let len = 0; for (const g of parts) len += g.attributes.position.count;
      const P = new Float32Array(len*3), N = new Float32Array(len*3), C = new Float32Array(len*3); let o = 0;
      for (const g of parts) { const gp = g.attributes.position, gn = g.attributes.normal, gc = g.attributes.color;
        for (let i = 0; i < gp.count; i++, o++) { P.set([gp.getX(i), gp.getY(i), gp.getZ(i)], o*3); N.set([gn.getX(i), gn.getY(i), gn.getZ(i)], o*3); C.set(gc ? [gc.getX(i), gc.getY(i), gc.getZ(i)] : [1, 1, 1], o*3); } }
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); return out; };
    const shade = (g, f) => { const p = g.attributes.position, c = new Float32Array(p.count*3); for (let i = 0; i < p.count; i++) { const k = f(p.getX(i), p.getY(i), p.getZ(i)); c[i*3] = c[i*3 + 1] = c[i*3 + 2] = k; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
    const tier = (r, h, y, seg) => {   // a cone whose rim alternates long drooping tips and short notches
      let g = new THREE.ConeGeometry(r, h, seg, 1, false); g = g.toNonIndexed(); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const py = p.getY(i); if (py < 0) { const rr = Math.hypot(p.getX(i), p.getZ(i)); if (rr < 1e-4) { p.setY(i, py - h*0.02); continue; } const a = Math.atan2(p.getZ(i), p.getX(i)), idx = ((Math.round((a + Math.PI)/(Math.PI*2)*seg*2) % (seg*2)) + seg*2) % (seg*2), k = idx % 2 ? 0.72 : 1.0, j = 0.9 + 0.2*((Math.sin(idx*12.9898 + r*78.233)*43758.5453) % 1 + 1) % 1;
        p.setX(i, p.getX(i)*k*j); p.setZ(i, p.getZ(i)*k*j); p.setY(i, py - (k === 1 ? h*0.07 : -h*0.03)); } }
      g.computeVertexNormals(); g.translate(0, y, 0);
      return shade(g, (x, yy, z) => { const t = Math.max(0, (yy - (y - h/2))/h); return 0.45 + 0.6*t + Math.min(0.15, Math.hypot(x, z)*0.03); });
    };
    const conifer = (tiers, r0, hgt) => { const parts = []; for (let i = 0; i < tiers; i++) { const t = i/(tiers - 1), r = r0*(1 - t*0.8), h = hgt/tiers*1.9; parts.push(tier(r, h, 3 + t*hgt*0.92, 12)); }
      return merge(parts); };
    const blob = (r, x, y, z) => { let g = new THREE.IcosahedronGeometry(r, 1); g = g.toNonIndexed(); const p = g.attributes.position;
      const key = v => Math.round(v*100); const disp = {};
      for (let i = 0; i < p.count; i++) { const k = key(p.getX(i)) + ',' + key(p.getY(i)) + ',' + key(p.getZ(i)); const d = disp[k] ?? (disp[k] = 0.8 + TR()*0.38); p.setXYZ(i, p.getX(i)*d, p.getY(i)*d*0.9, p.getZ(i)*d); }
      g.computeVertexNormals(); g.translate(x, y, z); return shade(g, (xx, yy) => 0.5 + 0.5*Math.min(1, Math.max(0, (yy - y + r)/(2*r))) ); };
    const broad = lumps => { const parts = []; for (const [r, x, y, z] of lumps) parts.push(blob(r, x, y, z)); return merge(parts); };
    const trunkG = (() => { const parts = [new THREE.CylinderGeometry(0.22, 0.48, 6, 6).translate(0, 3, 0)];
      for (const [a, l] of [[0.6, 2.4], [2.6, 2.0], [4.4, 2.2]]) { const br = new THREE.CylinderGeometry(0.08, 0.16, l, 5); br.translate(0, l/2, 0); br.rotateZ(-0.75); br.rotateY(a); br.translate(0, 3.6 + a*0.35, 0); parts.push(br); }
      return merge(parts.map(g => g.toNonIndexed())); })();
    const conM = new THREE.MeshStandardMaterial({color:0xffffff, vertexColors:true, roughness:0.92, envMapIntensity:0.4});
    const leafM = new THREE.MeshStandardMaterial({color:0xffffff, vertexColors:true, roughness:0.88, envMapIntensity:0.4});
    const barkM = new THREE.MeshStandardMaterial({color:0x4a3a2a, roughness:1});
    const conG = [conifer(6, 4.0, 13), conifer(7, 3.4, 16), conifer(5, 4.6, 10)];
    const brG = [broad([[3.2, 0, 7.6, 0], [2.4, 1.9, 6.6, 0.6], [2.3, -1.7, 6.9, -0.8], [2.0, 0.4, 9.4, -0.6], [1.9, -0.6, 6.2, 1.8]]),
                 broad([[2.8, 0, 8.4, 0], [2.6, 1.4, 7.2, -1.2], [2.2, -1.8, 7.4, 0.9], [1.8, 0.8, 10.0, 0.7]])];
    const cN = conG.map(() => 0), bN = brG.map(() => 0);
    const conI = conG.map(g => new THREE.InstancedMesh(g, conM, NC)), brI = brG.map(g => new THREE.InstancedMesh(g, leafM, NB));
    const trunkI = new THREE.InstancedMesh(trunkG, barkM, NB), pineTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.45, 5, 6).translate(0, 2.5, 0), barkM, NC);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), col = new THREE.Color(), up = new V3(0, 1, 0);
    let kc = 0, kb = 0, kt = 0, kp = 0;
    for (let i = 0; i < (NC + NB)*6 && (kc < NC || kb < NB); i++) {
      const a = R()*Math.PI*2, d = Math.sqrt(R())*5600, x = Math.sin(a)*d, z = Math.cos(a)*d, h = this.height(x, z);
      if (h < 5 || h > 205 || this.flatW(x, z) > 0.05 || this.slope(x, z) > 0.55) continue;
      const dens = n(x*0.003 + 31, z*0.003 - 17, 3);
      if (dens < -0.08 && R() > 0.12) continue;
      const isCon = h > 120 ? R() < 0.92 : R() < 0.55, sc = 0.7 + R()*0.8;
      q.setFromAxisAngle(up, R()*6.28); const tilt = new THREE.Quaternion().setFromAxisAngle(new V3(R() - 0.5, 0, R() - 0.5).normalize(), R()*0.05); q.multiply(tilt);
      if (isCon && kc < NC) {
        const v = Math.floor(R()*conG.length); s.set(sc, sc*(0.9 + R()*0.3), sc); m.compose(new V3(x, h - 0.3, z), q, s);
        conI[v].setMatrixAt(cN[v], m); pineTrunk.setMatrixAt(kp++, m);
        col.setRGB(0.15 + R()*0.05, 0.24 + R()*0.07, 0.15 + R()*0.04); conI[v].setColorAt(cN[v]++, col); kc++;
      } else if (!isCon && kb < NB) {
        const v = Math.floor(R()*brG.length); s.set(sc*(0.9 + R()*0.2), sc*(0.85 + R()*0.3), sc*(0.9 + R()*0.2)); m.compose(new V3(x, h - 0.3, z), q, s);
        brI[v].setMatrixAt(bN[v], m); trunkI.setMatrixAt(kt++, m);
        if (R() < 0.14) col.setRGB(0.42 + R()*0.08, 0.32 + R()*0.05, 0.16 + R()*0.04); else col.setRGB(0.25 + R()*0.08, 0.32 + R()*0.07, 0.15 + R()*0.04);
        brI[v].setColorAt(bN[v]++, col); kb++;
      }
    }
    conI.forEach((me, v) => me.count = cN[v]); brI.forEach((me, v) => me.count = bN[v]); trunkI.count = kt; pineTrunk.count = kp;
    for (const me of [...conI, ...brI, trunkI, pineTrunk]) { me.castShadow = true; me.receiveShadow = true; this.scene.add(me); }
  }
  buildRocks(){
    if (this.hi && G.gfx.rocks.length) return this.buildRocksHi();
    const N = 1000, R = this.rand, mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.95, flatShading:true}), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), col = new THREE.Color(); let k = 0;
    for (let i = 0; i < N*8 && k < N; i++) {
      const a = R()*Math.PI*2, d = Math.sqrt(R())*5600, x = Math.sin(a)*d, z = Math.cos(a)*d, h = this.height(x, z);
      if (h < 2 || this.flatW(x, z) > 0.05) continue;
      const sl = this.slope(x, z); if (sl < 0.25 && R() > 0.25) continue;
      const sc = 1.5 + R()*R()*9; s.set(sc*(0.8 + R()*0.6), sc*(0.5 + R()*0.5), sc*(0.8 + R()*0.6));
      q.setFromEuler(new THREE.Euler(R()*3, R()*3, R()*3)); m.compose(new V3(x, h + sc*0.15, z), q, s); mesh.setMatrixAt(k, m);
      const v = 0.3 + R()*0.14; col.setRGB(v, v*0.97, v*0.93); mesh.setColorAt(k, col); k++;
    }
    mesh.count = k; mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh);
  }
  buildRocksHi(){
    // Scanned boulders (three shapes), instanced and scattered on slopes like the procedural set.
    const R = this.rand, kinds = G.gfx.rocks, N = 1300, per = Math.ceil(N/kinds.length);
    const meshes = kinds.map(k => new THREE.InstancedMesh(k.geo, k.mat, per)), cnt = kinds.map(() => 0);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), e = new THREE.Euler();
    for (let i = 0; i < N*8 && cnt.reduce((a, b) => a + b, 0) < N; i++) {
      const a = R()*Math.PI*2, d = Math.sqrt(R())*5600, x = Math.sin(a)*d, z = Math.cos(a)*d, h = this.height(x, z);
      if (h < 2 || this.flatW(x, z) > 0.05) continue;
      const sl = this.slope(x, z); if (sl < 0.25 && R() > 0.25) continue;
      const t = Math.floor(R()*kinds.length); if (cnt[t] >= per) continue;
      const sc = 1.4 + R()*R()*9; s.set(sc*(0.85 + R()*0.4), sc*(0.7 + R()*0.5), sc*(0.85 + R()*0.4));
      e.set((R() - 0.5)*0.5, R()*6.28, (R() - 0.5)*0.5); q.setFromEuler(e); m.compose(new V3(x, h - sc*0.25, z), q, s); meshes[t].setMatrixAt(cnt[t]++, m);
    }
    meshes.forEach((me, i) => { me.count = cnt[i]; me.castShadow = true; me.receiveShadow = true; this.scene.add(me); });
  }
  buildClouds(){
    if (this.hi) return;   // the panorama carries the cloudscape in High
    // Soft overlapping slabs of stratus rather than fair-weather puffs.
    const mat = new THREE.MeshBasicMaterial({color:0xc3c5c4, transparent:true, opacity:0.42, depthWrite:false});
    const matD = new THREE.MeshBasicMaterial({color:0x8f9395, transparent:true, opacity:0.38, depthWrite:false});
    const geo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 130; i++) {
      const g = new THREE.Group(), x = (this.rand() - 0.5)*16000, z = (this.rand() - 0.5)*16000, y = 820 + this.rand()*380;
      const parts = 4 + Math.floor(this.rand()*5);
      for (let j = 0; j < parts; j++) {
        const m = new THREE.Mesh(geo, j % 3 === 2 ? matD : mat); const s = 70 + this.rand()*110;
        m.scale.set(s*2.6, s*0.3, s*1.9); m.position.set((this.rand() - 0.5)*240, (this.rand() - 0.3)*35, (this.rand() - 0.5)*170); g.add(m);
      }
      g.position.set(x, y, z); this.scene.add(g);
    }
  }
};

/* ---------- Particles ---------- */
const VS = `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size; attribute vec4 pcol; varying vec4 vC; uniform float scale;
void main(){ vC = pcol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/max(0.5,-mv.z); gl_Position = projectionMatrix*mv;
#include <logdepthbuf_vertex>
}`;
const FS = `#include <logdepthbuf_pars_fragment>
varying vec4 vC; void main(){
#include <logdepthbuf_fragment>
vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard; float a = smoothstep(0.5,0.12,d); gl_FragColor = vec4(vC.rgb, vC.a*a); }`;

G.Particles = class {
  constructor(scene, max, additive){
    this.max = max; this.i = 0;
    this.p = new Float32Array(max*3); this.c = new Float32Array(max*4); this.s = new Float32Array(max);
    this.v = new Float32Array(max*3); this.l = new Float32Array(max); this.L = new Float32Array(max);
    this.gr = new Float32Array(max); this.a0 = new Float32Array(max); this.dr = new Float32Array(max); this.up = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.c, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    this.mat = new THREE.ShaderMaterial({uniforms:{scale:{value:600}}, vertexShader:VS, fragmentShader:FS, transparent:true, depthWrite:false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending});
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.g = g;
  }
  emit(x,y,z, vx,vy,vz, size, life, r,g,b,a, grow=0, drag=0, up=0){
    const i = this.i; this.i = (i + 1) % this.max;
    this.p[i*3]=x; this.p[i*3+1]=y; this.p[i*3+2]=z; this.v[i*3]=vx; this.v[i*3+1]=vy; this.v[i*3+2]=vz;
    this.s[i]=size; this.l[i]=life; this.L[i]=life; this.c[i*4]=r; this.c[i*4+1]=g; this.c[i*4+2]=b; this.c[i*4+3]=a;
    this.a0[i]=a; this.gr[i]=grow; this.dr[i]=drag; this.up[i]=up;
  }
  update(dt){
    const p = this.p, v = this.v;
    for (let i = 0; i < this.max; i++) {
      if (this.l[i] <= 0) continue;
      this.l[i] -= dt;
      if (this.l[i] <= 0) { this.s[i] = 0; this.c[i*4+3] = 0; continue; }
      const k = Math.max(0, 1 - this.dr[i]*dt);
      v[i*3] *= k; v[i*3+1] = v[i*3+1]*k + this.up[i]*dt; v[i*3+2] *= k;
      p[i*3] += v[i*3]*dt; p[i*3+1] += v[i*3+1]*dt; p[i*3+2] += v[i*3+2]*dt;
      this.s[i] = Math.max(0, this.s[i] + this.gr[i]*dt);
      this.c[i*4+3] = this.a0[i]*(this.l[i]/this.L[i]);
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.pcol.needsUpdate = true; this.g.attributes.size.needsUpdate = true;
  }
};

const R = () => Math.random() - 0.5;
G.FX = class {
  constructor(scene){
    this.scene = scene;
    this.smoke = new G.Particles(scene, 3200, false);
    this.fire = new G.Particles(scene, 2600, true);
    this.beams = []; this.burners = []; this.lights = []; this.li = 0;
    for (let i = 0; i < 3; i++) { const L = new THREE.PointLight(0xffa255, 0, 320, 2); scene.add(L); this.lights.push({L, t:0}); }
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); this.beamGeo.rotateX(Math.PI/2); this.beamGeo.translate(0, 0, 0.5);
  }
  setScale(s){ this.smoke.mat.uniforms.scale.value = s; this.fire.mat.uniforms.scale.value = s; }
  explosion(p, s = 1){
    const F = this.fire, S = this.smoke;
    for (let i = 0; i < 24*s; i++) F.emit(p.x, p.y, p.z, R()*45*s, R()*45*s + 8, R()*45*s, (6 + Math.random()*8)*s, 0.45 + Math.random()*0.5, 1, 0.55 + Math.random()*0.3, 0.18, 1, 12*s, 2.6, 4);
    for (let i = 0; i < 16*s; i++) S.emit(p.x, p.y, p.z, R()*22*s, R()*16*s + 6, R()*22*s, (9 + Math.random()*6)*s, 2.4 + Math.random()*1.8, 0.22, 0.2, 0.19, 0.72, 9*s, 1.4, 4);
    for (let i = 0; i < 14*s; i++) F.emit(p.x, p.y, p.z, R()*170*s, R()*170*s, R()*170*s, 1.6, 0.6, 1, 0.82, 0.45, 1, 0, 1.2, -25);
    const l = this.lights[this.li++ % 3]; l.L.position.copy(p); l.L.intensity = 7*s; l.t = 0.28;
  }
  spark(p, col){
    const c = col || [1, 0.85, 0.5];
    for (let i = 0; i < 6; i++) this.fire.emit(p.x, p.y, p.z, R()*60, R()*60, R()*60, 1.4, 0.25, c[0], c[1], c[2], 1, 0, 3);
  }
  dust(p){
    for (let i = 0; i < 3; i++) this.smoke.emit(p.x, p.y + 1, p.z, R()*8, 6 + Math.random()*6, R()*8, 3, 1.2, 0.5, 0.44, 0.34, 0.6, 6, 1.5, 0);
  }
  trail(p, s = 1){
    this.smoke.emit(p.x, p.y, p.z, R()*2, R()*2, R()*2, 2.2*s, 1.5, 0.86, 0.86, 0.86, 0.5, 4, 0.8, 1.2);
    this.fire.emit(p.x, p.y, p.z, 0, 0, 0, 2.6*s, 0.07, 1, 0.7, 0.3, 1);
  }
  thrust(p, d, s = 1, col){
    const c = col || [0.55, 0.82, 1];
    this.fire.emit(p.x, p.y, p.z, d.x*40 + R()*6, d.y*40 + R()*6, d.z*40 + R()*6, 2.4*s, 0.16, c[0], c[1], c[2], 0.9, -6);
  }
  flare(p){
    this.fire.emit(p.x, p.y, p.z, R()*4, R()*4, R()*4, 5, 0.12, 1, 0.92, 0.7, 1);
    this.smoke.emit(p.x, p.y, p.z, R()*2, 0, R()*2, 2.6, 1.6, 0.9, 0.9, 0.9, 0.45, 5, 0.6, 1);
  }
  green(p){
    this.smoke.emit(p.x + R()*2, p.y, p.z + R()*2, R()*3, 9 + Math.random()*4, R()*3, 4, 4, 0.4, 0.95, 0.5, 0.6, 7, 0.4, 1.5);
  }
  burner(p, t = 20){ if (this.burners.length > 14) this.burners.shift(); this.burners.push({p: p.clone(), t, T:t}); }
  beam(a, b, color, w = 0.5, life = 0.16){
    const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false, fog:false}));
    m.position.copy(a); m.lookAt(b); m.scale.set(w, w, a.distanceTo(b));
    this.scene.add(m); this.beams.push({m, t:life, L:life});
  }
  update(dt){
    this.smoke.update(dt); this.fire.update(dt);
    for (const l of this.lights) if (l.t > 0) { l.t -= dt; l.L.intensity = Math.max(0, l.L.intensity - dt*28); }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]; b.t -= dt; b.m.material.opacity = Math.max(0, b.t/b.L);
      if (b.t <= 0) { this.scene.remove(b.m); b.m.material.dispose(); this.beams.splice(i, 1); }
    }
    for (let i = this.burners.length - 1; i >= 0; i--) {
      const b = this.burners[i]; b.t -= dt;
      if (Math.random() < dt*11) this.smoke.emit(b.p.x + R()*4, b.p.y + 2, b.p.z + R()*4, R()*3 + 2.5, 8 + Math.random()*5, R()*3, 9, 6, 0.1, 0.095, 0.09, 0.62*Math.min(1, b.t/5), 9, 0.3, 1.5);
      if (Math.random() < dt*10 && b.t > b.T - 22) this.fire.emit(b.p.x + R()*3, b.p.y + 1, b.p.z + R()*3, 0, 6, 0, 4, 0.4, 1, 0.5, 0.15, 0.8, 2);
      if (b.t <= 0) this.burners.splice(i, 1);
    }
  }
};

/* ---------- Instanced tracers ---------- */
G.Tracers = class {
  constructor(scene, max = 700){
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, -0.5);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({color:0xffffff, fog:false}), max);
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.max = max; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new V3(); this.d = new V3(); this.col = new THREE.Color(); this.Z = new V3(0, 0, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, this.col.setHex(0xffffff));
    this.mesh.count = 0; scene.add(this.mesh);
  }
  draw(list){
    let n = 0;
    for (const b of list) {
      if (n >= this.max) break;
      this.d.copy(b.vel).normalize(); this.q.setFromUnitVectors(this.Z, this.d);
      this.s.set(b.w, b.w, b.len); this.m.compose(b.pos, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m); this.mesh.setColorAt(n, this.col.setHex(b.color)); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
};
})();
