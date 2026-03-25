# Game Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply 9 gameplay/audio/UI improvements to Bauhaus Bullet based on playtesting feedback.

**Architecture:** All changes are isolated to existing JS modules (bullets, player, phase, patterns, audio, renderer, score, main). No new files needed. Each task targets one module or concern.

**Tech Stack:** Vanilla JS, HTML5 Canvas, Tone.js (audio), localStorage (high score)

---

### Task 1: Bullet base speed ×1.5 + berserk spawn speed fix

**Files:**
- Modify: `game/bullets.js` (BULLET_DEFS baseSpeed values)
- Modify: `game/patterns.js` (spawnFromEvent — pass speed multiplier at spawn)

**Step 1: Update baseSpeed values in bullets.js**

In `BH.BULLET_DEFS`, change:
```js
dot:      { ..., baseSpeed: 270, ... },   // was 180
line:     { ..., baseSpeed: 210, ... },   // was 140
rect:     { ..., baseSpeed: 120, ... },   // was 80
triangle: { ..., baseSpeed: 240, ... },   // was 160
```

**Step 2: Fix spawnFromEvent to apply berserk speed multiplier at spawn time**

In `game/patterns.js`, `spawnFromEvent` currently does:
```js
const speed = def.baseSpeed;
```

Change to:
```js
const speedMult = isBerserk ? 1.4 : 1.0;
const speed = def.baseSpeed * speedMult;
```

**Step 3: Verify visually**

Open `game/index.html` in browser. Let berserk phase trigger — bullets should visibly fly faster than normal phase.

**Step 4: Commit**
```bash
git add game/bullets.js game/patterns.js
git commit -m "feat: bullet base speed x1.5, fix berserk spawn speed multiplier"
```

---

### Task 2: HP system — maxHp=10, post-berserk heal +5

**Files:**
- Modify: `game/player.js`
- Modify: `game/score.js` (multiplier threshold)

**Step 1: Update player.js**

Change constructor:
```js
this.hp = 10;
this.maxHp = 10;
```

Replace `resetHpAfterBerserk()`:
```js
healAfterBerserk() {
  this.hp = Math.min(this.maxHp, this.hp + 5);
}
```

**Step 2: Update main.js call site**

In `game/main.js`, find:
```js
this.player.resetHpAfterBerserk();
```
Change to:
```js
this.player.healAfterBerserk();
```

**Step 3: Update score multiplier threshold in score.js**

In `Score.update()`, change:
```js
const multiplier = currentHp >= 8 ? 1.2 : 1.0;  // was >= 4
```

**Step 4: Verify visually**

Play until berserk ends — HP bar should show +5 healing (not reset to 5). HUD should show 10 cells.

**Step 5: Commit**
```bash
git add game/player.js game/main.js game/score.js
git commit -m "feat: maxHp=10, heal +5 after berserk (capped at 10)"
```

---

### Task 3: HUD — 10-cell HP bar

**Files:**
- Modify: `game/renderer.js` (drawHUD)

**Step 1: Update drawHUD HP rendering**

Current code draws `maxHp` cells at 14px with 6px gap. With 10 cells this is 194px wide — acceptable on any screen. But reduce sizes slightly for cleanliness:

```js
drawHUD(ctx, player, phase, score, canvasWidth) {
  // HP — 10 small rectangles, top-left
  const hpX = 20;
  const hpY = 20;
  const hpSize = 10;   // was 14
  const hpGap = 4;     // was 6
  for (let i = 0; i < player.maxHp; i++) {
    const x = hpX + i * (hpSize + hpGap);
    if (i < player.hp) {
      ctx.fillStyle = '#F5F0E8';
      ctx.fillRect(x, hpY, hpSize, hpSize);
    } else {
      ctx.strokeStyle = 'rgba(245,240,232,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, hpY, hpSize, hpSize);
    }
  }
  // ... rest unchanged
```

**Step 2: Verify**

10 filled cells at start, cells drain on hit, +5 refill after berserk.

**Step 3: Commit**
```bash
git add game/renderer.js
git commit -m "feat: HUD 10-cell HP bar, compact cell size"
```

---

### Task 4: Right-click controls

**Files:**
- Modify: `game/main.js`

**Step 1: Add state variable**

In `BH.Game`, add to the object:
```js
isRightHeld: false,
```

**Step 2: Replace handleClick + add new event listeners in init()**

Remove:
```js
this.canvas.addEventListener('click', (e) => this.handleClick(e));
```

