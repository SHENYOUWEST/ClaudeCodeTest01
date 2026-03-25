# Visual, Audio & Gameplay Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the start screen UI, fix the 56-second bullet density spike, elevate visual quality with Kandinsky-inspired effects, and replace Tone.js with a Web Audio API synthesizer.

**Architecture:** Four independent modules modified in sequence: patterns.js (bullet rhythm), renderer.js + bullets.js + main.js (visual effects), audio.js + index.html (audio engine), main.js (start screen). Each task is self-contained with a single commit.

**Tech Stack:** Vanilla JS, HTML5 Canvas 2D, Web Audio API (replaces Tone.js)

---

### Task 1: Redesign three movement timelines — high difficulty, distinct rhythms

**Files:**
- Modify: `game/patterns.js` (complete rewrite of the three IIFE builders, keep PatternEngine object)

**Context:**
- `BH.PatternEngine` object (lines 3-81) stays unchanged — only the three `buildMovementN` IIFEs at the bottom are replaced
- `spawnFromEvent` uses `event.origin`, `event.type`, `event.count`, `event.spread`, `event.angle`
- Valid origins: `'top'`, `'bottom'`, `'left'`, `'right'`, `'center'`, `'random-edge'`
- Valid types: `'dot'`, `'line'`, `'rect'`, `'triangle'`
- Valid spreads: `'fan'` (aimed toward center), `'ring'` (outward circle), `undefined` (toward center)
- Berserk doubles `count` automatically in `spawnFromEvent`

**Step 1: Read patterns.js lines 83-191 to confirm current structure**

**Step 2: Replace the three IIFE builders with the new versions**

Replace everything from `// === MOVEMENT TIMELINES ===` (line 83) to end of file:

```js
// === MOVEMENT TIMELINES ===
BH.PATTERNS = [];

// Movement 1: Puls — steady metronomic beat, predictable but relentless (BPM 110)
// LOL skill: timing-based dodging — player can "feel" the rhythm but must keep moving
(function buildMovement1() {
  const m = [];
  const bpm = 110;
  const beat = 60000 / bpm;

  // Full density from beat 1: 4-directional fan every beat
  // 2 dots per edge × 4 edges = 8 dots per beat — dense but patterned
  for (let i = 0; i < 80; i++) {
    // Top edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'top', count: 2, spread: 'fan' });
    // Bottom edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'bottom', count: 2, spread: 'fan' });
    // Left edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'left', count: 2, spread: 'fan' });
    // Right edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'right', count: 2, spread: 'fan' });
    // Every 4 beats: ring burst from center — forces positional repositioning
    if (i % 4 === 0) {
      m.push({ t: i * beat, type: 'dot', origin: 'center', count: 8, spread: 'ring' });
    }
    // Every 8 beats: blue rect wall from random edge — adds visual clutter
    if (i % 8 === 0) {
      m.push({ t: i * beat, type: 'rect', origin: 'random-edge', count: 3 });
    }
  }

  m.sort((a, b) => a.t - b.t);
  BH.PATTERNS.push(m);
})();

// Movement 2: Linie — fast urgent pulses, reaction speed challenge (BPM 145)
// LOL skill: quick directional decisions under pressure
(function buildMovement2() {
  const m = [];
  const bpm = 145;
  const beat = 60000 / bpm;

  for (let i = 0; i < 90; i++) {
    // Every beat: 3 fast red lines from random edge aimed at center
    m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 3 });

    // Every 4 beats: "warning" then ring burst — telegraphed but fast
    if (i % 4 === 0) {
      // Ring burst offset by half a beat (arrives fast after the regular lines)
      m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'center', count: 10, spread: 'ring' });
    }

    // Every 8 beats: sweeping wall of 5 parallel lines from alternating sides
    if (i % 8 === 0) {
      m.push({ t: i * beat, type: 'line', origin: 'top', count: 5, spread: 'fan' });
      m.push({ t: i * beat + beat * 0.25, type: 'line', origin: 'bottom', count: 5, spread: 'fan' });
    }

    // Every 6 beats: blue rect burst adds spatial complexity
    if (i % 6 === 0) {
      m.push({ t: i * beat + beat * 0.3, type: 'rect', origin: 'random-edge', count: 2 });
    }
  }

  m.sort((a, b) => a.t - b.t);
  BH.PATTERNS.push(m);
})();

// Movement 3: Chaos — irregular rhythm, mixed types, full LOL teamfight simulation (BPM 160)
// LOL skill: reading chaos, finding safe pockets under maximum pressure
(function buildMovement3() {
  const m = [];
  const bpm = 160;
  const beat = 60000 / bpm;

  // Base layer: randomized mixed fire at high BPM
  for (let i = 0; i < 110; i++) {
    // Variable jitter creates irregular timing — no pattern to memorize
    const jitter = (Math.random() - 0.5) * beat * 0.8;
    const t = Math.max(0, i * beat + jitter);
    const types = ['dot', 'line', 'rect'];
    const type = types[Math.floor(Math.random() * types.length)];
    const count = Math.floor(Math.random() * 4) + 2; // 2–5
    const spreads = ['fan', 'ring', undefined];

    m.push({
      t,
      type,
      origin: 'random-edge',
      count,
      spread: type === 'dot' ? spreads[Math.floor(Math.random() * spreads.length)] : undefined
    });
  }

  // Periodic ring bursts from center — creates sudden radial pressure
  for (let i = 0; i < 20; i++) {
    m.push({ t: i * beat * 8, type: 'dot', origin: 'center', count: 8, spread: 'ring' });
    m.push({ t: i * beat * 8 + beat * 3, type: 'rect', origin: 'center', count: 6, spread: 'ring' });
  }

  m.sort((a, b) => a.t - b.t);
  BH.PATTERNS.push(m);
})();
```

