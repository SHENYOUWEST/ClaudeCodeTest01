window.BH = window.BH || {};

BH.Phase = class Phase {
  constructor() {
    this.current = 'normal';     // 'normal' | 'berserk'
    this.elapsed = 0;            // seconds into current phase
    this.normalDuration = 30;
    this.berserkDuration = 12;
    this.berserkJustEnded = false;
    this.berserkJustStarted = false;
    this.transitionProgress = 0; // 0-1 for smooth bg color transition
    this.shockwave = 0;          // 0-1 for berserk start shockwave
  }

  get isBerserk() {
    return this.current === 'berserk';
  }

  get bulletSpeedMultiplier() {
    return this.isBerserk ? 1.4 : 1.0;
  }

  update(dt) {
    this.elapsed += dt;
    this.berserkJustEnded = false;
    this.berserkJustStarted = false;

    if (this.current === 'normal' && this.elapsed >= this.normalDuration) {
      this.current = 'berserk';
      this.elapsed -= this.normalDuration;
      this.berserkJustStarted = true;
    } else if (this.current === 'berserk' && this.elapsed >= this.berserkDuration) {
      this.current = 'normal';
      this.elapsed -= this.berserkDuration;
      this.berserkJustEnded = true;
    }

    if (this.berserkJustStarted) {
      this.shockwave = 1;
    }
    this.shockwave = Math.max(0, this.shockwave - dt * 2);

    // Smooth background transition
    const targetTransition = this.isBerserk ? 1 : 0;
    this.transitionProgress += (targetTransition - this.transitionProgress) * dt * 4;
  }

  reset() {
    this.current = 'normal';
    this.elapsed = 0;
    this.berserkJustEnded = false;
    this.berserkJustStarted = false;
    this.transitionProgress = 0;
    this.shockwave = 0;
  }
};
