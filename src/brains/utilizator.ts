import type { Brain } from '../types';

const g = globalThis as any;

const utilizator: Brain & Record<string, any> = {

    name: 'UtilizatoR',
    kind: g.kinds.miner,
    author: 'macMini',
    description: "Smart bot hunting only for the target with the biggest amount of bullets.",

    bot: {},

    message: null as string | null,
    target: null as any,
    checkHealthTimestamp: Date.now(),

    previoiusBulletCount: 1,

    // BOT ACTIONS
    idleBot: function () {
        if (this.bot.lives < g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet && this.bot.energy >= g.eatBulletEnergyCost && this.bot.bullets > 0) {
            this.message = this.bot.lives + ' HP. Now healing.';
            return this.eatBot();
        } else {
            let params: any = undefined;
            if (this.message) {
                params = {
                    message: this.message
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
                message: this.message ? this.message : undefined
            }
        };
    },
    rotateBot: function (clockwise: boolean) {
        return {
            do: g.actions.rotate,
            params: {
                clockwise: clockwise,
                message: this.message ? this.message : undefined
            }
        };
    },
    turnBot: function (angle: number) {
        return {
            do: g.actions.turn,
            params: {
                angle: angle,
                message: this.message ? this.message : undefined
            }
        };
    },
    jumpBot: function (angle: number) {
        return {
            do: g.actions.jump,
            params: {
                angle: angle,
                message: this.message ? this.message : undefined
            }
        };
    },
    shootBot: function () {
        let params: any = undefined;
        if (this.message) {
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

        if (message) {
            message += '\nRecovering.';
        } else {
            message = 'Recovering.';
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
        const now = Date.now();

        if (this.bot.bullets == this.previoiusBulletCount + 1) {
            this.message = 'Found bullet';
            this.idleBot();
        }
        this.previoiusBulletCount = this.bot.bullets;


        if ((now - this.checkHealthTimestamp) / 1000 > 30) {
            this.checkHealthTimestamp = now;
            this.message = 'Alert! Checking health...';
            return this.idleBot();
        }

        const target = this.findTarget(enemies);
        if (target) {
            const distance = g.distanceBetween(this.bot, target);
            if ((distance < 400 && this.bot.bullets >= 1) || this.bot.bullets >= g.creatureMaxBullets[this.bot.level]) {
                return this.prepareAttack(target);
            }
        }

        const goToBulletIfNeeded = this.goToBullet(bullets);
        if (goToBulletIfNeeded) {
            return goToBulletIfNeeded;
        } else {
            return this.idleBot();
        }
    },

    prepareAttack: function (target: any) {

        const angle = g.angleBetween(this.bot, target);
        const distance = g.distanceBetween(this.bot, target);

        if (this.bot.energy < g.shotEnergyCost) {
            this.message = 'Charging...' + Math.floor(this.bot.energy) + '/' + g.shotEnergyCost + '%';
            return this.idleBot();
        }
        if (distance <= 430 && g.rayBetween(this.bot, target)) {
            const d = Math.abs(g.differenceBetweenAngles(this.bot.angle, angle));
            const b = Math.PI / 35.0;
            if (d < b) {
                this.message = target.name + ', you must be utilized!';
                return this.shootBot();
            } else {
                return this.turnBot(angle);
            }
        } else {
            this.message = target.name + ', I will find you!';
            return this.moveBot(angle);
        }
    },

    findTarget: function (enemies: any[]) {
        let target: any = null;
        let temp = 0;
        enemies.forEach((e: any) => {
            if (e.bullets > temp) {
                temp = e.bullets;
                target = e;
            }
        });
        return target;
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
            if (g.rayBetween(this.bot, bullet) && d < temp) {
                targetBullet = bullet;
                temp = d;
            }
        });
        return targetBullet;
    },

    goToBullet: function (bullets: any[]) {
        const saveBullet = this.findBullet(bullets);
        if (saveBullet && this.bot.bullets < g.creatureMaxBullets[this.bot.level]) {
            const angle = g.angleBetween(this.bot, saveBullet);
            return this.moveBot(angle);
        } else {
            return null;
        }
    }
};

export default utilizator;
