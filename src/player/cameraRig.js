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
      this.pitch + this.recoilPitch,
      this.yaw + this.recoilYaw,
      0,
    );
    this.lookDelta.set(0, 0);
  }

  updateRecoil(deltaTime) {
    this.recoilPitch = THREE.MathUtils.damp(
      this.recoilPitch,
      0,
      GAME_CONFIG.player.recoil.pitchRecovery,
      deltaTime,
    );
    this.recoilYaw = THREE.MathUtils.damp(
      this.recoilYaw,
      0,
      GAME_CONFIG.player.recoil.yawRecovery,
      deltaTime,
    );
  }

  applyRecoil({ pitch, yaw }) {
    this.recoilPitch += pitch;
    this.recoilYaw += yaw;
  }

  setRotation({ pitch = 0, yaw = 0 } = {}) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
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