**Step 3: Also update the berserk triangle tracking in main.js**

In `game/main.js`, find the berserk triangle block (around line 138-158). Change the triangle speed from `160` to `200` and interval from `3` to `2.5`:
```js
if (this.berserkTriangleTimer >= 2.5) {
  this.berserkTriangleTimer -= 2.5;
  ...
  vx: Math.cos(angle) * 200,
  vy: Math.sin(angle) * 200
```

**Step 4: Verify**

Open `game/index.html`. Play through Movement 1 — should feel relentlessly rhythmic with no sudden spikes. Movement 2 — faster, more urgent. Movement 3 — chaotic, no detectable pattern.

**Step 5: Commit**
```bash
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer add game/patterns.js game/main.js
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer commit -m "feat: redesign 3 movement timelines — high density, rhythm-distinct, LOL movement training"
```

---

### Task 2: Bullet visual quality — glow, trails, refined colors

**Files:**
- Modify: `game/bullets.js` (add position history tracking)
- Modify: `game/renderer.js` (glow + trail drawing, refined colors)

**Context:**
- `BH.Bullet` constructor is in bullets.js lines 10-27
- `BH.Bullet.update()` is lines 36-39 — called every frame
- `BH.Renderer.drawBullet()` is in renderer.js lines 51-77
- Trail needs last 5 positions stored on each bullet

**Step 1: Read bullets.js and renderer.js**

**Step 2: Update bullets.js — add color refinements and position history**

In `BH.BULLET_DEFS`, change line color and rect color:
```js
BH.BULLET_DEFS = {
  dot:      { color: '#FFD600', radius: 5,  baseSpeed: 270, shape: 'circle' },
  line:     { color: '#E83020', width: 32, height: 3, baseSpeed: 210, shape: 'rect' },
  rect:     { color: '#1E3FA0', width: 14, height: 14, baseSpeed: 120, shape: 'rect' },
  triangle: { color: '#F5F0E8', stroke: '#E83020', size: 14, baseSpeed: 240, shape: 'triangle' }
};
```

In `BH.Bullet` constructor, after `this.size = def.size || 0;` add:
```js
    this.trail = []; // last 5 positions for motion trail
```

