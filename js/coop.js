(function(){
'use strict';
/* ============================================================ Co-op
   Two pilots: the host flies lead and runs the whole mission (enemies, objectives, story); a friend joins as their wingman,
   taking over the AI wingman's slot. Browsers connect directly (WebRTC data channels). A free public PeerJS matchmaking server
   only introduces them, with public MQTT brokers as a backup signalling path (the same model as Driftgate Beyond).
   - Host -> guest: the mission (when the host's carrier launch is done), entity spawns, 15 Hz snapshots (enemies, shots,
     missiles, objectives, the host's own Kestrel), radio calls, explosions, damage to the wingman, and the end of the sortie.
   - Guest -> host: 20 Hz pose of the guest's Kestrel (it replaces the AI wingman), hits it lands (the host applies them),
     flares, and its hull. The guest flies and fights locally; only the host decides what dies.
   Story progress stays with the host; the guest earns the mission reward and the bounties they scored. */
const G = window.G, V3 = THREE.Vector3, $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const HOME = 'https://mbyrtus-maker.github.io/KestrelSquadron/';
const PFX = 'kestrel1', VER = 1;
const rid = n => { let s = ''; const a = 'abcdefghijkmnpqrstuvwxyz23456789'; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random()*a.length)]; return s; };
const pick = a => a[Math.floor(Math.random()*a.length)];
const CA = ['amber', 'silver', 'crimson', 'quiet', 'iron', 'violet', 'solar', 'frozen', 'swift', 'golden', 'ember', 'azure', 'dusky', 'rusty'], CB = ['kestrel', 'falcon', 'harrier', 'lantern', 'bastion', 'ridge', 'vesper', 'shrike', 'wren', 'osprey', 'gyrfalcon', 'merlin'];
const genCode = () => `${pick(CA)}-${pick(CB)}-${10 + Math.floor(Math.random()*90)}`;
const slug = c => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
const inviteURL = c => location.origin + location.pathname + '?coop=' + encodeURIComponent(c);

const C = G.coop = {st:'off', role:null, code:'', myId:'', hostId:'', sig:null, mq:[], link:null, peerName:'', peerFrame:null,
  game:null, ready:false, started:false, pend:[], hits:[], lastS:null, entsById:new Map(), nextId:1, snT:0, poT:0, opT:0};
C.on = () => C.st === 'host' || C.st === 'joined';
C.isHost = () => C.role === 'host' && !!C.link && C.link.open;
C.isGuest = () => C.role === 'guest';

