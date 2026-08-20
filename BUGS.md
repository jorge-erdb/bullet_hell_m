# Bug Tracker — Bullet Hell

Engineering log for the project. Fixed entries are kept deliberately: the
debugging path is part of the record, not noise.

**Last verified:** 2026-08-20, against a headless Chromium run of `index.html`.

---

## Open

### A. `ensureConnectivity()` is a no-op
- **File:** `js/map.js` — `ensureConnectivity()`
- **Symptom:** None observable; the function does not do what its name claims.
- **Cause:** It performs a BFS and fills a `visited` set, then returns without
  ever acting on the result — no corridor is added for an unreachable room.
- **Verified:** calling it leaves room and corridor counts unchanged.
- **Why it doesn't bite:** every room is placed adjacent to a parent and gets a
  corridor at placement time, so the graph is already connected by construction.
- **Fix:** either add corridors for unvisited rooms, or delete the function and
  document that placement guarantees connectivity. It is also `O(rooms² ×
  corridors)` as written.
- **Severity:** 🟢 Dead logic.

### B. No wall collision
- **File:** `js/player.js` — `update()`
- **Symptom:** The player can walk freely across the entire 2000×2000 map,
  including the void between rooms, ignoring room and corridor boundaries.
- **Cause:** Movement is clamped only to map bounds; room geometry is never
  consulted.
- **Fix:** clamp movement to the union of room and corridor rectangles, which
  is now feasible since corridors have real width.
- **Severity:** 🟡 Design decision as much as a bug — currently the dungeon is
  a visual backdrop rather than a constraint.

### C. Boss enemy is unreachable content
- **File:** `js/enemy.js` (`BossEnemy`), `js/map.js` (`assignRoomTypes()`)
- **Symptom:** A complete multi-phase boss — hexagon rendering, phase indicator,
  wide health bar, distinct attack patterns — never appears in play.
- **Cause:** `assignRoomTypes()` only ever assigns `combat`, `combat-hard`,
  `treasure` and `empty`. Nothing assigns `boss`, so the `'boss'` branch of
  `getEnemiesForRoom()` and `createEnemy('boss', …)` are unreachable.
