import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { GAME_CONFIG } from "../core/config.js";
import { AIState, StateMachine } from "../ai/stateMachine.js";
import { Awareness } from "../ai/awareness.js";
import { SquadManager } from "../ai/squad.js";

const UP = new THREE.Vector3(0, 1, 0);
const DEATH_DROP = 0.32;
const groundProbe = new THREE.Raycaster();
const groundProbeOrigin = new THREE.Vector3();
const groundProbeDirection = new THREE.Vector3(0, -1, 0);
const visibilityProbe = new THREE.Raycaster();
const visibilityOrigin = new THREE.Vector3();
const visibilityDirection = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const progressVector = new THREE.Vector3();
const muzzleForward = new THREE.Vector3();
const shotProbe = new THREE.Raycaster();
const shotProbeOrigin = new THREE.Vector3();
const shotProbeDirection = new THREE.Vector3();
const black = new THREE.Color(0x000000);

class Zombie {
  constructor(scene, profile, spawnPoint, archetype, squadManager) {
    this.scene = scene;
    this.profile = profile;
    this.archetype = archetype;
    this.squadManager = squadManager;
    this.awareness = new Awareness({
      sightRange: profile.sightRange ?? 30,
      hearingRange: profile.hearingRange ?? 15,
      memoryDuration: profile.memoryDuration ?? 8
    });
    this.stateMachine = new StateMachine(this, AIState.PURSUE);
    this.lastKnownPlayerPos = null;
    this.squadId = null;
    this.setupStateTransitions();

    this.health = profile.health;
    this.dead = false;
    this.deathTimer = 0;
    this.attackTimer = 0;
    this.flinchYaw = 0;
    this.transientTimer = 0;
    this.transientFallback = null;
    this.currentLoop = null;
    this.stuckTimer = 0;
    this.lastFootPosition = new THREE.Vector3(spawnPoint[0], spawnPoint[1], spawnPoint[2]);
    this.velocity = new THREE.Vector3();
    this.correction = new THREE.Vector3();
    this.steerDirection = new THREE.Vector3();
    this.turnCommitSign = 0;
    this.turnCommitTimer = 0;
    this.noProgressTimer = 0;
    this.lastGoalDistance = Number.POSITIVE_INFINITY;
    this.isStairCommit = false;
    this.onFloor = false;
    this.targetDirection = null;
    this.pendingShot = null;
    this.shotEffects = [];
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
    this.shotFlashGeometry = profile.attackType === "ranged"
      ? new THREE.IcosahedronGeometry(0.08, 1)
      : null;
    this.shotAudio = this.createShotAudio();
    this.playLoop(this.profile.animation.idle);
  }

  setupStateTransitions() {
    this.stateMachine.addTransition(AIState.IDLE, AIState.ALERT, (e) => {
      return e.awareness.getAlertLevel() > 0.2;
    });

    this.stateMachine.addTransition(AIState.IDLE, AIState.PURSUE, (e) => {
      return true;
    });

    this.stateMachine.addTransition(AIState.ALERT, AIState.PURSUE, (e) => {
      return true;
    });

    this.stateMachine.addTransition(AIState.ALERT, AIState.IDLE, (e) => {
      return e.stateMachine.timeInCurrentState() > 3 &&
             e.awareness.hasMemoryExpired();
    });

    this.stateMachine.addTransition(AIState.PURSUE, AIState.ATTACK, (e) => {
      const dist = e.distanceToPlayer();
      return dist <= e.profile.attackRange &&
             e.awareness.getAlertLevel() > 0.3;
    });

    this.stateMachine.addTransition(AIState.ATTACK, AIState.PURSUE, (e) => {
      return e.attackTimer > 0 || e.distanceToPlayer() > e.profile.attackRange * 1.2;
    });
  }

  onStateChange(from, to) {
    void from;
    void to;
  }

