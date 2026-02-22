import type { Brain } from '../types';

const g = globalThis as any;

const niloultet: Brain & Record<string, any> = {

    name: 'nil-oultet',
    kind: g.kinds.sprayer,
    author: 'Andrey',
    description: "Tactical bot. He controls selected sector.",

    bot: {},

    onPosition: true,
    onPositionTimestamp: null as number | null,
    movingToPosition: false,
    movingToCenter: true,
    onCenter: false,
    positionIndex: 0,
    previousPosition: null as number | null,

    timeInSector: 30,

    lastBulletTakeTimestamp: Date.now(),

    message: null as string | null,
    silentMode: false,
    silentModeTimestamp: Date.now(),

    lateGame: false,

    tacticMap: {

        near: 400,

        center: {
            x: g.ground.width / 2,
            y: g.ground.height / 2
        },

        sectors: [{
            x: g.ground.width / 4,
            y: g.ground.height / 4,
            width: g.ground.width / 2,
            height: g.ground.height / 2,
            position: {
                x: 65,
                y: 65
            }
        },
        {
            x: g.ground.width / 2 + g.ground.width / 4,
            y: g.ground.height / 4,
            width: g.ground.width / 2,
            height: g.ground.height / 2,
            position: {
                x: g.ground.width - 65,
                y: 65
            }
        },
        {
            x: g.ground.width / 4,
            y: g.ground.height / 2 + g.ground.height / 4,
            width: g.ground.width / 2,
            height: g.ground.height / 2,
            position: {
                x: 65,
                y: g.ground.height - 65
            }
        },
        {
            x: g.ground.width / 2 + g.ground.width / 4,
            y: g.ground.height / 2 + g.ground.height / 4,
            width: g.ground.width / 2,
            height: g.ground.height / 2,
            position: {
                x: g.ground.width - 65,
                y: g.ground.height - 65
            }
        }
        ],
    },

    // BOT ACTIONS

    idleBot: function () {
        if (this.bot.lives < g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet && this.bot.energy >= g.eatBulletEnergyCost && this.bot.bullets > 0) {
            return this.eatBot();
        } else {
            let params: any = undefined;
            let message = 'Report: Do nothing.';
            if (this.message) {
                message = this.message;
            }
            if (!this.silentMode) {
                params = {
                    message: message
                };
            }
            return {
                do: g.actions.none,
                params: params
            };
        }
    },
    moveBot: function (angle: number) {
        return {
            do: g.actions.move,
            params: {
                angle: angle,
                message: !this.silentMode && this.message ? this.message : undefined
            }
        };
    },
    rotateBot: function (clockwise: boolean) {
        return {
            do: g.actions.rotate,
            params: {
                clockwise: clockwise,
                message: !this.silentMode && this.message ? this.message : undefined
            }
        };
    },
    turnBot: function (angle: number) {
        return {
            do: g.actions.turn,
            params: {
                angle: angle,
                message: !this.silentMode && this.message ? this.message : undefined
            }
        };
    },
    jumpBot: function (angle: number) {
        return {
            do: g.actions.jump,
            params: {
                angle: angle,
                message: !this.silentMode && this.message ? this.message : undefined
            }
        };
    },
    shootBot: function () {
        let params: any = undefined;
        if (!this.silentMode && this.message) {
            params = {
                message: this.message
            };
        }
        return {
            do: g.actions.shoot,
            params: params
        };
    },

    eatBot: function () {
        let message = this.message;
        if (this.silentMode) {
            message = undefined;
        } else {
            if (message) {
                message += '\nReport: Healed.';
            } else {
                message = 'Report: Healed.';
            }
        }

        return {
            do: g.actions.eat,
            params: {
                message: message
            }
        };
    },

    // MAIN Think about it
    thinkAboutIt: function (self, enemies, bullets, objects, events) {
        this.bot = self;
        this.message = null;

        if (bullets.length < 12) {
            return this.earlyGame(enemies, bullets, objects, events);
        } else {
            const doLateGame = this.lateGameFn(enemies, bullets, objects, events);
            if (!this.lateGame) {
                this.message = 'Status: Late Game.';
                this.lateGame = true;
            }
            return doLateGame;
        }

    },

    // EARLY GAME
    earlyGame: function (enemies: any[], bullets: any[], objects: any[], events: any[]) {
        if (this.movingToCenter) {
            return this.goToCenter();
        } else {
            const target = this.findNearest(enemies);
            if (target && this.bot.bullets > 0 && g.distanceBetween(this.bot, target) <= 450) {
                return this.prepareAttack(target);
            }

            const goToBulletIfNeeded = this.goToBullet(bullets);
            if (goToBulletIfNeeded) {
                return goToBulletIfNeeded;
            }

            return this.detectMode(enemies);
        }
    },

    // LATE GAME
    lateGameFn: function (enemies: any[], bullets: any[], objects: any[], events: any[]) {
        const now = Date.now();

        if (!this.lateGame) {
            this.movingToCenter = true;
        }

        if (this.movingToCenter) {
            return this.goToCenter();
        } else if (this.onCenter) {
            this.positionIndex = this.detectBullets(bullets);
            this.onCenter = false;
            this.movingToPosition = true;
            return this.idleBot();
        } else if (this.movingToPosition) {
            const position = this.tacticMap.sectors[this.positionIndex].position;
            return this.goToPosition(position);
        } else if (this.onPosition) {
            const positionTimeDelta = (now - this.onPositionTimestamp) / 1000;

            const goToBulletIfNeeded = this.goToBullet(bullets, true);
            const position = this.tacticMap.sectors[this.positionIndex].position;
            const farFromPosition = this.checkNotOnPosition(position);

            const nearBulletsCount = this.getNearBulletsCount(bullets);

            const sectorEnemies = this.findEnemiesInSector(enemies);
            if (!sectorEnemies) {
                if (this.bot.lives <= g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet && this.bot.bullets > 0) {
                    return this.eatBot();
                } else if (goToBulletIfNeeded) {
                    return goToBulletIfNeeded;
                } else if (farFromPosition) {
                    return this.goToPosition(position, true);
                } else if (positionTimeDelta > this.timeInSector) {
                    if (nearBulletsCount < 2) {
                        this.onPositionTimestamp = null;
                        this.onPosition = false;
                        this.movingToCenter = true;
                        this.previousPosition = this.positionIndex;
                        return this.idleBot();
                    } else {
                        this.onPositionTimestamp = now;
                    }
                }
            }

            const weakTarget = this.findWeak(enemies);
            if (weakTarget && this.bot.bullets > 0) {
                return this.prepareAttack(weakTarget);
            }

            if (this.bot.lives <= g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet && this.bot.bullets > 0) {
                return this.eatBot();
            }

            if (positionTimeDelta > this.timeInSector) {
                if (nearBulletsCount < 2) {
                    this.onPositionTimestamp = null;
                    this.onPosition = false;
                    this.movingToCenter = true;
                    this.previousPosition = this.positionIndex;
                    return this.idleBot();
                } else {
                    this.onPositionTimestamp = now;
                }
            }

            const target = this.findTarget(enemies);
            if (target) {
                const targetDistance = g.distanceBetween(this.bot, target);
                if (targetDistance > 450) {
                    if (goToBulletIfNeeded) {
                        return goToBulletIfNeeded;
                    }
                } else if (this.bot.bullets > 0) {
                    return this.prepareAttack(target);
                }
            } else if (goToBulletIfNeeded) {
                return goToBulletIfNeeded;
            }


            if (farFromPosition) {
                return this.goToPosition(position, true);
            }

            return this.detectMode(enemies);
        } else {
            this.message = 'Report: No tactics.';
            return this.idleBot(enemies);
        }
    },

    // TACTIC FUNCTIONS

    checkNotOnPosition: function (position: any) {
        const wh = g.ground.width / 40,
            hh = g.ground.height / 40;
        return (this.bot.position.x < position.x - wh || this.bot.position.x > position.x + wh ||
            this.bot.position.y < position.y - hh || this.bot.position.y > position.y + hh);
    },

    goToPosition: function (position: any, ignoreTimestampt?: boolean) {
        if (this.checkNotOnPosition(position)) {
            const angle = g.angleBetweenPoints(this.bot.position, position);
            this.message = "Report: I'm on my way(" + position.x + ':' + position.y + ').';
            return this.moveBot(angle);
        } else {
            if (!ignoreTimestampt) {
                this.onPositionTimestamp = Date.now();
            }
            this.onPosition = true;
            this.movingToPosition = false;
            this.message = "Report: I'm on position(" + position.x + ':' + position.y + ').';
            return this.idleBot();
        }
    },

    goToCenter: function () {
        const wh = g.ground.width / 40,
            hh = g.ground.height / 40;

        const center = this.tacticMap.center;

        if (this.bot.position.x < center.x - wh || this.bot.position.x > center.x + wh ||
            this.bot.position.y < center.y - hh || this.bot.position.y > center.y + hh) {
            const angle = g.angleBetweenPoints(this.bot.position, center);
            this.message = "Report: I'm going to center.";
            return this.moveBot(angle);
        } else {
            this.movingToCenter = false;
            this.onCenter = true;
            this.message = "Report: I'm on center.";
            return this.idleBot();
        }
    },

    detectBullets: function (bullets: any[]) {
        let detected = [0, 0, 0, 0];
        const delta = 200;
        bullets.forEach((bullet: any) => {
            if (bullet.position.x >= 0 && bullet.position.x <= delta && bullet.position.y >= 0 && bullet.position.y <= delta) {
                detected[0] += 1;
            } else if (bullet.position.x >= g.ground.width - delta && bullet.position.y >= 0 && bullet.position.y <= delta) {
                detected[1] += 1;
            } else if (bullet.position.x >= 0 && bullet.position.x <= delta && bullet.position.y >= g.ground.height - delta) {
                detected[2] += 1;
            } else if (bullet.position.x >= g.ground.width - delta && bullet.position.y >= g.ground.height - delta) {
                detected[3] += 1;
            }
        });

        let sector = 0;
        let count = 0;

        for (var i = 0; i < 4; i++) {
            if (detected[i] > count) {
                count = detected[i];
                sector = i;
            }
        }
        return sector;
    },

    findNearest: function (enemies: any[]) {
        let target: any = null;
        let temp = g.ground.width + g.ground.height;

        enemies.forEach((e: any) => {
            const dist = g.distanceBetween(this.bot, e);
            if (dist < temp && g.rayBetween(this.bot, e)) {
                temp = dist;
                target = e;
            }
        });
        return target;
    },

    findEnemiesInSector: function (enemies: any[]) {
        let sectorEnemies: any[] = [];
        const b = 60;
        enemies.forEach((e: any) => {
            if (this.positionIndex == 0 && e.position.x >= 0 && e.position.x < this.tacticMap.center.x - b && e.position.y >= 0 && e.position.y < this.tacticMap.center.y - b) {
                sectorEnemies.push(e);
            } else if (this.positionIndex == 1 && e.position.x > this.tacticMap.center.x + b && e.position.y >= 0 && e.position.y < this.tacticMap.center.y - b) {
                sectorEnemies.push(e);
            } else if (this.positionIndex == 2 && e.position.x >= 0 && e.position.x < this.tacticMap.center.x - b && e.position.y > this.tacticMap.center.y + b) {
                sectorEnemies.push(e);
            } else if (this.positionIndex == 3 && e.position.x > this.tacticMap.center.x + b && e.position.y > this.tacticMap.center.y + b) {
                sectorEnemies.push(e);
            }
        });
        return sectorEnemies.length > 0 ? sectorEnemies : null;
    },

    findWeak: function (enemies: any[]) {
        let enemiesInSector = this.findEnemiesInSector(enemies);
        if (!enemiesInSector) {
            return null;
        }
        let target: any = null;
        enemiesInSector.forEach((e: any) => {
            if (e.lives > 0 && e.lives <= this.bot.bullets * g.bulletDamage) {
                target = e;
            }
        });
        return target;
    },

    findTarget: function (enemies: any[]) {

        let enemiesInSector = this.findEnemiesInSector(enemies);
        if (!enemiesInSector) {
            return null;
        }
        let target: any = null;
        let enemyHealth = g.creatureMaxLives[2];
        enemiesInSector.forEach((e: any) => {
            if (e.lives < enemyHealth && g.rayBetween(this.bot, e)) {
                enemyHealth = e.lives;
                target = e;
            }
        });
        return target;
    },

    prepareAttack: function (target: any) {

        const angle = g.angleBetween(this.bot, target);
        const distance = g.distanceBetween(this.bot, target);

        const d = Math.abs(g.differenceBetweenAngles(this.bot.angle, angle));
        const b = Math.PI / 35.0;

        if (this.bot.energy < g.shotEnergyCost) {
            this.message = 'Target: ' + target.name + '.\nReport: Low energy.';
            return this.idleBot();
        }
        if (distance > 450) {
            if (d < b) {
                this.message = 'Target: ' + target.name + '.\nStatus: Too far.';
                return this.idleBot();
            } else {
                this.message = 'Target: ' + target.name + '.\nReport: Turning.';
                return this.turnBot(angle);
            }
        } else {
            this.message = 'Target: ' + target.name + '.\nReport: Attacking.';
            if (d < b) {
                return this.shootBot();
            } else {
                return this.turnBot(angle);
            }
        }
    },

    findBullet: function (bullets: any[], inSector?: boolean) {
        const safeBullets = bullets.filter((bullet: any) => {
            return !bullet.dangerous;
        });
        if (safeBullets.length < 1) {
            return null;
        }
        let targetBullet: any;
        let temp = g.ground.width + g.ground.height;

        safeBullets.forEach((bullet: any) => {
            let d = g.distanceBetween(this.bot, bullet);
            if (g.rayBetween(this.bot, bullet) && d < temp && (!inSector || d < 200)) {
                targetBullet = bullet;
                temp = d;
            }
        });
        return targetBullet;
    },

    detectMode: function (enemies: any[]) {
        let suspiciousArray: any[] = [];
        let suspicious: any = null;
        let temp = g.ground.width + g.ground.height;
        const b = Math.PI / 20.0;

        enemies.forEach((e: any) => {
            let dist = g.distanceBetween(this.bot, e);
            const angle = g.angleBetween(e, this.bot);
            const d = Math.abs(g.differenceBetweenAngles(e.angle, angle));
            if (g.rayBetween(this.bot, e) && e.bullets > 0 && dist < temp && d < b && dist < 500) {
                suspiciousArray.push(e);
                suspicious = e;
                temp = d;
            }
        });

        if (suspiciousArray.length < 1) {
            this.message = 'Report: Sector clear.';
            return this.idleBot();
        }

        const angle = g.angleBetween(suspicious, this.bot);
        const d = Math.abs(g.differenceBetweenAngles(suspicious.angle, angle));
        if (d < b) {
            if (d > Math.PI) {
                this.message = 'Target: ' + suspicious.name + '.\nStatus: Aggresive.';
                return this.moveBot(suspicious.angle - Math.PI / 2.0);
            } else {
                this.message = 'Target: ' + suspicious.name + '.\nStatus: Dangerous.';
                return this.moveBot(suspicious.angle + Math.PI / 2.0);
            }
        }
        this.message = 'Target: ' + suspicious.name + '.\nStatus: Suspicious.';
        return this.idleBot();
    },

    goToBullet: function (bullets: any[], inSector?: boolean) {
        const saveBullet = this.findBullet(bullets, inSector);
        if (saveBullet && this.bot.bullets < g.creatureMaxBullets[this.bot.level]) {
            this.message = 'Target: ' + saveBullet.id + '.\nStatus: Bullet.';
            const angle = g.angleBetween(this.bot, saveBullet);
            return this.moveBot(angle);
        } else {
            return null;
        }
    },

    getNearBulletsCount: function (bullets: any[]) {
        const nearZone = {
            minX: this.bot.position.x - this.tacticMap.near / 4,
            maxX: this.bot.position.x + this.tacticMap.near / 4,
            minY: this.bot.position.y - this.tacticMap.near / 4,
            maxY: this.bot.position.y + this.tacticMap.near / 4,
        };
        let bulletsCount = 0;

        bullets.forEach((bullet: any) => {
            if (g.rayBetween(this.bot, bullet) &&
                bullet.position.x >= nearZone.minX && bullet.position.x <= nearZone.maxX &&
                bullet.position.y >= nearZone.minY && bullet.position.y <= nearZone.maxY
            ) {
                bulletsCount += 1;
            }
        });
        return bulletsCount;
    },
};

export default niloultet;
