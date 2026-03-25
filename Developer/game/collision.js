window.BH = window.BH || {};

BH.Collision = {
  circleCircle(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx * dx + dy * dy;
    const radii = r1 + r2;
    return distSq <= radii * radii;
  },

  playerVsBullet(px, py, pHitRadius, bullet) {
    return this.circleCircle(px, py, pHitRadius, bullet.x, bullet.y, bullet.hitRadius);
  },

  checkAll(player, bulletPool) {
    if (player.invincible || player.isDead()) return;
    for (const b of bulletPool.active) {
      if (this.playerVsBullet(player.x, player.y, player.hitRadius, b)) {
        player.takeDamage();
        b.alive = false;
        return; // only one hit per frame
      }
    }
  }
};
