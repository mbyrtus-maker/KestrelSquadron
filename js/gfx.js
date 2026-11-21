(function(){
'use strict';
/* High graphics: photo-scanned ground textures (Poly Haven, CC0), a panoramic sky with matching lighting,
   facade textures baked in Blender, and scanned rock models. Everything loads in the background from the
   hangar; if anything fails, or the player picks Low, the game uses the original procedural scenery. */
const G = window.G;
const TEX = ['grass_d','grass_n','dirt_d','dirt_n','rock_d','rock_n','sand_d','sand_n','snow_d','pad_d','asphalt_d','asphalt_n','concrete_d','dconc_d',
             'facade_conc','facade_brick','facade_glass','facade_damaged','facade_shop','sky'];
const X = G.gfx = {ready:false, failed:false, started:false, tex:{}, rocks:[], progress:0, waiters:[]};

X.wanted = () => (G.save && G.save.gfx) !== 'low';
X.hi = () => X.wanted() && X.ready;

X.load = function(){
  if (X.started) return; X.started = true;
  const tl = new THREE.TextureLoader(), total = TEX.length + 1; let left = total, bad = 0;
  const done = () => { X.progress = 1 - left/total; if (--left === 0) { X.ready = bad === 0; X.failed = !X.ready; const w = X.waiters; X.waiters = []; for (const f of w) f(); } };
  const aniso = G.renderer ? Math.min(8, G.renderer.capabilities.getMaxAnisotropy()) : 4;
  for (const k of TEX) tl.load('gfx/' + k + '.jpg', t => {
    if (k !== 'sky') { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
    else { t.mapping = THREE.EquirectangularReflectionMapping; }
    X.tex[k] = t; done();
  }, undefined, () => { bad++; console.warn('gfx texture failed', k); done(); });
  if (!THREE.GLTFLoader) { bad++; done(); return; }
  new THREE.GLTFLoader().load('gfx/rocks.json', g => {
    g.scene.traverse(o => { if (o.isMesh) { o.material.roughness = Math.max(0.8, o.material.roughness || 0); o.material.envMapIntensity = 0.5; X.rocks.push({geo:o.geometry, mat:o.material}); } });
    done();
  }, undefined, () => { bad++; console.warn('gfx rocks failed'); done(); });
};
X.whenReady = (cb, timeout = 20000) => {
  if (!X.wanted() || X.ready || X.failed) { cb(); return; }
  if (!X.started) X.load();
  let fired = false; const go = () => { if (!fired) { fired = true; cb(); } };
  X.waiters.push(go); setTimeout(go, timeout);
};

/* Sky: sun sits at u=0.6, 38 deg up in the panorama; the world rotates the dome so it lines up with the light. */
X.SKY_SUN_U = 0.6; X.SUN_ELEV = 38*Math.PI/180; X.FOG = 0x8d9195;
X.envFor = function(){
  if (X.env || !G.renderer || !X.tex.sky) return X.env || null;
  try { const pm = new THREE.PMREMGenerator(G.renderer); X.env = pm.fromEquirectangular(X.tex.sky).texture; pm.dispose(); } catch (e) { X.env = null; }
  return X.env;
};

/* ---------- Terrain splat material ---------- */
X.terrainMaterial = function(){
  const t = X.tex;
  const m = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.95, metalness:0, envMapIntensity:0.35});
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {tG:{value:t.grass_d}, tGn:{value:t.grass_n}, tD:{value:t.dirt_d}, tDn:{value:t.dirt_n}, tR:{value:t.rock_d}, tRn:{value:t.rock_n},
      tS:{value:t.sand_d}, tSn:{value:t.sand_n}, tSnow:{value:t.snow_d}, tPad:{value:t.pad_d}});
    sh.vertexShader = 'attribute vec4 splatA;\nattribute vec4 splatB;\nvarying vec4 vSA;\nvarying vec4 vSB;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vSA = splatA; vSB = splatB; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = `uniform sampler2D tG, tGn, tD, tDn, tR, tRn, tS, tSn, tSnow, tPad;
varying vec4 vSA; varying vec4 vSB; varying vec3 vWP; varying vec3 vWN;
float kFar;
vec3 kN(sampler2D s, vec2 uv){ return texture2D(s, uv).xyz*2.0 - 1.0; }
` + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 u1 = vWP.xz*0.11, u2 = vWP.xz*0.017;
        vec3 cg = mix(texture2D(tG, u1).rgb, texture2D(tG, u2).rgb, 0.5);
        vec3 cd = mix(texture2D(tD, u1*0.8).rgb, texture2D(tD, u2*1.3).rgb, 0.45);
        vec3 bw = pow(abs(vWN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 cr = texture2D(tR, vWP.zy*0.045).rgb*bw.x + texture2D(tR, vWP.xz*0.045).rgb*bw.y + texture2D(tR, vWP.xy*0.045).rgb*bw.z;
        vec3 cs = texture2D(tS, u1*1.4).rgb, cn = texture2D(tSnow, u1).rgb, cp = texture2D(tPad, vWP.xz*0.05).rgb;
        vec3 col = cg*vec3(0.92, 0.95, 0.82)*vSA.x + cd*vec3(1.0, 0.95, 0.9)*vSA.y + cr*0.95*vSA.z + cs*vSA.w + cn*1.05*vSB.x + cp*0.9*vSB.y;
        col *= (1.0 - 0.4*vSB.z) * vSB.w;
        float lumC = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(vec3(lumC), col, 0.78);   // muted, battlefield palette
        kFar = smoothstep(450.0, 3800.0, length(vWP - cameraPosition));
        diffuseColor.rgb *= mix(col*1.05, vColor, kFar);`)
      .replace('#include <color_fragment>', '')
      .replace('#include <normal_fragment_maps>', `
        {
          vec2 n1 = vWP.xz*0.11;
          vec3 tn = kN(tGn, n1)*vSA.x + kN(tDn, n1*0.8)*vSA.y + kN(tRn, vWP.xz*0.045)*vSA.z + kN(tSn, n1*1.4)*vSA.w;
          vec3 nW = normalize(vWN + vec3(tn.x, 0.0, -tn.y)*(1.0 - kFar)*0.85);
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`);
  };
  m.customProgramCacheKey = () => 'kestrel-terrain-v1';
  return m;
};

