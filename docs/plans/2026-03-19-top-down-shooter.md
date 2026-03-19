# Top-Down Shooter 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 制作一款可在浏览器中运行的复古风格自上而下射击游戏，支持键盘移动、鼠标瞄准射击、多关卡进程和菜单界面。

**Architecture:** 单文件 HTML + 原生 Canvas 2D API，无外部依赖。游戏循环使用 requestAnimationFrame，所有图形用程序化像素艺术风格绘制（无图片资源）。状态机管理菜单/游戏/结算三种状态。

**Tech Stack:** HTML5 Canvas, Vanilla JavaScript (ES6+), CSS3

---

## 项目结构

```
ClaudeCodeTest01/
└── shooter/
    └── index.html   ← 全部代码在此单文件中
```

---

### Task 1: 项目骨架 + 游戏状态机 + 菜单界面

**Files:**
- Create: `shooter/index.html`

**目标:** 建立 HTML 骨架、Canvas 设置、状态机（MENU / PLAYING / GAME_OVER / LEVEL_CLEAR），并渲染复古风格主菜单。

**Step 1: 创建文件，写入 HTML 骨架和 Canvas**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>RETRO SHOOTER</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#000; display:flex; align-items:center; justify-content:center; height:100vh; }
    canvas { display:block; image-rendering:pixelated; border:2px solid #0ff; box-shadow:0 0 30px #0ff4; }
  </style>
</head>
<body>
<canvas id="c" width="600" height="700"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ── 状态机 ──────────────────────────────
const STATE = { MENU:0, PLAYING:1, LEVEL_CLEAR:2, GAME_OVER:3 };
let state = STATE.MENU;
</script>
</body>
</html>
```

**Step 2: 添加菜单渲染函数**

在 `<script>` 中继续添加：

```javascript
// ── 复古字体工具 ─────────────────────────
function retroText(text, x, y, size, color, align='center') {
  ctx.save();
  ctx.font = `bold ${size}px 'Courier New', monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── 菜单界面 ─────────────────────────────
function drawMenu() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // 星空背景
  drawStars();

  retroText('RETRO', W/2, 180, 64, '#0ff');
  retroText('SHOOTER', W/2, 255, 64, '#f0f');
  retroText('▶  PRESS ENTER TO START', W/2, 380, 18, '#ff0');
  retroText('WASD / 方向键 移动', W/2, 450, 14, '#aaa');
  retroText('鼠标瞄准  左键射击', W/2, 475, 14, '#aaa');
  retroText('v1.0  RETRO EDITION', W/2, H - 30, 12, '#444');
}
```

**Step 3: 添加星空背景（装饰用，每帧微动）**

```javascript
const stars = Array.from({length:80}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  r: Math.random()*1.5+0.3, speed: Math.random()*0.3+0.1
}));

function drawStars() {
  stars.forEach(s => {
    s.y += s.speed;
    if (s.y > H) { s.y = 0; s.x = Math.random()*W; }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${0.3+s.r*0.3})`;
    ctx.fill();
  });
}
```

**Step 4: 主循环骨架 + 键盘监听**

```javascript
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (state === STATE.MENU && e.key === 'Enter') startGame();
  if (state === STATE.GAME_OVER && e.key === 'Enter') { state = STATE.MENU; }
  if (state === STATE.LEVEL_CLEAR && e.key === 'Enter') nextLevel();
});
document.addEventListener('keyup', e => keys[e.key] = false);

function loop() {
  requestAnimationFrame(loop);
  if (state === STATE.MENU)       drawMenu();
  else if (state === STATE.PLAYING)     update(); // Task 2
  else if (state === STATE.LEVEL_CLEAR) drawLevelClear(); // Task 5
  else if (state === STATE.GAME_OVER)   drawGameOver(); // Task 5
}
loop();
```

**Step 5: 验证菜单可见**
用浏览器打开 `shooter/index.html`，应看到黑色背景、滚动星星、青色/品红标题文字。

---

### Task 2: 玩家角色 — 绘制、移动、枪口朝向鼠标

**Files:**
- Modify: `shooter/index.html`

**目标:** 程序化绘制玩家（像素风小人+枪），用箭头键/WASD移动，枪口始终朝向鼠标。

**Step 1: 玩家数据结构**

```javascript
let player, mouse, level, score, lives;