In `BH.Bullet.update()`, record position BEFORE moving:
```js
  update(dt, speedMultiplier) {
    // Record position for trail (keep last 5)
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x += this.vx * speedMultiplier * dt;
    this.y += this.vy * speedMultiplier * dt;
  }
```

**Step 3: Update renderer.js — glow + trail for each bullet type**

Replace `drawBullet(ctx, b)` entirely:
```js
  drawBullet(ctx, b) {
    ctx.save();

    // --- Motion trail (line and triangle bullets only) ---
    if ((b.shape === 'rect' && b.width > b.height) || b.shape === 'triangle') {
      // line bullets (width=32, height=3) and triangles get trails
      const trailOpacities = [0.08, 0.12, 0.18, 0.28, 0.4];
      for (let i = 0; i < b.trail.length; i++) {
        const tp = b.trail[i];
        const alpha = trailOpacities[i] || 0.08;
        ctx.globalAlpha = alpha;
        if (b.shape === 'triangle') {
          const s = b.size * 0.8;
          ctx.beginPath();
          ctx.moveTo(tp.x, tp.y - s / 2);
          ctx.lineTo(tp.x - s / 2, tp.y + s / 2);
          ctx.lineTo(tp.x + s / 2, tp.y + s / 2);
          ctx.closePath();
          ctx.fillStyle = b.color;
          ctx.fill();
        } else {
          ctx.fillStyle = b.color;
          ctx.fillRect(tp.x - b.width / 2, tp.y - b.height / 2, b.width, b.height);
        }
      }
      ctx.globalAlpha = 1;
    }

    // --- Main bullet body ---
    if (b.shape === 'circle') {
      // Dot: outer glow (halo) + core
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,214,0,0.15)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,214,0,0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();

    } else if (b.shape === 'rect') {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      // Thin white highlight on rect (non-line) bullets
      if (b.width === b.height) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x - b.width / 2 + 1, b.y - b.height / 2 + 1, b.width - 2, b.height - 2);
      }

    } else if (b.shape === 'triangle') {
      const s = b.size;
      // Faint glow halo
      ctx.beginPath();
      ctx.arc(b.x, b.y, s * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,48,32,0.12)';
      ctx.fill();

      // Triangle body
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
```

**Step 4: Verify visually**

Dot bullets should have a soft golden halo. Line/triangle bullets should leave a faint trail showing their direction. Rect bullets should have a subtle inner highlight.

**Step 5: Commit**
```bash
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer add game/bullets.js game/renderer.js
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer commit -m "feat: bullet glow + motion trails, Kandinsky color refinement"
```

---

### Task 3: Background noise + hit flash effect

**Files:**
- Modify: `game/renderer.js` (background noise overlay, new drawHitFlash method)
- Modify: `game/main.js` (hitFlashTimer state, decrement, pass to renderer)

**Context:**
- `BH.Renderer.draw()` draws background at lines 9-16
- `BH.Game` object properties declared lines 4-18
- `player.takeDamage()` is called in collision.js — we detect hit via `player.invincible` becoming true

**Step 1: Add hitFlashTimer to main.js**

Add `hitFlashTimer: 0,` to BH.Game properties (after `berserkTriangleTimer: 0,`).

In `loop()`, after collision check (after line 165), add:
```js
      // Hit flash detection — invincible just became true this frame
      if (this.player.invincible && this.player.invincibleTimer >= this.player.invincibleDuration - 0.05) {
        this.hitFlashTimer = 1.0; // full flash
      }
      if (this.hitFlashTimer > 0) {
        this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt * 5); // decay over 0.2s
      }
```

Pass `hitFlashTimer` to renderer — change the `BH.Renderer.draw(this.ctx, this)` call stays the same (renderer already receives `game`).

**Step 2: Add background noise overlay to renderer.js**

