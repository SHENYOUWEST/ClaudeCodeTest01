# Bauhaus Bullet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based Bauhaus-style bullet-hell game where the player clicks to move a circle, dodging geometric bullet patterns synced to pre-composed synthesizer music, with a 30s-normal / 12s-berserk rhythm cycle.

**Architecture:** Pure HTML5 Canvas + vanilla JS with global namespace (`window.BH`). Each module attaches its exports to `BH.*`. A central `requestAnimationFrame` loop in `main.js` orchestrates phase timing, bullet spawning from pre-composed timelines, audio playback via Tone.js Transport, collision detection, and Canvas rendering. No ES modules (file:// compatibility). No build tools.

**Tech Stack:** HTML5 Canvas 2D, vanilla JavaScript, Tone.js (CDN), no frameworks

**Spec:** `docs/superpowers/specs/2026-03-24-bauhaus-bullet-game-design.md`

---

## File Structure

```
game/
├── index.html       # Entry point: Canvas element, script tags (Tone.js CDN + all game JS), CSS
├── player.js        # BH.Player class — position, velocity, HP, invincibility, click-to-move
├── phase.js         # BH.Phase class — 30s/12s cycle state machine, elapsed timers, speed multipliers
├── score.js         # BH.Score class — per-second accumulation, berserk bonus, HP multiplier
├── bullets.js       # BH.Bullet class + BH.BulletPool — 4 types, movement, off-screen cleanup
├── collision.js     # BH.Collision — circle-circle and circle-rect hit tests
├── patterns.js      # BH.PATTERNS — three movements' bullet timeline arrays (ms-keyed events)
├── audio.js         # BH.Audio class — Tone.js synths for 3 movements, Transport scheduling
├── renderer.js      # BH.Renderer class — draws background, grid, bullets, player, HUD, game-over
├── main.js          # BH.Game class — init, requestAnimationFrame loop, restart, wires all modules
└── tests/
    └── test.html    # Browser test runner for pure-logic modules (player, phase, score, collision)
```

**Script load order in index.html:** player.js → phase.js → score.js → bullets.js → collision.js → patterns.js → audio.js → renderer.js → main.js (each file assumes prior scripts have run).

---

### Task 1: Project Scaffold

**Files:**
- Create: `game/index.html`
- Create: `game/main.js`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>Bauhaus Bullet</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a1a; overflow: hidden; cursor: crosshair; }
  canvas { display: block; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<script src="https://cdn.jsdelivr.net/npm/tone@15/build/Tone.min.js"></script>
<script src="player.js"></script>
<script src="phase.js"></script>
<script src="score.js"></script>
<script src="bullets.js"></script>
<script src="collision.js"></script>
<script src="patterns.js"></script>
<script src="audio.js"></script>
<script src="renderer.js"></script>
<script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create main.js with minimal game shell**

```js
window.BH = window.BH || {};

BH.Game = {
  canvas: null,
  ctx: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  loop() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    requestAnimationFrame(() => this.loop());
  }
};

document.addEventListener('DOMContentLoaded', () => BH.Game.init());
```

- [ ] **Step 3: Open in browser, verify black canvas fills window**

Run: open `game/index.html` in browser (or `python3 -m http.server 8000` in `game/` directory for local server).
Expected: Full-screen black canvas with crosshair cursor.

- [ ] **Step 4: Commit**

```bash
git init
git add game/index.html game/main.js
git commit -m "feat: project scaffold — canvas, game shell, script loading"
```

---

### Task 2: Player Module

**Files:**
- Create: `game/player.js`
- Create: `game/tests/test.html`

- [ ] **Step 1: Create test harness and player tests**

```html
<!-- game/tests/test.html -->
<!DOCTYPE html>
<html>
<head><title>BH Tests</title>
<style>
  body { font-family: monospace; background: #111; color: #eee; padding: 20px; }
  .pass { color: #4f4; } .fail { color: #f44; }
</style>
</head>
<body>
<h2>Bauhaus Bullet — Tests</h2>
<pre id="log"></pre>
<script>
window.BH = window.BH || {};
let passed = 0, failed = 0;
function assert(desc, condition) {
  const el = document.getElementById('log');
  if (condition) { passed++; el.innerHTML += `<span class="pass">✓ ${desc}</span>\n`; }
  else { failed++; el.innerHTML += `<span class="fail">✗ ${desc}</span>\n`; }
}
function summary() {
  const el = document.getElementById('log');
  el.innerHTML += `\n${passed} passed, ${failed} failed\n`;
}
</script>
<script src="../player.js"></script>
<script>
// Player tests
const p = new BH.Player(400, 300);

assert('initial HP is 4', p.hp === 4);
assert('initial position', p.x === 400 && p.y === 300);
assert('not invincible initially', p.invincible === false);

p.setTarget(500, 300);
assert('target set', p.targetX === 500 && p.targetY === 300);

p.takeDamage();
assert('HP after damage is 3', p.hp === 3);
assert('invincible after damage', p.invincible === true);

p.invincible = true;
p.takeDamage();
assert('no damage while invincible', p.hp === 3);

p.hp = 1;
p.resetHpAfterBerserk();
assert('HP resets to 2 after berserk', p.hp === 2);

p.hp = 3;
p.resetHpAfterBerserk();
assert('HP resets to 2 even if higher', p.hp === 2);

p.hp = 0;
assert('isDead when HP is 0', p.isDead());

summary();
</script>
</body>
</html>
```

- [ ] **Step 2: Open test.html — verify all tests FAIL** (BH.Player not defined yet)

- [ ] **Step 3: Implement player.js**

```js
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
    this.hp = 4;
    this.maxHp = 4;
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

  resetHpAfterBerserk() {
    this.hp = Math.floor(this.maxHp / 2); // always set to 2
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
```

- [ ] **Step 4: Open test.html — verify all tests PASS**

Expected: 8 passed, 0 failed

- [ ] **Step 5: Wire player into main.js — click to move**

Update `main.js` — add player creation and click listener:
```js
// Inside BH.Game:
init() {
  this.canvas = document.getElementById('game');
  this.ctx = this.canvas.getContext('2d');
  this.resize();
  window.addEventListener('resize', () => this.resize());

  this.player = new BH.Player(this.canvas.width / 2, this.canvas.height / 2);
  this.canvas.addEventListener('click', (e) => {
    this.player.setTarget(e.clientX, e.clientY);
  });

  this.lastTime = performance.now();
  this.loop();
},

loop() {
  const now = performance.now();
  const dt = (now - this.lastTime) / 1000;
  this.lastTime = now;

  this.player.update(dt, false);

  const ctx = this.ctx;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  // Draw player
  ctx.beginPath();
  ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#F5F0E8';
  ctx.fill();

  requestAnimationFrame(() => this.loop());
}
```

- [ ] **Step 6: Open index.html — verify white circle moves to click position**

- [ ] **Step 7: Commit**

```bash
git add game/player.js game/main.js game/tests/test.html
git commit -m "feat: player module — HP, click-to-move, invincibility, tests"
```

---

### Task 3: Phase Module

**Files:**
- Create: `game/phase.js`
- Modify: `game/tests/test.html` — add phase tests

- [ ] **Step 1: Add phase tests to test.html**

Add before `</body>`:
```html
<script src="../phase.js"></script>
<script>
// Phase tests
const ph = new BH.Phase();

assert('starts in normal phase', ph.current === 'normal');
assert('normal duration is 30', ph.normalDuration === 30);
assert('berserk duration is 12', ph.berserkDuration === 12);

ph.elapsed = 30;
ph.update(0.1);
assert('switches to berserk at 30s', ph.current === 'berserk');
assert('elapsed resets on switch', ph.elapsed < 1);

ph.elapsed = 12;
ph.update(0.1);
assert('switches back to normal at 12s', ph.current === 'normal');
assert('berserkJustEnded flag set', ph.berserkJustEnded === true);

ph.update(0.1);
assert('berserkJustEnded cleared next frame', ph.berserkJustEnded === false);

summary();
</script>
```

- [ ] **Step 2: Open test.html — verify new tests FAIL**

- [ ] **Step 3: Implement phase.js**

```js
window.BH = window.BH || {};

BH.Phase = class Phase {
  constructor() {
    this.current = 'normal';     // 'normal' | 'berserk'
    this.elapsed = 0;            // seconds into current phase
    this.normalDuration = 30;
    this.berserkDuration = 12;
    this.berserkJustEnded = false;
    this.berserkJustStarted = false;
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
  }

  reset() {
    this.current = 'normal';
    this.elapsed = 0;
    this.berserkJustEnded = false;
    this.berserkJustStarted = false;
  }
};
```

- [ ] **Step 4: Open test.html — verify all tests PASS**

- [ ] **Step 5: Commit**

```bash
git add game/phase.js game/tests/test.html
git commit -m "feat: phase module — 30s/12s cycle, transition flags, tests"
```

---

### Task 4: Score Module

**Files:**
- Create: `game/score.js`
- Modify: `game/tests/test.html` — add score tests

- [ ] **Step 1: Add score tests to test.html**

```html
<script src="../score.js"></script>
<script>
// Score tests
const sc = new BH.Score();

sc.update(1.0, false, 4);
assert('normal 1s = 10 pts', sc.value === 10);

sc.update(1.0, true, 4);
assert('berserk 1s full HP = 36 pts (30×1.2)', sc.value === 46);

sc.update(1.0, true, 3);
assert('berserk 1s non-full HP = 30 pts', sc.value === 76);

sc.update(1.0, false, 4);
assert('normal 1s full HP = 12 pts (10×1.2)', sc.value === 88);

sc.reset();
assert('reset to 0', sc.value === 0);

summary();
</script>
```

- [ ] **Step 2: Open test.html — verify new tests FAIL**

- [ ] **Step 3: Implement score.js**

```js
window.BH = window.BH || {};

BH.Score = class Score {
  constructor() {
    this.value = 0;
    this.survivalTime = 0;
  }

  update(dt, isBerserk, currentHp) {
    this.survivalTime += dt;
    const baseRate = isBerserk ? 30 : 10;
    const multiplier = currentHp >= 4 ? 1.2 : 1.0;
    this.value += baseRate * multiplier * dt;
    this.value = Math.round(this.value * 100) / 100; // avoid float drift
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
  }
};
```

- [ ] **Step 4: Open test.html — verify all tests PASS**

- [ ] **Step 5: Commit**

```bash
git add game/score.js game/tests/test.html
git commit -m "feat: score module — per-second scoring, berserk bonus, HP multiplier, tests"
```

---

### Task 5: Bullet Types & Pool

**Files:**
- Create: `game/bullets.js`

- [ ] **Step 1: Add bullet tests to test.html**

```html
<script src="../bullets.js"></script>
<script>
// Bullet tests
const pool = new BH.BulletPool();

pool.spawn({ type: 'dot', x: 100, y: 0, vx: 0, vy: 180 });
assert('pool has 1 bullet', pool.active.length === 1);

const b = pool.active[0];
assert('bullet type is dot', b.type === 'dot');
assert('bullet color is yellow', b.color === '#FFD600');

pool.update(1.0, 1.0);
assert('bullet moved down by 180px', b.y === 180);

// off-screen cleanup
pool.spawn({ type: 'line', x: -200, y: -200, vx: -100, vy: 0 });
pool.update(1.0, 1.0);
assert('off-screen bullet removed', pool.active.length === 1);

pool.clear();
assert('clear empties pool', pool.active.length === 0);

summary();
</script>
```

- [ ] **Step 2: Open test.html — verify new tests FAIL**

- [ ] **Step 3: Implement bullets.js**

```js
window.BH = window.BH || {};

BH.BULLET_DEFS = {
  dot:      { color: '#FFD600', radius: 5,  baseSpeed: 180, shape: 'circle' },
  line:     { color: '#D40000', width: 32, height: 3, baseSpeed: 140, shape: 'rect' },
  rect:     { color: '#0048A0', width: 14, height: 14, baseSpeed: 80, shape: 'rect' },
  triangle: { color: '#F5F0E8', stroke: '#D40000', size: 14, baseSpeed: 160, shape: 'triangle' }
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
  }

  // Collision radius for hit testing (all bullets use a bounding circle)
  get hitRadius() {
    if (this.shape === 'circle') return this.radius;
    if (this.shape === 'rect') return Math.max(this.width, this.height) / 2;
    if (this.shape === 'triangle') return this.size / 2;
    return 5;
  }

  update(dt, speedMultiplier) {
    this.x += this.vx * speedMultiplier * dt;
    this.y += this.vy * speedMultiplier * dt;
  }
};

BH.BulletPool = class BulletPool {
  constructor() {
    this.active = [];
    this.margin = 100; // off-screen buffer before removal
  }

  spawn(opts) {
    this.active.push(new BH.Bullet(opts));
  }

  update(dt, speedMultiplier) {
    for (const b of this.active) {
      b.update(dt, speedMultiplier);
    }
    // Remove off-screen bullets
    this.active = this.active.filter(b => {
      return b.x > -this.margin && b.x < window.innerWidth + this.margin
          && b.y > -this.margin && b.y < window.innerHeight + this.margin;
    });
  }

  clear() {
    this.active = [];
  }
};
```

- [ ] **Step 4: Open test.html — verify all tests PASS**

- [ ] **Step 5: Commit**

```bash
git add game/bullets.js game/tests/test.html
git commit -m "feat: bullet types & pool — 4 types, movement, off-screen cleanup, tests"
```

---

### Task 6: Collision Detection

**Files:**
- Create: `game/collision.js`

- [ ] **Step 1: Add collision tests to test.html**

```html
<script src="../collision.js"></script>
<script>
// Collision tests
assert('circles overlap', BH.Collision.circleCircle(0, 0, 8, 10, 0, 5));
assert('circles apart', !BH.Collision.circleCircle(0, 0, 8, 100, 0, 5));
assert('circles touching edge', BH.Collision.circleCircle(0, 0, 5, 10, 0, 5));

// Player vs bullet
const fakeBullet = { x: 10, y: 0, hitRadius: 5 };
assert('player-bullet hit', BH.Collision.playerVsBullet(0, 0, 8, fakeBullet));

const farBullet = { x: 100, y: 100, hitRadius: 5 };
assert('player-bullet miss', !BH.Collision.playerVsBullet(0, 0, 8, farBullet));

summary();
</script>
```

- [ ] **Step 2: Open test.html — verify new tests FAIL**

- [ ] **Step 3: Implement collision.js**

```js
window.BH = window.BH || {};

BH.Collision = {
  circleCircle(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx * dx + dy * dy;
    const radii = r1 + r2;
    return distSq <= radii * radii;
  },

  playerVsBullet(px, py, pHitRadius, bullet) {
    return this.circleCircle(px, py, pHitRadius, bullet.x, bullet.y, bullet.hitRadius);
  },

  checkAll(player, bulletPool) {
    if (player.invincible || player.isDead()) return;
    for (const b of bulletPool.active) {
      if (this.playerVsBullet(player.x, player.y, player.hitRadius, b)) {
        player.takeDamage();
        b.alive = false;
        return; // only one hit per frame
      }
    }
  }
};
```

- [ ] **Step 4: Open test.html — verify all tests PASS**

- [ ] **Step 5: Commit**

```bash
git add game/collision.js game/tests/test.html
git commit -m "feat: collision detection — circle-circle, player-vs-bullet, tests"
```

---

### Task 7: Renderer

**Files:**
- Create: `game/renderer.js`

- [ ] **Step 1: Implement renderer.js**

```js
window.BH = window.BH || {};

BH.Renderer = {
  draw(ctx, game) {
    const { canvas, player, phase, score, bulletPool } = game;
    const w = canvas.width;
    const h = canvas.height;

    // === Background ===
    if (phase.isBerserk) {
      ctx.fillStyle = '#8B0000';
    } else {
      ctx.fillStyle = '#1a1a1a';
    }
    ctx.fillRect(0, 0, w, h);

    // === Grid ===
    ctx.strokeStyle = phase.isBerserk
      ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // === Bullets ===
    for (const b of bulletPool.active) {
      this.drawBullet(ctx, b);
    }

    // === Player ===
    this.drawPlayer(ctx, player);

    // === HUD ===
    this.drawHUD(ctx, player, phase, score, w);
  },

  drawBullet(ctx, b) {
    ctx.save();
    if (b.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    } else if (b.shape === 'rect') {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
    } else if (b.shape === 'triangle') {
      const s = b.size;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - s / 2);
      ctx.lineTo(b.x - s / 2, b.y + s / 2);
      ctx.lineTo(b.x + s / 2, b.y + s / 2);
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.fill();
      if (b.stroke) {
        ctx.strokeStyle = b.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  drawPlayer(ctx, player) {
    ctx.save();
    if (player.invincible) {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() * 0.01);
    }
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#F5F0E8';
    ctx.fill();
    // Outer ring
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,240,232,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  },

  drawHUD(ctx, player, phase, score, canvasWidth) {
    // HP — 4 small rectangles, top-left
    const hpX = 20;
    const hpY = 20;
    const hpSize = 14;
    const hpGap = 6;
    for (let i = 0; i < player.maxHp; i++) {
      const x = hpX + i * (hpSize + hpGap);
      if (i < player.hp) {
        ctx.fillStyle = '#F5F0E8';
        ctx.fillRect(x, hpY, hpSize, hpSize);
      } else {
        ctx.strokeStyle = '#F5F0E8';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, hpY, hpSize, hpSize);
      }
    }

    // Score — top-right
    ctx.fillStyle = '#F5F0E8';
    ctx.font = '20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(score.getDisplay(), canvasWidth - 20, 34);

    // Time — top-right below score
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(245,240,232,0.5)';
    ctx.fillText(score.getTimeDisplay(), canvasWidth - 20, 52);

    // Phase label — top center
    ctx.textAlign = 'center';
    ctx.font = '11px monospace';
    ctx.fillStyle = phase.isBerserk ? '#FFD600' : 'rgba(245,240,232,0.3)';
    ctx.fillText(
      phase.isBerserk ? 'BERSERK' : 'NORMAL',
      canvasWidth / 2, 34
    );

    // Phase progress bar — bottom
    const barH = 4;
    const progress = phase.elapsed / (phase.isBerserk ? phase.berserkDuration : phase.normalDuration);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, ctx.canvas.height - barH, canvasWidth, barH);
    ctx.fillStyle = phase.isBerserk ? '#D40000' : '#FFD600';
    ctx.fillRect(0, ctx.canvas.height - barH, canvasWidth * progress, barH);

    ctx.textAlign = 'left'; // reset
  },

  drawGameOver(ctx, score, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#F5F0E8';
    ctx.font = '32px monospace';
    ctx.fillText(score.getDisplay(), w / 2, h / 2 - 40);

    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(245,240,232,0.6)';
    ctx.fillText(score.getTimeDisplay(), w / 2, h / 2);

    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(245,240,232,0.4)';
    ctx.fillText('CLICK TO RESTART', w / 2, h / 2 + 40);

    ctx.textAlign = 'left';
  }
};
```

- [ ] **Step 2: Wire renderer into main.js loop**

Replace the draw section in `BH.Game.loop()`:
```js
loop() {
  const now = performance.now();
  const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap at 50ms
  this.lastTime = now;

  if (!this.gameOver) {
    this.phase.update(dt);

    if (this.phase.berserkJustEnded) {
      this.player.resetHpAfterBerserk();
    }

    this.player.update(dt, this.phase.isBerserk);
    this.bulletPool.update(dt, this.phase.bulletSpeedMultiplier);
    BH.Collision.checkAll(this.player, this.bulletPool);
    this.score.update(dt, this.phase.isBerserk, this.player.hp);

    if (this.player.isDead()) {
      this.gameOver = true;
    }
  }

  BH.Renderer.draw(this.ctx, this);
  if (this.gameOver) {
    BH.Renderer.drawGameOver(this.ctx, this.score, this.canvas.width, this.canvas.height);
  }

  requestAnimationFrame(() => this.loop());
}
```

- [ ] **Step 3: Verify in browser — background, grid, player, HUD all render**

- [ ] **Step 4: Commit**

```bash
git add game/renderer.js game/main.js
git commit -m "feat: renderer — background, grid, bullets, player, HUD, game-over overlay"
```

---

### Task 8: Patterns & Timeline Engine

**Files:**
- Create: `game/patterns.js`

- [ ] **Step 1: Implement patterns.js with Movement 1 timeline**

```js
window.BH = window.BH || {};

// Helper: generate bullet spawn events for a movement
// Each event: { t: ms, type, origin, count, spread, angle, ... }
BH.PatternEngine = {
  currentIndex: 0,
  currentMovement: 0,

  reset() {
    this.currentIndex = 0;
    this.currentMovement = 0;
  },

  // Process timeline events up to the current time
  process(timeMs, bulletPool, canvasW, canvasH, isBerserk) {
    const movement = BH.PATTERNS[this.currentMovement];
    if (!movement) return;

    while (this.currentIndex < movement.length && movement[this.currentIndex].t <= timeMs) {
      const event = movement[this.currentIndex];
      this.spawnFromEvent(event, bulletPool, canvasW, canvasH, isBerserk);
      this.currentIndex++;
    }

    // Movement ended — advance to next
    if (this.currentIndex >= movement.length) {
      this.currentMovement = (this.currentMovement + 1) % BH.PATTERNS.length;
      this.currentIndex = 0;
      return 'movement-change';
    }
    return null;
  },

  spawnFromEvent(event, pool, w, h, isBerserk) {
    const count = isBerserk ? (event.count || 1) * 2 : (event.count || 1);

    for (let i = 0; i < count; i++) {
      const spawn = this.resolveOrigin(event.origin, w, h, i, count);
      const angle = this.resolveAngle(event, spawn, w, h, i, count);
      const def = BH.BULLET_DEFS[event.type];
      const speed = def.baseSpeed;

      pool.spawn({
        type: event.type,
        x: spawn.x,
        y: spawn.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      });
    }
  },

  resolveOrigin(origin, w, h, i, count) {
    switch (origin) {
      case 'top':    return { x: (w / (count + 1)) * (i + 1), y: -10 };
      case 'bottom': return { x: (w / (count + 1)) * (i + 1), y: h + 10 };
      case 'left':   return { x: -10, y: (h / (count + 1)) * (i + 1) };
      case 'right':  return { x: w + 10, y: (h / (count + 1)) * (i + 1) };
      case 'center':  return { x: w / 2, y: h / 2 };
      case 'random-edge': {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) return { x: Math.random() * w, y: -10 };
        if (side === 1) return { x: Math.random() * w, y: h + 10 };
        if (side === 2) return { x: -10, y: Math.random() * h };
        return { x: w + 10, y: Math.random() * h };
      }
      default: return { x: Math.random() * w, y: -10 };
    }
  },

  resolveAngle(event, spawn, w, h, i, count) {
    if (event.spread === 'fan') {
      const baseAngle = Math.atan2(h / 2 - spawn.y, w / 2 - spawn.x);
      const fanWidth = Math.PI / 3;
      return baseAngle - fanWidth / 2 + (fanWidth / Math.max(count - 1, 1)) * i;
    }
    if (event.spread === 'ring') {
      return (Math.PI * 2 / count) * i;
    }
    if (event.angle !== undefined) {
      return event.angle;
    }
    // Default: aim toward center
    return Math.atan2(h / 2 - spawn.y, w / 2 - spawn.x);
  }
};

// === MOVEMENT TIMELINES ===
// Movement 1: Puls — yellow dots, rhythmic, pulse-like
BH.PATTERNS = [];

(function buildMovement1() {
  const m = [];
  const bpm = 110;
  const beat = 60000 / bpm; // ~545ms per beat

  // Intro: gentle dot pulses from top, every 2 beats
  for (let i = 0; i < 16; i++) {
    m.push({ t: i * beat * 2, type: 'dot', origin: 'top', count: 3, spread: 'fan' });
  }

  // Build: ring bursts from center, every 4 beats
  for (let i = 0; i < 8; i++) {
    m.push({ t: 16 * beat * 2 + i * beat * 4, type: 'dot', origin: 'center', count: 8, spread: 'ring' });
  }

  // Accent: alternating red lines from sides
  for (let i = 0; i < 12; i++) {
    m.push({
      t: 16 * beat * 2 + i * beat * 3,
      type: 'line',
      origin: i % 2 === 0 ? 'left' : 'right',
      count: 2,
      angle: i % 2 === 0 ? 0 : Math.PI
    });
  }

  // Climax: mixed dots + blue rects
  const climaxStart = 80 * beat;
  for (let i = 0; i < 20; i++) {
    m.push({ t: climaxStart + i * beat, type: 'dot', origin: 'top', count: 5, spread: 'fan' });
    if (i % 4 === 0) {
      m.push({ t: climaxStart + i * beat, type: 'rect', origin: 'left', count: 1 });
    }
  }

  m.sort((a, b) => a.t - b.t);
  BH.PATTERNS.push(m);
})();

// Movement 2: Linie — red lines, scanning sweeps
(function buildMovement2() {
  const m = [];
  const bpm = 125;
  const beat = 60000 / bpm;

  // Parallel line walls from top
  for (let i = 0; i < 24; i++) {
    m.push({ t: i * beat * 2, type: 'line', origin: 'top', count: 4, spread: 'fan' });
  }

  // Side sweeps
  for (let i = 0; i < 16; i++) {
    m.push({
      t: 24 * beat + i * beat * 2,
      type: 'line',
      origin: i % 2 === 0 ? 'left' : 'right',
      count: 3,
      angle: i % 2 === 0 ? 0 : Math.PI
    });
  }

  // Dot accents
  for (let i = 0; i < 10; i++) {
    m.push({ t: 20 * beat + i * beat * 4, type: 'dot', origin: 'center', count: 6, spread: 'ring' });
  }

  // Dense finale with blue rects
  const finaleStart = 70 * beat;
  for (let i = 0; i < 24; i++) {
    m.push({ t: finaleStart + i * beat, type: 'line', origin: 'random-edge', count: 2 });
    if (i % 3 === 0) {
      m.push({ t: finaleStart + i * beat, type: 'rect', origin: 'random-edge', count: 1 });
    }
  }

  m.sort((a, b) => a.t - b.t);
  BH.PATTERNS.push(m);
})();

// Movement 3: Chaos — mixed types, irregular rhythm
(function buildMovement3() {
  const m = [];
  const bpm = 140;
  const beat = 60000 / bpm;

  for (let i = 0; i < 100; i++) {
    const jitter = (Math.random() - 0.5) * beat * 0.5;
    const t = i * beat + jitter;
    const types = ['dot', 'line', 'rect'];
    const type = types[Math.floor(Math.random() * types.length)];
    const origins = ['top', 'bottom', 'left', 'right', 'center', 'random-edge'];
    const origin = origins[Math.floor(Math.random() * origins.length)];
    const spreads = ['fan', 'ring', undefined];

    m.push({
      t: Math.max(0, t),
      type: type,
      origin: origin,
      count: Math.floor(Math.random() * 4) + 2,
      spread: type === 'dot' ? spreads[Math.floor(Math.random() * spreads.length)] : undefined
    });
  }

  m.sort((a, b) => a.t - b.t);
  BH.PATTERNS.push(m);
})();
```

- [ ] **Step 2: Add berserk triangle spawner to main.js**

In the game loop, add periodic triangle spawning during berserk:
```js
// Inside BH.Game, add property:
this.berserkTriangleTimer = 0;

// Inside loop, after phase.update:
if (this.phase.isBerserk) {
  this.berserkTriangleTimer += dt;
  if (this.berserkTriangleTimer >= 3) {
    this.berserkTriangleTimer -= 3;
    // Spawn triangle aimed at player
    const edge = BH.PatternEngine.resolveOrigin('random-edge',
      this.canvas.width, this.canvas.height, 0, 1);
    const angle = Math.atan2(this.player.y - edge.y, this.player.x - edge.x);
    this.bulletPool.spawn({
      type: 'triangle',
      x: edge.x, y: edge.y,
      vx: Math.cos(angle) * 160,
      vy: Math.sin(angle) * 160
    });
  }
} else {
  this.berserkTriangleTimer = 0;
}
```

- [ ] **Step 3: Verify in browser — bullets spawn and move across screen**

- [ ] **Step 4: Commit**

```bash
git add game/patterns.js game/main.js
git commit -m "feat: pattern engine + 3 movement timelines, berserk triangle spawner"
```

---

### Task 9: Audio Module

**Files:**
- Create: `game/audio.js`

- [ ] **Step 1: Implement audio.js with Tone.js synthesizer**

```js
window.BH = window.BH || {};

BH.Audio = {
  initialized: false,
  synths: {},
  transport: null,
  currentMovement: -1,
  scheduledEvents: [],

  async init() {
    if (this.initialized) return;
    await Tone.start();

    // Synths for Bauhaus experimental sound
    this.synths.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.5 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5, baseFrequency: 80, octaves: 3 }
    }).toDestination();

    this.synths.pulse = new Tone.Synth({
      oscillator: { type: 'square4' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 }
    }).toDestination();
    this.synths.pulse.volume.value = -8;

    this.synths.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.5, decay: 0.8, sustain: 0.4, release: 1.5 }
    }).toDestination();
    this.synths.pad.volume.value = -12;

    this.synths.noise = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 }
    }).toDestination();
    this.synths.noise.volume.value = -15;

    this.synths.hit = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 }
    }).toDestination();
    this.synths.hit.volume.value = -10;

    this.initialized = true;
  },

  playMovement(index) {
    if (this.currentMovement === index) return;
    this.stopAll();
    this.currentMovement = index;

    Tone.Transport.cancel();
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    const movements = [this.movement1, this.movement2, this.movement3];
    movements[index].call(this);

    Tone.Transport.start();
  },

  movement1() {
    // Puls: steady bass pulse + percussive dots
    const bpm = 110;
    Tone.Transport.bpm.value = bpm;
    const beat = '4n';

    // Bass pulse every beat
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.bass.triggerAttackRelease('C1', '8n', time);
    }, beat, 0);

    // Hi percussive pulse every 2 beats
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pulse.triggerAttackRelease('C5', '16n', time);
    }, '2n', 0);

    // Sparse noise accents every 4 beats
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.noise.triggerAttackRelease('16n', time);
    }, '1n', 0);

    // Pad chord swell every 8 beats
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pad.triggerAttackRelease(['C3', 'Eb3', 'G3'], '2n', time);
    }, '2m', 0);
  },

  movement2() {
    // Linie: melodic lines, denser rhythm
    const bpm = 125;
    Tone.Transport.bpm.value = bpm;

    // Driving bass
    const bassNotes = ['C1', 'C1', 'Eb1', 'F1'];
    let bassI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.bass.triggerAttackRelease(bassNotes[bassI % bassNotes.length], '8n', time);
      bassI++;
    }, '4n', 0);

    // Pulse melody
    const melody = ['C4', 'Eb4', 'G4', 'Bb4', 'C5', 'Bb4', 'G4', 'Eb4'];
    let melI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pulse.triggerAttackRelease(melody[melI % melody.length], '16n', time);
      melI++;
    }, '8n', 0);

    // Noise hits on beat
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.noise.triggerAttackRelease('32n', time);
    }, '4n', 0);
  },

  movement3() {
    // Chaos: irregular, all synths active, dissonant
    const bpm = 140;
    Tone.Transport.bpm.value = bpm;

    // Erratic bass
    const bassNotes = ['C1', 'Db1', 'E1', 'Gb1', 'A1'];
    let bassI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.bass.triggerAttackRelease(bassNotes[bassI % bassNotes.length], '16n', time);
      bassI++;
    }, '8t', 0);

    // Rapid pulse
    const chaosNotes = ['C5', 'Db5', 'E4', 'Gb5', 'A4', 'Bb5'];
    let chaosI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pulse.triggerAttackRelease(chaosNotes[chaosI % chaosNotes.length], '32n', time);
      chaosI++;
    }, '16t', 0);

    // Dense noise
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.noise.triggerAttackRelease('32n', time);
    }, '8n', 0);

    // Dissonant pad clusters
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pad.triggerAttackRelease(['C3', 'Db3', 'Gb3'], '4n', time);
    }, '1m', 0);

    // Membrane hits
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.hit.triggerAttackRelease('C1', time);
    }, '2n', 0);
  },

  playDamageSound() {
    if (!this.initialized) return;
    this.synths.hit.triggerAttackRelease('C1', Tone.now());
  },

  stopAll() {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    this.currentMovement = -1;
  },

  // Returns current Transport time in ms
  getTimeMs() {
    return Tone.Transport.seconds * 1000;
  }
};
```

- [ ] **Step 2: Verify in browser — click starts music, 3 distinct movement sounds**

Test by manually calling in console:
```js
await BH.Audio.init();
BH.Audio.playMovement(0); // Puls
// wait... then:
BH.Audio.playMovement(1); // Linie
BH.Audio.playMovement(2); // Chaos
```

- [ ] **Step 3: Commit**

```bash
git add game/audio.js
git commit -m "feat: audio module — 3 Bauhaus synth movements via Tone.js"
```

---

### Task 10: Main Game Loop — Wire Everything Together

**Files:**
- Modify: `game/main.js` — complete rewrite with all modules wired

- [ ] **Step 1: Rewrite main.js**

```js
window.BH = window.BH || {};

BH.Game = {
  canvas: null,
  ctx: null,
  player: null,
  phase: null,
  score: null,
  bulletPool: null,
  lastTime: 0,
  gameOver: false,
  started: false,
  audioStarted: false,
  berserkTriangleTimer: 0,
  musicTimeMs: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('click', (e) => this.handleClick(e));

    this.player = new BH.Player(this.canvas.width / 2, this.canvas.height / 2);
    this.phase = new BH.Phase();
    this.score = new BH.Score();
    this.bulletPool = new BH.BulletPool();
    BH.PatternEngine.reset();

    this.lastTime = performance.now();
    this.loop();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.player) {
      // Clamp player inside new bounds
      this.player.x = Math.min(this.player.x, this.canvas.width);
      this.player.y = Math.min(this.player.y, this.canvas.height);
    }
  },

  async handleClick(e) {
    if (!this.audioStarted) {
      await BH.Audio.init();
      this.audioStarted = true;
    }

    if (this.gameOver) {
      this.restart();
      return;
    }

    if (!this.started) {
      this.started = true;
      this.musicTimeMs = 0;
      BH.Audio.playMovement(0);
    }

    this.player.setTarget(e.clientX, e.clientY);
  },

  restart() {
    this.player = new BH.Player(this.canvas.width / 2, this.canvas.height / 2);
    this.phase.reset();
    this.score.reset();
    this.bulletPool.clear();
    BH.PatternEngine.reset();
    this.berserkTriangleTimer = 0;
    this.musicTimeMs = 0;
    this.gameOver = false;
    this.started = false;
    BH.Audio.stopAll();
  },

  loop() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.started && !this.gameOver) {
      // Phase
      this.phase.update(dt);

      if (this.phase.berserkJustEnded) {
        this.player.resetHpAfterBerserk();
      }

      // Pattern timeline — use audio Transport time if available, else manual
      if (BH.Audio.initialized) {
        this.musicTimeMs = BH.Audio.getTimeMs();
      } else {
        this.musicTimeMs += dt * 1000;
      }
      const result = BH.PatternEngine.process(
        this.musicTimeMs, this.bulletPool,
        this.canvas.width, this.canvas.height,
        this.phase.isBerserk
      );
      if (result === 'movement-change') {
        this.musicTimeMs = 0;
        Tone.Transport.position = 0;
        BH.Audio.playMovement(BH.PatternEngine.currentMovement);
      }

      // Berserk triangles
      if (this.phase.isBerserk) {
        this.berserkTriangleTimer += dt;
        if (this.berserkTriangleTimer >= 3) {
          this.berserkTriangleTimer -= 3;
          const edge = BH.PatternEngine.resolveOrigin(
            'random-edge', this.canvas.width, this.canvas.height, 0, 1
          );
          const angle = Math.atan2(
            this.player.y - edge.y, this.player.x - edge.x
          );
          this.bulletPool.spawn({
            type: 'triangle',
            x: edge.x, y: edge.y,
            vx: Math.cos(angle) * 160,
            vy: Math.sin(angle) * 160
          });
        }
      } else {
        this.berserkTriangleTimer = 0;
      }

      // Update
      this.player.update(dt, this.phase.isBerserk);
      this.bulletPool.update(dt, this.phase.bulletSpeedMultiplier);
      BH.Collision.checkAll(this.player, this.bulletPool);
      this.score.update(dt, this.phase.isBerserk, this.player.hp);

      if (this.player.isDead()) {
        this.gameOver = true;
        BH.Audio.stopAll();
      }

      // Damage sound
      if (this.player.invincible && this.player.invincibleTimer >= this.player.invincibleDuration - 0.02) {
        BH.Audio.playDamageSound();
      }
    }

    // Render
    BH.Renderer.draw(this.ctx, this);
    if (this.gameOver) {
      BH.Renderer.drawGameOver(this.ctx, this.score, this.canvas.width, this.canvas.height);
    } else if (!this.started) {
      this.drawStartScreen();
    }

    requestAnimationFrame(() => this.loop());
  },

  drawStartScreen() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.textAlign = 'center';
    ctx.font = '28px monospace';
    ctx.fillStyle = '#F5F0E8';
    ctx.fillText('BAUHAUS BULLET', w / 2, h / 2 - 30);

    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(245,240,232,0.4)';
    ctx.fillText('CLICK TO BEGIN', w / 2, h / 2 + 20);

    ctx.textAlign = 'left';
  }
};

document.addEventListener('DOMContentLoaded', () => BH.Game.init());
```

- [ ] **Step 2: Verify full gameplay — click to start, bullets spawn, music plays, phase cycling works, HP, scoring, game over**

Open `game/index.html` in browser. Test:
1. Click to start — music begins, bullets appear
2. Player moves to clicked positions
3. Phase cycles: 30s normal → 12s berserk (background turns red)
4. Berserk: player moves faster, bullets denser, triangles spawn
5. Berserk end: HP resets to 2
6. Take damage: HP squares go hollow, player flashes
7. Die: game over screen, click to restart

- [ ] **Step 3: Commit**

```bash
git add game/main.js
git commit -m "feat: complete game loop — all modules wired, start/restart, phase cycling"
```

---

### Task 11: Visual Polish — Berserk Transitions

**Files:**
- Modify: `game/renderer.js` — add berserk transition effects

- [ ] **Step 1: Add transition state to phase.js**

Add to `BH.Phase`:
```js
// Add properties:
this.transitionProgress = 0; // 0-1 for berserk transition
this.shockwave = 0;          // 0-1 for berserk start shockwave

// In update(), after setting berserkJustStarted:
if (this.berserkJustStarted) {
  this.shockwave = 1;
}
this.shockwave = Math.max(0, this.shockwave - dt * 2);

// Smooth background transition
const targetTransition = this.isBerserk ? 1 : 0;
this.transitionProgress += (targetTransition - this.transitionProgress) * dt * 4;
```

- [ ] **Step 2: Update renderer to use transition values**

In `BH.Renderer.draw()`, replace background section:
```js
// Background with smooth transition
const t = phase.transitionProgress;
const r = Math.round(26 + (139 - 26) * t);  // #1a -> #8B
const g = Math.round(26 * (1 - t));           // 1a -> 00
const b = Math.round(26 * (1 - t));           // 1a -> 00
ctx.fillStyle = `rgb(${r},${g},${b})`;
ctx.fillRect(0, 0, w, h);

// Shockwave
if (phase.shockwave > 0) {
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, (1 - phase.shockwave) * Math.max(w, h), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,214,0,${phase.shockwave * 0.5})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}
```

- [ ] **Step 3: Add HP recovery flash in renderer**

In `drawHUD`, after drawing HP squares, if `phase.berserkJustEnded`:
```js
if (phase.berserkJustEnded) {
  // Flash all recovered HP squares yellow briefly
  // The flash is handled by a simple time-based alpha in the next few frames
}
```

Use a simple approach: store a `hpFlashTimer` in `BH.Game`, set it to 0.5 on `berserkJustEnded`, and draw a yellow overlay on recovered HP squares while timer > 0.

- [ ] **Step 4: Verify in browser — smooth red transition, shockwave on berserk start**

- [ ] **Step 5: Commit**

```bash
git add game/renderer.js game/phase.js game/main.js
git commit -m "feat: visual polish — smooth berserk transitions, shockwave, HP flash"
```

---

### Task 12: Final Integration & Cleanup

**Files:**
- Modify: `game/main.js` — edge cases
- Modify: `game/tests/test.html` — run full test suite

- [ ] **Step 1: Run all tests in test.html**

Open `game/tests/test.html`, verify all assertions pass.

- [ ] **Step 2: Full play-through test**

Play the game for 2+ minutes. Verify:
- Phase cycling works across multiple cycles
- Music transitions between movements
- Score increases correctly
- Berserk triangle bullets spawn and despawn
- HP recovery works after berserk
- Game over and restart work cleanly
- No console errors

- [ ] **Step 3: Add .gitignore**

```
.superpowers/
.DS_Store
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Bauhaus Bullet — complete game with audio, patterns, phase cycling"
```
