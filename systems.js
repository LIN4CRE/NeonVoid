const Systems = {
    handleCollisions(game) {
        const entities = game.entities;
        const player = game.player;

        const enemies = entities.filter(e => e instanceof Enemy);
        const bullets = entities.filter(e => e instanceof Bullet);
        const orbitals = entities.filter(e => e instanceof Orbital);
        const asteroids = entities.filter(e => e instanceof Asteroid);
        const powerUps = entities.filter(e => e instanceof PowerUp);
        const blackHoles = entities.filter(e => e instanceof BlackHole);

        for (const bullet of bullets) {
            if (bullet.markedForDeletion) continue;
            for (const enemy of enemies) {
                if (enemy.markedForDeletion) continue;
                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < Math.pow(bullet.radius + enemy.radius, 2)) {
                    this.hitEnemy(bullet, enemy, game);
                    if (bullet.pierce <= 0) bullet.markedForDeletion = true;
                    break;
                }
            }
            for (const asteroid of asteroids) {
                if (asteroid.markedForDeletion) continue;
                const dx = bullet.x - asteroid.x;
                const dy = bullet.y - asteroid.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < Math.pow(bullet.radius + asteroid.radius, 2)) {
                    asteroid.takeDamage(bullet.damage);
                    bullet.markedForDeletion = true;
                    break;
                }
            }
        }

        for (const orbital of orbitals) {
            for (const enemy of enemies) {
                if (enemy.markedForDeletion) continue;
                const dx = orbital.x - enemy.x;
                const dy = orbital.y - enemy.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < Math.pow(orbital.radius + enemy.radius, 2)) {
                    this.hitEnemy({ damage: orbital.damage, isPlayer: true, pierce: 999, x: orbital.x, y: orbital.y }, enemy, game);
                }
            }
        }

        for (const entity of entities) {
            if (entity.markedForDeletion) continue;
            const dx = entity.x - player.x;
            const dy = entity.y - player.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < Math.pow(entity.radius + player.radius, 2)) {
                if (entity instanceof Enemy) {
                    this.resolvePlayerCollision(entity, player, game);
                } else if (entity instanceof Asteroid) {
                    if (!player.isDashing) {
                        player.takeDamage(20);
                        game.shake = 20;
                        audio.playHit();
                        entity.markedForDeletion = true;
                        game.createExplosion(entity.x, entity.y, entity.color);
                    }
                } else if (entity instanceof PowerUp) {
                    this.applyPowerUp(entity, player, game);
                } else if (entity instanceof BlackHole) {
                    if (!player.isDashing) {
                        player.takeDamage(50);
                        game.shake = 30;
                        audio.playExplosion('large');
                    }
                }
            }
        }
    },

    resolvePlayerCollision(enemy, player, game) {
        if (player.isDashing) return;
        if (player.takeDamage(enemy.damage * 0.1)) {
            game.gameOver();
        }
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        player.x += Math.cos(angle) * 30;
        player.y += Math.sin(angle) * 30;
        game.shake = 15;
        audio.playHit();
        game.createParticle(player.x, player.y, '#fff', 3);
    },

    applyPowerUp(powerUp, player, game) {
        audio.playPowerUp();
        if (powerUp.type === 'overdrive') {
            player.tempOverdrive = 8.0;
            game.ui.notify('OVERDRIVE ACTIVE!', '#ff00ff');
        } else if (powerUp.type === 'shield') {
            player.tempShield = 10.0;
            game.ui.notify('SHIELD ACTIVATED!', '#00f2ff');
        }
        powerUp.markedForDeletion = true;
    },

    hitEnemy(bullet, enemy, game) {
        let damage = bullet.damage;

        if (game.player.synergies.includes('HYPER_Scythe') && bullet.pierce > 1) {
            damage *= 1.3;
        }

        if (enemy.shield > 0) {
            enemy.shield -= damage;
            damage = 0;
            game.createDamageNumber(enemy.x, enemy.y, 'SHIELD', false, '#00f2ff');
            if (enemy.shield <= 0) {
                game.createExplosion(enemy.x, enemy.y, '#00f2ff');
                audio.playHit();
            }
        }
        if (damage > 0) {
            if (Math.random() < game.player.critChance) {
                damage *= game.player.critMult;
                game.createDamageNumber(enemy.x, enemy.y, Math.floor(damage), true);
            } else {
                game.createDamageNumber(enemy.x, enemy.y, Math.floor(damage), false);
            }
            if (enemy.takeDamage(damage)) {
                game.score += enemy.score * game.comboMultiplier;
                game.combo += 1;
                game.comboTimer = 2.0;
                if (playerGainXp(game, enemy.xp)) {
                    game.triggerUpgrade();
                }
                game.createExplosion(enemy.x, enemy.y, enemy.color);
                audio.playExplosion(enemy instanceof Boss ? 'large' : 'small');
                if (Math.random() < 0.1) {
                    const type = Math.random() < 0.5 ? 'overdrive' : 'shield';
                    game.entities.push(new PowerUp(enemy.x, enemy.y, type));
                }
            } else {
                audio.playHit();
                game.createParticle(bullet.x, bullet.y, enemy.color, 2);
            }
        }
    }
};

