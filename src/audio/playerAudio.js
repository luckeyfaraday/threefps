import { GAME_CONFIG } from "../core/config.js";

export class PlayerAudio {
  constructor() {
    this.hurt = new Audio(GAME_CONFIG.player.sounds.hurt);
    this.hurt.preload = "auto";
    this.hurt.volume = 0.42;
  }

  playHurt(playbackRate = 1) {
    this.hurt.pause();
    this.hurt.currentTime = 0;
    this.hurt.playbackRate = playbackRate;
    this.hurt.play().catch(() => {});
  }
}
