import * as THREE from "three";
import { createArenaMaterials } from "./materials.js";

function createBox(size, material, position, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.fromArray(position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function createCollisionBox(size, position) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshBasicMaterial(),
  );
  mesh.position.fromArray(position);
  mesh.visible = false;
  return mesh;
}

function addStairCollisionRun({ collisionRoot, start, end, width, steps }) {
  const deltaX = (end[0] - start[0]) / steps;
  const deltaY = (end[1] - start[1]) / steps;
  const deltaZ = (end[2] - start[2]) / steps;
  const treadDepth = Math.hypot(deltaX, deltaZ) || 0.8;
  const collisionSteps = steps * 3;
  const collisionDeltaX = (end[0] - start[0]) / collisionSteps;
  const collisionDeltaY = (end[1] - start[1]) / collisionSteps;
  const collisionDeltaZ = (end[2] - start[2]) / collisionSteps;
  const collisionDepth = Math.max(Math.hypot(collisionDeltaX, collisionDeltaZ) + 0.18, treadDepth * 0.5);
  const collisionHeight = Math.max(collisionDeltaY + 0.12, 0.18);

  for (let index = 0; index < collisionSteps; index += 1) {
    const centerX = start[0] + collisionDeltaX * index + collisionDeltaX * 0.5;
    const topY = start[1] + collisionDeltaY * (index + 1);
    const centerY = topY - collisionHeight * 0.5;
    const centerZ = start[2] + collisionDeltaZ * index + collisionDeltaZ * 0.5;
    collisionRoot.add(
      createCollisionBox(
        [width, collisionHeight, collisionDepth],
        [centerX, centerY, centerZ],
      ),
    );
  }
}

function addBox({ visualRoot, collisionRoot, size, material, position, castShadow = true }) {
  visualRoot.add(createBox(size, material, position, castShadow));
  collisionRoot.add(createCollisionBox(size, position));
}

function addStairRun({ visualRoot, collisionRoot, materials, start, end, width, steps }) {
  const deltaX = (end[0] - start[0]) / steps;
  const deltaY = (end[1] - start[1]) / steps;
  const deltaZ = (end[2] - start[2]) / steps;
  const treadDepth = Math.hypot(deltaX, deltaZ) || 0.8;

  for (let index = 0; index < steps; index += 1) {
    const stepHeight = 0.24 + deltaY * 0.4;
    const centerX = start[0] + deltaX * index + deltaX * 0.5;
    const centerY = start[1] + deltaY * index * 0.5 + stepHeight * 0.5;
    const centerZ = start[2] + deltaZ * index + deltaZ * 0.5;
    const mesh = createBox(
      [width, stepHeight + deltaY * index, treadDepth + 0.08],
      materials.hazard,
      [centerX, centerY, centerZ],
      true,
    );
    visualRoot.add(mesh);
  }

  addStairCollisionRun({
    collisionRoot,
    end,
    start,
    steps,
    width: width - 0.2,
  });
}

function addRailingRun({ visualRoot, collisionRoot, start, end, height }) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9d9e0,
    metalness: 0.55,
    roughness: 0.42,
  });

  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, length),
    railMaterial,
  );
  topRail.position.set(
    (start[0] + end[0]) * 0.5,
    height,
    (start[2] + end[2]) * 0.5,
  );
  topRail.rotation.y = angle;
  topRail.castShadow = true;
  topRail.receiveShadow = true;
  visualRoot.add(topRail);

  const posts = 5;
  for (let index = 0; index < posts; index += 1) {
    const t = index / (posts - 1);
    const x = THREE.MathUtils.lerp(start[0], end[0], t);
    const z = THREE.MathUtils.lerp(start[2], end[2], t);
    visualRoot.add(
      createBox([0.12, height - 2.95, 0.12], railMaterial, [x, (height + 2.95) * 0.5, z]),
    );
  }

  collisionRoot.add(createCollisionBox([0.28, 0.9, length], [
    (start[0] + end[0]) * 0.5,
    3.35,
    (start[2] + end[2]) * 0.5,
  ]));
  collisionRoot.children[collisionRoot.children.length - 1].rotation.y = angle;
}

function addTrimStrip({ visualRoot, start, end, y, material }) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, length), material);
  mesh.position.set((start[0] + end[0]) * 0.5, y, (start[2] + end[2]) * 0.5);
  mesh.rotation.y = angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  visualRoot.add(mesh);
}

