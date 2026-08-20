/**
 * Procedural map generation — rooms, corridors, enemy spawns.
 */

/**
 * Map class — represents a procedurally generated dungeon floor.
 */
class Map {
    constructor(width = 2000, height = 2000) {
        this.width = width;
        this.height = height;
        this.tileSize = 32;
        this.rooms = [];
        this.corridors = [];
        this.exit = null;
        this.playerStart = null;
        this.roomsCleared = 0;
        this.totalRooms = 0;
        this.roomCount = 8 + Math.floor(Math.random() * 5); // 8-12 rooms
    }

    /** Generate a new map. */
    generate() {
        this.rooms = [];
        this.corridors = [];

        // Place start room at center
        const startX = Math.floor(this.width / (2 * this.tileSize));
        const startY = Math.floor(this.height / (2 * this.tileSize));
        const startRoom = this.placeRoom(startX, startY, 'start', 256);
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
        const sizes = [
            { w: 4, h: 4 },   // small ~128px
            { w: 6, h: 6 },   // medium ~192px
            { w: 8, h: 8 }    // large ~256px
        ];
        const size = sizes[Math.floor(Math.random() * sizes.length)];

        // Step far enough that the new room clears the parent AND the 3-tile
        // gap that overlapsAny() enforces. Stepping by 1 tile put the new room
        // inside the parent, so every placement was rejected.
        const gap = 3;
        const stepX = Math.ceil(parent.tw / 2 + size.w / 2) + gap;
        const stepY = Math.ceil(parent.th / 2 + size.h / 2) + gap;
        const tileX = parent.tx + offset.dx * stepX;
        const tileY = parent.ty + offset.dy * stepY;

        // Check bounds
        if (tileX - size.w / 2 < 2 || tileX + size.w / 2 > this.width / this.tileSize - 2) return null;
        if (tileY - size.h / 2 < 2 || tileY + size.h / 2 > this.height / this.tileSize - 2) return null;

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

    placeRoom(tileX, tileY, type, size) {
        const half = Math.floor(size / this.tileSize / 2);
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

    /** Check if a room overlaps any existing room. */
    overlapsAny(room, minGap) {
        const rx1 = room.tx * this.tileSize - room.tw * this.tileSize / 2;
        const ry1 = room.ty * this.tileSize - room.th * this.tileSize / 2;
        const rx2 = rx1 + room.tw * this.tileSize;
        const ry2 = ry1 + room.th * this.tileSize;

        for (const other of this.rooms) {
            if (other === room) continue;
            const ox1 = other.tx * this.tileSize - other.tw * this.tileSize / 2 - minGap * this.tileSize;
            const oy1 = other.ty * this.tileSize - other.th * this.tileSize / 2 - minGap * this.tileSize;
            const ox2 = ox1 + other.tw * this.tileSize + minGap * this.tileSize * 2;
            const oy2 = oy1 + other.th * this.tileSize + minGap * this.tileSize * 2;

            if (rx1 < ox2 && rx2 > ox1 && ry1 < oy2 && ry2 > oy1) {
                return true;
            }
        }
        return false;
    }

    /** Create a corridor connecting two rooms (L-shaped). */
    createCorridor(roomA, roomB) {
        const ax = roomA.tx * this.tileSize;
        const ay = roomA.ty * this.tileSize;
        const bx = roomB.tx * this.tileSize;
        const by = roomB.ty * this.tileSize;

        this.corridors.push({
            x1: ax, y1: ay,
            x2: bx, y2: by
        });
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

    /** Get enemies for a given room. */
    getEnemiesForRoom(room) {
        const enemies = [];
        const cx = room.cx;
        const cy = room.cy;

        switch (room.type) {
            case 'start':
                // No enemies in start room
                break;

            case 'combat':
                const count = 2 + Math.floor(Math.random() * 3); // 2-4
                for (let i = 0; i < count; i++) {
                    const type = randomEnemyType();
                    const ex = cx + (Math.random() - 0.5) * (room.w * 0.6);
                    const ey = cy + (Math.random() - 0.5) * (room.h * 0.6);
                    enemies.push(createEnemy(type, ex, ey));
                }
                break;

            case 'combat-hard':
                const hCount = 4 + Math.floor(Math.random() * 3); // 4-6
                for (let i = 0; i < hCount; i++) {
                    const type = hardEnemyType();
                    const ex = cx + (Math.random() - 0.5) * (room.w * 0.6);
                    const ey = cy + (Math.random() - 0.5) * (room.h * 0.6);
                    enemies.push(createEnemy(type, ex, ey));
                }
                break;

            case 'treasure':
                // No enemies, but give bonus XP
                break;

            case 'boss':
                enemies.push(createEnemy('boss', cx, cy));
                // Add 2 minions
                for (let i = 0; i < 2; i++) {
                    const type = randomEnemyType();
                    const ex = cx + (Math.random() - 0.5) * 200;
                    const ey = cy + (Math.random() - 0.5) * 200;
                    enemies.push(createEnemy(type, ex, ey));
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

    /** Draw the map tiles. */
    draw(ctx, camera) {
        // Calculate visible tile range
        const startTileX = Math.floor(camera.x / this.tileSize) - 1;
        const startTileY = Math.floor(camera.y / this.tileSize) - 1;
        const endTileX = startTileX + Math.ceil(ctx.canvas.width / this.tileSize) + 2;
        const endTileY = startTileY + Math.ceil(ctx.canvas.height / this.tileSize) + 2;

        // Draw floor tiles for each room
        for (const room of this.rooms) {
            const roomStartX = Math.max(startTileX, Math.floor(room.x / this.tileSize));
            const roomStartY = Math.max(startTileY, Math.floor(room.y / this.tileSize));
            const roomEndX = Math.min(endTileX, Math.floor((room.x + room.w) / this.tileSize));
            const roomEndY = Math.min(endTileY, Math.floor((room.y + room.h) / this.tileSize));

            for (let ty = roomStartY; ty < roomEndY; ty++) {
                for (let tx = roomStartX; tx < roomEndX; tx++) {
                    const px = tx * this.tileSize;
                    const py = ty * this.tileSize;

                    // Floor
                    ctx.fillStyle = '#2a2a2a';
                    ctx.fillRect(px, py, this.tileSize, this.tileSize);

                    // Subtle grid lines
                    ctx.strokeStyle = '#333333';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(px, py, this.tileSize, this.tileSize);
                }
            }

            // Room walls
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 2;
            ctx.strokeRect(room.x, room.y, room.w, room.h);

            // Corner pillars
            const pillarSize = 8;
            ctx.fillStyle = '#555555';
            // Top-left
            ctx.fillRect(room.x - 2, room.y - 2, pillarSize, pillarSize);
            // Top-right
            ctx.fillRect(room.x + room.w - pillarSize + 2, room.y - 2, pillarSize, pillarSize);
            // Bottom-left
            ctx.fillRect(room.x - 2, room.y + room.h - pillarSize + 2, pillarSize, pillarSize);
            // Bottom-right
            ctx.fillRect(room.x + room.w - pillarSize + 2, room.y + room.h - pillarSize + 2, pillarSize, pillarSize);
        }

        // Draw corridors
        for (const corr of this.corridors) {
            // L-shaped corridor: draw horizontal then vertical
            const segments = this.corridorSegments(corr);
            for (const seg of segments) {
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(seg.x1, seg.y1, seg.x2 - seg.x1, seg.y2 - seg.y1);
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(seg.x1, seg.y1, seg.x2 - seg.x1, seg.y2 - seg.y1);
            }
        }

        // Draw exit door
        if (this.exit) {
            const ex = this.exit.x;
            const ey = this.exit.y;
            const doorW = 40;
            const doorH = 20;

            ctx.fillStyle = '#2d5a2d';
            ctx.fillRect(ex - doorW / 2, ey - doorH / 2, doorW, doorH);
            ctx.strokeStyle = '#4caf50';
            ctx.lineWidth = 2;
            ctx.strokeRect(ex - doorW / 2, ey - doorH / 2, doorW, doorH);

            // Exit label
            ctx.fillStyle = '#4caf50';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('EXIT', ex, ey + 4);
        }

        // Draw start marker
        const startRoom = this.rooms[0];
        if (startRoom) {
            const sx = startRoom.cx;
            const sy = startRoom.cy;
            ctx.fillStyle = 'rgba(33, 150, 243, 0.3)';
            ctx.beginPath();
            ctx.arc(sx, sy, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#64b5f6';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('START', sx, sy - 25);
        }
    }

    /** Get corridor segments (L-shaped). */
    corridorSegments(corr) {
        const segments = [];
        // Horizontal segment
        segments.push({
            x1: Math.min(corr.x1, corr.x2),
            y1: corr.y1,
            x2: Math.max(corr.x1, corr.x2),
            y2: corr.y1
        });
        // Vertical segment
        segments.push({
            x1: corr.x2,
            y1: Math.min(corr.y1, corr.y2),
            x2: corr.x2,
            y2: Math.max(corr.y1, corr.y2)
        });
        return segments;
    }
}