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
    this.elapsedTime = 0;
    this.walkCycle = 0;
    this.profile = {
      holderPosition: [...GAME_CONFIG.viewModel.holderPosition],
      recoilStrength: GAME_CONFIG.viewModel.recoilStrength,
      rotation: [...GAME_CONFIG.viewModel.rotation],
      scale: [...GAME_CONFIG.viewModel.scale],
      shootAnimationDuration: 0.22,
    };
    this.muzzleFlash = new THREE.PointLight(0xffe7b6, 0, 2.4, 2);
    this.muzzleFlash.position.set(0.15, -0.03, -GAME_CONFIG.viewModel.muzzleFlashDistance);
    this.holder.add(this.muzzleFlash);
  }

  async load() {
    const gltf = await this.loader.loadAsync(GAME_CONFIG.viewModel.modelPath);

    this.model = gltf.scene;
    this.holder.add(this.model);
    this.applyProfile();

    this.mixer = new THREE.AnimationMixer(this.model);
    gltf.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      action.clampWhenFinished = true;
      this.actions.set(clip.name, action);
    });

    this.playIdle();
  }

  setWeaponProfile(profile = {}) {
    this.profile = {
      ...this.profile,
      ...profile,
      holderPosition: profile.holderPosition ?? this.profile.holderPosition,
      rotation: profile.rotation ?? this.profile.rotation,
      scale: profile.scale ?? this.profile.scale,
    };
    this.applyProfile();
  }

  applyProfile() {
    this.holder.position.fromArray(this.profile.holderPosition);

    if (!this.model) {
      return;
    }

    this.model.scale.fromArray(this.profile.scale);
    this.model.rotation.set(...this.profile.rotation);
  }

  update(deltaTime, movementState = { normalizedSpeed: 0, onFloor: false }) {
    this.elapsedTime += deltaTime;
    this.walkCycle +=
      deltaTime *
      GAME_CONFIG.viewModel.walkBob.speed *
      movementState.normalizedSpeed;

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

    const idleSway = GAME_CONFIG.viewModel.idleSway;
    const walkBob = GAME_CONFIG.viewModel.walkBob;
    const moveAmount =
      movementState.onFloor === true ? movementState.normalizedSpeed : 0;

    const swayX = Math.sin(this.elapsedTime * idleSway.speed) * idleSway.positionX;
    const swayY =
      Math.cos(this.elapsedTime * idleSway.speed * 1.37) * idleSway.positionY;
    const swayRoll =
      Math.sin(this.elapsedTime * idleSway.speed * 0.7) * idleSway.roll;
    const swayYaw =
      Math.cos(this.elapsedTime * idleSway.speed * 0.58) * idleSway.yaw;

    const bobX = Math.sin(this.walkCycle) * walkBob.positionX * moveAmount;
    const bobY =
      Math.abs(Math.cos(this.walkCycle * 0.5)) * walkBob.positionY * moveAmount;
    const bobRoll = Math.sin(this.walkCycle) * walkBob.roll * moveAmount;
    const bobPitch = Math.abs(Math.cos(this.walkCycle * 0.5)) * walkBob.pitch * moveAmount;

    this.holder.position.set(
      this.profile.holderPosition[0] + swayX + bobX,
      this.profile.holderPosition[1] + swayY - bobY,
      this.profile.holderPosition[2],
    );
    this.holder.rotation.set(
      this.recoilOffset + bobPitch,
      swayYaw,
      swayRoll + bobRoll,
    );

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - deltaTime);
      this.muzzleFlash.intensity = this.muzzleFlashTimer > 0 ? 3.4 : 0;
    }
  }

  playIdle() {
    this.play("Armature|Idle");
  }

  playShoot(duration = this.profile.shootAnimationDuration) {
    this.play("Armature|Shoot", null, false);
    if (duration) {
      this.actionTimer = duration;
    }
    this.recoilOffset += this.profile.recoilStrength;
    this.muzzleFlashTimer = 0.05;
  }

  playReload(duration) {
    const resolvedDuration = duration || this.getClipDuration("Armature|Reload");
    const clipDuration = this.play("Armature|Reload", null, false);
    this.actionTimer = resolvedDuration || clipDuration;
    return this.actionTimer;
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