In `BH.Renderer.draw()`, after the grid drawing block (after line 37), add:
```js
    // === Berserk noise overlay ===
    if (phase.isBerserk && phase.transitionProgress > 0.5) {
      const noiseAlpha = (phase.transitionProgress - 0.5) * 0.06; // max 0.03
      for (let n = 0; n < 60; n++) {
        const nx = Math.random() * w;
        const ny = Math.random() * h;
        const nb = Math.floor(Math.random() * 120 + 80);
        ctx.fillStyle = `rgba(${nb},${nb},${nb},${noiseAlpha})`;
        ctx.fillRect(nx, ny, 2, 2);
      }
    }
```

**Step 3: Add drawHitFlash method to renderer.js**

After `drawPause` method, add:
```js
  drawHitFlash(ctx, w, h, intensity) {
    if (intensity <= 0) return;
    const alpha = intensity * 0.4;
    // Four corner vignettes in red
    const size = Math.min(w, h) * 0.35;
    // Top-left
    const tl = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    tl.addColorStop(0, `rgba(200,0,0,${alpha})`);
    tl.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = tl; ctx.fillRect(0, 0, size, size);
    // Top-right
    const tr = ctx.createRadialGradient(w, 0, 0, w, 0, size);
    tr.addColorStop(0, `rgba(200,0,0,${alpha})`);
    tr.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = tr; ctx.fillRect(w - size, 0, size, size);
    // Bottom-left
    const bl = ctx.createRadialGradient(0, h, 0, 0, h, size);
    bl.addColorStop(0, `rgba(200,0,0,${alpha})`);
    bl.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = bl; ctx.fillRect(0, h - size, size, size);
    // Bottom-right
    const br = ctx.createRadialGradient(w, h, 0, w, h, size);
    br.addColorStop(0, `rgba(200,0,0,${alpha})`);
    br.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = br; ctx.fillRect(w - size, h - size, size, size);
  },
```

**Step 4: Call drawHitFlash in main.js loop()**

After `BH.Renderer.draw(this.ctx, this)` in loop():
```js
    if (this.hitFlashTimer > 0) {
      BH.Renderer.drawHitFlash(this.ctx, this.canvas.width, this.canvas.height, this.hitFlashTimer);
    }
```

**Step 5: Commit**
```bash
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer add game/renderer.js game/main.js
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer commit -m "feat: berserk background noise, screen-edge red hit flash"
```

---

### Task 4: Redesign start screen — readable UI with Bauhaus geometry

**Files:**
- Modify: `game/main.js` (rewrite drawStartScreen, add startScreenAlpha transition state)

**Context:**
- `drawStartScreen()` is lines 194-221 of main.js — currently overlaid directly on game canvas
- `this.started` controls whether start screen shows (line 187)
- The transition: on right-click, `this.started` becomes true. We add a fade-out overlay that decays from 1→0 over 400ms

**Step 1: Add startScreenAlpha state to BH.Game**

Add to properties: `startScreenAlpha: 1.0,`

In `loop()`, after `if (this.started && !this.gameOver && !this.paused) {` block opens (line 110), add at the very top of that block:
```js
      // Fade out start screen overlay
      if (this.startScreenAlpha > 0) {
        this.startScreenAlpha = Math.max(0, this.startScreenAlpha - dt * 2.5); // 400ms fade
      }
```

In `restart()`, add: `this.startScreenAlpha = 1.0;`

**Step 2: Rewrite drawStartScreen()**

Replace the entire `drawStartScreen()` method:

