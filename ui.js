class UIController {
    constructor(game) {
        this.game = game;

        this.hud = {
            score: document.getElementById('score-value'),
            level: document.getElementById('level-value'),
            wave: document.getElementById('wave-value'),
            xpFill: document.getElementById('xp-bar-fill'),
            healthFill: document.getElementById('health-bar-fill'),
            healthText: document.getElementById('health-text'),
            comboMult: document.getElementById('combo-multiplier'),
            comboCont: document.getElementById('combo-container')
        };

        this.bossHud = {
            container: document.getElementById('boss-hud'),
            name: document.getElementById('boss-name'),
            fill: document.getElementById('boss-bar-fill')
        };

        this.abilityIcons = {
            dash: document.getElementById('dash-cd'),
            chronos: document.getElementById('chronos-cd'),
            pulse: document.getElementById('pulse-cd')
        };

        this.damageFlash = document.getElementById('damage-flash');

        this.menus = {
            main: document.getElementById('main-menu'),
            upgrade: document.getElementById('upgrade-menu'),
            pause: document.getElementById('pause-menu'),
            gameOver: document.getElementById('game-over'),
            settings: document.getElementById('settings-menu'),
            meta: document.getElementById('meta-upgrades-menu')
        };

        this.createNotificationSystem();
        this.initEventListeners();
    }

    createNotificationSystem() {
        this.notifContainer = document.createElement('div');
        this.notifContainer.id = 'notif-container';
        this.notifContainer.style.cssText = `
            position: absolute;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        `;
        document.getElementById('game-container').appendChild(this.notifContainer);
    }

    notify(text, color = '#00f2ff') {
        const el = document.createElement('div');
        el.style.cssText = `
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            font-size: 1.5rem;
            color: ${color};
            text-shadow: 0 0 10px ${color};
            animation: notifFade 2s forwards;
            text-align: center;
        `;
        el.innerText = text;
        this.notifContainer.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }

    initEventListeners() {
        document.getElementById('start-btn').onclick = () => this.startGame();
        document.getElementById('settings-btn').onclick = () => this.showMenu('settings');
        document.getElementById('upgrades-btn').onclick = () => {
            this.renderMetaUpgrades();
            this.showMenu('meta');
        };
        document.getElementById('close-settings-btn').onclick = () => this.showMenu('main');
        document.getElementById('close-meta-btn').onclick = () => this.showMenu('main');
        document.getElementById('resume-btn').onclick = () => this.resumeGame();
        document.getElementById('restart-btn').onclick = () => this.restartGame();
        document.getElementById('quit-btn').onclick = () => this.quitToMenu();
        document.getElementById('retry-btn').onclick = () => this.restartGame();
        document.getElementById('menu-btn').onclick = () => this.quitToMenu();
        document.getElementById('volume-slider').oninput = (e) => audio.setVolume('master', e.target.value);
        document.getElementById('sfx-slider').oninput = (e) => audio.setVolume('sfx', e.target.value);
        document.getElementById('music-slider').oninput = (e) => audio.setVolume('music', e.target.value);
    }

    showMenu(menuKey) {
        Object.values(this.menus).forEach(m => m.classList.add('hidden'));
        if (menuKey) this.menus[menuKey].classList.remove('hidden');
    }

    startGame() {
        this.showMenu(null);
        document.getElementById('hud').classList.remove('hidden');
        this.game.start();
    }

    resumeGame() {
        this.showMenu(null);
        this.game.paused = false;
    }

    restartGame() {
        this.showMenu(null);
        this.game.reset();
        this.game.start();
    }

    quitToMenu() {
        this.showMenu('main');
        this.game.reset();
    }

    updateHUD() {
        const p = this.game.player;
        this.hud.score.innerText = Math.floor(this.game.score);
        this.hud.level.innerText = p.level;
        this.hud.wave.innerText = this.game.wave;
        this.hud.xpFill.style.width = `${(p.xp / p.xpNextLevel) * 100}%`;
        
        // Updated to show Lives instead of HP bar
        this.hud.healthFill.style.width = `${(p.lives / p.maxLives) * 100}%`;
        this.hud.healthText.innerText = `LIVES: ${p.lives} / ${p.maxLives}`;

        if (this.game.combo > 1) {
            this.hud.comboCont.classList.remove('hidden');
            this.hud.comboMult.innerText = `x${this.game.combo}`;
        } else {
            this.hud.comboCont.classList.add('hidden');
        }

        this.updateAbilityCooldowns(p);
        this.updateBossHUD();
        this.updateDamageFlash(p);
    }

    updateAbilityCooldowns(p) {
        const dashPct = p.dashTimer > 0 ? (p.dashTimer / p.dashCooldown) * 100 : 0;
        const chronosPct = p.chronosTimer > 0 ? (p.chronosTimer / p.chronosCooldown) * 100 : 0;
        const pulsePct = p.pulseTimer > 0 ? (p.pulseTimer / p.pulseCooldown) * 100 : 0;

        this.abilityIcons.dash.classList.toggle('on-cooldown', dashPct > 0);
        this.abilityIcons.chronos.classList.toggle('on-cooldown', chronosPct > 0);
        this.abilityIcons.pulse.classList.toggle('on-cooldown', pulsePct > 0);

        this.abilityIcons.dash.style.setProperty('--cd-pct', `${dashPct}%`);
        this.abilityIcons.chronos.style.setProperty('--cd-pct', `${chronosPct}%`);
        this.abilityIcons.pulse.style.setProperty('--cd-pct', `${pulsePct}%`);
    }

    updateBossHUD() {
        const boss = this.game.entities.find(e => e instanceof Boss);
        if (boss && !boss.markedForDeletion) {
            this.bossHud.container.classList.remove('hidden');
            this.bossHud.name.innerText = boss.name || 'BOSS';
            const pct = Math.max(0, (boss.health / boss.maxHealth) * 100);
            this.bossHud.fill.style.width = `${pct}%`;
        } else {
            this.bossHud.container.classList.add('hidden');
        }
    }

    updateDamageFlash(p) {
        if (p.damageFlash > 0) {
            this.damageFlash.classList.add('active');
            this.damageFlash.style.background = `rgba(255, 0, 0, ${p.damageFlash * 3})`;
        } else {
            this.damageFlash.classList.remove('active');
        }
    }

    triggerUpgrade() {
        this.game.paused = true;
        this.showMenu('upgrade');
        const optionsCont = document.getElementById('upgrade-options');
        optionsCont.innerHTML = '';
        const selected = [...UPGRADES].sort(() => 0.5 - Math.random()).slice(0, 3);
        selected.forEach(upg => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `<h3>${upg.name}</h3><p>${upg.desc}</p>`;
            card.onclick = () => {
                this.game.player.pickedUpgrades.push(upg.id);
                upg.effect(this.game.player);
                this.checkSynergies();
                this.resumeGame();
            };
            optionsCont.appendChild(card);
        });
    }

    checkSynergies() {
        const p = this.game.player;
        const upgrades = p.pickedUpgrades;

        if (upgrades.includes('proj_count') && upgrades.includes('black_hole')) {
            if (!p.synergies.includes('HYPER_VORTEX')) {
                p.synergies.push('HYPER_VORTEX');
                this.notify('SYNERGY UNLOCKED: HYPER VORTEX', '#ff00ff');
            }
        }

        if (upgrades.includes('pierce') && upgrades.includes('proj_spread')) {
            if (!p.synergies.includes('HYPER_Scythe')) {
                p.synergies.push('HYPER_Scythe');
                this.notify('SYNERGY UNLOCKED: HYPER SCYTHE', '#39ff14');
            }
        }

        if (upgrades.includes('max_health') && upgrades.includes('regen')) {
            if (!p.synergies.includes('HYPER_Sustain')) {
                p.synergies.push('HYPER_Sustain');
                this.notify('SYNERGY UNLOCKED: HYPER SUSTAIN', '#00f2ff');
            }
        }
    }

    showGameOver() {
        this.showMenu('gameOver');
        document.getElementById('final-score').innerText = Math.floor(this.game.score);
        document.getElementById('final-waves').innerText = this.game.wave;
        document.getElementById('final-level').innerText = this.game.player.level;
        const scraps = document.getElementById('scraps-earned');
        const earned = Math.floor(this.game.score / 50);
        scraps.innerHTML = `DATA SCRAPS EARNED: <span style="color:#39ff14">+${earned}</span>`;
    }

    renderMetaUpgrades() {
        const cont = document.getElementById('meta-upgrade-list');
        const currencyDisplay = document.getElementById('meta-currency');
        cont.innerHTML = '';
        currencyDisplay.innerText = this.game.metaCurrency;
        META_UPGRADES.forEach(upg => {
            const level = this.game.metaProgress[upg.id] || 0;
            const cost = Math.floor(upg.cost * Math.pow(1.5, level));
            const card = document.createElement('div');
            card.className = 'meta-card';
            card.innerHTML = `
                <h4>${upg.name}</h4>
                <p>${upg.desc}</p>
                <div class="meta-cost">COST: ${cost} DATA</div>
                <div class="meta-lvl">LVL: ${level}/${upg.maxLvl}</div>
                <button class="meta-btn" ${(this.game.metaCurrency < cost || level >= upg.maxLvl) ? 'disabled' : ''}>UPGRADE</button>
            `;
            card.querySelector('.meta-btn').onclick = () => {
                if (this.game.metaCurrency >= cost && level < upg.maxLvl) {
                    this.game.metaCurrency -= cost;
                    this.game.metaProgress[upg.id] = level + 1;
                    upg.effect(this.game);
                    localStorage.setItem('neon_void_currency', this.game.metaCurrency);
                    localStorage.setItem('neon_void_progress', JSON.stringify(this.game.metaProgress));
                    this.renderMetaUpgrades();
                }
            };
            cont.appendChild(card);
        });
    }
}
