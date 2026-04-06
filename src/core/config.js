export const GAME_CONFIG = {
  camera: {
    far: 1000,
    fov: 70,
    near: 0.1,
  },
  lighting: {
    directional: {
      color: 0xffffff,
      intensity: 2.5,
      position: [-5, 25, -1],
    },
    hemisphere: {
      groundColor: 0x00668d,
      intensity: 1.5,
      position: [2, 1, 1],
      skyColor: 0x8dc1de,
    },
  },
  player: {
    airAcceleration: 8,
    airDampingFactor: 0.1,
    floorDamping: 4,
    groundAcceleration: 25,
    jumpVelocity: 15,
    lookSensitivity: 0.002,
    oobY: -25,
    spawn: {
      end: [0, 1, 0],
      radius: 0.35,
      start: [0, 0.35, 0],
    },
    recoil: {
      pitchRecovery: 16,
      pitchStep: 0.018,
      yawJitter: 0.006,
      yawRecovery: 14,
    },
    presentation: {
      moveSpeedForFullBob: 8,
    },
  },
  targets: {
    items: [
      { position: [0, 1.1, -8], size: [0.75, 1.5, 0.45] },
      { position: [-2.5, 1.1, -12], size: [0.75, 1.5, 0.45] },
      { position: [2.75, 1.1, -15], size: [0.75, 1.5, 0.45] },
    ],
    maxHealth: 100,
    respawnDelay: 1.2,
    flinch: {
      scaleKick: 0.12,
      tiltKick: 0.12,
      recovery: 10,
    },
  },
  simulation: {
    gravity: 30,
    maxDeltaTime: 0.05,
    stepsPerFrame: 5,
  },
  world: {
    background: 0x88ccee,
    fogFar: 50,
    fogNear: 0,
    modelPath: "./examples/models/gltf/collision-world.glb",
  },
  weapon: {
    range: 200,
    damage: 34,
    fireInterval: 0.12,
    magSize: 10,
    reserveAmmo: 50,
    sounds: {
      reload: "./assets/sounds/reload.mp3",
      shoot: "./assets/sounds/laser.mp3",
    },
  },
  viewModel: {
    modelPath: "./assets/models/FpsRig.glb",
    holderPosition: [0.18, -0.22, -0.32],
    muzzleFlashDistance: 0.6,
    recoilRecovery: 14,
    recoilStrength: 0.035,
    rotation: [0, Math.PI / 2, 0],
    scale: [0.08, 0.08, 0.08],
    idleSway: {
      positionX: 0.012,
      positionY: 0.01,
      roll: 0.012,
      speed: 1.8,
      yaw: 0.01,
    },
    walkBob: {
      pitch: 0.018,
      positionX: 0.018,
      positionY: 0.016,
      roll: 0.028,
      speed: 9.5,
    },
  },
  ui: {
    crosshair: {
      baseScale: 1,
      fireScale: 0.4,
      moveScale: 0.5,
      reloadScale: 0.9,
      smoothing: 14,
    },
  },
  fx: {
    impactLifetime: 0.16,
    impactScale: 0.085,
    killImpactScale: 0.16,
    shardsPerImpact: 5,
  },
};
