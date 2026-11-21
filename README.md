# Kestrel Squadron

A 3D browser game about a transforming fighter: fly the AVF-1 Kestrel as a jet, a hover gunship (gerwalk) and a mech against the Varn Hegemony's invasion of the Halcyon archipelago. A story campaign in three volumes (the Hollow Crown, the flying carrier Ascendant, and the transforming bomber Harbinger), free sorties, upgrades and frames, two-player co-op, and controller support.

**Play:** https://mbyrtus-maker.github.io/KestrelSquadron/ (once GitHub Pages is turned on for this repository: Settings → Pages → Deploy from branch `main`, folder `/`).

## Playing with a friend (co-op)

Two pilots fly together: the host flies lead and picks the mission; the friend takes the wingman's seat (the AI wingman steps aside).

1. **Host:** open the game, go to the hangar and press **Co-op → Host a session**. You get a code like `amber-kestrel-42` and an **invite link**. Copy the link and send it to your friend.
2. **Friend:** open the invite link (or open the game, press **Co-op** and paste the code), then press **Join**. Pick your own frame and loadout while you wait.
3. **Host:** launch any sortie or story mission as normal. Once your carrier launch is done, your wingman launches with you and forms up on your wing.

- The host's browser runs the mission: every enemy, objective and story event. The wingman flies their own Kestrel and every hit they land is applied by the host.
- Both pilots earn the mission reward; each pilot keeps the bounties for their own kills. Story progress belongs to the host.
- If the wingman drops out, the AI takes their seat again. If the host leaves, the wingman's sortie ends.
- Wingman orders don't apply to a human wingman (talk to each other instead).
- Opening the pause menu doesn't stop the sortie for the other pilot.

### If you can't connect

Pilots connect browser to browser (WebRTC). A free public matchmaking server ([PeerJS](https://peerjs.com/)) only introduces the two browsers, with public MQTT brokers as a backup introducer; no game data goes through them. Most home networks work. Some strict networks (corporate Wi-Fi, some mobile hotspots) block direct connections; PeerJS's public relay is tried as a fallback. The host should keep the game in a visible tab while the friend joins.

For local testing, `?coopLocal=1` connects two tabs of the same browser without any network.

## Controls

**1 / 2 / 3** jet, hover, mech · mouse steers or aims · **W/S** throttle or move · left click guns · right click missiles · **E** head lasers (hover) · **Q** draw the blade (mech) · **F** flares · **V** camera · **R** return to base · **Esc** pause. The full flight manual is in the hangar.

**Controller** (any standard gamepad): left stick flies (jet) or moves (hover, mech) · right stick is throttle and rudder (jet) or look (hover, mech) · RT guns · LT missiles · RB boost · LB flares · A rise · B descend · X lasers · Y next mode · stick clicks: blade, target · D-pad: camera, missile type, wingman orders · Back RTB · Start pause. In menus the D-pad moves, A presses and B closes.

## How it's built

Plain JavaScript and three.js r128 (from cdnjs), no build step: `index.html` loads the scripts in `js/` in order. High graphics loads photo-scanned textures and a sky panorama from `gfx/` (Poly Haven, CC0). The game is developed in a private workspace and published here with `tools/build_site.sh`.
