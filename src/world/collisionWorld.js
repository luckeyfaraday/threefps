import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Octree } from "three/addons/math/Octree.js";

export class CollisionWorld {
  constructor(scene) {
    this.loader = new GLTFLoader();
    this.octree = new Octree();
    this.scene = scene;
    this.shootables = [];
  }

  async load(modelPath) {
    const gltf = await this.loader.loadAsync(modelPath);
    this.scene.add(gltf.scene);
    this.octree.fromGraphNode(gltf.scene);

    gltf.scene.traverse((child) => {
      if (!child.isMesh) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material?.map) {
        child.material.map.anisotropy = 4;
      }

      this.shootables.push(child);
    });
  }

  capsuleIntersect(capsule) {
    return this.octree.capsuleIntersect(capsule);
  }

  getShootables() {
    return this.shootables;
  }
}
