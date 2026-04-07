import * as THREE from "three";

const sightRay = new THREE.Raycaster();
const sightOrigin = new THREE.Vector3();
const sightDirection = new THREE.Vector3();

export class Awareness {
  constructor(profile) {
    this.profile = profile;
    this.sightRange = profile.sightRange ?? 30;
    this.hearingRange = profile.hearingRange ?? 15;
    this.memoryDuration = profile.memoryDuration ?? 8;
    this.lastSeenPosition = null;
    this.lastHeardPosition = null;
    this.lastSeenTime = 0;
    this.alertLevel = 0;
    this.heardNoisePosition = null;
    this.heardNoiseTime = 0;
  }

  update(deltaTime, entity, playerPosition, collisionWorld, hasLineOfSight) {
    this.alertLevel = Math.max(0, this.alertLevel - deltaTime * 0.5);

    if (hasLineOfSight && this.canSeePlayer(entity, playerPosition, collisionWorld)) {
      this.lastSeenPosition = playerPosition.clone();
      this.lastSeenTime = performance.now();
      this.alertLevel = 1;
    }

    if (this.hasMemoryExpired()) {
      this.lastSeenPosition = null;
    }
  }

  canSeePlayer(entity, playerPosition, collisionWorld) {
    const entityEye = entity.collider.start.clone();
    entityEye.y = entity.getFootY() + (entity.profile.eyeHeight ?? 1);

    sightOrigin.copy(entityEye);
    sightDirection.subVectors(playerPosition, sightOrigin);
    const distance = sightDirection.length();

    if (distance > this.sightRange) {
      return false;
    }

    sightDirection.normalize();
    sightRay.set(sightOrigin, sightDirection);
    sightRay.far = Math.max(0, distance - 0.35);

    const hits = sightRay.intersectObjects(collisionWorld.getShootables(), true);
    return hits.length === 0;
  }

  hasMemoryExpired() {
    if (!this.lastSeenPosition) return true;
    const elapsed = (performance.now() - this.lastSeenTime) / 1000;
    return elapsed > this.memoryDuration;
  }

  heardNoise(position) {
    this.lastHeardPosition = position.clone();
    this.heardNoiseTime = performance.now();
    this.alertLevel = Math.min(1, this.alertLevel + 0.5);
  }

  getKnownPlayerPosition() {
    return this.lastSeenPosition;
  }

  getLastHeardPosition() {
    if (!this.lastHeardPosition) return null;
    const elapsed = (performance.now() - this.heardNoiseTime) / 1000;
    if (elapsed > 3) return null;
    return this.lastHeardPosition;
  }

  getAlertLevel() {
    return this.alertLevel;
  }

  setAlertLevel(level) {
    this.alertLevel = Math.max(0, Math.min(1, level));
  }

  onPlayerVanish() {
    if (this.alertLevel > 0.3) {
      this.alertLevel = 0.3;
    }
  }
}