/**
 * Main bootstrap — initializes canvas, game, UI, and wires up buttons.
 */
(function() {
    'use strict';

    // Get canvas elements
    const canvas = document.getElementById('game');
    const minimapCanvas = document.getElementById('minimap');

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

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