  distanceToPlayer() {
    if (!this.lastKnownPlayerPos) return Infinity;
    return Math.hypot(
      this.lastKnownPlayerPos.x - this.collider.start.x,
      this.lastKnownPlayerPos.z - this.collider.start.z
    );
  }

  applyDamage(amount) {
    if (this.dead) {
      return { hit: false, killed: false, score: 0 };
    }

    this.health = Math.max(0, this.health - amount);
    this.flinchYaw += (Math.random() - 0.5) * 0.3;
    this.flashHit();
    this.awareness.setAlertLevel(1);

    if (this.health === 0) {
      this.dead = true;
      this.deathTimer = Math.max(0.75, this.getClipDuration(this.profile.animation.death));
      this.group.traverse((child) => {
        child.userData.damageable = null;
      });
      this.playTransient(this.profile.animation.death, this.deathTimer);
      if (this.squadId !== null && this.squadManager) {
        this.squadManager.reassignMember(this, null);
      }
      const drops = [];
      if (this.profile.dropAmmoType) {
        drops.push({
          amount: this.profile.dropAmmoAmount ?? 0,
          pickupType: this.profile.dropAmmoType,
          position: new THREE.Vector3(
            this.collider.start.x,
            this.getFootY() + 0.12,
            this.collider.start.z,
          ),
        });
      }

      const healthConfig = GAME_CONFIG.pickups.health;
      if (
        healthConfig?.modelPath &&
        healthConfig.healAmount > 0 &&
        Math.random() < (healthConfig.dropChance ?? 0)
      ) {
        drops.push({
          amount: healthConfig.healAmount,
          pickupType: "heart",
          position: new THREE.Vector3(
            this.collider.start.x,
            this.getFootY() + 0.12,
            this.collider.start.z,
          ),
        });
      }
      return {
        drops,
        hit: true,
        killed: true,
        score: this.profile.score,
      };
    }

    this.playTransient(this.profile.animation.hit, 0.24, this.profile.animation.idle);
    return { hit: true, killed: false, score: 0 };
  }

  update(deltaTime, playerPosition, collisionWorld) {
    this.mixer.update(deltaTime);
    this.attackTimer = Math.max(0, this.attackTimer - deltaTime);
    this.transientTimer = Math.max(0, this.transientTimer - deltaTime);
    this.flinchYaw = THREE.MathUtils.damp(this.flinchYaw, 0, 10, deltaTime);
    this.turnCommitTimer = Math.max(0, this.turnCommitTimer - deltaTime);
    this.updateShotEffects(deltaTime);

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

    const hasSight = this.hasLineOfSight(playerPosition, collisionWorld);
    this.awareness.update(deltaTime, this, playerPosition, collisionWorld, hasSight);

    this.lastKnownPlayerPos = playerPosition.clone();
    this.awareness.setAlertLevel(1);

    this.stateMachine.update(deltaTime);

    const damage = this.executeStateBehavior(
      deltaTime,
      playerPosition,
      collisionWorld,
      hasSight,
    );

    const planarStep = Math.hypot(
      this.collider.start.x - this.lastFootPosition.x,
      this.collider.start.z - this.lastFootPosition.z,
    );
    const recoveryConfig = GAME_CONFIG.survival.pressureRecovery;
    const distToActualPlayer = Math.hypot(
      playerPosition.x - this.collider.start.x,
      playerPosition.z - this.collider.start.z,
    );
    this.stuckTimer =
      this.targetDirection &&
      distToActualPlayer > this.profile.attackRange &&
      planarStep < recoveryConfig.stuckDistanceEpsilon
        ? this.stuckTimer + deltaTime
        : 0;
    this.lastFootPosition.set(
      this.collider.start.x,
      this.getFootY(),
      this.collider.start.z,
    );

    if (this.stateMachine.isState(AIState.DEAD)) {
      return { damage: 0, removable: this.deathTimer === 0 };
    }

    return { damage, removable: false };
  }

