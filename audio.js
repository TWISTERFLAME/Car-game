// Web Audio API Procedural Sound Engine for Neon Highway
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.musicMuted = false;
        this.musicPlaying = false;
        
        // Active sound nodes
        this.engines = {}; // { 'p1': { osc, gain, filterNode }, 'p2': ... }
        this.musicInterval = null;
        this.musicStep = 0;
        this.mainGain = null;
        this.musicGain = null;
        
        // Synth settings
        this.tempo = 120; // BPM
        this.bassSequence = [36, 36, 43, 43, 39, 39, 41, 41]; // Midi notes for bassline loop
        this.beatDuration = 60 / this.tempo / 2; // Eighth notes
    }

    init() {
        if (this.ctx) return;
        
        // Create context
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        
        this.ctx = new AudioContextClass();
        
        // Master gain controls
        this.mainGain = this.ctx.createGain();
        this.mainGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // Master volume
        this.mainGain.connect(this.ctx.destination);
        
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(0.15, this.ctx.currentTime); // Music volume
        this.musicGain.connect(this.mainGain);

        // Resume context on first user interaction if suspended (browser security)
        if (this.ctx.state === 'suspended') {
            const resume = () => {
                this.ctx.resume();
                window.removeEventListener('click', resume);
                window.removeEventListener('touchstart', resume);
                window.removeEventListener('keydown', resume);
            };
            window.addEventListener('click', resume);
            window.addEventListener('touchstart', resume);
            window.addEventListener('keydown', resume);
        }
    }

    setMuted(sfxMuted) {
        this.muted = sfxMuted;
        if (this.mainGain) {
            this.mainGain.gain.setValueAtTime(sfxMuted ? 0 : 0.3, this.ctx ? this.ctx.currentTime : 0);
        }
    }

    setMusicMuted(musicMuted) {
        this.musicMuted = musicMuted;
        if (this.musicGain) {
            this.musicGain.gain.setValueAtTime(musicMuted ? 0 : 0.15, this.ctx ? this.ctx.currentTime : 0);
        }
        if (!musicMuted && !this.musicPlaying) {
            this.startMusic();
        }
    }

    // --- CAR ENGINE SYNTH ---
    startEngine(id = 'p1') {
        this.init();
        if (this.muted || !this.ctx) return;
        if (this.engines[id]) return;

        try {
            // Sawtooth oscillator + triangle oscillator for full rich motor sound
            const osc1 = this.ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(45, this.ctx.currentTime);

            const osc2 = this.ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(45.5, this.ctx.currentTime);

            // Filter out harsh highs
            const filterNode = this.ctx.createBiquadFilter();
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(160, this.ctx.currentTime);
            filterNode.Q.setValueAtTime(4, this.ctx.currentTime);

            // Engine gain
            const engineGain = this.ctx.createGain();
            engineGain.gain.setValueAtTime(0.06, this.ctx.currentTime);

            // Connect
            osc1.connect(filterNode);
            osc2.connect(filterNode);
            filterNode.connect(engineGain);
            engineGain.connect(this.mainGain);

            osc1.start();
            osc2.start();

            this.engines[id] = { osc1, osc2, filterNode, gainNode: engineGain };
        } catch (e) {
            console.error("Error starting engine sound:", e);
        }
    }

    updateEngine(id = 'p1', speedPercent) {
        // speedPercent is 0 to 1
        const engine = this.engines[id];
        if (!engine || !this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            // Base RPM/freq ranges from 40Hz at idle to 200Hz at max redline
            const baseFreq = 40 + (speedPercent * 160);
            
            engine.osc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
            engine.osc2.frequency.setTargetAtTime(baseFreq * 1.01, now, 0.1);

            // Filter tracking: open up the lowpass filter as RPM goes up (brighter engine sound)
            engine.filterNode.frequency.setTargetAtTime(140 + (speedPercent * 400), now, 0.15);
            
            // Speed up pitch vibrations / cylinder simulation slightly
            engine.gainNode.gain.setValueAtTime(0.05 + (speedPercent * 0.04), now);
        } catch (e) {}
    }

    stopEngine(id = 'p1') {
        const engine = this.engines[id];
        if (!engine) return;

        try {
            engine.osc1.stop();
            engine.osc2.stop();
            engine.osc1.disconnect();
            engine.osc2.disconnect();
            engine.filterNode.disconnect();
            engine.gainNode.disconnect();
        } catch (e) {}
        
        delete this.engines[id];
    }

    // --- CAR HORN ---
    playHorn(frequency = 440, duration = 0.3) {
        this.init();
        if (this.muted || !this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            // Two oscillators detuned slightly to sound like a brassy car horn
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(frequency, now);
            
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(frequency + 5, now);

            const bandpass = this.ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(frequency, now);
            bandpass.Q.setValueAtTime(2, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

            osc1.connect(bandpass);
            osc2.connect(bandpass);
            bandpass.connect(gain);
            gain.connect(this.mainGain);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + duration);
            osc2.stop(now + duration);
        } catch(e) {}
    }

    // --- TYRE SCREECH / DRIFT SOUND ---
    playDriftScreech(active = true) {
        this.init();
        if (this.muted || !this.ctx) return;

        if (active) {
            if (this.driftOsc) return; // Already screeching
            try {
                const now = this.ctx.currentTime;
                this.driftOsc = this.ctx.createOscillator();
                this.driftOsc.type = 'triangle';
                this.driftOsc.frequency.setValueAtTime(800, now);
                
                // Add tiny frequency modulation to mimic tyre vibration
                const fm = this.ctx.createOscillator();
                const fmGain = this.ctx.createGain();
                fm.frequency.setValueAtTime(50, now);
                fmGain.gain.setValueAtTime(200, now);
                
                fm.connect(fmGain);
                fmGain.connect(this.driftOsc.frequency);

                this.driftFilter = this.ctx.createBiquadFilter();
                this.driftFilter.type = 'bandpass';
                this.driftFilter.frequency.setValueAtTime(1200, now);
                this.driftFilter.Q.setValueAtTime(1.5, now);

                this.driftGain = this.ctx.createGain();
                this.driftGain.gain.setValueAtTime(0.04, now);

                this.driftOsc.connect(this.driftFilter);
                this.driftFilter.connect(this.driftGain);
                this.driftGain.connect(this.mainGain);

                fm.start();
                this.driftOsc.start();
                this.driftFM = fm;
            } catch (e) {}
        } else {
            if (!this.driftOsc) return;
            try {
                const now = this.ctx.currentTime;
                const osc = this.driftOsc;
                const gain = this.driftGain;
                const fm = this.driftFM;
                
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                
                setTimeout(() => {
                    try {
                        osc.stop();
                        fm.stop();
                        osc.disconnect();
                        fm.disconnect();
                        gain.disconnect();
                    } catch(e) {}
                }, 150);

                this.driftOsc = null;
                this.driftFilter = null;
                this.driftGain = null;
                this.driftFM = null;
            } catch (e) {}
        }
    }

    // --- COIN COLLECTED SOUND ---
    playCoinCollect() {
        this.init();
        if (this.muted || !this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            // Classic retro double coin chime (e.g., 987Hz followed immediately by 1318Hz)
            osc.frequency.setValueAtTime(987.77, now); // B5
            osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.setValueAtTime(0.08, now + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(this.mainGain);

            osc.start(now);
            osc.stop(now + 0.4);
        } catch(e) {}
    }

    // --- EXPLOSION / CRASH SOUND ---
    playCrashExplosion() {
        this.init();
        if (this.muted || !this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            
            // Create a white noise buffer
            const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            // Lowpass filter to create rumbling impact
            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(800, now);
            lp.frequency.exponentialRampToValueAtTime(20, now + 1.2);
            lp.Q.setValueAtTime(5, now);

            // Explosive volume decay envelope
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

            // Heavy sub bass kick for impact feel
            const sub = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(130, now);
            sub.frequency.exponentialRampToValueAtTime(30, now + 0.3);
            
            subGain.gain.setValueAtTime(0.4, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            // Connections
            noise.connect(lp);
            lp.connect(gain);
            gain.connect(this.mainGain);

            sub.connect(subGain);
            subGain.connect(this.mainGain);

            noise.start(now);
            sub.start(now);
            noise.stop(now + 1.5);
            sub.stop(now + 0.5);
        } catch (e) {}
    }

    // --- RETRO SYNTH BGM GENERATOR ---
    startMusic() {
        this.init();
        if (this.musicMuted || this.musicPlaying || !this.ctx) return;
        
        this.musicPlaying = true;
        this.musicStep = 0;

        const scheduleBeat = () => {
            if (!this.musicPlaying || this.musicMuted) return;

            const now = this.ctx.currentTime;
            
            // 1. Synth Bass Note (loops bass sequence)
            const noteIndex = Math.floor(this.musicStep / 2) % this.bassSequence.length;
            const midiNote = this.bassSequence[noteIndex];
            const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            const filterNode = this.ctx.createBiquadFilter();

            bassOsc.type = 'sawtooth';
            bassOsc.frequency.setValueAtTime(frequency, now);

            // Cyberpunk filter envelope
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(300, now);
            filterNode.frequency.exponentialRampToValueAtTime(800, now + this.beatDuration * 0.8);

            bassGain.gain.setValueAtTime(0.07, now);
            bassGain.gain.exponentialRampToValueAtTime(0.001, now + this.beatDuration * 0.95);

            bassOsc.connect(filterNode);
            filterNode.connect(bassGain);
            bassGain.connect(this.musicGain);

            bassOsc.start(now);
            bassOsc.stop(now + this.beatDuration);

            // 2. Synth Drums (Simple beat: Kick on step 0, Snare on step 2, Hi-hat on steps 1,3)
            const beatInBar = this.musicStep % 4; // 0, 1, 2, 3
            if (beatInBar === 0) {
                // Synthesized Kick Drum
                const kickOsc = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kickOsc.type = 'sine';
                kickOsc.frequency.setValueAtTime(120, now);
                kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

                kickGain.gain.setValueAtTime(0.25, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

                kickOsc.connect(kickGain);
                kickGain.connect(this.musicGain);

                kickOsc.start(now);
                kickOsc.stop(now + 0.2);
            } else if (beatInBar === 2) {
                // Synthesized Snare Drum (lowpassed noise bursts)
                const bufferSize = this.ctx.sampleRate * 0.12;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const snareFilter = this.ctx.createBiquadFilter();
                snareFilter.type = 'bandpass';
                snareFilter.frequency.setValueAtTime(1000, now);

                const snareGain = this.ctx.createGain();
                snareGain.gain.setValueAtTime(0.08, now);
                snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                noise.connect(snareFilter);
                snareFilter.connect(snareGain);
                snareGain.connect(this.musicGain);

                noise.start(now);
                noise.stop(now + 0.12);
            } else {
                // Hi-Hat Chime (tiny highpassed noise burst)
                const bufferSize = this.ctx.sampleRate * 0.03;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const hatFilter = this.ctx.createBiquadFilter();
                hatFilter.type = 'highpass';
                hatFilter.frequency.setValueAtTime(7000, now);

                const hatGain = this.ctx.createGain();
                hatGain.gain.setValueAtTime(0.03, now);
                hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

                noise.connect(hatFilter);
                hatFilter.connect(hatGain);
                hatGain.connect(this.musicGain);

                noise.start(now);
                noise.stop(now + 0.03);
            }

            // 3. Simple Lead Arpeggio Melody (spawns randomly on some measures to keep it interesting)
            const measure = Math.floor(this.musicStep / 16);
            if (measure % 2 === 1 && (this.musicStep % 4 === 1 || this.musicStep % 4 === 3)) {
                // Upbeat cyber-melody notes
                const melodyNotes = [60, 63, 67, 70, 72, 75]; // Pentatonic scale notes
                const randomNote = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
                const melodyFreq = 440 * Math.pow(2, (randomNote - 69) / 12);

                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                const delayGain = this.ctx.createGain();
                const delayNode = this.ctx.createDelay();

                leadOsc.type = 'triangle';
                leadOsc.frequency.setValueAtTime(melodyFreq, now);

                leadGain.gain.setValueAtTime(0.04, now);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + this.beatDuration * 2);

                // Add nice stereo delay effect to lead melodies
                delayNode.delayTime.setValueAtTime(this.beatDuration * 0.75, now);
                delayGain.gain.setValueAtTime(0.02, now);

                leadOsc.connect(leadGain);
                leadGain.connect(this.musicGain);

                leadOsc.connect(delayNode);
                delayNode.connect(delayGain);
                delayGain.connect(this.musicGain);

                leadOsc.start(now);
                leadOsc.stop(now + this.beatDuration * 2);
            }

            this.musicStep++;
        };

        // Run scheduler loop
        this.musicInterval = setInterval(scheduleBeat, this.beatDuration * 1000);
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        this.musicPlaying = false;
    }
}

// Instantiate globally so it can be accessed across files
const sfx = new AudioEngine();
