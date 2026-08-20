# Session Summary — Bullet Hell Game Debugging

## Session Goal
Fix gameplay issues introduced after previous fixes (documented in agent.db message 2375).

---

## Issue #1: Main loop flashing + player unresponsive on START

### Symptoms
- After clicking "START GAME", the main loop flashes
- Player cannot be moved (WASD keys have no effect)
- Mouse following works only in between flashes
- The flashing is described as a "fade in and out" animation on the player/center
- Later description: light grey square (start room) with blue dot (player) fading in and out; mouse movement only responds briefly after each fade-in

### Investigation
- No `@keyframes` CSS animations exist in the project — fade is not CSS-driven
- Only one `requestAnimationFrame` call exists in `game.js:198` (end of `loop()`)
- Only one call site for `startLoop()` in `main.js` button handler
- No duplicate event listeners, no form submissions, no page reloads
- Canvas rendering has no intentional fade animation — the only dynamic alpha is:
  - Particle fading (`game.js:548-549`)
  - Invincibility flash on player (`player.js:153-154`)
  - Notification text fade (`ui.js:205-209`)

### Root Cause (Converged)
**Double `requestAnimationFrame` loop scheduling** — two independent RAF chains running simultaneously, each calling `render()` independently. This causes frames to be drawn on top of each other with slightly different game states, creating a flickering/pulsing effect where the player appears to "fade in and out constantly."

The second plausible cause identified: **keyboard focus stealing**. Clicking the START button gives it focus, so `keydown`/`keyup` events target the (now-hidden) button instead of the `window` where the game's key listeners are attached. This explains why WASD doesn't work while mouse events (attached to canvas) still function.

The user later confirmed: **the "fade" is almost certainly the invincibility flash** (`player.js:153-154`), which makes `globalAlpha = 0.4` when `invincibleTimer > 0`. Two concurrent loops would cause the invincibility timer to decrement at double speed, making the player flash rapidly.

### Previous Fixes Attempted (from prior session)
#### `js/main.js`
- Wrapped button click handlers in a `startGame()` helper that also calls `document.activeElement.blur()` to release focus back from the button
- Added `e.preventDefault()` on all button click handlers as a safety measure

#### `js/game.js`
- Added `this.loopRunning = false` flag in constructor
- Added guard in `startLoop()` that returns early if a loop is already running:
  ```js
  if (this.loopRunning) return;
  this.loopRunning = true;
  ```

### Current Status
**Issue #1 was NOT resolved.** The previous session's fixes were insufficient.

#### New Investigation & Fixes Applied in This Session

**Problem identified:** The `loopRunning` flag was set to `true` when the first game loop started, but **never reset to `false` anywhere**. When the player died and the game entered `GAME_OVER` state, the RAF chain stopped (via `return` in `loop()`), but `loopRunning` remained `true`. On restart:
1. `startGame()` calls `game.start()` then `game.startLoop()`
2. `startLoop()` sees `loopRunning === true` and **returns immediately without starting a new loop**
3. The game becomes completely frozen — no rendering, no updates

This meant restarts after the first game were broken, and the guard was masking deeper lifecycle issues.

#### Fixes Applied in This Session (`js/game.js`)
1. **Added `this.loopRunning = false` resets at every transition point back to `'PLAYING'`:**
   - In `start()` — resets before starting a new game
   - In `gameOver()` — resets when the player dies
   - In `applyUpgrade()` — resets after level-up selection
   - In pause resume handler (`bindInput`) — resets on Space unpause
   - In room transition fade-back — resets when exiting TRANSITIONING state

2. **Kept the guard in `startLoop()`** as a safety measure to prevent accidental double-scheduling, but now it works correctly because `loopRunning` is properly reset at every lifecycle boundary.

### Status
Issue #1 still under investigation. User reports the fading/flickering persists on first START click (not just on restart). The `loopRunning` lifecycle fixes address the restart problem, but the root cause of the initial flash may be something else — possibly related to the invincibility mechanic or double-rendering from a separate code path.

---

## Session Status
Issue #1 still unresolved. Working with user to determine exact nature of the fade effect on first game start.