export function buildContainmentArena() {
  const visualRoot = new THREE.Group();
  visualRoot.name = "ContainmentArena";
  const collisionRoot = new THREE.Group();
  collisionRoot.name = "ContainmentArenaCollision";
  const materials = createArenaMaterials();

  addBox({
    visualRoot,
    collisionRoot,
    material: materials.floor,
    position: [0, -0.3, -8],
    size: [28, 0.6, 26],
  });

  addBox({
    visualRoot,
    collisionRoot,
    material: materials.floor,
    position: [0, 2.5, -15.6],
    size: [18, 0.5, 8.6],
  });

  addStairRun({
    collisionRoot,
    end: [0, 2.8, -12.8],
    materials,
    start: [0, 0, -8.4],
    steps: 8,
    visualRoot,
    width: 4.6,
  });

  addBox({
    visualRoot,
    collisionRoot,
    material: materials.floor,
    position: [0, 2.5, -12.05],
    size: [5.2, 0.5, 1.6],
  });

  const lowerWalls = [
    { position: [0, 2.2, 5.1], size: [28, 4.4, 0.8] },
    { position: [-14.2, 2.2, -8], size: [0.8, 4.4, 26] },
    { position: [14.2, 2.2, -8], size: [0.8, 4.4, 26] },
    { position: [0, 2.2, -21.1], size: [28, 4.4, 0.8] },
  ];
  for (const wall of lowerWalls) {
    addBox({
      castShadow: true,
      collisionRoot,
      material: materials.wall,
      position: wall.position,
      size: wall.size,
      visualRoot,
    });
  }

  const upperWalls = [
    { position: [0, 4.2, -20.2], size: [18, 3.4, 0.7] },
    { position: [-9.2, 4.2, -15.6], size: [0.7, 3.4, 8.6] },
    { position: [9.2, 4.2, -15.6], size: [0.7, 3.4, 8.6] },
  ];
  for (const wall of upperWalls) {
    addBox({
      castShadow: true,
      collisionRoot,
      material: materials.wall,
      position: wall.position,
      size: wall.size,
      visualRoot,
    });
  }

  const coverBlocks = [
    { position: [-6.2, 1.1, -6.8], size: [2.4, 2.2, 1.4], material: materials.metal },
    { position: [6.2, 1.1, -6.8], size: [2.4, 2.2, 1.4], material: materials.metal },
    { position: [-7.6, 1.0, -14.6], size: [2.1, 2.0, 1.2], material: materials.metal },
    { position: [7.6, 1.0, -14.6], size: [2.1, 2.0, 1.2], material: materials.metal },
    { position: [0, 3.55, -16.2], size: [2.8, 1.1, 0.9], material: materials.trim },
  ];
  for (const block of coverBlocks) {
    addBox({
      castShadow: true,
      collisionRoot,
      material: block.material,
      position: block.position,
      size: block.size,
      visualRoot,
    });
  }

  const columns = [
    [-10.2, 1.8, -3.5],
    [10.2, 1.8, -3.5],
    [-10.2, 1.8, -18.1],
    [10.2, 1.8, -18.1],
  ];
  for (const [x, y, z] of columns) {
    addBox({
      castShadow: true,
      collisionRoot,
      material: materials.trim,
      position: [x, y, z],
      size: [0.9, 3.6, 0.9],
      visualRoot,
    });
  }

  addRailingRun({
    collisionRoot,
    end: [-9, 0, -12.4],
    start: [-2.5, 0, -12.4],
    visualRoot,
    height: 3.55,
  });
  addRailingRun({
    collisionRoot,
    end: [9, 0, -12.4],
    start: [2.5, 0, -12.4],
    visualRoot,
    height: 3.55,
  });

  addTrimStrip({
    end: [13.6, 0, 4.7],
    material: materials.trim,
    start: [-13.6, 0, 4.7],
    visualRoot,
    y: 1.02,
  });
  addTrimStrip({
    end: [13.6, 0, -20.7],
    material: materials.trim,
    start: [-13.6, 0, -20.7],
    visualRoot,
    y: 1.02,
  });

  const accentLightPositions = [
    [-11.8, 3.8, 4.2],
    [11.8, 3.8, 4.2],
    [-7.8, 5.1, -19.2],
    [7.8, 5.1, -19.2],
  ];
  for (const position of accentLightPositions) {
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.12, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x90d9ff,
        emissive: 0x3a92c5,
        emissiveIntensity: 0.9,
        metalness: 0.25,
        roughness: 0.36,
      }),
    );
    accent.position.fromArray(position);
    visualRoot.add(accent);
  }

  visualRoot.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
  });
  collisionRoot.updateMatrixWorld(true);

  const shootables = [];
  visualRoot.traverse((child) => {
    if (child.isMesh) {
      shootables.push(child);
    }
  });

  return {
    collisionRoot,
    shootables,
    visualRoot,
  };
}
