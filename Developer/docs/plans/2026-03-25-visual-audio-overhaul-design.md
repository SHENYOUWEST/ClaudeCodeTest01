# Visual, Audio & Gameplay Overhaul Design
Date: 2026-03-25

## Context
Bauhaus Bullet is a LOL movement trainer. Playtesting revealed three problems:
1. Start screen is unreadable (tiny fonts, low-contrast overlaid text)
2. Bullet density spikes at ~56s (climax segment causes sudden wall of bullets)
3. Visual and audio quality need elevation — reference: kdsj11-v8-enhanced-optimized-20251204-183500.html (Kandinsky/Bauhaus aesthetic, Web Audio API drone+chord synthesis)

Core design principle: **high difficulty throughout**, three movements provide different rhythmic challenges (not difficulty tiers) to train different LOL movement patterns.

---

## Problem 1: Start Screen

### Current State
- Text overlaid directly on game canvas
- 11px fonts at 20-35% opacity — unreadable
- No visual separation from gameplay

### Design
**Independent screen with slide transition:**
- Same black background as game (no style clash)
- Canvas-drawn Bauhaus geometric decoration (concentric circles + cross lines + corner squares)
- `BAUHAUS BULLET` — 52px monospace, white, 8px letter-spacing
- `LOL MOVEMENT TRAINER` — 13px, gold `#FFD600`, 4px letter-spacing
- Controls block — 16px, white 80% opacity, line-height 28px:
  - RIGHT-CLICK TO MOVE / HOLD TO FOLLOW
  - P — PAUSE
- High score — 15px gold, shown only when > 0
- Start prompt — 13px, white 40% opacity, breathing opacity animation (0.3↔0.7, 1.5s cycle)

**Transition animation:**
- Right-click start → start screen fades out (opacity 1→0, 400ms ease-in)
- Simultaneously game canvas fades in (opacity 0→1, 400ms)
- Implemented via CSS opacity on two layered `<canvas>` elements, or single canvas alpha overlay

### Files Affected
- `game/main.js` — rewrite `drawStartScreen()`, add transition state + timer
- `game/renderer.js` — optional: extract geometric decoration drawing

---

## Problem 2: Bullet Density — Rhythm Redesign

### Root Cause
Movement 1 climax at t=43.6s instantly spawns 5 bullets/beat. Movement 3 at 140 BPM random fires simultaneously. No gradual build.

### Design: Three Movements, Same High Difficulty, Different Rhythms

**Core principle:** Full density from beat 1 of each movement. No ramp-up, no sudden spikes.

#### Movement 1 — Puls (Steady Beat, Predictable but Dense)
- BPM: 110
- Character: Strict metronomic rhythm — players can "find the beat" but can never stop moving
- Spawns every beat: 4-directional fan from all 4 edges simultaneously (top+bottom+left+right), 2 dots per direction = 8 dots/beat
- Every 4 beats: ring burst from center, 8 dots
- Constant density throughout — NO climax escalation
- Total duration: ~60s of events

#### Movement 2 — Linie (Fast Pulse, Reaction Speed)
- BPM: 145
- Character: Fast, uneven bursts — demands quick directional decisions
- Every beat: 3 red lines from random edge, aimed at center
- Every 4 beats: "warning flash" — 1 pre-telegraphed beat of silence, then ring burst of 10 dots from center
- Every 8 beats: sweeping wall of 5 parallel lines across full canvas
- Constant high density, rhythm feels rushed and urgent

#### Movement 3 — Chaos (Irregular, Full Pressure)
- BPM: 160
- Character: No detectable pattern — simulates real LOL teamfight chaos
- Random interval (0.5–1.5 beats): 2–5 mixed type bullets from random-edge
- Every 5s: tracking triangle aimed directly at current player position
- Every 3s: ring burst of 6 rects from center
- Full chaos density from beat 1

### Berserk Overlay (unchanged principle, applies to all movements)
- Doubles spawn count of each event
- Triangle tracking frequency increases to every 2.5s
- Speed multiplier 1.4× (already implemented)

### Files Affected
- `game/patterns.js` — complete rewrite of all 3 movement timeline builders

---

## Problem 3: Visual & Audio Upgrade

### Visual Upgrades

#### Bullet Visual Quality
- **Dot bullets**: Add 2-layer glow (outer halo 10px radius at 20% opacity, inner core 5px at 60%) — no blur filter, pure circle overdraw
- **Line bullets**: Add 5-frame motion trail (draw previous 5 positions at decreasing opacity: 0.5, 0.35, 0.2, 0.1, 0.05)
- **Rect bullets**: Thin white inner highlight (1px inset stroke at 30% opacity)
- **Triangle bullets**: Keep red stroke, add faint red glow (radius = size × 1.5, 15% opacity)

