window.BH = window.BH || {};

BH.BULLET_DEFS = {
  dot:      { color: '#FFD600', radius: 5,  baseSpeed: 270, shape: 'circle' },
  line:     { color: '#E83020', width: 32, height: 3, baseSpeed: 210, shape: 'rect' },
  rect:     { color: '#1E3FA0', width: 14, height: 14, baseSpeed: 120, shape: 'rect' },
  triangle: { color: '#F5F0E8', stroke: '#E83020', size: 14, baseSpeed: 240, shape: 'triangle' }
};

BH.Bullet = class Bullet {
  constructor(opts) {
    this.type = opts.type;
    this.x = opts.x;
    this.y = opts.y;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.alive = true;

    const def = BH.BULLET_DEFS[this.type];
    this.color = def.color;
    this.stroke = def.stroke || null;
    this.shape = def.shape;
    this.radius = def.radius || 0;
    this.width = def.width || 0;
    this.height = def.height || 0;
    this.size = def.size || 0;
    this.trail = []; // last 5 positions for motion trail
  }

  get hitRadius() {
    if (this.shape === 'circle') return this.radius;
    if (this.shape === 'rect') return Math.max(this.width, this.height) / 2;
    if (this.shape === 'triangle') return this.size / 2;
    return 5;
  }

  update(dt, speedMultiplier) {
    // Record position for trail (keep last 5)
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x += this.vx * speedMultiplier * dt;
    this.y += this.vy * speedMultiplier * dt;
  }
};

BH.BulletPool = class BulletPool {
  constructor() {
    this.active = [];
    this.margin = 100;
  }

  spawn(opts) {
    this.active.push(new BH.Bullet(opts));
  }

  update(dt, speedMultiplier) {
    for (const b of this.active) {
      b.update(dt, speedMultiplier);
    }
    this.active = this.active.filter(b => {
      return b.x > -this.margin && b.x < window.innerWidth + this.margin
          && b.y > -this.margin && b.y < window.innerHeight + this.margin;
    });
  }

  clear() {
    this.active = [];
  }
};