function cfg(){
  const q = new URLSearchParams(location.search);
  C.sigCfg = {host:'0.peerjs.com', port:443, path:'/', key:'peerjs', secure:true};
  C.mqURLs = (q.get('mqtt') || 'wss://broker.emqx.io:8084/mqtt,wss://broker.hivemq.com:8884/mqtt').split(',').filter(Boolean);
  C.ice = [{urls:'stun:stun.l.google.com:19302'}, {urls:['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username:'peerjs', credential:'peerjsp'}];
}
const status = (t, bad) => { C.status = t; C.bad = !!bad; const el = $('coStat'); if (el) { el.innerHTML = t; el.style.color = bad ? '#ff7a6a' : ''; } };

// ---- backup signalling: a tiny MQTT 3.1.1 client over WebSocket; each browser listens on a topic named after its id
function mqttOpen(url){
  let ws; try { ws = new WebSocket(url, 'mqtt'); } catch (e) { return null; } ws.binaryType = 'arraybuffer';
  const enc = new TextEncoder(), dec = new TextDecoder(), str = x => { const b = enc.encode(x); return [b.length >> 8, b.length & 255, ...b]; },
    rl = n => { const o = []; do { let d = n % 128; n = Math.floor(n/128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; }, pkt = (h, body) => new Uint8Array([h, ...rl(body.length), ...body]);
  const api = {ok:false, q:[], subs:new Set(), pid:1,
    send(b){ if (ws.readyState === 1 && api.ok) ws.send(b); else if (api.q.length < 200) api.q.push(b); },
    sub(t){ if (api.subs.has(t)) return; api.subs.add(t); api.pid = (api.pid % 60000) + 1; api.send(pkt(0x82, [api.pid >> 8, api.pid & 255, ...str(t), 0])); },
    pub(t, x){ api.send(pkt(0x30, [...str(t), ...enc.encode(x)])); },
    close(){ clearInterval(api.pi); api.dead = true; try { ws.close(); } catch (e) {} }};
  ws.onopen = () => ws.send(pkt(0x10, [...str('MQTT'), 4, 2, 0, 60, ...str('ks' + rid(14))]));
  ws.onmessage = e => { const d = new Uint8Array(e.data); let i = 0;
    while (i < d.length) { const t = d[i] >> 4, qos = (d[i] >> 1) & 3; let m = 1, len = 0, j = i + 1, b; do { b = d[j++]; len += (b & 127)*m; m *= 128; } while (b & 128 && j < d.length);
      const body = d.subarray(j, j + len);
      if (t === 2) { api.ok = true; for (const x of api.q) ws.send(x); api.q = []; clearInterval(api.pi); api.pi = setInterval(() => { if (ws.readyState === 1) ws.send(new Uint8Array([0xC0, 0])); }, 25000); }
      else if (t === 3) { const tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl)); let msg; try { msg = JSON.parse(dec.decode(body.subarray(2 + tl + (qos ? 2 : 0)))); } catch (er) { msg = null; }
        if (msg && msg.dst === C.myId && topic === PFX + '/' + C.myId) sigMsg(msg); }
      i = j + len; } };
  ws.onclose = () => { api.ok = false; clearInterval(api.pi); };
  return api;
}
function mqStart(){ if (C.mq.length) return; C.mq = C.mqURLs.map(mqttOpen).filter(Boolean); }
function mqInbox(){ for (const q of C.mq) q.sub(PFX + '/' + C.myId); }
function sigSend(o){ if (C.sig) C.sig.send(o); const m = JSON.stringify({...o, src:C.myId}); for (const q of C.mq) q.pub(PFX + '/' + o.dst, m); }
// ---- matchmaking socket (speaks the PeerJS server protocol; it only relays offers, answers and candidates)
function sigOpen(id){
  return new Promise(res => {
    let done = false, ws; const c = C.sigCfg;
    try { ws = new WebSocket(`${c.secure ? 'wss' : 'ws'}://${c.host}:${c.port}${c.path}peerjs?key=${encodeURIComponent(c.key)}&id=${encodeURIComponent(id)}&token=${rid(10)}&version=1.5.4`); }
    catch (e) { res({err:'Could not reach the matchmaking server.'}); return; }
    const hb = setInterval(() => { if (ws.readyState === 1) ws.send('{"type":"HEARTBEAT"}'); }, 5000);
    const fin = r => { if (!done) { done = true; res(r); } };
    const api = {ok:true, id, send:o => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }, close:() => { clearInterval(hb); ws.onclose = null; try { ws.close(); } catch (e) {} }};
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'OPEN') fin(api);
      else if (m.type === 'ID-TAKEN') { clearInterval(hb); fin({taken:true}); try { ws.close(); } catch (e) {} }
      else if (m.type === 'ERROR' || m.type === 'INVALID-KEY') { clearInterval(hb); fin({err:(m.payload && m.payload.msg) || 'Matchmaking error.'}); }
      else if (done && C.sig === api) sigMsg(m); };
    ws.onerror = () => fin({err:'Could not reach the matchmaking server.'});
    ws.onclose = () => { clearInterval(hb); fin({err:'The matchmaking server closed the connection.'}); if (C.sig === api) { C.sig = null; if (C.role === 'host') setTimeout(reopenHost, 4000); } };
    setTimeout(() => { if (!done) { fin({err:'The matchmaking server did not answer.'}); try { ws.close(); } catch (e) {} } }, 12000);
  });
}
async function reopenHost(){ if (C.role !== 'host' || C.sig) return; const r = await sigOpen(C.hostId); if (r.ok && C.role === 'host') C.sig = r; else if (C.role === 'host') setTimeout(reopenHost, 4000); }
async function sigMsg(m){
  const src = m.src;
  try {
    if (m.type === 'OFFER') {
      if (C.role !== 'host') return;
      if (C.link && C.link.open && C.link.peer !== src) { return; }   // one wingman seat
      let L = C.link; if (L && L.n === m.payload.n) return; if (L) linkClose(L);
      L = mkLink(src, false); L.n = m.payload.n; await L.pc.setRemoteDescription(m.payload.sdp);
      const a = await L.pc.createAnswer(); await L.pc.setLocalDescription(a);
      sigSend({type:'ANSWER', dst:src, payload:{sdp:L.pc.localDescription, n:L.n}}); flush(L); status('A wingman is connecting…');
    } else if (m.type === 'ANSWER') { const L = C.link; if (L && L.peer === src && !L.pc.remoteDescription) { await L.pc.setRemoteDescription(m.payload.sdp); flush(L); status('The host answered. Linking your browsers…'); } }
    else if (m.type === 'CANDIDATE') { const L = C.link; if (!L || L.peer !== src) return; if (L.pc.remoteDescription) L.pc.addIceCandidate(m.payload.c).catch(() => {}); else (L.cq = L.cq || []).push(m.payload.c); }
  } catch (e) { console.warn('signal', e); }
}
function flush(L){ for (const c of L.cq || []) L.pc.addIceCandidate(c).catch(() => {}); L.cq = []; }
// ---- browser-to-browser link: 'r' reliable and ordered, 'u' fire-and-forget (poses, snapshots)
function mkLink(peer, init){
  const pc = new RTCPeerConnection({iceServers:C.ice}), L = {peer, pc, r:null, u:null, open:false, parts:{}, n:init ? rid(8) : ''};
  pc.onicecandidate = e => { if (e.candidate) sigSend({type:'CANDIDATE', dst:peer, payload:{c:e.candidate.toJSON ? e.candidate.toJSON() : e.candidate, n:L.n}}); };
  pc.onconnectionstatechange = () => { const s = pc.connectionState; if (s === 'failed' || s === 'closed') linkDown(L); else if (s === 'disconnected') { clearTimeout(L.dT); L.dT = setTimeout(() => { if (pc.connectionState !== 'connected') linkDown(L); }, 5000); } };
  const wire = ch => { ch.onopen = () => { if (!L.open && L.r && L.r.readyState === 'open' && L.u && L.u.readyState === 'open') { L.open = true; linkUp(L); } }; ch.onmessage = e => recv(L, e.data); ch.onclose = () => linkDown(L); };
  if (init) { L.r = pc.createDataChannel('r', {ordered:true}); L.u = pc.createDataChannel('u', {ordered:false, maxRetransmits:0}); wire(L.r); wire(L.u);
    pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => sigSend({type:'OFFER', dst:peer, payload:{sdp:pc.localDescription, v:VER, n:L.n}})).catch(e => console.warn(e)); }
  else pc.ondatachannel = e => { if (e.channel.label === 'r') L.r = e.channel; else L.u = e.channel; wire(e.channel); };
  C.link = L; return L;
}
function linkClose(L){ L.dead = true; try { L.pc.close(); } catch (e) {} if (C.link === L) C.link = null; }
function send(o, fast){
  const L = C.link; if (!L || !L.open || L.dead) return; const s = JSON.stringify(o);
  try {
    if (fast && L.u.readyState === 'open' && s.length < 15000) { L.u.send(s); return; }
    if (L.r.readyState !== 'open') return; if (s.length < 15000) { L.r.send(s); return; }
    const id = rid(6), n = Math.ceil(s.length/15000); for (let i = 0; i < n; i++) L.r.send(`~${id}|${i}|${n}|` + s.slice(i*15000, (i + 1)*15000));
  } catch (e) {}
}
C.send = send;
function recv(L, d){
  if (typeof d !== 'string') return;
  if (d[0] === '~') { const a = d.indexOf('|'), b = d.indexOf('|', a + 1), c = d.indexOf('|', b + 1), id = d.slice(1, a), i = +d.slice(a + 1, b), n = +d.slice(b + 1, c);
    const P = L.parts[id] = L.parts[id] || []; P[i] = d.slice(c + 1); if (P.filter(x => x !== undefined).length < n) return; delete L.parts[id]; d = P.join(''); }
  let m; try { m = JSON.parse(d); } catch (e) { return; }
  try { if (C.role === 'host') hostRecv(m); else guestRecv(m); } catch (e) { console.error('coop', m.t, e); }
}
function linkUp(L){
  if (C.role === 'guest') { C.st = 'joined'; send({t:'hello', v:VER, name:G.save.callsign || 'Wingman', frame:frameInfo()}); status('Connected. Waiting for the lead to launch a sortie…'); G.audio.chime && G.audio.chime(); }
  else { status('Wingman connected. Waiting for their hello…'); }
}
function linkDown(L){
  if (L.downDone) return; L.downDone = true; linkClose(L);
  if (C.role === 'host') {
    const wasName = C.peerName; C.peerName = ''; C.peerFrame = null; C.ready = false; C.started = false;
    status(`${esc(wasName || 'Your wingman')} left. Waiting for a wingman: share the code <b>${esc(C.code)}</b>.`);
    const g = C.game; if (g && !g.over && g.wing && g.wing.remote) { g.wing.remote = false; G.hud.radio('Bastion', `${wasName || 'Your wingman'} has dropped off the net. The AI is flying their wing.`); }
    renderCard();
  } else if (C.role === 'guest') {
    C.st = 'off'; status('Lost the connection to the lead.', true);
    const g = C.game; if (g && !g.over) g.end(false, 'Lost the link to your lead');
    C.role = null; renderCard();
  }
}
const frameInfo = () => { const f = G.frame(); return {id:f.id, lasers:G.laserCount(f)}; };

