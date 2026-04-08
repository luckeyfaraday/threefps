import { GAME_CONFIG } from "../core/config.js";
import { WEAPON_ORDER } from "./weaponData.js";
import { fireHitscanWithRange } from "./hitscan.js";

export class WeaponManager {
  constructor({
    ammoPickups,
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
    this.ammoPickups = ammoPickups;
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
    this.runStats = this.createRunStats();

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
    this.runStats = this.createRunStats();
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

    if (this.currentWeapon.usesAmmo !== false && this.ammoInMag <= 0) {
      this.startReload();
      return;
    }

    if (this.currentWeapon.usesAmmo !== false) {
      this.ammoInMag -= 1;
    }
    this.recordShot(this.currentWeapon.id);
    this.cooldown = this.currentWeapon.fireInterval;
    this.fireFeedback = 1;
    this.viewModel.playShoot(this.currentWeapon.viewModel.shootAnimationDuration);
    if (this.currentWeapon.audio?.shootRate != null) {
      this.audio.playShoot(this.currentWeapon.audio.shootRate);
    }
    this.cameraRig.applyRecoil({
      pitch: this.currentWeapon.recoil.pitchStep,
      yaw: (Math.random() - 0.5) * this.currentWeapon.recoil.yawJitter * 2,
    });

    const result = fireHitscanWithRange(this.camera, [
      ...this.targets.getShootables(),
      ...this.world.getShootables(),
    ], this.currentWeapon.range ?? GAME_CONFIG.weapon.range);

    if (result.hit) {
      const damageResult = result.damageable
        ? result.damageable.applyDamage(this.currentWeapon.damage)
        : null;

      if (damageResult?.killed && this.targets.registerKill) {
        this.targets.registerKill(damageResult.score);
      }

      if (damageResult?.hit) {
        this.recordHit(this.currentWeapon.id, damageResult.killed === true);
      }

      const drops = damageResult?.drops ?? (damageResult?.drop ? [damageResult.drop] : []);
      for (const drop of drops) {
        this.ammoPickups?.spawn(
          drop.pickupType ?? drop.ammoType,
          drop.amount,
          drop.position,
        );
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

    if (
      this.currentWeapon.usesAmmo !== false &&
      this.ammoInMag === 0 &&
      this.reserveAmmo > 0
    ) {
      this.startReload();
      return;
    }

    this.syncHud();
  }

  startReload() {
    if (this.isReloading) {
      return;
    }

    if (this.currentWeapon.usesAmmo === false) {
      this.syncHud();
      return;
    }

    if (this.ammoInMag === this.currentWeapon.magSize || this.reserveAmmo <= 0) {
      this.syncHud();
      return;
    }

    this.isReloading = true;
    this.reloadTimer = this.viewModel.playReload(this.currentWeapon.reloadDuration);
    if (this.currentWeapon.audio?.reloadRate != null) {
      this.audio.playReload(this.currentWeapon.audio.reloadRate);
    }
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
    const usesAmmo = this.currentWeapon.usesAmmo !== false;
    this.hud.setAmmo(
      usesAmmo ? this.ammoInMag : null,
      usesAmmo ? this.reserveAmmo : null,
      state,
      this.currentWeapon.label,
    );
    this.hud.setWeaponSlot(this.currentWeapon.slot);
  }

  getPresentationState() {
    return {
      firing: this.fireFeedback,
      reloading: this.isReloading,
      ...this.currentWeapon.ui.crosshair,
    };
  }

  getRunSummary() {
    const totalShots = this.runStats.shots;
    const totalHits = this.runStats.hits;
    const bestWeaponStats =
      this.runStats.byWeapon.reduce((best, weaponStats) => {
        if (!best) {
          return weaponStats;
        }

        if (weaponStats.kills !== best.kills) {
          return weaponStats.kills > best.kills ? weaponStats : best;
        }

        if (weaponStats.hits !== best.hits) {
          return weaponStats.hits > best.hits ? weaponStats : best;
        }

        if (weaponStats.shots !== best.shots) {
          return weaponStats.shots > best.shots ? weaponStats : best;
        }

        return best;
      }, null) ?? this.runStats.byWeapon[0];

    return {
      accuracy: totalShots > 0 ? (totalHits / totalShots) * 100 : 0,
      bestWeapon: bestWeaponStats?.label ?? this.currentWeapon.label,
      hits: totalHits,
      kills: this.runStats.kills,
      shots: totalShots,
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

  addAmmoByType(ammoType, amount) {
    if (!ammoType || amount <= 0) {
      return false;
    }

    const compatibleWeapons = this.weapons.filter(
      (weapon) => weapon.ammoType === ammoType && weapon.usesAmmo !== false,
    );
    if (compatibleWeapons.length === 0) {
      return false;
    }

    const baseShare = Math.floor(amount / compatibleWeapons.length);
    let remainder = amount % compatibleWeapons.length;
    let added = 0;

    for (let index = 0; index < compatibleWeapons.length; index += 1) {
      const share = baseShare + (remainder > 0 ? 1 : 0);
      if (remainder > 0) {
        remainder -= 1;
      }
      if (share <= 0) {
        continue;
      }
      compatibleWeapons[index].state.reserveAmmo += share;
      added += share;
    }

    if (added === 0) {
      return false;
    }

    this.syncHud();
    return true;
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

  createRunStats() {
    return {
      hits: 0,
      kills: 0,
      shots: 0,
      byWeapon: WEAPON_ORDER.map((weapon) => ({
        id: weapon.id,
        label: weapon.label,
        hits: 0,
        kills: 0,
        shots: 0,
      })),
    };
  }

  recordShot(weaponId) {
    this.runStats.shots += 1;
    const weaponStats = this.runStats.byWeapon.find((weapon) => weapon.id === weaponId);
    if (weaponStats) {
      weaponStats.shots += 1;
    }
  }

  recordHit(weaponId, killed = false) {
    this.runStats.hits += 1;
    const weaponStats = this.runStats.byWeapon.find((weapon) => weapon.id === weaponId);
    if (!weaponStats) {
      return;
    }

    weaponStats.hits += 1;
    if (killed) {
      this.runStats.kills += 1;
      weaponStats.kills += 1;
    }
  }
}