function startGame() {
  level = 1; score = 0; lives = 3;
  mouse = { x: W/2, y: H/2 };
  player = {
    x: W/2, y: H - 120,
    speed: 3.5,
    angle: 0,        // 朝向鼠标的角度
    radius: 18,
    shootCooldown: 0,
    invincible: 0    // 受伤后无敌帧
  };
  bullets = [];
  enemies = [];
  particles = [];
  spawnTimer = 0;
  state = STATE.PLAYING;
  loadLevel(level);
}
```

**Step 2: 鼠标追踪**

```javascript
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top)  * (H / r.height);
});
canvas.addEventListener('click', () => {
  if (state === STATE.PLAYING) shoot();
});
```

**Step 3: 程序化绘制玩家**

```javascript
function drawPlayer() {
  const { x, y, angle, invincible } = player;
  if (invincible > 0 && Math.floor(invincible/4) % 2 === 0) return; // 闪烁

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 身体（六边形飞船风格）
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(12, 8);
  ctx.lineTo(6, 4);
  ctx.lineTo(0, 14);
  ctx.lineTo(-6, 4);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  ctx.fillStyle = '#0ff';
  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 枪管
  ctx.fillStyle = '#ff0';
  ctx.shadowColor = '#ff0';
  ctx.shadowBlur = 8;
  ctx.fillRect(-3, -28, 6, 14);

  ctx.restore();
}
```

**Step 4: 玩家移动 + 角度更新**

```javascript
function updatePlayer() {
  let dx = 0, dy = 0;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
  if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
  if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;

  if (dx && dy) { dx *= 0.707; dy *= 0.707; } // 对角线归一化

  player.x = Math.max(20, Math.min(W-20, player.x + dx * player.speed));
  player.y = Math.max(20, Math.min(H-20, player.y + dy * player.speed));

  player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;

  if (player.shootCooldown > 0) player.shootCooldown--;
  if (player.invincible > 0)    player.invincible--;
}
```

---

### Task 3: 子弹系统 + 粒子特效

**Files:**
- Modify: `shooter/index.html`

**目标:** 点击鼠标发射子弹，子弹朝鼠标方向飞行，命中时产生粒子爆炸。

**Step 1: 子弹数据 + 射击函数**

```javascript
let bullets = [];
const BULLET_SPEED = 9;
const SHOOT_COOLDOWN = 12; // 帧

function shoot() {
  if (player.shootCooldown > 0) return;
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  // 枪口偏移
  const muzzleX = player.x + Math.sin(player.angle) * -26;
  const muzzleY = player.y - Math.cos(player.angle) * 26;
  bullets.push({
    x: muzzleX, y: muzzleY,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: 80
  });
  player.shootCooldown = SHOOT_COOLDOWN;
  spawnMuzzleFlash(muzzleX, muzzleY);
}

function updateBullets() {
  bullets = bullets.filter(b => {
    b.x += b.vx; b.y += b.vy; b.life--;
    return b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H;
  });
}

function drawBullets() {
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 10;
    ctx.fill();
  });
}
```

**Step 2: 粒子系统**

```javascript
let particles = [];

function spawnParticles(x, y, color, count=12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      life: 30 + Math.random()*20,
      maxLife: 50,
      color, size: Math.random()*3+1
    });
  }
}

function spawnMuzzleFlash(x, y) {
  spawnParticles(x, y, '#ff0', 5);
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life--;
    return p.life > 0;
  });
}

function drawParticles() {
  particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI*2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}
