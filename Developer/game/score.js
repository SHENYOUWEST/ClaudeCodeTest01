window.BH = window.BH || {};

BH.Score = class Score {
  constructor(mode) {
    this.mode = mode || 'easy';
    this.value = 0;
    this.survivalTime = 0;
    this.highScore = parseInt(localStorage.getItem(`bh_${this.mode}`) || '0', 10);
  }

  update(dt, isBerserk, currentHp) {
    this.survivalTime += dt;
    const baseRate = isBerserk ? 30 : 10;
    const multiplier = currentHp >= 8 ? 1.2 : 1.0;
    this.value += baseRate * multiplier * dt;
    this.value = Math.round(this.value * 100) / 100;
  }

  checkHighScore() {
    const current = Math.floor(this.value);
    if (current > this.highScore) {
      this.highScore = current;
      localStorage.setItem(`bh_${this.mode}`, this.highScore.toString());
      return true;
    }
    return false;
  }

  getDisplay() {
    return Math.floor(this.value).toString().padStart(5, '0');
  }

  getTimeDisplay() {
    const m = Math.floor(this.survivalTime / 60);
    const s = Math.floor(this.survivalTime % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  reset() {
    this.value = 0;
    this.survivalTime = 0;
    // highScore intentionally not reset
  }
};
