import * as THREE from "three";

export class InputController {
  constructor(lockElement) {
    this.lockElement = lockElement;
    this.keys = Object.create(null);
    this.buttons = Object.create(null);
    this.pressed = new Set();
    this.lookDelta = new THREE.Vector2();
    this.moveAxes = new THREE.Vector2();
    this.mobileLookSensitivity = 0.028;
    this.pointerLockHandler = null;
    this.pointerLocked = false;
    this.mobileMode =
      window.matchMedia?.("(pointer: coarse)")?.matches === true ||
      (navigator.maxTouchPoints ?? 0) > 0;
    this.touchControls = null;
    this.movePointerId = null;
    this.lookPointerId = null;
    this.moveCenter = new THREE.Vector2();
    this.moveTouch = new THREE.Vector2();
    this.lookLast = new THREE.Vector2();
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
    if (this.mobileMode) {
      this.setLocked(true);
      return;
    }

    this.lockElement.requestPointerLock();
  }

  isLocked() {
    return this.pointerLocked;
  }

  isMobile() {
    return this.mobileMode;
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

  getMoveAxes(target) {
    const x =
      (this.keys.KeyD ? 1 : 0) -
      (this.keys.KeyA ? 1 : 0) +
      this.moveAxes.x;
    const y =
      (this.keys.KeyW ? 1 : 0) -
      (this.keys.KeyS ? 1 : 0) +
      this.moveAxes.y;

    target.set(
      THREE.MathUtils.clamp(x, -1, 1),
      THREE.MathUtils.clamp(y, -1, 1),
    );

    if (target.lengthSq() > 1) {
      target.normalize();
    }

    return target;
  }

  bindTouchControls(controls) {
    this.touchControls = controls;

    controls.movePad.addEventListener("pointerdown", this.onMovePadDown);
    controls.movePad.addEventListener("pointermove", this.onMovePadMove);
    controls.movePad.addEventListener("pointerup", this.onMovePadUp);
    controls.movePad.addEventListener("pointercancel", this.onMovePadUp);

    controls.lookPad.addEventListener("pointerdown", this.onLookPadDown);
    controls.lookPad.addEventListener("pointermove", this.onLookPadMove);
    controls.lookPad.addEventListener("pointerup", this.onLookPadUp);
    controls.lookPad.addEventListener("pointercancel", this.onLookPadUp);

    controls.fire.addEventListener("pointerdown", this.onActionDown("MousePrimary"));
    controls.fire.addEventListener("pointerup", this.onActionUp("MousePrimary"));
    controls.fire.addEventListener("pointercancel", this.onActionUp("MousePrimary"));

    controls.jump.addEventListener("pointerdown", this.onActionDown("Space"));
    controls.jump.addEventListener("pointerup", this.onActionUp("Space"));
    controls.jump.addEventListener("pointercancel", this.onActionUp("Space"));

    controls.reload.addEventListener("pointerdown", this.onTapButton("KeyR"));

    controls.weaponButtons.forEach((button) => {
      const code = button.dataset.weaponSlot;
      button.addEventListener("pointerdown", this.onTapButton(code));
    });
  }

  setLocked(locked) {
    this.pointerLocked = locked;
    this.lookDelta.set(0, 0);
    if (this.pointerLockHandler) {
      this.pointerLockHandler(locked);
    }
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
    this.moveAxes.set(0, 0);
    this.movePointerId = null;
    this.lookPointerId = null;
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

  onMovePadDown = (event) => {
    if (!this.mobileMode || this.movePointerId !== null) {
      return;
    }

    this.setLocked(true);
    this.movePointerId = event.pointerId;
    this.touchControls.movePad.setPointerCapture?.(event.pointerId);
    this.moveCenter.set(event.clientX, event.clientY);
    this.moveTouch.set(event.clientX, event.clientY);
    this.updateMovePad();
  };

  onMovePadMove = (event) => {
    if (event.pointerId !== this.movePointerId) {
      return;
    }

    this.moveTouch.set(event.clientX, event.clientY);
    this.updateMovePad();
  };

  onMovePadUp = (event) => {
    if (event.pointerId !== this.movePointerId) {
      return;
    }

    this.movePointerId = null;
    this.moveAxes.set(0, 0);
    if (this.touchControls?.moveStick) {
      this.touchControls.moveStick.style.setProperty("--stick-x", "0px");
      this.touchControls.moveStick.style.setProperty("--stick-y", "0px");
    }
  };

  updateMovePad() {
    const offsetX = this.moveTouch.x - this.moveCenter.x;
    const offsetY = this.moveTouch.y - this.moveCenter.y;
    const maxRadius = 42;
    const distance = Math.hypot(offsetX, offsetY);
    const scale = distance > maxRadius ? maxRadius / distance : 1;
    const clampedX = offsetX * scale;
    const clampedY = offsetY * scale;

    this.moveAxes.set(
      THREE.MathUtils.clamp(clampedX / maxRadius, -1, 1),
      THREE.MathUtils.clamp(-clampedY / maxRadius, -1, 1),
    );

    if (this.touchControls?.moveStick) {
      this.touchControls.moveStick.style.setProperty("--stick-x", `${clampedX}px`);
      this.touchControls.moveStick.style.setProperty("--stick-y", `${clampedY}px`);
    }
  }

  onLookPadDown = (event) => {
    if (!this.mobileMode || this.lookPointerId !== null) {
      return;
    }

    this.setLocked(true);
    this.lookPointerId = event.pointerId;
    this.touchControls.lookPad.setPointerCapture?.(event.pointerId);
    this.lookLast.set(event.clientX, event.clientY);
  };

  onLookPadMove = (event) => {
    if (event.pointerId !== this.lookPointerId) {
      return;
    }

    const deltaX = event.clientX - this.lookLast.x;
    const deltaY = event.clientY - this.lookLast.y;
    this.lookLast.set(event.clientX, event.clientY);
    this.lookDelta.x += deltaX * this.mobileLookSensitivity;
    this.lookDelta.y += deltaY * this.mobileLookSensitivity;
  };

  onLookPadUp = (event) => {
    if (event.pointerId !== this.lookPointerId) {
      return;
    }

    this.lookPointerId = null;
  };

  onActionDown = (code) => (event) => {
    event.preventDefault();
    this.setLocked(true);
    if (!this.buttons[code]) {
      this.pressed.add(code);
    }
    this.buttons[code] = true;
  };

  onActionUp = (code) => (event) => {
    event.preventDefault();
    this.buttons[code] = false;
  };

  onTapButton = (code) => (event) => {
    event.preventDefault();
    this.setLocked(true);
    this.pressed.add(code);
  };
}
