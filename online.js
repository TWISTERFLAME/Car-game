// WebRTC PeerJS Online Multiplayer Controller for Neon Highway
class OnlineController {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.roomCode = '';
        this.connected = false;
        this.statusCallback = null;
        this.messageCallback = null;
        this.lobbyState = {
            map: 'highway',
            weather: 'clear',
            p1Car: 'sports',
            p1Color: '#ff0055',
            p1Ready: false,
            p2Car: 'sports',
            p2Color: '#00ffcc',
            p2Ready: false,
            gameStarted: false,
            seed: 0
        };
    }

    // Initialize PeerJS
    init(statusCallback, messageCallback) {
        this.statusCallback = statusCallback;
        this.messageCallback = messageCallback;
        this.updateStatus("Connecting to matchmaking network...");

        if (this.peer) return;

        try {
            // Setup connection to PeerJS public cloud server
            this.peer = new Peer(null, {
                host: '0.peerjs.com',
                port: 443,
                secure: true,
                debug: 1, // Minimize log clutter
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                this.updateStatus("Online - Ready to race!");
                this.connected = true;
            });

            this.peer.on('connection', (connection) => {
                // Triggered on HOST when a GUEST connects
                if (this.conn) {
                    // Reject connection if room is full
                    connection.on('open', () => {
                        connection.send({ type: 'ROOM_FULL' });
                        setTimeout(() => connection.close(), 500);
                    });
                    return;
                }
                this.setupConnection(connection, true);
            });

            this.peer.on('error', (err) => {
                console.error("Matchmaking Network Error:", err);
                if (err.type === 'unavailable-id') {
                    this.updateStatus("Error: Room code already in use.");
                } else if (err.type === 'peer-unavailable') {
                    this.updateStatus("Error: Room code not found.");
                } else {
                    this.updateStatus("Network Error: " + err.type);
                }
                this.disconnect();
            });

            this.peer.on('disconnected', () => {
                this.updateStatus("Disconnected from server.");
                this.connected = false;
            });
        } catch (e) {
            this.updateStatus("Unable to initialize PeerJS.");
        }
    }

    // Set up listeners for the established data channel
    setupConnection(connection, isHost) {
        this.conn = connection;
        this.isHost = isHost;
        this.lobbyState.seed = Math.floor(Math.random() * 999999); // Generate shared seed

        this.updateStatus(isHost ? "Player 2 joined! Waiting for ready..." : "Connected to Host! Syncing lobby...");

        this.conn.on('open', () => {
            // Guest sends introductory info
            if (!this.isHost) {
                this.sendData({
                    type: 'JOIN_LOBBY',
                    p2Car: this.lobbyState.p2Car,
                    p2Color: this.lobbyState.p2Color
                });
            } else {
                // Host sends current setup
                this.sendData({
                    type: 'LOBBY_STATE',
                    state: this.lobbyState
                });
            }
            
            if (this.messageCallback) {
                this.messageCallback({ type: 'CONNECTED' });
            }
        });

        this.conn.on('data', (data) => {
            if (data.type === 'ROOM_FULL') {
                this.updateStatus("Join failed: Room is full!");
                this.disconnect();
                return;
            }
            this.handleMessage(data);
        });

        this.conn.on('close', () => {
            this.updateStatus("Opponent disconnected.");
            this.disconnect();
            if (this.messageCallback) {
                this.messageCallback({ type: 'DISCONNECTED' });
            }
        });

        this.conn.on('error', (err) => {
            this.updateStatus("Connection lost.");
            this.disconnect();
        });
    }

    // Handle incoming P2P packet data
    handleMessage(data) {
        if (!data || !this.messageCallback) return;

        switch (data.type) {
            case 'JOIN_LOBBY':
                this.lobbyState.p2Car = data.p2Car;
                this.lobbyState.p2Color = data.p2Color;
                this.lobbyState.p2Ready = false;
                this.broadcastLobby();
                break;

            case 'LOBBY_STATE':
                this.lobbyState = data.state;
                break;

            case 'CAR_SELECT':
                if (this.isHost) {
                    this.lobbyState.p2Car = data.car;
                    this.lobbyState.p2Color = data.color;
                    this.broadcastLobby();
                } else {
                    // If guest, this shouldn't happen, host dictates state
                }
                break;

            case 'TOGGLE_READY':
                if (this.isHost) {
                    this.lobbyState.p2Ready = data.ready;
                    this.broadcastLobby();
                } else {
                    this.lobbyState.p1Ready = data.p1Ready;
                    this.lobbyState.p2Ready = data.p2Ready;
                }
                break;

            case 'UPDATE_SETTINGS':
                if (!this.isHost) {
                    this.lobbyState.map = data.map;
                    this.lobbyState.weather = data.weather;
                }
                break;

            case 'START_GAME':
                this.lobbyState.gameStarted = true;
                break;

            // Handled directly inside game.js during high-frequency loop
            case 'GAME_SYNC':
            case 'TRAFFIC_COLLISION':
            case 'PLAYER_CRASH':
            case 'HORN_TRIGGER':
                break;
        }

        // Pass message up to game manager
        this.messageCallback(data);
    }

    // Send data packet to opponent
    sendData(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    // --- ROOM CREATION ---
    createRoom(customMap = 'highway', customWeather = 'clear') {
        if (!this.peer || !this.connected) return;

        // Generate 4-letter uppercase code
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing O, I, 1
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        this.roomCode = code;
        this.isHost = true;
        
        this.lobbyState.map = customMap;
        this.lobbyState.weather = customWeather;
        this.lobbyState.p1Ready = true; // Host is default ready
        this.lobbyState.p2Ready = false;
        this.lobbyState.gameStarted = false;

        this.updateStatus(`Creating Room ${this.roomCode}...`);

        // Close any previous Peer connection, then recreate with the targeted Room ID
        this.peer.destroy();
        
        this.peer = new Peer(`neon-highway-room-${this.roomCode}`, {
            host: '0.peerjs.com',
            port: 443,
            secure: true,
            debug: 1
        });

        this.peer.on('open', (id) => {
            this.updateStatus(`Lobby Open: ${this.roomCode}`);
            this.connected = true;
            if (this.messageCallback) {
                this.messageCallback({ type: 'ROOM_CREATED', code: this.roomCode });
            }
        });

        this.peer.on('connection', (connection) => {
            if (this.conn) {
                connection.on('open', () => {
                    connection.send({ type: 'ROOM_FULL' });
                    setTimeout(() => connection.close(), 500);
                });
                return;
            }
            this.setupConnection(connection, true);
        });

        this.peer.on('error', (err) => {
            console.error(err);
            this.updateStatus("Lobby Creation Failed. Try again.");
            this.disconnect();
        });
    }

    // --- JOINING ROOM ---
    joinRoom(code) {
        if (!this.peer || !this.connected) return;

        const roomID = `neon-highway-room-${code.toUpperCase()}`;
        this.roomCode = code.toUpperCase();
        this.isHost = false;
        this.updateStatus(`Connecting to Room ${this.roomCode}...`);

        const connection = this.peer.connect(roomID);
        this.setupConnection(connection, false);
    }

    // --- QUICK MATCH (SCAN SEQUENTIAL ROOMS) ---
    quickMatch() {
        this.updateStatus("Searching for open rooms...");
        let scanIndex = 1;
        const maxScan = 5;

        const scanNext = () => {
            if (scanIndex > maxScan) {
                // If no empty rooms found, Host our own Quick Match Room
                this.hostQuickMatchRoom();
                return;
            }

            const qmRoomId = `neon-highway-qm-${scanIndex}`;
            const connAttempt = this.peer.connect(qmRoomId);
            
            let timeout = setTimeout(() => {
                connAttempt.close();
                scanIndex++;
                scanNext();
            }, 3000); // 3-second connect timeout

            connAttempt.on('open', () => {
                clearTimeout(timeout);
                this.isHost = false;
                this.roomCode = `QM-${scanIndex}`;
                this.setupConnection(connAttempt, false);
            });

            connAttempt.on('error', (err) => {
                clearTimeout(timeout);
                scanIndex++;
                scanNext();
            });
        };

        scanNext();
    }

    hostQuickMatchRoom() {
        this.peer.destroy();
        this.isHost = true;
        this.roomCode = "QM-HOST";
        this.updateStatus("Creating matchmaking room...");

        // Try hosting sequential QM spots
        let hostIndex = 1;
        const tryHost = () => {
            this.peer = new Peer(`neon-highway-qm-${hostIndex}`, {
                host: '0.peerjs.com',
                port: 443,
                secure: true,
                debug: 1
            });

            this.peer.on('open', () => {
                this.updateStatus("Waiting for opponent...");
                this.connected = true;
            });

            this.peer.on('connection', (connection) => {
                this.setupConnection(connection, true);
            });

            this.peer.on('error', (err) => {
                if (err.type === 'unavailable-id') {
                    hostIndex++;
                    if (hostIndex <= 5) {
                        tryHost();
                    } else {
                        this.updateStatus("All Quick Match lobbies full. Try again later.");
                        this.disconnect();
                    }
                } else {
                    this.updateStatus("Matchmaking failed.");
                    this.disconnect();
                }
            });
        };

        tryHost();
    }

    // --- LOBBY ACTIONS ---
    broadcastLobby() {
        if (this.isHost && this.conn) {
            this.sendData({
                type: 'LOBBY_STATE',
                state: this.lobbyState
            });
        }
    }

    updateStatus(msg) {
        if (this.statusCallback) {
            this.statusCallback(msg);
        }
    }

    disconnect() {
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        this.roomCode = '';
        this.isHost = false;
        
        // Reset states
        this.lobbyState.p1Ready = false;
        this.lobbyState.p2Ready = false;
        this.lobbyState.gameStarted = false;
    }
}

// Global Online Controller
const network = new OnlineController();
