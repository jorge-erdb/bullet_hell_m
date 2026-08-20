# Bullet Hell — Procedural Dodge Action

A top-down bullet hell / roguelite that runs entirely in the browser. No game
engine, no build step, no dependencies — just HTML, CSS and vanilla JavaScript
drawing to a single `<canvas>`.

**▶ [Play it here](#)** &nbsp;·&nbsp; *(link goes live once GitHub Pages is enabled — see [Deployment](#deployment))*

---

## What it does

Each run drops you into a procedurally generated dungeon of 8–12 rooms. Rooms
populate with enemies the first time you enter them, killing enemies drops XP
orbs, and collecting enough XP opens an upgrade draft. Find the exit to
regenerate a fresh dungeon and keep your build. Die and the run ends.

| | |
|---|---|
| **Procedural maps** | Rooms grown outward from a start room, spacing-checked, then typed (combat, hard combat, treasure, empty, exit) and connected by L-shaped corridors |
| **Roguelite upgrades** | 10 upgrades drafted 3-at-a-time on level-up — health, damage, speed, multi-shot, pierce, fire rate, bullet speed, pickup magnet |
| **Enemy variety** | Chasers, shooters that lead their target, and spiral emitters, each with its own movement and firing pattern |
| **Feel** | Particle bursts on hit and death, invincibility frames after damage, magnet-pull on XP orbs, room-transition fades, live minimap |

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` / arrows | Move |
| Mouse | Aim |
| Left click (hold) | Shoot |
| `Space` | Pause / resume |

## Running it locally

There is no build step. Any static file server works:

```bash
git clone https://github.com/jorge-erdb/bullet_hell_m.git
cd bullet_hell_m
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` straight from disk (`file://`) also works, since every
script is a plain classic `<script>` tag with no module or fetch usage.

## Architecture

Seven scripts load in dependency order and communicate through plain globals —
deliberately kept flat so the whole engine is readable end to end.

```
index.html          Canvas, HUD, and the four overlay screens (start / level-up / game over / pause)
css/styles.css      All presentation; overlays toggle via a .hidden class
js/
  player.js         Player state, movement, aim, shooting, XP curve, rendering
  bullet.js         Shared collision helpers and off-map cleanup
  enemy.js          Enemy base class + Basic / Shooter / Spiral / Boss subclasses
  map.js            Procedural generation, room typing, spawn tables, world + minimap drawing
  ui.js             DOM HUD updates, minimap, overlay show/hide, canvas notifications
  game.js           The engine: state machine, game loop, collisions, camera, orchestration
  main.js           Bootstrap — builds the objects and wires up the buttons
```

### The game loop

`Game` runs an explicit state machine, and the loop branches on it:

```
START ──▶ PLAYING ⇄ PAUSED
             │  ⇄ LEVEL_UP
             │  ⇄ TRANSITIONING
             └──▶ GAME_OVER ──▶ PLAYING (restart)
```

A single `requestAnimationFrame` chain drives everything. `PAUSED`, `LEVEL_UP`
and `TRANSITIONING` keep **rendering** but skip **updating**, so the last frame
stays visible behind an overlay while the chain stays alive. Only `GAME_OVER`
returns without re-scheduling, which is what actually stops the loop.

That distinction matters: a `loopRunning` flag guards `startLoop()` against
scheduling a second chain. Two concurrent chains would advance timers at double
speed and draw twice per frame — the cause of a long-lived flickering bug during
development (see [BUGS.md](BUGS.md)).

### Coordinate spaces

The world is 2000×2000 px; the canvas is a window onto it. The camera follows
the player, clamped to the map bounds, and rendering happens inside a
`ctx.translate(-camera.x, -camera.y)`. Mouse input arrives in **screen** space,
so aim converts it to **world** space (`camera.x + mouseX`) before computing a
direction — mixing the two was the project's original critical bug.

### Level-ups

`Player.gainXP()` performs the level itself (subtracting the cost and raising
the threshold), so the number of *pending* level-ups is tracked separately in a
`pendingLevelUps` counter and drained one screen at a time. A single large orb
that grants two levels therefore shows two upgrade drafts, not one.

## Deployment

The repo is a static site — the root is publishable as-is. To serve it from
GitHub Pages: **Settings → Pages → Source: `main` / root**. A `.nojekyll` file
is included so Pages serves every file verbatim instead of running Jekyll.

## Project status

Fully playable. Verified end to end in a headless browser: single RAF chain at
~60 fps, movement, aiming, shooting, pause/resume and room transitions all
behave, with no console errors. Remaining known issues — and the full debugging
history of the ones already fixed — are tracked in [BUGS.md](BUGS.md).

## License

MIT — see [LICENSE](LICENSE).