Add:
```js
// Suppress right-click context menu
this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Right mouse button: mousedown
this.canvas.addEventListener('mousedown', async (e) => {
  if (e.button !== 2) return;
  if (!this.audioStarted) {
    await BH.Audio.init();
    this.audioStarted = true;
  }
  if (this.gameOver) { this.restart(); return; }
  if (!this.started) {
    this.started = true;
    this.musicTimeMs = 0;
    BH.Audio.playMovement(0);
  }
  if (this.paused) return;
  this.isRightHeld = true;
  this.player.setTarget(e.clientX, e.clientY);
});

// Follow mouse while held
this.canvas.addEventListener('mousemove', (e) => {
  if (!this.isRightHeld) return;
  this.player.setTarget(e.clientX, e.clientY);
});

// Release
this.canvas.addEventListener('mouseup', (e) => {
  if (e.button !== 2) return;
  this.isRightHeld = false;
});
```

**Step 3: Verify**

- Right-click: player moves to cursor
- Hold right button and drag: player follows continuously
- No browser context menu appears

**Step 4: Commit**
```bash
git add game/main.js
git commit -m "feat: right-click to move, hold to follow mouse"
```

---

### Task 5: Pause functionality

**Files:**
- Modify: `game/main.js`
- Modify: `game/renderer.js`

**Step 1: Add pause state to BH.Game**

```js
paused: false,
```

**Step 2: Add keyboard listener in init()**

```js
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (!this.started || this.gameOver) return;
    this.paused = !this.paused;
    if (this.paused) {
      BH.Audio.fadeVolume(-40, 0.5);
    } else {
      BH.Audio.fadeVolume(0, 0.5);
    }
  }
});
```

**Step 3: Guard update in loop()**

In `loop()`, wrap the update block:
```js
if (this.started && !this.gameOver && !this.paused) {
  // ... all existing update logic
}
```

**Step 4: Add pause overlay in renderer.js**

Add method `drawPause(ctx, w, h)`:
```js
drawPause(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F5F0E8';
  ctx.font = '28px monospace';
  ctx.fillText('PAUSED', w / 2, h / 2 - 20);
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(245,240,232,0.4)';
  ctx.fillText('PRESS P TO CONTINUE', w / 2, h / 2 + 20);
  ctx.textAlign = 'left';
},
```

**Step 5: Call drawPause in main.js loop()**

After the render block, add:
```js
if (this.paused) {
  BH.Renderer.drawPause(this.ctx, this.canvas.width, this.canvas.height);
}
```

**Step 6: Add fadeVolume to audio.js**

```js
fadeVolume(targetDb, durationSec) {
  if (!this.initialized) return;
  this.masterVol.volume.rampTo(targetDb, durationSec);
},
```

Note: `masterVol` is added in Task 6 as a master bus. Wire it then.

**Step 7: Verify**

P or Escape pauses game and music fades out. Press again — resumes.

**Step 8: Commit**
```bash
git add game/main.js game/renderer.js
git commit -m "feat: pause with P/Escape, music fades on pause"
```

---

### Task 6: Audio — master bus + crossfade + berserk modulation + synth FX

**Files:**
- Modify: `game/audio.js`

This is the largest audio task. Replace the entire audio.js with the improved version below.

**Step 1: Rewrite audio.js**

