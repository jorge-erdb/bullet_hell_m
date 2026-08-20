/**
 * Enemy classes — base class and 3 enemy types + boss.
 */

/**
 * Difficulty ramp.
 *
 * Enemy stats are authored at full strength and scaled DOWN early, so floor 10
 * and beyond plays exactly as the tuned values read in each constructor. Only
 * the first floors are eased.
 */
const DIFFICULTY_RAMP_FLOORS = 10;

/** Multipliers applied on floor 1, interpolated to 1.0 by DIFFICULTY_RAMP_FLOORS. */
const EARLY_GAME = {
    speed: 0.55,        // slower movement
    shootCooldown: 1.9, // longer gap between shots (higher = slower fire)
    bulletSpeed: 0.60   // slower, more readable bullets
};

/**
 * Ramp position for a floor: 0 on floor 1, 1 on floor 10 and after.
 * @param {number} floor - 1-based
 */
function difficultyForFloor(floor) {
    const t = (floor - 1) / (DIFFICULTY_RAMP_FLOORS - 1);
    return Math.max(0, Math.min(1, t));
}


// ===== Base Enemy Class =====
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.health = 30;
        this.maxHealth = 30;
        this.speed = 1.5;
        this.damage = 10;
        this.radius = 14;
        this.color = '#ff4444';
        this.xpValue = 10;
        this.shootCooldown = 90;
        this.shootTimer = 0;
        this.bulletSpeedScale = 1;
        this.alive = true;
        this.deathTimer = 0;
        this.angle = 0; // for rotation animations
    }

    update(player, enemies, map) {
        // Override in subclass
    }

    /**
     * Move by a delta, respecting walls when a map is supplied.
     *
     * Resolved per axis so an enemy pressed against a wall slides along it.
     * This is what keeps enemies inside the room they were spawned in — they
     * have no pathfinding, so without it a chaser would walk through walls and
     * a kiting shooter would back straight out of the level.
     */
    moveBy(dx, dy, map) {
        if (!map) {
            this.x += dx;
            this.y += dy;
            return;
        }
        if (map.canOccupy(this.x + dx, this.y, this.radius)) this.x += dx;
        if (map.canOccupy(this.x, this.y + dy, this.radius)) this.y += dy;
    }

    shootTowardPlayer(angle, speed = 3) {
        const v = speed * this.bulletSpeedScale;
        return {
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * v,
            vy: Math.sin(angle) * v,
            damage: this.damage,
            radius: 6,
            color: this.color,
            speed: v
        };
    }

    /**
     * Ease this enemy's stats for an early floor.
     *
     * Called once, right after construction, so it scales whatever the subclass
     * set rather than the base defaults. At t = 1 every multiplier is 1.0 and
     * the enemy is left exactly as authored.
     *
     * @param {number} t - ramp position from difficultyForFloor()
     */
    applyDifficulty(t) {
        const ease = (early) => early + (1 - early) * t;

        this.speed *= ease(EARLY_GAME.speed);
        this.bulletSpeedScale = ease(EARLY_GAME.bulletSpeed);
        this.shootCooldown = Math.round(this.shootCooldown * ease(EARLY_GAME.shootCooldown));

        // shootTimer starts at 0, which makes every enemy fire on its first
        // frame — the whole room volleys the instant the player walks in.
        // Start it partway through a randomised cooldown instead, so shots are
        // staggered and the player gets a moment to read the room.
        this.shootTimer = Math.round(this.shootCooldown * (0.6 + Math.random() * 0.6));
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.alive = false;
            this.deathTimer = 15;
        }
    }

    draw(ctx) {
        // Override in subclass
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#ff8888';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Health bar
        if (this.health < this.maxHealth) {
            const barW = this.radius * 2;
            const barH = 3;
            const barX = this.x - barW / 2;
            const barY = this.y - this.radius - 8;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            ctx.fillStyle = '#cc2222';
            ctx.fillRect(barX, barY, barW * (this.health / this.maxHealth), barH);
        }
    }
}

// ===== BasicEnemy — Chaser =====
class BasicEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'basic');
        this.health = 30;
        this.maxHealth = 30;
        this.speed = 2.2;
        this.damage = 10;
        this.radius = 14;
        this.color = '#ff4444';
        this.xpValue = 10;
        this.shootCooldown = 90;
    }

    update(player, enemies, map) {
        // Move toward player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            this.moveBy((dx / dist) * this.speed, (dy / dist) * this.speed, map);
        }

        // Shoot toward player
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            const angle = Math.atan2(dy, dx);
            return [this.shootTowardPlayer(angle, 3)];
        }
        return [];
    }
}

