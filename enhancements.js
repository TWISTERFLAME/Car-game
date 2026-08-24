/*
 * Neon Highway - Platform & Performance Enhancements
 * Keeps the existing game systems intact while adding:
 * - adaptive rendering for PC/mobile/low-end devices
 * - modern Pointer Events for touch + mouse controls
 * - gamepad support
 * - tab/background pause protection
 * - mobile browser interaction protection
 * - lightweight FPS monitoring
 */
(() => {
    'use strict';

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function setup() {
        if (!window.game || !game.renderer) return;

        const mobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && window.innerWidth < 1100);
        const memory = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 4;
        const lowEnd = mobile || memory <= 4 || cores <= 4;

        // Adaptive rendering: the game keeps its visual quality on stronger PCs,
        // while low-end phones/laptops avoid wasting GPU time on huge pixel counts.
        const maxPixelRatio = lowEnd ? 1.25 : 1.75;
        game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));

        if (lowEnd) {
            game.renderer.shadowMap.enabled = false;
            if (game.lights && game.lights.sun) game.lights.sun.castShadow = false;
        }

        // Expose platform information for future menus/settings.
        game.platformInfo = {
            mobile,
            lowEnd,
            memory,
            cores,
            pixelRatio: Math.min(window.devicePixelRatio || 1, maxPixelRatio)
        };

        // More reliable controls on modern phones/tablets.
        const controlIds = [
            'touch-p1-left', 'touch-p1-right', 'touch-p1-gas', 'touch-p1-brake', 'touch-p1-nitro', 'touch-p1-horn',
            'touch-p2-left', 'touch-p2-right', 'touch-p2-gas', 'touch-p2-brake', 'touch-p2-nitro', 'touch-p2-horn'
        ];

        controlIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.touchAction = 'none';

            const [player, key] = id.match(/touch-(p[12])-(.+)/).slice(1);
            const press = event => {
                event.preventDefault();
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                game.players[player].keys[key] = true;
                if (key === 'horn' && game.state === 'PLAYING') {
                    sfx.playHorn(player === 'p1' ? 440 : 520);
                }
                if (el.setPointerCapture && event.pointerId !== undefined) {
                    try { el.setPointerCapture(event.pointerId); } catch (_) {}
                }
            };
            const release = event => {
                event.preventDefault();
                game.players[player].keys[key] = false;
            };

            el.addEventListener('pointerdown', press, { passive: false });
            el.addEventListener('pointerup', release, { passive: false });
            el.addEventListener('pointercancel', release, { passive: false });
            el.addEventListener('pointerleave', event => {
                if (event.pointerType === 'mouse') release(event);
            }, { passive: false });
        });

        // Prevent long-press menus, selection and accidental page scrolling while driving.
        document.addEventListener('contextmenu', event => {
            if (game.state === 'PLAYING') event.preventDefault();
        });
        document.addEventListener('touchmove', event => {
            if (game.state === 'PLAYING') event.preventDefault();
        }, { passive: false });

        // Gamepad support: controller works on PC and Android browsers that expose it.
        let gamepadRAF = 0;
        const pollGamepads = () => {
            if (game.state === 'PLAYING' && navigator.getGamepads) {
                const pads = navigator.getGamepads();
                const p1Pad = pads[0];
                const p2Pad = game.gameMode === 'SPLIT' ? pads[1] : null;
                applyGamepad(game.players.p1, p1Pad);
                if (p2Pad) applyGamepad(game.players.p2, p2Pad);
            }
            gamepadRAF = requestAnimationFrame(pollGamepads);
        };

        const applyGamepad = (player, pad) => {
            if (!pad) return;
            const axis = Number.isFinite(pad.axes[0]) ? pad.axes[0] : 0;
            const deadzone = 0.16;
            const steer = Math.abs(axis) > deadzone ? axis : 0;
            player.keys.left = steer < -deadzone;
            player.keys.right = steer > deadzone;
            player.keys.gas = !!(pad.buttons[7] && pad.buttons[7].pressed);
            player.keys.brake = !!(pad.buttons[6] && pad.buttons[6].pressed);
            player.keys.nitro = !!(pad.buttons[0] && pad.buttons[0].pressed);
            player.keys.horn = !!(pad.buttons[1] && pad.buttons[1].pressed);
        };
        pollGamepads();

        // Background-tab protection: don't let a suspended browser tab cause a giant
        // physics step or an unfair crash when the player comes back.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                game._wasPlayingBeforeHidden = game.state === 'PLAYING';
                if (game._wasPlayingBeforeHidden) {
                    game.clock.getDelta();
                    game.players.p1.keys.gas = false;
                    game.players.p1.keys.brake = false;
                    game.players.p1.keys.left = false;
                    game.players.p1.keys.right = false;
                    game.players.p2.keys.gas = false;
                    game.players.p2.keys.brake = false;
                    game.players.p2.keys.left = false;
                    game.players.p2.keys.right = false;
                }
            } else {
                game.clock.getDelta();
            }
        });

        // Lightweight FPS monitor. It only stores data; UI can use it later.
        let frames = 0;
        let lastFPSUpdate = performance.now();
        game.performanceInfo = { fps: 60 };
        const fpsLoop = now => {
            frames++;
            if (now - lastFPSUpdate >= 1000) {
                game.performanceInfo.fps = Math.round((frames * 1000) / (now - lastFPSUpdate));
                frames = 0;
                lastFPSUpdate = now;
            }
            requestAnimationFrame(fpsLoop);
        };
        requestAnimationFrame(fpsLoop);

        // Recalculate renderer size and quality whenever the device rotates/resizes.
        const originalResize = game.onWindowResize.bind(game);
        game.onWindowResize = () => {
            originalResize();
            const ratio = game.platformInfo.lowEnd ? 1.25 : 1.75;
            game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
        };

        window.addEventListener('gamepadconnected', event => {
            if (game.state !== 'PLAYING') return;
            game.showToast(`CONTROLLER ${event.gamepad.index + 1} CONNECTED`);
        });

        // Disable the browser initials popup when a new local high score is made.
        // Scores are still saved to the leaderboard automatically as "PILOT".
        game.saveNewHighScore = function(finalScore) {
            let scores = [];
            const localScores = localStorage.getItem('neon_highscores');
            if (localScores) {
                try { scores = JSON.parse(localScores); } catch (e) {}
            }

            const mapNames = {
                highway: 'Highway',
                city: 'Neon City',
                mountain: 'Mountain',
                desert: 'Desert'
            };

            scores.push({
                name: 'PILOT',
                score: finalScore,
                map: mapNames[game.currentMap] || 'Highway'
            });

            scores.sort((a, b) => b.score - a.score);
            scores = scores.slice(0, 10);
            localStorage.setItem('neon_highscores', JSON.stringify(scores));
        };

        console.log('[Neon Highway] platform enhancements loaded', game.platformInfo);
    }

    if (document.readyState === 'complete') setup();
    else window.addEventListener('load', setup, { once: true });
})();
