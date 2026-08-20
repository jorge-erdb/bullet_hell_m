/**
 * UI rendering — HUD, minimap, level-up screen, game over.
 */

/**
 * UI class — handles all on-screen UI rendering and DOM updates.
 */
class UI {
    constructor(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimapCanvas = minimapCanvas;
        this.minimapCtx = minimapCanvas.getContext('2d');

        // DOM elements
        this.hpBar = document.getElementById('hp-bar');
        this.hpText = document.getElementById('hp-text');
        this.xpBar = document.getElementById('xp-bar');
        this.xpText = document.getElementById('xp-text');
        this.statsDisplay = document.getElementById('stats-display');
    }

    /** Update HUD bars from player data. */
    updateHUD(player, map, gameDebug = null) {
        // HP bar
        const hpPercent = (player.health / player.maxHealth) * 100;
        this.hpBar.style.width = `${hpPercent}%`;
        this.hpText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;

        // XP bar
        const xpNeeded = player.xpToNext();
        const xpPercent = xpNeeded > 0 ? (player.xp / xpNeeded) * 100 : 100;
        this.xpBar.style.width = `${xpPercent}%`;
        this.xpText.textContent = `Lv ${player.level} — ${player.xp} / ${xpNeeded}`;

        // Stats
        this.statsDisplay.textContent = player.getStatsString();
    }

    /** Draw minimap. */
    drawMinimap(map, camera, player, width = 150, height = 150) {
        const ctx = this.minimapCtx;
        ctx.clearRect(0, 0, width, height);

        // Background
        ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
        ctx.fillRect(0, 0, width, height);

        // Calculate scale
        const scaleX = width / map.width;
        const scaleY = height / map.height;
        const scale = Math.min(scaleX, scaleY);

        // Draw rooms
        for (const room of map.rooms) {
            const rx = room.x * scale;
            const ry = room.y * scale;
            const rw = room.w * scale;
            const rh = room.h * scale;

            if (room.cleared) {
                ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
            } else {
                ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
            }
            ctx.fillRect(rx, ry, rw, rh);

            ctx.strokeStyle = room.cleared ? '#555' : '#888';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(rx, ry, rw, rh);
        }

        // Draw corridors
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
        for (const corr of map.corridors) {
            ctx.beginPath();
            ctx.moveTo(corr.x1 * scale, corr.y1 * scale);
            ctx.lineTo(corr.x2 * scale, corr.y2 * scale);
            ctx.stroke();
        }

        // Draw exit
        if (map.exit) {
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(
                map.exit.x * scale - 3,
                map.exit.y * scale - 3,
                6, 6
            );
        }

        // Draw player
        const px = player.x * scale;
        const py = player.y * scale;
        ctx.fillStyle = '#2196f3';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw enemy dots (red) if visible on screen
        // (This would need enemies passed in — simplified here)
    }

    /** Show level-up screen with upgrade cards. */
    showLevelUp(upgrades, onSelect) {
        const container = document.getElementById('upgrade-cards');
        container.innerHTML = '';

        for (const upgrade of upgrades) {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <div class="card-name">${upgrade.name}</div>
                <div class="card-desc">${upgrade.description}</div>
                <div class="card-rarity ${upgrade.rarity || ''}">${upgrade.rarity || 'common'}</div>
            `;
            card.addEventListener('click', () => {
                // Remove previous selection
                container.querySelectorAll('.upgrade-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                onSelect(upgrade);
            });
            container.appendChild(card);
        }

        // Show confirm button
        document.getElementById('confirm-upgrade').classList.remove('hidden');

        // Show screen
        document.getElementById('levelup-screen').classList.remove('hidden');
    }

    /** Hide level-up screen. */
    hideLevelUp() {
        document.getElementById('levelup-screen').classList.add('hidden');
        document.getElementById('confirm-upgrade').classList.add('hidden');
    }

    /** Show game over screen with stats. */
    showGameOver(level, rooms, enemies) {
        document.getElementById('go-level').textContent = level;
        document.getElementById('go-rooms').textContent = rooms;
        document.getElementById('go-enemies').textContent = enemies;
        document.getElementById('gameover-screen').classList.remove('hidden');
    }

    /** Hide game over screen. */
    hideGameOver() {
        document.getElementById('gameover-screen').classList.add('hidden');
    }

    /** Show start screen. */
    showStart() {
        document.getElementById('start-screen').classList.remove('hidden');
    }

    /** Hide start screen. */
    hideStart() {
        document.getElementById('start-screen').classList.add('hidden');
    }

    /** Show pause overlay. */
    showPause() {
        document.getElementById('pause-overlay').classList.remove('hidden');
    }

    /** Hide pause overlay. */
    hidePause() {
        document.getElementById('pause-overlay').classList.add('hidden');
    }

    /** Show/hide HUD. */
    showHUD(show) {
        const hud = document.getElementById('hud');
        if (show) {
            hud.classList.remove('hidden');
        } else {
            hud.classList.add('hidden');
        }
    }

    /** Draw a message on the game canvas. */
    drawMessage(ctx, text, x, y, color = '#fff', fontSize = 16) {
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y);
    }

    /** Draw a room notification (e.g., "Treasure Room!"). */
    drawNotification(ctx, text, duration = 120) {
        // Store for rendering in game loop
        this._notification = { text, duration, maxDuration: duration };
    }

    /** Render the current notification. */
    renderNotification(ctx) {
        if (!this._notification || this._notification.duration <= 0) {
            this._notification = null;
            return;
        }

        const { text, duration, maxDuration } = this._notification;
        const alpha = Math.min(1, duration / 30);
        const scale = duration > maxDuration - 30 ? (maxDuration - duration) / 30 : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2 - 60);
        ctx.scale(scale, scale);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 0, 0);

        ctx.restore();

        this._notification.duration--;
    }
}
