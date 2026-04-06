import { GAME_CONFIG } from "./config.js";
import { GameLoop } from "./loop.js";
import { CameraRig } from "../player/cameraRig.js";
import { InputController } from "../player/input.js";
import { PlayerController } from "../player/playerController.js";
import { PlayerState } from "../player/playerState.js";
import { ViewModel } from "../player/viewModel.js";
import { ZombieManager } from "../actors/zombieManager.js";
import { WeaponAudio } from "../audio/weaponAudio.js";
import { FootstepAudio } from "../audio/footstepAudio.js";
import { ImpactEffects } from "../fx/impactEffects.js";
import { WeaponManager } from "../weapons/weaponManager.js";
import { WEAPON_ORDER } from "../weapons/weaponData.js";
import { createSceneKit } from "../world/scene.js";
import { CollisionWorld } from "../world/collisionWorld.js";

export class Game {
  constructor({ hud, mount }) {
    this.hud = hud;
    this.mount = mount;
    this.sceneKit = createSceneKit(mount);
    this.world = new CollisionWorld(this.sceneKit.scene);
    this.input = new InputController(this.sceneKit.renderer.domElement);
    this.cameraRig = new CameraRig(
      this.sceneKit.camera,
      this.input,
      GAME_CONFIG.player.lookSensitivity,
    );
    this.playerState = new PlayerState();
    this.viewModel = new ViewModel(this.sceneKit.camera);
    this.zombies = new ZombieManager(this.sceneKit.scene, this.world);
    this.weaponAudio = new WeaponAudio();
    this.footstepAudio = new FootstepAudio();
    this.impactEffects = new ImpactEffects(this.sceneKit.scene);
    this.loop = new GameLoop(this.onFrame);

    this.player = null;
    this.weapon = null;
    this.ready = false;
    this.gameOver = false;
    this.runStarted = false;
  }

  async init() {
    this.input.attach();
    this.input.setPointerLockHandler((locked) => {
      this.hud.setLocked(locked);

      if (locked && !this.gameOver && !this.runStarted) {
        this.beginRun();
        return;
      }

      if (this.gameOver) {
        this.hud.setGameOver();
        return;
      }

      if (!locked && this.runStarted) {
        this.hud.setStatus("Simulation paused. Click to re-enter the run.");
        return;
      }

      if (!locked && !this.runStarted) {
        this.hud.setStatus("Start the run to begin the first wave.");
      }
    });

    this.hud.bindStart(this.handleStart);

    this.sceneKit.renderer.domElement.addEventListener("click", () => {
      if (this.ready && !this.input.isLocked()) {
        this.input.requestPointerLock();
      }
    });

    window.addEventListener("resize", this.handleResize);
    this.handleResize();

    this.hud.setStatus("Loading collision world...");
    await Promise.all([
      this.world.load(GAME_CONFIG.world.modelPath),
      this.viewModel.load(WEAPON_ORDER),
      this.zombies.load(),
    ]);

    this.player = new PlayerController({
      camera: this.sceneKit.camera,
      cameraRig: this.cameraRig,
      collisionWorld: this.world,
      input: this.input,
    });
    this.weapon = new WeaponManager({
      audio: this.weaponAudio,
      camera: this.sceneKit.camera,
      cameraRig: this.cameraRig,
      hud: this.hud,
      impactEffects: this.impactEffects,
      input: this.input,
      targets: this.zombies,
      viewModel: this.viewModel,
      world: this.world,
    });

    this.ready = true;
    this.hud.setReady();
    this.restartRun();
    this.loop.start(this.sceneKit.renderer);
  }

  handleStart = () => {
    if (!this.ready) {
      return;
    }

    if (this.gameOver) {
      this.restartRun();
    }

    this.input.requestPointerLock();
  };

  restartRun() {
    this.gameOver = false;
    this.runStarted = false;
    this.playerState.reset();
    this.player.spawn();
    this.weapon.resetRun();
    this.zombies.resetRun();
    this.hud.button.textContent = "Start Run";
    this.hud.button.hidden = !this.input.isLocked();
    this.hud.setStatus("Start the run to begin the first wave.");
    this.hud.setSurvival({
      alive: 0,
      health: this.playerState.health,
      kills: 0,
      status: "Press Start",
      wave: 0,
    });
  }

  beginRun() {
    this.runStarted = true;
    this.hud.setStatus("Wave 1 inbound. Keep moving.");
  }

  handleResize = () => {
    const { camera, renderer } = this.sceneKit;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
  };

  onFrame = (deltaTime) => {
    const clampedDeltaTime = Math.min(
      GAME_CONFIG.simulation.maxDeltaTime,
      deltaTime,
    );
    const substepDeltaTime =
      clampedDeltaTime / GAME_CONFIG.simulation.stepsPerFrame;

    const simulationActive =
      this.runStarted && this.input.isLocked() && !this.gameOver;

    if (simulationActive) {
      for (let step = 0; step < GAME_CONFIG.simulation.stepsPerFrame; step += 1) {
        this.player.step(substepDeltaTime);
      }
    }

    const movementState = this.player.getMovementState();
    if (simulationActive) {
      this.weapon.update(clampedDeltaTime);
    }
    this.footstepAudio.update(clampedDeltaTime, movementState);
    const survivalState =
      this.gameOver || !this.runStarted || !this.input.isLocked()
        ? this.zombies.getStatus()
        : this.zombies.update(clampedDeltaTime, this.sceneKit.camera.position);

    if (simulationActive && survivalState.damageToPlayer > 0) {
      this.hud.pulseDamage(
        Math.min(1, survivalState.damageToPlayer / this.playerState.maxHealth),
      );
      this.cameraRig.applyDamageFeedback(
        Math.min(1.2, survivalState.damageToPlayer / 12),
      );
      const died = this.playerState.applyDamage(survivalState.damageToPlayer);
      if (died) {
        this.gameOver = true;
        this.cameraRig.triggerDeathEffect();
        document.exitPointerLock?.();
        this.hud.setGameOverSummary({
          kills: survivalState.kills,
          wave: survivalState.wave,
        });
        this.hud.setGameOver();
      }
    }

    this.hud.setSurvival({
      alive: survivalState.alive,
      health: this.playerState.health,
      kills: survivalState.kills,
      status: this.gameOver
        ? "Game Over"
        : !this.runStarted
          ? "Press Start"
          : !this.input.isLocked()
            ? "Paused"
            : survivalState.status,
      wave: survivalState.wave,
    });

    this.viewModel.update(clampedDeltaTime, movementState);
    this.hud.updateCrosshair(
      {
        movement: movementState.normalizedSpeed,
        ...(this.gameOver
          ? { firing: 0, fireSpread: 0, moveSpread: 0.5, reloadSpread: 0, reloading: false, smoothing: 14 }
          : this.weapon.getPresentationState()),
      },
      clampedDeltaTime,
    );
    this.impactEffects.update(clampedDeltaTime);
    this.hud.update(clampedDeltaTime);

    this.sceneKit.renderer.render(this.sceneKit.scene, this.sceneKit.camera);
  };
}