// ---- local test transport (?coopLocal=1): two tabs of the same browser talk over a BroadcastChannel instead of WebRTC
const LOCAL = new URLSearchParams(location.search).get('coopLocal') === '1';
function bcLink(role){
  const ch = new BroadcastChannel('kestrel-coop-' + slug(C.code)), me = role;
  const mk = () => ({readyState:'open', send:d => ch.postMessage({from:me, d})});
  const L = {peer:'local', pc:{close(){ ch.close(); }}, r:mk(), u:mk(), open:false, parts:{}};
  ch.onmessage = e => { if (e.data.from === me) return; if (e.data.d === '__hi' && !L.open) { L.open = true; ch.postMessage({from:me, d:'__hi'}); linkUp(L); return; } if (e.data.d === '__hi') return; recv(L, e.data.d); };
  C.link = L; ch.postMessage({from:me, d:'__hi'}); return L;
}
// ---- hosting and joining
async function host(){
  if (LOCAL) { C.code = 'local-test-1'; C.role = 'host'; C.st = 'host'; bcLink('host'); status(`Hosting (local test). Code <b>${C.code}</b>.`); renderCard(); return; }
  cfg(); if (typeof RTCPeerConnection === 'undefined') { status('This browser cannot make peer-to-peer connections.', true); return; }
  C.code = genCode(); C.role = 'host'; C.hostId = `${PFX}-${slug(C.code)}-host`; mqStart(); status('Contacting the matchmaking server…');
  const r = await sigOpen(C.hostId);
  if (r.taken) { C.code = genCode(); C.hostId = `${PFX}-${slug(C.code)}-host`; return host(); }
  if (!r.ok) { C.role = null; status((r.err || 'Matchmaking failed.') + ' Check your connection and try again.', true); renderCard(); return; }
  C.sig = r; C.myId = C.hostId; mqInbox(); C.st = 'host';
  status(`Hosting. Send your wingman the code <b>${esc(C.code)}</b> or the invite link.`); renderCard();
}
async function join(code){
  if (LOCAL) { C.code = String(code || 'local-test-1'); C.role = 'guest'; bcLink('guest'); status('Joining (local test)…'); renderCard(); return; }
  cfg(); if (typeof RTCPeerConnection === 'undefined') { status('This browser cannot make peer-to-peer connections.', true); return; }
  code = String(code || '').trim(); if (!slug(code)) { status('Enter the code your lead gave you.', true); return; }
  C.code = code; C.role = 'guest'; C.hostId = `${PFX}-${slug(code)}-host`; mqStart(); status('Contacting the matchmaking server…'); renderCard();
  const me = `${PFX}-${slug(code)}-g-${rid(6)}`, r = await sigOpen(me);
  if (!r.ok) { C.role = null; status((r.err || 'Matchmaking failed.') + ' Check your connection and try again.', true); renderCard(); return; }
  C.sig = r; C.myId = me; mqInbox(); status('Found the session. Opening a direct connection…');
  dial(0);
}
function dial(n){
  const L = mkLink(C.hostId, true); clearTimeout(C.dT);
  C.dT = setTimeout(() => { if (C.link !== L || L.open) return;
    linkClose(L);
    if (n < 2) { status(n ? 'Still trying to reach the lead…' : 'The lead has not answered yet. Asking again…'); dial(n + 1); }
    else { C.role = null; status('Could not reach the lead. Check the code, and ask them to keep the game open in front (not a background tab). Some networks block direct browser connections.', true); renderCard(); }
  }, n ? 13000 : 9000);
}
function leave(){
  if (C.link) { send({t:'bye'}); const L = C.link; setTimeout(() => linkClose(L), 200); }
  if (C.sig) { C.sig.close(); C.sig = null; } for (const q of C.mq) q.close(); C.mq = [];
  C.role = null; C.st = 'off'; C.peerName = ''; C.ready = false; C.started = false; status(''); renderCard();
}
C.leave = leave;

