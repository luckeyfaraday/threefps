export class Hud {
  constructor(documentRef) {
    this.documentRef = documentRef;
    this.root = documentRef.getElementById("hud");
    this.status = documentRef.getElementById("hud-status");
    this.button = documentRef.getElementById("lock-button");
    this.weaponLabel = documentRef.getElementById("ammo-weapon");
    this.ammoCurrent = documentRef.getElementById("ammo-current");
    this.ammoReserve = documentRef.getElementById("ammo-reserve");
    this.ammoState = documentRef.getElementById("ammo-state");
    this.crosshair = documentRef.querySelector(".crosshair");
    this.hitMarker = documentRef.getElementById("hit-marker");
    this.hitMarkerTimeout = null;
    this.crosshairScale = 1;
  }

  bindStart(handler) {
    this.button.addEventListener("click", handler);
  }

  setStatus(message) {
    this.status.textContent = message;
  }

  setReady() {
    this.button.disabled = false;
    this.button.textContent = "Enter Simulation";
    this.setStatus("Movement loop loaded. Click to capture the mouse.");
    this.setAmmo(0, 0, "", "Weapon");
  }

  setLocked(locked) {
    this.root.classList.toggle("is-locked", locked);
    this.button.hidden = locked;
    this.setStatus(
      locked
        ? "Pointer lock active. Move, jump, and test collision feel."
        : "Pointer released. Click to re-enter the simulation.",
    );
  }

  setError(message) {
    this.root.classList.add("is-error");
    this.button.disabled = true;
    this.setStatus(message);
  }

  setAmmo(current, reserve, state = "", weaponLabel = "Weapon") {
    this.weaponLabel.textContent = weaponLabel;
    this.ammoCurrent.textContent = String(current).padStart(2, "0");
    this.ammoReserve.textContent = String(reserve).padStart(2, "0");
    this.ammoState.textContent = state;
  }

  showHitMarker() {
    this.showMarker("is-visible");
  }

  showKillMarker() {
    this.showMarker("is-kill");
  }

  showMarker(className) {
    this.hitMarker.classList.remove("is-kill");
    this.hitMarker.classList.add("is-visible");
    if (className === "is-kill") {
      this.hitMarker.classList.add("is-kill");
    }
    clearTimeout(this.hitMarkerTimeout);
    this.hitMarkerTimeout = setTimeout(() => {
      this.hitMarker.classList.remove("is-kill");
      this.hitMarker.classList.remove("is-visible");
    }, className === "is-kill" ? 140 : 90);
  }

  updateCrosshair({ movement = 0, firing = 0, reloading = false } = {}, deltaTime) {
    const targetScale =
      1 +
      movement * 0.5 +
      firing * 0.4 +
      (reloading ? 0.9 : 0);
    const smoothing = 1 - Math.exp(-14 * deltaTime);
    this.crosshairScale += (targetScale - this.crosshairScale) * smoothing;
    this.crosshair.style.setProperty(
      "--crosshair-scale",
      this.crosshairScale.toFixed(3),
    );
    this.crosshair.classList.toggle("is-reloading", reloading);
  }
}
