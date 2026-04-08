import * as THREE from "three";
import { Capsule } from "three/addons/math/Capsule.js";
import { GAME_CONFIG } from "../core/config.js";

export class PlayerController {
  constructor({ camera, cameraRig, collisionWorld, input }) {
    this.camera = camera;
    this.cameraRig = cameraRig;
    this.collisionWorld = collisionWorld;
    this.input = input;

    this.collider = new Capsule();
    this.onFloor = false;
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.moveAxes = new THREE.Vector2();
    this.correction = new THREE.Vector3();
    this.movementState = {
      horizontalSpeed: 0,
      normalizedSpeed: 0,
      onFloor: false,
    };

    this.spawn();
  }

  step(deltaTime) {
    this.cameraRig.updateRecoil(deltaTime);
    this.cameraRig.update();
    this.applyControls(deltaTime);
    this.updatePhysics(deltaTime);
    this.teleportIfOutOfBounds();
  }

  spawn() {
    this.collider.start.fromArray(GAME_CONFIG.player.spawn.start);
    this.collider.end.fromArray(GAME_CONFIG.player.spawn.end);
    this.collider.radius = GAME_CONFIG.player.spawn.radius;
    this.velocity.set(0, 0, 0);
    this.cameraRig.setRotation();
    this.camera.position.copy(this.collider.end);
  }

  applyControls(deltaTime) {
    if (!this.input.isLocked()) {
      return;
    }

    const acceleration =
      deltaTime *
      (this.onFloor
        ? GAME_CONFIG.player.groundAcceleration
        : GAME_CONFIG.player.airAcceleration);

    this.input.getMoveAxes(this.moveAxes);

    if (this.moveAxes.y > 0.0001) {
      this.velocity.add(
        this.cameraRig
          .getForwardVector(this.forward)
          .multiplyScalar(acceleration * this.moveAxes.y),
      );
    }

    if (this.moveAxes.y < -0.0001) {
      this.velocity.add(
        this.cameraRig
          .getForwardVector(this.forward)
          .multiplyScalar(acceleration * this.moveAxes.y),
      );
    }

    if (this.moveAxes.x < -0.0001) {
      this.velocity.add(
        this.cameraRig
          .getSideVector(this.side)
          .multiplyScalar(acceleration * this.moveAxes.x),
      );
    }

    if (this.moveAxes.x > 0.0001) {
      this.velocity.add(
        this.cameraRig
          .getSideVector(this.side)
          .multiplyScalar(acceleration * this.moveAxes.x),
      );
    }

    if (this.onFloor && this.input.isPressed("Space")) {
      this.velocity.y = GAME_CONFIG.player.jumpVelocity;
    }
  }

  updatePhysics(deltaTime) {
    let damping = Math.exp(-GAME_CONFIG.player.floorDamping * deltaTime) - 1;

    if (!this.onFloor) {
      this.velocity.y -= GAME_CONFIG.simulation.gravity * deltaTime;
      damping *= GAME_CONFIG.player.airDampingFactor;
    }

    this.velocity.addScaledVector(this.velocity, damping);
    this.collider.translate(this.correction.copy(this.velocity).multiplyScalar(deltaTime));

    this.resolveCollisions();
    this.camera.position.copy(this.collider.end);
    this.movementState.horizontalSpeed = Math.hypot(
      this.velocity.x,
      this.velocity.z,
    );
    this.movementState.normalizedSpeed = Math.min(
      1,
      this.movementState.horizontalSpeed /
        GAME_CONFIG.player.presentation.moveSpeedForFullBob,
    );
    this.movementState.onFloor = this.onFloor;
  }

  resolveCollisions() {
    const result = this.collisionWorld.capsuleIntersect(this.collider);

    this.onFloor = false;

    if (!result) {
      return;
    }

    this.onFloor = result.normal.y >= 0.15;

    if (!this.onFloor) {
      this.velocity.addScaledVector(
        result.normal,
        -result.normal.dot(this.velocity),
      );
    }

    if (result.depth >= 1e-10) {
      this.collider.translate(
        this.correction.copy(result.normal).multiplyScalar(result.depth),
      );
    }
  }

  teleportIfOutOfBounds() {
    if (this.camera.position.y > GAME_CONFIG.player.oobY) {
      return;
    }

    this.spawn();
  }

  getMovementState() {
    return this.movementState;
  }
}