// ---- lobby card (opened from the hangar)
function renderCard(){
  const box = $('coBody'); if (!box) return;
  const s = C.st, cs = esc(G.save.callsign || 'Kestrel 1');
  let h = '';
  if (!C.role) h = `<p>Fly a sortie with a friend: they take your wingman's seat. One of you hosts and picks the mission; the other joins with the code.</p>
    <div class="ov-actions" style="justify-content:flex-start"><button data-co="host">Host a session</button></div>
    <p class="muted" style="margin-top:14px">Joining a friend? Paste their code:</p>
    <div class="ov-actions" style="justify-content:flex-start;gap:8px"><input id="coCode" placeholder="amber-kestrel-42" value="${esc(C.code || '')}" style="flex:1;min-width:0;padding:9px 10px;background:#0d1217;border:1px solid #3a4652;color:#e8eef2;font:15px 'Share Tech Mono',monospace"><button data-co="join">Join</button></div>`;
  else if (C.role === 'host') h = `<p>You are flying lead as <b>${cs}</b>.</p>${C.code ? `<p>Session code: <b style="font-size:20px;letter-spacing:.06em">${esc(C.code)}</b></p>
    <p class="muted" style="word-break:break-all">${esc(inviteURL(C.code))}</p><div class="ov-actions" style="justify-content:flex-start"><button data-co="copy">Copy invite link</button><button class="ghost" data-co="leave">End session</button></div>` : ''}
    <p class="muted">${C.peerName ? `Wingman: <b>${esc(C.peerName)}</b>. Pick any sortie or story mission and launch; they launch with you.` : 'When your wingman joins, launch any mission as normal.'}</p>`;
  else h = `<p>Joining as <b>${cs}</b>. Session <b>${esc(C.code)}</b>.</p><p class="muted">Choose your frame and loadout in the hangar while you wait. Your lead picks the mission; you launch together.</p>
    <div class="ov-actions" style="justify-content:flex-start"><button class="ghost" data-co="leave">Leave session</button></div>`;
  h += `<p id="coStat" style="margin-top:12px;min-height:1.2em">${C.status || ''}</p>`;
  box.innerHTML = h; if (C.bad) $('coStat').style.color = '#ff7a6a';
  const b = $('btnCoop'); if (b) b.textContent = C.role === 'host' ? (C.peerName ? `Co-op · ${C.peerName} on your wing` : `Co-op · hosting ${C.code}`) : C.role === 'guest' ? (C.st === 'joined' ? 'Co-op · joined' : 'Co-op · connecting') : 'Co-op';
}
C.open = () => {
  G.ui.overlay(`<h2>Co-op</h2><div id="coBody"></div><div class="ov-actions"><button data-act="close">Close</button></div>`, 'slim'); renderCard();
};
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-co]'); if (!b) return; const k = b.dataset.co;
  if (k === 'host') host();
  if (k === 'join') join(($('coCode') || {}).value);
  if (k === 'leave') leave();
  if (k === 'copy') { const t = inviteURL(C.code); try { navigator.clipboard.writeText(t); b.textContent = 'Copied'; } catch (er) { b.textContent = 'Copy failed: select the link'; } }
  G.audio.ui && G.audio.ui();
});
C.boot = () => { const q = new URLSearchParams(location.search).get('coop'); if (q && !C.role) { C.code = q; C.open(); join(q); } };