  executeStateBehavior(deltaTime, playerPosition, collisionWorld, hasSight) {
    const state = this.stateMachine.currentState;
    const dist = this.distanceToPlayer();
    const verticalGap = Math.abs(
      playerPosition.y - (this.getFootY() + (this.profile.eyeHeight ?? 1))
    );
    let wantsMove = true;
    let attackNow = false;
    let resolvedDamage = 0;

    if (this.pendingShot) {
      resolvedDamage = this.updatePendingShot(deltaTime, playerPosition, collisionWorld);
      wantsMove = false;
      this.targetDirection = null;
      this.isStairCommit = false;
    }

    switch (state) {
      case AIState.IDLE:
        this.targetDirection = null;
        this.isStairCommit = false;
        if (this.transientTimer === 0) {
          this.playLoop(this.profile.animation.idle);
        }
        break;

      case AIState.ALERT:
        this.isStairCommit = false;
        if (this.awareness.getLastHeardPosition()) {
          this.targetDirection = new THREE.Vector3()
            .subVectors(this.awareness.getLastHeardPosition(), this.collider.start)
            .normalize();
        } else if (this.awareness.getKnownPlayerPosition()) {
          this.targetDirection = new THREE.Vector3()
            .subVectors(this.awareness.getKnownPlayerPosition(), this.collider.start)
            .normalize();
        }
        if (this.transientTimer === 0) {
          this.playLoop(this.profile.animation.idle);
        }
        break;

      case AIState.PURSUE: {
        const stairRouteTarget = this.getStairRouteTarget(playerPosition, verticalGap);
        const pursueTarget = stairRouteTarget ?? playerPosition;
        this.isStairCommit = stairRouteTarget !== null;

        this.targetDirection = new THREE.Vector3()
          .subVectors(pursueTarget, this.collider.start)
          .normalize();
        this.updatePursuitProgress(pursueTarget, this.targetDirection, deltaTime, this.isStairCommit);

        const inAttackRange = dist <= this.profile.attackRange;
        const goodVertical = verticalGap <= (this.profile.attackHeightTolerance ?? 1.8);

        if (
          inAttackRange &&
          goodVertical &&
          this.attackTimer === 0 &&
          !this.pendingShot
        ) {
          if (this.profile.attackType === "ranged") {
            const preferredRange = this.profile.preferredRange ?? this.profile.attackRange * 0.6;
            const retreatRange = this.profile.retreatRange ?? preferredRange * 0.55;
            if (
              hasSight &&
              dist <= preferredRange * 1.2 &&
              dist >= retreatRange * 1.05
            ) {
              attackNow = true;
            }
          } else {
            attackNow = true;
          }
        }
        break;
      }

      case AIState.ATTACK:
        this.targetDirection = null;
        this.isStairCommit = false;
        if (this.distanceToPlayer() > this.profile.attackRange * 1.1) {
          this.stateMachine.setState(AIState.PURSUE);
          return 0;
        }

        if (this.profile.attackType === "ranged") {
          const preferredRange = this.profile.preferredRange ?? this.profile.attackRange * 0.6;
          const retreatRange = this.profile.retreatRange ?? preferredRange * 0.55;
          if (
            this.distanceToPlayer() > preferredRange * 1.2 ||
            this.distanceToPlayer() < retreatRange * 0.95
          ) {
            this.stateMachine.setState(AIState.PURSUE);
            return 0;
          }
        }

        const canAttack =
          verticalGap <= (this.profile.attackHeightTolerance ?? 1.8) &&
          this.attackTimer === 0 &&
          !this.pendingShot &&
          (this.profile.attackType !== "ranged" || hasSight);

        if (canAttack) {
          attackNow = true;
        }
        break;
    }

    if (attackNow) {
      if (this.profile.attackType === "ranged") {
        this.beginRangedAttack(playerPosition);
      } else {
        this.attackTimer = this.profile.attackCooldown;
        this.playTransient(
          this.profile.animation.attack,
          this.getClipDuration(this.profile.animation.attack) || 0.42,
          this.profile.animation.idle,
        );
        this.stateMachine.setState(AIState.ATTACK);
        return this.profile.attackDamage ?? 0;
      }
    }

    if (this.targetDirection && wantsMove) {
      const chosenDirection = this.chooseMoveDirection(
        this.targetDirection,
        collisionWorld,
        deltaTime,
        { stairCommit: this.isStairCommit },
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

      if (dist > 0.0001) {
        this.group.rotation.y = Math.atan2(moveDirection.x, moveDirection.z);
      }
    } else {
      moveDirection.set(0, 0, 0);
      this.steerDirection.set(0, 0, 0);
      this.noProgressTimer = 0;
      this.lastGoalDistance = Number.POSITIVE_INFINITY;
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 14, deltaTime);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 14, deltaTime);
    }

