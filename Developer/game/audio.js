window.BH = window.BH || {};

BH.Audio = {
  initialized: false,
  ctx: null,
  masterGain: null,
  currentMovement: -1,
  _startTime: 0,

  // Internal state
  _rhythmTimer: 0,
  _chordTimer: 0,
  _bpmMultiplier: 1.0,
  _movementBpm: [110, 145, 160],
  _masterDb: 0,
  _isBerserk: false,
  _nextChaosInterval: 0.3,

  // Drone nodes
  _droneOsc1: null,   // sub-bass sine 40Hz
  _droneOsc2: null,   // triangle 82.5Hz with LFO
  _droneOsc3: null,   // filtered sawtooth 165Hz
  _droneLFO: null,    // LFO for drone2 freq modulation
  _droneFilter: null,
  _droneGain: null,

  // Ambient texture nodes
  _textureSource: null,
  _textureFilter: null,
  _textureLFO: null,
  _textureGain: null,

  // Delay/reverb
  _delayNode: null,
  _feedbackGain: null,

  // Waveshaper for berserk distortion
  _waveshaper: null,
  _waveshaperDry: null,
  _waveshaperWet: null,

  // Nominal master volume
  _nominalGain: 0.7,

  // Movement-specific configs
  _movementConfig: [
    // M1: Soft kick sine sweep, C minor 7th chords
    {
      chordRoot: 130.81, // C3
      chordFreqs: [
        [130.81, 155.56, 196.00, 233.08],  // Cm7: C Eb G Bb
        [155.56, 196.00, 233.08, 261.63],   // Eb maj7 inversion
        [196.00, 233.08, 261.63, 311.13],   // G voicing
      ],
      chordVol: 0.09,
      chordAttack: 0.3,
      chordRelease: 3.0,
      rhythmVol: 0.25,
      droneFilter: 150,
    },
    // M2: Filtered click, F Lydian pads
    {
      chordRoot: 174.61, // F3
      chordFreqs: [
        [174.61, 196.00, 220.00, 246.94],   // F G A B
        [196.00, 220.00, 261.63, 293.66],   // G A C D
        [220.00, 246.94, 293.66, 349.23],   // A B D F
      ],
      chordVol: 0.07,
      chordAttack: 0.3,
      chordRelease: 3.0,
      rhythmVol: 0.20,
      droneFilter: 250,
    },
    // M3: Noise/sine ping, chromatic clusters
    {
      chordRoot: 130.81,
      chordFreqs: [
        [130.81, 138.59, 146.83, 155.56],   // C Db D Eb — cluster
        [196.00, 207.65, 220.00, 233.08],   // G Ab A Bb — cluster
        [261.63, 277.18, 293.66, 311.13],   // C Db D Eb (octave up)
      ],
      chordVol: 0.06,
      chordAttack: 0.3,
      chordRelease: 3.0,
      rhythmVol: 0.15,
      droneFilter: 180,
    },
  ],

  async init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // === Master output chain ===
    // signal → waveshaper dry/wet mix → masterGain → destination

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._nominalGain;
    this.masterGain.connect(this.ctx.destination);

    // Waveshaper for berserk distortion (starts fully dry)
    this._waveshaper = this.ctx.createWaveShaper();
    this._waveshaper.curve = this._makeDistortionCurve(0.3);
    this._waveshaper.oversample = '4x';

    this._waveshaperDry = this.ctx.createGain();
    this._waveshaperDry.gain.value = 1.0;
    this._waveshaperWet = this.ctx.createGain();
    this._waveshaperWet.gain.value = 0.0;

    // Dry path → masterGain
    this._waveshaperDry.connect(this.masterGain);
    // Wet path → waveshaper → masterGain
    this._waveshaperWet.connect(this._waveshaper);
    this._waveshaper.connect(this.masterGain);

    // Mix bus: everything connects here, splits to dry/wet
    this._mixBus = this.ctx.createGain();
    this._mixBus.gain.value = 1.0;
    this._mixBus.connect(this._waveshaperDry);
    this._mixBus.connect(this._waveshaperWet);

    // === Feedback delay for ambience ===
    this._delayNode = this.ctx.createDelay(2.0);
    this._delayNode.delayTime.value = 0.35;
    this._feedbackGain = this.ctx.createGain();
    this._feedbackGain.gain.value = 0.40;
    this._delayNode.connect(this._feedbackGain);
    this._feedbackGain.connect(this._delayNode);
    this._delayNode.connect(this._mixBus);

    // Second delay tap for wider stereo-like depth
    this._delayNode2 = this.ctx.createDelay(2.0);
    this._delayNode2.delayTime.value = 0.53;
    this._feedbackGain2 = this.ctx.createGain();
    this._feedbackGain2.gain.value = 0.30;
    this._delayNode2.connect(this._feedbackGain2);
    this._feedbackGain2.connect(this._delayNode2);
    this._delayNode2.connect(this._mixBus);

    // === Drone layer ===
    this._droneFilter = this.ctx.createBiquadFilter();
    this._droneFilter.type = 'lowpass';
    this._droneFilter.frequency.value = 150;
    this._droneFilter.Q.value = 0.7;

    this._droneGain = this.ctx.createGain();
    this._droneGain.gain.value = 0; // starts silent

    // Osc1: sub-bass sine at 40Hz — felt not heard
    this._droneOsc1 = this.ctx.createOscillator();
    this._droneOsc1.type = 'sine';
    this._droneOsc1.frequency.value = 40;
    const droneGain1 = this.ctx.createGain();
    droneGain1.gain.value = 0.18;

    // Osc2: triangle at 82.5Hz with slow LFO ±2Hz
    this._droneOsc2 = this.ctx.createOscillator();
    this._droneOsc2.type = 'triangle';
    this._droneOsc2.frequency.value = 82.5;
    const droneGain2 = this.ctx.createGain();
    droneGain2.gain.value = 0.10;

    // LFO for drone2 frequency modulation
    this._droneLFO = this.ctx.createOscillator();
    this._droneLFO.type = 'sine';
    this._droneLFO.frequency.value = 0.15; // very slow
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 2; // ±2Hz deviation
    this._droneLFO.connect(lfoGain);
    lfoGain.connect(this._droneOsc2.frequency);

    // Osc3: filtered sawtooth at 165Hz, very quiet warmth
    this._droneOsc3 = this.ctx.createOscillator();
    this._droneOsc3.type = 'sawtooth';
    this._droneOsc3.frequency.value = 165;
    const droneGain3 = this.ctx.createGain();
    droneGain3.gain.value = 0.04;

    // Wire drones → filter → droneGain → mixBus
    this._droneOsc1.connect(droneGain1);
    droneGain1.connect(this._droneFilter);
    this._droneOsc2.connect(droneGain2);
    droneGain2.connect(this._droneFilter);
    this._droneOsc3.connect(droneGain3);
    droneGain3.connect(this._droneFilter);
    this._droneFilter.connect(this._droneGain);
    this._droneGain.connect(this._mixBus);

    this._droneOsc1.start();
    this._droneOsc2.start();
    this._droneOsc3.start();
    this._droneLFO.start();

    // === Ambient texture layer ===
    // Filtered noise with LFO sweeping bandpass 400-2000Hz
    this._initAmbientTexture();

    this.initialized = true;
  },

  _initAmbientTexture() {
    // Create a long noise buffer (2 seconds, looped)
    const bufLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    this._textureSource = this.ctx.createBufferSource();
    this._textureSource.buffer = noiseBuf;
    this._textureSource.loop = true;

    this._textureFilter = this.ctx.createBiquadFilter();
    this._textureFilter.type = 'bandpass';
    this._textureFilter.frequency.value = 1000;
    this._textureFilter.Q.value = 1.5;

    // LFO to sweep the bandpass frequency
    this._textureLFO = this.ctx.createOscillator();
    this._textureLFO.type = 'sine';
    this._textureLFO.frequency.value = 0.1; // 0.1Hz — 10s full cycle
    const textureLfoGain = this.ctx.createGain();
    textureLfoGain.gain.value = 800; // sweeps ±800Hz around 1000Hz center → 200-1800Hz
    this._textureLFO.connect(textureLfoGain);
    textureLfoGain.connect(this._textureFilter.frequency);

    this._textureGain = this.ctx.createGain();
    this._textureGain.gain.value = 0.03;

    this._textureSource.connect(this._textureFilter);
    this._textureFilter.connect(this._textureGain);
    this._textureGain.connect(this._mixBus);
    // Also feed a touch into the delay for spaciousness
    const textureDelayFeed = this.ctx.createGain();
    textureDelayFeed.gain.value = 0.015;
    this._textureFilter.connect(textureDelayFeed);
    textureDelayFeed.connect(this._delayNode2);

    this._textureSource.start();
    this._textureLFO.start();
  },

  _makeDistortionCurve(amount) {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  },

  // Called every frame: dt in seconds, isBerserk = boolean
  tick(dt, isBerserk) {
    if (!this.initialized || this.currentMovement < 0) return;
    this._isBerserk = isBerserk;

    const cfg = this._movementConfig[this.currentMovement];
    const bpm = this._movementBpm[this.currentMovement] * this._bpmMultiplier;
    const beatSec = 60 / bpm;

    // --- Rhythm layer ---
    const rhythmInterval = this.currentMovement === 1 ? beatSec * 0.5
                         : this.currentMovement === 2 ? this._nextChaosInterval
                         : beatSec;

    this._rhythmTimer += dt;
    if (this._rhythmTimer >= rhythmInterval) {
      this._rhythmTimer -= rhythmInterval;
      const vol = isBerserk ? cfg.rhythmVol * 1.5 : cfg.rhythmVol;

      if (this.currentMovement === 0) {
        // M1: Soft kick — sine sweep 60→30Hz over 0.12s
        this._triggerKick(vol);
      } else if (this.currentMovement === 1) {
        // M2: Filtered click — short noise through tight bandpass at 3kHz
        this._triggerClick(vol);
      } else {
        // M3: Random between noise burst and detuned sine ping
        this._nextChaosInterval = (0.3 + Math.random() * 0.5) * beatSec;
        if (Math.random() > 0.5) {
          this._triggerNoiseBurst(0.06, vol);
        } else {
          this._triggerDetunedPing(vol);
        }
      }
    }

    // --- Chord/pad layer: every 4 beats ---
    this._chordTimer += dt;
    const chordInterval = beatSec * 4;
    if (this._chordTimer >= chordInterval) {
      this._chordTimer -= chordInterval;
      this._triggerPad(cfg, isBerserk);
    }
  },

  // M1 rhythm: soft kick — sine sweep 60→30Hz
  _triggerKick(vol) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this._mixBus);
    osc.start(now);
    osc.stop(now + 0.2);
  },

  // M2 rhythm: filtered click — short noise through tight bandpass at 3kHz
  _triggerClick(vol) {
    const now = this.ctx.currentTime;
    const dur = 0.015;
    const bufSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000;
    bp.Q.value = 12; // tight, metallic

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this._mixBus);
    // Feed a bit into delay for space
    const delaySend = this.ctx.createGain();
    delaySend.gain.value = vol * 0.3;
    gain.connect(delaySend);
    delaySend.connect(this._delayNode);
    src.start(now);
  },

  // M3 option A: noise burst
  _triggerNoiseBurst(duration, vol) {
    const now = this.ctx.currentTime;
    const bufSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 1200;
    bp.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this._delayNode);
    src.start(now);
  },

  // M3 option B: detuned sine ping
  _triggerDetunedPing(vol) {
    const now = this.ctx.currentTime;
    const baseFreq = 300 + Math.random() * 600;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = baseFreq + (i === 0 ? -3 : 3); // ±3Hz detune
      gain.gain.setValueAtTime(vol * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this._delayNode);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  },

  // Pad/chord layer: triangle/sine with slow attack, long release, through delay
  _triggerPad(cfg, isBerserk) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    // Pick a random voicing from the chord set
    const voicing = cfg.chordFreqs[Math.floor(Math.random() * cfg.chordFreqs.length)];
    const attack = isBerserk ? 0.05 : cfg.chordAttack;
    const release = isBerserk ? 1.5 : cfg.chordRelease;
    const vol = cfg.chordVol;

    for (let i = 0; i < voicing.length; i++) {
      const freq = voicing[i];
      const osc = this.ctx.createOscillator();
      // Alternate between triangle and sine for richness
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;

      // Berserk adds slight detune for tension
      if (isBerserk) {
        osc.detune.value = (Math.random() - 0.5) * 40;
      }

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      // Slow attack envelope
      gain.gain.linearRampToValueAtTime(vol, now + attack);
      // Long release
      gain.gain.setValueAtTime(vol, now + attack + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + attack + 0.1 + release);

      osc.connect(gain);
      // Route through both delay taps for lush reverb
      const delaySend1 = this.ctx.createGain();
      delaySend1.gain.value = 0.4;
      const delaySend2 = this.ctx.createGain();
      delaySend2.gain.value = 0.3;
      gain.connect(delaySend1);
      delaySend1.connect(this._delayNode);
      gain.connect(delaySend2);
      delaySend2.connect(this._delayNode2);
      // Also direct signal (quieter)
      const directGain = this.ctx.createGain();
      directGain.gain.value = 0.5;
      gain.connect(directGain);
      directGain.connect(this._mixBus);

      const totalDur = attack + 0.1 + release + 0.1;
      osc.start(now);
      osc.stop(now + totalDur);
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
    this._droneGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this._droneGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 0.5);

    // Set drone filter for this movement
    const cfg = this._movementConfig[index];
    this._droneFilter.frequency.setTargetAtTime(cfg.droneFilter, this.ctx.currentTime, 0.3);
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

      const cfg = this._movementConfig[index];
      this._droneFilter.frequency.value = cfg.droneFilter;

      // Fade back in
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this._nominalGain, this.ctx.currentTime + d * 0.4);
    }, d * 600);
  },

  enterBerserk() {
    if (!this.initialized) return;
    this._isBerserk = true;
    this._bpmMultiplier = 1.35;

    const now = this.ctx.currentTime;

    // Drone filter opens to 2400Hz
    this._droneFilter.frequency.setTargetAtTime(2400, now, 0.5);

    // Activate waveshaper distortion (wet mix up)
    this._waveshaperWet.gain.setTargetAtTime(0.3, now, 0.3);
    this._waveshaperDry.gain.setTargetAtTime(0.7, now, 0.3);

    // Volume bump to 1.0
    this.masterGain.gain.setTargetAtTime(1.0, now, 0.4);

    // Texture gets louder and brighter in berserk
    this._textureGain.gain.setTargetAtTime(0.06, now, 0.3);
  },

  exitBerserk() {
    if (!this.initialized) return;
    this._isBerserk = false;
    this._bpmMultiplier = 1.0;

    const now = this.ctx.currentTime;
    const idx = this.currentMovement >= 0 ? this.currentMovement : 0;
    const cfg = this._movementConfig[idx];

    // Drone filter returns to movement setting
    this._droneFilter.frequency.setTargetAtTime(cfg.droneFilter, now, 1.0);

    // Waveshaper back to full dry
    this._waveshaperWet.gain.setTargetAtTime(0.0, now, 0.5);
    this._waveshaperDry.gain.setTargetAtTime(1.0, now, 0.5);

    // Volume back to nominal
    this.masterGain.gain.setTargetAtTime(this._nominalGain, now, 0.8);

    // Texture back to subtle
    this._textureGain.gain.setTargetAtTime(0.03, now, 0.5);
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
    osc.connect(gain);
    gain.connect(this._mixBus);
    osc.start(now);
    osc.stop(now + 0.55);

    // Noise burst routed through delay for reverb tail
    const bufSize = Math.max(1, Math.floor(this.ctx.sampleRate * 0.15));
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(400, now);
    filt.frequency.linearRampToValueAtTime(4000, now + 0.15);

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.3, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    src.connect(filt);
    filt.connect(ng);
    ng.connect(this._delayNode);  // through delay for reverb tail
    ng.connect(this._delayNode2); // second tap too
    src.start(now);
  },

  fadeVolume(targetDb, durationSec) {
    if (!this.initialized) return;
    // Convert dB to linear gain: 0dB = nominal, -40dB ≈ 0
    const targetGain = targetDb <= -40 ? 0.001 : this._nominalGain * Math.pow(10, targetDb / 20);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + durationSec);
  },

  stopAll() {
    if (!this.initialized) return;
    this._droneGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    this.currentMovement = -1;
  },

  getTimeMs() {
    if (!this.initialized || this._startTime === 0) return 0;
    return (this.ctx.currentTime - this._startTime) * 1000;
  }
};
