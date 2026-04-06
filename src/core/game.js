import { GAME_CONFIG } from "./config.js";
import { GameLoop } from "./loop.js";
import { CameraRig } from "../player/cameraRig.js";
import { InputController } from "../player/input.js";
import { PlayerController } from "../player/playerController.js";
import { ViewModel } from "../player/viewModel.js";
import { TargetManager } from "../actors/targetManager.js";
import { WeaponAudio } from "../audio/weaponAudio.js";
import { ImpactEffects } from "../fx/impactEffects.js";
import { WeaponManager } from "../weapons/weaponManager.js";
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
    this.viewModel = new ViewModel(this.sceneKit.camera);
    this.targets = new TargetManager(this.sceneKit.scene);
    this.weaponAudio = new WeaponAudio();
    this.impactEffects = new ImpactEffects(this.sceneKit.scene);
    this.loop = new GameLoop(this.onFrame);

    this.player = null;
    this.weapon = null;
    this.ready = false;
  }

  async init() {
    this.input.attach();
    this.input.setPointerLockHandler((locked) => {
      this.hud.setLocked(locked);
    });

    this.hud.bindStart(() => {
      if (this.ready) {
        this.input.requestPointerLock();
      }
    });

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
      this.viewModel.load(),
    ]);

    this.player = new PlayerController({
      camera: this.sceneKit.camera,
      cameraRig: this.cameraRig,
      collisionWorld: this.world,
      input: this.input,
    });
    this.targets.spawnDefaults();
    this.weapon = new WeaponManager({
      audio: this.weaponAudio,
      camera: this.sceneKit.camera,
      cameraRig: this.cameraRig,
      hud: this.hud,
      impactEffects: this.impactEffects,
      input: this.input,
      targets: this.targets,
      viewModel: this.viewModel,
      world: this.world,
    });

    this.ready = true;
    this.hud.setReady();
    this.loop.start(this.sceneKit.renderer);
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

    for (let step = 0; step < GAME_CONFIG.simulation.stepsPerFrame; step += 1) {
      this.player.step(substepDeltaTime);
    }

    const movementState = this.player.getMovementState();
    this.weapon.update(clampedDeltaTime);
    this.targets.update(clampedDeltaTime);
    this.viewModel.update(clampedDeltaTime, movementState);
    this.hud.updateCrosshair(
      {
        movement: movementState.normalizedSpeed,
        ...this.weapon.getPresentationState(),
      },
      clampedDeltaTime,
    );
    this.impactEffects.update(clampedDeltaTime);

    this.sceneKit.renderer.render(this.sceneKit.scene, this.sceneKit.camera);
  };
}
