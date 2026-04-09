import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();

function configureTexture(texture, { repeatX = 1, repeatY = 1, color = false } = {}) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  if (color) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function loadTexture(path, options) {
  return configureTexture(textureLoader.load(path), options);
}

function makeCanvasTexture(draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  draw(context, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  return configureTexture(texture, { color: true, repeatX, repeatY });
}

function createHazardTexture() {
  return makeCanvasTexture((ctx, width, height) => {
    ctx.fillStyle = "#1f2529";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#f2b95d";
    for (let x = -width; x < width; x += 28) {
      ctx.fillRect(x, -height, 14, height * 2);
    }
    ctx.restore();
  }, 2, 1);
}

function createTrimTexture() {
  return makeCanvasTexture((ctx, width, height) => {
    ctx.fillStyle = "#0f2028";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(117, 183, 214, 0.18)";
    ctx.fillRect(0, height * 0.22, width, height * 0.08);
    ctx.fillRect(0, height * 0.7, width, height * 0.06);
  }, 6, 1);
}

export function createArenaMaterials() {
  const floorMap = loadTexture(
    "./assets/painted_concrete_02_4k.blend/textures/painted_concrete_02_diff_4k.jpg",
    { color: true, repeatX: 5, repeatY: 5 },
  );
  const wallMap = loadTexture(
    "./assets/painted_plaster_wall_4k.blend/textures/painted_plaster_wall_diff_4k.jpg",
    { color: true, repeatX: 4, repeatY: 2 },
  );
  const metalMap = loadTexture(
    "./assets/rusty_metal_04_4k.blend/textures/rusty_metal_04_diff_4k.jpg",
    { color: true, repeatX: 2.5, repeatY: 2.5 },
  );
  const hazardMap = createHazardTexture();
  const trimMap = createTrimTexture();

  return {
    floor: new THREE.MeshStandardMaterial({
      color: 0xe2e6e8,
      map: floorMap,
      metalness: 0.04,
      roughness: 0.92,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0xd7dde0,
      map: wallMap,
      metalness: 0.02,
      roughness: 0.95,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x8b7b72,
      map: metalMap,
      metalness: 0.18,
      roughness: 0.78,
    }),
    hazard: new THREE.MeshStandardMaterial({
      color: 0xf0cb77,
      map: hazardMap,
      metalness: 0.08,
      roughness: 0.72,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: 0x264454,
      map: trimMap,
      metalness: 0.22,
      roughness: 0.62,
    }),
  };
}
