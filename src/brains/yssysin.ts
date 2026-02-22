import type { Brain } from '../types';

const g = globalThis as any;

const yssysin: Brain & Record<string, any> = {

    name: 'YSSYSIN',
    kind: g.kinds.rhino,
    author: 'X-Ray',
    description: "Indiscriminate bot. He selects a random target and pursues it till death.",

    bot: {},

    message: null as string | null,
    target: null as any,
    targetKilledTimestamp: null as number | null,

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
            message += '\nFirst aid done';
        } else {
            message = 'First aid done';
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

        const goToBulletIfNeeded = this.goToBullet(bullets);

        if (this.target) {
            const exists = enemies.filter((e: any) => {
                return e.id == this.target.id;
            });
            if (!exists || exists.length < 1) {
                this.target = null;
                this.targetKilledTimestamp = now;
            }
        }
        if (this.targetKilledTimestamp) {
            if ((now - this.targetKilledTimestamp) / 1000 > 7) {
                this.targetKilledTimestamp = null;
            } else {
                this.message = 'Washing blood';
                return this.idleBot();
            }
        }

        if (!this.target) {
            if (enemies.length < 2) {
                this.message = "Who's next?";
                return this.idleBot();
            } else {
                const index = g.randomInt(0, enemies.length - 1);
                this.target = enemies[index];
                this.message = this.target.name + ', you are my target!';
            }
        }

        const distance = g.distanceBetween(this.bot, this.target);
        if ((distance < 300 && this.bot.bullets >= 1) || this.bot.bullets >= g.creatureMaxBullets[this.bot.level]) {
            return this.prepareAttack(this.target);
        } else if (goToBulletIfNeeded) {
            return goToBulletIfNeeded;
        } else {
            return this.idleBot();
        }
    },

    prepareAttack: function (target: any) {

        const angle = g.angleBetween(this.bot, target);
        const distance = g.distanceBetween(this.bot, target);

        if (this.bot.energy < g.shotEnergyCost) {
            this.message = 'Prepare to attack';
            return this.idleBot();
        }
        if (distance <= 320 && g.rayBetween(this.bot, target)) {
            const d = Math.abs(g.differenceBetweenAngles(this.bot.angle, angle));
            const b = Math.PI / 35.0;
            this.message = 'Killing ' + target.name;
            if (d < b) {
                return this.shootBot();
            } else {
                return this.turnBot(angle);
            }
        } else {
            return this.moveBot(angle);
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

export default yssysin;