```js
window.BH = window.BH || {};

BH.Audio = {
  initialized: false,
  synths: {},
  buses: {},        // per-movement Tone.Volume nodes
  masterVol: null,
  distortion: null, // berserk bass distortion
  transport: null,
  currentMovement: -1,
  scheduledEvents: [],
  _origBpm: [110, 125, 140],  // original BPM per movement

  async init() {
    if (this.initialized) return;
    await Tone.start();

    // Master bus
    this.masterVol = new Tone.Volume(0).toDestination();

    // Berserk distortion on bass
    this.distortion = new Tone.Distortion(0.4);
    this.distortion.wet.value = 0;

    // Reverb for movement 1 bass
    this.reverb = new Tone.Reverb({ decay: 3.0, wet: 0.3 });
    await this.reverb.ready;

    // Delay for movement 2 pulse
    this.pingpong = new Tone.PingPongDelay('8n', 0.3);
    this.pingpong.wet.value = 0; // enabled only in M2

    // Bass synth chain: bass → distortion → reverb → masterVol
    this.synths.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.5 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5, baseFrequency: 80, octaves: 3 }
    }).connect(this.distortion);
    this.distortion.connect(this.reverb);
    this.reverb.connect(this.masterVol);

    // Pulse synth chain: pulse → pingpong → masterVol
    this.synths.pulse = new Tone.Synth({
      oscillator: { type: 'square4' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 }
    }).connect(this.pingpong);
    this.pingpong.connect(this.masterVol);
    this.synths.pulse.volume.value = -8;

    // Pad with longer attack/release
    this.synths.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.8, decay: 0.8, sustain: 0.4, release: 2.5 }
    }).connect(this.masterVol);
    this.synths.pad.volume.value = -12;

    // Noise — white for chaos, brown for others
    this.synths.noise = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 }
    }).connect(this.masterVol);
    this.synths.noise.volume.value = -15;

    // Hit / membrane
    this.synths.hit = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 }
    }).connect(this.masterVol);
    this.synths.hit.volume.value = -10;

    this.initialized = true;
  },

  playMovement(index) {
    if (this.currentMovement === index) return;
    this._startMovement(index);
  },

  crossfadeTo(index, duration = 1.5) {
    if (this.currentMovement === index) return;
    // Fade out current, then start new
    this.masterVol.volume.rampTo(-60, duration * 0.6);
    setTimeout(() => {
      this.stopAll();
      this._startMovement(index);
      this.masterVol.volume.value = -60;
      this.masterVol.volume.rampTo(0, duration * 0.4);
    }, duration * 600);
  },

  _startMovement(index) {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.currentMovement = index;

    // Configure FX per movement
    if (index === 0) {
      // M1 Puls: reverb on, pingpong off, noise brown
      this.reverb.wet.value = 0.3;
      this.pingpong.wet.value = 0;
      this.synths.noise.noise.type = 'brown';
    } else if (index === 1) {
      // M2 Linie: reverb off, pingpong on, noise brown
      this.reverb.wet.value = 0;
      this.pingpong.wet.value = 0.5;
      this.synths.noise.noise.type = 'brown';
    } else if (index === 2) {
      // M3 Chaos: reverb off, pingpong off, noise white
      this.reverb.wet.value = 0;
      this.pingpong.wet.value = 0;
      this.synths.noise.noise.type = 'white';
    }

    const movements = [this.movement1, this.movement2, this.movement3];
    movements[index].call(this);
    Tone.Transport.start();
  },

  enterBerserk() {
    if (!this.initialized) return;
    const idx = this.currentMovement >= 0 ? this.currentMovement : 0;
    const newBpm = this._origBpm[idx] * 1.25;
    Tone.Transport.bpm.rampTo(newBpm, 0.5);
    this.masterVol.volume.rampTo(4, 0.5);
    this.distortion.wet.rampTo(1.0, 0.5);
  },

  exitBerserk() {
    if (!this.initialized) return;
    const idx = this.currentMovement >= 0 ? this.currentMovement : 0;
    Tone.Transport.bpm.rampTo(this._origBpm[idx], 1.0);
    this.masterVol.volume.rampTo(0, 1.0);
    this.distortion.wet.rampTo(0, 1.0);
  },

  movement1() {
    const bpm = 110;
    Tone.Transport.bpm.value = bpm;
    const beat = '4n';

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.bass.triggerAttackRelease('C1', '8n', time);
    }, beat, 0);

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pulse.triggerAttackRelease('C5', '16n', time);
    }, '2n', 0);

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.noise.triggerAttackRelease('16n', time);
    }, '1n', 0);

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pad.triggerAttackRelease(['C3', 'Eb3', 'G3'], '2n', time);
    }, '2m', 0);
  },

  movement2() {
    const bpm = 125;
    Tone.Transport.bpm.value = bpm;

    const bassNotes = ['C1', 'C1', 'Eb1', 'F1'];
    let bassI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.bass.triggerAttackRelease(bassNotes[bassI % bassNotes.length], '8n', time);
      bassI++;
    }, '4n', 0);

    const melody = ['C4', 'Eb4', 'G4', 'Bb4', 'C5', 'Bb4', 'G4', 'Eb4'];
    let melI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pulse.triggerAttackRelease(melody[melI % melody.length], '16n', time);
      melI++;
    }, '8n', 0);

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.noise.triggerAttackRelease('32n', time);
    }, '4n', 0);
  },

  movement3() {
    const bpm = 140;
    Tone.Transport.bpm.value = bpm;

    const bassNotes = ['C1', 'Db1', 'E1', 'Gb1', 'A1'];
    let bassI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.bass.triggerAttackRelease(bassNotes[bassI % bassNotes.length], '16n', time);
      bassI++;
    }, '8t', 0);

    const chaosNotes = ['C5', 'Db5', 'E4', 'Gb5', 'A4', 'Bb5'];
    let chaosI = 0;
    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pulse.triggerAttackRelease(chaosNotes[chaosI % chaosNotes.length], '32n', time);
      chaosI++;
    }, '16t', 0);

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.noise.triggerAttackRelease('32n', time);
    }, '8n', 0);

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.pad.triggerAttackRelease(['C3', 'Db3', 'Gb3'], '4n', time);
    }, '1m', 0);

    Tone.Transport.scheduleRepeat((time) => {
      this.synths.hit.triggerAttackRelease('C1', time);
    }, '2n', 0);
  },

  playDamageSound() {
    if (!this.initialized) return;
    this.synths.hit.triggerAttackRelease('C1', Tone.now());
  },

  fadeVolume(targetDb, durationSec) {
    if (!this.initialized) return;
    this.masterVol.volume.rampTo(targetDb, durationSec);
  },

  stopAll() {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    this.currentMovement = -1;
  },

  getTimeMs() {
    return Tone.Transport.seconds * 1000;
  }
};
```

