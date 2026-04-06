import * as THREE from "three";
import { GAME_CONFIG } from "../core/config.js";

export class CameraRig {
  constructor(camera, input, sensitivity) {
    this.camera = camera;
    this.input = input;
    this.sensitivity = sensitivity;
    this.lookDelta = new THREE.Vector2();
    this.pitch = 0;
    this.yaw = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.damageKick = 0;
    this.damageRoll = 0;
    this.deathRoll = 0;
    this.recoilProfile = {
      pitchRecovery: GAME_CONFIG.player.recoil.pitchRecovery,
      yawRecovery: GAME_CONFIG.player.recoil.yawRecovery,
    };
  }

  update() {
    if (this.input.isLocked()) {
      this.input.consumeLookDelta(this.lookDelta);

      if (this.lookDelta.lengthSq() > 0) {
        this.yaw -= this.lookDelta.x * this.sensitivity;
        this.pitch -= this.lookDelta.y * this.sensitivity;
      }
    }

    this.pitch = THREE.MathUtils.clamp(
      this.pitch,
      -Math.PI / 2 + 0.01,
      Math.PI / 2 - 0.01,
    );

    this.camera.rotation.set(
      this.pitch + this.recoilPitch + this.damageKick,
      this.yaw + this.recoilYaw,
      this.damageRoll + this.deathRoll,
    );
    this.lookDelta.set(0, 0);
  }

  updateRecoil(deltaTime) {
    this.recoilPitch = THREE.MathUtils.damp(
      this.recoilPitch,
      0,
      this.recoilProfile.pitchRecovery,
      deltaTime,
    );
    this.recoilYaw = THREE.MathUtils.damp(
      this.recoilYaw,
      0,
      this.recoilProfile.yawRecovery,
      deltaTime,
    );
    this.damageKick = THREE.MathUtils.damp(this.damageKick, 0, 12, deltaTime);
    this.damageRoll = THREE.MathUtils.damp(this.damageRoll, 0, 10, deltaTime);
    this.deathRoll = THREE.MathUtils.damp(this.deathRoll, 0, 4, deltaTime);
  }

  setRecoilProfile(profile = {}) {
    this.recoilProfile = {
      pitchRecovery:
        profile.pitchRecovery ?? GAME_CONFIG.player.recoil.pitchRecovery,
      yawRecovery: profile.yawRecovery ?? GAME_CONFIG.player.recoil.yawRecovery,
    };
  }

  applyRecoil({ pitch, yaw }) {
    this.recoilPitch += pitch;
    this.recoilYaw += yaw;
  }

  applyDamageFeedback(intensity = 1) {
    this.damageKick += 0.03 * intensity;
    this.damageRoll += (Math.random() - 0.5) * 0.08 * intensity;
  }

  triggerDeathEffect() {
    this.damageKick = 0.12;
    this.damageRoll = 0;
    this.deathRoll = -0.42;
  }

  setRotation({ pitch = 0, yaw = 0 } = {}) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.damageKick = 0;
    this.damageRoll = 0;
    this.deathRoll = 0;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  getForwardVector(target) {
    this.camera.getWorldDirection(target);
    target.y = 0;
    target.normalize();
    return target;
  }

  getSideVector(target) {
    this.getForwardVector(target);
    target.cross(this.camera.up);
    return target;
  }
}