```

---

### Task 4: 敌人系统 — 多种类型、多方向生成、AI移动

**Files:**
- Modify: `shooter/index.html`

**目标:** 3种敌人类型，从屏幕四边随机生成，各有不同移动模式和外观。

**Step 1: 敌人类型定义**

```javascript
// 敌人类型
const ENEMY_TYPES = {
  CHASER: {
    color:'#f00', size:14, hp:1, speed:1.8, score:10,
    draw: drawEnemyChaser
  },
  TANK: {
    color:'#f80', size:20, hp:4, speed:0.9, score:30,
    draw: drawEnemyTank
  },
  ZIGZAG: {
    color:'#f0f', size:12, hp:1, speed:2.2, score:20,
    draw: drawEnemyZigzag
  }
};
```

**Step 2: 敌人生成（从四边随机出现）**

```javascript
let enemies = [];
let spawnTimer = 0;
let spawnInterval = 90; // 帧，随关卡减少

function spawnEnemy() {
  const types = Object.values(ENEMY_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  let x, y;
  const side = Math.floor(Math.random()*4);
  if (side===0) { x=Math.random()*W; y=-30; }
  else if (side===1) { x=W+30; y=Math.random()*H; }
  else if (side===2) { x=Math.random()*W; y=H+30; }
  else { x=-30; y=Math.random()*H; }

  enemies.push({
    x, y, type,
    hp: type.hp, maxHp: type.hp,
    speed: type.speed * (1 + (level-1)*0.15),
    angle: 0,
    zigzagTimer: 0,
    zigzagDir: 1
  });
}
```

**Step 3: 敌人移动 AI**

```javascript
function updateEnemies() {
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
    // 每关最多同时生成2个
    if (level >= 3) spawnEnemy();
  }

  enemies.forEach(e => {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    e.angle = Math.atan2(dy, dx);

    if (e.type === ENEMY_TYPES.CHASER || e.type === ENEMY_TYPES.TANK) {
      // 直线追踪
      e.x += (dx/dist) * e.speed;
      e.y += (dy/dist) * e.speed;
    } else if (e.type === ENEMY_TYPES.ZIGZAG) {
      // 锯齿形移动
      e.zigzagTimer++;
      if (e.zigzagTimer % 40 === 0) e.zigzagDir *= -1;
      const perpX = -dy/dist;
      const perpY =  dx/dist;
      e.x += (dx/dist)*e.speed + perpX*e.zigzagDir*1.5;
      e.y += (dy/dist)*e.speed + perpY*e.zigzagDir*1.5;
    }
  });
}
```

**Step 4: 程序化绘制三种敌人**

```javascript
function drawEnemyChaser(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle + Math.PI/2);
  ctx.beginPath();
  // 三角形
  ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fillStyle = '#f00';
  ctx.shadowColor = '#f00'; ctx.shadowBlur = 10;
  ctx.fill();
  ctx.strokeStyle = '#faa'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

function drawEnemyTank(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle + Math.PI/2);
  // 方形坦克
  ctx.fillStyle = '#f80';
  ctx.shadowColor = '#f80'; ctx.shadowBlur = 12;
  ctx.fillRect(-14, -14, 28, 28);
  ctx.strokeStyle = '#fda'; ctx.lineWidth = 2; ctx.strokeRect(-14,-14,28,28);
  // 炮管
  ctx.fillStyle = '#fa0';
  ctx.fillRect(-4, -22, 8, 12);
  ctx.restore();
}

