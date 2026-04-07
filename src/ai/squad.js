import * as THREE from "three";

export class Squad {
  constructor(squadId) {
    this.id = squadId;
    this.members = [];
    this.target = null;
    this.formation = 'spread';
    this.coordinated = false;
    this.lastCoordinationTime = 0;
    this.coordinationInterval = 2;
  }

  addMember(entity) {
    if (!this.members.includes(entity)) {
      this.members.push(entity);
      entity.squadId = this.id;
    }
  }

  removeMember(entity) {
    const index = this.members.indexOf(entity);
    if (index > -1) {
      this.members.splice(index, 1);
      entity.squadId = null;
    }
  }

  setTarget(targetPos) {
    this.target = targetPos.clone();
    this.coordinated = false;
  }

  getLivingMembers() {
    return this.members.filter(m => !m.dead);
  }

  update(deltaTime, playerPosition) {
    this.lastCoordinationTime += deltaTime;

    if (this.lastCoordinationTime >= this.coordinationInterval) {
      this.lastCoordinationTime = 0;
      this.coordinated = false;
    }

    this.target = playerPosition.clone();
  }

  getFlankAssignments(entity) {
    const living = this.getLivingMembers();
    if (living.length < 2) return null;

    const memberIndex = living.indexOf(entity);
    if (memberIndex === -1) return null;

    const flankAngles = [
      -Math.PI / 3,
      Math.PI / 3,
      -Math.PI / 2.5,
      Math.PI / 2.5,
      -Math.PI / 2,
      Math.PI / 2
    ];

    const angleIndex = memberIndex % flankAngles.length;
    return flankAngles[angleIndex];
  }

  getSeparationVector(entity, separationRadius = 3) {
    const separation = new THREE.Vector3();
    const living = this.getLivingMembers();

    for (const other of living) {
      if (other === entity || other.dead) continue;

      const diff = new THREE.Vector3().subVectors(
        entity.collider.start,
        other.collider.start
      );
      diff.y = 0;
      const dist = diff.length();

      if (dist < separationRadius && dist > 0.001) {
        separation.add(diff.normalize().multiplyScalar(separationRadius / dist));
      }
    }

    return separation;
  }

  hasLineOfSightBetween(from, to, collisionWorld) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const distance = direction.length();
    direction.normalize();

    const ray = new THREE.Raycaster(from, direction, 0.1, distance - 0.5);
    const hits = ray.intersectObjects(collisionWorld.getShootables(), true);
    return hits.length === 0;
  }
}

export class SquadManager {
  constructor() {
    this.squads = new Map();
    this.nextSquadId = 0;
  }

  createSquad() {
    const squad = new Squad(this.nextSquadId++);
    this.squads.set(squad.id, squad);
    return squad;
  }

  getSquad(id) {
    return this.squads.get(id);
  }

  disbandSquad(squadId) {
    const squad = this.squads.get(squadId);
    if (squad) {
      for (const member of squad.getLivingMembers()) {
        member.squadId = null;
      }
      this.squads.delete(squadId);
    }
  }

  reassignMember(entity, newSquadId) {
    if (entity.squadId !== null) {
      const oldSquad = this.squads.get(entity.squadId);
      if (oldSquad) {
        oldSquad.removeMember(entity);
        if (oldSquad.getLivingMembers().length === 0) {
          this.disbandSquad(oldSquad.id);
        }
      }
    }

    if (newSquadId === null) return;

    let newSquad = this.squads.get(newSquadId);
    if (!newSquad) {
      newSquad = this.createSquad();
    }
    newSquad.addMember(entity);
  }

  update(deltaTime, playerPosition) {
    for (const squad of this.squads.values()) {
      squad.update(deltaTime, playerPosition);
    }
  }

  getSquadForEntity(entity) {
    if (entity.squadId === null) return null;
    return this.squads.get(entity.squadId);
  }

  cleanupEmptySquads() {
    for (const [id, squad] of this.squads) {
      if (squad.getLivingMembers().length === 0) {
        this.squads.delete(id);
      }
    }
  }
}