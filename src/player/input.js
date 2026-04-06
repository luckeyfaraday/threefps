import * as THREE from "three";

export class InputController {
  constructor(lockElement) {
    this.lockElement = lockElement;
    this.keys = Object.create(null);
    this.buttons = Object.create(null);
    this.pressed = new Set();
    this.lookDelta = new THREE.Vector2();
    this.pointerLockHandler = null;
    this.pointerLocked = false;
  }

  attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  setPointerLockHandler(handler) {
    this.pointerLockHandler = handler;
  }

  requestPointerLock() {
    this.lockElement.requestPointerLock();
  }

  isLocked() {
    return this.pointerLocked;
  }

  isPressed(code) {
    return this.keys[code] === true || this.buttons[code] === true;
  }

  consumePressed(code) {
    const hasValue = this.pressed.has(code);
    this.pressed.delete(code);
    return hasValue;
  }

  consumeLookDelta(target) {
    target.copy(this.lookDelta);
    this.lookDelta.set(0, 0);
    return target;
  }

  onKeyDown = (event) => {
    if (!this.keys[event.code]) {
      this.pressed.add(event.code);
    }
    this.keys[event.code] = true;
  };

  onKeyUp = (event) => {
    this.keys[event.code] = false;
  };

  onBlur = () => {
    this.keys = Object.create(null);
    this.buttons = Object.create(null);
    this.pressed.clear();
    this.lookDelta.set(0, 0);
  };

  onMouseDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    if (!this.buttons.MousePrimary) {
      this.pressed.add("MousePrimary");
    }

    this.buttons.MousePrimary = true;
  };

  onMouseUp = (event) => {
    if (event.button === 0) {
      this.buttons.MousePrimary = false;
    }
  };

  onMouseMove = (event) => {
    if (!this.pointerLocked) {
      return;
    }

    this.lookDelta.x += event.movementX;
    this.lookDelta.y += event.movementY;
  };

  onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.lockElement;
    this.lookDelta.set(0, 0);

    if (this.pointerLockHandler) {
      this.pointerLockHandler(this.pointerLocked);
    }
  };
}
