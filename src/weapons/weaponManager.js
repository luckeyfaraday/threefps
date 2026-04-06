import { GAME_CONFIG } from "../core/config.js";
import { WEAPON_ORDER } from "./weaponData.js";
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

    this.weapons = WEAPON_ORDER.map((weapon) => ({
      ...weapon,
      state: {
        ammoInMag: weapon.magSize,
        reserveAmmo: weapon.reserveAmmo,
      },
    }));
    this.currentWeapon = this.weapons[0];
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.isReloading = false;
    this.fireFeedback = 0;

    this.viewModel.setWeaponProfile(this.currentWeapon.viewModel);
    this.cameraRig.setRecoilProfile(this.currentWeapon.recoil);
    this.syncHud();
  }

  resetRun() {
    this.weapons = WEAPON_ORDER.map((weapon) => ({
      ...weapon,
      state: {
        ammoInMag: weapon.magSize,
        reserveAmmo: weapon.reserveAmmo,
      },
    }));
    this.currentWeapon = this.weapons[0];
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.isReloading = false;
    this.fireFeedback = 0;
    this.viewModel.setWeaponProfile(this.currentWeapon.viewModel);
    this.cameraRig.setRecoilProfile(this.currentWeapon.recoil);
    this.viewModel.playIdle();
    this.syncHud();
  }

  update(deltaTime) {
    const crosshairProfile = this.currentWeapon.ui.crosshair;
    this.fireFeedback = Math.max(
      0,
      this.fireFeedback - deltaTime * crosshairProfile.smoothing * 0.55,
    );
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

    for (const weapon of this.weapons) {
      if (this.input.consumePressed(weapon.slot)) {
        this.switchWeapon(weapon.id);
      }
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
    this.cooldown = this.currentWeapon.fireInterval;
    this.fireFeedback = 1;
    this.viewModel.playShoot(this.currentWeapon.viewModel.shootAnimationDuration);
    this.audio.playShoot(this.currentWeapon.audio.shootRate);
    this.cameraRig.applyRecoil({
      pitch: this.currentWeapon.recoil.pitchStep,
      yaw: (Math.random() - 0.5) * this.currentWeapon.recoil.yawJitter * 2,
    });

    const result = fireHitscan(this.camera, [
      ...this.targets.getShootables(),
      ...this.world.getShootables(),
    ]);

    if (result.hit) {
      const damageResult = result.damageable
        ? result.damageable.applyDamage(this.currentWeapon.damage)
        : null;

      if (damageResult?.killed && this.targets.registerKill) {
        this.targets.registerKill(damageResult.score);
      }

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

    if (this.ammoInMag === this.currentWeapon.magSize || this.reserveAmmo <= 0) {
      this.syncHud();
      return;
    }

    this.isReloading = true;
    this.reloadTimer = this.viewModel.playReload(this.currentWeapon.reloadDuration);
    this.audio.playReload(this.currentWeapon.audio.reloadRate);
    this.syncHud("reloading");
  }

  finishReload() {
    const missingAmmo = this.currentWeapon.magSize - this.ammoInMag;
    const ammoToLoad = Math.min(missingAmmo, this.reserveAmmo);

    this.ammoInMag += ammoToLoad;
    this.reserveAmmo -= ammoToLoad;
    this.isReloading = false;
    this.viewModel.playIdle();
    this.syncHud();
  }

  syncHud(state = "") {
    this.hud.setAmmo(
      this.ammoInMag,
      this.reserveAmmo,
      state,
      this.currentWeapon.label,
    );
  }

  getPresentationState() {
    return {
      firing: this.fireFeedback,
      reloading: this.isReloading,
      ...this.currentWeapon.ui.crosshair,
    };
  }

  switchWeapon(weaponId) {
    const nextWeapon = this.weapons.find((weapon) => weapon.id === weaponId);

    if (!nextWeapon || nextWeapon.id === this.currentWeapon.id) {
      return;
    }

    this.currentWeapon = nextWeapon;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.cooldown = Math.min(this.cooldown, this.currentWeapon.fireInterval);
    this.viewModel.setWeaponProfile(this.currentWeapon.viewModel);
    this.cameraRig.setRecoilProfile(this.currentWeapon.recoil);
    this.viewModel.playIdle();
    this.syncHud();
  }

  get ammoInMag() {
    return this.currentWeapon.state.ammoInMag;
  }

  set ammoInMag(value) {
    this.currentWeapon.state.ammoInMag = value;
  }

  get reserveAmmo() {
    return this.currentWeapon.state.reserveAmmo;
  }

  set reserveAmmo(value) {
    this.currentWeapon.state.reserveAmmo = value;
  }
}
