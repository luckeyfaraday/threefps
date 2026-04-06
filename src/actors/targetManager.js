import * as THREE from "three";
import { GAME_CONFIG } from "../core/config.js";

class Target {
  constructor(mesh) {
    this.mesh = mesh;
    this.maxHealth = GAME_CONFIG.targets.maxHealth;
    this.health = this.maxHealth;
    this.respawnTimer = 0;
    this.baseY = mesh.position.y;
    this.flinchRotation = 0;
    this.flinchScale = 0;

    mesh.userData.damageable = this;
  }

  applyDamage(amount) {
    if (this.respawnTimer > 0) {
      return { hit: false, killed: false };
    }

    this.health = Math.max(0, this.health - amount);
    this.mesh.material.emissive.setHex(0xffffff);
    this.mesh.material.color.setHex(0xffd166);
    this.flinchRotation += (Math.random() - 0.5) * GAME_CONFIG.targets.flinch.tiltKick * 2;
    this.flinchScale = Math.max(
      this.flinchScale,
      GAME_CONFIG.targets.flinch.scaleKick,
    );

    if (this.health === 0) {
      this.mesh.visible = false;
      this.mesh.layers.disable(0);
      this.respawnTimer = GAME_CONFIG.targets.respawnDelay;
      return { hit: true, killed: true };
    }

    return { hit: true, killed: false };
  }

  update(deltaTime) {
    this.mesh.material.emissive.lerp(new THREE.Color(0x000000), 0.18);
    this.mesh.material.color.lerp(new THREE.Color(0xff6b4a), 0.12);
    this.flinchRotation = THREE.MathUtils.damp(
      this.flinchRotation,
      0,
      GAME_CONFIG.targets.flinch.recovery,
      deltaTime,
    );
    this.flinchScale = THREE.MathUtils.damp(
      this.flinchScale,
      0,
      GAME_CONFIG.targets.flinch.recovery,
      deltaTime,
    );

    if (this.respawnTimer > 0) {
      this.respawnTimer = Math.max(0, this.respawnTimer - deltaTime);

      if (this.respawnTimer === 0) {
        this.health = this.maxHealth;
        this.mesh.visible = true;
        this.mesh.layers.enable(0);
        this.mesh.material.color.setHex(0xff6b4a);
        this.mesh.material.emissive.setHex(0x000000);
      }
    }

    this.mesh.position.y =
      this.baseY + Math.sin(performance.now() * 0.0018 + this.baseY) * 0.05;
    this.mesh.rotation.z = this.flinchRotation;
    this.mesh.scale.set(
      1 + this.flinchScale,
      1 - this.flinchScale * 0.35,
      1 - this.flinchScale * 0.25,
    );
  }
}

export class TargetManager {
  constructor(scene) {
    this.scene = scene;
    this.targets = [];
    this.shootables = [];
  }

  spawnDefaults() {
    const standGeometry = new THREE.CylinderGeometry(0.18, 0.24, 1.2, 8);
    const targetMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b4a,
      emissive: 0x000000,
      roughness: 0.45,
    });
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a6672,
      roughness: 0.9,
    });

    GAME_CONFIG.targets.items.forEach(({ position, size }) => {
      const stand = new THREE.Mesh(standGeometry, standMaterial.clone());
      stand.castShadow = true;
      stand.receiveShadow = true;
      stand.position.set(position[0], 0.6, position[2]);
      this.scene.add(stand);

      const targetMesh = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        targetMaterial.clone(),
      );
      targetMesh.castShadow = true;
      targetMesh.receiveShadow = true;
      targetMesh.position.set(...position);
      this.scene.add(targetMesh);

      const target = new Target(targetMesh);
      this.targets.push(target);
      this.shootables.push(targetMesh);
    });
  }

  getShootables() {
    return this.shootables;
  }

  update(deltaTime) {
    for (const target of this.targets) {
      target.update(deltaTime);
    }
  }
}