**Step 2: Wire enterBerserk/exitBerserk in main.js**

In the phase update block in `loop()`:
```js
if (this.phase.berserkJustStarted) {
  BH.Audio.enterBerserk();
}
if (this.phase.berserkJustEnded) {
  this.player.healAfterBerserk();
  BH.Audio.exitBerserk();
}
```

Note: `berserkJustStarted` is already set in phase.js.

**Step 3: Replace playMovement → crossfadeTo in movement-change handler**

In `loop()`:
```js
if (result === 'movement-change') {
  this.musicTimeMs = 0;
  Tone.Transport.position = 0;
  BH.Audio.crossfadeTo(BH.PatternEngine.currentMovement);
}
```

**Step 4: Verify**

- Each movement transition should fade smoothly (~1.5s), no hard cut
- Berserk: music speeds up + gets louder + bass distorts
- Post-berserk: all gradually returns to normal

**Step 5: Commit**
```bash
git add game/audio.js game/main.js
git commit -m "feat: audio crossfade, berserk BPM/volume/distortion modulation, synth FX chains"
```

---

### Task 7: Enhanced start screen + game-over with high score

**Files:**
- Modify: `game/renderer.js`
- Modify: `game/score.js`
- Modify: `game/main.js`

**Step 1: Add high score persistence to score.js**

Add to `Score` class:
```js
constructor() {
  this.value = 0;
  this.survivalTime = 0;
  this.highScore = parseInt(localStorage.getItem('bh_highscore') || '0', 10);
}

checkHighScore() {
  const current = Math.floor(this.value);
  if (current > this.highScore) {
    this.highScore = current;
    localStorage.setItem('bh_highscore', this.highScore.toString());
    return true; // new record
  }
  return false;
}

reset() {
  this.value = 0;
  this.survivalTime = 0;
  // highScore persists — don't reset
}
```

**Step 2: Track new record in main.js**

Add state:
```js
isNewRecord: false,
```

When game over triggers:
```js
if (this.player.isDead()) {
  this.gameOver = true;
  this.isNewRecord = this.score.checkHighScore();
  BH.Audio.stopAll();
}
```

Pass `isNewRecord` to drawGameOver:
```js
BH.Renderer.drawGameOver(this.ctx, this.score, this.canvas.width, this.canvas.height, this.isNewRecord);
```

Reset in restart():
```js
this.isNewRecord = false;
```

**Step 3: Rewrite drawStartScreen in main.js**

```js
drawStartScreen() {
  const ctx = this.ctx;
  const w = this.canvas.width;
  const h = this.canvas.height;

  ctx.textAlign = 'center';
  ctx.font = '32px monospace';
  ctx.fillStyle = '#F5F0E8';
  ctx.fillText('BAUHAUS BULLET', w / 2, h / 2 - 60);

  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(245,240,232,0.35)';
  ctx.fillText('RIGHT-CLICK TO MOVE', w / 2, h / 2);
  ctx.fillText('HOLD TO FOLLOW', w / 2, h / 2 + 18);
  ctx.fillText('P — PAUSE', w / 2, h / 2 + 40);

  if (this.score.highScore > 0) {
    ctx.font = '13px monospace';
    ctx.fillStyle = '#FFD600';
    ctx.fillText(`BEST  ${this.score.highScore.toString().padStart(5, '0')}`, w / 2, h / 2 + 76);
  }

  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(245,240,232,0.2)';
  ctx.fillText('RIGHT-CLICK TO BEGIN', w / 2, h / 2 + 108);

  ctx.textAlign = 'left';
},
```

