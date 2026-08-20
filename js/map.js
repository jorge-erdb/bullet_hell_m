/**
 * Procedural map generation — rooms, corridors, enemy spawns.
 */

/**
 * DungeonMap — a procedurally generated dungeon floor.
 *
 * Named DungeonMap, not Map: a top-level `class Map` in a classic script
 * shadows the built-in Map for every other script on the page, so an innocent
 * `new Map()` anywhere in the project silently returns a dungeon with no
 * .get/.set/.clear. That is exactly how it bit the touch controls.
 */
class DungeonMap {
    constructor(width = 2000, height = 2000) {
        this.width = width;
        this.height = height;
        this.tileSize = 32;
        this.corridorWidth = 128; // 4 tiles — wide enough to dodge in
        this.rooms = [];
        this.corridors = [];
        this.exit = null;
        this.playerStart = null;
        this.roomsCleared = 0;
        this.totalRooms = 0;
        // Fewer rooms than before, because each one is now several times larger
        // and carries proportionally more of the run.
        this.roomCount = 6 + Math.floor(Math.random() * 4); // 6-9 rooms
    }

    /** Generate a new map. */
    generate() {
        this.rooms = [];
        this.corridors = [];

        // Place start room at the centre of the map. tx/ty are top-left, so
        // offset by half the room to actually land centred.
        const startSize = 640;
        const startTiles = Math.ceil(startSize / this.tileSize);
        const startX = Math.floor((this.width / this.tileSize - startTiles) / 2);
        const startY = Math.floor((this.height / this.tileSize - startTiles) / 2);
        const startRoom = this.placeRoom(startX, startY, 'start', startSize);
        if (!startRoom) return this.generate(); // retry

        // Place additional rooms
        let attempts = 0;
        while (this.rooms.length < this.roomCount && attempts < 200) {
            attempts++;
            // Pick a random existing room
            const parentIdx = Math.floor(Math.random() * this.rooms.length);
            const parent = this.rooms[parentIdx];

            // Pick a direction
            const dir = Math.floor(Math.random() * 4);
            const offsets = [
                { dx: 0, dy: -1 },  // up
                { dx: 0, dy: 1 },   // down
                { dx: -1, dy: 0 },  // left
                { dx: 1, dy: 0 }    // right
            ];
            const offset = offsets[dir];

            const newRoom = this.tryPlaceRoom(parent, offset);

            if (newRoom) {
                this.createCorridor(parent, newRoom);
            }
        }

        // Assign room types
        this.assignRoomTypes();

        // Mark exit room
        this.setExitRoom();

        // Calculate pixel positions
        this.calculatePositions();

        // Ensure connectivity
        this.ensureConnectivity();

        this.totalRooms = this.rooms.length;
        this.roomsCleared = 0;
    }

    /** Place a room at tile grid position, return room object or null. */
    tryPlaceRoom(parent, offset) {
        // Random size
        // Room sizes are driven by enemy AI ranges, not aesthetics. ShooterEnemy
        // holds a 180-250px standoff and SpiralEnemy closes to 140px, so a room
        // has to comfortably exceed twice the standoff or those enemies are
        // forced out through the walls the moment the player walks in.
        const sizes = [
            { w: 20, h: 20 },  // small ~640px
            { w: 26, h: 26 },  // medium ~832px
            { w: 32, h: 32 }   // large ~1024px
        ];
        const size = sizes[Math.floor(Math.random() * sizes.length)];

        // Butt the new room against the parent's edge, leaving the same gap
        // overlapsAny() enforces, and centre it on the perpendicular axis so
        // the connecting corridor runs straight rather than dog-legging.
        const gap = 3;
        let tileX, tileY;
        if (offset.dx !== 0) {
            tileX = offset.dx > 0 ? parent.tx + parent.tw + gap
                                  : parent.tx - size.w - gap;
            tileY = parent.ty + Math.round((parent.th - size.h) / 2);
        } else {
            tileY = offset.dy > 0 ? parent.ty + parent.th + gap
                                  : parent.ty - size.h - gap;
            tileX = parent.tx + Math.round((parent.tw - size.w) / 2);
        }

        // Check bounds (tx/ty are top-left)
        const maxTX = this.width / this.tileSize;
        const maxTY = this.height / this.tileSize;
        if (tileX < 2 || tileX + size.w > maxTX - 2) return null;
        if (tileY < 2 || tileY + size.h > maxTY - 2) return null;

        // Check overlap with existing rooms (min 3 tile gap)
        const newRoom = {
            tx: tileX,
            ty: tileY,
            tw: size.w,
            th: size.h,
            type: 'combat',
            parent: parent,
            cleared: false
        };

        if (this.overlapsAny(newRoom, 3)) return null;

        this.rooms.push(newRoom);
        return newRoom;
    }

