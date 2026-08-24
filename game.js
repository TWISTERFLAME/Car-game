// Core 3D Game Engine - Neon Highway: Traffic Racer 3D
class Game {
    constructor() {
        this.state = 'MENU'; // MENU, PLAYING, GARAGE, SETTINGS, LEADERBOARDS, LOBBY, GAMEOVER
        this.gameMode = 'SINGLE'; // SINGLE, SPLIT, ONLINE
        
        // Render & Scene Setup
        this.container = null;
        this.renderer = null;
        this.scene = null;
        this.clock = new THREE.Clock();
        
        // Players data
        this.players = {
            p1: {
                car: null,
                modelType: 'sports',
                color: '#ff0055',
                pos: new THREE.Vector3(0, 0, 0),
                speed: 0,
                maxSpeed: 38, // Units per second (~140 km/h)
                accel: 0.12,
                handling: 0.12,
                brakes: 0.25,
                nitro: 1.0, // 0 to 1
                nitroActive: false,
                isCrashed: false,
                score: 0,
                dist: 0,
                overtakes: 0,
                lane: 2, // 0 to 3
                keys: { gas: false, brake: false, left: false, right: false, nitro: false, horn: false }
            },
            p2: {
                car: null,
                modelType: 'sports',
                color: '#00ffcc',
                pos: new THREE.Vector3(0, 0, 0),
                speed: 0,
                maxSpeed: 38,
                accel: 0.12,
                handling: 0.12,
                brakes: 0.25,
                nitro: 1.0,
                nitroActive: false,
                isCrashed: false,
                score: 0,
                dist: 0,
                overtakes: 0,
                lane: 3,
                keys: { gas: false, brake: false, left: false, right: false, nitro: false, horn: false }
            }
        };

        // Screen division cameras
        this.cameraP1 = null;
        this.cameraP2 = null;

        // Scenery & Roads
        this.roadChunks = [];
        this.roadLength = 120;
        this.sceneryItems = [];
        this.maxSceneryZ = 0;
        
        // Traffic
        this.traffic = [];
        this.trafficSpeed = 16;
        this.lastTrafficSpawnZ = 0;
        this.trafficSpawnInterval = 45; // Spawn a car every X units of forward progress
        
        // Police Chase System
        this.policeActive = false;
        this.policeCar = null;
        this.policeTimer = 0;
        this.bustedTimer = 0;

        // Environments
        this.currentMap = 'highway';
        this.currentWeather = 'clear';
        this.weatherParticles = null;
        this.skybox = null;
        this.lights = {};
        
        // Game Economy & Progress
        this.coins = 0;
        this.activeMission = {
            id: 1,
            desc: "Drive 1000m",
            target: 1000,
            type: 'distance',
            reward: 150,
            progress: 0
        };
        
        // Garage Inventory (Loaded from LocalStorage)
        this.inventory = {
            unlockedCars: ['sports'],
            selectedCar: 'sports',
            upgrades: {
                sports: { speed: 1, handling: 1, brakes: 1 },
                muscle: { speed: 1, handling: 1, brakes: 1 },
                police: { speed: 1, handling: 1, brakes: 1 },
                hypercar: { speed: 1, handling: 1, brakes: 1 }
            },
            colors: {
                sports: '#ff0055',
                muscle: '#ffe600',
                police: '#ffffff',
                hypercar: '#00ffcc'
            }
        };

        // Active car preview in garage
        this.previewCarIndex = 0;
        this.carList = [
            { id: 'sports', name: 'NEON CRUISER', price: 0, baseMaxSpeed: 38, baseHandling: 0.12, baseBrakes: 0.25 },
            { id: 'muscle', name: 'V8 INTERCEPTOR', price: 600, baseMaxSpeed: 44, baseHandling: 0.09, baseBrakes: 0.20 },
            { id: 'police', name: 'PATROL CRUISER', price: 1200, baseMaxSpeed: 42, baseHandling: 0.14, baseBrakes: 0.30 },
            { id: 'hypercar', name: 'APEX HYPERCAR', price: 2500, baseMaxSpeed: 52, baseHandling: 0.16, baseBrakes: 0.35 }
        ];

        // Seeded Pseudo-Random Number Generator for traffic consistency
        this.rngSeed = 12345;
    }

    // --- GAME INITIALIZATION ---
    init() {
        this.container = document.getElementById('canvas-container');
        this.loadSaveData();

        // 1. Create WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 2. Create Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x05010d, 0.015);

        // 3. Create Cameras
        this.cameraP1 = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
        this.cameraP2 = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

        // 4. Setup Lighting
        this.setupLighting();

        // 5. Initialize Sound (Requires User Action)
        sfx.init();

        // 6. Bind Inputs
        this.bindKeyboardInputs();
        this.bindTouchControls();
        this.bindMenuButtons();

        // 7. Generate Initial Environment
        this.setMapTheme('highway');
        this.buildRoadNetwork();

        // 8. Start Graphics Render Loop
        window.addEventListener('resize', () => this.onWindowResize());
        this.onWindowResize();
        this.animate();

        // Hide screen loader
        document.getElementById('screen-loader').style.opacity = 0;
        setTimeout(() => document.getElementById('screen-loader').style.display = 'none', 500);

        this.updateMenuHUD();
    }

    // --- PERSISTENT DATA SAVE/LOAD ---
    loadSaveData() {
        const savedCoins = localStorage.getItem('neon_coins');
        if (savedCoins !== null) this.coins = parseInt(savedCoins);

        const savedInventory = localStorage.getItem('neon_inventory');
        if (savedInventory !== null) {
            try {
                this.inventory = JSON.parse(savedInventory);
            } catch(e) {}
        }
        this.players.p1.modelType = this.inventory.selectedCar;
        this.players.p1.color = this.inventory.colors[this.inventory.selectedCar];
        this.applyUpgrades('p1');
    }

    saveGameData() {
        localStorage.setItem('neon_coins', this.coins);
        localStorage.setItem('neon_inventory', JSON.stringify(this.inventory));
    }

    applyUpgrades(playerID) {
        const p = this.players[playerID];
        const carData = this.carList.find(c => c.id === p.modelType);
        if (!carData) return;

        const upgrades = this.inventory.upgrades[p.modelType] || { speed: 1, handling: 1, brakes: 1 };
        
        // Speed upgrades add 6% per tier
        p.maxSpeed = carData.baseMaxSpeed * (1 + (upgrades.speed - 1) * 0.06);
        // Handling upgrades add 8% per tier
        p.handling = carData.baseHandling * (1 + (upgrades.handling - 1) * 0.08);
        // Brakes upgrades add 10% per tier
        p.brakes = carData.baseBrakes * (1 + (upgrades.brakes - 1) * 0.10);
    }

    // --- 3D ENVIRONMENT BUILDERS ---
    setupLighting() {
        // Ambient Light
        this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.lights.ambient);

