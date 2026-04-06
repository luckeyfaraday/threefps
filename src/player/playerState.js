import { GAME_CONFIG } from "../core/config.js";

export class PlayerState {
  constructor() {
    this.maxHealth = GAME_CONFIG.player.health.max;
    this.health = this.maxHealth;
    this.dead = false;
  }

  reset() {
    this.health = this.maxHealth;
    this.dead = false;
  }

  applyDamage(amount) {
    if (this.dead) {
      return false;
    }

    this.health = Math.max(0, this.health - amount);
    this.dead = this.health === 0;
    return this.dead;
  }
}