    /** Place a room whose top-left tile is (tileX, tileY). `size` is in pixels. */
    placeRoom(tileX, tileY, type, size) {
        const newRoom = {
            tx: tileX,
            ty: tileY,
            tw: Math.ceil(size / this.tileSize),
            th: Math.ceil(size / this.tileSize),
            type: type,
            parent: null,
            cleared: false
        };

        if (this.overlapsAny(newRoom, 3)) return null;

        this.rooms.push(newRoom);
        return newRoom;
    }

    /**
     * Check if a room overlaps any existing room, allowing a minimum gap.
     *
     * (tx, ty) is the room's TOP-LEFT tile. This must stay consistent with
     * calculatePositions(), which derives room.x/room.y the same way — an
     * earlier version treated it as the room's centre here and as the top-left
     * there, so the rectangle being collision-checked sat half a room away
     * from the one actually drawn.
     */
    overlapsAny(room, minGap) {
        const ts = this.tileSize;
        const rx1 = room.tx * ts;
        const ry1 = room.ty * ts;
        const rx2 = rx1 + room.tw * ts;
        const ry2 = ry1 + room.th * ts;

        for (const other of this.rooms) {
            if (other === room) continue;
            const ox1 = other.tx * ts - minGap * ts;
            const oy1 = other.ty * ts - minGap * ts;
            const ox2 = other.tx * ts + other.tw * ts + minGap * ts;
            const oy2 = other.ty * ts + other.th * ts + minGap * ts;

            if (rx1 < ox2 && rx2 > ox1 && ry1 < oy2 && ry2 > oy1) {
                return true;
            }
        }
        return false;
    }

    /** Create a corridor connecting two rooms (L-shaped). */
    createCorridor(roomA, roomB) {
        // Only the room references are stored here. Pixel endpoints need room
        // centres, which don't exist until calculatePositions() runs, so they
        // are resolved there rather than guessed from tile coords.
        this.corridors.push({ a: roomA, b: roomB });
    }

    /** Assign room types. */
    assignRoomTypes() {
        if (this.rooms.length < 3) return;

        const weights = {
            'combat': 5,
            'combat-hard': 3,
            'treasure': 2,
            'empty': 2
        };

        for (let i = 1; i < this.rooms.length; i++) { // skip start room
            const room = this.rooms[i];
            if (room.type === 'start') continue;

            // Weighted random
            const r = Math.random();
            let cumulative = 0;
            for (const [type, weight] of Object.entries(weights)) {
                cumulative += weight;
                if (r < cumulative / Object.values(weights).reduce((a, b) => a + b, 0)) {
                    room.type = type;
                    break;
                }
            }
        }
    }

    /** Set the last room as the exit room. */
    setExitRoom() {
        // Never mark the start room as the exit: the player spawns on the exit
        // and re-triggers the room transition every frame.
        const candidates = this.rooms.filter(r => r.type !== 'start');
        if (candidates.length === 0) return;

        const start = this.rooms[0];
        let best = candidates[0];
        let bestDist = -1;
        for (const room of candidates) {
            const dx = room.tx - start.tx;
            const dy = room.ty - start.ty;
            const d = dx * dx + dy * dy;
            if (d > bestDist) { bestDist = d; best = room; }
        }
        best.type = 'exit';
    }