```js
  drawStartScreen() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.save();

    // === Bauhaus geometric decoration ===
    // Large outer circle (unfilled, thin stroke)
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,240,232,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Medium circle
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,240,232,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Horizontal cross line
    ctx.beginPath();
    ctx.moveTo(cx - Math.min(w, h) * 0.38, cy);
    ctx.lineTo(cx + Math.min(w, h) * 0.38, cy);
    ctx.strokeStyle = 'rgba(245,240,232,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vertical cross line
    ctx.beginPath();
    ctx.moveTo(cx, cy - Math.min(w, h) * 0.38);
    ctx.lineTo(cx, cy + Math.min(w, h) * 0.38);
    ctx.stroke();

    // Corner accent squares (Bauhaus style)
    const sq = 8;
    const pad = 40;
    ctx.fillStyle = 'rgba(255,214,0,0.4)';
    ctx.fillRect(pad, pad, sq, sq);
    ctx.fillRect(w - pad - sq, pad, sq, sq);
    ctx.fillRect(pad, h - pad - sq, sq, sq);
    ctx.fillRect(w - pad - sq, h - pad - sq, sq, sq);

    // Red accent line — top of title area
    ctx.fillStyle = '#E83020';
    ctx.fillRect(cx - 60, cy - 92, 120, 2);

    // === Typography ===
    ctx.textAlign = 'center';

    // Main title — large, clear
    ctx.font = 'bold 52px monospace';
    ctx.letterSpacing = '4px';
    ctx.fillStyle = '#F5F0E8';
    ctx.fillText('BAUHAUS BULLET', cx, cy - 60);

    // Subtitle — gold, smaller
    ctx.font = '13px monospace';
    ctx.fillStyle = '#FFD600';
    ctx.fillText('LOL MOVEMENT TRAINER', cx, cy - 36);

    // Divider
    ctx.fillStyle = 'rgba(245,240,232,0.15)';
    ctx.fillRect(cx - 80, cy - 20, 160, 1);

    // Controls — clearly readable
    ctx.font = '15px monospace';
    ctx.fillStyle = 'rgba(245,240,232,0.8)';
    ctx.fillText('RIGHT-CLICK  ·  MOVE / HOLD TO FOLLOW', cx, cy + 10);
    ctx.fillText('P  ·  PAUSE', cx, cy + 34);

    // High score
    if (this.score.highScore > 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = '#FFD600';
      ctx.fillText(`BEST  ${this.score.highScore.toString().padStart(5, '0')}`, cx, cy + 68);
    }

    // Start prompt — breathing animation
    const breathAlpha = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(performance.now() * 0.002));
    ctx.font = '13px monospace';
    ctx.fillStyle = `rgba(245,240,232,${breathAlpha.toFixed(2)})`;
    ctx.fillText('RIGHT-CLICK TO BEGIN', cx, cy + (this.score.highScore > 0 ? 100 : 80));

    ctx.restore();
    ctx.letterSpacing = '0px'; // reset
  },
```

**Step 3: Add fade-out overlay when game just started**

In `loop()`, in the render section (after `BH.Renderer.draw`), modify the start screen condition:
```js
    // Start screen: show if not started, or fade out during transition
    if (!this.started) {
      this.drawStartScreen();
    } else if (this.startScreenAlpha > 0) {
      // Fade out overlay
      ctx.save();
      ctx.globalAlpha = this.startScreenAlpha;
      this.drawStartScreen();
      ctx.restore();
    }
```

Remove the old `else if (!this.started)` block and replace with the above.

**Step 4: Commit**
```bash
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer add game/main.js
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer commit -m "feat: redesign start screen — Bauhaus geometry, readable typography, fade-out transition"
```

---

### Task 5: Replace Tone.js with Web Audio API synthesizer

**Files:**
- Modify: `game/audio.js` — complete rewrite
- Modify: `game/index.html` — remove Tone.js CDN script tag

**Context:**
- Current audio.js uses Tone.js heavily (Tone.Transport, Tone.Synth, etc.)
- main.js calls: `BH.Audio.init()`, `BH.Audio.playMovement(0)`, `BH.Audio.crossfadeTo(index)`, `BH.Audio.enterBerserk()`, `BH.Audio.exitBerserk()`, `BH.Audio.fadeVolume(db, sec)`, `BH.Audio.stopAll()`, `BH.Audio.getTimeMs()`, `BH.Audio.playDamageSound()`
- All these method signatures must be preserved exactly
- `getTimeMs()` is used to sync bullet patterns to music time. With Web Audio, use `audioCtx.currentTime * 1000`
- The pattern engine uses `musicTimeMs` — it must increment reliably. Fall back to `dt * 1000` if audio not initialized (already handled in main.js line 123-127)

