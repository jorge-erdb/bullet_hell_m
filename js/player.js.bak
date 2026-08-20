/**
 * Player class — handles movement, shooting, stats, and leveling.
 */
class Player {
    constructor(x, y) {
        // Position
        this.x = x;
        this.y = y;
        this.radius = 12;

        // Stats
        this.maxHealth = 100;
        this.health = 100;
        this.speed = 3.0;
        this.damage = 10;
        this.fireRate = 12;          // frames between shots
        this.bulletSpeed = 7;
        this.bulletCount = 1;        // multi-shot count
        this.bulletPierce = 0;
        this.magnetRange = 60;

        // Level / XP
        this.level = 1;
        this.xp = 0;
        this.xpTable = [50, 120, 220, 350, 520, 750, 1050, 1400, 1850, 2400];

        // Cooldowns
        this.fireTimer = 0;
        this.invincibleTimer = 0;

        // Aim direction (unit vector)
        this.aimX = 0;
        this.aimY = -1;

        // Angle for spiral enemies (not used by player, but kept for reference)
        this.angle = 0;
    }

    /** XP needed to reach next level. Returns 0 if max level. */
    xpToNext() {
        if (this.level >= this.xpTable.length) return 0;
        return this.xpTable[this.level - 1];
    }

    /** Gain XP and return true if leveled up. */
    gainXP(amount) {
        this.xp += amount;
        const needed = this.xpToNext();
        if (needed > 0 && this.xp >= needed) {
            this.xp -= needed;
            this.level++;
            return true;
        }
        return false;
    }

    /** Take damage with invincibility frames. */
    takeDamage(amount) {
        if (this.invincibleTimer > 0) return;
        this.health = Math.max(0, this.health - amount);
        this.invincibleTimer = 30; // 0.5 seconds at 60fps
    }

    /** Heal to full. */
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    /** Update player position and shooting. */
    update(input, camera, mapWidth, mapHeight) {
        // Movement
        let dx = 0, dy = 0;
        if (input.keys['KeyW'] || input.keys['ArrowUp'])    dy -= 1;
        if (input.keys['KeyS'] || input.keys['ArrowDown'])  dy += 1;
        if (input.keys['KeyA'] || input.keys['ArrowLeft'])  dx -= 1;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) dx += 1;

        // Normalize diagonal
        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.SQRT2;
            dx *= inv;
            dy *= inv;
        }

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        // Clamp to map bounds
        if (mapWidth !== undefined) {
            this.x = Math.max(this.radius, Math.min(this.x, mapWidth - this.radius));
            this.y = Math.max(this.radius, Math.min(this.y, mapHeight - this.radius));
        }

        // Aim direction — convert screen-space mouse to world-space
        if (input.mouseX !== undefined) {
            const worldMouseX = camera ? camera.x + input.mouseX : input.mouseX;
            const worldMouseY = camera ? camera.y + input.mouseY : input.mouseY;
            const adx = worldMouseX - this.x;
            const ady = worldMouseY - this.y;
            const dist = Math.sqrt(adx * adx + ady * ady);
            if (dist > 0) {
                this.aimX = adx / dist;
                this.aimY = ady / dist;
            }
        }

        // Shooting cooldown
        if (this.fireTimer > 0) this.fireTimer--;
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        // Auto-fire on click
        if (input.mouseDown && this.fireTimer <= 0) {
            this.fireTimer = this.fireRate;
            return true; // signal to shoot
        }
        return false;
    }

    /** Shoot bullets in aimed direction with spread. */
    shoot() {
        const bullets = [];
        const count = this.bulletCount;
        const spreadAngle = 0.15; // radians total spread

        for (let i = 0; i < count; i++) {
            let angle;
            if (count === 1) {
                angle = Math.atan2(this.aimY, this.aimX);
            } else {
                const centerAngle = Math.atan2(this.aimY, this.aimX);
                const halfSpread = ((count - 1) / 2) * spreadAngle;
                angle = centerAngle - halfSpread + i * spreadAngle;
            }

            bullets.push({
                x: this.x + this.aimX * (this.radius + 4),
                y: this.y + this.aimY * (this.radius + 4),
                vx: Math.cos(angle) * this.bulletSpeed,
                vy: Math.sin(angle) * this.bulletSpeed,
                damage: this.damage,
                pierce: this.bulletPierce,
                hits: 0,
                radius: 4,
                color: '#4fc3f7'
            });
        }
        return bullets;
    }

    /** Draw the player. */
    draw(ctx) {
        // Invincibility flash
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 3) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        // Body — blue circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#2196f3';
        ctx.fill();
        ctx.strokeStyle = '#64b5f6';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Invincibility glow
        if (this.invincibleTimer > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.globalAlpha = 1;

        // Aim indicator — line from center outward
        const aimLen = 20;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(
            this.x + this.aimX * aimLen,
            this.y + this.aimY * aimLen
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Aim dot
        ctx.beginPath();
        ctx.arc(
            this.x + this.aimX * aimLen,
            this.y + this.aimY * aimLen,
            3, 0, Math.PI * 2
        );
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
    }

    /** Get current stat display string. */
    getStatsString() {
        return `DMG: ${this.damage} | SPD: ${this.speed.toFixed(1)} | BULLETS: ${this.bulletCount}`;
    }
}
