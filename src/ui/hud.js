export class Hud {
  constructor(documentRef) {
    this.documentRef = documentRef;
    this.root = documentRef.getElementById("hud");
    this.status = documentRef.getElementById("hud-status");
    this.button = documentRef.getElementById("lock-button");
    this.deathButton = documentRef.getElementById("death-restart-button");
    this.weaponLabel = documentRef.getElementById("ammo-weapon");
    this.ammoCurrent = documentRef.getElementById("ammo-current");
    this.ammoReserve = documentRef.getElementById("ammo-reserve");
    this.ammoState = documentRef.getElementById("ammo-state");
    this.waveValue = documentRef.getElementById("survival-wave");
    this.healthValue = documentRef.getElementById("survival-health");
    this.killsValue = documentRef.getElementById("survival-kills");
    this.aliveValue = documentRef.getElementById("survival-alive");
    this.survivalStatus = documentRef.getElementById("survival-status");
    this.damageVignette = documentRef.getElementById("damage-vignette");
    this.deathOverlay = documentRef.getElementById("death-overlay");
    this.deathSummary = documentRef.getElementById("death-overlay-summary");
    this.deathWave = documentRef.getElementById("death-wave");
    this.deathKills = documentRef.getElementById("death-kills");
    this.deathAccuracy = documentRef.getElementById("death-accuracy");
    this.deathBestWeapon = documentRef.getElementById("death-best-weapon");
    this.crosshair = documentRef.querySelector(".crosshair");
    this.hitMarker = documentRef.getElementById("hit-marker");
    this.mobileControls = documentRef.getElementById("mobile-controls");
    this.movePad = documentRef.getElementById("move-pad");
    this.moveStick = documentRef.getElementById("move-stick");
    this.lookPad = documentRef.getElementById("look-pad");
    this.mobileFire = documentRef.getElementById("mobile-fire");
    this.mobileJump = documentRef.getElementById("mobile-jump");
    this.mobileReload = documentRef.getElementById("mobile-reload");
    this.mobileWeaponButtons = Array.from(
      documentRef.querySelectorAll(".mobile-weapon"),
    );
    this.hitMarkerTimeout = null;
    this.crosshairScale = 1;
    this.damageFlash = 0;
    this.mobileMode = false;
  }

  bindStart(handler) {
    this.button.addEventListener("click", handler);
    this.deathButton?.addEventListener("click", handler);
  }

  setStatus(message) {
    this.status.textContent = message;
  }

  setReady() {
    this.button.disabled = false;
    this.button.textContent = this.mobileMode ? "Tap To Start" : "Start Run";
    this.setStatus("Wave sim loaded. Start the run when you're ready.");
    this.setAmmo(0, 0, "", "Weapon");
    this.clearGameOverState();
    if (this.deathButton) {
      this.deathButton.textContent = this.mobileMode ? "Tap To Restart" : "Play Again";
    }
    this.setSurvival({
      alive: 0,
      health: 100,
      kills: 0,
      status: "Prepare",
      wave: 0,
    });
  }

  setLocked(locked) {
    this.root.classList.toggle("is-locked", locked);
    this.button.hidden = locked;
    this.setStatus(
      locked
        ? this.mobileMode
          ? "Touch controls active. Survive the wave."
          : "Pointer lock active. Survive the wave."
        : this.mobileMode
          ? "Tap start to resume the run."
          : "Pointer released. Click to re-enter the run.",
    );
  }

  setError(message) {
    this.root.classList.add("is-error");
    this.button.disabled = true;
    this.setStatus(message);
  }

  setGameOver() {
    this.button.hidden = false;
    this.button.disabled = false;
    this.button.textContent = this.mobileMode ? "Tap To Restart" : "Restart Run";
    if (this.deathButton) {
      this.deathButton.disabled = false;
      this.deathButton.textContent = this.mobileMode ? "Tap To Restart" : "Play Again";
    }
    this.setStatus("You were overrun. Restart the run.");
    this.deathOverlay.classList.add("is-visible");
    this.damageVignette.classList.add("is-dead");
  }

  clearGameOverState() {
    this.deathOverlay.classList.remove("is-visible");
    this.damageVignette.classList.remove("is-dead");
  }

  setGameOverSummary({
    accuracy = 0,
    bestWeapon = "Weapon",
    kills = 0,
    wave = 0,
  } = {}) {
    this.deathSummary.textContent = `Made it to wave ${wave} with ${kills} kills.`;
    this.deathWave.textContent = String(wave);
    this.deathKills.textContent = String(kills);
    this.deathAccuracy.textContent = `${Math.round(accuracy)}%`;
    this.deathBestWeapon.textContent = bestWeapon;
  }

  setMobileMode(enabled) {
    this.mobileMode = enabled;
    this.root.classList.toggle("is-mobile", enabled);
    this.mobileControls?.setAttribute("aria-hidden", enabled ? "false" : "true");
    this.button.textContent = enabled ? "Tap To Start" : "Enter Simulation";
  }

  getMobileControls() {
    return {
      fire: this.mobileFire,
      jump: this.mobileJump,
      lookPad: this.lookPad,
      movePad: this.movePad,
      moveStick: this.moveStick,
      reload: this.mobileReload,
      weaponButtons: this.mobileWeaponButtons,
    };
  }

  setAmmo(current, reserve, state = "", weaponLabel = "Weapon") {
    this.weaponLabel.textContent = weaponLabel;
    this.ammoCurrent.textContent =
      current == null ? "--" : String(current).padStart(2, "0");
    this.ammoReserve.textContent =
      reserve == null ? "--" : String(reserve).padStart(2, "0");
    this.ammoState.textContent = state;
  }

  setWeaponSlot(slotCode) {
    this.mobileWeaponButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.weaponSlot === slotCode);
    });
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

  setSurvival({ alive, health, kills, status, wave }) {
    this.waveValue.textContent = String(wave);
    this.healthValue.textContent = String(health);
    this.killsValue.textContent = String(kills);
    this.aliveValue.textContent = String(alive);
    this.survivalStatus.textContent = status;
  }

  pulseDamage(intensity = 0.2) {
    this.damageFlash = Math.min(1, this.damageFlash + intensity);
  }

  update(deltaTime) {
    this.damageFlash = Math.max(0, this.damageFlash - deltaTime * 1.8);
    this.damageVignette.style.setProperty(
      "--damage-opacity",
      this.damageFlash.toFixed(3),
    );
  }

  updateCrosshair(
    {
      movement = 0,
      firing = 0,
      reloading = false,
      moveSpread = 0.5,
      fireSpread = 0.4,
      reloadSpread = 0.9,
      smoothing = 14,
    } = {},
    deltaTime,
  ) {
    const targetScale =
      1 +
      movement * moveSpread +
      firing * fireSpread +
      (reloading ? reloadSpread : 0);
    const smoothingFactor = 1 - Math.exp(-smoothing * deltaTime);
    this.crosshairScale +=
      (targetScale - this.crosshairScale) * smoothingFactor;
    this.crosshair.style.setProperty(
      "--crosshair-scale",
      this.crosshairScale.toFixed(3),
    );
    this.crosshair.classList.toggle("is-reloading", reloading);
  }
}