**Step 1: Remove Tone.js from index.html**

In `game/index.html`, remove:
```html
<script src="https://cdn.jsdelivr.net/npm/tone@14/build/Tone.min.js"></script>
```

**Step 2: Rewrite audio.js completely**

```js
window.BH = window.BH || {};

BH.Audio = {
  initialized: false,
  ctx: null,          // AudioContext
  masterGain: null,   // master volume GainNode
  droneOsc1: null,    // 55 Hz sine — low drone
  droneOsc2: null,    // 110.5 Hz triangle — harmonic
  droneFilter: null,  // BiquadFilter on drone chain
  droneGain: null,
  currentMovement: -1,
  _rhythmTimer: 0,    // seconds since last rhythm tick
  _chordTimer: 0,     // seconds since last chord
  _startTime: 0,      // audioCtx.currentTime when gameplay started
  _bpmMultiplier: 1.0,// 1.0 normal, 1.25 berserk
  _movementBpm: [110, 145, 160],
  _masterDb: 0,       // current target dB

  // Movement-specific rhythm parameters
  _movementConfig: [
    // M1 Puls: low drum at 80Hz, C minor pentatonic, interval 1 beat
    { rhythmFreq: 80, rhythmDur: 0.18, rhythmVol: 0.35, chordRoot: 130.81, chordScale: [1, 1.2, 1.5, 1.8, 2.0], chordNotes: 2, chordVol: 0.12 },
    // M2 Linie: metal tick at 900Hz, F Lydian, interval 0.5 beat
    { rhythmFreq: 900, rhythmDur: 0.04, rhythmVol: 0.25, chordRoot: 174.61, chordScale: [1, 1.122, 1.26, 1.498, 1.682], chordNotes: 3, chordVol: 0.10 },
    // M3 Chaos: noise burst (freq unused), chromatic random, interval 0.3–0.8 beat
    { rhythmFreq: 0, rhythmDur: 0.06, rhythmVol: 0.20, chordRoot: 130.81, chordScale: [1,1.059,1.122,1.189,1.260,1.335,1.414,1.498,1.587,1.682,1.782,1.888,2.0], chordNotes: 2, chordVol: 0.08 }
  ],
  _nextChaosInterval: 0.3,

  async init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain (volume control)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    // Feedback delay for ambience (0.35s delay, 0.4 feedback)
    this._delayNode = this.ctx.createDelay(1.0);
    this._delayNode.delayTime.value = 0.35;
    this._feedbackGain = this.ctx.createGain();
    this._feedbackGain.gain.value = 0.38;
    this._delayNode.connect(this._feedbackGain);
    this._feedbackGain.connect(this._delayNode);
    this._delayNode.connect(this.masterGain);

    // Drone: osc1 (sine 55Hz) + osc2 (triangle 110.5Hz) → filter → droneGain → master
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 150;
    this.droneFilter.Q.value = 1.0;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0; // starts silent, fades in on playMovement

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.value = 55;

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 110.5;

    const droneGain1 = this.ctx.createGain(); droneGain1.gain.value = 0.15;
    const droneGain2 = this.ctx.createGain(); droneGain2.gain.value = 0.08;

    this.droneOsc1.connect(droneGain1); droneGain1.connect(this.droneFilter);
    this.droneOsc2.connect(droneGain2); droneGain2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();

    this.initialized = true;
  },

  // Called from main.js game loop every frame when playing
  // dt = delta time in seconds, isBerserk = boolean
  tick(dt, isBerserk) {
    if (!this.initialized || this.currentMovement < 0) return;
    const cfg = this._movementConfig[this.currentMovement];
    const bpm = this._movementBpm[this.currentMovement] * this._bpmMultiplier;
    const beatSec = 60 / bpm;

    // Rhythm layer tick
    const rhythmInterval = this.currentMovement === 1 ? beatSec * 0.5
                         : this.currentMovement === 2 ? this._nextChaosInterval
                         : beatSec;

    this._rhythmTimer += dt;
    if (this._rhythmTimer >= rhythmInterval) {
      this._rhythmTimer -= rhythmInterval;
      if (this.currentMovement === 2) {
        this._nextChaosInterval = (0.3 + Math.random() * 0.5) * beatSec;
        this._triggerNoise(cfg.rhythmDur, cfg.rhythmVol);
      } else {
        this._triggerTone(cfg.rhythmFreq, cfg.rhythmDur, cfg.rhythmVol);
      }
    }

    // Chord layer: every 8 beats
    this._chordTimer += dt;
    const chordInterval = beatSec * 8;
    if (this._chordTimer >= chordInterval) {
      this._chordTimer -= chordInterval;
      this._triggerChord(cfg, isBerserk);
    }
  },

  _triggerTone(freq, duration, vol) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this._delayNode);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  },

  _triggerNoise(duration, vol) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 800;
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this._delayNode);
    source.start(now);
  },

  _triggerChord(cfg, isBerserk) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const scale = cfg.chordScale;
    // Pick random notes from scale
    const noteCount = cfg.chordNotes + (isBerserk ? 1 : 0);
    const indices = [];
    while (indices.length < Math.min(noteCount, scale.length)) {
      const idx = Math.floor(Math.random() * scale.length);
      if (!indices.includes(idx)) indices.push(idx);
    }
    for (const idx of indices) {
      const freq = cfg.chordRoot * scale[idx];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Berserk adds slight detune for dissonance
      if (isBerserk) osc.detune.value = (Math.random() - 0.5) * 30;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(cfg.chordVol, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.connect(gain);
      gain.connect(this._delayNode);
      osc.start(now);
      osc.stop(now + 1.6);
    }
  },

  playMovement(index) {
    if (!this.initialized) return;
    if (this.currentMovement === index) return;
    this.currentMovement = index;
    this._rhythmTimer = 0;
    this._chordTimer = 0;
    this._startTime = this.ctx.currentTime;
    // Fade drone in
    this.droneGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.droneGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 0.5);
    // Set drone filter for this movement
    const targetFilter = index === 0 ? 150 : index === 1 ? 250 : 180;
    this.droneFilter.frequency.setTargetAtTime(targetFilter, this.ctx.currentTime, 0.3);
  },

  crossfadeTo(index, duration) {
    if (!this.initialized) return;
    if (this.currentMovement === index) return;
    const d = duration !== undefined ? duration : 1.5;
    // Fade out
    this.masterGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + d * 0.6);
    setTimeout(() => {
      this.currentMovement = index;
      this._rhythmTimer = 0;
      this._chordTimer = 0;
      this._startTime = this.ctx.currentTime;
      const targetFilter = index === 0 ? 150 : index === 1 ? 250 : 180;
      this.droneFilter.frequency.value = targetFilter;
      // Fade back in
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + d * 0.4);
    }, d * 600);
  },

  enterBerserk() {
    if (!this.initialized) return;
    this._bpmMultiplier = 1.25;
    // Drone filter opens up — harsh
    this.droneFilter.frequency.setTargetAtTime(1800, this.ctx.currentTime, 0.5);
    // Volume bump
    this.masterGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.4);
  },

  exitBerserk() {
    if (!this.initialized) return;
    this._bpmMultiplier = 1.0;
    // Drone filter returns
    const idx = this.currentMovement >= 0 ? this.currentMovement : 0;
    const targetFilter = idx === 0 ? 150 : idx === 1 ? 250 : 180;
    this.droneFilter.frequency.setTargetAtTime(targetFilter, this.ctx.currentTime, 1.0);
    this.masterGain.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.8);
  },

  playDamageSound() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    // Pitch sweep down: 80Hz → 20Hz over 0.5s
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.55);

    // Noise burst layer
    const bufSize = Math.floor(this.ctx.sampleRate * 0.15);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(400, now);
    filt.frequency.linearRampToValueAtTime(4000, now + 0.15);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.3, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(filt); filt.connect(ng); ng.connect(this.masterGain);
    src.start(now);
  },

  fadeVolume(targetDb, durationSec) {
    if (!this.initialized) return;
    // Convert dB to linear gain: 0dB = 0.8 (our nominal), -40dB ≈ 0
    const targetGain = targetDb <= -40 ? 0.001 : 0.8 * Math.pow(10, targetDb / 20);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + durationSec);
  },

  stopAll() {
    if (!this.initialized) return;
    this.droneGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    this.currentMovement = -1;
  },

  getTimeMs() {
    if (!this.initialized || this._startTime === 0) return 0;
    return (this.ctx.currentTime - this._startTime) * 1000;
  }
};
```

