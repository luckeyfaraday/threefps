# threefps

## Goal
Build a clean browser-based FPS starting from the official Three.js `games_fps` example, then evolve it into our own game instead of inheriting someone else’s spaghetti.

This project is **not** about chasing a flashy template.
It is about taking the strongest base loop available and layering our own systems on top in a controlled way.

## Core Direction
Use the official Three.js FPS example as the foundation for:
- first-person movement
- jumping
- gravity
- pointer lock controls
- capsule collision
- world collision via Octree
- stable first-person game loop

Then add the actual game systems ourselves:
- hitscan shooting
- weapon/viewmodel rig
- reload + recoil
- enemy targets
- HUD
- map pipeline
- audio
- effects

## Why this approach
Because the official example gives us the hard boring part already working:
- movement feel
- collision
- camera loop
- spatial logic

That matters more than buying or copying a “complete template” full of random glue code.

## What we are NOT doing
- Not building from scratch when a strong base already exists
- Not blindly adopting messy community repos as the full architecture
- Not overbuilding before the core loop feels good
- Not starting with advanced AI, multiplayer, inventory systems, or other distractions

## Reference sources

### Primary base
- Official Three.js example: `games_fps`
- Link: https://threejs.org/examples/games_fps.html
- Source context: https://github.com/mrdoob/three.js/
- Purpose: movement, collision, player controller foundation

### Secondary references
- `Footprintarts/ThreeJS_FPS_2.0`
- Link: https://github.com/Footprintarts/ThreeJS_FPS_2.0
  - Useful for ideas around:
    - camera-attached weapon rig
    - GLTF weapon model loading
    - simple animation mixer setup
    - audio wiring
    - shoot / reload / idle weapon behavior
  - We are allowed to use the gun mechanic ideas from this repo
  - We are **not** using the repo itself as the architectural base
  - Reason: the weapon/viewmodel layer is useful, but the overall project structure is messier than the official Three.js example
  - Rule: **steal the gun, not the house**

### Optional polish references
- commercial / Gumroad browser FPS templates
- useful only for ideas, assets, and presentation
- not the source of truth for architecture

## Technical philosophy
We want:
- clean separation of systems
- fast iteration
- understandable code
- browser-native performance
- a prototype that can actually grow

We do **not** want:
- hidden complexity
- tangled systems
- fragile “demo code” pretending to be a framework
- premature abstraction

## Proposed structure

```text
src/
  core/
    game.js
    loop.js
    config.js

  world/
    scene.js
    lighting.js
    mapLoader.js
    collisionWorld.js
    spawnPoints.js

  player/
    playerController.js
    playerPhysics.js
    input.js
    cameraRig.js
    viewModel.js
    recoil.js

  weapons/
    weaponManager.js
    weaponData.js
    hitscan.js
    projectile.js
    muzzleFlash.js
    bulletImpact.js
    reloadSystem.js

  animation/
    animationController.js
    fpsRigAnimations.js

  actors/
    enemy.js
    enemyManager.js
    dummyTarget.js
    health.js

  ui/
    hud.js
    crosshair.js
    ammoDisplay.js
    hitMarker.js

  audio/
    audioManager.js
    weaponAudio.js
    ambience.js

  fx/
    particles.js
    decals.js
    screenShake.js

  utils/
    math.js
    timers.js
    debug.js

  assets/
    loader.js
```

## Build order

### Phase 1 — Foundation
Start from `games_fps` and preserve:
- player movement
- jump/gravity
- collision
- camera control
- world stepping

### Phase 2 — First real weapon
Add:
- hitscan raycast from camera center
- muzzle flash
- fire cooldown
- ammo count
- reload
- hit feedback

Do not start with ballistic complexity. Hitscan first.

### Phase 3 — Viewmodel
Add:
- first-person arms/gun GLB
- camera-attached rig
- idle sway
- recoil
- simple animation states

### Phase 4 — Targets
Add:
- dummy targets
- HP
- death/reset
- hit reaction

No serious AI yet.

### Phase 5 — HUD and feel
Add:
- crosshair
- ammo UI
- reload feedback
- hit marker
- weapon audio
- simple particle effects

### Phase 6 — Content pipeline
Add:
- GLB map import
- collision generation
- spawn points
- simple level iteration workflow

## Non-goals for early versions
These are deliberately postponed:
- advanced enemy AI
- multiplayer
- inventory systems
- quest systems
- progression/meta systems
- fancy backend work

If the FPS loop is not fun, everything layered on top is lipstick on a corpse.

## Success condition
A playable browser FPS prototype that:
- feels good to move in
- shoots reliably
- has clean code boundaries
- can load a custom map
- can be extended without becoming a mess

## Short version
We are building **our own browser FPS on top of the official Three.js FPS example**.

Use the official example for the body.
Borrow selectively from other repos for the gun arms and polish.
Own the architecture ourselves.

## Current repo state

- Root app entry: `index.html`
- Game source: `src/`
- Local dev server: `npm run dev`
- Official upstream README preserved in `README.upstream-threejs.md`
- Original Three.js library source preserved in `vendor/three-src/`

## Phase 1 status

The repo now boots a stripped-down browser FPS foundation from the official `games_fps` example:
- pointer lock mouse look
- WASD movement
- jump + gravity
- capsule collision
- Octree world collision
- out-of-bounds respawn

This is intentionally the movement foundation only.
Weapon systems, HUD gameplay, and targets come next.

## Phase 2 status

The repo now includes the first weapon slice:
- camera-center hitscan
- ammo + reload state
- simple target dummies with damage and respawn
- fire / reload audio
- camera-attached FPS rig viewmodel
- basic shoot / reload / idle animation wiring

## Run it

```bash
npm run dev
```

Then open `http://127.0.0.1:8080`.
