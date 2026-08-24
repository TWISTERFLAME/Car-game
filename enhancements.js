/*
 * Neon Highway - Platform & Performance Enhancements
 * Keeps the existing game systems intact while adding:
 * - adaptive rendering for PC/mobile/low-end devices
 * - modern Pointer Events for touch + mouse controls
 * - gamepad support
 * - tab/background pause protection
 * - mobile browser interaction protection
 * - lightweight FPS monitoring
 * - robust split-screen keyboard input
 * - protected multi-player road streaming
 * - grounded vehicle spawning/safety
 * - WebGL black-screen recovery
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

        game.platformInfo = {
            mobile,
            lowEnd,
            memory,
            cores,
            pixelRatio: Math.min(window.devicePixelRatio || 1, maxPixelRatio)
        };

        const controlIds = [
            'touch-p1-left', 'touch-p1-right', 'touch-p1-gas', 'touch-p1-brake', 'touch-p1-nitro', 'touch-p1-horn',
            'touch-p2-left', 'touch-p2-right', 'touch-p2-gas', 'touch-p2-brake', 'touch-p2-nitro', 'touch-p2-horn'
        ];

        controlIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.touchAction = 'none';

            const match = id.match(/touch-(p[12])-(.+)/);
            if (!match) return;
            const player = match[1];
            const key = match[2];
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

        document.addEventListener('contextmenu', event => {
            if (game.state === 'PLAYING') event.preventDefault();
        });
        document.addEventListener('touchmove', event => {
            if (game.state === 'PLAYING') event.preventDefault();
        }, { passive: false });

        // Gamepad support: controller 1 -> P1, controller 2 -> P2.
        let gamepadRAF = 0;
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
        const pollGamepads = () => {
            if (game.state === 'PLAYING' && navigator.getGamepads) {
                const pads = navigator.getGamepads();
                applyGamepad(game.players.p1, pads[0]);
                if (game.gameMode === 'SPLIT') applyGamepad(game.players.p2, pads[1]);
            }
            gamepadRAF = requestAnimationFrame(pollGamepads);
        };
        pollGamepads();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                game._wasPlayingBeforeHidden = game.state === 'PLAYING';
                if (game._wasPlayingBeforeHidden) {
                    game.clock.getDelta();
                    ['p1', 'p2'].forEach(id => {
                        const k = game.players[id].keys;
                        k.gas = false; k.brake = false; k.left = false; k.right = false;
                    });
                }
            } else {
                game.clock.getDelta();
            }
        });

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

        game.saveNewHighScore = function(finalScore) {
            let scores = [];
            const localScores = localStorage.getItem('neon_highscores');
            if (localScores) {
                try { scores = JSON.parse(localScores); } catch (e) {}
            }
            const mapNames = { highway: 'Highway', city: 'Neon City', mountain: 'Mountain', desert: 'Desert' };
            scores.push({ name: 'PILOT', score: finalScore, map: mapNames[game.currentMap] || 'Highway' });
            scores.sort((a, b) => b.score - a.score);
            localStorage.setItem('neon_highscores', JSON.stringify(scores.slice(0, 10)));
        };

        // ================================================================
        // FIX 1: TRUE SIMULTANEOUS SPLIT-SCREEN KEYBOARD INPUT
        // The old game listener intentionally cleared P1 when an arrow key
        // was pressed, which made WASD + arrows impossible at the same time.
        // This state layer runs after it and restores both players' actual keys.
        // ================================================================
        const physicalKeys = Object.create(null);
        const splitMap = {
            KeyW: ['p1', 'gas'], KeyS: ['p1', 'brake'], KeyA: ['p1', 'left'], KeyD: ['p1', 'right'],
            Space: ['p1', 'nitro'], KeyH: ['p1', 'horn'],
            ArrowUp: ['p2', 'gas'], ArrowDown: ['p2', 'brake'],
            ArrowLeft: ['p2', 'left'], ArrowRight: ['p2', 'right'],
            ShiftRight: ['p2', 'nitro'], Numpad0: ['p2', 'horn']
        };

        const syncSplitKeyboard = () => {
            if (game.gameMode !== 'SPLIT') return;
            const p1 = game.players.p1.keys;
            const p2 = game.players.p2.keys;
            // Preserve non-keyboard inputs only where appropriate; these are the
            // keyboard-controlled gameplay keys.
            ['gas', 'brake', 'left', 'right', 'nitro', 'horn'].forEach(key => {
                p1[key] = false;
                p2[key] = false;
            });
            Object.keys(splitMap).forEach(code => {
                if (physicalKeys[code]) {
                    const [player, key] = splitMap[code];
                    game.players[player].keys[key] = true;
                }
            });
        };

        window.addEventListener('keydown', e => {
            if (game.gameMode !== 'SPLIT') return;
            physicalKeys[e.code] = true;
            syncSplitKeyboard();
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
        }, { passive: false });
        window.addEventListener('keyup', e => {
            if (game.gameMode !== 'SPLIT') return;
            physicalKeys[e.code] = false;
            syncSplitKeyboard();
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
        }, { passive: false });

        // ================================================================
        // FIX 2: PROTECTED ROAD STREAMING FOR BOTH LOCAL PLAYERS
        // The original streamer only followed P1. If P2 stayed behind, road
        // chunks could be recycled out from underneath P2.
        // ================================================================
        const ROAD_LENGTH = game.roadLength || 120;
        const EXTRA_CHUNKS = 8;
        const ensureExtraRoadChunks = () => {
            if (!game.roadChunks.length) return;
            const template = game.roadChunks[0];
            const needed = 4 + EXTRA_CHUNKS;
            let furthest = Math.min(...game.roadChunks.map(c => c.position.z));
            while (game.roadChunks.length < needed) {
                furthest -= ROAD_LENGTH;
                const chunk = template.clone(true);
                chunk.position.z = furthest;
                game.scene.add(chunk);
                game.roadChunks.push(chunk);
                if (typeof game.spawnDecorationsOnChunk === 'function') {
                    game.spawnDecorationsOnChunk(chunk.position.z);
                }
            }
            game.maxSceneryZ = Math.min(...game.roadChunks.map(c => c.position.z));
        };
        ensureExtraRoadChunks();

        game.updateSceneryScrolling = function() {
            const p1z = game.players.p1.pos.z;
            const p2Active = game.gameMode === 'SPLIT' && game.players.p2.car;
            const p2z = p2Active ? game.players.p2.pos.z : p1z;
            const behindBothZ = Math.max(p1z, p2z);
            let furthestForwardZ = Math.min(...game.roadChunks.map(c => c.position.z));

            game.roadChunks.forEach(chunk => {
                // A chunk is recyclable only after it is safely behind BOTH cars.
                if (chunk.position.z > behindBothZ + 100) {
                    furthestForwardZ -= ROAD_LENGTH;
                    chunk.position.z = furthestForwardZ;
                    if (typeof game.spawnDecorationsOnChunk === 'function') {
                        game.spawnDecorationsOnChunk(chunk.position.z);
                    }
                }
            });

            // Remove decorations only after they are behind both players.
            for (let i = game.sceneryItems.length - 1; i >= 0; i--) {
                const item = game.sceneryItems[i];
                if (item.position.z > behindBothZ + 100) {
                    game.scene.remove(item);
                    game.sceneryItems.splice(i, 1);
                }
            }
        };

        // ================================================================
        // FIX 3: KEEP CARS ON THE ROAD
        // Cars in this game use kinematic positions, so a safe road height is
        // more reliable than allowing an accidental Y value to accumulate.
        // ================================================================
        const ROAD_CAR_Y = 0.15;
        const originalStartRace = game.startRace.bind(game);
        game.startRace = function() {
            originalStartRace();
            ['p1', 'p2'].forEach(id => {
                const p = game.players[id];
                if (p.car && (game.gameMode === 'SPLIT' || id === 'p1')) {
                    p.pos.y = ROAD_CAR_Y;
                    p.car.position.y = ROAD_CAR_Y;
                }
            });
        };

        const originalUpdatePhysics = game.updatePlayerPhysics.bind(game);
        game.updatePlayerPhysics = function(id, delta) {
            originalUpdatePhysics(id, delta);
            const p = game.players[id];
            if (!p.car || p.isCrashed) return;
            // Hard safety clamp against accidental floating/falling states.
            p.pos.y = ROAD_CAR_Y;
            p.car.position.y = ROAD_CAR_Y;
        };

        const originalSpawnTraffic = game.spawnTrafficCar.bind(game);
        game.spawnTrafficCar = function(type, x, z, speed, lane) {
            originalSpawnTraffic(type, x, z, speed, lane);
            const car = game.traffic[game.traffic.length - 1];
            if (car) car.position.y = ROAD_CAR_Y;
        };

        // Police car also gets the same road-height guarantee.
        const originalUpdateTraffic = game.updateTrafficPhysics.bind(game);
        game.updateTrafficPhysics = function(delta) {
            originalUpdateTraffic(delta);
            if (game.policeCar) game.policeCar.position.y = ROAD_CAR_Y;
        };

        // ================================================================
        // FIX 4: BLACK-SCREEN / DARK-WORLD RECOVERY
        // Keep a minimum amount of ambient light and recover renderer state
        // if the browser loses/restores the WebGL context.
        // ================================================================
        const stabilizeLighting = () => {
            if (!game.renderer || !game.lights) return;
            if (game.lights.ambient) game.lights.ambient.intensity = Math.max(game.lights.ambient.intensity || 0, 0.18);
            if (game.lights.sun) game.lights.sun.intensity = Math.max(game.lights.sun.intensity || 0, 0.25);
            if (game.scene && game.scene.fog) game.scene.fog.density = Math.min(game.scene.fog.density || 0, 0.018);
        };
        stabilizeLighting();

        game.renderer.domElement.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            game._webglLost = true;
            console.warn('[Neon Highway] WebGL context lost; waiting for browser recovery.');
        }, false);

        game.renderer.domElement.addEventListener('webglcontextrestored', () => {
            game._webglLost = false;
            stabilizeLighting();
            game.scene.traverse(object => {
                if (!object.material) return;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => { material.needsUpdate = true; });
            });
            game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
            console.info('[Neon Highway] WebGL context restored.');
        }, false);

        // Re-apply a safe lighting floor whenever the game changes environment.
        const originalSetMapTheme = game.setMapTheme.bind(game);
        game.setMapTheme = function(map) {
            originalSetMapTheme(map);
            stabilizeLighting();
        };
        const originalWeather = game.applyWeatherSettings.bind(game);
        game.applyWeatherSettings = function(weather) {
            originalWeather(weather);
            stabilizeLighting();
        };

        console.log('[Neon Highway] platform + stability fixes loaded', game.platformInfo);
    }

    if (document.readyState === 'complete') setup();
    else window.addEventListener('load', setup, { once: true });
})();