/* ============================================================ in the mission */
// every entity gets an id so both sides can name it; the host queues new ones for the guest
const baseSpawn = G.spawn;
G.spawn = function(game, type, x, z, o = {}){
  if (o.v === undefined && type !== 'civ') o.v = Math.floor(Math.random()*3);
  const e = baseSpawn(game, type, x, z, o);
  e.id = o.netId || C.nextId++; e.v = o.v; e.so = {type, x, z, alt:o.alt, yaw:e.yaw, v:o.v, w:o.w, d:o.d, h:o.h, tint:o.tint, tag:o.tag || null};
  if (game.coopHost) C.pend.push(e);
  return e;
};
const spawnRec = e => ({id:e.id, so:e.so, hp:e.hp, mx:e.maxHp, nm:e.name, ace:!!e.ace, boss:!!e.boss, bb:e.bossBar || null, task:e.task, team:e.team, a:e.alive});

// host: wrap a few things so the guest hears about them
const baseRadio = G.hud.radio.bind(G.hud);
G.hud.radio = function(from, text){ baseRadio(from, text); if (C.game && C.game.coopHost && C.started) send({t:'radio', f:from, x:text}); };
const baseKill = G.Game.prototype.kill;
G.Game.prototype.kill = function(e, by, info){
  if (this.coopHost && by === 'wing' && !this.training && e.team === 'enemy') { this.wst = this.wst || {cash:0, xp:0, kills:0}; this.wst.cash += e.def.cash; this.wst.xp += e.def.xp; this.wst.kills++; }
  baseKill.call(this, e, by, info);
  if (this.coopHost && C.started) send({t:'die', id:e.id});
};
const baseEnd = G.Game.prototype.end;
G.Game.prototype.end = function(success, reason){
  if (this.coopHost && C.started && !this.over) send({t:'end', ok:!!success, why:reason || '', w:this.wst || {cash:0, xp:0, kills:0}});
  if (this.coopGuest && this.wsSet) { this.stats.cash = this.wsSet.cash; this.stats.xp = this.wsSet.xp; this.stats.kills = this.wsSet.kills; }
  const r = baseEnd.call(this, success, reason);
  if (this === C.game) { C.game = null; C.started = false; C.ready = false; }
  return r;
};
const baseStart = G.Game.prototype.start;
G.Game.prototype.start = function(m){
  C.game = this;
  if (m.coopGuest) { this.coopGuest = true; return guestStart.call(this, m); }
  this.coopHost = C.role === 'host' && !!C.peerName && m.type !== 'training';
  if (this.coopHost) { C.pend = []; C.started = false; }
  baseStart.call(this, m);
  if (this.coopHost) { const ex = this.fx.explosion.bind(this.fx); this.fx.explosion = (p, s) => { ex(p, s); if (C.started) send({t:'fx', p:[p.x, p.y, p.z], s}); }; }
};

// the remote pilot flies the wingman slot on both sides
const W = G.Wingman.prototype, baseWU = W.update, baseWH = W.hit, baseWO = W.order;
W.update = function(dt){ if (!this.remote) return baseWU.call(this, dt); if (!this.alive) return; applyPose(this, dt); };
W.hit = function(amt){
  if (!this.remote) return baseWH.call(this, amt);
  if (this.g.coopHost && this.alive) send({t:'dmg', a:amt, p:[this.pos.x, this.pos.y, this.pos.z]});
};
W.order = function(o, arg){ if (this.remote) { G.hud.flash(`${this.name.toUpperCase()} IS A PILOT · ORDERS OFF`); return; } return baseWO.call(this, o, arg); };
function becomeRemote(Wg, name, frame){
  const g = Wg.g; Wg.remote = true; Wg.name = name || 'Wingman';
  if (frame) { g.scene.remove(Wg.F.root); const f = Object.assign({}, G.frame(frame.id), {lasers:frame.lasers}); Wg.F = G.buildFighter(f); Wg.F.root.rotation.order = 'YXZ'; Wg.F.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scene.add(Wg.F.root); Wg.F.setMode(Wg.mode, true); }
  Wg.np = null;
}
const CTL = ['thrust', 'aimYaw', 'aimPitch', 'wpn', 'swing', 'combo', 'block', 'walk', 'walkAmt', 'lp', 'lr', 'lt', 'ready', 'twist'];
function poseOf(P){
  const F = P.F, r = F.root, c = F.ctl;
  return {t:'p', p:[+r.position.x.toFixed(2), +r.position.y.toFixed(2), +r.position.z.toFixed(2)], q:[r.quaternion.x, r.quaternion.y, r.quaternion.z, r.quaternion.w].map(v => +v.toFixed(4)),
    v:[P.vel.x, P.vel.y, P.vel.z].map(v => +v.toFixed(1)), m:P.mode, hp:Math.round(P.hp), mh:Math.round(P.maxHp), al:P.alive ? 1 : 0, c:CTL.map(k => +(c[k] || 0).toFixed(3)), f:P.alive && G.input.lmb && !(P.mode === 'mech' && P.wpn > 0.02) ? 1 : 0};
}
const tq = new THREE.Quaternion();
function applyPose(Wg, dt){
  const n = Wg.np; if (!n) { Wg.F.update(dt); return; }
  const F = Wg.F, r = F.root;
  if (n.m !== Wg.mode) { Wg.mode = n.m; F.setMode(n.m); }
  // dead-reckon from the last pose so motion stays smooth between packets
  const age = Math.min(0.25, (performance.now() - n.at)/1000);
  Wg.pos.set(n.p[0] + n.v[0]*age, n.p[1] + n.v[1]*age, n.p[2] + n.v[2]*age); Wg.vel.set(n.v[0], n.v[1], n.v[2]);
  const k = Math.min(1, dt*12); r.position.lerp(Wg.pos, k); tq.set(n.q[0], n.q[1], n.q[2], n.q[3]); r.quaternion.slerp(tq, k);
  CTL.forEach((key, i) => F.ctl[key] = n.c[i]);
  Wg.hp = n.hp; Wg.maxHp = n.mh;
  if (Wg.alive && !n.al) { Wg.alive = false; Wg.g.fx.explosion(Wg.pos, 1.6); Wg.g.scene.remove(F.root); G.hud.radio(Wg.name, 'I’m hit! Punching out!'); }
  F.update(dt);
  // muzzle flashes from the remote pilot's gun (visual only)
  if (n.f && (Wg.fT = (Wg.fT || 0) - dt) <= 0) { Wg.fT = 0.09; const g = Wg.g, m = F.world(n.m === 'jet' ? 'nose' : 'gunpod', 0, 0.05, n.m === 'jet' ? 3.5 : 3.9, new V3());
    const d = new V3(0, 0, 1).applyQuaternion(r.quaternion); g.bullets.push({pos:m, vel:d.multiplyScalar(900), life:1.2, dmg:0, team:'player', by:'vis', color:0xa0ffd0, len:6, w:0.45, vis:true}); }
}