// ===== ShooterEnemy — Sniper (keeps distance) =====
class ShooterEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'shooter');
        this.health = 20;
        this.maxHealth = 20;
        this.speed = 1.5;
        this.damage = 15;
        this.radius = 12;
        this.color = '#aa44ff';
        this.xpValue = 15;
        this.shootCooldown = 60;
    }

    update(player, enemies, map) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Keep distance: back off inside 180px, close in beyond 250px
        if (dist < 180) {
            this.moveBy(-(dx / dist) * this.speed, -(dy / dist) * this.speed, map);
        } else if (dist > 250) {
            this.moveBy((dx / dist) * this.speed, (dy / dist) * this.speed, map);
        }

        // Shoot
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            return [this.shootTowardPlayer(Math.atan2(dy, dx), 5)];
        }
        return [];
    }
}

// ===== SpiralEnemy — Pattern Shooter =====
class SpiralEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'spiral');
        this.health = 50;
        this.maxHealth = 50;
        this.speed = 1.2;
        this.damage = 8;
        this.radius = 16;
        this.color = '#ff8800';
        this.xpValue = 20;
        this.shootCooldown = 45;
        this.spiralAngle = 0;
    }

    update(player, enemies, map) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Move slowly toward player, stop at ~150px
        if (dist > 140) {
            this.moveBy((dx / dist) * this.speed, (dy / dist) * this.speed, map);
        }

        // Spiral bullet pattern
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            const bullets = [];
            const count = 5;
            for (let i = 0; i < count; i++) {
                const angle = this.spiralAngle + (Math.PI * 2 / count) * i;
                bullets.push(this.shootTowardPlayer(angle, 2.5));
            }
            this.spiralAngle += 0.4; // rotate pattern each shot
            return bullets;
        }
        return [];
    }
}

// ===== BossEnemy — Boss =====
class BossEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'boss');
        this.health = 500;
        this.maxHealth = 500;
        this.speed = 0.8;
        this.damage = 20;
        this.radius = 40;
        this.color = '#8b0000';
        this.xpValue = 200;
        this.shootCooldown = 30;
        this.phase = 0;
        this.phaseTimer = 0;
        this.phaseDuration = 100; // frames per phase
        this.centerX = x;
        this.centerY = y;
        this.driftAngle = 0;
    }

    update(player, enemies, map) {
        // Drift in a slow circle around center
        this.driftAngle += 0.01;
        this.x = this.centerX + Math.cos(this.driftAngle) * 80;
        this.y = this.centerY + Math.sin(this.driftAngle) * 60;

        // Phase changes
        this.phaseTimer++;
        if (this.phaseTimer >= this.phaseDuration) {
            this.phaseTimer = 0;
            this.phase = (this.phase + 1) % 3;
        }

        // Attack based on phase
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            const bullets = [];
            const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);

            switch (this.phase) {
                case 0: // Spiral — 8 bullets
                    for (let i = 0; i < 8; i++) {
                        bullets.push(this.shootTowardPlayer(
                            (Math.PI * 2 / 8) * i + this.phaseTimer * 0.05,
                            2.5
                        ));
                    }
                    break;
                case 1: // Aimed burst — 3 fast bullets
                    for (let i = -1; i <= 1; i++) {
                        bullets.push(this.shootTowardPlayer(angleToPlayer + i * 0.2, 5));
                    }
                    break;
                case 2: // Circle burst — 12 slow bullets
                    for (let i = 0; i < 12; i++) {
                        bullets.push(this.shootTowardPlayer(
                            (Math.PI * 2 / 12) * i,
                            2
                        ));
                    }
                    break;
            }
            return bullets;
        }
        return [];
    }

    draw(ctx) {
        // Hexagon shape for boss
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI * 2 / 6) * i;
            const px = Math.cos(a) * this.radius;
            const py = Math.sin(a) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6666';
        ctx.fill();

        ctx.restore();

        // Phase indicator
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`PHASE ${this.phase + 1}`, this.x, this.y - this.radius - 15);

        // Health bar (wider for boss)
        const barW = this.radius * 3;
        const barH = 6;
        const barX = this.x - barW / 2;
        const barY = this.y - this.radius - 5;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(barX, barY, barW * (this.health / this.maxHealth), barH);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Name
        ctx.fillStyle = '#ff8888';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS', this.x, barY - 8);
    }
}

/**
 * Create an enemy instance from a type string.
 */
function createEnemy(type, x, y) {
    switch (type) {
        case 'basic':    return new BasicEnemy(x, y);
        case 'shooter':  return new ShooterEnemy(x, y);
        case 'spiral':   return new SpiralEnemy(x, y);
        case 'boss':     return new BossEnemy(x, y);
        default:         return new BasicEnemy(x, y);
    }
}

/**
 * Pick a random non-boss enemy type, weighted.
 */
function randomEnemyType() {
    const types = ['basic', 'basic', 'basic', 'shooter', 'shooter', 'spiral'];
    return types[Math.floor(Math.random() * types.length)];
}

/**
 * Pick a mixed enemy type for hard rooms.
 */
function hardEnemyType() {
    const types = ['basic', 'shooter', 'spiral', 'shooter', 'spiral'];
    return types[Math.floor(Math.random() * types.length)];
}