**Step 3: Wire tick() call in main.js**

The new audio engine needs `BH.Audio.tick(dt, isBerserk)` called each frame. In `loop()`, inside the `if (this.started && !this.gameOver && !this.paused)` block, add after `this.phase.update(dt)`:
```js
      // Audio tick — drives rhythm and chord layers
      BH.Audio.tick(dt, this.phase.isBerserk);
```

Also update the `musicTimeMs` block — `getTimeMs()` now returns time since `playMovement` was last called, which is what the pattern engine needs:
```js
      if (BH.Audio.initialized) {
        this.musicTimeMs = BH.Audio.getTimeMs();
      } else {
        this.musicTimeMs += dt * 1000;
      }
```
This is already correct — no change needed.

**Step 4: Verify audio in browser**

Open `game/index.html`. Right-click to start. You should hear:
- A low drone humming immediately
- Rhythmic drum hits (M1: low thud every beat)
- Chord tones every ~8 beats
- Berserk: drone gets harsh, rhythm speeds up
- Damage: descending pitch swoosh

**Step 5: Commit**
```bash
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer add game/audio.js game/index.html game/main.js
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer commit -m "feat: replace Tone.js with Web Audio API — drone+rhythm+chord synthesis, berserk modulation"
```

---

### Task 6: Integration check, update tests, push

