/**
 * Entities
 * Defines all game objects: Player, Enemies, Bullets, Particles, Orbitals, DamageNumbers, Asteroids, PowerUps.
 */

class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.markedForDeletion = false;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update(dt) {}
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15, '#00f2ff');
        this.speed = 250;
        this.maxHealth = 100;
        this.health = 100;
        this.level = 1;
        this.xp = 0;
        this.xpNextLevel = 100;
        
        this.fireRate = 0.3;
        this.fireTimer = 0;
        this.bulletDamage = 10;
        this.bulletSpeed = 700;
        this.bulletRadius = 4;
        this.projCount = 1;
        this.projSpread = 0;
        this.pierce = 1;
        this.critChance = 0.05;
        this.critMult = 2;
        this.orbitals = 0;
        this.orbitalDamage = 15;
        this.orbitalRadius = 100;
        
        this.dashCooldown = 2.0;
        this.dashTimer = 0;
        this.dashDuration = 0.15;
        this.dashActive = 0;
        this.isDashing = false;
        this.regen = 0;
        this.hasSingularity = false;

        // Temp Power-ups
        this.tempOverdrive = 0;
        this.tempShield = 0;
    }

    update(dt, input, game) {
        if (this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + this.regen * dt);
        }

        if (this.tempOverdrive > 0) this.tempOverdrive -= dt;
        if (this.tempShield > 0) this.tempShield -= dt;

        this.dashTimer -= dt;
        if (this.dashActive > 0) {
            this.dashActive -= dt;
            this.isDashing = true;
        } else {
            this.isDashing = false;
        }

        let dx = 0, dy = 0;
        if (input.keys['KeyW'] || input.keys['ArrowUp']) dy -= 1;
        if (input.keys['KeyS'] || input.keys['ArrowDown']) dy += 1;
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) dx -= 1;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) dx += 1;
        if (input.joystick) { dx = input.joystick.x; dy = input.joystick.y; }

        if ((input.keys['Space'] || input.keys['ShiftLeft']) && this.dashTimer <= 0) {
            this.dashActive = this.dashDuration;
            this.dashTimer = this.dashCooldown;
            audio.playLaser('heavy');
            game.createExplosion(this.x, this.y, this.color);
        }

        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            const currentSpeed = this.isDashing ? this.speed * 3 : this.speed;
            this.x += (dx / length) * currentSpeed * dt;
            this.y += (dy / length) * currentSpeed * dt;
        }

        this.x = Math.max(this.radius, Math.min(game.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(game.height - this.radius, this.y));

        this.fireTimer -= dt;
        const effectiveFireRate = this.tempOverdrive > 0 ? this.fireRate * 0.4 : this.fireRate;
        if (this.fireTimer <= 0) {
            this.shoot(game);
            this.fireTimer = effectiveFireRate;
        }
    }

    shoot(game) {
        const angle = Math.atan2(game.input.mouseY - this.y, game.input.mouseX - this.x);
        for (let i = 0; i < this.projCount; i++) {
            const spread = this.projSpread * (i - (this.projCount - 1) / 2);
            const finalAngle = angle + spread;
            game.entities.push(new Bullet(this.x, this.y, finalAngle, this.bulletSpeed, this.bulletDamage, this.bulletRadius, this.color, this.pierce, true, this.hasSingularity));
        }
        audio.playLaser(this.tempOverdrive > 0 ? 'heavy' : 'standard');
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const angle = Math.atan2(game.input.mouseY - this.y, game.input.mouseX - this.x);
        ctx.rotate(angle);
        
        if (this.tempShield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.shadowBlur = this.isDashing ? 30 : 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.5, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fillStyle = this.tempOverdrive > 0 ? '#ff00ff' : this.color;
        ctx.fill();
        ctx.restore();
    }

    takeDamage(amount) {
        if (this.tempShield > 0) {
            this.tempShield -= amount * 0.5;
            return false;
        }
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            return true;
        }
        return false;
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.xpNextLevel) {
            this.xp -= this.xpNextLevel;
            this.level++;
            this.xpNextLevel = Math.floor(this.xpNextLevel * 1.2);
            return true;
        }
        return false;
    }
}

