window.BH = window.BH || {};

BH.PatternEngine = {
  currentIndex: 0,
  currentMovement: 0,

  reset() {
    this.currentIndex = 0;
    this.currentMovement = 0;
  },

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

// === MOVEMENT TIMELINES ===
BH.PATTERNS = [];

// Movement 1: Puls — steady metronomic beat, predictable but relentless (BPM 110)
// LOL skill: timing-based dodging — player can "feel" the rhythm but must keep moving
(function buildMovement1() {
  const m = [];
  const bpm = 110;
  const beat = 60000 / bpm;

  // Full density from beat 1: 4-directional fan every beat
  // 4 dots per edge × 4 edges = 16 dots per beat — dense but patterned
  for (let i = 0; i < 80; i++) {
    // Top edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'top', count: 4, spread: 'fan' });
    // Bottom edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'bottom', count: 4, spread: 'fan' });
    // Left edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'left', count: 4, spread: 'fan' });
    // Right edge fan
    m.push({ t: i * beat, type: 'dot', origin: 'right', count: 4, spread: 'fan' });
    // Random edge lines every beat
    m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 3 });
    // Every 2 beats: ring burst from center — forces positional repositioning
    if (i % 2 === 0) {
      m.push({ t: i * beat, type: 'dot', origin: 'center', count: 8, spread: 'ring' });
    }
    // Every 8 beats: blue rect wall from random edge — adds visual clutter
    if (i % 8 === 0) {
      m.push({ t: i * beat, type: 'rect', origin: 'random-edge', count: 5 });
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
    // Every beat: 5 fast red lines from random edge aimed at center
    m.push({ t: i * beat, type: 'line', origin: 'random-edge', count: 5 });

    // Continuous dot spawns every 0.5 beats
    if (i % 1 === 0) {
      m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'random-edge', count: 2 });
    }

    // Every 4 beats: "warning" then ring burst — telegraphed but fast
    if (i % 4 === 0) {
      // Ring burst offset by half a beat (arrives fast after the regular lines)
      m.push({ t: i * beat + beat * 0.5, type: 'dot', origin: 'center', count: 14, spread: 'ring' });
    }

    // Every 8 beats: sweeping wall of 8 parallel lines from alternating sides
    if (i % 8 === 0) {
      m.push({ t: i * beat, type: 'line', origin: 'top', count: 8, spread: 'fan' });
      m.push({ t: i * beat + beat * 0.25, type: 'line', origin: 'bottom', count: 8, spread: 'fan' });
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
    const count = Math.floor(Math.random() * 5) + 4; // 4–8
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
    m.push({ t: i * beat * 6, type: 'dot', origin: 'center', count: 12, spread: 'ring' });
    m.push({ t: i * beat * 6 + beat * 3, type: 'rect', origin: 'center', count: 6, spread: 'ring' });
  }

  m.sort((a, b) => a.t - b.t);
  BH.PATTERNS.push(m);
})();