**Files:**
- Modify: `game/tests/test.html` (no player API changes this session, but verify)
- Push to GitHub

**Step 1: Check for any broken references**

In main.js, verify:
- `BH.Audio.tick` is called once per frame ✓ (added in Task 5)
- `BH.Audio.playDamageSound()` still exists ✓
- `BH.Audio.getTimeMs()` still works ✓

**Step 2: Full playtest checklist**
- [ ] Start screen: readable title (52px), subtitle in gold, controls at 15px, breathing start prompt
- [ ] Fade transition: start screen fades out smoothly on first right-click
- [ ] Movement 1: relentless 4-directional fan from all edges every beat, center ring every 4 beats
- [ ] Movement 2: fast urgent lines at 145 BPM, ring burst every 4 beats
- [ ] Movement 3: pure chaos, no pattern, random intervals
- [ ] No sudden 56-second density spike in any movement
- [ ] Dot bullets have soft golden halo
- [ ] Line and triangle bullets leave a faint motion trail
- [ ] Berserk: background gets subtle static noise overlay
- [ ] Player hit: screen edges flash red briefly
- [ ] Audio: drone audible, rhythm hits per movement, berserk changes drone character
- [ ] Damage sound: pitch-down swoop

**Step 3: Push**
```bash
git -C /e/vs.code/Projects/ClaudeCodeTest01/Developer push
```

**Step 4: Update design doc commit if needed**
```bash
git -C /e/vs.code/Projects/ClaudeCodeTest01 push
```

---

## Summary of Commits

1. `feat: redesign 3 movement timelines — high density, rhythm-distinct, LOL movement training`
2. `feat: bullet glow + motion trails, Kandinsky color refinement`
3. `feat: berserk background noise, screen-edge red hit flash`
4. `feat: redesign start screen — Bauhaus geometry, readable typography, fade-out transition`
5. `feat: replace Tone.js with Web Audio API — drone+rhythm+chord synthesis, berserk modulation`
6. Push to GitHub
