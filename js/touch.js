/**
 * Touch controls — twin-stick, landscape only.
 *
 * A bullet hell needs simultaneous movement and aim, so a d-pad plus fire
 * button will not do: the left half of the screen drives movement, the right
 * half drives aim and fires while held. Both sticks are *floating* — they
 * appear wherever the thumb lands rather than at a fixed spot, which is what
 * makes them usable without looking down.
 *
 * Input is written into the same `input` object the keyboard and mouse use, as
 * analogue `moveX/moveY` and `aimX/aimY`, so the rest of the engine never
 * learns that touch exists.
 */
class TouchControls {
    /** Radius in CSS pixels at which a stick reads as fully deflected. */
    static STICK_RANGE = 68;

    /** Movement below this fraction of range is ignored, to kill thumb jitter. */
    static DEADZONE = 0.16;

    constructor(input, root) {
        this.input = input;
        this.root = root;

        // pointerId -> { kind: 'move' | 'aim', ox, oy }
        this.pointers = new Map();

        this.moveEl = root.querySelector('#stick-move');
        this.aimEl = root.querySelector('#stick-aim');

        this.bind();
    }

    /** Is this a touch device at all? Governs whether the layer is shown. */
    static isTouchDevice() {
        return (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    }

    bind() {
        // Pointer events cover touch, pen and mouse with one code path.
        this.root.addEventListener('pointerdown', (e) => this.onDown(e));
        this.root.addEventListener('pointermove', (e) => this.onMove(e));
        this.root.addEventListener('pointerup', (e) => this.onUp(e));
        this.root.addEventListener('pointercancel', (e) => this.onUp(e));
        // Stop long-press selection and double-tap zoom on the play surface.
        this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onDown(e) {
        const kind = e.clientX < window.innerWidth / 2 ? 'move' : 'aim';
        // One stick per side; a second thumb on the same side is ignored
        // rather than stealing control from the first.
        for (const p of this.pointers.values()) {
            if (p.kind === kind) return;
        }
        this.root.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { kind, ox: e.clientX, oy: e.clientY });
        this.showStick(kind, e.clientX, e.clientY, 0, 0);
        if (kind === 'aim') this.input.mouseDown = true;
        this.apply(e.pointerId, e.clientX, e.clientY);
        e.preventDefault();
    }

    onMove(e) {
        if (!this.pointers.has(e.pointerId)) return;
        this.apply(e.pointerId, e.clientX, e.clientY);
        e.preventDefault();
    }

    onUp(e) {
        const p = this.pointers.get(e.pointerId);
        if (!p) return;
        this.pointers.delete(e.pointerId);

        if (p.kind === 'move') {
            this.input.moveX = 0;
            this.input.moveY = 0;
            this.hideStick('move');
        } else {
            this.input.aimActive = false;
            this.input.mouseDown = false;
            this.hideStick('aim');
        }
        e.preventDefault();
    }

    /** Translate a pointer position into stick deflection. */
    apply(id, cx, cy) {
        const p = this.pointers.get(id);
        if (!p) return;

        let dx = cx - p.ox;
        let dy = cy - p.oy;
        const dist = Math.hypot(dx, dy);
        const range = TouchControls.STICK_RANGE;

        // Clamp the visual knob to the ring, and normalise past full range so
        // the thumb can wander without the direction drifting.
        const clamped = Math.min(dist, range);
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : 0;

        this.showStick(p.kind, p.ox, p.oy, nx * clamped, ny * clamped);

        const strength = clamped / range;
        if (p.kind === 'move') {
            if (strength < TouchControls.DEADZONE) {
                this.input.moveX = 0;
                this.input.moveY = 0;
            } else {
                // Rescale past the deadzone so the first responsive position
                // is a slow walk rather than a jump to near-full speed.
                const s = (strength - TouchControls.DEADZONE) / (1 - TouchControls.DEADZONE);
                this.input.moveX = nx * s;
                this.input.moveY = ny * s;
            }
        } else {
            // Aim holds its last direction when the thumb returns to centre,
            // so firing straight down at the origin doesn't snap the aim.
            if (strength >= TouchControls.DEADZONE) {
                this.input.aimX = nx;
                this.input.aimY = ny;
                this.input.aimActive = true;
            }
        }
    }

    showStick(kind, ox, oy, kx, ky) {
        const el = kind === 'move' ? this.moveEl : this.aimEl;
        if (!el) return;
        el.style.display = 'block';
        el.style.left = `${ox}px`;
        el.style.top = `${oy}px`;
        el.querySelector('.stick-knob').style.transform =
            `translate(-50%, -50%) translate(${kx}px, ${ky}px)`;
    }

    hideStick(kind) {
        const el = kind === 'move' ? this.moveEl : this.aimEl;
        if (el) el.style.display = 'none';
    }

    /** Drop all touch input — used when focus or the game state is lost. */
    releaseAll() {
        this.pointers.clear();
        this.input.moveX = 0;
        this.input.moveY = 0;
        this.input.aimActive = false;
        this.input.mouseDown = false;
        this.hideStick('move');
        this.hideStick('aim');
    }
}