**Step 4: Rewrite drawGameOver in renderer.js**

```js
drawGameOver(ctx, score, w, h, isNewRecord) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';

  if (isNewRecord) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#FFD600';
    ctx.fillText('NEW RECORD', w / 2, h / 2 - 80);
  }

  ctx.fillStyle = '#F5F0E8';
  ctx.font = '36px monospace';
  ctx.fillText(score.getDisplay(), w / 2, h / 2 - 40);

  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(245,240,232,0.6)';
  ctx.fillText(score.getTimeDisplay(), w / 2, h / 2);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#FFD600';
  ctx.fillText(`BEST  ${score.highScore.toString().padStart(5, '0')}`, w / 2, h / 2 + 34);

  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(245,240,232,0.3)';
  ctx.fillText('RIGHT-CLICK TO RESTART', w / 2, h / 2 + 70);

  ctx.textAlign = 'left';
},
```

**Step 5: Update restart trigger in main.js mousedown handler**

The restart was previously on left click. Now on right click mousedown when `this.gameOver`:
```js
if (this.gameOver) { this.restart(); return; }
```
This is already in the right-click handler from Task 4 — no extra change needed.

**Step 6: Verify**

- Start screen shows controls + high score if exists
- Game over shows score, time, best, NEW RECORD if applicable
- High score persists across page refreshes

**Step 7: Commit**
```bash
git add game/score.js game/renderer.js game/main.js
git commit -m "feat: high score (localStorage), enhanced start/gameover screens, new record label"
```

---

### Task 8: Bullet spawn randomization

**Files:**
- Modify: `game/patterns.js`

**Step 1: Replace fixed edge origins with random-edge**

In Movement 1 (`buildMovement1`):
- All `origin: 'top'` → `origin: 'random-edge'`
- All `origin: 'left'` / `origin: 'right'` → `origin: 'random-edge'`
- Keep `origin: 'center'` unchanged (ring bursts)

In Movement 2 (`buildMovement2`):
- All `origin: 'top'` → `origin: 'random-edge'`
- All `origin: 'left'` / `origin: 'right'` alternating → `origin: 'random-edge'`
- Keep `origin: 'center'` and `origin: 'random-edge'` unchanged

Movement 3 already uses `'random-edge'` and `'center'` — no change needed.

Also in Movement 1, the lines that set `angle: 0` or `angle: Math.PI` for left/right origins — **remove these** since the origin is now random-edge, and the default angle resolver (toward center) will handle direction.

**Step 2: Verify visually**

Bullets should appear from all four sides unpredictably, not just top or left/right patterns.

**Step 3: Commit**
```bash
git add game/patterns.js
git commit -m "feat: all bullet origins randomized to random-edge"
```

---

### Task 9: Final integration check + push

**Step 1: Full play test checklist**
- [ ] Bullets visibly faster (base ×1.5)
- [ ] Berserk phase: bullets even faster (×1.4 on top)
- [ ] HP bar shows 10 cells
- [ ] Berserk ends → HP increases by up to 5
- [ ] Right-click moves player, hold follows cursor
- [ ] No context menu on right-click
- [ ] P or Escape pauses; music fades; resume works
- [ ] Bullets spawn from random edges
- [ ] Movement transitions crossfade (no hard cut)
- [ ] Berserk: BPM faster, louder, bass distorted
- [ ] Post-berserk: music gradually returns
- [ ] Start screen shows controls + high score
- [ ] Game over shows NEW RECORD when applicable
- [ ] High score persists after page refresh

**Step 2: Git push**
```bash
git push
```

**Step 3: Update CLAUDE.md architecture section if needed**

If HP, controls, or audio architecture changed significantly, update the relevant section in `CLAUDE.md`.

---

## Summary of All Commits

1. `feat: bullet base speed x1.5, fix berserk spawn speed multiplier`
2. `feat: maxHp=10, heal +5 after berserk (capped at 10)`
3. `feat: HUD 10-cell HP bar, compact cell size`
4. `feat: right-click to move, hold to follow mouse`
5. `feat: pause with P/Escape, music fades on pause`
6. `feat: audio crossfade, berserk BPM/volume/distortion modulation, synth FX chains`
7. `feat: high score (localStorage), enhanced start/gameover screens, new record label`
8. `feat: all bullet origins randomized to random-edge`
9. Push all to GitHub
