/**
 * AudioController
 * Advanced procedural sound generation using Web Audio API.
 */
class AudioController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        
        this.settings = {
            master: 0.5,
            sfx: 0.7,
            music: 0.4
        };

        this.musicInterval = null;
        this.currentBPM = 120;
        this.musicState = 'normal'; // 'normal', 'boss', 'danger'
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.updateVolumes();
    }

    updateVolumes() {
        if (!this.ctx) return;
        this.masterGain.gain.setTargetAtTime(this.settings.master, this.ctx.currentTime, 0.1);
        this.sfxGain.gain.setTargetAtTime(this.settings.sfx, this.ctx.currentTime, 0.1);
        this.musicGain.gain.setTargetAtTime(this.settings.music, this.ctx.currentTime, 0.1);
    }

    setVolume(type, value) {
        this.settings[type] = parseFloat(value);
        this.updateVolumes();
    }

    // --- SFX ---

    playLaser(type = 'standard') {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        if (type === 'standard') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        } else if (type === 'heavy') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        } else if (type === 'singularity') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        }
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playExplosion(size = 'small') {
        this.init();
        const duration = size === 'large' ? 0.8 : 0.3;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(size === 'large' ? 1000 : 500, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(size === 'large' ? 0.5 : 0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        noise.start();
        noise.stop(this.ctx.currentTime + duration);
    }

    playHit() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playPowerUp() {
        this.init();
        const now = this.ctx.currentTime;
        const notes = [440, 554, 659, 880];
        notes.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + i * 0.05);
            gain.gain.setValueAtTime(0, now + i * 0.05);
            gain.gain.linearRampToValueAtTime(0.2, now + i * 0.05 + 0.02);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.05 + 0.05);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.05);
        });
    }

    // --- Dynamic Music ---

    startMusic() {
        this.init();
        if (this.musicInterval) return;
        this.updateMusicLoop();
    }

    updateMusicLoop() {
        if (this.musicInterval) clearInterval(this.musicInterval);
        
        const tempo = this.musicState === 'boss' ? 145 : (this.musicState === 'danger' ? 130 : 120);
        const stepDuration = 60 / tempo / 4;
        let step = 0;
        
        const bassLines = {
            normal: [55, 55, 65, 49, 55, 55, 65, 73],
            boss: [41, 41, 46, 38, 41, 41, 46, 55],
            danger: [55, 55, 55, 55, 65, 65, 65, 65]
        };
        
        const activeLine = bassLines[this.musicState];
        
        this.musicInterval = setInterval(() => {
            if (this.ctx.state !== 'running') return;
            const note = activeLine[step % activeLine.length];
            this.playMusicNote(note, stepDuration, 'sine', 0.1);
            if (step % 4 === 0) this.playMusicNote(note / 2, stepDuration * 2, 'square', 0.05);
            step++;
        }, stepDuration * 1000);
    }

    setMusicState(state) {
        if (this.musicState === state) return;
        this.musicState = state;
        this.updateMusicLoop();
    }

    stopMusic() {
        clearInterval(this.musicInterval);
        this.musicInterval = null;
    }

    playMusicNote(freq, duration, type, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}

const audio = new AudioController();
