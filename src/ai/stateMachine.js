export const AIState = {
  IDLE: 'idle',
  ALERT: 'alert',
  PURSUE: 'pursue',
  ATTACK: 'attack',
  RETREAT: 'retreat',
  DEAD: 'dead'
};

export class StateMachine {
  constructor(entity, initialState = AIState.IDLE) {
    this.entity = entity;
    this.currentState = initialState;
    this.previousState = null;
    this.stateTime = 0;
    this.transitions = new Map();
  }

  addTransition(from, to, condition) {
    if (!this.transitions.has(from)) {
      this.transitions.set(from, []);
    }
    this.transitions.get(from).push({ to, condition });
  }

  update(deltaTime) {
    this.stateTime += deltaTime;

    const possibleTransitions = this.transitions.get(this.currentState) || [];
    for (const transition of possibleTransitions) {
      if (transition.condition(this.entity)) {
        this.setState(transition.to);
        break;
      }
    }
  }

  setState(newState) {
    if (newState === this.currentState) return;

    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateTime = 0;
    this.entity.onStateChange?.(this.previousState, newState);
  }

  isState(state) {
    return this.currentState === state;
  }

  wasInState(state) {
    return this.previousState === state;
  }

  timeInCurrentState() {
    return this.stateTime;
  }
}