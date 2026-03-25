window.BH = window.BH || {};

BH.PatternEngine = {
  currentIndex: 0,
  currentMovement: 0,
  difficultyMode: 'easy',

  reset() {
    this.currentIndex = 0;
    this.currentMovement = 0;
  },

  setDifficulty(mode) {
    const valid = ['easy', 'hard', 'wave'];
    this.difficultyMode = valid.includes(mode) ? mode : 'easy';
    this._buildPatterns();
  },

  _buildPatterns() {
    switch (this.difficultyMode) {
      case 'hard': BH.PATTERNS = this._buildHard(); break;
      case 'wave': BH.PATTERNS = this._buildWave(); break;
      case 'easy':
      default:     BH.PATTERNS = this._buildEasy(); break;
    }
  },

  // =====================================================================
  //  EASY MODE — Gradual ramp-up
  // =====================================================================
  _buildEasy() {
    return [
      this._buildEasyM1(),
      this._buildEasyM2(),
      this._buildEasyM3()
    ];
  },

  // Movement 1 (BPM 110): Sparse start, density grows over 80 beats
  _buildEasyM1() {
    const m = [];
    const beat = 60000 / 110;

    for (let i = 0; i < 80; i++) {
      // Phase 1 (beats 0-39): sparse dots from edges
      m.push({ t: i * beat, type: 'dot', origin: 'top',    count: 2, spread: 'fan' });
      m.push({ t: i * beat, type: 'dot', origin: 'bottom', count: 2, spread: 'fan' });

      // Phase 2 (beats 40-59): add lines
      if (i >= 40) {
        m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 2 });
        // Extra edge fans
        m.push({ t: i * beat, type: 'dot', origin: 'left',  count: 2, spread: 'fan' });
        m.push({ t: i * beat, type: 'dot', origin: 'right', count: 2, spread: 'fan' });
      }

      // Phase 3 (beats 60-79): add hexagons, more density
      if (i >= 60) {
        m.push({ t: i * beat, type: 'hexagon', origin: 'random-edge', count: 2 });
        m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 3 });
        if (i % 4 === 0) {
          m.push({ t: i * beat, type: 'hexagon', origin: 'center', count: 6, spread: 'ring' });
        }
      }
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // Movement 2 (BPM 145): Medium density — lines, ring bursts, walls
  _buildEasyM2() {
    const m = [];
    const beat = 60000 / 145;

    for (let i = 0; i < 90; i++) {
      // 3 lines per beat from random edges
      m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 3 });

      // Every 4 beats: center ring burst of 10 dots
      if (i % 4 === 0) {
        m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'center', count: 10, spread: 'ring' });
      }

      // Every 8 beats: line wall
      if (i % 8 === 0) {
        m.push({ t: i * beat, type: 'line', origin: 'top', count: 5, spread: 'fan' });
      }
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // Movement 3 (BPM 160): Full chaos but manageable — 2-4 random bullets with jitter
  _buildEasyM3() {
    const m = [];
    const beat = 60000 / 160;
    const types = ['dot', 'line', 'rect', 'triangle'];

    for (let i = 0; i < 110; i++) {
      const jitter = (Math.random() - 0.5) * beat * 0.6;
      const t = Math.max(0, i * beat + jitter);
      const type = types[Math.floor(Math.random() * types.length)];
      const count = Math.floor(Math.random() * 3) + 2; // 2-4
      const spreads = ['fan', 'ring', undefined];

      m.push({
        t,
        type,
        origin: 'random-edge',
        count,
        spread: spreads[Math.floor(Math.random() * spreads.length)]
      });
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // =====================================================================
  //  HARD MODE — Full intensity from the start
  // =====================================================================
  _buildHard() {
    return [
      this._buildHardM1(),
      this._buildHardM2(),
      this._buildHardM3()
    ];
  },

  // Movement 1 (BPM 110): Full density from beat 1
  _buildHardM1() {
    const m = [];
    const beat = 60000 / 110;

    for (let i = 0; i < 80; i++) {
      // 4 dots per edge fan (16 dots/beat)
      m.push({ t: i * beat, type: 'dot', origin: 'top',    count: 4, spread: 'fan' });
      m.push({ t: i * beat, type: 'dot', origin: 'bottom', count: 4, spread: 'fan' });
      m.push({ t: i * beat, type: 'dot', origin: 'left',   count: 4, spread: 'fan' });
      m.push({ t: i * beat, type: 'dot', origin: 'right',  count: 4, spread: 'fan' });

      // 3 lines per beat
      m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 3 });

      // Every 2 beats: center ring burst
      if (i % 2 === 0) {
        m.push({ t: i * beat, type: 'dot', origin: 'center', count: 8, spread: 'ring' });
      }

      // Every 4 beats: pentagon ring
      if (i % 4 === 0) {
        m.push({ t: i * beat + beat * 0.5, type: 'pentagon', origin: 'center', count: 6, spread: 'ring' });
      }

      // Every 6 beats: rect wall from random edge
      if (i % 6 === 0) {
        m.push({ t: i * beat, type: 'rect', origin: 'random-edge', count: 5 });
      }
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // Movement 2 (BPM 145): Relentless multi-type assault
  _buildHardM2() {
    const m = [];
    const beat = 60000 / 145;

    for (let i = 0; i < 90; i++) {
      // 5 lines per beat
      m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 5 });

      // 2 dots every half-beat
      m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'random-edge', count: 2 });

      // Every 4 beats: 14-dot center ring
      if (i % 4 === 0) {
        m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'center', count: 14, spread: 'ring' });
      }

      // Every 8 beats: sweeping wall of 8 lines from top + bottom
      if (i % 8 === 0) {
        m.push({ t: i * beat, type: 'line', origin: 'top',    count: 8, spread: 'fan' });
        m.push({ t: i * beat + beat * 0.25, type: 'line', origin: 'bottom', count: 8, spread: 'fan' });
      }

      // Every 6 beats: star burst from center
      if (i % 6 === 0) {
        m.push({ t: i * beat + beat * 0.3, type: 'star', origin: 'center', count: 8, spread: 'ring' });
      }

      // Every 10 beats: hexagon wall
      if (i % 10 === 0) {
        m.push({ t: i * beat, type: 'hexagon', origin: 'random-edge', count: 6, spread: 'fan' });
      }
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // Movement 3 (BPM 160): Maximum chaos with all bullet types
  _buildHardM3() {
    const m = [];
    const beat = 60000 / 160;
    const allTypes = ['dot', 'line', 'rect', 'triangle', 'pentagon', 'hexagon', 'star', 'diamond'];
    const spreads = ['fan', 'ring', undefined];

    for (let i = 0; i < 110; i++) {
      const jitter = (Math.random() - 0.5) * beat * 0.8;
      const t = Math.max(0, i * beat + jitter);
      const type = allTypes[Math.floor(Math.random() * allTypes.length)];
      const count = Math.floor(Math.random() * 5) + 4; // 4-8

      m.push({
        t,
        type,
        origin: 'random-edge',
        count,
        spread: spreads[Math.floor(Math.random() * spreads.length)]
      });

      // Every 6 beats: 12-dot center ring
      if (i % 6 === 0) {
        m.push({ t: i * beat, type: 'dot', origin: 'center', count: 12, spread: 'ring' });
      }

      // Every 8 beats: diamond ring
      if (i % 8 === 0) {
        m.push({ t: i * beat + beat * 0.5, type: 'diamond', origin: 'center', count: 8, spread: 'ring' });
      }
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // =====================================================================
  //  WAVE MODE — Rhythmic alternation between dense and sparse
  // =====================================================================
  _buildWave() {
    return [
      this._buildWaveM1(),
      this._buildWaveM2(),
      this._buildWaveM3()
    ];
  },

  // Movement 1 (BPM 110): Alternating 8-beat dense / 8-beat sparse
  _buildWaveM1() {
    const m = [];
    const beat = 60000 / 110;

    for (let i = 0; i < 80; i++) {
      const phase = Math.floor(i / 8) % 2; // 0 = dense, 1 = sparse

      if (phase === 0) {
        // Dense: 3 dots per edge + lines
        m.push({ t: i * beat, type: 'dot', origin: 'top',    count: 3, spread: 'fan' });
        m.push({ t: i * beat, type: 'dot', origin: 'bottom', count: 3, spread: 'fan' });
        m.push({ t: i * beat, type: 'dot', origin: 'left',   count: 3, spread: 'fan' });
        m.push({ t: i * beat, type: 'dot', origin: 'right',  count: 3, spread: 'fan' });
        m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 2 });
      } else {
        // Sparse: 1 dot per edge only
        m.push({ t: i * beat, type: 'dot', origin: 'top',    count: 1 });
        m.push({ t: i * beat, type: 'dot', origin: 'bottom', count: 1 });
        m.push({ t: i * beat, type: 'dot', origin: 'left',   count: 1 });
        m.push({ t: i * beat, type: 'dot', origin: 'right',  count: 1 });
      }
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // Movement 2 (BPM 145): 4-beat intense / 4-beat calm
  _buildWaveM2() {
    const m = [];
    const beat = 60000 / 145;

    for (let i = 0; i < 90; i++) {
      const phase = Math.floor(i / 4) % 2; // 0 = intense, 1 = calm

      if (phase === 0) {
        // Intense: ring bursts + walls + lines
        m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 4 });
        m.push({ t: i * beat, type: 'dot',  origin: 'random-edge', count: 3, spread: 'fan' });

        if (i % 2 === 0) {
          m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'center', count: 10, spread: 'ring' });
        }
        if (i % 4 === 0) {
          m.push({ t: i * beat, type: 'rect', origin: 'top', count: 6, spread: 'fan' });
        }
      } else {
        // Calm: slow dots only
        m.push({ t: i * beat, type: 'dot', origin: 'random-edge', count: 1 });
      }
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // Movement 3 (BPM 160): 6-beat crescendo (1->6 count) then 2-beat silence, repeat
  _buildWaveM3() {
    const m = [];
    const beat = 60000 / 160;
    const allTypes = ['dot', 'line', 'rect', 'triangle', 'pentagon', 'hexagon', 'star', 'diamond'];

    for (let i = 0; i < 110; i++) {
      const cyclePos = i % 8; // 0-5 crescendo, 6-7 silence

      if (cyclePos < 6) {
        const count = cyclePos + 1; // 1, 2, 3, 4, 5, 6
        const type = allTypes[Math.floor(Math.random() * allTypes.length)];
        const spreads = ['fan', 'ring', undefined];

        m.push({
          t: i * beat,
          type,
          origin: 'random-edge',
          count,
          spread: spreads[Math.floor(Math.random() * spreads.length)]
        });

        // At peak (count 5-6), add center burst
        if (count >= 5) {
          m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'center', count: count + 2, spread: 'ring' });
        }
      }
      // cyclePos 6-7: silence — no spawns
    }

    m.sort((a, b) => a.t - b.t);
    return m;
  },

  // =====================================================================
  //  CORE METHODS (unchanged logic)
  // =====================================================================

  process(timeMs, bulletPool, canvasW, canvasH, isBerserk) {
    const movement = BH.PATTERNS[this.currentMovement];
    if (!movement) return;

    while (this.currentIndex < movement.length && movement[this.currentIndex].t <= timeMs) {
      const event = movement[this.currentIndex];
      this.spawnFromEvent(event, bulletPool, canvasW, canvasH, isBerserk);
      this.currentIndex++;
    }

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
    return Math.atan2(h / 2 - spawn.y, w / 2 - spawn.x);
  }
};

// Build default patterns (easy mode)
BH.PATTERNS = [];
BH.PatternEngine._buildPatterns();