    /** Calculate pixel positions and centers for each room. */
    calculatePositions() {
        for (const room of this.rooms) {
            room.x = room.tx * this.tileSize;
            room.y = room.ty * this.tileSize;
            room.w = room.tw * this.tileSize;
            room.h = room.th * this.tileSize;
            room.cx = room.x + room.w / 2; // center x
            room.cy = room.y + room.h / 2; // center y
        }

        // Corridor endpoints: centre of each connected room
        for (const corr of this.corridors) {
            corr.x1 = corr.a.cx;
            corr.y1 = corr.a.cy;
            corr.x2 = corr.b.cx;
            corr.y2 = corr.b.cy;
        }

        // Flatten corridors to plain rects once. isWalkable() runs several times
        // per entity per frame, so it must not allocate.
        this.corridorRects = [];
        for (const corr of this.corridors) {
            for (const seg of this.corridorSegments(corr)) {
                this.corridorRects.push({
                    x: seg.x1, y: seg.y1,
                    w: seg.x2 - seg.x1, h: seg.y2 - seg.y1
                });
            }
        }

        // Player start: center of first room
        this.playerStart = {
            x: this.rooms[0].cx,
            y: this.rooms[0].cy
        };

        // Exit: center of exit room
        const exitRoom = this.rooms.find(r => r.type === 'exit');
        if (exitRoom) {
            this.exit = {
                x: exitRoom.cx,
                y: exitRoom.cy,
                room: exitRoom
            };
        }
    }

    /** Ensure all rooms are reachable from start via BFS. */
    ensureConnectivity() {
        // Simple approach: if any room is unreachable, connect it to its parent
        const visited = new Set();
        const queue = [0]; // start room index
        visited.add(0);

        while (queue.length > 0) {
            const idx = queue.shift();
            const room = this.rooms[idx];
            if (room.parent) {
                const parentIdx = this.rooms.indexOf(room.parent);
                if (!visited.has(parentIdx)) {
                    visited.add(parentIdx);
                    queue.push(parentIdx);
                }
            }
            // Also check connections via corridors
            for (let i = 0; i < this.rooms.length; i++) {
                for (const corr of this.corridors) {
                    const r1 = this.rooms.find(r => {
                        return corr.x1 >= r.x && corr.x1 < r.x + r.w &&
                               corr.y1 >= r.y && corr.y1 < r.y + r.h;
                    });
                    const r2 = this.rooms.find(r => {
                        return corr.x2 >= r.x && corr.x2 < r.x + r.w &&
                               corr.y2 >= r.y && corr.y2 < r.y + r.h;
                    });
                    if (r1 && r2 && visited.has(this.rooms.indexOf(r1))) {
                        const idx2 = this.rooms.indexOf(r2);
                        if (!visited.has(idx2)) {
                            visited.add(idx2);
                            queue.push(idx2);
                        }
                    }
                }
            }
        }
    }

    /**
     * Pick a spawn point inside a room, kept clear of the player.
     *
     * Enemies used to appear right on top of whoever triggered the spawn,
     * because the sample was taken blind. Retries a bounded number of times,
     * then falls back to the best candidate found rather than looping forever
     * in a room too small to satisfy the constraint.
     */
    spawnPointInRoom(room, avoid, minDist) {
        let best = null, bestDist = -1;
        for (let i = 0; i < 12; i++) {
            const x = room.cx + (Math.random() - 0.5) * (room.w * 0.6);
            const y = room.cy + (Math.random() - 0.5) * (room.h * 0.6);
            if (!avoid) return { x, y };
            const d = Math.hypot(x - avoid.x, y - avoid.y);
            if (d >= minDist) return { x, y };
            if (d > bestDist) { bestDist = d; best = { x, y }; }
        }
        return best;
    }

