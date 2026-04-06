import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { GAME_CONFIG } from "../core/config.js";

const UP = new THREE.Vector3(0, 1, 0);
const DEATH_DROP = 0.32;
const DETOUR_ANGLES = [0, 0.55, -0.55, 1.1, -1.1];
const groundProbe = new THREE.Raycaster();
const groundProbeOrigin = new THREE.Vector3();
const groundProbeDirection = new THREE.Vector3(0, -1, 0);
const visibilityProbe = new THREE.Raycaster();
const visibilityOrigin = new THREE.Vector3();
const visibilityDirection = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const candidateDirection = new THREE.Vector3();
const candidateStep = new THREE.Vector3();
const toPlayerVector = new THREE.Vector3();
const black = new THREE.Color(0x000000);
const routeTargetVector = new THREE.Vector3();

function findNearestRouteNode(position) {
  const nodes = GAME_CONFIG.survival.routeAssist?.nodes ?? [];
  if (nodes.length === 0) {
    return null;
  }

  let bestNode = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of nodes) {
    const distance = Math.hypot(
      position.x - node.position[0],
      position.y - node.position[1],
      position.z - node.position[2],
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNode = node;
    }
  }

  return bestNode;
}

function findRouteStep(startId, goalId) {
  if (!startId || !goalId || startId === goalId) {
    return null;
  }

  const nodes = GAME_CONFIG.survival.routeAssist?.nodes ?? [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const queue = [startId];
  const parents = new Map([[startId, null]]);

  while (queue.length > 0) {
    const currentId = queue.shift();
    const current = nodeMap.get(currentId);
    if (!current) {
      continue;
    }

    if (currentId === goalId) {
      break;
    }

    for (const nextId of current.links ?? []) {
      if (parents.has(nextId) || !nodeMap.has(nextId)) {
        continue;
      }
      parents.set(nextId, currentId);
      queue.push(nextId);
    }
  }

  if (!parents.has(goalId)) {
    return null;
  }

  let cursor = goalId;
  let previous = parents.get(cursor);
  while (previous && previous !== startId) {
    cursor = previous;
    previous = parents.get(cursor);
  }

  return nodeMap.get(cursor);
}

function getRouteAssistTarget(fromPosition, targetPosition, hasSight) {
  const config = GAME_CONFIG.survival.routeAssist;
  if (!config?.nodes?.length) {
    return null;
  }

  const verticalGap = Math.abs(targetPosition.y - fromPosition.y);
  const needsAssist = verticalGap > config.verticalThreshold;

  if (!needsAssist) {
    return null;
  }

  const startNode = findNearestRouteNode(fromPosition);
  const goalNode = findNearestRouteNode(targetPosition);
  const nextNode = findRouteStep(startNode?.id, goalNode?.id) ?? goalNode;

  if (!nextNode) {
    return null;
  }

  return routeTargetVector.set(...nextNode.position);
}

class Zombie {
  constructor(scene, profile, spawnPoint, archetype) {
    this.scene = scene;
    this.profile = profile;
    this.archetype = archetype;
    this.health = profile.health;
    this.dead = false;
    this.deathTimer = 0;
    this.attackTimer = 0;
    this.flinchYaw = 0;
    this.transientTimer = 0;
    this.transientFallback = null;
    this.currentLoop = null;
    this.velocity = new THREE.Vector3();
    this.correction = new THREE.Vector3();
    this.onFloor = false;
    this.segmentHeight = Math.max(0.1, profile.height - profile.radius * 2);
    this.collider = new Capsule(
      new THREE.Vector3(
        spawnPoint[0],
        spawnPoint[1] + profile.radius,
        spawnPoint[2],
      ),
      new THREE.Vector3(
        spawnPoint[0],
        spawnPoint[1] + profile.radius + this.segmentHeight,
        spawnPoint[2],
      ),
      profile.radius,
    );
    this.group = new THREE.Group();
    this.group.position.set(
      this.collider.start.x,
      this.getFootY(),
      this.collider.start.z,
    );

    this.model = clone(archetype.scene);
    this.model.scale.setScalar(profile.scale ?? 1);
    this.model.position.y = archetype.floorOffset * (profile.scale ?? 1);
    this.group.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = new Map();
    for (const clip of archetype.animations) {
      const action = this.mixer.clipAction(clip);
      action.clampWhenFinished = true;
      this.actions.set(clip.name, action);
    }

    this.group.traverse((child) => {
      child.userData.damageable = this;
      if (!child.isMesh) {
        return;
      }

      child.frustumCulled = false;
      child.castShadow = true;
      child.receiveShadow = true;

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
    });

    this.scene.add(this.group);
    this.playLoop(this.profile.animation.idle);
  }

  applyDamage(amount) {
    if (this.dead) {
      return { hit: false, killed: false, score: 0 };
    }

    this.health = Math.max(0, this.health - amount);
    this.flinchYaw += (Math.random() - 0.5) * 0.3;
    this.flashHit();

    if (this.health === 0) {
      this.dead = true;
      this.deathTimer = Math.max(0.75, this.getClipDuration(this.profile.animation.death));
      this.group.traverse((child) => {
        child.userData.damageable = null;
      });
      this.playTransient(this.profile.animation.death, this.deathTimer);
      return { hit: true, killed: true, score: this.profile.score };
    }

    this.playTransient(this.profile.animation.hit, 0.24, this.profile.animation.idle);
    return { hit: true, killed: false, score: 0 };
  }

  update(deltaTime, playerPosition, collisionWorld) {
    this.mixer.update(deltaTime);
    this.attackTimer = Math.max(0, this.attackTimer - deltaTime);
    this.transientTimer = Math.max(0, this.transientTimer - deltaTime);
    this.flinchYaw = THREE.MathUtils.damp(this.flinchYaw, 0, 10, deltaTime);

    if (this.transientTimer === 0 && this.transientFallback && !this.dead) {
      const nextLoop = this.transientFallback;
      this.transientFallback = null;
      this.playLoop(nextLoop);
    }

    if (this.dead) {
      this.deathTimer = Math.max(0, this.deathTimer - deltaTime);
      this.group.rotation.z = THREE.MathUtils.damp(
        this.group.rotation.z,
        -1.05,
        6,
        deltaTime,
      );
      this.group.position.y = THREE.MathUtils.damp(
        this.group.position.y,
        this.getFootY() - DEATH_DROP,
        8,
        deltaTime,
      );
      return { damage: 0, removable: this.deathTimer === 0 };
    }

    const toPlayer = toPlayerVector.set(
      playerPosition.x - this.collider.start.x,
      0,
      playerPosition.z - this.collider.start.z,
    );
    const verticalGap = Math.abs(
      playerPosition.y - (this.getFootY() + (this.profile.eyeHeight ?? 1)),
    );
    toPlayer.y = 0;
    const distance = toPlayer.length();
    if (distance > 0.0001) {
      toPlayer.normalize();
    }

    let wantsMove = true;
    let attackNow = false;
    const hasSight = this.hasLineOfSight(playerPosition, collisionWorld);
    const routeTarget = getRouteAssistTarget(
      this.collider.start,
      playerPosition,
      hasSight,
    );
    let desiredDirection = null;

    if (this.profile.attackType === "ranged") {
      const preferredRange = this.profile.preferredRange ?? this.profile.attackRange * 0.6;
      const retreatRange = this.profile.retreatRange ?? preferredRange * 0.55;
      const pursuitTarget = routeTarget ?? playerPosition;
      const toPursuit = candidateDirection.set(
        pursuitTarget.x - this.collider.start.x,
        0,
        pursuitTarget.z - this.collider.start.z,
      );
      if (toPursuit.lengthSq() > 0) {
        toPursuit.normalize();
      }

      if (distance > preferredRange || !hasSight || routeTarget) {
        desiredDirection = toPursuit;
      } else if (distance < retreatRange) {
        desiredDirection = candidateDirection.copy(toPlayer).multiplyScalar(-1);
      } else {
        wantsMove = false;
      }

      if (
        hasSight &&
        verticalGap <= (this.profile.attackHeightTolerance ?? 1.8) &&
        distance <= this.profile.attackRange &&
        this.attackTimer === 0
      ) {
        attackNow = true;
      }
    } else {
      const pursuitTarget = routeTarget ?? playerPosition;
      const toPursuit = candidateDirection.set(
        pursuitTarget.x - this.collider.start.x,
        0,
        pursuitTarget.z - this.collider.start.z,
      );
      if (toPursuit.lengthSq() > 0) {
        toPursuit.normalize();
      }

      if (distance > this.profile.attackRange * 0.92) {
        desiredDirection = toPursuit;
      } else {
        wantsMove = false;
      }

      if (
        verticalGap <= (this.profile.attackHeightTolerance ?? 1) &&
        distance <= this.profile.attackRange &&
        this.attackTimer === 0
      ) {
        attackNow = true;
      }
    }

    this.updateMovement(
      wantsMove && desiredDirection ? desiredDirection : null,
      deltaTime,
      collisionWorld,
    );

    if (distance > 0.0001) {
      const facing = wantsMove ? moveDirection : toPlayer;
      this.group.rotation.y = Math.atan2(facing.x, facing.z);
    }

    this.group.position.set(
      this.collider.start.x,
      this.getFootY(),
      this.collider.start.z,
    );
    this.group.rotation.z = this.flinchYaw;

    this.fadeHitFlash();

    if (attackNow) {
      this.attackTimer = this.profile.attackCooldown;
      this.playTransient(
        this.profile.animation.attack,
        this.getClipDuration(this.profile.animation.attack) || 0.42,
        this.profile.animation.idle,
      );
      return { damage: this.profile.attackDamage, removable: false };
    }

    if (this.transientTimer === 0) {
      this.playLoop(wantsMove ? this.profile.animation.move : this.profile.animation.idle);
    }

    return { damage: 0, removable: false };
  }

  updateMovement(targetDirection, deltaTime, collisionWorld) {
    if (targetDirection?.lengthSq() > 0) {
      const chosenDirection = this.chooseMoveDirection(
        targetDirection,
        deltaTime,
        collisionWorld,
      );
      moveDirection.copy(chosenDirection);

      const control = this.onFloor ? 14 : 6;
      this.velocity.x = THREE.MathUtils.damp(
        this.velocity.x,
        moveDirection.x * this.profile.speed,
        control,
        deltaTime,
      );
      this.velocity.z = THREE.MathUtils.damp(
        this.velocity.z,
        moveDirection.z * this.profile.speed,
        control,
        deltaTime,
      );
    } else {
      moveDirection.set(0, 0, 0);
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 14, deltaTime);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 14, deltaTime);
    }

    let damping = Math.exp(-GAME_CONFIG.player.floorDamping * deltaTime) - 1;

    if (!this.onFloor) {
      this.velocity.y -= GAME_CONFIG.simulation.gravity * deltaTime;
      damping *= GAME_CONFIG.player.airDampingFactor;
    }

    this.velocity.addScaledVector(this.velocity, damping);
    this.collider.translate(this.correction.copy(this.velocity).multiplyScalar(deltaTime));
    this.resolveCollisions(collisionWorld);
  }

  chooseMoveDirection(targetDirection, deltaTime, collisionWorld) {
    const stepDistance = Math.max(0.05, this.profile.speed * deltaTime * 1.5);
    let bestDirection = null;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (const angle of DETOUR_ANGLES) {
      candidateDirection.copy(targetDirection);
      if (candidateDirection.lengthSq() === 0) {
        continue;
      }

      if (angle !== 0) {
        candidateDirection.applyAxisAngle(UP, angle);
      }

      candidateStep.copy(candidateDirection).multiplyScalar(stepDistance);
      const probeCapsule = this.collider.clone();
      probeCapsule.translate(candidateStep);

      const hit = collisionWorld.capsuleIntersect(probeCapsule);
      const penalty = (hit ? hit.depth + 2 : 0) + Math.abs(angle) * 0.12;

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        if (!bestDirection) {
          bestDirection = new THREE.Vector3();
        }
        bestDirection.copy(candidateDirection);
      }

      if (!hit) {
        break;
      }
    }

    if (!bestDirection) {
      return candidateDirection.copy(targetDirection).normalize();
    }

    return bestDirection.normalize();
  }

  resolveCollisions(collisionWorld) {
    const result = collisionWorld.capsuleIntersect(this.collider);
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
    } else if (this.velocity.y < 0) {
      this.velocity.y = 0;
    }

    if (result.depth >= 1e-10) {
      this.collider.translate(
        this.correction.copy(result.normal).multiplyScalar(result.depth),
      );
    }
  }

  getFootY() {
    return this.collider.start.y - this.profile.radius;
  }

  hasLineOfSight(playerPosition, collisionWorld) {
    visibilityOrigin.set(
      this.collider.start.x,
      this.getFootY() + (this.profile.eyeHeight ?? 1),
      this.collider.start.z,
    );
    visibilityDirection.subVectors(playerPosition, visibilityOrigin);
    const distance = visibilityDirection.length();

    if (distance <= 0.0001) {
      return true;
    }

    visibilityDirection.normalize();
    visibilityProbe.set(visibilityOrigin, visibilityDirection);
    visibilityProbe.far = Math.max(0, distance - 0.35);

    return !visibilityProbe.intersectObjects(collisionWorld.getShootables(), true)[0];
  }

  flashHit() {
    this.group.traverse((child) => {
      const materials = Array.isArray(child.material)
        ? child.material
        : child.material
          ? [child.material]
          : [];

      for (const material of materials) {
        if (material.emissive) {
          material.emissive.setHex(0xffffff);
        }
      }
    });
  }

  fadeHitFlash() {
    this.group.traverse((child) => {
      const materials = Array.isArray(child.material)
        ? child.material
        : child.material
          ? [child.material]
          : [];

      for (const material of materials) {
        if (material.emissive) {
          material.emissive.lerp(black, 0.16);
        }
      }
    });
  }

  getClipDuration(name) {
    const action = this.actions.get(name);
    return action ? action.getClip().duration : 0;
  }

  playLoop(name) {
    if (!name || this.currentLoop === name || !this.actions.has(name)) {
      return;
    }

    this.stopAll();
    const action = this.actions.get(name);
    action.reset();
    action.setLoop(THREE.LoopRepeat);
    action.timeScale = 1;
    action.play();
    this.currentLoop = name;
  }

  playTransient(name, duration, fallback) {
    if (!name || !this.actions.has(name)) {
      this.transientTimer = 0;
      this.transientFallback = fallback ?? null;
      return;
    }

    this.stopAll();
    const action = this.actions.get(name);
    action.reset();
    action.setLoop(THREE.LoopOnce);
    action.timeScale = 1;
    action.play();
    this.transientTimer = duration || action.getClip().duration;
    this.transientFallback = fallback ?? null;
    this.currentLoop = null;
  }

  stopAll() {
    for (const action of this.actions.values()) {
      action.stop();
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

export class ZombieManager {
  constructor(scene, collisionWorld) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.loader = new GLTFLoader();
    this.archetypes = new Map();
    this.zombies = [];
    this.wave = 0;
    this.kills = 0;
    this.score = 0;
    this.pendingSpawns = 0;
    this.spawnTimer = 0;
    this.intermissionTimer = GAME_CONFIG.survival.initialDelay;
    this.status = "Intermission";
    this.spawnCursor = 0;
  }

  async load() {
    const uniquePaths = [
      ...new Set(
        Object.values(GAME_CONFIG.zombies)
          .map((profile) => profile.modelPath)
          .filter(Boolean),
      ),
    ];

    await Promise.all(
      uniquePaths.map(async (path) => {
        const gltf = await this.loader.loadAsync(path);
        const scene = gltf.scene;
        const box = new THREE.Box3().setFromObject(scene);
        const floorOffset = Number.isFinite(box.min.y) ? -box.min.y : 0;

        scene.traverse((child) => {
          child.frustumCulled = false;
        });

        this.archetypes.set(path, {
          animations: gltf.animations,
          floorOffset,
          scene,
        });
      }),
    );
  }

  resetRun() {
    for (const zombie of this.zombies) {
      zombie.dispose();
    }
    this.zombies = [];
    this.wave = 0;
    this.kills = 0;
    this.score = 0;
    this.pendingSpawns = 0;
    this.spawnTimer = 0;
    this.intermissionTimer = GAME_CONFIG.survival.initialDelay;
    this.status = "Intermission";
    this.spawnCursor = 0;
  }

  getShootables() {
    return this.zombies.map((zombie) => zombie.group);
  }

  getStatus() {
    return {
      alive: this.zombies.filter((zombie) => !zombie.dead).length,
      intermission: this.intermissionTimer,
      kills: this.kills,
      score: this.score,
      status: this.status,
      wave: this.wave,
    };
  }

  update(deltaTime, playerPosition) {
    let damageToPlayer = 0;

    if (this.pendingSpawns === 0 && this.zombies.length === 0) {
      this.intermissionTimer = Math.max(0, this.intermissionTimer - deltaTime);
      this.status =
        this.intermissionTimer > 0
          ? `Wave ${this.wave + 1} in ${this.intermissionTimer.toFixed(1)}`
          : "Spawning";

      if (this.intermissionTimer === 0) {
        this.startNextWave();
      }
    } else {
      this.spawnTimer = Math.max(0, this.spawnTimer - deltaTime);

      if (this.pendingSpawns > 0 && this.spawnTimer <= 0) {
        this.spawnOne();
        this.pendingSpawns -= 1;
        this.spawnTimer = GAME_CONFIG.survival.spawnInterval;
      }

      this.status = this.pendingSpawns > 0 ? "Incoming" : "Survive";
    }

    for (let index = this.zombies.length - 1; index >= 0; index -= 1) {
      const zombie = this.zombies[index];
      const result = zombie.update(deltaTime, playerPosition, this.collisionWorld);
      damageToPlayer += result.damage;

      if (!result.removable) {
        continue;
      }

      zombie.dispose();
      this.zombies.splice(index, 1);
    }

    return {
      damageToPlayer,
      ...this.getStatus(),
    };
  }

  startNextWave() {
    this.wave += 1;
    this.pendingSpawns =
      GAME_CONFIG.survival.baseWaveCount +
      (this.wave - 1) * GAME_CONFIG.survival.perWaveIncrease;
    this.spawnTimer = 0;
    this.intermissionTimer = GAME_CONFIG.survival.intermissionDuration;
    this.status = "Incoming";
  }

  spawnOne() {
    const basePoint =
      GAME_CONFIG.survival.spawnPoints[
        this.spawnCursor % GAME_CONFIG.survival.spawnPoints.length
      ];
    this.spawnCursor += 1;

    const shouldUseRunner = this.wave >= 2 && this.spawnCursor % 4 === 0;
    const profile = shouldUseRunner
      ? GAME_CONFIG.zombies.runner
      : GAME_CONFIG.zombies.walker;
    const spawnPoint = this.resolveSpawnPoint(basePoint, profile);
    const archetype = this.archetypes.get(profile.modelPath);
    if (!archetype) {
      return;
    }
    const zombie = new Zombie(this.scene, profile, spawnPoint, archetype);
    this.zombies.push(zombie);
  }

  registerKill(score) {
    this.kills += 1;
    this.score += score;
  }

  resolveSpawnPoint(basePoint, profile) {
    groundProbeOrigin.set(basePoint[0], basePoint[1] + 20, basePoint[2]);
    groundProbe.set(groundProbeOrigin, groundProbeDirection);
    groundProbe.far = 60;

    const hit = groundProbe.intersectObjects(this.collisionWorld.getShootables(), true)[0];
    if (!hit) {
      return [basePoint[0], 0, basePoint[2]];
    }

    return [basePoint[0], hit.point.y, basePoint[2]];
  }
}
