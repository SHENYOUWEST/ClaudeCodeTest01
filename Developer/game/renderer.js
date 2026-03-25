window.BH = window.BH || {};

BH.Renderer = {
  draw(ctx, game) {
    const { canvas, player, phase, score, bulletPool } = game;
    const w = canvas.width;
    const h = canvas.height;

    // === Background ===
    // Background with smooth transition
    const t = phase.transitionProgress;
    const r = Math.round(26 + (139 - 26) * t);  // #1a -> #8B
    const g = Math.round(26 * (1 - t));           // 1a -> 00
    const b2 = Math.round(26 * (1 - t));          // 1a -> 00
    ctx.fillStyle = `rgb(${r},${g},${b2})`;
    ctx.fillRect(0, 0, w, h);

    // Shockwave on berserk start
    if (phase.shockwave > 0) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (1 - phase.shockwave) * Math.max(w, h), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,214,0,${phase.shockwave * 0.7})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // === Grid ===
    ctx.strokeStyle = phase.isBerserk
      ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

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

    // === Bullets ===
    for (const b of bulletPool.active) {
      this.drawBullet(ctx, b);
    }

    // === Player ===
    this.drawPlayer(ctx, player);

    // === HUD ===
    this.drawHUD(ctx, player, phase, score, w);
  },

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
      ctx.arc(b.x, b.y, b.radius * 2.8, 0, Math.PI * 2);
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

  drawPlayer(ctx, player) {
    ctx.save();
    if (player.invincible) {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() * 0.01);
    }
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#F5F0E8';
    ctx.fill();
    // Outer ring
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,240,232,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  },

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

    // Score — top-right
    ctx.fillStyle = '#F5F0E8';
    ctx.font = '20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(score.getDisplay(), canvasWidth - 20, 34);

    // Time — top-right below score
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(245,240,232,0.5)';
    ctx.fillText(score.getTimeDisplay(), canvasWidth - 20, 52);

    // Phase label — top center
    ctx.textAlign = 'center';
    ctx.font = '11px monospace';
    ctx.fillStyle = phase.isBerserk ? '#FFD600' : 'rgba(245,240,232,0.3)';
    ctx.fillText(
      phase.isBerserk ? 'BERSERK' : 'NORMAL',
      canvasWidth / 2, 34
    );

    // Phase progress bar — bottom
    const barH = 4;
    const progress = phase.elapsed / (phase.isBerserk ? phase.berserkDuration : phase.normalDuration);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, ctx.canvas.height - barH, canvasWidth, barH);
    ctx.fillStyle = phase.isBerserk ? '#D40000' : '#FFD600';
    ctx.fillRect(0, ctx.canvas.height - barH, canvasWidth * progress, barH);

    ctx.textAlign = 'left'; // reset
  },

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
};