// ---- host side
function hostRecv(m){
  const g = C.game;
  if (m.t === 'hello') {
    C.peerName = String(m.name || 'Wingman').slice(0, 16); C.peerFrame = m.frame; status(`<b>${esc(C.peerName)}</b> is on your wing. Pick a mission and launch.`); renderCard();
    if (G.ui.refresh) G.ui.refresh(); G.audio.chime && G.audio.chime();
    if (g && !g.over && !C.started) { g.coopHost = true; }
  } else if (m.t === 'ready') { if (g && g.coopHost) { C.ready = true; send({t:'spawn', l:g.ents.filter(e => e.id).map(spawnRec)}); C.pend = []; becomeRemote(g.wing, C.peerName, C.peerFrame); g.wing.hp = g.wing.maxHp; if (!g.wing.alive) { g.wing.alive = true; g.scene.add(g.wing.F.root); } G.hud.radio(C.peerName, 'On your wing, lead.'); } }
  else if (m.t === 'p') { if (g && g.wing.remote) { m.at = performance.now(); g.wing.np = m; } }
  else if (m.t === 'hit') { if (!g || g.over) return; const e = C.byId(g, m.id); if (e && e.alive) g.damageEnt(e, m.a, 'wing', {melee:!!m.me, bomb:!!m.bo}); }
  else if (m.t === 'flare') { if (!g) return; for (const ms of g.missiles) if (ms.team === 'enemy' && ms.target === g.wing && Math.random() < 0.7) ms.target = null; }
  else if (m.t === 'bye') { if (C.link) linkDown(C.link); }
}
C.byId = (g, id) => { if (!g.idMap || g.idMapN !== g.ents.length) { g.idMap = new Map(g.ents.map(e => [e.id, e])); g.idMapN = g.ents.length; } return g.idMap.get(id); };
// host tick: launch the guest once the carrier launch is over, then stream
C.hostTick = (g, dt) => {
  if (!g.coopHost || !C.link || !C.link.open) return;
  if (!C.started) {
    if (g.intro) return;
    C.started = true; const P = g.player, Wg = g.wing;
    const m = Object.assign({}, g.m); delete m.briefLines;
    send({t:'start', m, frame:frameInfo(), name:G.save.callsign || 'Lead', wp:[Wg.pos.x, Wg.pos.y, Wg.pos.z], wy:Math.atan2(P.vel.x, P.vel.z) || 0, sp:P.speed || 170, time:g.time});
    return;
  }
  if (!C.ready) return;
  if (C.pend.length) { send({t:'spawn', l:C.pend.map(spawnRec)}); C.pend = []; }
  C.poT -= dt; if (C.poT <= 0) { C.poT = 0.05; send(poseOf(g.player), true); }
  C.snT -= dt; if (C.snT > 0) return; C.snT = 1/15;
  const Wg = g.wing, gp = Wg.pos, near = p => Math.abs(p.x - gp.x) < 3000 && Math.abs(p.z - gp.z) < 3000;
  const E = []; for (const e of g.ents) { if (!e.alive || !e.id) continue; const st = e.cls === 'struct' || e.cls === 'building';
    if (st && e.hp === e.shp) continue; e.shp = e.hp; E.push([e.id, +e.pos.x.toFixed(1), +e.pos.y.toFixed(1), +e.pos.z.toFixed(1), +e.yaw.toFixed(3), Math.round(e.hp)]); }
  const B = []; for (const b of g.bullets) { if (b.vis || !near(b.pos) || B.length > 140) continue; B.push([+b.pos.x.toFixed(1), +b.pos.y.toFixed(1), +b.pos.z.toFixed(1), Math.round(b.vel.x), Math.round(b.vel.y), Math.round(b.vel.z), b.color, b.len, b.w, b.team === 'enemy' ? 1 : 0]); }
  const M = g.missiles.filter(ms => near(ms.pos)).slice(0, 40).map(ms => [ms.id || (ms.id = C.nextId++), +ms.pos.x.toFixed(1), +ms.pos.y.toFixed(1), +ms.pos.z.toFixed(1), +ms.dir.x.toFixed(3), +ms.dir.y.toFixed(3), +ms.dir.z.toFixed(3), ms.team === 'enemy' ? 1 : 0, ms.target === Wg ? 1 : 0]);
  const O = g.ops ? {c:g.ops.cur, r:g.ops.rtb ? 1 : 0, T:g.ops.tasks.map(T => { const [d, n] = g.ops.progress(T); return [T.done ? 1 : 0, d, n, T.arrived ? 1 : 0]; })} : null;
  send({t:'s', tm:+g.time.toFixed(2), od:g.objDone, ot:g.objTotal, cp:g.complete ? 1 : 0, E, B, M, O}, true);
};

