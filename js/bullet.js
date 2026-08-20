/**
 * Bullet utilities — collision detection and cleanup.
 */

/**
 * Circle-circle collision check.
 * @param {number} x1
 * @param {number} y1
 * @param {number} r1
 * @param {number} x2
 * @param {number} y2
 * @param {number} r2
 * @returns {boolean}
 */
function circleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return (dx * dx + dy * dy) < (r1 + r2) * (r1 + r2);
}

/**
 * Check if an enemy bullet hits the player.
 * @param {Object} bullet - enemy bullet
 * @param {Object} player - player object
 * @returns {boolean}
 */
function bulletHitsPlayer(bullet, player) {
    return circleCollision(bullet.x, bullet.y, bullet.radius, player.x, player.y, player.radius);
}

/**
 * Remove bullets that are out of bounds.
 * @param {Array} bullets
 * @param {number} margin - extra margin beyond bounds
 * @param {number} mapWidth - width of the map area
 * @param {number} mapHeight - height of the map area
 * @returns {Array} filtered bullets
 */
function removeDead(bullets, margin = 100, mapWidth = 2000, mapHeight = 2000) {
    return bullets.filter(b => {
        return b.x > -margin && b.x < mapWidth + margin &&
               b.y > -margin && b.y < mapHeight + margin;
    });
}
