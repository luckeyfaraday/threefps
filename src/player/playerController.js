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
    this.correction = new THREE.Vector3();

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

    if (this.input.isPressed("KeyW")) {
      this.velocity.add(
        this.cameraRig.getForwardVector(this.forward).multiplyScalar(acceleration),
      );
    }

    if (this.input.isPressed("KeyS")) {
      this.velocity.add(
        this.cameraRig.getForwardVector(this.forward).multiplyScalar(-acceleration),
      );
    }

    if (this.input.isPressed("KeyA")) {
      this.velocity.add(
        this.cameraRig.getSideVector(this.side).multiplyScalar(-acceleration),
      );
    }

    if (this.input.isPressed("KeyD")) {
      this.velocity.add(
        this.cameraRig.getSideVector(this.side).multiplyScalar(acceleration),
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
}