// ---- guest side
function guestRecv(m){
  const g = C.game;
  if (m.t === 'start') { C.lead = {name:m.name, frame:m.frame}; G.ui.coopLaunch(Object.assign(m.m, {coopGuest:true, coopStart:m})); }
  else if (m.t === 'spawn') { if (!g) return; for (const r of m.l) guestSpawn(g, r); }
  else if (m.t === 'p') { if (g && g.wing.remote) { m.at = performance.now(); g.wing.np = m; } }
  else if (m.t === 's') { if (g) g.snap = m; }
  else if (m.t === 'die') { if (!g) return; const e = C.byId(g, m.id); if (e && e.alive) g.kill(e, 'net', {}); }
  else if (m.t === 'dmg') { if (!g || g.over) return; const P = g.player; if (P.alive) P.damage(m.a, new V3(m.p[0], m.p[1], m.p[2])); }
  else if (m.t === 'radio') { if (g) baseRadio(m.f, m.x); }
  else if (m.t === 'fx') { if (g) g.fx.explosion(new V3(m.p[0], m.p[1], m.p[2]), m.s); }
  else if (m.t === 'end') { if (!g || g.over) return; g.wsSet = m.w; g.end(m.ok, m.ok ? 'Sortie complete with your lead' : (m.why || 'Your lead’s sortie ended')); }
  else if (m.t === 'bye') { if (C.link) linkDown(C.link); }
}
function guestSpawn(g, r){
  if (C.byId(g, r.id)) return;
  const so = r.so, e = G.spawn(g, so.type, so.x, so.z, {netId:r.id, alt:so.alt, yaw:so.yaw, v:so.v, w:so.w, d:so.d, h:so.h, tint:so.tint, tag:so.tag});
  e.hp = r.hp; e.maxHp = r.mx; e.name = r.nm; e.ace = r.ace; e.boss = r.boss; e.bossBar = r.bb; e.task = r.task; e.team = r.team; e.np = null;
  if (r.bb) { if (so.type === 'skycarrier') { g.skycarrier = e; e.mesh.rotation.order = 'YXZ'; } else if (so.type === 'colossus') g.sovereign = e; } if (r.boss) g.hollow = e;
  if (!r.a) { e.alive = false; g.scene.remove(e.mesh); }
}
function guestStart(m){
  // same seed, same mission: identical terrain, carrier and waypoint layout; the host supplies everything that moves
  m.story = null; m.wing = null;
  baseStart.call(this, m);
  if (this.intro) { this.intro = null; G.hud.intro(false); }          // the lead already did the carrier launch
  const s = m.coopStart, P = this.player;
  P.mode = 'jet'; P.F.setMode('jet', true); P.F.setGear && P.F.setGear(false, true);
  P.pos.set(s.wp[0], s.wp[1], s.wp[2]); P.yaw = s.wy; P.pitch = 0.05; P.roll = 0; P.speed = s.sp; P.throttle = 0.7; P.vel.set(Math.sin(s.wy)*s.sp, 0, Math.cos(s.wy)*s.sp); P.gpwsGrace = 4;
  P.F.cockpit(P.view === 'cockpit'); G.hud.setView(P.view);
  G.hud.radio(C.lead.name, `Good to have you, ${G.save.callsign || 'Kestrel'}. Form up on me.`);
  send({t:'ready'});
}
// guest: the mission builder must not spawn anything, and objectives come from the host
const baseSpawnMission = G.spawnMission;
G.spawnMission = function(game, L){
  if (!game.coopGuest) return baseSpawnMission(game, L);
  if (game.m.type === 'ops') { game.ops = new G.Ops(game, L); game.ops.update = () => {}; const pr = game.ops.progress.bind(game.ops); game.ops.progress = T => T.np || pr(T); }
  game.updateObjectives = () => {};
  const Wg = game.wing; becomeRemote(Wg, C.lead.name, C.lead.frame); Wg.hp = Wg.maxHp = 9999;
  game.rb = []; game.rm = new Map();
  game.damageEnt = function(e, amt, by, info){   // the host decides what dies; show the hit here
    if (!e.alive || !e.id) return;
    C.hits.push({t:'hit', id:e.id, a:+amt.toFixed(1), me:info && info.melee ? 1 : 0, bo:info && info.bomb ? 1 : 0});
    e.hitT = 0.12; if (by === 'player') G.hud.hitMark(false, e);
  };
};
// guest: enemies are puppets moved by the host's snapshots
const baseUE = G.updateEnemy;
G.updateEnemy = function(game, e, dt){
  if (!game.coopGuest) return baseUE(game, e, dt);
  const n = e.np; if (!n) return;
  const k = Math.min(1, dt*10); e.vel.set((n[1] - e.pos.x)*2, (n[2] - e.pos.y)*2, (n[3] - e.pos.z)*2);
  e.pos.x += (n[1] - e.pos.x)*k; e.pos.y += (n[2] - e.pos.y)*k; e.pos.z += (n[3] - e.pos.z)*k;
  let dy = n[4] - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += dy*k;
  e.hp = n[5]; e.mesh.position.copy(e.pos);
  if (e.cls === 'air' && e.dir) { e.mesh.lookAt(e.pos.x + e.vel.x, e.pos.y + e.vel.y, e.pos.z + e.vel.z); } else e.mesh.rotation.y = e.yaw;
  if (e.hitT > 0) e.hitT -= dt;
  const U = e.mesh.userData; if (U.legs && e.cls === 'mech') { const mv = Math.hypot(e.vel.x, e.vel.z) > 1.5; e.wk = (e.wk || 0) + dt*(mv ? 5 : 0); const a = mv ? Math.sin(e.wk)*0.4 : 0; U.legs.forEach((L, i) => { if (L.userData.yaw0 === undefined) L.rotation.x = i % 2 ? -a : a; }); }
};
C.guestTick = (g, dt) => {
  if (!g.coopGuest) return;
  const P = g.player;
  // snapshot -> puppets, shots, missiles, objectives
  const s = g.snap; if (s) { g.snap = null;
    for (const r of s.E) { const e = C.byId(g, r[0]); if (e) { if (!e.np && e.cls === 'air') { e.pos.set(r[1], r[2], r[3]); } e.np = r; e.dir = e.dir || new V3(); } }
    for (const b of g.rb) b.dead = true;
    g.rb = s.B.map(b => ({pos:new V3(b[0], b[1], b[2]), vel:new V3(b[3], b[4], b[5]), color:b[6], len:b[7], w:b[8], life:0.3, vis:true, team:b[9] ? 'enemy' : 'player'}));
    const seen = new Set();
    for (const q of s.M) { seen.add(q[0]); let r = g.rm.get(q[0]);
      if (!r) { r = {mesh:G.buildMissile(!!q[7]), pos:new V3(q[1], q[2], q[3])}; g.scene.add(r.mesh); g.rm.set(q[0], r); }
      r.np = q; r.at = performance.now(); r.atMe = !!q[8]; }
    for (const [id, r] of g.rm) if (!seen.has(id)) { g.scene.remove(r.mesh); g.rm.delete(id); }
    g.objDone = s.od; g.objTotal = s.ot; g.complete = !!s.cp;
    if (s.O && g.ops) { g.ops.cur = s.O.c; g.ops.rtb = !!s.O.r; s.O.T.forEach((t, i) => { const T = g.ops.tasks[i]; if (!T) return; T.done = !!t[0]; T.np = [t[1], t[2]]; T.arrived = !!t[3]; }); }
  }
  for (const b of g.rb) { b.pos.addScaledVector(b.vel, dt); b.life -= dt; }
  let inbound = 0;
  for (const r of g.rm.values()) { const q = r.np, age = (performance.now() - r.at)/1000, sp = 150;
    r.pos.set(q[1] + q[4]*sp*age, q[2] + q[5]*sp*age, q[3] + q[6]*sp*age); r.mesh.position.copy(r.pos); r.mesh.lookAt(r.pos.x + q[4], r.pos.y + q[5], r.pos.z + q[6]); if (r.atMe) inbound++; }
  P.lockedBy = Math.max(P.lockedBy || 0, inbound); g.inboundMis = inbound;
  g.tracers.draw(g.bullets.concat(g.rb.filter(b => b.life > 0)));
  // my Kestrel to the host, my hits, my flares
  C.poT -= dt; if (C.poT <= 0) { C.poT = 0.05; send(poseOf(P), true); }
  if (C.hits.length) { for (const h of C.hits.splice(0)) send(h); }
};
// hooks into the frame loop and a couple of player actions
const baseUpd = G.Game.prototype.update;
G.Game.prototype.update = function(dt){
  if (this.coopGuest && G.input.pressed.has('KeyR')) { G.input.pressed.delete('KeyR'); G.hud.flash('YOUR LEAD CALLS THE RTB'); }
  baseUpd.call(this, dt);
  if (this.over) return;
  if (this.coopHost) C.hostTick(this, dt); else if (this.coopGuest) C.guestTick(this, dt);
};
const baseUB = G.Game.prototype.updateBullets;
G.Game.prototype.updateBullets = function(dt){
  // visual-only tracers (the remote pilot's gun) fly but never hit
  const vis = this.bullets.filter(b => b.vis); if (vis.length) this.bullets = this.bullets.filter(b => !b.vis);
  baseUB.call(this, dt);
  for (const b of vis) { b.pos.addScaledVector(b.vel, dt); b.life -= dt; if (b.life > 0) this.bullets.push(b); }
};
C.flare = g => { if (g && g.coopGuest) send({t:'flare'}); };
C.guestCanEnd = g => !(g && g.coopGuest);
})();
