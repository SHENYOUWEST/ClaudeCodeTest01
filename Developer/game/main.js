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
  isNewRecord: false,
  started: false,
  paused: false,
  audioStarted: false,
  isRightHeld: false,
  berserkTriangleTimer: 0,
  hitFlashTimer: 0,
  startScreenAlpha: 1.0,
  musicTimeMs: 0,
  startButtonHovered: false,
  startButtonBounds: null,
  shakeTimer: 0,
  difficultyMode: null,
  countdown: 0,
  countdownActive: false,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Suppress right-click context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Right mouse button: mousedown
    this.canvas.addEventListener('mousedown', async (e) => {
      if (e.button !== 2) return;
      if (this.gameOver) { this.restart(); return; }
      if (this.paused) return;
      this.isRightHeld = true;
      this.player.setTarget(e.clientX, e.clientY);
    });

    // Follow mouse while held
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isRightHeld) return;
      this.player.setTarget(e.clientX, e.clientY);
    });

    // Release — on window so it fires even if cursor left the canvas
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 2) return;
      this.isRightHeld = false;
    });

    // Mouse move for button hover
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.started && !this.countdownActive && this.startButtonBounds) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        for (const btn of this.startButtonBounds) {
          btn.hovered = mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h;
        }
      }
    });

    // Left click for start button
    this.canvas.addEventListener('click', async (e) => {
      if (!this.started && !this.countdownActive && this.startButtonBounds) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Check which mode button was clicked
        for (const btn of this.startButtonBounds) {
          if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
            this.difficultyMode = btn.mode;
            this.score = new BH.Score(btn.mode);
            BH.PatternEngine.setDifficulty(btn.mode);
            BH.PatternEngine.reset();
            if (!this.audioStarted) {
              await BH.Audio.init();
              this.audioStarted = true;
            }
            this.countdownActive = true;
            this.countdown = 3;
            const countInterval = setInterval(() => {
              this.countdown--;
              if (this.countdown < 0) {
                clearInterval(countInterval);
                this.countdownActive = false;
                this.started = true;
                this.musicTimeMs = 0;
                BH.Audio.playMovement(0);
              }
            }, 1000);
            break;
          }
        }
      }
    });

    this.player = new BH.Player(this.canvas.width / 2, this.canvas.height / 2);
    this.phase = new BH.Phase();
    this.score = new BH.Score();
    this.bulletPool = new BH.BulletPool();
    BH.PatternEngine.reset();

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

    this.lastTime = performance.now();
    this.loop();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.player) {
      this.player.x = Math.min(this.player.x, this.canvas.width);
      this.player.y = Math.min(this.player.y, this.canvas.height);
    }
  },

  restart() {
    this.player = new BH.Player(this.canvas.width / 2, this.canvas.height / 2);
    this.phase.reset();
    this.score.reset();
    this.bulletPool.clear();
    BH.PatternEngine.reset();
    this.berserkTriangleTimer = 0;
    this.musicTimeMs = 0;
    this.startScreenAlpha = 1.0;
    this.gameOver = false;
    this.isNewRecord = false;
    this.started = false;
    this.paused = false;
    this.difficultyMode = null;
    this.countdownActive = false;
    this.countdown = 0;
    BH.Audio.stopAll();
  },

  loop() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.started && !this.gameOver && !this.paused) {
      // Fade out start screen overlay
      if (this.startScreenAlpha > 0) {
        this.startScreenAlpha = Math.max(0, this.startScreenAlpha - dt * 2.5); // 400ms fade
      }

      // Phase
      this.phase.update(dt);

      // Audio tick — drives rhythm and chord layers
      BH.Audio.tick(dt, this.phase.isBerserk);

      if (this.phase.berserkJustStarted) {
        BH.Audio.enterBerserk();
        this.shakeTimer = 0.3;
      }
      if (this.phase.berserkJustEnded) {
        this.player.healAfterBerserk();
        BH.Audio.exitBerserk();
      }

      // Pattern timeline
      this.musicTimeMs += dt * 1000;
      const result = BH.PatternEngine.process(
        this.musicTimeMs, this.bulletPool,
        this.canvas.width, this.canvas.height,
        this.phase.isBerserk
      );
      if (result === 'movement-change') {
        this.musicTimeMs = 0;
        BH.Audio.crossfadeTo(BH.PatternEngine.currentMovement);
      }

      // Berserk triangles
      if (this.phase.isBerserk) {
        this.berserkTriangleTimer += dt;
        if (this.berserkTriangleTimer >= 2.5) {
          this.berserkTriangleTimer -= 2.5;
          const edge = BH.PatternEngine.resolveOrigin(
            'random-edge', this.canvas.width, this.canvas.height, 0, 1
          );
          const angle = Math.atan2(
            this.player.y - edge.y, this.player.x - edge.x
          );
          this.bulletPool.spawn({
            type: 'triangle',
            x: edge.x, y: edge.y,
            vx: Math.cos(angle) * 200,
            vy: Math.sin(angle) * 200
          });
        }
      } else {
        this.berserkTriangleTimer = 0;
      }

      // Update
      this.player.update(dt, this.phase.isBerserk);
      this.bulletPool.update(dt, this.phase.bulletSpeedMultiplier);
      // Remove dead bullets (hit player)
      this.bulletPool.active = this.bulletPool.active.filter(b => b.alive);
      BH.Collision.checkAll(this.player, this.bulletPool);
      this.score.update(dt, this.phase.isBerserk, this.player.hp);

      if (this.player.isDead()) {
        this.gameOver = true;
        this.isNewRecord = this.score.checkHighScore();
        BH.Audio.stopAll();
      }

      // Damage sound
      if (this.player.invincible && this.player.invincibleTimer >= this.player.invincibleDuration - 0.02) {
        BH.Audio.playDamageSound();
      }

      // Hit flash detection — invincible just became true this frame
      if (this.player.invincible && this.player.invincibleTimer >= this.player.invincibleDuration - 0.05) {
        this.hitFlashTimer = 1.0; // full flash
      }
      if (this.hitFlashTimer > 0) {
        this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt * 5); // decay over 0.2s
      }

      // Screen shake decay
      if (this.shakeTimer > 0) {
        this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      }
    }

    // Render
    this.ctx.save();
    if (this.shakeTimer > 0) {
      const intensity = this.shakeTimer / 0.3;
      this.ctx.translate((Math.random() - 0.5) * 4 * intensity, (Math.random() - 0.5) * 4 * intensity);
    }
    BH.Renderer.draw(this.ctx, this);
    this.ctx.restore();
    if (this.hitFlashTimer > 0) {
      BH.Renderer.drawHitFlash(this.ctx, this.canvas.width, this.canvas.height, this.hitFlashTimer);
    }
    if (this.paused) {
      BH.Renderer.drawPause(this.ctx, this.canvas.width, this.canvas.height);
    }
    if (this.gameOver) {
      BH.Renderer.drawGameOver(this.ctx, this.score, this.canvas.width, this.canvas.height, this.isNewRecord);
    } else if (!this.started || this.countdownActive) {
      this.drawStartScreen();
    } else if (this.startScreenAlpha > 0) {
      // Fade out overlay
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = this.startScreenAlpha;
      this.drawStartScreen();
      ctx.restore();
    }

    requestAnimationFrame(() => this.loop());
  },

  drawStartScreen() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.save();

    // Countdown overlay
    if (this.countdownActive) {
      ctx.fillStyle = 'rgba(26,26,26,0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.font = 'bold 120px monospace';
      ctx.fillStyle = '#FFD600';
      const text = this.countdown > 0 ? this.countdown.toString() : 'GO!';
      const breathScale = 1 + 0.1 * Math.sin(performance.now() * 0.008);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(breathScale, breathScale);
      ctx.fillText(text, 0, 40);
      ctx.restore();
      ctx.font = '16px monospace';
      ctx.fillStyle = 'rgba(245,240,232,0.6)';
      ctx.fillText(`Mode: ${this.difficultyMode.toUpperCase()}`, cx, cy + 100);
      ctx.restore();
      return;
    }

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

    // High scores for each mode
    const easyScore = localStorage.getItem('bh_easy') || 0;
    const hardScore = localStorage.getItem('bh_hard') || 0;
    const waveScore = localStorage.getItem('bh_wave') || 0;

    ctx.font = '12px monospace';
    ctx.fillStyle = '#FFD600';
    ctx.fillText('LEADERBOARD', cx, cy + 68);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(245,240,232,0.6)';
    ctx.fillText(`Easy: ${easyScore}  Hard: ${hardScore}  Wave: ${waveScore}`, cx, cy + 86);

    // Mode buttons
    const btnW = 140, btnH = 45, btnGap = 20;
    const startY = cy + 120;
    const modes = [
      { mode: 'easy', label: 'EASY', desc: 'Gradual' },
      { mode: 'hard', label: 'HARD', desc: 'Intense' },
      { mode: 'wave', label: 'WAVE', desc: 'Rhythm' }
    ];

    this.startButtonBounds = [];
    modes.forEach((m, i) => {
      const btnX = cx - (btnW * 1.5 + btnGap) + i * (btnW + btnGap);
      const btn = { x: btnX, y: startY, w: btnW, h: btnH, mode: m.mode, hovered: false };
      this.startButtonBounds.push(btn);

      if (btn.hovered) {
        ctx.fillStyle = '#FFD600';
        ctx.fillRect(btnX, startY, btnW, btnH);
        ctx.fillStyle = '#1A1A1A';
      } else {
        ctx.strokeStyle = '#FFD600';
        ctx.lineWidth = 2;
        ctx.strokeRect(btnX, startY, btnW, btnH);
        ctx.fillStyle = '#F5F0E8';
      }
      ctx.font = 'bold 14px monospace';
      ctx.fillText(m.label, btnX + btnW / 2, startY + 22);
      ctx.font = '10px monospace';
      ctx.fillStyle = btn.hovered ? 'rgba(26,26,26,0.7)' : 'rgba(245,240,232,0.5)';
      ctx.fillText(m.desc, btnX + btnW / 2, startY + 36);
    });

    ctx.restore();
    ctx.letterSpacing = '0px'; // reset
  },
};

document.addEventListener('DOMContentLoaded', () => BH.Game.init());