    /**
     * Get enemies for a given room.
     * @param {Object} room
     * @param {Object|null} avoid - point to keep spawns away from (the player)
     * @param {number} minDist - how far away to keep them
     */
    getEnemiesForRoom(room, avoid = null, minDist = 280) {
        const enemies = [];
        const spawn = () => this.spawnPointInRoom(room, avoid, minDist);

        switch (room.type) {
            case 'start':
                // No enemies in start room
                break;

            case 'combat':
                const count = 2 + Math.floor(Math.random() * 3); // 2-4
                for (let i = 0; i < count; i++) {
                    const p = spawn();
                    enemies.push(createEnemy(randomEnemyType(), p.x, p.y));
                }
                break;

            case 'combat-hard':
                const hCount = 4 + Math.floor(Math.random() * 3); // 4-6
                for (let i = 0; i < hCount; i++) {
                    const p = spawn();
                    enemies.push(createEnemy(hardEnemyType(), p.x, p.y));
                }
                break;

            case 'treasure':
                // No enemies, but give bonus XP
                break;

            case 'boss':
                enemies.push(createEnemy('boss', room.cx, room.cy));
                // Add 2 minions
                for (let i = 0; i < 2; i++) {
                    const p = spawn();
                    enemies.push(createEnemy(randomEnemyType(), p.x, p.y));
                }
                break;

            case 'empty':
                // No enemies
                break;

            case 'exit':
                // No enemies in exit room
                break;
        }

        return enemies;
    }

    /** Get treasure rewards for a room. */
    getTreasureForRoom(room) {
        if (room.type === 'treasure') {
            return {
                heal: 30,
                xp: 30
            };
        }
        return null;
    }

    /**
     * Is this point on walkable floor — inside a room or a corridor?
     *
     * The walkable area is the *union* of room and corridor rectangles, which
     * matters at junctions: a point in the overlap belongs to both, so the
     * union test passes cleanly where a per-rect test would snag.
     */
    isWalkable(x, y) {
        for (const room of this.rooms) {
            if (x >= room.x && x <= room.x + room.w &&
                y >= room.y && y <= room.y + room.h) return true;
        }
        for (const r of this.corridorRects) {
            if (x >= r.x && x <= r.x + r.w &&
                y >= r.y && y <= r.y + r.h) return true;
        }
        return false;
    }

    /**
     * Can a circle of this radius sit at (x, y) without poking through a wall?
     *
     * Samples the centre plus the four cardinal extremes. That is not an exact
     * circle-vs-union test — a convex corner can still be clipped slightly —
     * but it is cheap, allocation-free, and indistinguishable in play.
     */
    canOccupy(x, y, radius) {
        return this.isWalkable(x, y) &&
               this.isWalkable(x - radius, y) &&
               this.isWalkable(x + radius, y) &&
               this.isWalkable(x, y - radius) &&
               this.isWalkable(x, y + radius);
    }

    /** Check if a point is inside any room. */
    pointInRoom(px, py) {
        for (const room of this.rooms) {
            if (px >= room.x && px < room.x + room.w &&
                py >= room.y && py < room.y + room.h) {
                return room;
            }
        }
        return null;
    }

    /** Get the room a point is currently in. */
    getCurrentRoom(px, py) {
        return this.pointInRoom(px, py);
    }

    /** Mark a room as cleared. */
    clearRoom(room) {
        if (!room.cleared) {
            room.cleared = true;
            this.roomsCleared++;
        }
    }

    /**
     * Fill a floor rectangle: base colour plus a checkerboard of lighter tiles.
     *
     * The checkerboard phase comes from GLOBAL tile coordinates, not from the
     * rectangle's own origin. That is what lets rooms and corridors be filled
     * independently and still seam together invisibly — which matters because
     * corridors run centre-to-centre and therefore cross room interiors. Give
     * them their own colour and every room gets a stripe painted across it.
     */
    fillFloor(ctx, x, y, w, h, clip) {
        const ts = this.tileSize;
        const x0 = Math.max(x, clip.left), y0 = Math.max(y, clip.top);
        const x1 = Math.min(x + w, clip.right), y1 = Math.min(y + h, clip.bottom);
        if (x1 <= x0 || y1 <= y0) return;

        ctx.fillStyle = PALETTE.floorDark;
        ctx.fillRect(snap(x0), snap(y0), snap(x1 - x0), snap(y1 - y0));

        ctx.fillStyle = PALETTE.floorLight;
        const tx0 = Math.floor(x0 / ts), ty0 = Math.floor(y0 / ts);
        const tx1 = Math.ceil(x1 / ts), ty1 = Math.ceil(y1 / ts);
        for (let ty = ty0; ty < ty1; ty++) {
            for (let tx = tx0; tx < tx1; tx++) {
                if ((tx + ty) % 2 !== 0) continue;
                const px = Math.max(tx * ts, x0), py = Math.max(ty * ts, y0);
                const pw = Math.min((tx + 1) * ts, x1) - px;
                const ph = Math.min((ty + 1) * ts, y1) - py;
                if (pw > 0 && ph > 0) ctx.fillRect(snap(px), snap(py), snap(pw), snap(ph));
            }
        }
    }

