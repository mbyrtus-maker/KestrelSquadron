(function(){
'use strict';
/* =====================================================================
   Campaign: "Halcyon Burning"
   The Halcyon Republic vs. the Varn Hegemony. Orders come from Lt. Cmdr.
   Selene Arkwright, operations officer of the battle carrier Bastion.
   Every story node branches on PERFECT (success + every side objective),
   SUCCESS, or FAILURE.
   ===================================================================== */
const G = window.G, V3 = THREE.Vector3;
const cs = () => G.save.callsign || 'Kestrel';

/* ---------- Wingmen ---------- */
G.WINGMEN = {
  ridge:{id:'ridge', name:'Ridge', full:'Lt. Tomas “Ridge” Calder', color:0x7d848a, trim:0x2f3d4c, hp:1600, dmg:1, mis:1,
    trait:'Balanced · 1,600 hull', bio:'Your wingman since flight school. Steady, by the book, never loses formation, and owes Arkwright a report he will never write.',
    splash:['Splash one.', 'Got him.', 'Target destroyed.', 'Scratch that one.'], down:"I'm hit! Punching out!", hurt:"Taking heavy fire. I can't stay in this long.",
    modes:{jet:'Back to fighter, matching you.', hover:'Going to hover with you.', mech:'Switching to mech. Right behind you.'}},
  vesper:{id:'vesper', name:'Vesper', full:'Ens. Nadia “Vesper” Ilyin', color:0x908d86, trim:0x6a2630, hp:1250, dmg:1.15, mis:0.55,
    trait:'Aggressive · missiles twice as often · 1,250 hull', bio:'Top of her academy class and fearless with it. Hits hard and fires missiles at everything, but her light frame breaks sooner.',
    splash:['Splash! Did you see that?', "He's done.", 'Next!', 'Too easy.'], down:"I'm going down! Ejecting!", hurt:"I'm torn up, Lead! Still in it!",
    modes:{jet:'Fighter mode. Try to keep up.', hover:'Hovering. Let me at them.', mech:'Mech mode, feet down!'}},
  hatch:{id:'hatch', name:'Hatch', full:'Sgt. Bram “Hatch” Hatcher', color:0x5c634d, trim:0x2f3a24, hp:2400, dmg:1.1, mis:1.7,
    trait:'Tough · 2,400 hull · slow on missiles', bio:'Port Teague militia. Held the docks for three days in a patched-up frame. Slow on the trigger, nearly impossible to bring down.',
    splash:['Scratch one.', "He's scrap.", "That one's mine.", 'Down he goes.'], down:"Frame's gone. I'm out!", hurt:"I've had worse. Not much worse.",
    modes:{jet:'Fighter. Never liked it.', hover:'Hover mode. Steady.', mech:'Boots on the ground. My kind of fight.'}}
};
G.wingAvail = id => { const st = G.save.story, r = st && st.roster; return !!(r && r[id] === 'active'); };
G.activeWing = () => {
  const st = G.save.story; let id = st && st.wing;
  if (!id || !G.wingAvail(id)) id = ['ridge', 'vesper', 'hatch'].find(G.wingAvail) || 'ridge';
  return id;
};
G.wingName = () => { const g = G.game; if (g && g.wing && g.wing.name) return g.wing.name; return G.WINGMEN[G.activeWing()].name; };
G.newStory = () => ({node:'n1', log:[], flags:{}, roster:{ridge:'active', vesper:'locked', hatch:'locked'}, wing:'ridge', ending:null});

/* ---------- The officer ---------- */
G.OFFICER = {name:'Lt. Cmdr. Selene Arkwright', short:'Arkwright', role:'Operations Officer, RHS Bastion'};
/* Original illustrated portrait. Moods change brows and mouth: stern, pleased, angry. */
G.portrait = (mood = 'stern', cls = '') => {
  const B = {stern:['M76 91 Q85 87 94 91.5', 'M106 91.5 Q115 87 124 91'], pleased:['M76 90 Q85 86 94 89.5', 'M106 88 Q115 82 124 87'], angry:['M76 87.5 Q86 88 95 93.5', 'M105 93.5 Q114 88 124 87.5']}[mood] || [];
  const M = {stern:['M90 130 Q95 128 100 129.4 Q105 128 110 130 Q100 132.4 90 130 Z', 'M90 130 Q100 136.5 110 130 Q100 132.4 90 130 Z'],
    pleased:['M90 130.5 Q95 127.6 100 129 Q105 127 111 127.6 Q101 132.2 90 130.5 Z', 'M90 130.5 Q101 137 111 127.6 Q101 132.2 90 130.5 Z'],
    angry:['M90 131.5 Q95 128.8 100 130 Q105 128.8 110 131.5 Q100 132.6 90 131.5 Z', 'M90 131.5 Q100 135.5 110 131.5 Q100 132.6 90 131.5 Z']}[mood] || [];
  const eye = (cx, flip) => `<path d="M${cx - 8} 100 Q${cx} 93.6 ${cx + 8} 99.6 Q${cx} 104 ${cx - 8} 100 Z" fill="#f4efe8"/>
    <circle cx="${cx + (flip ? -0.6 : 0.6)}" cy="99.4" r="3.3" fill="#4d7a63"/><circle cx="${cx + (flip ? -0.6 : 0.6)}" cy="99.4" r="1.5" fill="#101414"/><circle cx="${cx + (flip ? -1.6 : 1.8)}" cy="98.2" r="0.8" fill="#fff"/>
    <path d="M${cx - 9} 100 Q${cx} 92.6 ${cx + 9} 99" fill="none" stroke="#1d1515" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M${flip ? cx - 9 : cx + 9} ${flip ? 100 : 99} l${flip ? -3.2 : 3.2} -2.6" stroke="#1d1515" stroke-width="1.6" stroke-linecap="round"/>`;
  return `<svg class="portrait ${cls}" viewBox="0 0 200 240" role="img" aria-label="Portrait of ${G.OFFICER.name}, looking ${mood}">
  <defs><linearGradient id="pbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2f3b"/><stop offset="1" stop-color="#0c141a"/></linearGradient>
  <linearGradient id="pvis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f33"/><stop offset="1" stop-color="#07090a"/></linearGradient></defs>
  <rect width="200" height="240" fill="url(#pbg)"/>
  <path d="M0 214 L40 240 H0Z M200 30 L170 0 H200Z" fill="#ffb238" opacity=".18"/>
  <ellipse cx="100" cy="94" rx="40" ry="44" fill="#5c241a"/>
  <path d="M66 96 C62 122 70 140 80 146 L78 110Z" fill="#5c241a"/>
  <path d="M20 240 C24 198 54 180 86 172 L100 184 L114 172 C146 180 176 198 180 240Z" fill="#1c2a3c"/>
  <path d="M30 240 C34 210 56 192 80 184 L84 194 C64 202 46 218 42 240Z" fill="#26384f"/>
  <path d="M88 138 L88 172 L100 184 L112 172 L112 138Z" fill="#c98f6e"/>
  <path d="M88 168 L100 186 L112 168 L108 166 L100 178 L92 166Z" fill="#eef1f2"/>
  <path d="M84 162 L100 186 L88 190 L74 168Z M116 162 L100 186 L112 190 L126 168Z" fill="#17222f" stroke="#d9a640" stroke-width="1.4"/>
  <path d="M34 194 L66 182 L70 190 L38 203Z M166 194 L134 182 L130 190 L162 203Z" fill="#141e2a" stroke="#d9a640" stroke-width="1.2"/>
  <path d="M40 196 L64 187 M42 200 L66 191 M160 196 L136 187 M158 200 L134 191" stroke="#d9a640" stroke-width="1.6"/>
  <rect x="50" y="208" width="8" height="5" fill="#b8323b"/><rect x="58" y="208" width="8" height="5" fill="#2e6fa8"/><rect x="66" y="208" width="8" height="5" fill="#d9a640"/>
  <rect x="50" y="213" width="8" height="5" fill="#2f8a5a"/><rect x="58" y="213" width="8" height="5" fill="#eef1f2"/><rect x="66" y="213" width="8" height="5" fill="#7a2430"/>
  <rect x="124" y="208" width="34" height="9" rx="1" fill="#d9a640"/><text x="141" y="215" text-anchor="middle" font-size="6.2" font-family="monospace" font-weight="700" fill="#1c2a3c">ARKWRIGHT</text>
  <ellipse cx="69" cy="102" rx="4.5" ry="7.5" fill="#d9a07c"/><ellipse cx="131" cy="102" rx="4.5" ry="7.5" fill="#d9a07c"/>
  <circle cx="69.5" cy="110" r="1.6" fill="#e8c35a"/><circle cx="130.5" cy="110" r="1.6" fill="#e8c35a"/>
  <path d="M70 92 C70 70 84 58 100 58 C116 58 130 70 130 92 C130 112 124 128 114 140 C108 147 104 150 100 150 C96 150 92 147 86 140 C76 128 70 112 70 92Z" fill="#e8b994"/>
  <path d="M120 72 C128 84 130 104 124 124 C120 134 114 142 106 148 C114 136 120 120 120 100Z" fill="#c98f6e" opacity=".55"/>
  <ellipse cx="84" cy="114" rx="7" ry="4" fill="#e0867a" opacity=".22"/><ellipse cx="117" cy="114" rx="7" ry="4" fill="#e0867a" opacity=".22"/>
  <path d="M100 103 Q98.4 113 96.2 117.4 Q100 120 103.8 117.6" fill="none" stroke="#b9805f" stroke-width="1.6" stroke-linecap="round"/>
  ${eye(86, true)}${eye(114, false)}
  <path d="${B[0]}" fill="none" stroke="#4a1d15" stroke-width="3.2" stroke-linecap="round"/><path d="${B[1]}" fill="none" stroke="#4a1d15" stroke-width="3.2" stroke-linecap="round"/>
  <path d="${M[0]}" fill="#a8323a"/><path d="${M[1]}" fill="#bf3d45"/><path d="M95 133 Q100 134.4 104 133" stroke="#e7a0a2" stroke-width=".9" fill="none" opacity=".7"/>
  <path d="M69 86 C72 66 92 58 124 64 C112 68 103 76 97 92 C91 80 80 79 69 86Z" fill="#6b2a1e"/>
  <path d="M84 70 C94 64 108 63 120 65 C108 68 100 74 96 82 C93 76 89 72 84 70Z" fill="#8e3a27"/>
  <path d="M128 78 C132 90 132 104 130 114 L126 96Z" fill="#6b2a1e"/>
  <g transform="rotate(-5 100 60)">
    <ellipse cx="100" cy="47" rx="49" ry="13" fill="#2a3d55"/>
    <path d="M58 50 C58 40 142 40 142 50 L136 66 C122 70 78 70 64 66Z" fill="#1c2a3c"/>
    <path d="M63 58 C80 61 120 61 137 58 L136 64 C120 67 80 67 64 64Z" fill="#d9a640"/>
    <path d="M64 66 Q100 76 136 66 L133 73 Q100 85 67 73Z" fill="url(#pvis)"/><path d="M76 71 Q100 78 122 71" stroke="#fff" stroke-width="1" opacity=".25" fill="none"/>
    <path d="M100 49 l3 5 l8 -2 l-6 5 l-5 3 l-5 -3 l-6 -5 l8 2Z" fill="#e8c35a"/><circle cx="100" cy="53.5" r="2.4" fill="#b8323b"/>
  </g>
  <rect x=".5" y=".5" width="199" height="239" fill="none" stroke="#ffb238" stroke-opacity=".35"/>
</svg>`;
};

/* ---------- Story graph ----------
   tasks: list or function of flags. Task fields: kind, n, place, at (fixed position), text (HUD/brief override), who (rescue speaker), hostiles. */
const N = G.STORY = {};
N.n1 = {chapter:'Chapter 1 · Invasion', title:'First Light', place:'Corran Isle', tier:1, pay:2.6, seed:410337, wing:'ridge',
  tasks:[{kind:'patrol', n:3, place:'the north coast', hostiles:true}, {kind:'armor', n:5, place:'Fisher Bay'}, {kind:'rescue', n:2, place:'Mill Valley', who:'Fisher families'}],
  sides:[{key:'wingman'}, {key:'hull'}], mood:'stern',
  brief:() => [`Sit down, ${cs()}. No, not there. There.`,
    'At 0400 the Varn Hegemony put armor on the beach at Fisher Bay. The Republic’s official position is “outrage.” Mine is that you are going to burn every tank on that beach before breakfast.',
    'Sweep the coast for fighters, break the armor column, then pull the fishing families out of Mill Valley. Ridge flies your wing. Bring him back; he still owes me a report.',
    'This is the first sortie of the war. Don’t make it the last.'],
  radio:{start:'Lantern to Kestrel flight. Weapons free. The Republic is watching, so try to look competent.',
    done:{0:'Coast is clear. Now the beach.', 1:'Column’s broken. Mill Valley next. Those families have been hiding in a cellar since dawn.'}},
  out:{
    perfect:{mood:'pleased', say:'Every tank, every family, and Ridge didn’t even scratch his paint. Don’t let it go to your head. It barely fits in the cockpit as it is.',
      then:'Command takes notice. You get first pick of the next operation: a deep strike on the Varn staging base.', flags:{commended:1}, next:'n2a'},
    success:{mood:'stern', say:'The beach is ours. Messier than I like, but I’ll take it. Get some sleep. That isn’t a suggestion.',
      then:'Varn landing forces fall back inland to their staging base at Dry Lake.', next:'n2a'},
    fail:{mood:'angry', say:`Fisher Bay held. Then it didn’t. The Varn rolled straight through to Port Teague and they’re dug into the streets. So tomorrow, ${'{cs}'}, you’re going to go and get it back.`,
      then:'Port Teague, the Republic’s second city, falls under Varn occupation.', flags:{varnStrong:1}, next:'n2b'}
  }};
N.n2a = {chapter:'Chapter 2 · The Staging Base', title:'Lantern Run', place:'Halvorsen Isle', tier:2, pay:2.8, seed:822991, wing:'ridge',
  tasks:f => [{kind:'sam', n:f.varnStrong ? 4 : 3, place:'Saddle Pass'}, {kind:'base', n:5, place:'Dry Lake'}, {kind:'patrol', n:3, place:'the Dry Lake approaches', hostiles:true}],
  sides:[{key:'hull'}, {key:'aa'}], mood:'stern',
  brief:f => [f.commended ? `Command gave me a medal for yesterday. I gave it to the coffee machine. You’re welcome, ${cs()}.` : 'Yesterday was adequate. Today needs to be better than adequate.',
    'Recon found their staging base at Dry Lake, behind a SAM screen at Saddle Pass. Peel the SAMs, then flatten the base. Ground missiles for the heavy buildings; air-to-air rounds only scratch them and I don’t pay for scratches.',
    'Intelligence keeps whispering a name: Hollow. The Varn’s best ace. If you see red tails, you don’t dogfight. You call it in. Clear?'],
  radio:{start:'Lantern on station. Saddle Pass first. Stay low until the SAMs are gone.', done:{0:'SAM screen is down. Dry Lake is all yours.', 1:'Base is burning. Sweep the approaches and come home.'}},
  out:{
    perfect:{mood:'pleased', say:'Base gone, SAMs gone, and the rubble scans pulled their flight logs out of the command post. I could almost forgive you for being late this morning. Almost.',
      then:'The recovered logs map Hollow’s patrol routes. When he comes, you’ll see him first.', flags:{intel:1}, next:'n3'},
    success:{mood:'stern', say:'Dry Lake is a crater. Good. The Varn will want revenge, and they will send their best to get it.', then:'The Varn regroup for a strike on the Bastion itself.', next:'n3'},
    fail:{mood:'angry', say:'The base is still standing and now they know we’re coming. Wonderful. Regroup, rearm, and stop making that face.', then:'Varn reinforcements pour in from the staging base. Their next strike will hit harder.', flags:{varnStrong:1}, next:'n3'}
  }};
N.n2b = {chapter:'Chapter 2 · Occupation', title:'Streets of Port Teague', place:'Corran Isle', tier:2, pay:2.9, seed:563104, wing:'ridge',
  tasks:[{kind:'walkers', n:2, place:'Radio Hill'}, {kind:'city', n:7, place:'Port Teague'}],
  sides:[{key:'collat'}, {key:'hull'}], mood:'angry',
  brief:() => ['Port Teague. Forty thousand people, one Varn armored regiment, and you.',
    `Walkers on Radio Hill are shelling the harbor. Kill them, then take the streets back. The streets are crawling with Reavers, their blade-armed hunters; gunfire barely scratches them, so draw your sword and meet them up close. And no ground missiles over my city.`,
    'If I see a single civilian tower come down on the evening news, you will be repainting the Bastion’s hull with a toothbrush.'],
  radio:{start:'Lantern to Kestrel. Radio Hill first. Their guns are on the harbor.', done:{0:'Guns are quiet. Into the city. Watch your fire.'}},
  out:{
    perfect:{mood:'pleased', say:'Not one civilian building lost. The mayor wants to name a street after you. I told him to name it after me. I wrote the plan.',
      then:'A militia pilot called Hatch, who held the docks for three days, asks to fly with you. He joins the roster.', flags:{commended:1}, roster:{hatch:'active'}, next:'n3'},
    success:{mood:'stern', say:'Port Teague is free. A few buildings fewer than this morning, but free.', then:'Hatch, the militia pilot who held the docks, joins the roster.', roster:{hatch:'active'}, next:'n3'},
    fail:{mood:'angry', say:'We pulled out of Port Teague under fire. They’re digging in deeper. We move on, because we have to.', then:'The Varn hold Port Teague. Their next strike will hit harder.', flags:{varnStrong:1}, next:'n3'}
  }};
N.n3 = {chapter:'Chapter 3 · Black Tide', title:'Black Tide', place:'Sable Key', tier:2, pay:3.0, seed:190077, wing:'ridge',
  tasks:f => [{kind:'air', n:f.varnStrong ? 6 : 5, place:'the Sable shoals', at:{x:1700, z:-3900}}, {kind:'armor', n:f.varnStrong ? 6 : 4, place:'East Shore'}],
  sides:[{key:'hollow'}, {key:'hull'}], mood:'stern',
  brief:f => ['Varn strike group inbound on the Bastion. Fighters first, then landing craft hitting the east shore. Stop both.',
    f.intel ? 'Thanks to your flight logs, we know this is Hollow’s patrol route. He will come. When he does, you’ll have warning.' : 'Patrol chatter says Hollow may be in the area. If he shows, stay on Ridge’s wing.',
    'I am not losing anyone today. That’s not a hope, it’s an order.'],
  radio:{start:'Lantern to all flights. Bastion is under threat. Kestrel, you are the wall.', done:{0:'Fighters are down. Landing craft on the east shore. Go.'}},
  script:{done:{1:'hollowAmbush'}},
  out:{
    perfect:{mood:'pleased', say:'You put holes in Hollow’s wings. Nobody has done that. He knows your name now, which is either very good or very bad.',
      then:'Ridge was captured alive. Varn radio places him in a prison camp at Grayhook. Arkwright already has a plan. Vesper, a new pilot, is assigned to you.', roster:{ridge:'captured', vesper:'active'}, flags:{hollowScarred:1}, next:'n4r'},
    success:{mood:'stern', say:'The Bastion is still afloat. Ridge isn’t on it.', then:'Ridge was captured alive and taken to a prison camp at Grayhook. Vesper, a new pilot, is assigned to your wing for the rescue.', roster:{ridge:'captured', vesper:'active'}, next:'n4r'},
    fail:{mood:'angry', say:'We lost the east shore, and we lost the search window. The Varn found Ridge’s chute before our rescue birds did.',
      then:'Ridge is listed killed in action. Vesper, fresh from the academy, takes his place on your wing.', roster:{ridge:'kia', vesper:'active'}, flags:{ridgeKIA:1}, next:'n4m'}
  }};
N.n4r = {chapter:'Chapter 4 · Prisoners', title:'Ridge Line', place:'Grayhook Isle', tier:3, pay:3.2, seed:707212, wing:'vesper',
  tasks:[{kind:'sam', n:3, place:'the Grayhook hills'}, {kind:'rescue', n:1, place:'Grayhook Camp', who:'Ridge', text:'Land at Grayhook Camp and pull Ridge and the prisoners out'}, {kind:'walkers', n:2, place:'the camp road'}],
  sides:[{key:'hull'}, {key:'time', param:780}], mood:'stern',
  brief:() => ['Ridge is alive. Grayhook Camp, inland, behind three SAM batteries.',
    'Vesper flies your wing. She’s young, she’s fast, and she doesn’t listen either, so you two will get along beautifully.',
    'Kill the SAMs, set down at the camp, and get Ridge aboard: hover low or walk in. Then break the walker squad on the camp road before it chases you home. The clock matters. They will move him.'],
  radio:{start:'Lantern to Kestrel. Clock’s running. They move prisoners at dusk.', done:{0:'Air defense is down. Get to the camp.', 1:'He’s aboard? Good. Now kill those walkers before they follow you out.'}},
  boardLine:'About time. The food here is terrible, and they kept asking about you.',
  out:{
    perfect:{mood:'pleased', say:'All of them. You brought every prisoner home, inside the window. Go and see him. He’s asking for you, and he is insufferable.',
      then:'Ridge returns to flight status. Vesper stays. From now on you choose who flies your wing.', roster:{ridge:'active'}, flags:{ridgeHero:1}, next:'n5'},
    success:{mood:'stern', say:'Ridge is back. Battered, but back. Next time, faster.', then:'Ridge returns to flight status. From now on you choose who flies your wing.', roster:{ridge:'active'}, next:'n5'},
    fail:{mood:'angry', say:'We were too late. The camp was emptied an hour before you landed. Ridge is gone. I’m sorry, Kestrel. I am.',
      then:'Ridge is listed killed in action. Vesper stays on your wing.', roster:{ridge:'kia'}, flags:{ridgeKIA:1}, next:'n5'}
  }};
N.n4m = {chapter:'Chapter 4 · Payback', title:'Payback', place:'Kettle Island', tier:3, pay:3.2, seed:338808, wing:'vesper',
  tasks:[{kind:'walkers', n:3, place:'Pine Hollow'}, {kind:'base', n:5, place:'the Old Quarry airfield'}],
  sides:[{key:'mechkills'}, {key:'hull'}], mood:'angry',
  brief:() => ['I don’t do speeches. Ridge would have hated one anyway.',
    'Hollow flies out of an airfield at the Old Quarry. Its walker guard is parked at Pine Hollow. Take both.',
    'Vesper is on your wing. Show her how it’s done. Make it count.'],
  radio:{start:'Lantern to Kestrel. For Ridge.', done:{0:'Walker guard is down. The airfield is open.'}},
  out:{
    perfect:{mood:'pleased', say:'That one was for Ridge. He’d have said something stupid about it. I’ll say it instead: good flying.', then:'Hollow has lost his home field. He’ll have to come to you.', flags:{intel:1}, next:'n5'},
    success:{mood:'stern', say:'The airfield is burning. It doesn’t bring him back. It helps.', then:'Hollow relocates to the northern fortress.', next:'n5'},
    fail:{mood:'angry', say:'Hollow’s airfield survived, and so did Hollow. Grieve on your own time, pilot. Tomorrow I need you sharp.', then:'Hollow keeps his airfield. Expect more fighters at the fortress.', flags:{varnStrong:1}, next:'n5'}
  }};
N.n5 = {chapter:'Chapter 5 · The Iron Curtain', title:'Iron Curtain', place:'Tamsin Island', tier:3, pay:3.3, seed:950142, wing:null,
  tasks:f => [{kind:'sam', n:f.varnStrong ? 5 : 4, place:'Kettle Pass'}, {kind:'recon', n:3, place:'the fortress approaches'}, {kind:'walkers', n:3, place:'the northern plateau'}],
  sides:[{key:'aa'}, {key:'hull'}], mood:'stern',
  brief:f => ['This is it. The Varn command fortress sits on the northern plateau. Between us and it: the Iron Curtain, the densest air defense belt in the archipelago.',
    'Punch a hole in the SAM belt, photograph the fortress approaches below 150 meters, and break the walker reserve.',
    f.ridgeKIA ? 'Pick your wingman. Pick well. I can’t lose another one.' : f.ridgeHero ? 'Ridge says he’s fit to fly. I say he’s fit to be quiet. Pick your wingman.' : 'Pick your wingman. Tomorrow we end this.'],
  radio:{start:'Lantern to Kestrel. Tear it down.', done:{0:'There’s your hole in the curtain. Get the photographs. Low and slow.', 1:'Photos received. Now break the reserve.'}},
  out:{
    perfect:{mood:'pleased', say:'Every photo is crisp and the belt is in pieces. I’ve already drawn the attack plan. You’ll love it. It is mostly you.', then:'The fortress’s walker guard and air defenses are mapped. The final assault will face less resistance.', flags:{fortressIntel:1}, next:'n6'},
    success:{mood:'stern', say:'Good enough. It will have to be.', then:'The way to the fortress is open.', next:'n6'},
    fail:{mood:'angry', say:'The belt is still mostly up. Tomorrow is going to hurt. Get some rest anyway.', then:'The Varn reinforce the fortress overnight.', flags:{varnStrong:1}, next:'n6'}
  }};
N.n6 = {chapter:'Chapter 6 · Hollow Crown', title:'Hollow Crown', place:'the Varn Fortress, Orrin Atoll', tier:3, pay:3.8, seed:612450, wing:null,
  tasks:f => [{kind:'base', n:f.fortressIntel ? 5 : 7, place:'the fortress'}, {kind:'walkers', n:f.fortressIntel ? 2 : f.varnStrong ? 4 : 3, place:'the fortress gate'}, {kind:'boss', n:1, place:'the plateau', escorts:f.varnStrong ? 3 : f.fortressIntel ? 1 : 2}, {kind:'sovereign', n:1, place:'the fortress plateau'}],
  sides:[{key:'hull'}, {key:'wingman'}], mood:'stern',
  brief:f => ['Final operation. The fortress, the walker guard at its gate, and Hollow, who will come for you personally. He’s that sort.',
    f.fortressIntel ? 'Thanks to your photographs we know exactly where everything is. Use that.' : 'We’re going in with less intelligence than I’d like. Improvise. You’re good at that, apparently.',
    'One more thing. Varn radio keeps mentioning something under that plateau they call the Sovereign. Nobody knows what it is. If it wakes up, you’ll be the first to find out.',
    `${cs()}. Come back. That’s an order, and it’s the last one I’ll give you on the subject.`],
  radio:{start:'Lantern to all flights. This is the one. Make the Republic proud, and make me look good.', done:{0:'Fortress is down! Gate guard next.', 1:'That’s the gate. Watch the sky, Kestrel. He’s coming.', 2:'Hollow is in the sea. Wait. Seismic alarms on the plateau. Get over there, Kestrel. Now.'}},
  out:{
    perfect:{mood:'pleased', say:'Hollow is down, their walking fortress is scrap, the fortress is rubble, and the Varn signed a ceasefire twenty minutes ago. Dinner. Tonight. Wardroom, 2000. My treat, and that is an order.', next:'end:flawless'},
    success:{mood:'pleased', say:'It’s over. We won. Mostly because of you, which I will deny if you ever repeat it.', next:'end:victory'},
    fail:{mood:'angry', say:'The assault failed and the Varn are counterattacking. They’re coming for the Bastion. Get back in your cockpit. Now.', then:'The Varn launch everything they have left at the Bastion.', next:'n6f'}
  }};
N.n6f = {chapter:'Chapter 6 · Last Stand', title:'Last Stand', place:'the Bastion', tier:3, pay:3.6, seed:274119, wing:null,
  tasks:[{kind:'air', n:6, place:'the Bastion', at:{x:-1400, z:-5200}}, {kind:'armor', n:6, place:'Halvorsen Beach'}, {kind:'boss', n:1, place:'the carrier group', at:{x:900, z:-5600}, escorts:2}],
  sides:[{key:'hull'}], mood:'angry',
  brief:() => ['No briefing room. No coffee. They’re coming for the ship.', 'Fighters on the carrier, landing craft on Halvorsen Beach, and Hollow leading it all. If the Bastion goes down, the Republic goes with it.', 'Hold the line.'],
  radio:{start:'Lantern to every pilot who can still fly: defend the Bastion!', done:{0:'Air threat broken! Beach next!', 1:'Beach is held. Here he comes.'}},
  out:{
    perfect:{mood:'pleased', say:'The Bastion is scarred but afloat, and Hollow is finally in the sea. We never took their fortress. We didn’t have to.', next:'end:pyrrhic'},
    success:{mood:'stern', say:'We held. Barely. The Bastion is listing, but she’s ours, and Hollow is gone.', next:'end:pyrrhic'},
    fail:{mood:'angry', say:'We’re withdrawing to the southern islands. You did everything I asked. Get some sleep. We’ll be back.', next:'end:retreat'}
  }};
for (const id in N) N[id].id = id;

G.ENDINGS = {
  flawless:{title:'Halcyon Dawn', grade:'Flawless victory', mood:'pleased', text:s => ['The Varn Hegemony withdraws from the archipelago. The Halcyon Republic awards you the Silver Wing, its highest decoration for valor.',
    s.roster.ridge === 'active' ? 'Ridge gives the toast at the wardroom dinner. Nobody can hear a word over the cheering.' : 'At the wardroom dinner, an empty chair is set for Ridge.',
    'Lt. Cmdr. Arkwright arrives at 2000 exactly, out of uniform, and tells you that you are late.']},
  victory:{title:'The Long Night Ends', grade:'Victory', mood:'pleased', text:s => ['The fortress falls, and with it the Varn campaign. The Republic is free.',
    s.roster.ridge === 'active' ? 'Ridge finally writes his report. It is two lines long. Arkwright frames it.' : 'Ridge’s callsign is retired from the Bastion’s roster.', 'You are promoted to squadron leader. Arkwright pins the bars on herself, a little crooked, and doesn’t fix them.']},
  pyrrhic:{title:'Iron and Salt', grade:'Costly victory', mood:'stern', text:() => ['The Bastion survives, and the Varn offensive breaks against her hull. The war ends in an uneasy armistice.',
    'The fortress on Orrin Atoll still stands, empty. Nobody wants to go back.', 'Arkwright stays up all night writing letters to families. In the morning she asks you to fly the dawn patrol with her.']},
  retreat:{title:'The Southern Islands', grade:'Defeat', mood:'angry', text:() => ['The Bastion limps south with what is left of the fleet. The northern archipelago falls under Varn control.',
    'The war isn’t over. It just isn’t going your way.', 'Arkwright: “We regroup, we rearm, and we go back. You’re flying lead.”']}
};

/* ---------- Building a story mission ---------- */
const sub = t => t.replace(/\{cs\}/g, cs());
G.storyFlags = () => G.save.story.flags;
G.storyMission = id => {
  const node = N[id]; if (!node) return null;
  const f = G.storyFlags(), level = G.save.level || 1, tier = node.tier, sc = 1 + 0.16*(level - 1);
  const tasks = (typeof node.tasks === 'function' ? node.tasks(f) : node.tasks).map(t => Object.assign({}, t));
  const base = tasks.reduce((a, t) => a + G.TASKS[t.kind].reward + 60*t.n, 0) + 600*tier;
  const reward = Math.round(base*node.pay*sc/50)*50;
  const xp = Math.round((tasks.reduce((a, t) => a + G.TASKS[t.kind].xp + 8*t.n, 0) + 80*tier)*1.8*(1 + 0.1*(level - 1)));
  const sides = node.sides.map(s => ({key:s.key, param:s.param || 0, cash:Math.round(reward*0.12/50)*50, xp:Math.round(xp*0.15)}));
  const wing = node.wing || G.activeWing();
  return {id:'story-' + id, type:'ops', story:id, tier, n:tasks.length, tasks, place:node.place, city:'', reward, xp, sides, seed:node.seed,
    title:node.title, tag:node.chapter, wing, brief:node.brief(f).map(sub).join(' '), briefLines:node.brief(f).map(sub),
    goal:`${tasks.length} waypoints, then return to the Bastion`, perfectBonus:Math.round(reward*0.5/50)*50};
};
G.storyGrade = (success, sideResults) => !success ? 'fail' : sideResults.every(x => x) ? 'perfect' : 'success';
G.storyOutcome = (id, grade) => { const o = N[id].out[grade]; return Object.assign({}, o, {say:sub(o.say), then:o.then ? sub(o.then) : ''}); };
G.storyCommit = (id, grade) => {
  const st = G.save.story, o = N[id].out[grade];
  st.log.push({node:id, grade, title:N[id].title});
  Object.assign(st.flags, o.flags || {});
  Object.assign(st.roster, o.roster || {});
  if (!G.wingAvail(st.wing)) st.wing = G.activeWing();
  if (o.next.startsWith('end:')) { st.ending = o.next.slice(4); st.node = null; } else st.node = o.next;
  G.persist();
  return st.ending;
};
G.storyReset = () => { G.save.story = G.newStory(); G.persist(); };
G.storyStep = () => { const st = G.save.story; return st.log.length + 1; };

/* ---------- In-mission scripting ---------- */
G.storyRadio = (game, key, i) => {
  const node = N[game.m.story]; if (!node || !node.radio) return;
  const line = key === 'start' ? node.radio.start : node.radio[key] && node.radio[key][i];
  if (line) game.later(key === 'start' ? 3.5 : 2.2, () => G.hud.radio(G.OFFICER.short, sub(line)));
  const ev = node.script && node.script[key] && node.script[key][i];
  if (ev && G.STORY_EVENTS[ev]) G.STORY_EVENTS[ev](game);
};
G.spawnHollow = (game, o = {}) => {
  const P = game.player.pos, a = Math.random()*6.28, cx = o.at ? o.at.x : P.x, cz = o.at ? o.at.z : P.z;
  const x = cx + Math.sin(a)*1500, z = cz + Math.cos(a)*1500, alt = Math.max(P.y, 200) + 250;
  const e = G.spawn(game, 'fighter', x, z, {alt, tag:o.task !== undefined ? 'obj' : 'ace', name:'Hollow'});
  e.ace = true; e.boss = true; e.hp *= o.hpMul || 6; e.maxHp = e.hp; e.dmgMul *= 1.3; e.cash = 0;
  if (o.task !== undefined) e.task = o.task;
  if (o.retreat) e.retreatAt = o.retreat;
  e.dir = new V3(P.x - x, 0, P.z - z).normalize();
  for (let k = 0; k < (o.escorts || 0); k++) {
    const b = Math.random()*6.28, s = G.spawn(game, 'fighter', x + Math.sin(b)*160, z + Math.cos(b)*160, {alt:alt - 40 + k*30, tag:'ace'});
    s.name = 'Hollow’s wingman'; s.ace = true; s.hp *= 1.6; s.maxHp = s.hp; s.dir = e.dir.clone();
  }
  game.hollow = e;
  return e;
};
/* The Sovereign: the fortress guardian. Rises on solid ground near the waypoint, facing the player, with a small escort. */
G.spawnSovereign = (game, o = {}) => {
  const W = game.world, P = game.player.pos, C = o.at || {x:P.x, z:P.z};
  let best = null;
  for (let i = 0; i < 60 && !best; i++) { const a = Math.random()*6.283, r = 150 + i*12, x = C.x + Math.sin(a)*r, z = C.z + Math.cos(a)*r;
    if (W.height(x, z) > 4 && W.slope(x, z) < 0.35) best = {x, z}; }
  if (!best) best = {x:C.x, z:C.z};
  const e = G.spawn(game, 'colossus', best.x, best.z, {tag:o.task !== undefined ? 'obj' : null, yaw:Math.atan2(P.x - best.x, P.z - best.z)});
  e.bossBar = 'THE SOVEREIGN'; e.cash = 0; if (o.task !== undefined) e.task = o.task;
  game.fx.explosion(new V3(best.x, W.height(best.x, best.z) + 6, best.z), 2.4); for (let i = 0; i < 12; i++) { const a = i/12*6.283; game.fx.dust(new V3(best.x + Math.sin(a)*35, W.height(best.x, best.z), best.z + Math.cos(a)*35)); }
  G.audio.boom(e.pos, 2); game.player.shake += 1.5;
  for (let k = 0; k < 3; k++) { const a = Math.random()*6.283, x = best.x + Math.sin(a)*160, z = best.z + Math.cos(a)*160; if (W.height(x, z) > 1) G.spawn(game, 'tank', x, z, {}); }
  game.sovereign = e;
  return e;
};
G.hollowRetreat = (game, e, driven) => {
  if (!e.alive) return;
  e.alive = false; e.retreated = true; game.scene.remove(e.mesh);
  if (driven) { game.stats.hollowDriven = true; G.hud.flash('HOLLOW DISENGAGING'); G.hud.radio('Hollow', 'You scratched my paint, Kestrel. Next time I take your wings.'); }
  else G.hud.radio('Hollow', 'Fuel’s low, Kestrel. Enjoy the quiet. It won’t last.');
};
G.STORY_EVENTS = {
  hollowAmbush(game){
    const f = G.storyFlags();
    if (f.intel) G.hud.radio(G.OFFICER.short, 'Kestrel, Hollow’s route lights up on the logs. Red tails, inbound, thirty seconds!');
    game.hollowPending = true;
    game.later(f.intel ? 6 : 1.5, () => {
      game.hollowPending = false;
      const h = G.spawnHollow(game, {escorts:f.intel ? 1 : f.varnStrong ? 3 : 2, hpMul:5, retreat:0.5});
      G.hud.flash('RED TAILS · HOLLOW INBOUND');
      G.hud.radio('Hollow', `So this is Kestrel squadron. I’ve read about you, ${cs()}. You’re smaller in person.`);
      game.ridgeScript = true;
      game.later(3, () => { const W = game.wing; if (W.alive) G.hud.radio(W.name, 'He’s on me! I can’t shake him!'); });
      game.later(6.5, () => {
        const W = game.wing; if (!W.alive) { game.ridgeScript = false; return; }
        W.downLine = 'I’m hit! Ejecting! Kestrel, get him for me!'; W.hit(1e9);
        game.later(2.5, () => { game.ridgeScript = false; G.hud.radio(G.OFFICER.short, 'Ridge is down. Chute sighted, drifting over Varn lines. Deal with Hollow, then come home.'); });
      });
      game.later(80, () => { if (h.alive) G.hollowRetreat(game, h, false); });
    });
  }
};
})();