        // Directional Sun Light
        this.lights.sun = new THREE.DirectionalLight(0xffffff, 0.8);
        this.lights.sun.position.set(20, 40, 20);
        this.lights.sun.castShadow = true;
        this.lights.sun.shadow.mapSize.width = 1024;
        this.lights.sun.shadow.mapSize.height = 1024;
        this.lights.sun.shadow.camera.near = 0.5;
        this.lights.sun.shadow.camera.far = 150;
        const d = 30;
        this.lights.sun.shadow.camera.left = -d;
        this.lights.sun.shadow.camera.right = d;
        this.lights.sun.shadow.camera.top = d;
        this.lights.sun.shadow.camera.bottom = -d;
        this.scene.add(this.lights.sun);
    }

    setMapTheme(map) {
        this.currentMap = map;
        const body = document.body;
        
        // Clear old overlays
        body.classList.remove('theme-city', 'theme-mountain', 'theme-desert');

        // Defaults
        let fogColor = 0x05010d;
        let ambientIntensity = 0.4;
        let sunIntensity = 0.8;
        let sunColor = 0xffffff;

        if (map === 'city') {
            body.classList.add('theme-city');
            fogColor = 0x07010e;
            ambientIntensity = 0.15;
            sunIntensity = 0.25; // Dark neon vibes
            sunColor = 0x5a189a;
        } else if (map === 'mountain') {
            body.classList.add('theme-mountain');
            fogColor = 0xb4c6d6;
            ambientIntensity = 0.7;
            sunIntensity = 0.4;
            sunColor = 0xffffff;
        } else if (map === 'desert') {
            body.classList.add('theme-desert');
            fogColor = 0x2b1301; // Sunset orange fog
            ambientIntensity = 0.3;
            sunIntensity = 0.9;
            sunColor = 0xf9a03f;
        }

        // Apply Fog & light properties
        this.scene.fog.color.setHex(fogColor);
        this.renderer.setClearColor(fogColor);
        this.lights.ambient.intensity = ambientIntensity;
        this.lights.sun.intensity = sunIntensity;
        this.lights.sun.color.setHex(sunColor);

        // Update road textures dynamically on theme change
        this.roadChunks.forEach(chunk => {
            const roadPlane = chunk.children[0];
            if (roadPlane && roadPlane.material) {
                roadPlane.material.map = Models.textures.createRoadCanvas(map);
                roadPlane.material.color.setHex(0x1b1d22);
                roadPlane.material.needsUpdate = true;
            }
        });

        this.applyWeatherSettings(this.currentWeather);
    }

    applyWeatherSettings(weather) {
        this.currentWeather = weather;

        // Clear existing weather particle systems
        if (this.weatherParticles) {
            this.scene.remove(this.weatherParticles);
            this.weatherParticles = null;
        }

        const map = this.currentMap;
        
        if (weather === 'rainy') {
            this.scene.fog.density = 0.015; // Lower fog so the road stays readable in rain
            this.weatherParticles = Models.createRainSystem(350, 45, 150);
            this.scene.add(this.weatherParticles);
        } else if (weather === 'snowy' || map === 'mountain') {
            // Mountain is snowy by default
            this.scene.fog.density = 0.018; // Keep winter haze visible but not opaque
            this.weatherParticles = Models.createSnowSystem(250, 45, 150);
            this.scene.add(this.weatherParticles);
            this.currentWeather = 'snowy'; // Lock weather representation
        } else if (weather === 'night' || map === 'city') {
            this.scene.fog.density = 0.012;
            this.scene.fog.color.setHex(0x020005);
            this.renderer.setClearColor(0x020005);
            this.lights.ambient.intensity = 0.06;
            this.lights.sun.intensity = 0.08;
            this.currentWeather = 'night';
        } else {
            // Clear settings
            this.scene.fog.density = (map === 'desert') ? 0.01 : 0.013;
        }
    }

    buildRoadNetwork() {
        // Build 4 endless scrolling road chunks
        for (let i = 0; i < 4; i++) {
            const chunk = new THREE.Group();
            chunk.position.z = -i * this.roadLength;

            // Highway road block - use a real box to avoid z-fighting with the grass plane.
            const roadGeom = new THREE.BoxGeometry(16, 0.4, this.roadLength);
            const roadMat = new THREE.MeshStandardMaterial({
                color: 0x2d3138,
                emissive: 0x101722,
                emissiveIntensity: 0.5,
                map: Models.textures.createRoadCanvas(this.currentMap),
                roughness: 0.8,
                metalness: 0.12
            });
            const road = new THREE.Mesh(roadGeom, roadMat);
            road.position.y = -0.1;
            road.receiveShadow = true;
            chunk.add(road);

            // Left Grass Shoulder
            const grassGeom = new THREE.BoxGeometry(60, 0.3, this.roadLength);
            let grassCol = 0x0a3c0c; // green
            if (this.currentMap === 'desert') grassCol = 0xb87333; // copper sand
            if (this.currentMap === 'mountain') grassCol = 0xeef5ff; // snow
            if (this.currentMap === 'city') grassCol = 0x05020a; // dark urban
            
            const grassMat = new THREE.MeshPhongMaterial({ color: grassCol, roughness: 1.0 });
            
            const grassL = new THREE.Mesh(grassGeom, grassMat);
            grassL.position.set(-38, -0.28, 0);
            grassL.receiveShadow = true;
            chunk.add(grassL);

            const grassR = grassL.clone();
            grassR.position.x = 38;
            chunk.add(grassR);

            this.scene.add(chunk);
            this.roadChunks.push(chunk);

            // Populate side elements (trees/billboards) along the newly built chunk
            this.spawnDecorationsOnChunk(chunk.position.z);
        }
        this.maxSceneryZ = -4 * this.roadLength;
    }

    spawnDecorationsOnChunk(centerZ) {
        const count = 6;
        const spacing = this.roadLength / count;
        
        for (let i = 0; i < count; i++) {
            const z = centerZ + (i * spacing) - (this.roadLength / 2);
            
            // Left side & Right side scenery
            for (let side = -1; side <= 1; side += 2) {
                if (side === 0) continue;
                
                let model = null;
                const offset = 10 + Math.random() * 20; // Distance off-road
                const x = side * offset;

                if (this.currentMap === 'highway') {
                    model = (Math.random() > 0.8) ? Models.createStreetlight() : Models.createPineTree();
                } else if (this.currentMap === 'mountain') {
                    model = (Math.random() > 0.4) ? Models.createPineTree() : Models.createRock();
                    // Add white snowy overlay to tree foliage
                    if (model.children.length > 1) {
                        model.children.forEach((c, idx) => {
                            if (idx > 0) c.material = new THREE.MeshPhongMaterial({ color: 0xffffff });
                        });
                    }
                } else if (this.currentMap === 'desert') {
                    model = (Math.random() > 0.5) ? Models.createCactus() : Models.createRock();
                } else if (this.currentMap === 'city') {
                    // Create massive glowing skyscrapers
                    const height = 25 + Math.random() * 45;
                    const width = 8 + Math.random() * 6;
                    const colors = ['#ffe600', '#00ffcc', '#ff0077', '#a000ff'];
                    model = Models.createBuilding(height, width, colors[Math.floor(Math.random() * colors.length)]);
                }

                if (model) {
                    model.position.set(x, 0, z);
                    
                    // Rotate objects randomly for variety
                    if (this.currentMap !== 'city') {
                        model.rotation.y = Math.random() * Math.PI * 2;
                    } else {
                        // Keep buildings facing parallel to highway
                        model.rotation.y = 0;
                    }
                    this.scene.add(model);
                    this.sceneryItems.push(model);
                }
            }
        }
    }

    // --- GAME ENGINE CONTROLS ---
    bindKeyboardInputs() {
        const handleKeys = (e, isDown) => {
            const code = e.code;
            
            // Player 1 controls
            if (code === 'KeyW' || code === 'ArrowUp') this.players.p1.keys.gas = isDown;
            if (code === 'KeyS' || code === 'ArrowDown') this.players.p1.keys.brake = isDown;
            if (code === 'KeyA' || code === 'ArrowLeft') this.players.p1.keys.left = isDown;
            if (code === 'KeyD' || code === 'ArrowRight') this.players.p1.keys.right = isDown;
            if (code === 'Space') this.players.p1.keys.nitro = isDown;
            if (code === 'KeyH') {
                this.players.p1.keys.horn = isDown;
                if (isDown && this.state === 'PLAYING') sfx.playHorn(440);
            }

            // Player 2 controls (Mapped separate when local split screen active)
            if (this.gameMode === 'SPLIT') {
                // Remap arrow keys back to P2 and WASD to P1
                if (code === 'KeyW') { this.players.p1.keys.gas = isDown; this.players.p2.keys.gas = false; }
                if (code === 'KeyS') { this.players.p1.keys.brake = isDown; this.players.p2.keys.brake = false; }
                if (code === 'KeyA') { this.players.p1.keys.left = isDown; this.players.p2.keys.left = false; }
                if (code === 'KeyD') { this.players.p1.keys.right = isDown; this.players.p2.keys.right = false; }

                if (code === 'ArrowUp') { this.players.p2.keys.gas = isDown; this.players.p1.keys.gas = false; }
                if (code === 'ArrowDown') { this.players.p2.keys.brake = isDown; this.players.p1.keys.brake = false; }
                if (code === 'ArrowLeft') { this.players.p2.keys.left = isDown; this.players.p1.keys.left = false; }
                if (code === 'ArrowRight') { this.players.p2.keys.right = isDown; this.players.p1.keys.right = false; }
                
                if (code === 'ShiftRight') this.players.p2.keys.nitro = isDown;
                if (code === 'Numpad0') {
                    this.players.p2.keys.horn = isDown;
                    if (isDown && this.state === 'PLAYING') sfx.playHorn(520);
                }
            }
        };

        window.addEventListener('keydown', (e) => handleKeys(e, true));
        window.addEventListener('keyup', (e) => handleKeys(e, false));
    }

    bindTouchControls() {
        const bindBtn = (elementId, playerID, key) => {
            const el = document.getElementById(elementId);
            if (!el) return;

            const press = (e) => {
                e.preventDefault();
                this.players[playerID].keys[key] = true;
                if (key === 'horn' && this.state === 'PLAYING') sfx.playHorn(playerID === 'p1' ? 440 : 520);
            };
            const release = (e) => {
                e.preventDefault();
                this.players[playerID].keys[key] = false;
            };

            el.addEventListener('touchstart', press, {passive: false});
            el.addEventListener('touchend', release, {passive: false});
            el.addEventListener('mousedown', press);
            el.addEventListener('mouseup', release);
        };

        // P1 Controls
        bindBtn('touch-p1-left', 'p1', 'left');
        bindBtn('touch-p1-right', 'p1', 'right');
        bindBtn('touch-p1-gas', 'p1', 'gas');
        bindBtn('touch-p1-brake', 'p1', 'brake');
        bindBtn('touch-p1-nitro', 'p1', 'nitro');
        bindBtn('touch-p1-horn', 'p1', 'horn');

        // P2 Controls
        bindBtn('touch-p2-left', 'p2', 'left');
        bindBtn('touch-p2-right', 'p2', 'right');
        bindBtn('touch-p2-gas', 'p2', 'gas');
        bindBtn('touch-p2-brake', 'p2', 'brake');
        bindBtn('touch-p2-nitro', 'p2', 'nitro');
        bindBtn('touch-p2-horn', 'p2', 'horn');
    }

    // --- SCREEN MENU NAVIGATION ---
    bindMenuButtons() {
        const showPanel = (id) => {
            document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(id).classList.add('active');
        };

        // Mode Selectors
        document.getElementById('btn-single').onclick = () => {
            this.gameMode = 'SINGLE';
            showPanel('env-menu');
        };
        document.getElementById('btn-split').onclick = () => {
            this.gameMode = 'SPLIT';
            showPanel('env-menu');
        };
        document.getElementById('btn-online').onclick = () => {
            this.gameMode = 'ONLINE';
            showPanel('online-menu');
            network.init(
                (status) => { document.getElementById('net-status').innerText = status; },
                (msg) => { this.handleNetworkMessage(msg); }
            );
        };

        // Settings Menu
        document.getElementById('btn-settings').onclick = () => {
            showPanel('settings-menu');
            document.getElementById('setting-sfx').checked = !sfx.muted;
            document.getElementById('setting-music').checked = !sfx.musicMuted;
        };
        document.getElementById('btn-settings-back').onclick = () => showPanel('main-menu');
        
        document.getElementById('setting-sfx').onchange = (e) => sfx.setMuted(!e.target.checked);
        document.getElementById('setting-music').onchange = (e) => sfx.setMusicMuted(!e.target.checked);
        document.getElementById('setting-shadows').onchange = (e) => {
            this.renderer.shadowMap.enabled = e.target.checked;
            this.lights.sun.castShadow = e.target.checked;
        };

        // Environment Selector
        document.querySelectorAll('.env-card').forEach(card => {
            card.onclick = () => {
                document.querySelectorAll('.env-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.setMapTheme(card.dataset.map);
            };
        });

        document.querySelectorAll('.weather-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyWeatherSettings(btn.dataset.weather);
            };
        });

        document.getElementById('btn-env-back').onclick = () => showPanel('main-menu');
        document.getElementById('btn-env-start').onclick = () => {
            if (this.gameMode === 'ONLINE') {
                // Should use lobby start instead
            } else {
                this.startRace();
            }
        };

        // Garage Menu
        document.getElementById('btn-garage').onclick = () => {
            showPanel('garage-menu');
            this.state = 'GARAGE';
            this.previewCarIndex = this.carList.findIndex(c => c.id === this.inventory.selectedCar);
            this.updateGaragePreview();
        };
        document.getElementById('btn-garage-back').onclick = () => {
            showPanel('main-menu');
            this.state = 'MENU';
            this.resetSceneToMenuState();
        };

        document.getElementById('car-prev').onclick = () => {
            this.previewCarIndex = (this.previewCarIndex - 1 + this.carList.length) % this.carList.length;
            this.updateGaragePreview();
        };
        document.getElementById('car-next').onclick = () => {
            this.previewCarIndex = (this.previewCarIndex + 1) % this.carList.length;
            this.updateGaragePreview();
        };

        // Upgrade triggers
        const buyUpgrade = (stat) => {
            const carId = this.carList[this.previewCarIndex].id;
            const currentLvl = this.inventory.upgrades[carId][stat];
            if (currentLvl >= 5) return; // Max level 5
            
            const cost = stat === 'brakes' ? currentLvl * 150 : currentLvl * 200;
            if (this.coins >= cost) {
                this.coins -= cost;
                this.inventory.upgrades[carId][stat]++;
                this.saveGameData();
                this.updateGaragePreview();
                sfx.playCoinCollect();
            }
        };
        document.getElementById('btn-upgrade-speed').onclick = () => buyUpgrade('speed');
        document.getElementById('btn-upgrade-handling').onclick = () => buyUpgrade('handling');
        document.getElementById('btn-upgrade-brakes').onclick = () => buyUpgrade('brakes');

        document.getElementById('btn-unlock-car').onclick = () => {
            const car = this.carList[this.previewCarIndex];
            if (this.coins >= car.price && !this.inventory.unlockedCars.includes(car.id)) {
                this.coins -= car.price;
                this.inventory.unlockedCars.push(car.id);
                this.inventory.selectedCar = car.id;
                this.saveGameData();
                this.updateGaragePreview();
                sfx.playCoinCollect();
            }
        };

        document.getElementById('btn-select-car').onclick = () => {
            const car = this.carList[this.previewCarIndex];
            if (this.inventory.unlockedCars.includes(car.id)) {
                this.inventory.selectedCar = car.id;
                this.players.p1.modelType = car.id;
                this.players.p1.color = this.inventory.colors[car.id];
                this.applyUpgrades('p1');
                this.saveGameData();
                this.showToast(`${car.name} SELECTED!`);
            }
        };

        // Color selector triggers
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.onclick = () => {
                const color = btn.dataset.color;
                const carId = this.carList[this.previewCarIndex].id;
                this.inventory.colors[carId] = color;
                this.saveGameData();
                this.updateGaragePreviewColor(color);
            };
        });
        document.getElementById('paint-color-custom').oninput = (e) => {
            const color = e.target.value;
            const carId = this.carList[this.previewCarIndex].id;
            this.inventory.colors[carId] = color;
            this.saveGameData();
            this.updateGaragePreviewColor(color);
        };

        // Leaderboard back
        document.getElementById('btn-leaderboard').onclick = () => {
            showPanel('leaderboard-menu');
            this.renderLeaderboard();
        };
        document.getElementById('btn-leaderboard-back').onclick = () => showPanel('main-menu');
        
        document.getElementById('tab-local').onclick = (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            this.renderLeaderboard(false);
        };
        document.getElementById('tab-online').onclick = (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            this.renderLeaderboard(true);
        };

        // Game Over Buttons
        document.getElementById('btn-restart').onclick = () => this.startRace();
        document.getElementById('btn-go-garage').onclick = () => {
            showPanel('garage-menu');
            this.state = 'GARAGE';
            this.previewCarIndex = this.carList.findIndex(c => c.id === this.inventory.selectedCar);
            this.updateGaragePreview();
        };
        document.getElementById('btn-go-menu').onclick = () => {
            showPanel('main-menu');
            this.state = 'MENU';
            this.resetSceneToMenuState();
        };

        // Online Multi-player Menu back
        document.getElementById('btn-online-back').onclick = () => {
            network.disconnect();
            showPanel('main-menu');
        };

        // Online Lobby Buttons
        document.getElementById('btn-create-room').onclick = () => {
            network.createRoom(this.currentMap, this.currentWeather);
        };
        document.getElementById('btn-join-room').onclick = () => {
            const input = document.getElementById('room-code-input').value;
            if (input.length === 4) {
                network.joinRoom(input);
            } else {
                this.showToast("Enter a 4-letter code.");
            }
        };
        document.getElementById('btn-quick-match').onclick = () => {
            network.quickMatch();
        };
        
        document.getElementById('btn-lobby-leave').onclick = () => {
            network.disconnect();
            showPanel('online-menu');
        };
        document.getElementById('btn-lobby-start').onclick = () => {
            if (network.isHost && network.conn) {
                network.lobbyState.gameStarted = true;
                network.sendData({ type: 'START_GAME' });
                this.startRace();
            }
        };
        document.getElementById('btn-lobby-change-settings').onclick = () => {
            showPanel('env-menu');
            // Modify start button during online mode configuration
            const startBtn = document.getElementById('btn-env-start');
            startBtn.innerText = "CONFIRM LOBBY SETTINGS";
            startBtn.onclick = () => {
                network.lobbyState.map = this.currentMap;
                network.lobbyState.weather = this.currentWeather;
                network.sendData({
                    type: 'UPDATE_SETTINGS',
                    map: this.currentMap,
                    weather: this.currentWeather
                });
                showPanel('online-lobby');
                this.syncLobbyUI();
                
                // Restore button default behavior
                startBtn.innerText = "START RACE";
                startBtn.onclick = () => this.startRace();
            };
        };
    }

    // --- GARAGE WORKSHOP MECHANICS ---
    updateGaragePreview() {
        const car = this.carList[this.previewCarIndex];
        const isUnlocked = this.inventory.unlockedCars.includes(car.id);
        
        document.getElementById('car-name').innerText = car.name;
        document.getElementById('garage-coins').innerText = this.coins;
        document.getElementById('menu-coins').innerText = this.coins;

        // Display price/unlocked badge
        if (isUnlocked) {
            document.getElementById('car-price').innerText = "OWNED";
            document.getElementById('btn-unlock-car').style.display = 'none';
            document.getElementById('btn-select-car').style.display = 'block';
        } else {
            document.getElementById('car-price').innerText = `🪙 ${car.price}`;
            document.getElementById('btn-unlock-car').style.display = 'block';
            document.getElementById('btn-unlock-car').innerText = `BUY VEHICLE: 🪙 ${car.price}`;
            document.getElementById('btn-select-car').style.display = 'none';
        }

        // Load Upgrades
        const upgrades = this.inventory.upgrades[car.id];
        const showUpgradeBtn = (statId, lvl, cost) => {
            const btn = document.getElementById(`btn-upgrade-${statId}`);
            const fill = document.getElementById(`stat-${statId}`);
            
            fill.style.width = `${lvl * 20}%`;
            
            if (lvl >= 5) {
                btn.innerHTML = "MAX LEVEL";
                btn.disabled = true;
            } else {
                btn.innerHTML = `UPGRADE (+10%) <span class="upgrade-cost">🪙 ${cost}</span>`;
                btn.disabled = this.coins < cost;
            }
        };

        showUpgradeBtn('speed', upgrades.speed, upgrades.speed * 200);
        showUpgradeBtn('handling', upgrades.handling, upgrades.handling * 200);
        showUpgradeBtn('brakes', upgrades.brakes, upgrades.brakes * 150);

        // Spawn/Display Selected 3D Car inside garage view
        this.resetSceneToMenuState();
        
        const previewColor = this.inventory.colors[car.id];
        const previewMesh = Models.createCar(car.id, previewColor);
        previewMesh.position.set(0, 0.4, -6);
        previewMesh.rotation.set(0.2, -Math.PI / 4, 0); // Cool diagonal preview angle
        previewMesh.name = "garage_preview";
        this.scene.add(previewMesh);
    }

    updateGaragePreviewColor(colorHex) {
        const preview = this.scene.getObjectByName("garage_preview");
        if (preview && preview.children[0]) {
            preview.children[0].material.color.set(colorHex);
        }
    }

    resetSceneToMenuState() {
        // Clear player cars, traffic, and garage previews from active rendering list
        if (this.players.p1.car) this.scene.remove(this.players.p1.car);
        if (this.players.p2.car) this.scene.remove(this.players.p2.car);
        
        this.traffic.forEach(t => this.scene.remove(t));
        this.traffic = [];

        if (this.policeCar) {
            this.scene.remove(this.policeCar);
            this.policeCar = null;
        }

        const oldPreview = this.scene.getObjectByName("garage_preview");
        if (oldPreview) this.scene.remove(oldPreview);

        // Standard camera positions in menus
        this.cameraP1.position.set(0, 6, -15);
        this.cameraP1.lookAt(0, 0, -6);
    }

    // --- LEADERBOARD INTERFACE ---
    renderLeaderboard(isOnline = false) {
        const tbody = document.getElementById('leaderboard-tbody');
        tbody.innerHTML = '';
        
        let scores = [];
        if (!isOnline) {
            const localScores = localStorage.getItem('neon_highscores');
            if (localScores) {
                try { scores = JSON.parse(localScores); } catch(e) {}
            } else {
                // Seed baseline local scores
                scores = [
                    { name: 'APEX_DRF', score: 25000, map: 'Highway' },
                    { name: 'ROAD_BSS', score: 18500, map: 'Neon City' },
                    { name: 'SL1D_KNG', score: 12000, map: 'Mountain' }
                ];
                localStorage.setItem('neon_highscores', JSON.stringify(scores));
            }
        } else {
            // Simulated online top list
            scores = [
                { name: 'CYBER_RACER', score: 98400, map: 'Neon City' },
                { name: 'TOKYO_GT', score: 85200, map: 'Highway' },
                { name: 'SPEED_DEVIL', score: 71000, map: 'Desert' },
                { name: 'FROST_DRIFT', score: 55000, map: 'Mountain' },
                { name: 'NO_BRAKES', score: 48900, map: 'Desert' }
            ];
        }

        scores.sort((a,b) => b.score - a.score).forEach((entry, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx+1}</td>
                <td>${entry.name}</td>
                <td>${entry.score.toLocaleString()}</td>
                <td>${entry.map.toUpperCase()}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    saveNewHighScore(finalScore) {
        let scores = [];
        const localScores = localStorage.getItem('neon_highscores');
        if (localScores) {
            try { scores = JSON.parse(localScores); } catch(e) {}
        }
        
        const mapNames = { highway: 'Highway', city: 'Neon City', mountain: 'Mountain', desert: 'Desert' };
        scores.push({
            name: prompt("NEW HIGH SCORE! Enter your initials:", "PILOT") || "PILOT",
            score: finalScore,
            map: mapNames[this.currentMap] || 'Highway'
        });
        
        // Keep top 10
        scores.sort((a,b) => b.score - a.score);
        scores = scores.slice(0, 10);
        localStorage.setItem('neon_highscores', JSON.stringify(scores));
    }

    // --- MULTIPLAYER P2P SYNC HANDLER ---
    handleNetworkMessage(data) {
        const showPanel = (id) => {
            document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(id).classList.add('active');
        };

        switch (data.type) {
            case 'ROOM_CREATED':
                showPanel('online-lobby');
                this.syncLobbyUI();
                break;

            case 'CONNECTED':
                showPanel('online-lobby');
                this.syncLobbyUI();
                sfx.playCoinCollect();
                break;

            case 'DISCONNECTED':
                if (this.state === 'PLAYING') {
                    this.endRace(true);
                } else {
                    showPanel('online-menu');
                }
                this.showToast("Opponent left game.");
                break;

            case 'LOBBY_STATE':
                this.syncLobbyUI();
                break;

            case 'START_GAME':
                this.startRace();
                break;

            case 'GAME_SYNC':
                // Sync Opponent position during race
                const opponent = this.players.p2;
                opponent.pos.set(data.x, data.y, data.z);
                opponent.speed = data.speed;
                opponent.nitroActive = data.nitroActive;
                
                // Update opponent car positioning
                if (opponent.car) {
                    opponent.car.position.copy(opponent.pos);
                    opponent.car.rotation.y = data.ry;
                    opponent.car.rotation.z = data.rz;
                }
                break;

            case 'HORN_TRIGGER':
                sfx.playHorn(520, 0.4);
                break;

            case 'PLAYER_CRASH':
                this.players.p2.isCrashed = true;
                if (this.players.p2.car) {
                    this.triggerCrashExplosionMesh(this.players.p2.car);
                }
                break;

            case 'TRAFFIC_SPAWN':
                if (!network.isHost) {
                    this.spawnTrafficCar(data.vType, data.x, data.z, data.speed, data.lane);
                }
                break;
        }
    }

    syncLobbyUI() {
        const lobby = network.lobbyState;
        
        document.getElementById('lobby-room-code').innerText = network.roomCode || '----';
        document.getElementById('lobby-selected-map').innerText = `Map: ${lobby.map.toUpperCase()}`;
        document.getElementById('lobby-selected-weather').innerText = `Weather: ${lobby.weather.toUpperCase()}`;

        // Host details
        document.getElementById('lobby-player-host').innerText = `Host (${lobby.p1Car.toUpperCase()})`;
        
        // Guest details
        if (network.conn) {
            document.getElementById('lobby-player-guest').innerText = `Guest (${lobby.p2Car.toUpperCase()})`;
            document.getElementById('lobby-guest-badge').innerText = lobby.p2Ready ? "READY" : "WAITING...";
            document.getElementById('lobby-guest-badge').className = lobby.p2Ready ? "player-status-badge ready" : "player-status-badge waiting";
            
            // Enable start button if guest ready
            if (network.isHost) {
                document.getElementById('btn-lobby-start').disabled = !lobby.p2Ready;
            }
        } else {
            document.getElementById('lobby-player-guest').innerText = "Waiting for Player 2...";
            document.getElementById('lobby-guest-badge').innerText = "WAITING";
            document.getElementById('lobby-guest-badge').className = "player-status-badge waiting";
            document.getElementById('btn-lobby-start').disabled = true;
        }

        // Apply environment changes local to guest
        if (!network.isHost) {
            this.setMapTheme(lobby.map);
            this.applyWeatherSettings(lobby.weather);
        }
    }

    // Toggle player ready status in lobby
    toggleLobbyReady() {
        if (this.gameMode === 'ONLINE') {
            if (network.isHost) {
                // Host is always ready, starts the game directly
            } else {
                network.lobbyState.p2Ready = !network.lobbyState.p2Ready;
                network.sendData({
                    type: 'TOGGLE_READY',
                    ready: network.lobbyState.p2Ready
                });
                this.syncLobbyUI();
            }
        }
    }

    // --- GAMEPLAY RACE INITIATOR ---
    startRace() {
        this.state = 'PLAYING';
        this.clock.getDelta(); // Clear timer buffer

        // Hide menus & show HUD overlays
        document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
        
        if (this.gameMode === 'SINGLE') {
            document.getElementById('hud-single').classList.add('active');
            document.getElementById('hud-split').classList.remove('active');
            document.getElementById('touch-controls-p1').className = "touch-overlay active";
            document.getElementById('touch-controls-p2').classList.remove('active');
        } else {
            document.getElementById('hud-single').classList.remove('active');
            document.getElementById('hud-split').classList.add('active');
            document.getElementById('touch-controls-p1').className = "touch-overlay active split-mode";
            document.getElementById('touch-controls-p2').className = "touch-overlay active";
        }

        // Sync local settings to client and audio engine
        sfx.stopMusic();
        sfx.startMusic();

        this.resetSceneToMenuState();

        // 1. Setup Player 1
        const p1 = this.players.p1;
        p1.modelType = this.inventory.selectedCar;
        p1.color = this.inventory.colors[p1.modelType];
        p1.car = Models.createCar(p1.modelType, p1.color);
        p1.pos.set(-1.8, 0, 0); // Lane 2 position
        p1.car.position.copy(p1.pos);
        p1.speed = 0;
        p1.nitro = 1.0;
        p1.isCrashed = false;
        p1.score = 0;
        p1.dist = 0;
        p1.overtakes = 0;
        this.scene.add(p1.car);
        sfx.startEngine('p1');
        this.applyUpgrades('p1');

        // 2. Setup Player 2 (Local Split or Online Opponent)
        if (this.gameMode !== 'SINGLE') {
            const p2 = this.players.p2;
            
            if (this.gameMode === 'ONLINE') {
                p2.modelType = network.isHost ? network.lobbyState.p2Car : network.lobbyState.p1Car;
                p2.color = network.isHost ? network.lobbyState.p2Color : network.lobbyState.p1Color;
                this.rngSeed = network.lobbyState.seed; // sync traffic seeds
            } else {
                p2.modelType = 'sports'; // split-screen default sports car
                p2.color = '#00ffcc';
                this.rngSeed = Math.floor(Math.random() * 99999);
            }

            p2.car = Models.createCar(p2.modelType, p2.color);
            p2.pos.set(1.8, 0, 0); // Lane 3 position
            p2.car.position.copy(p2.pos);
            p2.speed = 0;
            p2.nitro = 1.0;
            p2.isCrashed = false;
            p2.score = 0;
            p2.dist = 0;
            p2.overtakes = 0;
            this.scene.add(p2.car);
            
            // Only start local engine. Guest coordinates synced over peerjs
            if (this.gameMode === 'SPLIT') {
                sfx.startEngine('p2');
            }
        }

        // Initialize spawner variables
        this.lastTrafficSpawnZ = 0;
        this.policeActive = false;
        this.bustedTimer = 0;
        this.policeTimer = 0;
    }

    // --- GAME OVER SUMMARY ---
    endRace(opponentDisconnected = false) {
        this.state = 'GAMEOVER';
        sfx.stopEngine('p1');
        sfx.stopEngine('p2');
        sfx.playDriftScreech(false);
        sfx.stopMusic();

        // Calculate coins earned: 1 coin per 100 points
        const finalScore = this.players.p1.score;
        let coinsEarned = Math.floor(finalScore / 100);
        
        // Check active mission reward
        const missionBox = document.getElementById('go-mission-box');
        let bonusReward = 0;
        let missionCompleted = false;

        if (this.gameMode === 'SINGLE' && !opponentDisconnected) {
            missionCompleted = this.checkMissionCompletion();
            if (missionCompleted) {
                bonusReward = this.activeMission.reward;
                coinsEarned += bonusReward;
                missionBox.style.display = 'block';
                document.getElementById('go-mission-desc').innerText = this.activeMission.desc;
                document.getElementById('go-mission-desc').nextElementSibling.innerText = `+ 🪙 ${bonusReward} BONUS`;
            } else {
                missionBox.style.display = 'none';
            }
        } else {
            missionBox.style.display = 'none';
        }

        // Add coins to wallet
        this.coins += coinsEarned;
        this.saveGameData();

        // Display Stats UI
        document.getElementById('go-score').innerText = finalScore.toLocaleString();
        document.getElementById('go-distance').innerText = `${Math.floor(this.players.p1.dist)} m`;
        document.getElementById('go-maxspeed').innerText = `${Math.floor(this.players.p1.maxSpeed * 3.6)} km/h`;
        document.getElementById('go-overtakes').innerText = this.players.p1.overtakes;
        document.getElementById('go-coins').innerText = `🪙 ${coinsEarned}`;

        document.getElementById('hud-single').classList.remove('active');
        document.getElementById('hud-split').classList.remove('active');
        document.getElementById('touch-controls-p1').classList.remove('active');
        document.getElementById('touch-controls-p2').classList.remove('active');

        document.getElementById('game-over-screen').classList.add('active');

        // Check leaderboard placement
        if (finalScore > 1000 && !opponentDisconnected) {
            setTimeout(() => this.saveNewHighScore(finalScore), 800);
        }

        // Advance mission if completed
        if (missionCompleted) {
            this.advanceMissionSetup();
        }

        this.updateMenuHUD();
    }

    // --- MAIN GAME PHYSICS & ANIMATION LOOP ---
    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = Math.min(this.clock.getDelta(), 0.1); // Clamp massive lag spikes

        if (this.state === 'PLAYING') {
            this.updatePlayerPhysics('p1', delta);
            
            if (this.gameMode === 'SPLIT') {
                this.updatePlayerPhysics('p2', delta);
            }

            // Sync peerjs positions if online multiplayer
            if (this.gameMode === 'ONLINE') {
                this.syncOnlinePositions();
            }

            this.updateTrafficPhysics(delta);
            this.updateSceneryScrolling();
            this.updateWeatherEffects(delta);
            this.checkGameplayCollisions();
            this.updateHUDOverlays();
        } else if (this.state === 'GARAGE') {
            // Spin vehicle slowly on screen inside garage preview
            const preview = this.scene.getObjectByName("garage_preview");
            if (preview) {
                preview.rotation.y += 0.4 * delta;
            }
        }

        this.renderViewports();
    }

    // Split screen dynamic render setup
    renderViewports() {
        if (this.gameMode === 'SPLIT' && this.state === 'PLAYING') {
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Render Player 1 Left Viewport
            this.renderer.setScissorTest(true);

            this.renderer.setViewport(0, 0, width / 2, height);
            this.renderer.setScissor(0, 0, width / 2, height);
            this.cameraP1.aspect = (width / 2) / height;
            this.cameraP1.updateProjectionMatrix();
            this.renderer.render(this.scene, this.cameraP1);

            // Render Player 2 Right Viewport
            this.renderer.setViewport(width / 2, 0, width / 2, height);
            this.renderer.setScissor(width / 2, 0, width / 2, height);
            this.cameraP2.aspect = (width / 2) / height;
            this.cameraP2.updateProjectionMatrix();
            this.renderer.render(this.scene, this.cameraP2);

            this.renderer.setScissorTest(false);
        } else {
            // Single view full screen
            this.cameraP1.aspect = window.innerWidth / window.innerHeight;
            this.cameraP1.updateProjectionMatrix();
            this.renderer.render(this.scene, this.cameraP1);
        }
    }

    // --- CAR HANDLING & VELOCITY PHYSICS ---
    updatePlayerPhysics(id, delta) {
        const p = this.players[id];
        if (p.isCrashed) {
            // Apply spinout tumbling physics if crashed
            p.car.rotation.y += 4 * delta;
            p.car.rotation.x += 2 * delta;
            p.pos.y = Math.max(0, p.pos.y - 8 * delta); // fall down
            p.car.position.copy(p.pos);
            
            p.speed = Math.max(0, p.speed - 30 * delta);
            if (p.speed === 0 && id === 'p1') {
                // Trigger game over when our primary car finishes crashing
                this.endRace();
            }
            return;
        }

        // Nitro Booster mechanic
        let acceleration = p.accel;
        let currentMax = p.maxSpeed;
        
        if (p.keys.nitro && p.nitro > 0 && p.keys.gas) {
            p.nitroActive = true;
            acceleration *= 2.5;
            currentMax *= 1.35; // Boost top speed
            p.nitro = Math.max(0, p.nitro - 0.4 * delta); // drain nitro
            
            // Add blue fire particle trails if Hypercar/Sports
            this.createNitroFlameSparkles(p.car);
        } else {
            p.nitroActive = false;
            p.nitro = Math.min(1.0, p.nitro + 0.08 * delta); // recharge nitro slowly
        }

        // 1. Speed calculations
        if (p.keys.gas) {
            p.speed = Math.min(currentMax, p.speed + acceleration * 60 * delta);
        } else if (p.keys.brake) {
            p.speed = Math.max(0, p.speed - p.brakes * 90 * delta);
        } else {
            // Engine brake/air resistance decay
            p.speed = Math.max(0, p.speed - 2 * delta);
        }

        // Apply weather friction modifiers
        if (this.currentWeather === 'rainy') p.speed = Math.max(0, p.speed - 0.5 * delta); // slight wet drag
        if (this.currentWeather === 'snowy') p.speed = Math.max(0, p.speed - 1.0 * delta);

        // 2. Lateral Steering
        let steerSpeed = p.handling * 12;
        if (this.currentWeather === 'rainy') steerSpeed *= 0.8; // slippery tires
        if (this.currentWeather === 'snowy') steerSpeed *= 0.6; // icy slide

        let steerAngle = 0;
        if (p.keys.left) {
            p.pos.x = Math.max(-7.2, p.pos.x - steerSpeed * delta * (p.speed / 10));
            steerAngle = 0.15; // Visual tilt
        }
        if (p.keys.right) {
            p.pos.x = Math.min(7.2, p.pos.x + steerSpeed * delta * (p.speed / 10));
            steerAngle = -0.15;
        }

        // Apply drifting tire screech sound if turning hard at speed
        if ((p.keys.left || p.keys.right) && p.speed > 25 && Math.random() > 0.6) {
            sfx.playDriftScreech(true);
            this.createDriftSmokeParticles(p.car, p.pos.x);
        } else {
            sfx.playDriftScreech(false);
        }

        // Update Position Z forward progress
        p.pos.z -= p.speed * delta;
        p.car.position.copy(p.pos);

        // Tilt chassis slightly during turn for realism
        p.car.rotation.y = steerAngle * 0.8;
        p.car.rotation.z = steerAngle * 0.45;

        // Spin wheels based on speed
        for (let i = 0; i < 4; i++) {
            const wheel = p.car.getObjectByName(`wheel_${i}`);
            if (wheel) {
                wheel.rotation.x -= (p.speed / 0.4) * delta; // Rotations = speed / radius
            }
        }

        // Flashing sirens for Police car
        if (p.modelType === 'police') {
            const userData = p.car.userData;
            userData.flashTimer += delta * 12;
            const blink = Math.floor(userData.flashTimer) % 2 === 0;
            userData.sirenL.material.color.setHex(blink ? 0x00a2ff : 0x010108);
            userData.sirenR.material.color.setHex(blink ? 0x010108 : 0xff003c);
        }

        // 3. Dynamic camera chasing P1/P2
        const targetCam = id === 'p1' ? this.cameraP1 : this.cameraP2;
        targetCam.position.set(p.pos.x * 0.7, p.pos.y + 2.8, p.pos.z + 7.5);
        targetCam.lookAt(p.pos.x * 0.8, p.pos.y + 0.8, p.pos.z - 20);

        // Adjust directional sun shadow box to follow Player 1
        if (id === 'p1') {
            this.lights.sun.position.set(p.pos.x + 20, p.pos.y + 40, p.pos.z + 20);
            this.lights.sun.target = p.car;
            
            // Calculate scores
            p.dist = -p.pos.z;
            p.score = Math.floor(p.dist * 1.5) + (p.overtakes * 250);
            
            // Update audio engine pitch based on speed
            const speedPercent = p.speed / p.maxSpeed;
            sfx.updateEngine('p1', speedPercent);
        } else if (this.gameMode === 'SPLIT') {
            // Apply audio engine logic for local player 2
            const speedPercent = p.speed / p.maxSpeed;
            sfx.updateEngine('p2', speedPercent);
        }
    }

    // --- REALTIME WEB-SOCKET MATCHMAKING POSITION SYNC ---
    syncOnlinePositions() {
        const p1 = this.players.p1;
        network.sendData({
            type: 'GAME_SYNC',
            x: p1.pos.x,
            y: p1.pos.y,
            z: p1.pos.z,
            speed: p1.speed,
            ry: p1.car.rotation.y,
            rz: p1.car.rotation.z,
            nitroActive: p1.nitroActive
        });

        // Trigger horn sync if pressed
        if (p1.keys.horn && Math.random() > 0.8) {
            network.sendData({ type: 'HORN_TRIGGER' });
        }
    }

    // --- DETERMINISTIC TRAFFIC AI & SCROLLING SPAWNS ---
    // Seeded Random helper to sync traffic maps across online players
    seededRandom() {
        const x = Math.sin(this.rngSeed++) * 10000;
        return x - Math.floor(x);
    }

    updateTrafficPhysics(delta) {
        const primaryZ = this.players.p1.pos.z;

        // 1. Spawning Traffic Cars ahead of Player
        if (primaryZ - this.lastTrafficSpawnZ < -this.trafficSpawnInterval) {
            this.lastTrafficSpawnZ = primaryZ;
            
            // Spawning logic (Host decides online spawning layouts)
            if (this.gameMode !== 'ONLINE' || network.isHost) {
                const lane = Math.floor(this.seededRandom() * 4); // 0 to 3
                const vehicleTypes = ['sedan', 'suv', 'truck'];
                const type = vehicleTypes[Math.floor(this.seededRandom() * vehicleTypes.length)];
                
                const z = primaryZ - 130 - (this.seededRandom() * 30); // Spawn 130m ahead
                const x = -5.4 + (lane * 3.6); // Lane coordinates: -5.4, -1.8, 1.8, 5.4

                // Slightly different traffic speeds
                let speed = this.trafficSpeed + (this.seededRandom() * 6 - 3);
                if (type === 'truck') speed -= 4; // trucks are slow
                if (type === 'suv') speed += 1;

                this.spawnTrafficCar(type, x, z, speed, lane);

                // Send sync packet if Host
                if (this.gameMode === 'ONLINE' && network.isHost) {
                    network.sendData({
                        type: 'TRAFFIC_SPAWN',
                        vType: type,
                        x, z, speed, lane
                    });
                }
            }
        }

        // 2. Police Chase AI Spawner
        const checkPoliceActivation = () => {
            const speedKmh = this.players.p1.speed * 3.6;
            if (speedKmh > 120 && !this.policeActive && !this.players.p1.isCrashed) {
                this.policeActive = true;
                this.policeTimer = 0;
                
                // Spawn police car behind player
                const x = this.players.p1.pos.x;
                const z = this.players.p1.pos.z + 50;
                this.policeCar = Models.createCar('police', '#0d0d0f');
                this.policeCar.position.set(x, 0, z);
                this.scene.add(this.policeCar);
                
                sfx.playHorn(660, 0.6); // Siren sound trigger
                this.showToast("🚓 POLICE CHASE ACTIVE!");
            }
        };

        if (this.gameMode === 'SINGLE') {
            checkPoliceActivation();
        }

        if (this.policeActive && this.policeCar) {
            const cop = this.policeCar;
            const p = this.players.p1;
            this.policeTimer += delta;

            // Flash lights
            const flash = cop.userData;
            if (flash) {
                flash.flashTimer += delta * 15;
                const blink = Math.floor(flash.flashTimer) % 2 === 0;
                flash.sirenL.material.color.setHex(blink ? 0x00a2ff : 0x02020a);
                flash.sirenR.material.color.setHex(blink ? 0x02020a : 0xff003c);
            }

            // Intercept logic: Catch up to player speed
            const distance = cop.position.z - p.pos.z;
            let copSpeed = p.speed + 4; // Catch up!
            if (distance < 8) copSpeed = p.speed - 1; // Ram/match speed when close

            cop.position.z -= copSpeed * delta;
            
            // Steer towards player lane
            const targetX = p.pos.x;
            cop.position.x += (targetX - cop.position.x) * 2 * delta;

            // Busted condition: if cop rams player and slows them down
            if (distance < 5.5 && p.speed < 12) {
                this.bustedTimer += delta;
                if (this.bustedTimer > 1.5) {
                    this.showToast("🚨 BUSTED!");
                    p.isCrashed = true; // Ends game
                }
            } else {
                this.bustedTimer = 0;
            }

            // Despawn cop if player pulls massive distance ahead (e.g. > 150m)
            if (distance > 150) {
                this.scene.remove(cop);
                this.policeCar = null;
                this.policeActive = false;
                this.showToast("Escaped!");
            }
        }

        // 3. Move active traffic and garbage collect old cars
        for (let i = this.traffic.length - 1; i >= 0; i--) {
            const car = this.traffic[i];
            
            // Move traffic car forward in lane
            car.position.z -= car.userData.speed * delta;

            // Lane change AI for fast SUVs/Sports traffic
            if (car.userData.type === 'suv' && Math.random() > 0.99) {
                const targetLane = car.userData.lane + (Math.random() > 0.5 ? 1 : -1);
                if (targetLane >= 0 && targetLane <= 3) {
                    car.userData.lane = targetLane;
                    car.userData.targetX = -5.4 + (targetLane * 3.6);
                }
            }

            if (car.userData.targetX !== undefined) {
                car.position.x += (car.userData.targetX - car.position.x) * 1.5 * delta;
            }

            // Despawn traffic when they fall behind players (e.g. 50 units behind)
            if (car.position.z > primaryZ + 60) {
                this.scene.remove(car);
                this.traffic.splice(i, 1);
            }
        }
    }

    spawnTrafficCar(type, x, z, speed, lane) {
        const car = Models.createTrafficVehicle(type);
        car.position.set(x, 0, z);
        car.userData.type = type;
        car.userData.speed = speed;
        car.userData.lane = lane;
        car.userData.targetX = x;
        
        this.scene.add(car);
        this.traffic.push(car);
    }

    // --- INFINITE ENVIRONMENT ROTATION SCROLL ---
    updateSceneryScrolling() {
        const primaryZ = this.players.p1.pos.z;

        // Recycle road chunks
        this.roadChunks.forEach(chunk => {
            // If road chunk falls completely behind camera view
            if (chunk.position.z > primaryZ + 80) {
                chunk.position.z = this.maxSceneryZ - this.roadLength;
                this.maxSceneryZ = chunk.position.z;
                
                // Repopulate side decorations dynamically along this recycled chunk
                this.spawnDecorationsOnChunk(chunk.position.z);
            }
        });

        // Garbage collect roadside scenery objects that fell behind
        for (let i = this.sceneryItems.length - 1; i >= 0; i--) {
            const item = this.sceneryItems[i];
            if (item.position.z > primaryZ + 80) {
                this.scene.remove(item);
                this.sceneryItems.splice(i, 1);
            }
        }
    }

    // --- WEATHER SCROLLING & LIGHT CONES ---
    updateWeatherEffects(delta) {
        if (!this.weatherParticles) return;

        const positions = this.weatherParticles.geometry.attributes.position.array;
        const u = this.weatherParticles.userData;
        const playerSpeed = this.players.p1.speed;

        // Make particles scroll down relative to player camera coordinates
        for (let i = 0; i < positions.length / 3; i++) {
            const idx = i * 3;
            
            // Adjust vertical fall
            positions[idx + 1] -= u.velocities[i] * delta;
            
            // Scroll relative to player movement Z
            positions[idx + 2] += playerSpeed * delta;

            // Reset when hitting bottom limits
            if (positions[idx + 1] < 0) {
                positions[idx + 1] = 25 + Math.random() * 5;
                positions[idx] = (Math.random() - 0.5) * u.areaWidth + this.players.p1.pos.x;
                positions[idx + 2] = (Math.random() - 0.5) * u.areaLength + this.players.p1.pos.z;
            }
        }
        this.weatherParticles.geometry.attributes.position.needsUpdate = true;
    }

    // --- COLLISION LOGIC (AABB BOUNDING BOXES) ---
    checkGameplayCollisions() {
        const p1 = this.players.p1;
        const p2 = this.players.p2;

        const checkCarCollision = (player) => {
            if (player.isCrashed || !player.car) return;

            const pDim = player.car.userData.dimensions;
            const pMinX = player.pos.x - pDim.width/2;
            const pMaxX = player.pos.x + pDim.width/2;
            const pMinZ = player.pos.z - pDim.length/2;
            const pMaxZ = player.pos.z + pDim.length/2;

            // 1. Check collisions against AI traffic
            this.traffic.forEach(t => {
                const tDim = t.userData.dimensions;
                const tMinX = t.position.x - tDim.width/2;
                const tMaxX = t.position.x + tDim.width/2;
                const tMinZ = t.position.z - tDim.length/2;
                const tMaxZ = t.position.z + tDim.length/2;

                // Box overlap math
                const overlapX = pMinX < tMaxX && pMaxX > tMinX;
                const overlapZ = pMinZ < tMaxZ && pMaxZ > tMinZ;

                if (overlapX && overlapZ) {
                    // Trigger Crash sequence!
                    player.isCrashed = true;
                    sfx.playCrashExplosion();
                    this.triggerCrashExplosionMesh(player.car);

                    if (this.gameMode === 'ONLINE' && player === p1) {
                        network.sendData({ type: 'PLAYER_CRASH' });
                    }
                }

                // 2. Near overtake scoring mechanism
                if (overlapX && Math.abs(player.pos.z - t.position.z) < 5 && player.speed > 25) {
                    // Close call detected if passed closely without crash
                    if (!t.userData[`overtook_${player.pos.x > t.position.x ? 'R' : 'L'}`]) {
                        t.userData[`overtook_${player.pos.x > t.position.x ? 'R' : 'L'}`] = true;
                        player.overtakes++;
                        player.nitro = Math.min(1.0, player.nitro + 0.15); // reward nitro
                        sfx.playHorn(880, 0.15);
                        this.showToast("⚡ CLOSE CALL! +250");
                    }
                }
            });

            // 2. Check collision between Player 1 and Player 2 (Local / Online)
            if (player === p1 && this.gameMode !== 'SINGLE' && !p2.isCrashed && p2.car) {
                const p2Dim = p2.car.userData.dimensions;
                const p2MinX = p2.pos.x - p2Dim.width/2;
                const p2MaxX = p2.pos.x + p2Dim.width/2;
                const p2MinZ = p2.pos.z - p2Dim.length/2;
                const p2MaxZ = p2.pos.z + p2Dim.length/2;

                if (pMinX < p2MaxX && pMaxX > p2MinX && pMinZ < p2MaxZ && pMaxZ > p2MinZ) {
                    // Crash both players on impact!
                    p1.isCrashed = true;
                    p2.isCrashed = true;
                    sfx.playCrashExplosion();
                    this.triggerCrashExplosionMesh(p1.car);
                    this.triggerCrashExplosionMesh(p2.car);
                }
            }
        };

        checkCarCollision(p1);
        if (this.gameMode === 'SPLIT') checkCarCollision(p2);
    }

    triggerCrashExplosionMesh(group) {
        // Explode mesh elements outwards in random directions
        group.children.forEach(child => {
            child.castShadow = false;
            
            // Random spinout drift directions
            const dirX = (Math.random() - 0.5) * 10;
            const dirY = Math.random() * 8 + 4;
            const dirZ = (Math.random() - 0.5) * 10;

            const animateExplosionPart = () => {
                child.position.x += dirX * 0.016;
                child.position.y += dirY * 0.016 - 0.5 * 0.016 * 9.8; // gravity
                child.position.z += dirZ * 0.016;
                
                child.rotation.x += 0.08;
                child.rotation.y += 0.05;

                if (child.position.y > -2) {
                    requestAnimationFrame(animateExplosionPart);
                }
            };
            animateExplosionPart();
        });
    }

    // --- GAME EFFECTS (PARTICLES) ---
    createDriftSmokeParticles(carGroup, posX) {
        const geom = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const mat = new THREE.MeshPhongMaterial({ color: 0xcccccc, transparent: true, opacity: 0.4 });
        
        const smoke = new THREE.Mesh(geom, mat);
        smoke.position.set(carGroup.position.x + (Math.random() - 0.5) * 1.5, 0.1, carGroup.position.z + 2.0);
        this.scene.add(smoke);

        // Animate fading out
        let scale = 1.0;
        const fade = () => {
            scale += 0.05;
            smoke.scale.set(scale, scale, scale);
            smoke.material.opacity -= 0.015;
            smoke.position.y += 0.05;
            
            if (smoke.material.opacity > 0) {
                requestAnimationFrame(fade);
            } else {
                this.scene.remove(smoke);
            }
        };
        fade();
    }

    createNitroFlameSparkles(carGroup) {
        const colors = [0x00ffcc, 0x0099ff, 0xffffff];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const geom = new THREE.BoxGeometry(0.08, 0.08, 0.2);
        const mat = new THREE.MeshBasicMaterial({ color: randomColor });
        const flame = new THREE.Mesh(geom, mat);
        
        flame.position.set(carGroup.position.x + (Math.random() - 0.5) * 0.8, 0.25, carGroup.position.z + 2.25);
        this.scene.add(flame);

        const drift = () => {
            flame.position.z += 0.45;
            flame.scale.x *= 0.88;
            flame.scale.y *= 0.88;
            if (flame.scale.x > 0.08) {
                requestAnimationFrame(drift);
            } else {
                this.scene.remove(flame);
            }
        };
        drift();
    }

    // --- MISSIONS LOGIC ---
    checkMissionCompletion() {
        const p = this.players.p1;
        const m = this.activeMission;

        if (m.type === 'speed') {
            const speedKmh = p.speed * 3.6;
            if (speedKmh >= m.target) return true;
        } else if (m.type === 'distance') {
            if (p.dist >= m.target) return true;
        } else if (m.type === 'overtakes') {
            if (p.overtakes >= m.target) return true;
        }
        return false;
    }

    advanceMissionSetup() {
        const missions = [
            { id: 1, desc: "Drive 1000m", target: 1000, type: 'distance', reward: 150 },
            { id: 2, desc: "Overtake 6 vehicles closely", target: 6, type: 'overtakes', reward: 300 },
            { id: 3, desc: "Reach 160 km/h", target: 160, type: 'speed', reward: 350 },
            { id: 4, desc: "Drive 2000m without crash", target: 2000, type: 'distance', reward: 500 }
        ];

        const nextIdx = (this.activeMission.id) % missions.length;
        this.activeMission = missions[nextIdx];
        this.updateMenuHUD();
    }

    // --- UI UPDATERS & HUD UPDATER ---
    updateHUDOverlays() {
        const p1 = this.players.p1;
        const p2 = this.players.p2;

        if (this.gameMode === 'SINGLE') {
            document.getElementById('hud-score').innerText = String(p1.score).padStart(6, '0');
            document.getElementById('hud-dist').innerText = `${Math.floor(p1.dist)} m`;
            document.getElementById('hud-coins').innerText = `🪙 ${Math.floor(p1.score / 100)}`;
            document.getElementById('hud-speed').innerText = Math.floor(p1.speed * 3.6);
            document.getElementById('hud-nitro-fill').style.width = `${p1.nitro * 100}%`;
        } else {
            // Split-Screen HUDs
            document.getElementById('hud-p1-score').innerText = p1.score;
            document.getElementById('hud-p1-coins').innerText = Math.floor(p1.score / 100);
            document.getElementById('hud-p1-speed').innerText = Math.floor(p1.speed * 3.6);
            document.getElementById('hud-p1-nitro').style.width = `${p1.nitro * 100}%`;

            document.getElementById('hud-p2-score').innerText = p2.score;
            document.getElementById('hud-p2-coins').innerText = Math.floor(p2.score / 100);
            document.getElementById('hud-p2-speed').innerText = Math.floor(p2.speed * 3.6);
            document.getElementById('hud-p2-nitro').style.width = `${p2.nitro * 100}%`;
        }
    }

    updateMenuHUD() {
        document.getElementById('menu-coins').innerText = this.coins;
        document.getElementById('menu-mission-desc').innerText = this.activeMission.desc;
        
        // Setup initial lobby info
        document.getElementById('hud-mission-desc').innerText = this.activeMission.desc;
    }

    showToast(msg) {
        const toast = document.getElementById('game-toast');
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    onWindowResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        this.renderer.setSize(w, h);
        
        this.cameraP1.aspect = w / h;
        this.cameraP1.updateProjectionMatrix();
        
        this.cameraP2.aspect = w / h;
        this.cameraP2.updateProjectionMatrix();
    }
}

// Launch the Game Engine
const game = new Game();
window.onload = () => {
    game.init();

    // Register PWA Service Worker for offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    }
};
