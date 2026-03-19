# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based games built with vanilla HTML5 Canvas — no build tools, no dependencies, no bundler. Every game is a single self-contained HTML file.

## Running the Games

Open any HTML file directly in a browser:
```bash
start shooter/index.html
start tictactoe.html
```

There is no build step, no dev server, and no package manager.

## Git Workflow

This repo is connected to GitHub at `https://github.com/SHENYOUWEST/ClaudeCodeTest01`.

**REQUIRED:** After every meaningful unit of work (new feature, bug fix, refactor, new file), commit and push immediately. Never leave completed work uncommitted. This ensures no progress is lost and the GitHub remote always reflects the current state.

```bash
git add <specific files>
git commit -m "feat/fix/refactor: clear description"
git push
```

Commit message format: `type: short description` where type is `feat`, `fix`, `refactor`, or `docs`.

The system uses a proxy on `127.0.0.1:7890` (Clash/V2Ray). If `git push` fails with a connection error, the proxy may be off — ask the user to start it before retrying.

## Architecture

### shooter/index.html
Single-file game (~500 lines). All logic lives in one `<script>` tag:

- **State machine** — `STATE = {MENU, PLAYING, LEVEL_CLEAR, GAME_OVER}`, driven by `state` variable
- **Game loop** — `requestAnimationFrame` → `loop()` dispatches to `drawMenu()` / `update()` / `drawLevelClear()` / `drawGameOver()`
- **`update()`** — called every frame during PLAYING: runs all update functions, then all draw functions in order
- **Enemy types** — defined in `ENEMY_TYPES` object; each type holds `{color, size, hp, speed, score, draw}`. Draw functions (`drawEnemyChaser`, `drawEnemyTank`, `drawEnemyZigzag`) are declared before the object so they can be referenced
- **Level config** — `LEVEL_CONFIG` array (index = level-1) holds `{killsToWin, spawnInterval}` per level
- **Collision** — `checkCollisions()` mutates `bullets` and `enemies` arrays in-place using `filter()`; also updates `killCount` and `score`

### tictactoe.html
Standalone 3×3 grid game with score persistence across rounds (in-memory only).

## Code Conventions

- All graphics are programmatic Canvas 2D — no image assets
- `retroText(text, x, y, size, color, align)` is the shared text utility with glow effect
- `ctx.save()` / `ctx.restore()` wraps every draw function that uses transforms
- Coordinates: `W=600`, `H=700`; HUD occupies top 44px and bottom 24px
- New games go in their own subdirectory: `<game-name>/index.html`
- Implementation plans go in `docs/plans/YYYY-MM-DD-<feature>.md`