function drawEnemyZigzag(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle + Math.PI/2);
  // 菱形
  ctx.beginPath();
  ctx.moveTo(0,-14); ctx.lineTo(10,0); ctx.lineTo(0,14); ctx.lineTo(-10,0);
  ctx.closePath();
  ctx.fillStyle = '#f0f';
  ctx.shadowColor = '#f0f'; ctx.shadowBlur = 10;
  ctx.fill();
  ctx.strokeStyle = '#faf'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(e => {
    e.type.draw(e);
    // 血条（坦克才显示）
    if (e.type === ENEMY_TYPES.TANK && e.hp < e.maxHp) {
      const bw = 36, bh = 5;
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x - bw/2, e.y - 28, bw, bh);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(e.x - bw/2, e.y - 28, bw*(e.hp/e.maxHp), bh);
    }
  });
}
```

---

### Task 5: 碰撞检测 + HUD + 关卡系统 + 游戏结算

**Files:**
- Modify: `shooter/index.html`

**目标:** 子弹击中敌人扣血/消灭，敌人碰到玩家扣命，HUD显示分数/生命/关卡，关卡进程与结算界面。

**Step 1: 碰撞检测**

```javascript
function checkCollisions() {
  // 子弹 vs 敌人
  bullets = bullets.filter(b => {
    let hit = false;
    enemies = enemies.filter(e => {
      const dx = b.x - e.x, dy = b.y - e.y;
      if (Math.sqrt(dx*dx+dy*dy) < e.type.size + 4) {
        e.hp--;
        spawnParticles(b.x, b.y, e.type.color, 8);
        hit = true;
        if (e.hp <= 0) {
          score += e.type.score;
          spawnParticles(e.x, e.y, e.type.color, 20);
          return false; // 移除敌人
        }
      }
      return true;
    });
    return !hit;
  });

  // 敌人 vs 玩家
  if (player.invincible > 0) return;
  enemies = enemies.filter(e => {
    const dx = e.x - player.x, dy = e.y - player.y;
    if (Math.sqrt(dx*dx+dy*dy) < e.type.size + player.radius - 6) {
      lives--;
      player.invincible = 120;
      spawnParticles(player.x, player.y, '#0ff', 15);
      if (lives <= 0) { state = STATE.GAME_OVER; }
      return false;
    }
    return true;
  });
}
```

**Step 2: 关卡配置 + 进入下一关**

```javascript
const LEVEL_CONFIG = [
  { killsToWin:10, spawnInterval:90  },
  { killsToWin:18, spawnInterval:70  },
  { killsToWin:28, spawnInterval:55  },
  { killsToWin:40, spawnInterval:40  },
  { killsToWin:55, spawnInterval:30  },
];

let killCount = 0;

function loadLevel(lv) {
  const cfg = LEVEL_CONFIG[Math.min(lv-1, LEVEL_CONFIG.length-1)];
  spawnInterval = cfg.spawnInterval;
  killCount = 0;
  enemies = [];
  bullets = [];
  particles = [];
  spawnTimer = 0;
}

function nextLevel() {
  level++;
  loadLevel(level);
  state = STATE.PLAYING;
}

// 在 checkCollisions 子弹击杀敌人处加：
// killCount++;
// if (killCount >= LEVEL_CONFIG[...].killsToWin) state = STATE.LEVEL_CLEAR;
```

**Step 3: HUD 绘制**

```javascript
function drawHUD() {
  // 顶部背景条
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, 44);

  retroText(`SCORE: ${score}`, 10, 28, 16, '#ff0', 'left');
  retroText(`LEVEL ${level}`, W/2, 28, 16, '#0ff');

  // 生命图标
  for (let i = 0; i < lives; i++) {
    drawMiniPlayer(W - 30 - i*28, 22);
  }

  // 关卡进度条
  const cfg = LEVEL_CONFIG[Math.min(level-1, LEVEL_CONFIG.length-1)];
  const prog = Math.min(killCount / cfg.killsToWin, 1);
  ctx.fillStyle = '#222';
  ctx.fillRect(10, H-14, W-20, 8);
  ctx.fillStyle = '#0f0';
  ctx.fillRect(10, H-14, (W-20)*prog, 8);
  retroText(`KILLS: ${killCount}/${cfg.killsToWin}`, W/2, H-18, 11, '#aaa');
}

