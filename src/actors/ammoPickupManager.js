import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GAME_CONFIG } from "../core/config.js";

const box = new THREE.Box3();
const size = new THREE.Vector3();

export class AmmoPickupManager {
  constructor(scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.assets = new Map();
    this.pickups = [];
  }

  async load() {
    const ammoEntries = Object.entries(GAME_CONFIG.pickups.ammo ?? {});
    const healthConfig = GAME_CONFIG.pickups.health;

    await Promise.all(
      [
        ...ammoEntries.map(([ammoType, config]) => ({
          kind: "ammo",
          pickupType: ammoType,
          ...config,
        })),
        ...(healthConfig
          ? [
              {
                kind: "health",
                pickupType: "heart",
                ...healthConfig,
              },
            ]
          : []),
      ].map(async ({ kind, pickupType, ...config }) => {
        const gltf = await this.loader.loadAsync(config.modelPath);
        const model = gltf.scene;
        model.traverse((child) => {
          child.frustumCulled = false;
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        box.setFromObject(model);
        box.getSize(size);
        const maxDimension = Math.max(size.x, size.y, size.z, 0.0001);
        const scale = config.size / maxDimension;

        this.assets.set(pickupType, {
          healAmount: config.healAmount ?? 0,
          kind,
          model,
          scale,
        });
      }),
    );
  }

  resetRun() {
    for (const pickup of this.pickups) {
      this.scene.remove(pickup.root);
    }
    this.pickups = [];
  }

  spawn(pickupType, amount, position) {
    const asset = this.assets.get(pickupType);
    if (!asset || !position || amount <= 0) {
      return;
    }

    const root = asset.model.clone(true);
    root.scale.setScalar(asset.scale);
    root.position.copy(position);
    root.position.x += (Math.random() - 0.5) * 0.45;
    root.position.z += (Math.random() - 0.5) * 0.45;
    root.position.y += 0.12;
    root.rotation.x = Math.PI * 0.5;
    root.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(root);

    this.pickups.push({
      amount,
      kind: asset.kind,
      pickupType,
      baseY: root.position.y,
      root,
      time: Math.random() * Math.PI * 2,
    });
  }

  update(deltaTime, playerPosition, weaponManager, playerState, canCollect = true) {
    const collectionRadiusSq = GAME_CONFIG.pickups.collectionRadius ** 2;

    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      pickup.time += deltaTime;
      pickup.root.rotation.y += GAME_CONFIG.pickups.spinSpeed * deltaTime;
      pickup.root.position.y =
        pickup.baseY +
        Math.sin(pickup.time * GAME_CONFIG.pickups.hoverSpeed) *
          GAME_CONFIG.pickups.hoverHeight;

      if (!canCollect || !playerPosition) {
        continue;
      }

      const distanceSq = playerPosition.distanceToSquared(pickup.root.position);
      if (distanceSq > collectionRadiusSq) {
        continue;
      }

      const pickedUp =
        pickup.kind === "health"
          ? playerState?.heal(pickup.amount)
          : weaponManager.addAmmoByType(pickup.pickupType, pickup.amount);
      if (!pickedUp) {
        continue;
      }

      this.scene.remove(pickup.root);
      this.pickups.splice(index, 1);
    }
  }
}
