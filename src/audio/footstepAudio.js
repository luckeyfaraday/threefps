export class FootstepAudio {
  constructor() {
    this.footstep = new Audio("./assets/sounds/footstep.mp3");
    this.footstep.preload = "auto";
    this.footstep.volume = 0.28;
    this.lastStepTime = 0;
    this.cycle = 0;
  }

  update(deltaTime, movementState) {
    if (!movementState.onFloor || movementState.normalizedSpeed < 0.1) {
      this.lastStepTime = 0;
      return;
    }

    const interval = 0.315 / movementState.normalizedSpeed;
    this.lastStepTime += deltaTime;

    if (this.lastStepTime >= interval) {
      this.lastStepTime = 0;
      this.cycle = 1 - this.cycle;
      this.play(this.cycle);
    }
  }

  play(foot) {
    this.footstep.pause();
    this.footstep.currentTime = 0;
    this.footstep.playbackRate = 0.92 + foot * 0.12;
    this.footstep.play().catch(() => {});
  }
}