function drawMiniPlayer(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0,-8); ctx.lineTo(6,5); ctx.lineTo(-6,5);
  ctx.closePath();
  ctx.fillStyle = '#0ff';
  ctx.shadowColor = '#0ff'; ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
}
```

**Step 4: 关卡通关 + 游戏结束界面**

```javascript
function drawLevelClear() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0,0,W,H);
  drawStars();
  retroText('LEVEL CLEAR!', W/2, H/2-60, 48, '#0f0');
  retroText(`SCORE: ${score}`, W/2, H/2+10, 24, '#ff0');
  retroText('PRESS ENTER FOR NEXT LEVEL', W/2, H/2+70, 16, '#fff');
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0,0,W,H);
  drawStars();
  retroText('GAME OVER', W/2, H/2-60, 56, '#f00');
  retroText(`FINAL SCORE: ${score}`, W/2, H/2+10, 24, '#ff0');
  retroText(`LEVEL REACHED: ${level}`, W/2, H/2+50, 18, '#aaa');
  retroText('PRESS ENTER TO MENU', W/2, H/2+100, 16, '#fff');
}
```

---

### Task 6: 主 update 函数整合 + 十字准星光标

**Files:**
- Modify: `shooter/index.html`

**目标:** 整合所有系统到主 update 函数，添加自定义十字准星替换鼠标光标。

**Step 1: 主 update 函数**

```javascript
function update() {
  // 背景
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,W,H);
  drawStars();

  updatePlayer();
  updateEnemies();
  updateBullets();
  updateParticles();
  checkCollisions();

  // 检查关卡完成
  const cfg = LEVEL_CONFIG[Math.min(level-1, LEVEL_CONFIG.length-1)];
  if (killCount >= cfg.killsToWin && state === STATE.PLAYING) {
    state = STATE.LEVEL_CLEAR;
  }

  drawEnemies();
  drawBullets();
  drawParticles();
  drawPlayer();
  drawHUD();
  drawCrosshair();
}
```

**Step 2: 十字准星**

```javascript
canvas.style.cursor = 'none';

function drawCrosshair() {
  if (state !== STATE.PLAYING) return;
  const { x, y } = mouse;
  const size = 12, gap = 4;
  ctx.save();
  ctx.strokeStyle = '#ff0';
  ctx.shadowColor = '#ff0';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.5;
  // 横线
  ctx.beginPath(); ctx.moveTo(x-size-gap,y); ctx.lineTo(x-gap,y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+gap,y); ctx.lineTo(x+size+gap,y); ctx.stroke();
  // 竖线
  ctx.beginPath(); ctx.moveTo(x,y-size-gap); ctx.lineTo(x,y-gap); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y+gap); ctx.lineTo(x,y+size+gap); ctx.stroke();
  // 中心点
  ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2);
  ctx.fillStyle='#ff0'; ctx.fill();
  ctx.restore();
}
```

**Step 3: 最终验证清单**
- [ ] 菜单显示，Enter 开始游戏
- [ ] 玩家可用 WASD/方向键移动
- [ ] 枪口跟随鼠标旋转
- [ ] 点击鼠标发射子弹，有粒子特效
- [ ] 三种敌人从四边生成，各有不同移动方式
- [ ] 击杀敌人得分，进度条推进
- [ ] 达到击杀数进入 LEVEL CLEAR
- [ ] 被敌人碰到扣命，归零 GAME OVER
- [ ] HUD 显示分数/关卡/生命

---

## 执行顺序总结

| Task | 内容 | 预计步骤 |
|------|------|---------|
| 1 | 骨架 + 菜单 + 星空 | 创建文件，验证菜单 |
| 2 | 玩家绘制 + 移动 + 瞄准 | 添加玩家系统 |
| 3 | 子弹 + 粒子特效 | 添加射击系统 |
| 4 | 敌人 AI + 绘制 | 添加敌人系统 |
| 5 | 碰撞 + HUD + 关卡 | 整合游戏逻辑 |
| 6 | 整合 + 准星 + 最终测试 | 完成并验证 |
