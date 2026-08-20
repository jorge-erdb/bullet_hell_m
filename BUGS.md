# Bug Tracker — Bullet Hell

> Last updated: 2025-07-13

---

## 🔴 Critical Bugs

### 1. Player Aim Direction Is Wrong (World vs Screen Coordinates)
- **File:** `js/player.js` — line 89–96 (`Player.update()`)
- **Symptom:** The player's aim direction points completely wrong when the camera is not at the origin. Bullets fire in the wrong direction.
- **Cause:** The aim calculation subtracts the player's **world-space** position (`this.x`, `this.y`) from the mouse's **screen-space** position (`input.mouseX`, `input.mouseY`). These coordinate spaces don't match.
- **Fix:** Pass the camera position to `player.update()` and convert mouse coordinates to world space before computing aim:
  ```js
  // game.js — update()
  const shouldShoot = this.player.update(this.input, this.camera);

  // player.js — update()
  if (input.mouseX !== undefined && camera) {
      const worldMouseX = camera.x + input.mouseX;
      const worldMouseY = camera.y + input.mouseY;
      const adx = worldMouseX - this.x;
      const ady = worldMouseY - this.y;
      // ... normalize and set aimX/aimY
  }
  ```
- **Status:** ✅ Fixed — `player.update()` now accepts `camera` param; `game.js` passes it and updated camera before player update.

---

## 🟡 Moderate Bugs

### 2. `gameOver()` Doesn't Hide the Level-Up Screen
- **File:** `js/game.js` — line ~460–463 (`Game.gameOver()`)
- **Symptom:** If the player dies while the level-up screen is visible, both the level-up screen and the game-over screen are shown simultaneously, making it impossible to restart.
- **Cause:** `gameOver()` calls `showHUD(false)` and `showGameOver()` but never calls `hideLevelUp()`.
- **Fix:** Add `this.ui.hideLevelUp();` inside `gameOver()`.
- **Status:** ✅ Fixed — `hideLevelUp()` added at top of `gameOver()`.

### 3. Game Loop Never Stops After Game Over
- **File:** `js/game.js` — line ~380–395 (`Game.loop()`)
- **Symptom:** After game over, `requestAnimationFrame` keeps being called every frame, wasting CPU/GPU cycles.
- **Cause:** The loop only checks for `'PLAYING'` and `'PAUSED'` states but doesn't `return` early for `'GAME_OVER'`.
- **Status:** ✅ Fixed — added early return for `'GAME_OVER'` in `loop()` so `requestAnimationFrame` stops being queued.

### 4. Player Can Move During Room Transition Fade
- **File:** `js/game.js` — `checkRoomTransition()`, `loop()`, and state machine
- **Symptom:** During the room transition fade animation, the player can still move and the game continues updating. If the player walks into the exit again mid-fade, a new `setInterval` is created, potentially causing overlapping transitions.
- **Cause:** The game state remains `'PLAYING'` during the entire transition animation. The `transitioning` flag is not checked in the update loop.
- **Fix:** Set state to `'TRANSITIONING'` during the fade, add a guard in `checkRoomTransition()` to skip new transitions while `this.transitioning` is true, and handle the new state in `loop()` so updates are skipped but rendering continues.
- **Status:** ✅ Fixed — added `'TRANSITIONING'` state; `loop()` skips updates during transition; `checkRoomTransition()` guards against re-entry.

---

## 🟢 Minor / UX Bugs

### 5. Confirm Upgrade Button Works Without Selection
- **File:** `js/game.js` — line ~480–485 (`Game.applyUpgrade()`)
- **Symptom:** The player can click "Confirm" on the level-up screen without selecting any upgrade card, silently skipping the upgrade.
- **Cause:** `applyUpgrade()` checks `if (this.selectedUpgrade)` but still proceeds to hide the screen and resume play regardless.
- **Fix:** Either require a selection before showing the confirm button, or show a brief notification like "No upgrade selected."

### 6. Redundant `this.level` in Game Class
- **File:** `js/game.js` — line ~40
- **Symptom:** No visible bug, but `this.level` in the `Game` class is set to `1` in `start()` and never actually read — the real level is in `this.player.level`.
- **Cause:** Leftover variable from an earlier design.
- **Fix:** Remove `this.level` from the `Game` class constructor and the `start()` method.

### 7. Boss Enemy Type Is Dead Code
- **File:** `js/enemy.js` — lines ~280–310 (`BossEnemy` class) and `createEnemy('boss', ...)`
- **Symptom:** Boss enemies are never spawned because `assignRoomTypes()` in `js/map.js` only assigns `'combat'`, `'combat-hard'`, `'treasure'`, and `'empty'` room types — never `'boss'`.
- **Cause:** The boss enemy type exists but is never referenced by the map generator.
- **Fix:** Add a `'boss'` room type to `assignRoomTypes()` and `getEnemiesForRoom()`, or remove the dead `BossEnemy` class.

### 8. `removeDead()` Margin Is Overly Generous
- **File:** `js/bullet.js` — line ~53–56
- **Symptom:** Bullets persist for a long time after leaving the visible area, consuming memory.
- **Cause:** The margin is `100` pixels on each side, but the map is only `2000×2000`, so bullets can be up to `300×300` pixels off-screen before being cleaned up.
- **Fix:** Reduce margin to something more reasonable (e.g., `50`) or tie it to the map bounds.

### 9. `Full Heal` Upgrade Uses Confusing Logic
- **File:** `js/game.js` — line ~65
- **Symptom:** No visible bug (it works because `Math.min` caps at `maxHealth`), but the intent is unclear.
- **Code:** `p.heal(p.maxHealth)` — heals by `maxHealth` amount, which doubles the current health before being capped.
- **Fix:** Replace with `p.health = p.maxHealth` for clarity.

### 10. `handleLevelUp()` Doesn't Handle Multiple Level-Ups from One XP Gain
- **File:** `js/game.js` — line ~455–470 (`Game.updateXPOrbs()`)
- **Symptom:** If a single XP orb gives enough XP to level up twice (e.g., player is near the threshold and the orb gives a large amount), only one level-up screen is shown.
- **Cause:** `Player.gainXP()` returns `true` only for a single level-up and resets `this.xp` by subtracting `xpToNext()`.
- **Fix:** Wrap `handleLevelUp()` in a `while` loop that keeps checking `this.player.xpToNext() > 0 && this.player.xp >= needed`.

---

## Summary

| Severity | Count | Bugs |
|----------|-------|------|
| 🔴 Critical | 1 | #1 — Aim direction (✅ Fixed) |
| 🟡 Moderate | 3 | #2 (✅ Fixed), #3 (✅ Fixed), #4 (✅ Fixed) |
| 🟢 Minor / UX | 6 | #5–#10 |
