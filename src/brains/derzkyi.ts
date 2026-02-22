import type { Brain } from '../types';

const g = globalThis as any;

const derzkyi: Brain & Record<string, any> = {

    name: '\u0414\u0415\u0420\u0417\u041A\u0418\u0419',
    kind: g.kinds.bull,
    author: '\u041D\u0415\u0418\u0417\u0412\u0415\u0421\u0422\u0415\u041D',
    description: "Cool russian guy from neighborhood",

    bot: {},

    message: null as string | null,
    target: null as any,
    checkHealthTimestamp: Date.now(),

    previoiusBulletCount: 1,

    // BOT ACTIONS
    idleBot: function () {
        if (this.bot.lives < g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet && this.bot.energy >= g.eatBulletEnergyCost && this.bot.bullets > 0) {
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
            message += '\n\u0417\u0430 \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435!';
        } else {
            message = '\u0417\u0430 \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435!';
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
            this.message = '\u041E\u043F\u0430, \u0447\u0438\u0440\u0438\u043A \u0438 \u043F\u0443\u043B\u044C\u043A\u0430!';
            this.idleBot();
        }
        this.previoiusBulletCount = this.bot.bullets;


        if ((now - this.checkHealthTimestamp) / 1000 > 30) {
            this.checkHealthTimestamp = now;
            this.message = '\u041D\u0430\u0434\u043E \u043F\u043E\u0434\u043A\u0430\u0447\u0430\u0442\u044C\u0441\u044F';
            return this.idleBot();
        }

        const target = this.findTarget(enemies);
        if (target) {
            const distance = g.distanceBetween(this.bot, target);
            if ((distance < 300 && this.bot.bullets >= 1) || this.bot.bullets >= g.creatureMaxBullets[this.bot.level]) {
                return this.prepareAttack(target);
            }
        }

        const goToBulletIfNeeded = this.goToBullet(bullets);
        if (goToBulletIfNeeded) {
            return goToBulletIfNeeded;
        } else {
            this.message = '\u0427\u0435\u0442 \u0441\u043A\u0443\u0447\u043D\u043E';
            return this.idleBot();
        }
    },

    prepareAttack: function (target: any) {

        const angle = g.angleBetween(this.bot, target);
        const distance = g.distanceBetween(this.bot, target);

        if (this.bot.energy < g.shotEnergyCost) {
            this.message = '\u0429\u0430 \u0431\u044B\u043A\u0430\u043D\u0443!';
            return this.idleBot();
        }
        if (distance <= 430 && g.rayBetween(this.bot, target)) {
            const d = Math.abs(g.differenceBetweenAngles(this.bot.angle, angle));
            const b = Math.PI / 35.0;
            if (d < b) {
                this.message = target.name + ', \u043B\u043E\u0432\u0438 \u0434\u0432\u043E\u0435\u0447\u043A\u0443!';
                return this.shootBot();
            } else {
                this.message = target.name + ', \u043B\u0443\u0447\u0448\u0435 \u0431\u0435\u0433\u0438!';
                return this.turnBot(angle);
            }
        } else {
            this.message = target.name + ', \u0442\u044B \u0447\u0435, \u043A\u0443\u0434\u0430 \u0441\u043B\u0438\u0432\u0430\u0435\u0448\u044C\u0441\u044F?';
            return this.moveBot(angle);
        }
    },

    findTarget: function (enemies: any[]) {
        let target: any = null;
        let temp = 0;
        enemies.forEach((e: any) => {
            if (e.lives > temp) {
                temp = e.lives;
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

export default derzkyi;
