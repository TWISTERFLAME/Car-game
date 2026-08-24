/* Realistic Traffic Racer direction layer
 * Keeps the existing game systems but removes the neon/cyberpunk presentation
 * and applies a grounded, natural road/traffic look.
 */
(() => {
    'use strict';

    const carColors = [0x1f2933, 0xbfc5ca, 0x8b1e1e, 0x1d4f7a, 0x2f5d3a, 0x8a6d3b, 0xf1f1ed];

    function setMaterialRealistic(material) {
        if (!material) return;
        material.emissive?.setHex(0x000000);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
        if ('metalness' in material) material.metalness = Math.min(material.metalness, 0.35);
        if ('roughness' in material) material.roughness = Math.max(material.roughness, 0.65);
    }

    function neutralizeObject(object) {
        if (!object) return;
        object.traverse(child => {
            if (!child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(setMaterialRealistic);
        });
    }

    function realisticWorld() {
        if (!window.game || !game.scene || !game.renderer) return false;

        // Natural default highway lighting.
        game.lights.ambient.intensity = Math.max(game.lights.ambient.intensity || 0, 0.55);
        game.lights.ambient.color.setHex(0xfff8e8);
        game.lights.sun.intensity = Math.max(game.lights.sun.intensity || 0, 1.0);
        game.lights.sun.color.setHex(0xfff4dc);
        game.lights.sun.position.set(25, 45, 15);

        // Clear, natural atmosphere instead of colored neon fog.
        const night = game.currentWeather === 'night';
        if (night) {
            game.scene.fog.color.setHex(0x1b2430);
            game.renderer.setClearColor(0x101820);
            game.scene.fog.density = 0.010;
            game.lights.ambient.intensity = 0.28;
            game.lights.sun.intensity = 0.12;
        } else if (game.currentMap === 'mountain') {
            game.scene.fog.color.setHex(0xc9d4dc);
            game.renderer.setClearColor(0xc9d4dc);
            game.scene.fog.density = 0.009;
        } else if (game.currentMap === 'desert') {
            game.scene.fog.color.setHex(0xd9c29a);
            game.renderer.setClearColor(0xd9c29a);
            game.scene.fog.density = 0.006;
        } else {
            game.scene.fog.color.setHex(0xb9d4e8);
            game.renderer.setClearColor(0xb9d4e8);
            game.scene.fog.density = 0.007;
        }

        // Remove emissive/glowing treatment from the entire world.
        game.scene.traverse(neutralizeObject);

        // Make the road look like asphalt rather than a glowing arcade surface.
        game.roadChunks?.forEach(chunk => {
            const road = chunk.children?.[0];
            if (road?.material) {
                road.material.color.setHex(0x34383d);
                setMaterialRealistic(road.material);
            }
            chunk.children?.forEach(child => {
                if (child.material?.color) {
                    const hex = child.material.color.getHex();
                    // Keep grass/snow/sand colors natural; only replace near-black city ground.
                    if (hex === 0x05020a) child.material.color.setHex(0x66635d);
                }
            });
        });

        // Neutralize traffic/car paint colors while keeping player customization.
        const traffic = game.traffic || [];
        traffic.forEach((car, index) => {
            neutralizeObject(car);
            car.traverse(child => {
                if (!child.material?.color) return;
                const current = child.material.color.getHex();
                // Don't recolor glass/tires; only obvious neon paint colors.
                if ([0xff0055, 0x00ffcc, 0xffe600, 0xa000ff].includes(current)) {
                    child.material.color.setHex(carColors[index % carColors.length]);
                }
            });
        });

        return true;
    }

    function cleanUI() {
        document.title = 'Traffic Drive 3D';
        const title = document.querySelector('.game-title');
        if (title) title.textContent = 'TRAFFIC DRIVE';
        const subtitle = document.querySelector('.game-subtitle');
        if (subtitle) subtitle.textContent = 'REALISTIC HIGHWAY RACER';

        const replacements = [
            ['NEON CITY (NIGHT)', 'CITY HIGHWAY'],
            ['NEON CRUISER', 'SPORTS COUPE'],
            ['NEON HIGHWAY', 'TRAFFIC DRIVE']
        ];
        document.querySelectorAll('*').forEach(el => {
            if (el.children.length) return;
            const text = el.textContent?.trim();
            const replacement = replacements.find(([from]) => text === from);
            if (replacement) el.textContent = replacement[1];
        });
    }

    function patch() {
        if (!window.game || !game.scene) return;
        cleanUI();
        realisticWorld();

        // Patch future map/weather changes so the style cannot fall back to neon.
        if (!game._realisticPatched) {
            const originalMap = game.setMapTheme.bind(game);
            game.setMapTheme = map => {
                originalMap(map);
                setTimeout(realisticWorld, 0);
            };
            const originalWeather = game.applyWeatherSettings.bind(game);
            game.applyWeatherSettings = weather => {
                originalWeather(weather);
                setTimeout(realisticWorld, 0);
            };
            game._realisticPatched = true;
        }
    }

    function boot() {
        if (!window.game || !game.scene) {
            requestAnimationFrame(boot);
            return;
        }
        patch();
    }

    window.addEventListener('load', boot, { once: true });
})();
