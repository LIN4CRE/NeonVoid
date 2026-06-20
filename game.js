class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;

        this.player = null;
        this.entities = [];
        this.input = { keys: {}, mouseX: 0, mouseY: 0, joystick: null };

        this.score = 0;
        this.wave = 1;
        this.combo = 1;
        this.comboTimer = 0;
        this.comboMultiplier = 1;

        this.paused = true;
        this.running = false;
        this.shake = 0;

        this.spawnTimer = 0;
        this.asteroidTimer = 0;
        this.hazardTimer = 0;
        this.enemiesInWave = 0;
        this.waveMaxEnemies = 10;
        this.isBossWave = false;

        this.metaCurrency = parseInt(localStorage.getItem('neon_void_currency')) || 0;
        this.metaProgress = JSON.parse(localStorage.getItem('neon_void_progress')) || {};
        this.xpMultiplier = 1.0;

        this.nebulae = [];
        this.stardust = [];

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', (e) => this.input.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.input.keys[e.code] = false);
        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.input.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.input.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        });
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (!this.running && this.paused) return;
                this.paused = !this.paused;
                if (this.paused) ui.showMenu('pause');
                else ui.resumeGame();
            }
        });

        this.initMobileControls();
        this.ui = new UIController(this);
        window.game = this;
        requestAnimationFrame((t) => this.loop(t));
    }

    initMobileControls() {
        const controls = document.getElementById('mobile-controls');
        const joystickBase = document.getElementById('joystick-base');
        const joystickStick = document.getElementById('joystick-stick');
        const dashBtn = document.getElementById('mobile-dash-btn');
        const chronosBtn = document.getElementById('mobile-chronos-btn');
        const pauseBtn = document.getElementById('mobile-pause-btn');

        const handleTouch = () => {
            if (window.innerWidth < 1024) controls.classList.remove('hidden');
            else controls.classList.add('hidden');
        };
        window.addEventListener('resize', handleTouch);
        handleTouch();

        let isJoystickActive = false;
        const moveJoystick = (e) => {
            if (!isJoystickActive) return;
            const touch = e.touches[0];
            const rect = joystickBase.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const tx = touch.clientX - (rect.left + centerX);
            const ty = touch.clientY - (rect.top + centerY);
            const dist = Math.sqrt(tx * tx + ty * ty);
            const maxDist = 50;
            const limitedX = dist > maxDist ? (tx / dist) * maxDist : tx;
            const limitedY = dist > maxDist ? (ty / dist) * maxDist : ty;
            joystickStick.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
            this.input.joystick = { x: limitedX / maxDist, y: limitedY / maxDist };
        };

        joystickBase.addEventListener('touchstart', (e) => {
            isJoystickActive = true;
            moveJoystick(e);
        });

        window.addEventListener('touchmove', moveJoystick);
        window.addEventListener('touchend', () => {
            isJoystickActive = false;
            joystickStick.style.transform = `translate(0,0)`;
            this.input.joystick = null;
        });

        dashBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.input.keys['Space'] = true;
            setTimeout(() => this.input.keys['Space'] = false, 100);
        });

        chronosBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.input.keys['KeyE'] = true;
            setTimeout(() => this.input.keys['KeyE'] = false, 100);
        });

        pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.running && this.paused) return;
            this.paused = !this.paused;
            if (this.paused) this.ui.showMenu('pause');
            else this.ui.resumeGame();
        });
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.generateNebulae();
        this.generateStardust();
    }

    generateNebulae() {
        this.nebulae = [];
        const colors = ['rgba(0, 242, 255, 0.15)', 'rgba(255, 0, 204, 0.15)', 'rgba(57, 255, 20, 0.12)', 'rgba(255, 255, 0, 0.12)'];
        for (let i = 0; i < 8; i++) {
            this.nebulae.push(new Nebula(
                Math.random() * this.width,
                Math.random() * this.height,
                Math.random() * 300 + 200,
                colors[Math.floor(Math.random() * colors.length)]
            ));
        }
    }

    generateStardust() {
        this.stardust = [];
        for (let i = 0; i < 100; i++) {
            this.stardust.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.8 + 0.2
            });
        }
    }

    reset() {
        this.player = new Player(this.width / 2, this.height / 2);
        this.entities = [];
        this.score = 0;
        this.wave = 1;
        this.combo = 1;
        this.comboMultiplier = 1;
        this.enemiesInWave = 0;
        this.waveMaxEnemies = 10;
        this.isBossWave = false;
        this.xpMultiplier = 1.0;
        META_UPGRADES.forEach(upg => {
            const lvl = this.metaProgress[upg.id] || 0;
            for (let i = 0; i < lvl; i++) upg.effect(this);
        });
    }

    start() {
        this.running = true;
        this.paused = false;
        this.reset();
        audio.startMusic();
        audio.setMusicState('normal');
        this.ui.notify('SYSTEMS ONLINE. SURVIVE.', '#00f2ff');
    }

    gameOver() {
        this.running = false;
        this.paused = true;
        const salvaged = Math.floor(this.score / 50);
        this.metaCurrency += salvaged;
        localStorage.setItem('neon_void_currency', this.metaCurrency);
        localStorage.setItem('neon_void_progress', JSON.stringify(this.metaProgress));
        audio.stopMusic();
        this.ui.showGameOver();
    }

    triggerUpgrade() {
        this.ui.triggerUpgrade();
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            this.entities.push(new Particle(x, y, color));
        }
    }

    createParticle(x, y, color, count = 1) {
        for (let i = 0; i < count; i++) {
            this.entities.push(new Particle(x, y, color));
        }
    }

    createDamageNumber(x, y, text, isCrit, color = '#aaa') {
        this.entities.push(new DamageNumber(x, y, text, isCrit, color));
    }

    spawnEnemy() {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = Math.random() * this.width; y = -50; }
        else if (edge === 1) { x = this.width + 50; y = Math.random() * this.height; }
        else if (edge === 2) { x = Math.random() * this.width; y = this.height + 50; }
        else { x = -50; y = Math.random() * this.height; }

        let type = 'swarmer';
        const r = Math.random();
        if (this.wave > 2 && r < 0.2) type = 'shooter';
        if (this.wave > 4 && r < 0.4) type = 'tank';
        if (this.wave > 6 && r < 0.6) type = 'splitter';
        if (this.wave > 8 && r < 0.8) type = 'charger';
        if (this.wave > 12 && r < 0.3) type = 'vortex';
        if (this.wave > 15 && r < 0.4) type = 'mirage';
        if (this.wave > 18 && r < 0.3) type = 'hive';
        if (this.wave > 20 && r < 0.3) type = 'siphoner';
        if (this.wave > 22 && r < 0.3) type = 'shifter';

        this.entities.push(new Enemy(x, y, type, this.wave));
        this.enemiesInWave++;
    }

    spawnAsteroid() {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = Math.random() * this.width; y = -50; }
        else if (edge === 1) { x = this.width + 50; y = Math.random() * this.height; }
        else if (edge === 2) { x = Math.random() * this.width; y = this.height + 50; }
        else { x = -50; y = Math.random() * this.height; }
        const radius = Math.random() * 20 + 20;
        this.entities.push(new Asteroid(x, y, radius));
    }

    spawnBlackHole() {
        this.entities.push(new BlackHole(Math.random() * this.width, Math.random() * this.height, 40));
        this.ui.notify('GRAVITATIONAL ANOMALY DETECTED', '#ff00ff');
    }

    spawnBoss() {
        const names = ['VOID REAPER', 'NEON TITAN', 'CYBER CORE', 'THE SINGULARITY', 'AETHER LORD'];
        const name = names[Math.floor(this.wave / 10) % names.length];

        if (this.wave >= 30) {
            this.entities.push(new SingularityCore(this.width / 2, -100, this.wave));
        } else {
            this.entities.push(new Boss(this.width / 2, -100, this.wave, name));
        }

        this.ui.notify(`WARNING: ${name} DETECTED`, '#ff00ff');
        audio.setMusicState('boss');
    }

    update(dt) {
        if (this.paused || !this.running) return;

        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
            this.combo = 1;
            this.comboMultiplier = 1;
        } else {
            this.comboMultiplier = 1 + Math.floor(this.combo / 10) * 0.5;
        }

        this.player.update(dt, this.input, this);

        const currentOrbitals = this.entities.filter(e => e instanceof Orbital).length;
        if (currentOrbitals < this.player.orbitals) {
            for (let i = 0; i < this.player.orbitals - currentOrbitals; i++) {
                this.entities.push(new Orbital(this.player.x, this.player.y, this.player));
            }
        }

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.enemiesInWave < this.waveMaxEnemies && !this.isBossWave) {
            this.spawnEnemy();
            this.spawnTimer = Math.max(0.3, 1.5 - (this.wave * 0.05));
        }

        this.asteroidTimer -= dt;
        if (this.asteroidTimer <= 0) {
            this.spawnAsteroid();
            this.asteroidTimer = Math.max(2, 5 - (this.wave * 0.1));
        }

        this.hazardTimer -= dt;
        if (this.hazardTimer <= 0 && this.wave > 5) {
            this.spawnBlackHole();
            this.hazardTimer = Math.max(15, 30 - (this.wave * 0.5));
        }

        if (this.enemiesInWave >= this.waveMaxEnemies && this.entities.filter(e => e instanceof Enemy && !(e instanceof Boss)).length === 0 && !this.isBossWave) {
            this.wave++;
            this.enemiesInWave = 0;
            this.waveMaxEnemies += 4;
            if (this.wave % 10 === 0) {
                this.isBossWave = true;
                this.spawnBoss();
            } else {
                this.ui.notify(`WAVE ${this.wave} START`, '#00f2ff');
            }
        }

        const boss = this.entities.find(e => e instanceof Boss);
        if (this.isBossWave && !boss) {
            this.isBossWave = false;
            this.wave++;
            this.enemiesInWave = 0;
            audio.setMusicState('normal');
            this.ui.notify('BOSS NEUTRALIZED', '#39ff14');
        }

        this.entities.forEach(e => e.update(dt, this));
        this.entities = this.entities.filter(e => !e.markedForDeletion);
        Systems.handleCollisions(this);
        if (this.shake > 0) this.shake -= dt * 10;
        this.ui.updateHUD();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.save();
        if (this.shake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        }

        this.ctx.fillStyle = '#fff';
        this.stardust.forEach(s => {
            this.ctx.globalAlpha = s.opacity;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        this.nebulae.forEach(n => n.draw(this.ctx));
        this.drawGrid();
        if (this.player) this.player.draw(this.ctx);
        this.entities.forEach(e => e.draw(this.ctx));
        this.ctx.restore();
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.07)';
        this.ctx.lineWidth = 1;
        const spacing = 60;
        const offsetX = (this.player ? this.player.x : 0) % spacing;
        const offsetY = (this.player ? this.player.y : 0) % spacing;
        this.ctx.beginPath();
        for (let x = -offsetX; x < this.width; x += spacing) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
        }
        for (let y = -offsetY; y < this.height; y += spacing) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
        }
        this.ctx.stroke();
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        this.update(Math.min(dt, 0.1));
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

const game = new Game();
const ui = game.ui;
