import * as THREE from "three";
import { GAME_CONFIG } from "../core/config.js";

export class ImpactEffects {
  constructor(scene) {
    this.scene = scene;
    this.effects = [];
    this.flashGeometry = new THREE.IcosahedronGeometry(1, 1);
    this.shardGeometry = new THREE.BoxGeometry(0.08, 0.03, 0.03);
  }

  spawn(point, { kill = false, target = false } = {}) {
    const scale = kill
      ? GAME_CONFIG.fx.killImpactScale
      : GAME_CONFIG.fx.impactScale;
    const color = kill
      ? 0xff335f
      : target
        ? 0xffc857
        : 0xcde9ff;

    const flash = new THREE.Mesh(
      this.flashGeometry,
      new THREE.MeshBasicMaterial({ color }),
    );
    flash.position.copy(point);
    flash.scale.setScalar(scale);
    this.scene.add(flash);

    const shards = [];
    for (let index = 0; index < GAME_CONFIG.fx.shardsPerImpact; index += 1) {
      const shard = new THREE.Mesh(
        this.shardGeometry,
        new THREE.MeshBasicMaterial({ color }),
      );
      shard.position.copy(point);
      shard.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      this.scene.add(shard);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.25) * 1.8,
        (Math.random() - 0.5) * 1.6,
      );

      shards.push({ mesh: shard, velocity });
    }

    this.effects.push({
      age: 0,
      flash,
      lifetime: GAME_CONFIG.fx.impactLifetime + (kill ? 0.08 : 0),
      shards,
    });
  }

  update(deltaTime) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += deltaTime;
      const alpha = 1 - effect.age / effect.lifetime;

      effect.flash.scale.multiplyScalar(1 + deltaTime * 5);
      effect.flash.material.opacity = alpha;
      effect.flash.material.transparent = true;

      for (const shard of effect.shards) {
        shard.mesh.position.addScaledVector(shard.velocity, deltaTime);
        shard.velocity.y -= deltaTime * 1.8;
        shard.mesh.scale.multiplyScalar(1 - deltaTime * 3.4);
        shard.mesh.material.opacity = alpha;
        shard.mesh.material.transparent = true;
      }

      if (effect.age < effect.lifetime) {
        continue;
      }

      this.scene.remove(effect.flash);
      effect.flash.material.dispose();

      for (const shard of effect.shards) {
        this.scene.remove(shard.mesh);
        shard.mesh.material.dispose();
      }

      this.effects.splice(index, 1);
    }
  }
}