    /**
     * Draw the level.
     *
     * View size arrives in world units rather than being read off the canvas:
     * the backing store is PIXEL_SIZE times smaller than the window, so canvas
     * dimensions are not world dimensions.
     */
    draw(ctx, camera, viewW, viewH) {
        const ts = this.tileSize;
        const clip = {
            left: camera.x - ts, right: camera.x + viewW + ts,
            top: camera.y - ts, bottom: camera.y + viewH + ts
        };
        const visible = (x, y, w, h) =>
            !(x > clip.right || x + w < clip.left || y > clip.bottom || y + h < clip.top);

        // Walls first, as slabs. Floors are painted over them afterwards, so
        // corridor mouths open doorways without any special-casing.
        for (const room of this.rooms) {
            if (!visible(room.x - 8, room.y - 8, room.w + 16, room.h + 16)) continue;
            pixelFrame(ctx, room.x - 8, room.y - 8, room.w + 16, room.h + 16, 8, PALETTE.wall);
            pixelFrame(ctx, room.x - 2, room.y - 2, room.w + 4, room.h + 4, 2, PALETTE.wallLit);
        }

        for (const room of this.rooms) {
            if (!visible(room.x, room.y, room.w, room.h)) continue;
            this.fillFloor(ctx, room.x, room.y, room.w, room.h, clip);
            ctx.fillStyle = PALETTE.floorGrime;
            ctx.fillRect(snap(room.x), snap(room.y), snap(room.w), 3);
            ctx.fillRect(snap(room.x), snap(room.y + room.h - 3), snap(room.w), 3);
        }

        for (const r of this.corridorRects) {
            if (!visible(r.x, r.y, r.w, r.h)) continue;
            this.fillFloor(ctx, r.x, r.y, r.w, r.h, clip);
        }

        // Exit door
        if (this.exit) {
            const e = this.exit;
            pixelRect(ctx, e.x, e.y, 54, 30, PALETTE.exit);
            pixelRect(ctx, e.x, e.y, 44, 20, '#0d2a12');
            pixelRect(ctx, e.x, e.y, 10, 14, PALETTE.exit);
        }

        // Start pad
        const startRoom = this.rooms[0];
        if (startRoom) {
            pixelFrame(ctx, startRoom.cx - 18, startRoom.cy - 18, 36, 36, 2, PALETTE.hudDim);
        }
    }

    /**
     * Get corridor segments (L-shaped: horizontal at y1, then vertical at x2).
     *
     * Each segment is a rectangle of real width. Previously these were returned
     * with zero thickness, so the fillRect() in draw() painted nothing and
     * corridors showed up as hairlines. Both segments are extended by a half
     * width at their ends so the elbow joins cleanly instead of notching.
     */
    corridorSegments(corr, width = this.corridorWidth) {
        const h = width / 2;
        return [
            {   // horizontal run
                x1: Math.min(corr.x1, corr.x2) - h,
                y1: corr.y1 - h,
                x2: Math.max(corr.x1, corr.x2) + h,
                y2: corr.y1 + h
            },
            {   // vertical run
                x1: corr.x2 - h,
                y1: Math.min(corr.y1, corr.y2) - h,
                x2: corr.x2 + h,
                y2: Math.max(corr.y1, corr.y2) + h
            }
        ];
    }
}