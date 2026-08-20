/**
 * Audio — synthesized sound effects plus an optional music layer.
 *
 * Effects are generated with Web Audio rather than shipped as files: a bullet
 * hell fires constantly, so per-shot samples would mean either a large
 * download or audible repetition. Synthesis also keeps the project
 * dependency-free and lets pitch vary per shot, which is most of what stops
 * rapid fire turning into a machine-gun of identical clicks.
 *
 * Music is separate and file-based, loaded from audio/ if present. Missing
 * tracks are not an error — the game simply runs silent.
 */
class AudioSystem {
    /**
     * Hard cap on effect voices playing at once.
     *
     * Every enemy bullet and every hit wants a sound; unbounded, a busy room
     * sums dozens of oscillators into clipping mush. Beyond the cap new
     * effects are dropped rather than queued, since a late sound is worse
     * than a missing one.
     */
    static MAX_VOICES = 14;

    /**
     * A do-nothing instance. Lets Game hold an audio system unconditionally,
     * so no call site needs a null check and tests can run without Web Audio.
     */
    static silent() {
        const noop = () => {};
        return {
            unlock: noop, setMuted: noop, toggleMute: () => false, muted: false,
            shoot: noop, enemyShoot: noop, enemyHit: noop, enemyDeath: noop,
            playerHurt: noop, pickup: noop, levelUp: noop, descend: noop,
            gameOver: noop, setTracks: noop, playMusic: noop, nextTrack: noop,
            stopMusic: noop
        };
    }

    constructor() {
        this.ctx = null;
        this.master = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.voices = 0;

        this.musicEl = null;
        this.tracks = [];
        this.trackIndex = 0;

        this.muted = this.loadMuted();
        this.unlocked = false;
    }

    loadMuted() {
        try { return localStorage.getItem('bh-muted') === '1'; } catch (_) { return false; }
    }

    saveMuted() {
        try { localStorage.setItem('bh-muted', this.muted ? '1' : '0'); } catch (_) { /* private mode */ }
    }

    /**
     * Create the audio graph. Must run inside a user gesture: browsers start
     * the context suspended and only a gesture may resume it.
     */
    unlock() {
        if (this.unlocked) {
            // A context can be suspended again when a tab is backgrounded.
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return; // no Web Audio: run silent rather than throw

        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.5;
        this.sfxGain.connect(this.master);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.45;
        this.musicGain.connect(this.master);

        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.unlocked = true;
    }

    setMuted(muted) {
        this.muted = muted;
        this.saveMuted();
        if (this.master) this.master.gain.value = muted ? 0 : 1;
        if (this.musicEl) this.musicEl.muted = muted;
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /** Can a new effect start right now? */
    canPlay() {
        return this.unlocked && !this.muted && this.ctx &&
               this.voices < AudioSystem.MAX_VOICES;
    }

    /** Track a voice for its lifetime so MAX_VOICES means something. */
    hold(node, seconds) {
        this.voices++;
        node.onended = () => { this.voices--; };
        // onended does not fire if a node is never started or is GC'd early,
        // so release on a timer as well. Guarded so it cannot double-decrement.
        let released = false;
        const release = () => { if (!released) { released = true; this.voices--; } };
        node.onended = release;
        setTimeout(release, (seconds + 0.2) * 1000);
    }

    /**
     * One-shot tone with an exponential pitch sweep and a percussive envelope.
     * The building block for most of the effects below.
     */
    tone({ type = 'square', from, to, dur, gain = 0.3, delay = 0 }) {
        if (!this.canPlay()) return;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(from, t0);
        if (to !== undefined && to !== from) {
            // exponentialRamp cannot reach or pass through zero
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
        }

        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.3));
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
        this.hold(osc, dur + delay);
    }

    /** Filtered white noise — the grit behind impacts and explosions. */
    noise({ dur, gain = 0.3, from = 2200, to = 300, delay = 0, q = 1 }) {
        if (!this.canPlay()) return;
        const t0 = this.ctx.currentTime + delay;
        const frames = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, Math.max(1, frames), this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.Q.value = q;
        filt.frequency.setValueAtTime(from, t0);
        filt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(gain, t0);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        src.connect(filt); filt.connect(env); env.connect(this.sfxGain);
        src.start(t0);
        this.hold(src, dur + delay);
    }

