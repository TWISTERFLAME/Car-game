// Procedural 3D Asset Generator for Neon Highway using Three.js
const Models = {
    // Generate procedurally drawn canvas textures to avoid external assets
    textures: {
        // Generates window textures for city buildings
        createSkyscraperCanvas: function(windowColor = '#ffe600') {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Dark building background
            ctx.fillStyle = '#0a0314';
            ctx.fillRect(0, 0, 128, 256);
            
            // Neon vertical trim lines
            ctx.strokeStyle = '#ff0077';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 128, 256);

            // Draw grid of lit windows
            ctx.fillStyle = windowColor;
            const rows = 12;
            const cols = 4;
            const winWidth = 16;
            const winHeight = 12;
            const spacingX = 12;
            const spacingY = 8;
            const startX = 14;
            const startY = 12;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    // Randomly turn on/off windows for realism
                    if (Math.random() > 0.3) {
                        ctx.shadowColor = windowColor;
                        ctx.shadowBlur = 4;
                        ctx.fillRect(
                            startX + c * (winWidth + spacingX),
                            startY + r * (winHeight + spacingY),
                            winWidth,
                            winHeight
                        );
                    }
                }
            }
            return new THREE.CanvasTexture(canvas);
        },

        // Generates grid for road texture
        createRoadCanvas: function(theme = 'highway') {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');

            // Base asphalt color for each theme.
            if (theme === 'city') {
                ctx.fillStyle = '#171822';
            } else if (theme === 'desert') {
                ctx.fillStyle = '#2d241b';
            } else if (theme === 'mountain') {
                ctx.fillStyle = '#232b31';
            } else {
                ctx.fillStyle = '#1d1f24';
            }
            ctx.fillRect(0, 0, 256, 512);

            // Asphalt grain / texture to avoid the road looking flat or invisible.
            for (let i = 0; i < 2500; i++) {
                const shade = 30 + Math.random() * 70;
                ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.12 + Math.random() * 0.18})`;
                ctx.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
            }

            // Bright edge strips so road remains visible against grass/fog.
            let borderLineColor = '#50eaff';
            if (theme === 'desert') borderLineColor = '#ffdc5c';
            if (theme === 'highway') borderLineColor = '#ff5bbd';

            ctx.fillStyle = borderLineColor;
            ctx.fillRect(0, 0, 12, 512);
            ctx.fillRect(244, 0, 12, 512);

            // Center lane lines: more visible and consistent.
            ctx.fillStyle = (theme === 'desert' || theme === 'mountain') ? '#ffffff' : '#ffd447';
            const laneWidth = 256 / 4;
            const stripeHeight = 28;
            const gapHeight = 24;
            const stripeWidth = 6;

            for (let lane = 1; lane < 4; lane++) {
                const x = lane * laneWidth - stripeWidth / 2;
                for (let i = 0; i < 12; i++) {
                    ctx.fillRect(x, i * (stripeHeight + gapHeight), stripeWidth, stripeHeight);
                }
            }

            // Small lane separators / texture lines to make road clear in motion.
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            for (let y = 0; y < 512; y += 24) {
                ctx.beginPath();
                ctx.moveTo(64, y);
                ctx.lineTo(192, y);
                ctx.stroke();
            }

            // Mountain snow overlay.
            if (theme === 'mountain') {
                ctx.fillStyle = '#eef5ff';
                for (let i = 0; i < 35; i++) {
                    const radius = 2 + Math.random() * 8;
                    const x = Math.random() * 256;
                    const y = Math.random() * 512;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            texture.anisotropy = 4;
            return texture;
        }
    },

    // --- CAR MODELS ---
    createCar: function(type = 'sports', colorHex = '#ff0055') {
        const car = new THREE.Group();
        
        // Materials
        const bodyMat = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 100 });
        const blackMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 30 });
        const rimMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 120 });
        const windowMat = new THREE.MeshPhongMaterial({ color: 0x1a2b3c, transparent: true, opacity: 0.7, shininess: 200 });
        const lightWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lightRedMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sirenBlue = new THREE.MeshBasicMaterial({ color: 0x00a2ff });
        const sirenRed = new THREE.MeshBasicMaterial({ color: 0xff003c });

        // Dimensions vary by type
        let width = 1.8;
        let height = 0.8;
        let length = 4.2;

        if (type === 'muscle') {
            length = 4.5;
            width = 1.9;
            height = 0.9;
        } else if (type === 'police') {
            length = 4.4;
            width = 1.95;
            height = 1.0;
        } else if (type === 'hypercar') {
            length = 4.6;
            width = 2.0;
            height = 0.7;
        }

        // 1. CAR CHASSIS (Lower main body)
        const chassisGeom = new THREE.BoxGeometry(width, height * 0.6, length);
        const chassis = new THREE.Mesh(chassisGeom, bodyMat);
        chassis.position.y = height * 0.45;
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        car.add(chassis);

        // 2. CABIN (Upper glass cabin)
        let cabinLength = length * 0.55;
        let cabinWidth = width * 0.85;
        let cabinHeight = height * 0.55;
        
        if (type === 'hypercar') {
            cabinLength = length * 0.45;
            cabinWidth = width * 0.75;
        }

        const cabinGeom = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
        const cabin = new THREE.Mesh(cabinGeom, windowMat);
        // Position cabin on top and offset slightly to rear
        cabin.position.set(0, height * 0.9, -length * 0.05);
        cabin.castShadow = true;
        car.add(cabin);

        // Cabin roof cover (painted metal top)
        const roofGeom = new THREE.BoxGeometry(cabinWidth * 0.96, 0.05, cabinLength * 0.85);
        const roof = new THREE.Mesh(roofGeom, bodyMat);
        roof.position.set(0, height * 0.9 + cabinHeight / 2, -length * 0.05);
        car.add(roof);

        // 3. WHEELS
        const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12);
        wheelGeom.rotateZ(Math.PI / 2); // Rotate to stand vertically
        const rimGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.38, 8);
        rimGeom.rotateZ(Math.PI / 2);

        const wheelPositions = [
            [-width * 0.48, 0.35, length * 0.3],  // Front Left
            [width * 0.48, 0.35, length * 0.3],   // Front Right
            [-width * 0.48, 0.35, -length * 0.3], // Rear Left
            [width * 0.48, 0.35, -length * 0.3]  // Rear Right
        ];

        wheelPositions.forEach((pos, idx) => {
            const tire = new THREE.Mesh(wheelGeom, blackMat);
            const rim = new THREE.Mesh(rimGeom, rimMat);
            
            const wGroup = new THREE.Group();
            wGroup.add(tire);
            wGroup.add(rim);
            wGroup.position.set(pos[0], pos[1], pos[2]);
            
            tire.castShadow = true;
            wGroup.name = `wheel_${idx}`; // Tag wheels to rotate during driving
            car.add(wGroup);
        });

        // 4. ACCESSORIES BASED ON CAR TYPE

        // Muscle Car Hood Scoop & Stripes
        if (type === 'muscle') {
            // Hood Scoop
            const scoopGeom = new THREE.BoxGeometry(width * 0.3, 0.2, 0.6);
            const scoop = new THREE.Mesh(scoopGeom, blackMat);
            scoop.position.set(0, height * 0.8, length * 0.25);
            car.add(scoop);

            // Racing stripes (black strips on hood/trunk)
            const stripeGeom = new THREE.BoxGeometry(width * 0.08, 0.02, length * 0.4);
            const stripeL = new THREE.Mesh(stripeGeom, blackMat);
            const stripeR = new THREE.Mesh(stripeGeom, blackMat);
            stripeL.position.set(-0.25, height * 0.76, length * 0.3);
            stripeR.position.set(0.25, height * 0.76, length * 0.3);
            car.add(stripeL);
            car.add(stripeR);
        }

        // Police Siren Lightbar & Decals
        else if (type === 'police') {
            // Police lightbar on roof
            const barBaseGeom = new THREE.BoxGeometry(width * 0.7, 0.08, 0.15);
            const barBase = new THREE.Mesh(barBaseGeom, blackMat);
            barBase.position.set(0, height * 0.9 + cabinHeight, -length * 0.05);
            
            const lightL = new THREE.Mesh(new THREE.BoxGeometry(width * 0.3, 0.12, 0.12), sirenBlue);
            lightL.position.set(-width * 0.18, height * 0.9 + cabinHeight + 0.06, -length * 0.05);
            
            const lightR = new THREE.Mesh(new THREE.BoxGeometry(width * 0.3, 0.12, 0.12), sirenRed);
            lightR.position.set(width * 0.18, height * 0.9 + cabinHeight + 0.06, -length * 0.05);

            car.add(barBase);
            car.add(lightL);
            car.add(lightR);
            
            // Store reference to flash sirens in game loop
            car.userData = { sirenL: lightL, sirenR: lightR, flashTimer: 0 };
            
            // Side White doors (police style)
            const doorGeom = new THREE.BoxGeometry(0.02, height * 0.55, length * 0.3);
            const doorMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
            const doorL = new THREE.Mesh(doorGeom, doorMat);
            const doorR = new THREE.Mesh(doorGeom, doorMat);
            doorL.position.set(-width * 0.505, height * 0.45, 0);
            doorR.position.set(width * 0.505, height * 0.45, 0);
            car.add(doorL);
            car.add(doorR);
        }

        // Hypercar Spoiler and Neon Underglow
        else if (type === 'hypercar') {
            // Low spoiler wing
            const spoilerPostGeom = new THREE.BoxGeometry(0.1, 0.4, 0.1);
            const postL = new THREE.Mesh(spoilerPostGeom, bodyMat);
            const postR = new THREE.Mesh(spoilerPostGeom, bodyMat);
            postL.position.set(-width * 0.35, height * 0.8, -length * 0.42);
            postR.position.set(width * 0.35, height * 0.8, -length * 0.42);
            
            const wingGeom = new THREE.BoxGeometry(width * 1.1, 0.05, 0.4);
            const wing = new THREE.Mesh(wingGeom, bodyMat);
            wing.position.set(0, height * 0.8 + 0.2, -length * 0.42);

            car.add(postL);
            car.add(postR);
            car.add(wing);

            // Sleek front splitter wedges
            const splitterGeom = new THREE.BoxGeometry(width * 0.9, 0.1, 0.3);
            const splitter = new THREE.Mesh(splitterGeom, blackMat);
            splitter.position.set(0, height * 0.2, length * 0.45);
            car.add(splitter);
        }

        // Standard Sports Car spoiler (default spoiler)
        else if (type === 'sports') {
            const wingGeom = new THREE.BoxGeometry(width * 0.85, 0.08, 0.25);
            const wing = new THREE.Mesh(wingGeom, bodyMat);
            wing.position.set(0, height * 0.85, -length * 0.45);
            
            const standGeom = new THREE.BoxGeometry(0.08, 0.2, 0.08);
            const standL = new THREE.Mesh(standGeom, blackMat);
            const standR = new THREE.Mesh(standGeom, blackMat);
            standL.position.set(-width * 0.3, height * 0.7, -length * 0.45);
            standR.position.set(width * 0.3, height * 0.7, -length * 0.45);

            car.add(standL);
            car.add(standR);
            car.add(wing);
        }

        // 5. LIGHTS (Headlights & Brakelights)
        const lightGeom = new THREE.BoxGeometry(0.2, 0.1, 0.05);
        
        const headL = new THREE.Mesh(lightGeom, lightWhiteMat);
        const headR = new THREE.Mesh(lightGeom, lightWhiteMat);
        headL.position.set(-width * 0.35, height * 0.48, length * 0.501);
        headR.position.set(width * 0.35, height * 0.48, length * 0.501);
        car.add(headL);
        car.add(headR);

        const brakeL = new THREE.Mesh(lightGeom, lightRedMat);
        const brakeR = new THREE.Mesh(lightGeom, lightRedMat);
        brakeL.position.set(-width * 0.35, height * 0.48, -length * 0.501);
        brakeR.position.set(width * 0.35, height * 0.48, -length * 0.501);
        car.add(brakeL);
        car.add(brakeR);

        // Save headlights mesh list to enable/disable emissive lights at night
        car.userData.headlights = [headL, headR];
        car.userData.brakelights = [brakeL, brakeR];

        // Store bounding dimensions for crash calculations
        car.userData.dimensions = { width, height, length };

        return car;
    },

    // --- TRAFFIC MODELS ---
    createTrafficVehicle: function(type = 'sedan') {
        const traffic = new THREE.Group();
        
        // Random body colors
        const colors = [0x3c6382, 0x079992, 0xe58e26, 0xb71540, 0x6ab04c, 0xf6b93b, 0x78e08f, 0x1e3799];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const bodyMat = new THREE.MeshPhongMaterial({ color: randomColor, shininess: 50 });
        const metalGrayMat = new THREE.MeshPhongMaterial({ color: 0x95a5a6, shininess: 40 });
        const blackMat = new THREE.MeshPhongMaterial({ color: 0x151515, shininess: 10 });
        const windowMat = new THREE.MeshPhongMaterial({ color: 0x223344, transparent: true, opacity: 0.7 });
        const lightWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
        const lightRedMat = new THREE.MeshBasicMaterial({ color: 0xcc0000 });

        let width = 1.75;
        let height = 0.8;
        let length = 4.1;

        if (type === 'truck') {
            width = 2.4;
            height = 2.8;
            length = 9.5;
        } else if (type === 'suv') {
            width = 1.9;
            height = 1.25;
            length = 4.6;
        }

        // A. SEDAN / SUV
        if (type === 'sedan' || type === 'suv') {
            const bodyH = height * (type === 'suv' ? 0.55 : 0.6);
            const bodyGeom = new THREE.BoxGeometry(width, bodyH, length);
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = height * 0.45;
            body.castShadow = true;
            body.receiveShadow = true;
            traffic.add(body);

            // Cabin
            const cabinH = height * 0.5;
            const cabinL = length * (type === 'suv' ? 0.75 : 0.5);
            const cabinGeom = new THREE.BoxGeometry(width * 0.82, cabinH, cabinL);
            const cabin = new THREE.Mesh(cabinGeom, windowMat);
            cabin.position.set(0, height * 0.85, type === 'suv' ? -length * 0.08 : -length * 0.05);
            cabin.castShadow = true;
            traffic.add(cabin);

            // Wheels
            const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
            wheelGeom.rotateZ(Math.PI / 2);
            
            const wPositions = [
                [-width * 0.48, 0.35, length * 0.28],
                [width * 0.48, 0.35, length * 0.28],
                [-width * 0.48, 0.35, -length * 0.28],
                [width * 0.48, 0.35, -length * 0.28]
            ];

            wPositions.forEach(pos => {
                const tire = new THREE.Mesh(wheelGeom, blackMat);
                tire.position.set(pos[0], pos[1], pos[2]);
                tire.castShadow = true;
                traffic.add(tire);
            });
        }

        // B. HEAVY CONTAINER TRUCK
        else if (type === 'truck') {
            // 1. Truck Cabin
            const cabinGeom = new THREE.BoxGeometry(width * 0.95, 1.4, 2.2);
            const cabinMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 80 });
            const cabin = new THREE.Mesh(cabinGeom, cabinMat);
            cabin.position.set(0, 0.95, length * 0.35); // placed at the front
            cabin.castShadow = true;
            traffic.add(cabin);

            // Windshield
            const windGeom = new THREE.BoxGeometry(width * 0.88, 0.5, 0.1);
            const wind = new THREE.Mesh(windGeom, windowMat);
            wind.position.set(0, 1.35, length * 0.35 + 1.05);
            traffic.add(wind);

            // Side windows
            const sideWinGeom = new THREE.BoxGeometry(0.1, 0.45, 0.8);
            const sideWinL = new THREE.Mesh(sideWinGeom, windowMat);
            const sideWinR = new THREE.Mesh(sideWinGeom, windowMat);
            sideWinL.position.set(-width * 0.48, 1.3, length * 0.35);
            sideWinR.position.set(width * 0.48, 1.3, length * 0.35);
            traffic.add(sideWinL);
            traffic.add(sideWinR);

            // 2. Cargo Container
            const cargoGeom = new THREE.BoxGeometry(width, 2.0, 6.8);
            const cargoColor = colors[Math.floor(Math.random() * colors.length)];
            const cargoMat = new THREE.MeshPhongMaterial({ color: cargoColor, shininess: 10 });
            const cargo = new THREE.Mesh(cargoGeom, cargoMat);
            cargo.position.set(0, 1.7, -length * 0.12); // placed on trailer back
            cargo.castShadow = true;
            cargo.receiveShadow = true;
            traffic.add(cargo);

            // 3. Chassis Bed connecting cabin and cargo
            const bedGeom = new THREE.BoxGeometry(width * 0.8, 0.3, length);
            const bed = new THREE.Mesh(bedGeom, metalGrayMat);
            bed.position.y = 0.5;
            bed.castShadow = true;
            traffic.add(bed);

            // 4. Wheels (6 wheels for heavy truck)
            const wheelGeom = new THREE.CylinderGeometry(0.48, 0.48, 0.4, 10);
            wheelGeom.rotateZ(Math.PI / 2);

            const wPositions = [
                [-width * 0.45, 0.45, length * 0.38],   // Front L
                [width * 0.45, 0.45, length * 0.38],    // Front R
                [-width * 0.45, 0.45, -length * 0.18],  // Mid Rear L
                [width * 0.45, 0.45, -length * 0.18],   // Mid Rear R
                [-width * 0.45, 0.45, -length * 0.38],  // Back Rear L
                [width * 0.45, 0.45, -length * 0.38]   // Back Rear R
            ];

            wPositions.forEach(pos => {
                const tire = new THREE.Mesh(wheelGeom, blackMat);
                tire.position.set(pos[0], pos[1], pos[2]);
                tire.castShadow = true;
                traffic.add(tire);
            });
        }

        // Headlights & Tail lights
        const lightGeom = new THREE.BoxGeometry(0.18, 0.08, 0.04);
        
        const headL = new THREE.Mesh(lightGeom, lightWhiteMat);
        const headR = new THREE.Mesh(lightGeom, lightWhiteMat);
        headL.position.set(-width * 0.35, height * 0.4, length * 0.501);
        headR.position.set(width * 0.35, height * 0.4, length * 0.501);
        traffic.add(headL);
        traffic.add(headR);

        const brakeL = new THREE.Mesh(lightGeom, lightRedMat);
        const brakeR = new THREE.Mesh(lightGeom, lightRedMat);
        brakeL.position.set(-width * 0.35, height * 0.4, -length * 0.501);
        brakeR.position.set(width * 0.35, height * 0.4, -length * 0.501);
        traffic.add(brakeL);
        traffic.add(brakeR);

        // Adjust lights for truck positioning
        if (type === 'truck') {
            headL.position.set(-width * 0.35, 0.5, length * 0.5 - 0.25);
            headR.position.set(width * 0.35, 0.5, length * 0.5 - 0.25);
            brakeL.position.set(-width * 0.35, 0.7, -length * 0.5 + 0.1);
            brakeR.position.set(width * 0.35, 0.7, -length * 0.5 + 0.1);
        }

        // Bounding Dimensions
        traffic.userData.dimensions = { width, height, length };

        return traffic;
    },

    // --- ENVIRONMENT MODELS ---
    createPineTree: function() {
        const tree = new THREE.Group();
        
        // Materials
        const trunkMat = new THREE.MeshPhongMaterial({ color: 0x4a2700, shininess: 2 });
        const foliageMat = new THREE.MeshPhongMaterial({ color: 0x005522, shininess: 5, flatShading: true });
        
        // Trunk
        const trunkGeom = new THREE.CylinderGeometry(0.18, 0.3, 1.5, 6);
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 0.75;
        trunk.castShadow = true;
        tree.add(trunk);

        // 3 Tiers of pine cones for foliage
        for (let i = 0; i < 3; i++) {
            const width = 1.3 - (i * 0.35);
            const height = 1.2 - (i * 0.1);
            const coneGeom = new THREE.ConeGeometry(width, height, 5);
            const cone = new THREE.Mesh(coneGeom, foliageMat);
            cone.position.y = 1.6 + (i * 0.8);
            cone.castShadow = true;
            tree.add(cone);
        }

        return tree;
    },

    createCactus: function() {
        const cactus = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({ color: 0x2e8b57, shininess: 5, flatShading: true });

        // Main trunk
        const main = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 2.5, 6), mat);
        main.position.y = 1.25;
        main.castShadow = true;
        cactus.add(main);

        // Left branch
        const branchL1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 6), mat);
        branchL1.rotateZ(Math.PI / 2);
        branchL1.position.set(-0.45, 1.4, 0);
        
        const branchL2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 6), mat);
        branchL2.position.set(-0.85, 1.75, 0);
        branchL2.castShadow = true;

        cactus.add(branchL1);
        cactus.add(branchL2);

        // Right branch
        const branchR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 6), mat);
        branchR1.rotateZ(Math.PI / 2);
        branchR1.position.set(0.45, 0.9, 0);

        const branchR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 6), mat);
        branchR2.position.set(0.85, 1.25, 0);
        branchR2.castShadow = true;

        cactus.add(branchR1);
        cactus.add(branchR2);

        return cactus;
    },

    createStreetlight: function() {
        const streetlight = new THREE.Group();
        const metalMat = new THREE.MeshPhongMaterial({ color: 0x44444c, metalness: 0.8, roughness: 0.2 });
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe677 });

        // Vertical pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 6.0, 6), metalMat);
        pole.position.y = 3.0;
        pole.castShadow = true;
        streetlight.add(pole);

        // Horizontal arm
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), metalMat);
        arm.rotateZ(Math.PI / 2);
        arm.position.set(0.9, 5.9, 0);
        streetlight.add(arm);

        // Light bulb container
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), metalMat);
        head.position.set(1.8, 5.8, 0);
        streetlight.add(head);

        // Emissive light mesh
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), bulbMat);
        bulb.position.set(1.8, 5.65, 0);
        streetlight.add(bulb);

        // Optional 3D Spotlight component (attached in game if shadows are enabled)
        return streetlight;
    },

    createRock: function() {
        const rock = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({ color: 0x807d7a, shininess: 2, flatShading: true });
        
        // Polyhedral rock built from random sphere scaling
        const geom = new THREE.DodecahedronGeometry(1.2, 1);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.scale.set(1.0 + Math.random() * 0.4, 0.5 + Math.random() * 0.5, 0.9 + Math.random() * 0.3);
        mesh.position.y = 0.5;
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        rock.add(mesh);
        return rock;
    },

    // --- NEON CITY SKYSCRAPER BUILDINGS ---
    createBuilding: function(height = 20, width = 6, windowColor = '#ffe600') {
        const buildingGroup = new THREE.Group();
        
        // High quality Canvas window textures mapping to 4 sides
        const winTexture = this.textures.createSkyscraperCanvas(windowColor);
        winTexture.repeat.set(1, Math.floor(height / 4)); // repeat texture based on building height

        const matSide = new THREE.MeshPhongMaterial({ 
            map: winTexture,
            shininess: 30,
            bumpScale: 0.05
        });
        
        // Roof is clean dark metal (doesn't need windows)
        const matRoof = new THREE.MeshPhongMaterial({ color: 0x07010e, shininess: 50 });

        const materials = [
            matSide, // Left
            matSide, // Right
            matRoof, // Top
            matRoof, // Bottom
            matSide, // Front
            matSide  // Back
        ];

        const geom = new THREE.BoxGeometry(width, height, width);
        const mesh = new THREE.Mesh(geom, materials);
        mesh.position.y = height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        buildingGroup.add(mesh);
        
        // Optional neon trim lines on building edges
        const boxHelper = new THREE.BoxHelper(mesh, 0xff0077);
        boxHelper.position.y = height / 2;
        buildingGroup.add(boxHelper);

        return buildingGroup;
    },

    // --- WEATHER PARTICLE SYSTEMS ---
    createRainSystem: function(count = 200, areaWidth = 40, areaLength = 120) {
        const geom = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < count; i++) {
            // Spawn inside bounding box around player camera
            positions.push(
                (Math.random() - 0.5) * areaWidth, // X
                Math.random() * 25 + 5,            // Y (fall height)
                (Math.random() - 0.5) * areaLength  // Z
            );
            // Speed of rainfall
            velocities.push(15 + Math.random() * 10);
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const mat = new THREE.PointsMaterial({
            color: 0x00d2ff,
            size: 0.12,
            transparent: true,
            opacity: 0.65
        });

        const points = new THREE.Points(geom, mat);
        points.userData = { velocities, areaWidth, areaLength };
        return points;
    },

    createSnowSystem: function(count = 150, areaWidth = 40, areaLength = 120) {
        const geom = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        const drifts = [];

        for (let i = 0; i < count; i++) {
            positions.push(
                (Math.random() - 0.5) * areaWidth, // X
                Math.random() * 25 + 5,            // Y
                (Math.random() - 0.5) * areaLength  // Z
            );
            velocities.push(3 + Math.random() * 3); // slower drift velocity
            drifts.push(Math.random() * 2 - 1);     // horizontal drift variance
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.22,
            transparent: true,
            opacity: 0.85
        });

        const points = new THREE.Points(geom, mat);
        points.userData = { velocities, drifts, areaWidth, areaLength };
        return points;
    }
};
