/**
 * Main bootstrap — initializes canvas, game, UI, and wires up buttons.
 */
(function() {
    'use strict';

    // Get canvas elements
    const canvas = document.getElementById('game');
    const minimapCanvas = document.getElementById('minimap');

    /**
     * Size the backing store to the window divided by PIXEL_SIZE, then let CSS
     * stretch it back to full size with smoothing off. Everything therefore
     * lands on a visible pixel grid, and the upscale is what gives the chunky
     * look rather than any per-sprite trickery.
     */
    function resizeCanvas() {
        canvas.width = Math.ceil(window.innerWidth / PIXEL_SIZE);
        canvas.height = Math.ceil(window.innerHeight / PIXEL_SIZE);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        // Resizing the backing store resets context state, so re-disable
        // smoothing every time.
        canvas.getContext('2d').imageSmoothingEnabled = false;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize systems
    const ui = new UI(canvas, minimapCanvas);
    const game = new Game(canvas, ui);

    function startGame() {
        game.start();
        game.startLoop();
        // Blur any focused element so keyboard events reach window listeners
        if (document.activeElement) document.activeElement.blur();
        // Also set focus to the canvas itself to ensure key events are captured
        canvas.focus();
    }

    // Wire up button handlers
    document.getElementById('start-btn').addEventListener('click', (e) => {
        e.preventDefault();
        startGame();
    });

    document.getElementById('restart-btn').addEventListener('click', (e) => {
        e.preventDefault();
        startGame();
    });

    document.getElementById('resume-btn').addEventListener('click', (e) => {
        e.preventDefault();
        game.state = 'PLAYING';
        ui.hidePause();
        if (document.activeElement) document.activeElement.blur();
    });

    document.getElementById('confirm-upgrade').addEventListener('click', (e) => {
        e.preventDefault();
        game.applyUpgrade();
    });

    // Show start screen
    ui.showStart();
})();
