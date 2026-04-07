import * as THREE from "three";
import { GAME_CONFIG } from "../core/config.js";

const raycaster = new THREE.Raycaster();
const origin = new THREE.Vector3();
const direction = new THREE.Vector3();

function findDamageable(object) {
  let current = object;

  while (current) {
    if (current.userData.damageable) {
      return current.userData.damageable;
    }

    current = current.parent;
  }

  return null;
}

export function fireHitscan(camera, targets) {
  return fireHitscanWithRange(camera, targets, GAME_CONFIG.weapon.range);
}

export function fireHitscanWithRange(camera, targets, range = GAME_CONFIG.weapon.range) {
  camera.getWorldPosition(origin);
  camera.getWorldDirection(direction);

  raycaster.set(origin, direction);
  raycaster.far = range;

  const intersections = raycaster.intersectObjects(targets, true);
  const hit = intersections[0];

  if (!hit) {
    return { hit: false };
  }

  return {
    damageable: findDamageable(hit.object),
    distance: hit.distance,
    hit: true,
    object: hit.object,
    point: hit.point.clone(),
  };
}