    // ===== Effects =====

    /** Player shot. Pitch jitters per shot so sustained fire is not a drone. */
    shoot() {
        const j = 0.92 + Math.random() * 0.16;
        this.tone({ type: 'square', from: 720 * j, to: 210 * j, dur: 0.09, gain: 0.14 });
        this.noise({ dur: 0.05, gain: 0.06, from: 3200, to: 700 });
    }

    enemyShoot() {
        const j = 0.9 + Math.random() * 0.2;
        this.tone({ type: 'sawtooth', from: 300 * j, to: 130 * j, dur: 0.12, gain: 0.08 });
    }

    /** Bullet connecting with an enemy — short, dry, high. */
    enemyHit() {
        this.noise({ dur: 0.06, gain: 0.14, from: 4200, to: 1200 });
        this.tone({ type: 'square', from: 420, to: 260, dur: 0.05, gain: 0.07 });
    }

    /** Enemy death — a collapsing growl. */
    enemyDeath() {
        this.tone({ type: 'sawtooth', from: 260, to: 48, dur: 0.34, gain: 0.2 });
        this.noise({ dur: 0.3, gain: 0.2, from: 1800, to: 120 });
    }

    /** Player damaged — low, ugly, unmistakable. */
    playerHurt() {
        this.tone({ type: 'square', from: 190, to: 70, dur: 0.3, gain: 0.3 });
        this.noise({ dur: 0.24, gain: 0.22, from: 900, to: 90 });
    }

    /** XP pickup — a small bright blip, kept quiet since it fires constantly. */
    pickup() {
        this.tone({ type: 'square', from: 880, to: 1320, dur: 0.06, gain: 0.05 });
    }

    /** Level up — rising fanfare. */
    levelUp() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) =>
            this.tone({ type: 'square', from: f, to: f, dur: 0.14, gain: 0.16, delay: i * 0.085 }));
    }

    /** Descending to the next floor — a heavy door and a drop. */
    descend() {
        this.tone({ type: 'sawtooth', from: 150, to: 40, dur: 0.7, gain: 0.24 });
        this.noise({ dur: 0.6, gain: 0.18, from: 700, to: 60 });
    }

    /** Death — the long fall. */
    gameOver() {
        this.tone({ type: 'sawtooth', from: 320, to: 30, dur: 1.3, gain: 0.3 });
        this.noise({ dur: 1.1, gain: 0.2, from: 1200, to: 50 });
    }

    // ===== Music =====

    /**
     * Register music tracks. Each entry is a base path without extension;
     * the browser picks a format it supports.
     *
     * Nothing here fails loudly: if the files are absent the game runs
     * silent, so the repo stays playable without any audio assets committed.
     */
    setTracks(paths) {
        this.tracks = paths;
    }

    /** Start (or restart) music at a given track index, looping. */
    playMusic(index = 0) {
        if (!this.tracks.length) return;
        this.trackIndex = index % this.tracks.length;

        if (!this.musicEl) {
            this.musicEl = new Audio();
            this.musicEl.loop = true;
            this.musicEl.volume = 0.45;
            // Failure here is expected when no audio assets are present.
            this.musicEl.addEventListener('error', () => { /* run silent */ });
        }

        const base = this.tracks[this.trackIndex];
        const canOgg = this.musicEl.canPlayType('audio/ogg') !== '';
        this.musicEl.src = `${base}.${canOgg ? 'ogg' : 'mp3'}`;
        this.musicEl.muted = this.muted;
        const p = this.musicEl.play();
        if (p && p.catch) p.catch(() => { /* blocked until a gesture; fine */ });
    }

    /** Advance to the next track — called on each new floor. */
    nextTrack() {
        if (!this.tracks.length) return;
        this.playMusic(this.trackIndex + 1);
    }

    stopMusic() {
        if (this.musicEl) { this.musicEl.pause(); this.musicEl.currentTime = 0; }
    }
}