/* ---------- Facade materials for city blocks ---------- */
const fmats = {};
X.facade = function(kind, tint){
  const key = kind + ':' + tint;
  if (fmats[key]) return fmats[key];
  const c = new THREE.Color(tint || 0xffffff).lerp(new THREE.Color(0xffffff), 0.45);
  const map = X.tex['facade_' + kind] || X.tex.facade_conc;
  return fmats[key] = new THREE.MeshStandardMaterial({map, color:c, roughness:kind === 'glass' ? 0.45 : 0.92, metalness:kind === 'glass' ? 0.25 : 0.0, envMapIntensity:kind === 'glass' ? 0.9 : 0.3});
};
X.roofMat = function(){
  if (fmats.roof) return fmats.roof;
  const t = X.tex.pad_d.clone(); t.needsUpdate = true; t.repeat.set(1, 1);
  return fmats.roof = new THREE.MeshStandardMaterial({map:t, color:0x8a8884, roughness:0.95});
};
/* Box with facade UVs: one texture tile = 12 m wide x 10.5 m (three storeys); vertical offset keeps floors aligned. */
X.facadeBox = function(w, h, d, y0, mat, roof){
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i/4), u = uv.getX(i), v = uv.getY(i);
    if (f === 2 || f === 3) uv.setXY(i, u*w/24, v*d/24);
    else { const sx = f < 2 ? d : w; uv.setXY(i, u*sx/12, (v*h + y0)/10.5); }
  }
  const m = new THREE.Mesh(geo, [mat, mat, roof, roof, mat, mat]); m.castShadow = m.receiveShadow = true; return m;
};
})();