function playerGainXp(game, amount) {
    return game.player.gainXp(amount * game.xpMultiplier);
}

const UPGRADES = [
    { id: 'fire_rate', name: 'Overclocked Cores', desc: 'Attack speed +15%', effect: (p) => p.fireRate *= 0.85, tier: 1 },
    { id: 'damage', name: 'Plasma Surge', desc: 'Bullet damage +20%', effect: (p) => p.bulletDamage *= 1.2, tier: 1 },
    { id: 'proj_count', name: 'Multi-Shot', desc: 'Add an additional projectile', effect: (p) => p.projCount += 1, tier: 1 },
    { id: 'proj_spread', name: 'Wide Angle', desc: 'Increase projectile spread', effect: (p) => p.projSpread += 0.12, tier: 1 },
    { id: 'speed', name: 'Warp Drive', desc: 'Movement speed +10%', effect: (p) => p.speed *= 1.1, tier: 1 },
    { id: 'pierce', name: 'Phase Rounds', desc: 'Bullets pierce +1 enemy', effect: (p) => p.pierce += 1, tier: 1 },
    { id: 'crit_chance', name: 'Precision Targeting', desc: 'Crit chance +5%', effect: (p) => p.critChance += 0.05, tier: 1 },
    { id: 'crit_mult', name: 'High-Impact Slugs', desc: 'Crit multiplier +0.5x', effect: (p) => p.critMult += 0.5, tier: 1 },
    { id: 'max_health', name: 'Nano-Armor', desc: 'Max health +20% & full heal', effect: (p) => { p.maxHealth *= 1.2; p.health = p.maxHealth; }, tier: 1 },
    { id: 'orbitals', name: 'Sentry Drones', desc: 'Deploy an orbiting defense drone', effect: (p) => p.orbitals += 1, tier: 1 },
    { id: 'dash_cd', name: 'Phase Shift', desc: 'Reduce dash cooldown by 15%', effect: (p) => p.dashCooldown *= 0.85, tier: 1 },
    { id: 'regen', name: 'Bio-Link', desc: 'Regenerate 1 HP per second', effect: (p) => p.regen += 1, tier: 1 },
    { id: 'black_hole', name: 'Singularity Shot', desc: 'Bullets pull enemies slightly', effect: (p) => p.hasSingularity = true, tier: 2 },
    { id: 'chronos', name: 'Chronos Field', desc: 'Active: Slow time for 3s (Press E)', effect: (p) => p.chronosCooldown *= 0.9, tier: 2 },
    { id: 'void_pulse', name: 'Void Pulse', desc: 'Active: Push enemies away (Press Q)', effect: (p) => p.pulseCooldown *= 0.9, tier: 2 },
];

const META_UPGRADES = [
    { id: 'meta_health', name: 'Reinforced Hull', desc: 'Start with +20 Max Health', cost: 100, maxLvl: 10, effect: (game) => { game.player.maxHealth += 20; game.player.health += 20; } },
    { id: 'meta_damage', name: 'Core Calibration', desc: 'Permanent +2 Damage', cost: 150, maxLvl: 10, effect: (game) => { game.player.bulletDamage += 2; } },
    { id: 'meta_speed', name: 'Tachyon Thrusters', desc: 'Permanent +5 Speed', cost: 120, maxLvl: 10, effect: (game) => { game.player.speed += 5; } },
    { id: 'meta_xp', name: 'Data Siphon', desc: 'Gain 10% more XP', cost: 200, maxLvl: 5, effect: (game) => { game.xpMultiplier += 0.1; } },
    { id: 'meta_crit', name: 'Neural Link', desc: 'Permanent +2% Crit Chance', cost: 180, maxLvl: 10, effect: (game) => { game.player.critChance += 0.02; } },
];
