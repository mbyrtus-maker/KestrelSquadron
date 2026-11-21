(function(){
'use strict';
/* Model library: CC0 packs by Quaternius (mechs, ships) and pixelmannen (tank, sandbags),
   converted to GLB and recoloured into the shared Varn palette. */
const G = window.G;
const LIST = {sandbags:'models/sandbags.json'};   // the fighting cast is hand-built (targets.js); only props are imported
const grey = new THREE.Color(), TINT = {mech:{mix:0.45, dim:0.72}, ship:{mix:0.5, dim:0.7}, tank:{mix:0.4, dim:0.72}, sandbags:{mix:0.25, dim:0.8}};
const A = G.assets = {ready:false, failed:false, lib:{}, progress:0, waiters:[]};

A.load = function(){
  if (A.started) return; A.started = true;
  if (!THREE.GLTFLoader) { A.failed = true; A.done(); return; }
  const loader = new THREE.GLTFLoader(), keys = Object.keys(LIST); let left = keys.length;
  const finish = () => { if (--left === 0) { A.ready = Object.keys(A.lib).length > 0; A.failed = !A.ready; A.done(); } };
  for (const k of keys) {
    loader.load(LIST[k], gltf => {
      const root = gltf.scene;
      root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { m.flatShading = true; m.needsUpdate = true; if (m.vertexColors !== true && o.geometry.attributes.color) m.vertexColors = true;
          // Field-worn finish: knock the toy-bright pack colours down toward drab service paint.
          if (m.color && !m.userData.worn) { m.userData.worn = true; const t = TINT[k.split('_')[0]] || TINT.tank; grey.setHex(0x6a685e); m.color.lerp(grey, t.mix).multiplyScalar(t.dim); m.roughness = Math.max(m.roughness ?? 0.7, 0.78); m.metalness = Math.min(m.metalness ?? 0.2, 0.25); } }
      });
      A.lib[k] = {scene:root, clips:gltf.animations || []};
      A.progress = 1 - (left - 1)/keys.length; finish();
    }, undefined, err => { console.warn('model failed', k, err); finish(); });
  }
};
A.done = function(){ const w = A.waiters; A.waiters = []; for (const f of w) f(); };
A.whenReady = function(cb, timeout = 15000){
  if (A.ready || A.failed) { cb(); return; }
  if (!A.started) A.load();
  let fired = false; const go = () => { if (!fired) { fired = true; cb(); } };
  A.waiters.push(go); setTimeout(go, timeout);
};
A.has = k => A.ready && !!A.lib[k];

/* Clone a model. Skinned meshes need SkeletonUtils so each copy gets its own skeleton. */
A.make = function(k, ownMaterials){
  const src = A.lib[k]; if (!src) return null;
  const skinned = /^mech_/.test(k);
  const obj = skinned && THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(src.scene) : src.scene.clone(true);
  if (ownMaterials) obj.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); });
  const wrap = new THREE.Group(); wrap.add(obj);
  if (skinned && src.clips.length) {
    const mixer = new THREE.AnimationMixer(obj), actions = {};
    for (const c of src.clips) actions[c.name] = mixer.clipAction(c);
    for (const n of ['Death', 'Jump', 'HitRecieve_1']) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce, 1); actions[n].clampWhenFinished = true; }
    wrap.userData.mixer = mixer; wrap.userData.actions = actions;
    wrap.userData.play = (name, fade = 0.25) => {
      const u = wrap.userData, a = u.actions[name]; if (!a || u.cur === name) return;
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
      if (u.cur && u.actions[u.cur]) u.actions[u.cur].crossFadeTo(a, fade, false);
      u.cur = name;
    };
    wrap.userData.play('Idle', 0);
  }
  return wrap;
};
})();
