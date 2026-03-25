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
    this._bpmMultiplier = 1.35;
    // Drone filter opens up — harsh
    this.droneFilter.frequency.setTargetAtTime(2400, this.ctx.currentTime, 0.5);
    // Volume bump
    this.masterGain.gain.setTargetAtTime(1.1, this.ctx.currentTime, 0.4);
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
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.55);

    // Noise burst layer with reverb
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
    src.connect(filt); filt.connect(ng); ng.connect(this._delayNode);
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
