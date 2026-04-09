# threefps

`threefps` is now a browser-based wave survival FPS built on top of the official Three.js `games_fps` example.

The project started as a movement/collision prototype. It has since turned into a playable zombie-survival game loop with multiple weapons, enemy waves, pickups, death/restart flow, and early mobile support.

## Current game

Current core loop:
- survive escalating rounds
- fight melee and ranged enemies
- manage ammo, reloads, and movement
- collect ammo and health drops
- die, see run stats, restart, and go again

The current in-game title/HUD theme is `Containment`.

## What exists right now

### Movement and world
- first-person movement from the official Three.js FPS example
- WASD + jump + gravity
- capsule collision
- Octree world collision
- pointer lock on desktop
- touch controls on mobile
- local dev server for browser/LAN testing

### Weapons
- `AK`
- `SMG`
- `Handgun`
- `Knife`

Current weapon systems:
- camera-center hitscan
- ammo and reload state
- weapon switching
- recoil
- animated viewmodels
- hit markers and kill markers
- muzzle flash / impact feedback

### Enemies
- melee `Blue Demon`
- ranged `Astronaut`

Current enemy systems:
- wave spawning
- melee damage
- ranged attack windup and tracer shot
- damage / hit react / death
- death drops
- basic navmesh-assisted pursuit

### Pickups
- rifle ammo
- light ammo
- health hearts

Current pickup behavior:
- enemies drop ammo by type
- enemies can sometimes drop hearts
- hearts heal `20` HP
- pickups hover/spin and are collected on contact

### Run flow
- wave counter
- kills
- alive enemies
- player health
- death overlay
- run summary
- restart / play again flow

Current death summary includes:
- highest wave
- kills
- accuracy
- best weapon

### Mobile support
- left movement stick
- right look pad
- fire button
- jump button
- reload button
- direct weapon buttons

This is an early pass, not fully tuned.

## Technical direction

The architecture still follows the original rule:
- use the official Three.js FPS example as the movement/collision foundation
- borrow selectively for viewmodel and weapon ideas
- keep our own gameplay structure

Reference sources:
- Primary base: official Three.js `games_fps`
  - https://threejs.org/examples/games_fps.html
  - https://github.com/mrdoob/three.js/
- Secondary reference for weapon/viewmodel ideas:
  - https://github.com/Footprintarts/ThreeJS_FPS_2.0
  - Rule: steal the gun, not the house

## Repo structure

Main entry points:
- `index.html`
- `src/`
- `scripts/dev-server.js`

Important gameplay files:
- `src/core/game.js`
- `src/core/config.js`
- `src/player/playerController.js`
- `src/player/input.js`
- `src/player/viewModel.js`
- `src/weapons/weaponManager.js`
- `src/weapons/weaponData.js`
- `src/actors/zombieManager.js`
- `src/actors/ammoPickupManager.js`
- `src/ui/hud.js`

Project references preserved in repo:
- upstream Three.js README: `README.upstream-threejs.md`
- Three.js source snapshot: `vendor/three-src/`

## How to run

Install and run:

```bash
npm run dev
```

Default local URL:

```text
http://127.0.0.1:8080
```

To expose the dev server on LAN:

```bash
HOST=0.0.0.0 npm run dev
```

Then open:

```text
http://<your-lan-ip>:8080
```

## Current priorities

The game is playable, but some systems are still clearly prototype-grade.

Highest priority issues:
- enemy navigation / stair usage / navmesh quality
- ranged enemy feel and fairness tuning
- between-wave progression and upgrade structure
- more distinct wave identities
- mobile feel and performance tuning

## What is still weak

The biggest current weakness is AI navigation.

What is true right now:
- enemies can chase and fight
- navmesh-assisted routing exists
- path smoothing and recovery logic exist

What is not solved well enough yet:
- reliable stair usage
- robust upper/lower level pursuit
- fully trustworthy navmesh quality

If enemy routing is broken, the survival loop suffers immediately, so AI/navmesh remains a top task.

## Near-term roadmap

Likely next steps:
1. improve navmesh quality and enemy route reliability
2. add between-wave upgrades / progression choices
3. improve ranged enemy readability and weapon/audio polish
4. expand encounter variety without exploding scope

## Non-goals

Still deliberately not the focus:
- battle royale scale
- multiplayer
- backend/meta infrastructure
- inventory-heavy complexity
- giant feature creep before the round loop is strong

## Short version

This repo is no longer just “a Three.js FPS prototype.”

It is now a browser wave-survival shooter with:
- 4 weapons
- melee and ranged enemies
- ammo and healing drops
- death/restart loop
- early mobile controls

The main unfinished job is making enemy pursuit and navigation truly reliable.