class Bullet extends Entity {
    constructor(x, y, angle, speed, damage, radius, color, pierce, isPlayer, singularity) {
        super(x, y, radius, color);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.pierce = pierce;
        this.isPlayer = isPlayer;
        this.singularity = singularity;
        this.life = 3.0;
    }

    update(dt, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.singularity) {
            const enemies = game.entities.filter(e => e instanceof Enemy);
            for (const enemy of enemies) {
                const dx = this.x - enemy.x;
                const dy = this.y - enemy.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 40000) {
                    const dist = Math.sqrt(distSq);
                    const force = 60 / (dist + 1);
                    enemy.x += (dx / dist) * force * dt * -1;
                    enemy.y += (dy / dist) * force * dt * -1;
                }
            }
        }
        if (this.life <= 0 || this.x < -50 || this.x > game.width + 50 || this.y < -50 || this.y > game.height + 50) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = this.singularity ? 20 : 10;
        ctx.shadowColor = this.singularity ? '#ff00ff' : this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.singularity ? '#ff00ff' : this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, type, wave) {
        const configs = {
            swarmer: { radius: 10, color: '#ff00cc', health: 10, speed: 130, damage: 5, xp: 10, score: 10, shield: 0 },
            tank: { radius: 22, color: '#ff3131', health: 80, speed: 60, damage: 15, xp: 40, score: 50, shield: 50 },
            shooter: { radius: 15, color: '#ffff00', health: 30, speed: 90, damage: 10, xp: 25, score: 30, shield: 0 },
            splitter: { radius: 18, color: '#39ff14', health: 50, speed: 80, damage: 10, xp: 30, score: 40, shield: 0 },
            charger: { radius: 12, color: '#00ffff', health: 25, speed: 200, damage: 20, xp: 20, score: 20, shield: 0 },
            vortex: { radius: 20, color: '#8800ff', health: 60, speed: 70, damage: 10, xp: 30, score: 40, shield: 0 },
            mirage: { radius: 15, color: '#ffffff', health: 30, speed: 110, damage: 15, xp: 30, score: 40, shield: 0 }
        };
        
        const config = configs[type];
        super(x, y, config.radius, config.color);
        this.type = type;
        this.health = config.health + (wave * 5);
        this.maxHealth = this.health;
        this.speed = config.speed;
        this.damage = config.damage;
        this.xp = config.xp;
        this.score = config.score;
        this.shield = config.shield + (wave * 2);
        this.fireTimer = 0;
        this.fireRate = type === 'shooter' ? 2.0 : 0;
        this.teleportTimer = 0;
    }

    update(dt, game) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (this.type === 'vortex') {
            if (dist < 200) {
                const force = 100 / (dist + 1);
                game.player.x -= (dx / dist) * force * dt;
                game.player.y -= (dy / dist) * force * dt;
            }
        }

        if (this.type === 'mirage') {
            this.teleportTimer -= dt;
            if (this.teleportTimer <= 0) {
                this.x += (Math.random() - 0.5) * 200;
                this.y += (Math.random() - 0.5) * 200;
                this.teleportTimer = 3 + Math.random() * 2;
                game.createExplosion(this.x, this.y, '#fff');
            }
        }

        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;

        if (this.type === 'shooter') {
            this.fireTimer -= dt;
            if (this.fireTimer <= 0 && dist < 450) {
                const angle = Math.atan2(dy, dx);
                game.entities.push(new Bullet(this.x, this.y, angle, 350, this.damage, 4, this.color, 1, false));
                this.fireTimer = this.fireRate;
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.markedForDeletion = true;
            return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        if (this.shield > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.beginPath();
        if (this.type === 'tank') ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        else if (this.type === 'shooter') {
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.lineTo(this.x - this.radius, this.y + this.radius);
            ctx.closePath();
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        }
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Boss extends Enemy {
    constructor(x, y, wave, name = 'VOID REAPER') {
        super(x, y, 'tank', wave);
        this.name = name;
        this.type = 'boss';
        this.radius = 70;
        this.color = '#ff00ff';
        this.health = 1000 + (wave * 400);
        this.maxHealth = this.health;
        this.speed = 50;
        this.score = 5000;
        this.xp = 2000;
        this.phase = 0;
        this.phaseTimer = 0;
        this.shield = 1000 + (wave * 200);
        this.attackCooldown = 0;
    }

    update(dt, game) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
        
        this.phaseTimer += dt;
        this.attackCooldown -= dt;
        if (this.phaseTimer > 6) {
            this.phase = (this.phase + 1) % 4;
            this.phaseTimer = 0;
        }
        
        if (this.attackCooldown <= 0) {
            this.executePhaseAttack(game, dx, dy, dist);
            this.attackCooldown = this.getAttackCooldown();
        }
    }

    getAttackCooldown() {
        const cooldowns = [1.5, 1.0, 0.8, 2.0];
        return cooldowns[this.phase];
    }

    executePhaseAttack(game, dx, dy, dist) {
        const angle = Math.atan2(dy, dx);
        if (this.phase === 0) { // Nova Burst
            for (let i = 0; i < 24; i++) {
                const a = (i / 24) * Math.PI * 2;
                game.entities.push(new Bullet(this.x, this.y, a, 200, 15, 6, this.color, 1, false));
            }
            game.shake = 10;
        } else if (this.phase === 1) { // Sniper Stream
            for (let i = -2; i <= 2; i++) {
                game.entities.push(new Bullet(this.x, this.y, angle + i * 0.1, 500, 10, 4, this.color, 1, false));
            }
        } else if (this.phase === 2) { // Chaos Rain
            for (let i = 0; i < 10; i++) {
                const a = Math.random() * Math.PI * 2;
                game.entities.push(new Bullet(this.x, this.y, a, 300, 12, 5, this.color, 1, false));
            }
        } else { // Vortex Pull
            const enemies = game.entities.filter(e => e instanceof Enemy); // Not needed but for logic
            // Pull player towards boss
            game.player.x += (dx / dist) * 50;
            game.player.y += (dy / dist) * 50;
            game.createExplosion(this.x, this.y, this.color);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.color;
        if (this.shield > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 20, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Orbital extends Entity {
    constructor(x, y, player) {
        super(x, y, 6, '#00f2ff');
        this.player = player;
        this.angle = Math.random() * Math.PI * 2;
        this.orbitSpeed = 3;
        this.damage = player.orbitalDamage;
    }

    update(dt, game) {
        this.angle += this.orbitSpeed * dt;
        this.x = this.player.x + Math.cos(this.angle) * this.player.orbitalRadius;
        this.y = this.player.y + Math.sin(this.angle) * this.player.orbitalRadius;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Asteroid extends Entity {
    constructor(x, y, radius) {
        super(x, y, radius, '#444');
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 50 + 20;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.health = radius * 2;
        this.color = '#555';
    }

    update(dt, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < -100 || this.x > game.width + 100 || this.y < -100 || this.y > game.height + 100) {
            this.markedForDeletion = true;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.markedForDeletion = true;
            return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class PowerUp extends Entity {
    constructor(x, y, type) {
        const configs = {
            overdrive: { color: '#ff00ff', label: 'O' },
            shield: { color: '#00f2ff', label: 'S' }
        };
        super(x, y, 12, configs[type].color);
        this.type = type;
        this.label = configs[type].label;
        this.life = 10.0;
    }

    update(dt, game) {
        this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.x, this.y);
        ctx.restore();
    }
}

class Particle extends Entity {
    constructor(x, y, color) {
        super(x, y, Math.random() * 3 + 1, color);
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = Math.random() * 0.6 + 0.2;
        this.maxLife = this.life;
        this.friction = 0.94;
    }

    update(dt, game) {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class DamageNumber extends Entity {
    constructor(x, y, text, isCrit, color = '#aaa') {
        super(x, y, 0, color);
        this.text = text;
        this.isCrit = isCrit;
        this.vy = -80 - Math.random() * 40;
        this.vx = (Math.random() - 0.5) * 40;
        this.life = 0.8;
        this.maxLife = this.life;
    }

    update(dt, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.font = this.isCrit ? 'bold 20px Orbitron' : '14px Rajdhani';
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.shadowBlur = this.isCrit ? 10 : 0;
        ctx.shadowColor = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class Nebula extends Entity {
    constructor(x, y, radius, color) {
        super(x, y, radius, color);
        this.opacity = Math.random() * 0.2 + 0.1;
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
        ctx.restore();
    }
}
