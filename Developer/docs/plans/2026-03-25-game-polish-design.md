# Bauhaus Bullet — Game Polish Design
Date: 2026-03-25

## Overview
Nine improvements to gameplay feel, controls, audio, and UI based on playtesting feedback.

---

## 1. Berserk Bullet Speed Fix
**Problem:** `spawnFromEvent()` uses `def.baseSpeed` directly, ignoring `phase.bulletSpeedMultiplier` (1.4×).
**Fix:** Pass `isBerserk` into spawn logic and multiply speed by `bulletSpeedMultiplier` at spawn time.
**Also:** All `baseSpeed` values ×1.5 globally:
- dot: 180 → 270
- line: 140 → 210
- rect: 80 → 120
- triangle: 160 → 240

---

## 2. Max HP → 10 Cells
- `maxHp = 10`, initial `hp = 10`
- HUD: each cell 10px wide, 4px gap → total 136px, fits any screen
- Score multiplier threshold: hp ≥ 8 triggers 1.2× (was hp ≥ 4)

---

## 3. Post-Berserk HP Recovery
- On berserk end: `hp = Math.min(maxHp, hp + 5)`
- Heals 5 on top of current HP, capped at 10
- Replaces old `resetHpAfterBerserk()` which set hp to `Math.floor(maxHp/2)`

---

## 4. Right-Click Controls
- `contextmenu` → `preventDefault()` (suppress browser menu)
- `mousedown` (button 2) → set target + `isRightHeld = true` + trigger audio init
- `mousemove` (while `isRightHeld`) → continuously update target (smooth follow)
- `mouseup` (button 2) → `isRightHeld = false`
- Left click still used for audio unlock on first interaction if needed

---

## 5. Music Crossfade Transition
- New method: `crossfadeTo(index, duration=1.5)`
- Each movement gets a `Tone.Volume` master bus node
- Fade out old: volume ramp to -60dB over `duration`
- Fade in new: start at -60dB, ramp to 0dB over `duration`
- Both movements play simultaneously during crossfade

---

## 6. Berserk Audio Modulation (Plan B)
On berserk start (ramp over 0.5s):
- BPM × 1.25 (e.g. 110→137, 125→156, 140→175)
- Master volume +4dB
- Bass distortion: `Tone.Distortion(0.4)` wet → 1.0

On berserk end (ramp over 1.0s):
- BPM back to original
- Volume back to 0dB
- Distortion wet → 0.0

---

## 7. Start Screen / Pause / High Score

### Start Screen
- Title "BAUHAUS BULLET" (existing)
- Controls hint: "RIGHT-CLICK TO MOVE / HOLD TO FOLLOW"
- High score display: "BEST: XXXXX"

### Pause
- Toggle: `Escape` or `P` key
- Music: 0.5s fade out on pause, fade in on resume
- Overlay: semi-transparent black + "PAUSED" + "PRESS P TO CONTINUE"
- Game loop halts update but continues render

### Game Over Screen (enhanced)
- Current score + survival time
- High score from `localStorage` key `bh_highscore`
- If new record: show "NEW RECORD" label
- "RIGHT-CLICK TO RESTART"

---

## 8. Synth Parameter Optimization

### Movement 1 — Puls
- Add `Tone.Reverb(3.0)` on bass bus, wet=0.3
- pad envelope: attack 0.5→0.8s, release 1.5→2.5s
- Overall: more spacious, drifting

### Movement 2 — Linie
- Add `Tone.PingPongDelay('8n', 0.3)` on pulse bus
- bass filterEnvelope baseFrequency: 80→150
- Overall: rhythmic, echoey

### Movement 3 — Chaos
- Add `Tone.Distortion(0.6)` on pulse bus, wet=1
- noise type: brown→white
- Overall: harsh, dissonant, aggressive

---

## 9. Bullet Spawn Randomization
- All fixed-edge origins in PATTERNS (`'top'`, `'bottom'`, `'left'`, `'right'`) → `'random-edge'`
- `'center'` origin preserved (ring burst patterns need it)
- Combined with #1: all bullets faster + spawn from random edges

---

## Files Affected
| File | Changes |
|---|---|
| `game/bullets.js` | baseSpeed ×1.5 for all types |
| `game/player.js` | maxHp=10, hp=10, healAfterBerserk +5 capped at 10 |
| `game/phase.js` | no change needed |
| `game/patterns.js` | origins → random-edge; pass isBerserk speed multiplier |
| `game/audio.js` | crossfade, berserk modulation, synth FX chains |
| `game/renderer.js` | HUD 10-cell HP, enhanced game-over, pause overlay, start screen |
| `game/score.js` | multiplier threshold hp≥8, localStorage high score |
| `game/main.js` | right-click events, pause state, audio crossfade calls |