- **Fix:** assign `boss` to one room per floor (the room farthest from start
  that isn't the exit), or delete the class.
- **Severity:** 🟢 Dead code / missing feature.

### D. Room geometry uses two different conventions
- **File:** `js/map.js` — `overlapsAny()` vs `calculatePositions()`
- **Symptom:** None currently observable.
- **Cause:** `overlapsAny()` treats `(tx, ty)` as the room's **centre**
  (`tx * tileSize - tw * tileSize / 2`), while `calculatePositions()` treats it
  as the **top-left** (`x = tx * tileSize`). The drawn rectangle is therefore
  offset by half a room from the rectangle that was overlap-checked, so the
  advertised 3-tile spacing guarantee does not strictly hold for drawn rooms.
- **Verified:** across 300 generated maps, **0** produced overlapping drawn
  rooms — the centred check is conservative enough to absorb the offset in
  practice. This is latent, not active.
- **Fix:** pick one convention and use it in both places.
- **Severity:** 🟢 Latent inconsistency.

### E. Canvas is not DPI-scaled
- **File:** `js/main.js`
- **Symptom:** Rendering is soft on HiDPI/retina displays.
- **Cause:** The canvas backing store is sized to CSS pixels
  (`canvas.width = window.innerWidth`) with no `devicePixelRatio` multiplier.
- **Fix:** size the backing store to `innerWidth * dpr` and scale the context.
- **Severity:** 🟢 Polish.

---

## Fixed

### 1. Player aim used mismatched coordinate spaces 🔴
- **File:** `js/player.js` — `update()`
- **Symptom:** Bullets fired in the wrong direction whenever the camera was
  away from the origin.
- **Cause:** The aim vector subtracted the player's **world**-space position
  from the mouse's **screen**-space position.
- **Fix:** `player.update()` now takes the camera and converts the mouse to
  world space (`camera.x + input.mouseX`) before computing the direction.
  `game.js` updates the camera *before* the player so the conversion uses the
  current frame's camera.
- **Status:** ✅ Fixed.

### 2. Start room could also be the exit room 🔴
- **File:** `js/map.js` — `setExitRoom()`
- **Symptom:** The headline bug of the project. On pressing **Start**, the
  screen fell into an endless fade-out/fade-in cycle and the player could not
  be moved.
- **Cause:** The exit could be assigned to the start room, so the player spawned
  on top of the exit trigger. `checkRoomTransition()` fired immediately, entered
  `TRANSITIONING`, regenerated the map, dropped the player on the exit again —
  and looped forever. Because `update()` is skipped while `TRANSITIONING`, WASD
  did nothing, and the ~640 ms fade cycle read as the player "flashing".
- **Fix:** `setExitRoom()` now filters the start room out of the exit candidates
  and picks the farthest remaining room.
- **Verified:** across 300 generated maps — 0 spawns inside the exit room,
  0 spawns within the 30 px trigger radius.
- **Status:** ✅ Fixed. *(Earlier notes blamed a double RAF chain; that was a
  real but separate issue — see 3.)*

### 3. Double `requestAnimationFrame` chain 🔴
- **File:** `js/game.js` — `startLoop()` / `loop()`
- **Symptom:** Doubled update speed and frames drawn twice per tick.
- **Cause:** `startLoop()` could be called while a RAF chain was already alive,
  spawning a second independent chain.
- **Fix:** a `loopRunning` flag guards `startLoop()`. Crucially, it is only
  cleared where the chain actually stops (`GAME_OVER` and `start()`) — not on
  unpause or upgrade, since those states keep re-scheduling RAF.
- **Verified:** `frameCount` advanced 61 frames per second with `loop()` called
  exactly 61 times — a 1:1 ratio, so a single chain.
- **Status:** ✅ Fixed.

### 4. Corridors rendered as hairlines instead of floors 🟡
- **File:** `js/map.js` — `createCorridor()`, `calculatePositions()`,
  `corridorSegments()`, `draw()`
- **Symptom:** Corridors appeared as thin grey lines, so the dungeon read as a
  scatter of disconnected boxes rather than a connected floor plan.
- **Cause:** Two defects compounding. `corridorSegments()` returned segments of
  zero thickness (`y1 === y2` horizontally, `x1 === x2` vertically), so the
  `fillRect()` in `draw()` was handed a height or width of `0` and painted
  nothing — only the `0.5px` stroke showed. Separately, `createCorridor()`
  connected room **top-left corners** rather than centres, because it runs
  during `generate()` before `calculatePositions()` has computed `cx`/`cy`.
- **Fix:** `createCorridor()` now stores room references only, and
  `calculatePositions()` resolves endpoints to room centres once they exist.
  `corridorSegments()` returns rectangles of real width (`corridorWidth`, 2
  tiles), each extended by a half width at its ends so the elbow joins cleanly.
  The rectangle stroke was dropped — corridors draw over rooms, so their floor
  now punches a doorway through the room wall, and an outline would streak
  across it.
- **Verified:** across 200 generated maps, 0 degenerate segments and a minimum
  thickness of 64 px. The minimap benefits too, since it now traces
  centre-to-centre.
- **Status:** ✅ Fixed.

### 5. `gameOver()` left the level-up screen visible 🟡
- **Fix:** `gameOver()` now calls `hideLevelUp()` first, so dying mid-draft no
  longer stacks two overlays and blocks restart. **Status:** ✅ Fixed.

### 6. Game loop never stopped after game over 🟡
- **Fix:** the `GAME_OVER` branch of `loop()` returns without re-scheduling.
  **Status:** ✅ Fixed.

### 7. Player could act during room transitions 🟡
- **Fix:** added a `TRANSITIONING` state that renders but skips updates, plus a
  re-entry guard so an in-flight transition can't start another.
  **Status:** ✅ Fixed.

### 8. Confirm button worked with no upgrade selected 🟢
- **Fix:** `applyUpgrade()` returns early and shows a "No upgrade selected!"
  notification. **Status:** ✅ Fixed.

### 9. Only one upgrade shown for a multi-level XP gain 🟢
- **Cause:** `gainXP()` performs the level itself, so re-deriving pending levels
  from `xp >= xpToNext()` always read false.
- **Fix:** a `pendingLevelUps` counter is incremented per level and drained one
  upgrade screen per frame. **Status:** ✅ Fixed.

### 10. Redundant `Game.level` 🟢
- **Fix:** removed; `player.level` is the single source of truth.
  **Status:** ✅ Fixed.

### 11. Over-generous bullet cleanup margin 🟢
- **Fix:** call sites pass a margin of `50` instead of the `100` default.
  **Status:** ✅ Fixed.

### 12. Confusing "Full Heal" upgrade 🟢
- **Fix:** `p.health = p.maxHealth` instead of `p.heal(p.maxHealth)`.
  **Status:** ✅ Fixed.

### 13. Debug scaffolding shipped in the build 🟢
- **Symptom:** A yellow monospace `DEBUG` readout in the HUD showing invincibility
  timers and bullet counts.
- **Fix:** removed the `#debug-info` element, the per-60-frame debug writer in
  `updateEnemyBullets()`, the debug string threaded through `ui.updateHUD()`, the
  never-read `totalDamageAttempts` counter, the uncalled `bulletHitsEnemy()`
  helper, and four committed `.bak` / `.debug_backup` files.
  **Status:** ✅ Fixed.

---

## Summary

| Severity | Open | Fixed |
|---|---|---|
| 🔴 Critical | 0 | 3 |
| 🟡 Moderate | 1 | 4 |
| 🟢 Minor | 4 | 6 |
