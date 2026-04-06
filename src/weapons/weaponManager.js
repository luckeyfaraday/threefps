import { GAME_CONFIG } from "../core/config.js";
import { fireHitscan } from "./hitscan.js";

export class WeaponManager {
  constructor({
    audio,
    camera,
    cameraRig,
    hud,
    impactEffects,
    input,
    targets,
    viewModel,
    world,
  }) {
    this.audio = audio;
    this.camera = camera;
    this.cameraRig = cameraRig;
    this.hud = hud;
    this.impactEffects = impactEffects;
    this.input = input;
    this.targets = targets;
    this.viewModel = viewModel;
    this.world = world;

    this.ammoInMag = GAME_CONFIG.weapon.magSize;
    this.reserveAmmo = GAME_CONFIG.weapon.reserveAmmo;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.isReloading = false;

    this.syncHud();
  }

  update(deltaTime) {
    this.cooldown = Math.max(0, this.cooldown - deltaTime);

    if (this.isReloading) {
      this.reloadTimer = Math.max(0, this.reloadTimer - deltaTime);

      if (this.reloadTimer === 0) {
        this.finishReload();
      }
    }

    if (this.input.consumePressed("KeyR")) {
      this.startReload();
    }

    if (this.input.isLocked() && this.input.isPressed("MousePrimary")) {
      this.tryFire();
    }
  }

  tryFire() {
    if (this.isReloading || this.cooldown > 0) {
      return;
    }

    if (this.ammoInMag <= 0) {
      this.startReload();
      return;
    }

    this.ammoInMag -= 1;
    this.cooldown = GAME_CONFIG.weapon.fireInterval;
    this.viewModel.playShoot();
    this.audio.playShoot();
    this.cameraRig.applyRecoil({
      pitch: GAME_CONFIG.player.recoil.pitchStep,
      yaw:
        (Math.random() - 0.5) * GAME_CONFIG.player.recoil.yawJitter * 2,
    });

    const result = fireHitscan(this.camera, [
      ...this.targets.getShootables(),
      ...this.world.getShootables(),
    ]);

    if (result.hit) {
      const damageResult = result.damageable
        ? result.damageable.applyDamage(GAME_CONFIG.weapon.damage)
        : null;

      this.impactEffects.spawn(result.point, {
        kill: damageResult?.killed === true,
        target: Boolean(result.damageable),
      });

      if (damageResult?.killed) {
        this.hud.showKillMarker();
      } else if (damageResult?.hit) {
        this.hud.showHitMarker();
      }
    }

    if (this.ammoInMag === 0 && this.reserveAmmo > 0) {
      this.startReload();
      return;
    }

    this.syncHud();
  }

  startReload() {
    if (this.isReloading) {
      return;
    }

    if (this.ammoInMag === GAME_CONFIG.weapon.magSize || this.reserveAmmo <= 0) {
      this.syncHud();
      return;
    }

    this.isReloading = true;
    this.reloadTimer = this.viewModel.playReload();
    this.audio.playReload();
    this.syncHud("reloading");
  }

  finishReload() {
    const missingAmmo = GAME_CONFIG.weapon.magSize - this.ammoInMag;
    const ammoToLoad = Math.min(missingAmmo, this.reserveAmmo);

    this.ammoInMag += ammoToLoad;
    this.reserveAmmo -= ammoToLoad;
    this.isReloading = false;
    this.viewModel.playIdle();
    this.syncHud();
  }

  syncHud(state = "") {
    this.hud.setAmmo(this.ammoInMag, this.reserveAmmo, state);
  }
}