#### Color Refinement (Kandinsky reference)
- dot: `#FFD600` (unchanged — golden yellow)
- line: `#E83020` (brighter red, was `#D40000`)
- rect: `#1E3FA0` (richer deep blue, was `#0048A0`)
- triangle: `#F5F0E8` fill + `#E83020` stroke (unchanged)

#### Background Enhancement
- Normal phase: Pure black + very subtle radial gradient (center `rgba(255,255,255,0.03)`, edges 0) — barely perceptible depth
- Berserk phase: Keep deep red, add per-frame noise overlay (1% opacity random gray pixels, 50 random dots/frame) for "static" feel

#### Player Hit Effect
- On `takeDamage()`: Screen-edge red vignette — 4 corner gradient fills, `rgba(200,0,0,0.35)`, fades over 300ms
- Tracked via `hitFlashTimer` in game state (0→1, decrements each frame)

#### Files Affected
- `game/renderer.js` — drawBullet (glow + trail), drawPlayer, draw (background noise), new drawHitFlash
- `game/bullets.js` — store position history (last 5 positions) for trail rendering
- `game/main.js` — add `hitFlashTimer` state, decrement in loop, pass to renderer

### Audio Upgrade — Replace Tone.js with Web Audio API

#### Architecture
```
OscillatorNode (drone) ─┐
OscillatorNode (harmonic) ─┤→ GainNode (master) → AudioContext.destination
NoiseSynth (percussion) ─┤
ChordOscillators ─────────┘
     ↑
BiquadFilterNode (modulated by game state)
```

No external dependencies. All synthesis via native Web Audio API.

#### Layers

**Drone (always running during gameplay):**
- Osc1: Sine, 55 Hz — volume 0.15
- Osc2: Triangle, 110.5 Hz — volume 0.08
- Lowpass filter: 150 Hz base, modulated:
  - Normal phase: 150 Hz
  - Berserk phase: ramps to 1800 Hz over 0.5s (harsh, aggressive)
  - Post-berserk: ramps back to 200 Hz over 1.0s

**Rhythm Layer (per-movement):**
- M1 Puls: Low drum hit — 80 Hz sine, 200ms decay, triggered each beat
- M2 Linie: Metal tick — 900 Hz sine, 40ms decay, triggered each beat
- M3 Chaos: Noise burst — white noise filtered at 2kHz, 60ms, random timing

**Chord Layer (pentatonic, movement-specific):**
- Triggered every 8 beats
- M1: C minor pentatonic [C3, Eb3, G3, Bb3, C4] — 2 random notes
- M2: F Lydian [F3, G3, A3, C4, E4] — 3 notes, faster attack
- M3: Chromatic random from [C3..B4] — 1-3 notes, dissonant
- Each chord: sine osc, 80ms attack, 1.5s exponential decay

**Impact Sounds:**
- Player hit: 80→20 Hz pitch sweep, 500ms + filtered noise burst (existing logic, rewritten)
- Berserk start: shockwave boom — 60 Hz, 300ms hard decay

#### Berserk Modulation
- BPM feel: rhythm layer trigger rate × 1.25 (faster ticks/drums)
- Volume: master gain +3dB
- Drone filter: 150→1800 Hz (already described)
- Chord layer: dissonance increases (add tritone interval)

#### Files Affected
- `game/audio.js` — complete rewrite using Web Audio API
- `game/index.html` — remove Tone.js CDN script tag
- `game/main.js` — update audio init call (async pattern unchanged)

---

## Execution Order

1. Patterns redesign (Problem 2) — most impactful, isolated file
2. Visual upgrades (Problem 3a) — renderer + bullets + main
3. Audio rewrite (Problem 3b) — audio.js + index.html
4. Start screen redesign (Problem 1) — main.js

---

## Files Summary

| File | Changes |
|---|---|
| `game/patterns.js` | Complete rewrite — 3 movement builders |
| `game/renderer.js` | Bullet glow+trail, background noise, hit flash, start screen geometry |
| `game/bullets.js` | Add position history array (last 5 positions) |
| `game/audio.js` | Complete rewrite — Web Audio API |
| `game/index.html` | Remove Tone.js script tag |
| `game/main.js` | hitFlashTimer state, transition animation, drawStartScreen rewrite |
