import { GAME_CONFIG } from "../core/config.js";

export class WeaponAudio {
  constructor() {
    this.shoot = new Audio(GAME_CONFIG.weapon.sounds.shoot);
    this.reload = new Audio(GAME_CONFIG.weapon.sounds.reload);

    this.shoot.preload = "auto";
    this.reload.preload = "auto";
    this.shoot.volume = 0.35;
    this.reload.volume = 0.42;
  }

  playShoot(playbackRate = 1) {
    this.play(this.shoot, playbackRate);
  }

  playReload(playbackRate = 1) {
    this.play(this.reload, playbackRate);
  }

  play(audio, playbackRate) {
    audio.pause();
    audio.currentTime = 0;
    audio.playbackRate = playbackRate;
    audio.play().catch(() => {});
  }
}
