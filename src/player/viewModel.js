import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GAME_CONFIG } from "../core/config.js";

export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.loader = new GLTFLoader();
    this.holder = new THREE.Object3D();
    this.holder.position.fromArray(GAME_CONFIG.viewModel.holderPosition);
    this.camera.add(this.holder);

    this.mixer = null;
    this.actions = new Map();
    this.model = null;
    this.recoilOffset = 0;
    this.muzzleFlashTimer = 0;
    this.actionTimer = 0;
    this.currentAction = null;
    this.muzzleFlash = new THREE.PointLight(0xffe7b6, 0, 2.4, 2);
    this.muzzleFlash.position.set(0.15, -0.03, -GAME_CONFIG.viewModel.muzzleFlashDistance);
    this.holder.add(this.muzzleFlash);
  }

  async load() {
    const gltf = await this.loader.loadAsync(GAME_CONFIG.viewModel.modelPath);

    this.model = gltf.scene;
    this.model.scale.fromArray(GAME_CONFIG.viewModel.scale);
    this.model.rotation.set(...GAME_CONFIG.viewModel.rotation);
    this.holder.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    gltf.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      action.clampWhenFinished = true;
      this.actions.set(clip.name, action);
    });

    this.playIdle();
  }

  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    if (this.actionTimer > 0) {
      this.actionTimer = Math.max(0, this.actionTimer - deltaTime);

      if (this.actionTimer === 0 && this.currentAction !== "Armature|Idle") {
        this.playIdle();
      }
    }

    this.recoilOffset = THREE.MathUtils.damp(
      this.recoilOffset,
      0,
      GAME_CONFIG.viewModel.recoilRecovery,
      deltaTime,
    );
    this.holder.rotation.x = this.recoilOffset;

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - deltaTime);
      this.muzzleFlash.intensity = this.muzzleFlashTimer > 0 ? 3.4 : 0;
    }
  }

  playIdle() {
    this.play("Armature|Idle");
  }

  playShoot() {
    this.play("Armature|Shoot", null, false);
    this.recoilOffset += GAME_CONFIG.viewModel.recoilStrength;
    this.muzzleFlashTimer = 0.05;
  }

  playReload() {
    return this.play("Armature|Reload", null, false);
  }

  getClipDuration(name) {
    const action = this.actions.get(name);
    return action ? action.getClip().duration : 0;
  }

  play(name, loopDuration = null, loop = null) {
    const action = this.actions.get(name);
    if (!action) {
      return 0;
    }

    for (const currentAction of this.actions.values()) {
      currentAction.stop();
    }

    action.reset();
    this.currentAction = name;

    if (loop ?? loopDuration === null) {
      action.setLoop(THREE.LoopRepeat);
      action.timeScale = 1;
      this.actionTimer = 0;
    } else {
      action.setLoop(THREE.LoopOnce);
      const clipDuration = action.getClip().duration || loopDuration;
      action.timeScale = loopDuration ? clipDuration / loopDuration : 1;
      this.actionTimer = loopDuration || clipDuration;
    }

    action.play();
    return this.actionTimer || action.getClip().duration;
  }
}
