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

    this.rigAssets = new Map();
    this.activeRig = null;
    this.activeRigPath = GAME_CONFIG.viewModel.modelPath;
    this.mixer = null;
    this.actions = new Map();
    this.model = null;
    this.bakedWeapon = null;
    this.weaponAnchor = null;
    this.weaponAssets = new Map();
    this.activeWeaponMesh = null;
    this.recoilOffset = 0;
    this.muzzleFlashTimer = 0;
    this.actionTimer = 0;
    this.currentAction = null;
    this.elapsedTime = 0;
    this.walkCycle = 0;
    this.profile = {
      rigModelPath: GAME_CONFIG.viewModel.modelPath,
      holderPosition: [...GAME_CONFIG.viewModel.holderPosition],
      recoilStrength: GAME_CONFIG.viewModel.recoilStrength,
      recoilRecovery: GAME_CONFIG.viewModel.recoilRecovery,
      shootAnimationDuration: 0.22,
      muzzleFlashColor: 0xffe7b6,
      muzzleFlashDuration: 0.05,
      muzzleFlashIntensity: 3.4,
      weaponModelPath: null,
      weaponPosition: [0, 0, 0],
      weaponQuaternion: [0, 0, 0, 1],
      weaponScale: [1, 1, 1],
    };
    this.defaultProfile = {
      rigModelPath: this.profile.rigModelPath,
      holderPosition: [...this.profile.holderPosition],
      recoilStrength: this.profile.recoilStrength,
      recoilRecovery: this.profile.recoilRecovery,
      shootAnimationDuration: this.profile.shootAnimationDuration,
      muzzleFlashColor: this.profile.muzzleFlashColor,
      muzzleFlashDuration: this.profile.muzzleFlashDuration,
      muzzleFlashIntensity: this.profile.muzzleFlashIntensity,
      weaponModelPath: this.profile.weaponModelPath,
      weaponPosition: [...this.profile.weaponPosition],
      weaponQuaternion: [...this.profile.weaponQuaternion],
      weaponScale: [...this.profile.weaponScale],
    };
    this.muzzleFlash = new THREE.PointLight(0xffe7b6, 0, 2.4, 2);
    this.muzzleFlash.position.set(0.15, -0.03, -GAME_CONFIG.viewModel.muzzleFlashDistance);
    this.holder.add(this.muzzleFlash);
  }

  async load(weapons = []) {
    const uniqueRigPaths = [
      ...new Set(
        [
          GAME_CONFIG.viewModel.modelPath,
          ...weapons.map((weapon) => weapon.viewModel?.rigModelPath),
        ].filter(Boolean),
      ),
    ];

    await Promise.all(
      uniqueRigPaths.map(async (path) => {
        const gltf = await this.loader.loadAsync(path);
        const model = gltf.scene;
        const mixer = new THREE.AnimationMixer(model);
        const actions = new Map();
        const weaponAnchor = new THREE.Object3D();

        model.scale.fromArray(GAME_CONFIG.viewModel.scale);
        model.rotation.set(...GAME_CONFIG.viewModel.rotation);
        model.add(weaponAnchor);
        model.traverse((child) => {
          child.frustumCulled = false;
        });

        gltf.animations.forEach((clip) => {
          const action = mixer.clipAction(clip);
          action.clampWhenFinished = true;
          actions.set(clip.name, action);
        });

        this.rigAssets.set(path, {
          actions,
          bakedWeapon: model.getObjectByName("AKM_model"),
          mixer,
          model,
          weaponAnchor,
        });
      }),
    );

    const uniquePaths = [
      ...new Set(
        weapons
          .map((weapon) => weapon.viewModel?.weaponModelPath)
          .filter(Boolean),
      ),
    ];

    await Promise.all(
      uniquePaths.map(async (path) => {
        const weaponGltf = await this.loader.loadAsync(path);
        weaponGltf.scene.traverse((child) => {
          child.frustumCulled = false;
        });
        this.weaponAssets.set(path, weaponGltf.scene);
      }),
    );

    this.setActiveRig(this.profile.rigModelPath);
    this.applyProfile();
    this.swapWeaponMesh(this.profile.weaponModelPath);
    this.playIdle();
  }

  setWeaponProfile(profile = {}) {
    this.profile = {
      ...this.defaultProfile,
      ...profile,
      rigModelPath: profile.rigModelPath ?? this.defaultProfile.rigModelPath,
      holderPosition: profile.holderPosition ?? this.defaultProfile.holderPosition,
      weaponModelPath:
        profile.weaponModelPath ?? this.defaultProfile.weaponModelPath,
      weaponPosition: profile.weaponPosition ?? this.defaultProfile.weaponPosition,
      weaponQuaternion:
        profile.weaponQuaternion ?? this.defaultProfile.weaponQuaternion,
      weaponScale: profile.weaponScale ?? this.defaultProfile.weaponScale,
    };
    this.applyProfile();
  }

  applyProfile() {
    this.holder.position.fromArray(this.profile.holderPosition);

    if (!this.rigAssets.size) {
      return;
    }

    this.setActiveRig(this.profile.rigModelPath);
    this.swapWeaponMesh(this.profile.weaponModelPath);

    if (this.bakedWeapon) {
      this.bakedWeapon.visible = !this.profile.weaponModelPath;
    }

    if (!this.activeWeaponMesh) {
      return;
    }

    this.activeWeaponMesh.position.fromArray(this.profile.weaponPosition);
    this.activeWeaponMesh.quaternion.fromArray(this.profile.weaponQuaternion);
    this.activeWeaponMesh.scale.fromArray(this.profile.weaponScale);
  }

  setActiveRig(rigModelPath) {
    const nextPath = rigModelPath || GAME_CONFIG.viewModel.modelPath;
    const nextRig = this.rigAssets.get(nextPath);

    if (!nextRig || this.activeRig === nextRig) {
      return;
    }

    if (this.activeRig) {
      this.holder.remove(this.activeRig.model);
    }

    this.activeRig = nextRig;
    this.activeRigPath = nextPath;
    this.model = nextRig.model;
    this.mixer = nextRig.mixer;
    this.actions = nextRig.actions;
    this.weaponAnchor = nextRig.weaponAnchor;
    this.bakedWeapon = nextRig.bakedWeapon;
    this.holder.add(this.model);
  }

  swapWeaponMesh(modelPath) {
    if (!modelPath) {
      if (this.activeWeaponMesh) {
        this.activeWeaponMesh.parent?.remove(this.activeWeaponMesh);
        this.activeWeaponMesh = null;
      }
      return;
    }

    if (!this.weaponAssets.has(modelPath)) {
      return;
    }

    const nextWeaponMesh = this.weaponAssets.get(modelPath);

    if (this.activeWeaponMesh === nextWeaponMesh) {
      return;
    }

    if (this.activeWeaponMesh) {
      this.activeWeaponMesh.parent?.remove(this.activeWeaponMesh);
    }

    this.activeWeaponMesh = nextWeaponMesh;
    this.weaponAnchor?.add(this.activeWeaponMesh);
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
      this.profile.recoilRecovery,
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
      this.muzzleFlash.intensity =
        this.muzzleFlashTimer > 0 ? this.profile.muzzleFlashIntensity : 0;
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
    this.muzzleFlash.color.setHex(this.profile.muzzleFlashColor);
    this.muzzleFlashTimer = this.profile.muzzleFlashDuration;
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