    this.applyVelocity(deltaTime);
    this.resolveCollisions(collisionWorld);

    this.group.position.set(
      this.collider.start.x,
      this.getFootY(),
      this.collider.start.z,
    );
    this.group.rotation.z = this.flinchYaw;

    this.fadeHitFlash();

    if (this.transientTimer === 0 && !attackNow) {
      const shouldMove = this.targetDirection !== null && state !== AIState.RETREAT;
      this.playLoop(shouldMove ? this.profile.animation.move : this.profile.animation.idle);
    }

    return resolvedDamage;
  }

  beginRangedAttack(playerPosition) {
    const windup = this.profile.attackWindup ?? 0.34;
    const clipDuration = this.getClipDuration(this.profile.animation.attack) || windup;
    this.pendingShot = {
      target: playerPosition.clone(),
      timer: windup,
      windup,
    };
    this.playTransient(
      this.profile.animation.attack,
      windup,
      this.profile.animation.idle,
    );
    this.stateMachine.setState(AIState.ATTACK);
    this.transientTimer = Math.max(this.transientTimer, Math.min(windup, clipDuration));
  }

  updatePendingShot(deltaTime, playerPosition, collisionWorld) {
    if (!this.pendingShot) {
      return 0;
    }

    this.pendingShot.timer = Math.max(0, this.pendingShot.timer - deltaTime);
    if (this.pendingShot.timer > 0) {
      return 0;
    }

    return this.resolvePendingShot(playerPosition, collisionWorld);
  }

  resolvePendingShot(playerPosition, collisionWorld) {
    const pendingShot = this.pendingShot;
    this.pendingShot = null;
    this.attackTimer = this.profile.attackCooldown;

    const muzzle = this.getMuzzlePosition();
    const desiredTarget = pendingShot.target.clone();
    let impactPoint = desiredTarget.clone();
    let blocked = false;

    shotProbeOrigin.copy(muzzle);
    shotProbeDirection.subVectors(desiredTarget, shotProbeOrigin);
    const shotDistance = shotProbeDirection.length();
    if (shotDistance > 0.0001) {
      shotProbeDirection.normalize();
      shotProbe.set(shotProbeOrigin, shotProbeDirection);
      shotProbe.far = shotDistance;
      const obstacleHit = shotProbe.intersectObjects(collisionWorld.getShootables(), true)[0];
      if (obstacleHit) {
        impactPoint.copy(obstacleHit.point);
        blocked = true;
      }
    }

    const planarMissDistance = Math.hypot(
      playerPosition.x - desiredTarget.x,
      playerPosition.z - desiredTarget.z,
    );
    const verticalMissDistance = Math.abs(playerPosition.y - desiredTarget.y);
    const hitRadius = this.profile.projectileHitRadius ?? 0.9;
    const hitPlayer =
      !blocked &&
      planarMissDistance <= hitRadius &&
      verticalMissDistance <= (this.profile.attackHeightTolerance ?? 1.8) &&
      this.hasLineOfSight(playerPosition, collisionWorld);

    if (hitPlayer) {
      impactPoint.copy(playerPosition);
    }

    this.spawnShotEffect(muzzle, impactPoint, hitPlayer);
    this.playShotAudio();
    if (!hitPlayer) {
      this.stateMachine.setState(AIState.PURSUE);
      return 0;
    }

    this.stateMachine.setState(AIState.PURSUE);
    return this.profile.attackDamage ?? 0;
  }

  getArenaLevel(y) {
    const stairMidY = 1.35;
    const upperThreshold = stairMidY + 0.55;
    const lowerThreshold = stairMidY - 0.55;

    if (y >= upperThreshold) {
      return "upper";
    }
    if (y <= lowerThreshold) {
      return "lower";
    }
    return "stairs";
  }

  getStairRouteTarget(playerPosition, verticalGap) {
    const routeNodes = GAME_CONFIG.survival.routeAssist?.nodes ?? [];

    if (routeNodes.length === 0) {
      return null;
    }

    const nodeMap = new Map(routeNodes.map((node) => [node.id, node.position]));
    const stairBottom = nodeMap.get("stair_bottom");
    const stairMid = nodeMap.get("stair_mid");
    const stairTop = nodeMap.get("stair_top");
    const upperMid = nodeMap.get("upper_mid");
    const lowerMid = nodeMap.get("lower_mid");

    if (!stairBottom || !stairMid || !stairTop) {
      return null;
    }

    const currentFootY = this.getFootY();
    const zombieLevel = this.getArenaLevel(currentFootY);
    const playerLevel = this.getArenaLevel(playerPosition.y);

    if (zombieLevel === playerLevel) {
      return null;
    }

    const verticalThreshold =
      GAME_CONFIG.survival.routeAssist?.verticalThreshold ?? 1.35;
    if (
      verticalGap <= verticalThreshold &&
      zombieLevel !== "stairs" &&
      playerLevel !== "stairs"
    ) {
      return null;
    }

    if (playerLevel === "upper") {
      if (zombieLevel === "lower") {
        return new THREE.Vector3(...stairBottom);
      }
      if (zombieLevel === "stairs") {
        if (currentFootY < stairMid[1]) {
          return new THREE.Vector3(...stairMid);
        }
        return new THREE.Vector3(...stairTop);
      }
      if (upperMid && this.collider.start.distanceTo(new THREE.Vector3(...upperMid)) > 2.6) {
        return new THREE.Vector3(...upperMid);
      }
      return null;
    }

    if (playerLevel === "lower") {
      if (zombieLevel === "upper") {
        if (upperMid && this.collider.start.distanceTo(new THREE.Vector3(...upperMid)) > 2.4) {
          return new THREE.Vector3(...upperMid);
        }
        return new THREE.Vector3(...stairTop);
      }
      if (zombieLevel === "stairs") {
        if (currentFootY > stairMid[1]) {
          return new THREE.Vector3(...stairMid);
        }
        return new THREE.Vector3(...stairBottom);
      }
      if (lowerMid && this.collider.start.distanceTo(new THREE.Vector3(...lowerMid)) > 2.4) {
        return new THREE.Vector3(...lowerMid);
      }
      return null;
    }

    return null;
  }

  updatePursuitProgress(targetPosition, targetDirection, deltaTime, stairCommit) {
    progressVector.subVectors(targetPosition, this.collider.start);
    progressVector.y = 0;
    const goalDistance = progressVector.length();

    if (!Number.isFinite(this.lastGoalDistance)) {
      this.lastGoalDistance = goalDistance;
      return;
    }

    const improved = goalDistance < this.lastGoalDistance - 0.08;
    this.noProgressTimer = improved ? 0 : this.noProgressTimer + deltaTime;
    this.lastGoalDistance = goalDistance;

    if (this.noProgressTimer < (stairCommit ? 0.28 : 0.6) || this.turnCommitTimer > 0) {
      return;
    }

    const currentTurn =
      this.steerDirection.lengthSq() > 0.001
        ? Math.sign(targetDirection.x * this.steerDirection.z - targetDirection.z * this.steerDirection.x)
        : 0;
    this.turnCommitSign = currentTurn || (Math.random() < 0.5 ? -1 : 1);
    this.turnCommitTimer = stairCommit ? 0.9 : 0.65;
    this.noProgressTimer = 0;
  }

  applyVelocity(deltaTime) {
    let damping = Math.exp(-GAME_CONFIG.player.floorDamping * deltaTime) - 1;

    if (!this.onFloor) {
      this.velocity.y -= GAME_CONFIG.simulation.gravity * deltaTime;
      damping *= GAME_CONFIG.player.airDampingFactor;
    }

    this.velocity.addScaledVector(this.velocity, damping);
    this.collider.translate(this.correction.copy(this.velocity).multiplyScalar(deltaTime));
  }

  chooseMoveDirection(targetDirection, collisionWorld, deltaTime, options = {}) {
    if (targetDirection.lengthSq() === 0) {
      return new THREE.Vector3();
    }

    const stairCommit = options.stairCommit ?? false;
    const seek = targetDirection.clone().normalize();
    const probeCount = stairCommit ? 5 : 7;
    const spreadAngle = stairCommit ? Math.PI * 0.28 : Math.PI * 0.5;
    const rayLength = stairCommit ? 2 : 2.5;
    const probeOrigin = this.collider.start.clone();
    probeOrigin.y = this.getFootY() + this.profile.eyeHeight * 0.75;

    const steerResult = new THREE.Vector3();
    const steerForce = new THREE.Vector3();
    const probeHits = [];
    let leftPenalty = 0;
    let rightPenalty = 0;

    for (let i = 0; i < probeCount; i++) {
      const angle = -spreadAngle / 2 + (spreadAngle / (probeCount - 1)) * i;
      const steerProbeDir = new THREE.Vector3().copy(seek).applyAxisAngle(UP, angle);

      const steerProbeOrigin = probeOrigin.clone();
      const ray = new THREE.Raycaster(steerProbeOrigin, steerProbeDir, 0.05, rayLength);
      const hits = ray.intersectObjects(collisionWorld.getShootables(), true);

      if (hits.length > 0) {
        const hit = hits[0];
        const penetration = rayLength - hit.distance;
        if (penetration > 0) {
          const side = Math.sign(steerProbeDir.x * seek.z - steerProbeDir.z * seek.x);
          if (side < 0) {
            leftPenalty += penetration;
          } else if (side > 0) {
            rightPenalty += penetration;
          }
          probeHits.push({ penetration, dir: steerProbeDir.clone(), side });
        }
      }
    }

    const desiredDirection = new THREE.Vector3();
    if (probeHits.length === 0) {
      desiredDirection.copy(seek);
    } else {
      for (const hit of probeHits) {
        const weight = hit.penetration * 3;
        steerForce.add(hit.dir.clone().multiplyScalar(-weight));
      }

      const perpendicular = new THREE.Vector3().crossVectors(UP, seek).normalize();
      for (const hit of probeHits) {
        const lateral = hit.side || Math.sign(hit.dir.dot(perpendicular));
        steerForce.add(perpendicular.clone().multiplyScalar(lateral * hit.penetration * 1.5));
      }

      const shouldChooseSide = stairCommit || this.turnCommitTimer > 0 || this.stuckTimer > 0.25;
      if (shouldChooseSide) {
        if (this.turnCommitTimer === 0) {
          if (Math.abs(leftPenalty - rightPenalty) > 0.08) {
            this.turnCommitSign = leftPenalty < rightPenalty ? -1 : 1;
          } else if (this.turnCommitSign === 0) {
            this.turnCommitSign = Math.random() < 0.5 ? -1 : 1;
          }
          this.turnCommitTimer = stairCommit ? 0.45 : 0.3;
        }

        const commitStrength = stairCommit ? 1.2 : 0.7;
        steerForce.addScaledVector(perpendicular, this.turnCommitSign * commitStrength);
      }

      steerResult.copy(seek).add(steerForce);
      if (steerResult.lengthSq() < 0.001) {
        desiredDirection.copy(seek);
      } else {
        desiredDirection.copy(steerResult.normalize());
      }

      if (stairCommit) {
        desiredDirection.lerp(seek, 0.42).normalize();
      }
    }

    if (this.steerDirection.lengthSq() === 0) {
      this.steerDirection.copy(desiredDirection);
      return desiredDirection;
    }

    const steerBlend = 1 - Math.exp(-10 * deltaTime);
    this.steerDirection.lerp(desiredDirection, steerBlend);
    if (this.steerDirection.lengthSq() < 0.001) {
      this.steerDirection.copy(desiredDirection);
    } else {
      this.steerDirection.normalize();
    }
    return this.steerDirection.clone();
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

  getMuzzlePosition() {
    muzzleForward.set(0, 0, 1).applyAxisAngle(UP, this.group.rotation.y).normalize();
    return new THREE.Vector3(
      this.collider.start.x,
      this.getFootY() + (this.profile.eyeHeight ?? 1) * 0.92,
      this.collider.start.z,
    ).addScaledVector(muzzleForward, this.profile.radius + 0.24);
  }

  createShotAudio() {
    const shotPath = this.profile.sounds?.shoot;
    if (!shotPath) {
      return null;
    }

    const audio = new Audio(shotPath);
    audio.preload = "auto";
    audio.volume = 0.32;
    return audio;
  }

  playShotAudio() {
    if (!this.shotAudio) {
      return;
    }

    this.shotAudio.pause();
    this.shotAudio.currentTime = 0;
    this.shotAudio.playbackRate = 0.96 + Math.random() * 0.08;
    this.shotAudio.play().catch(() => {});
  }

  spawnShotEffect(origin, target, hitPlayer) {
    const color = this.profile.shotVisualColor ?? 0xff9f70;
    const duration = this.profile.shotVisualDuration ?? 0.09;

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([origin, target]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    this.scene.add(line);

    let flash = null;
    if (this.shotFlashGeometry) {
      flash = new THREE.Mesh(
        this.shotFlashGeometry,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: hitPlayer ? 1 : 0.82,
        }),
      );
      flash.position.copy(origin);
      flash.scale.setScalar(hitPlayer ? 1.15 : 0.95);
      this.scene.add(flash);
    }

    this.shotEffects.push({
      age: 0,
      duration,
      flash,
      line,
      lineMaterial,
    });
  }

  updateShotEffects(deltaTime) {
    for (let index = this.shotEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.shotEffects[index];
      effect.age += deltaTime;
      const alpha = Math.max(0, 1 - effect.age / effect.duration);
      effect.lineMaterial.opacity = alpha;

      if (effect.flash) {
        effect.flash.material.opacity = alpha;
        effect.flash.scale.multiplyScalar(1 + deltaTime * 2.5);
      }

      if (effect.age < effect.duration) {
        continue;
      }

      this.scene.remove(effect.line);
      effect.line.geometry.dispose();
      effect.lineMaterial.dispose();

      if (effect.flash) {
        this.scene.remove(effect.flash);
        effect.flash.material.dispose();
      }

      this.shotEffects.splice(index, 1);
    }
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

  needsPressureRecovery(playerPosition) {
    if (this.dead || !playerPosition) {
      return false;
    }

    const recovery = GAME_CONFIG.survival.pressureRecovery;
    const planarDistance = Math.hypot(
      playerPosition.x - this.collider.start.x,
      playerPosition.z - this.collider.start.z,
    );

    if (this.getFootY() < GAME_CONFIG.player.oobY) {
      return true;
    }

    if (planarDistance > recovery.maxPlayerDistance) {
      return true;
    }

    if (
      planarDistance > recovery.stuckRecoveryDistance &&
      this.stuckTimer >= recovery.stuckTimeout
    ) {
      return true;
    }

    return false;
  }

  relocate(position) {
    if (!position || this.dead) {
      return;
    }

    const [x, y, z] = position;
    const startY = y + this.profile.radius;
    const endY = startY + this.segmentHeight;

    this.collider.start.set(x, startY, z);
    this.collider.end.set(x, endY, z);
    this.group.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.correction.set(0, 0, 0);
    this.steerDirection.set(0, 0, 0);
    this.turnCommitSign = 0;
    this.turnCommitTimer = 0;
    this.noProgressTimer = 0;
    this.lastGoalDistance = Number.POSITIVE_INFINITY;
    this.isStairCommit = false;
    this.targetDirection = null;
    this.stuckTimer = 0;
    this.lastFootPosition.set(x, y, z);
  }

  dispose() {
    if (this.pendingShot) {
      this.pendingShot = null;
    }

    for (const effect of this.shotEffects) {
      this.scene.remove(effect.line);
      effect.line.geometry.dispose();
      effect.lineMaterial.dispose();

      if (effect.flash) {
        this.scene.remove(effect.flash);
        effect.flash.material.dispose();
      }
    }
    this.shotEffects = [];
    this.shotFlashGeometry?.dispose();
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
    this.squadManager = new SquadManager();
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
    this.squadManager = new SquadManager();
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

    this.squadManager.update(deltaTime, playerPosition);

    for (let index = this.zombies.length - 1; index >= 0; index -= 1) {
      const zombie = this.zombies[index];
      const result = zombie.update(deltaTime, playerPosition, this.collisionWorld);
      damageToPlayer += result.damage;

      if (zombie.needsPressureRecovery?.(playerPosition)) {
        zombie.relocate?.(this.findRecoveryPoint(playerPosition, zombie.profile));
      }

      if (!result.removable) {
        continue;
      }

      zombie.dispose();
      this.zombies.splice(index, 1);
    }

    this.squadManager.cleanupEmptySquads();

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
    const zombie = new Zombie(this.scene, profile, spawnPoint, archetype, this.squadManager);
    this.zombies.push(zombie);

    if (this.wave >= 2) {
      const squad = this.squadManager.createSquad();
      squad.addMember(zombie);
    }
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

  findRecoveryPoint(playerPosition, profile) {
    const minDistance = GAME_CONFIG.survival.pressureRecovery.minSpawnDistance;
    const candidates = [];

    for (const node of GAME_CONFIG.survival.routeAssist?.nodes ?? []) {
      const planarDistance = Math.hypot(
        playerPosition.x - node.position[0],
        playerPosition.z - node.position[2],
      );

      if (planarDistance < minDistance) {
        continue;
      }

      candidates.push(node.position);
    }

    for (const point of GAME_CONFIG.survival.spawnPoints) {
      const planarDistance = Math.hypot(
        playerPosition.x - point[0],
        playerPosition.z - point[2],
      );

      if (planarDistance < minDistance) {
        continue;
      }

      candidates.push(point);
    }

    const fallback = candidates[0] ?? [playerPosition.x, playerPosition.y, playerPosition.z - 10];
    let bestPoint = fallback;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const point of candidates) {
      const score =
        Math.abs(point[1] - playerPosition.y) * 3 +
        Math.hypot(playerPosition.x - point[0], playerPosition.z - point[2]);

      if (score < bestScore) {
        bestScore = score;
        bestPoint = point;
      }
    }

    return this.resolveSpawnPoint(bestPoint, profile);
  }
}
