import * as THREE from "three";
import { GAME_CONFIG } from "../core/config.js";

export function createSceneKit(mount) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(GAME_CONFIG.world.background);
  scene.fog = new THREE.Fog(
    GAME_CONFIG.world.background,
    GAME_CONFIG.world.fogNear,
    GAME_CONFIG.world.fogFar,
  );

  const camera = new THREE.PerspectiveCamera(
    GAME_CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    GAME_CONFIG.camera.near,
    GAME_CONFIG.camera.far,
  );
  camera.rotation.order = "YXZ";
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  mount.appendChild(renderer.domElement);

  const hemisphere = new THREE.HemisphereLight(
    GAME_CONFIG.lighting.hemisphere.skyColor,
    GAME_CONFIG.lighting.hemisphere.groundColor,
    GAME_CONFIG.lighting.hemisphere.intensity,
  );
  hemisphere.position.fromArray(GAME_CONFIG.lighting.hemisphere.position);
  scene.add(hemisphere);

  const directional = new THREE.DirectionalLight(
    GAME_CONFIG.lighting.directional.color,
    GAME_CONFIG.lighting.directional.intensity,
  );
  directional.position.fromArray(GAME_CONFIG.lighting.directional.position);
  directional.castShadow = true;
  directional.shadow.camera.near = 0.01;
  directional.shadow.camera.far = 500;
  directional.shadow.camera.left = -30;
  directional.shadow.camera.right = 30;
  directional.shadow.camera.top = 30;
  directional.shadow.camera.bottom = -30;
  directional.shadow.mapSize.width = 1024;
  directional.shadow.mapSize.height = 1024;
  directional.shadow.radius = 4;
  directional.shadow.bias = -0.00006;
  scene.add(directional);

  return { camera, renderer, scene };
}
