window.BH = window.BH || {};

BH.Player = class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.speed = 220;           // px/s, normal mode
    this.berserkSpeed = 352;    // px/s, berserk mode
    this.radius = 12;           // visual radius
    this.hitRadius = 8;         // collision radius (visual × 0.7)
    this.hp = 10;
    this.maxHp = 10;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.invincibleDuration = 1.5; // seconds
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  takeDamage() {
    if (this.invincible) return;
    this.hp = Math.max(0, this.hp - 1);
    this.invincible = true;
    this.invincibleTimer = this.invincibleDuration;
  }

  healAfterBerserk() {
    this.hp = Math.min(this.maxHp, this.hp + 5);
  }

  isDead() {
    return this.hp <= 0;
  }

  update(dt, isBerserk) {
    // Invincibility countdown
    if (this.invincible) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.invincibleTimer = 0;
      }
    }

    // Movement
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const currentSpeed = isBerserk ? this.berserkSpeed : this.speed;
    const step = currentSpeed * dt;

    if (dist > step) {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
    }
  }
};
