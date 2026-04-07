import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const candidateDir = new THREE.Vector3();
const candidateStep = new THREE.Vector3();

export class Tactics {
  constructor() {
    this.lastFlankSide = 0;
  }

  chooseFlankDirection(entity, playerPosition) {
    const toPlayer = new THREE.Vector3().subVectors(playerPosition, entity.collider.start);
    toPlayer.y = 0;
    if (toPlayer.lengthSq() < 0.001) return null;

    const perpendicular = new THREE.Vector3().crossVectors(toPlayer.normalize(), UP);
    const dot = perpendicular.dot(entity.velocity);

    let preferredSide = this.lastFlankSide;
    if (Math.abs(dot) > 0.5) {
      preferredSide = dot > 0 ? 1 : -1;
    } else {
      preferredSide = Math.random() > 0.5 ? 1 : -1;
    }

    const flankAngle = (Math.random() * 0.3 + 0.8) * Math.PI / 2;
    const actualAngle = preferredSide * flankAngle;

    candidateDir.copy(toPlayer.normalize());
    candidateDir.applyAxisAngle(UP, actualAngle);
    candidateDir.normalize();

    this.lastFlankSide = preferredSide;
    return candidateDir.clone();
  }

  findNearestCover(entity, playerPosition, collisionWorld, minDist = 2, maxDist = 6) {
    const coverProbeCount = 12;
    const probeDistance = 4;
    const probeOrigin = entity.collider.start.clone();
    probeOrigin.y = entity.getFootY() + entity.profile.eyeHeight * 0.6;

    const playerDir = new THREE.Vector3().subVectors(playerPosition, probeOrigin).normalize();
    const perpRight = new THREE.Vector3().crossVectors(playerDir, UP).normalize();

    let bestCover = null;
    let bestScore = -Infinity;

    for (let i = 0; i < coverProbeCount; i++) {
      const angle = (i / coverProbeCount) * Math.PI * 2;
      const offset = perpRight.clone().multiplyScalar(Math.cos(angle) * probeDistance);
      const forward = playerDir.clone().multiplyScalar(Math.sin(angle) * probeDistance * 0.5);

      candidateDir.copy(probeOrigin).add(offset).add(forward);
      candidateDir.y = probeOrigin.y;

      const testRay = new THREE.Raycaster(
        probeOrigin.clone(),
        candidateDir.clone().sub(probeOrigin).normalize(),
        0.1,
        probeDistance
      );

      const hits = testRay.intersectObjects(collisionWorld.getShootables(), true);
      if (hits.length > 0) {
        const hit = hits[0];
        const toCover = new THREE.Vector3().subVectors(hit.point, probeOrigin);
        const distToCover = toCover.length();
        const dotToPlayer = toCover.normalize().dot(playerDir);

        if (distToCover >= minDist && distToCover <= maxDist && dotToPlayer < -0.2) {
          const score = distToCover * 0.3 + Math.abs(dotToPlayer) * 2;
          if (score > bestScore) {
            bestScore = score;
            bestCover = hit.point.clone();
          }
        }
      }
    }

    return bestCover;
  }

  shouldRetreat(entity) {
    const healthPercent = entity.health / entity.profile.health;
    if (healthPercent < 0.25) return true;

    const distToPlayer = Math.hypot(
      entity.collider.start.x - entity.lastKnownPlayerPos?.x ?? 0,
      entity.collider.start.z - entity.lastKnownPlayerPos?.z ?? 0
    );

    if (distToPlayer < 2 && !entity.onFloor) return true;

    if (healthPercent < 0.5 && distToPlayer < 4) return true;

    return false;
  }

  getRetreatPosition(entity, playerPosition, navGraph) {
    if (navGraph) {
      const retreatPoint = navGraph.findRetreatPoint(
        entity.collider.start,
        playerPosition
      );
      if (retreatPoint) return retreatPoint;
    }

    const toEntity = new THREE.Vector3().subVectors(entity.collider.start, playerPosition);
    toEntity.y = 0;
    const dist = toEntity.length();

    if (dist < 0.001) {
      toEntity.set(0, 0, -1);
    } else {
      toEntity.normalize();
    }

    const retreatDir = toEntity.multiplyScalar(8);
    const retreatPos = entity.collider.start.clone().add(retreatDir);
    retreatPos.y = entity.collider.start.y;

    return retreatPos;
  }

  evaluateAttackAngle(entity, playerPosition) {
    const toPlayer = new THREE.Vector3().subVectors(playerPosition, entity.collider.start);
    toPlayer.y = 0;

    const entityForward = new THREE.Vector3(
      Math.sin(entity.group.rotation.y),
      0,
      Math.cos(entity.group.rotation.y)
    );

    const dot = entityForward.dot(toPlayer.normalize());
    return dot;
  }

  isVulnerable(entity, playerPosition) {
    const attackAngle = this.evaluateAttackAngle(entity, playerPosition);
    const distToPlayer = new THREE.Vector3().subVectors(
      entity.collider.start,
      playerPosition
    ).length();

    return distToPlayer < 5 && attackAngle < 0.5;
  }
}