import type { Brain } from '../types';

const g = globalThis as any;

const helltrain: Brain & Record<string, any> = {

    name: 'Helltrain',
    kind: g.kinds.miner,
    author: 'Devil',
    description: "Demon from Hell.",

    bot: {},
    message: null as string | null,

    target: null as any,
    targetKilledTimestamp: null as number | null,
    killedName: null as string | null,

    hellrage: false,
    preparing: false,

    // BOT ACTIONS
    idleBot: function () {
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
        return {
            do: g.actions.eat,
            params: {
                message: this.message ? this.message : undefined
            }
        };
    },

    // MAIN Think about it
    thinkAboutIt: function (self, enemies, bullets, objects, events) {
        this.bot = self;
        this.message = null;
        const now = Date.now();

        const bulletSituation = this.getBulletsSituation(bullets);
        const goToBulletIfNeeded = this.goToNearestBullet(bulletSituation);
        const canHeal = this.checkCanHeal();


        if (this.target) {
            const check = this.checkTarget(enemies);
            if (check) {
                this.target = check;
            } else {
                this.killedName = this.target.name;
                this.target = null;
                this.targetKilledTimestamp = now;

                this.hellrage = false;
                this.preparing = false;
            }
        }
        if (this.targetKilledTimestamp) {
            if ((now - this.targetKilledTimestamp) / 1000 > 12) {
                this.targetKilledTimestamp = null;
                this.hellrage = false;
                this.target = null;
                this.preparing = false;
                return this.survive(enemies);
            } else {
                this.message = 'TOUCHDOWN!!!\nJUST SLAM ' + this.killedName;
                if (this.bot.lives < g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet) {
                    if (canHeal) {
                        this.message = 'JUST REPAIRED';
                        return this.eatBot();
                    } else if (goToBulletIfNeeded) {
                        return goToBulletIfNeeded;
                    } else {
                        return this.survive(enemies);
                    }
                }
            }
        }

        if (!this.target) {
            this.target = this.findTarget(enemies);
        }
        if (!this.target) {
            if (canHeal) {
                this.message = 'JUST REPAIRED';
                return this.eatBot();
            } else if (goToBulletIfNeeded) {
                return goToBulletIfNeeded;
            } else {
                return this.survive(enemies);
            }
        }

        if (this.hellrage) {

            if (this.bot.bullets > 0) {
                this.message = 'HELLRAGE';
                return this.prepareAttack(this.target, 320);
            } else if (bulletSituation && bulletSituation.nearest && g.distanceBetween(this.bot, bulletSituation.nearest) < 200) {
                return goToBulletIfNeeded;
            } else {
                this.hellrage = false;
                this.preparing = false;
                return this.idleBot();
            }
        } else if (this.preparing) {
            if (this.target.lives <= 2 * g.bulletDamage) {
                this.preparing = false;
                this.hellrage = true;
                return this.idleBot();
            } else if (this.target.lives > 4 * g.bulletDamage) {
                this.preparing = false;
                this.hellrage = false;
                return this.idleBot();
            }
            if (this.bot.lives < g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet) {
                if (canHeal) {
                    this.message = 'JUST REPAIRED';
                    return this.eatBot();
                } else if (goToBulletIfNeeded) {
                    return goToBulletIfNeeded;
                } else {
                    return this.survive(enemies);
                }
            }
            if (goToBulletIfNeeded) {
                return goToBulletIfNeeded;
            } else {
                this.message = "I'M READY " + this.target.name;
                return this.moveNearToTarget(270);
            }
        } else {
            if (this.target.lives > 0 && this.target.lives <= 2 * g.bulletDamage) {
                this.hellrage = true;
                this.preparing = false;
            } else if (this.target.lives > 2 * g.bulletDamage && this.target.lives <= 4 * g.bulletDamage) {
                this.preparing = true;
                this.hellrage = false;
            } else {
                if (this.bot.lives < g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet) {
                    if (canHeal) {
                        this.message = 'JUST REPAIRED';
                        return this.eatBot();
                    } else if (goToBulletIfNeeded) {
                        return goToBulletIfNeeded;
                    } else {
                        return this.survive(enemies);
                    }
                }

                const distance = g.distanceBetween(this.bot, this.target);
                if ((distance < 450 && this.bot.bullets >= 1) || this.bot.bullets >= g.creatureMaxBullets[this.bot.level]) {
                    return this.prepareAttack(this.target, 450);
                } else if (goToBulletIfNeeded) {
                    return goToBulletIfNeeded;
                } else {
                    return this.moveNearToTarget(270);
                }
            }
            return this.idleBot();
        }
    },

    findTarget: function (enemies: any[]) {
        let target: any = null;
        let deaths = Number.MAX_SAFE_INTEGER;
        enemies.forEach((e: any) => {
            if (e.deaths < deaths) {
                target = e;
                deaths = e.deaths;
            }
        });
        return target;
    },

    checkTarget: function (enemies: any[]) {
        const exists = enemies.filter((e: any) => {
            return e.id == this.target.id;
        });
        if (exists && exists.length > 0) {
            return exists[0];
        } else {
            return null;
        }
    },

    prepareAttack: function (target: any, shootDistance: number) {

        const angle = g.angleBetween(this.bot, target);
        const distance = g.distanceBetween(this.bot, target);

        if (this.bot.energy < g.shotEnergyCost) {
            return this.idleBot();
        }
        if (distance <= shootDistance && g.rayBetween(this.bot, target)) {
            const d = Math.abs(g.differenceBetweenAngles(this.bot.angle, angle));
            const b = Math.PI / 35.0;

            if (d < b) {
                return this.shootBot();
            } else {
                this.message = target.name + ", YOU AREN'T UNSTOPPABLE!";
                return this.turnBot(angle);
            }
        } else {
            this.message = this.message ? this.message + '\nCHOO-CHOO' : 'CHOO-CHOO';
            return this.moveBot(angle);
        }
    },

    moveToTarget: function () {
        const angle = g.angleBetween(this.bot, this.target);
        return this.moveBot(angle);
    },

    moveNearToTarget: function (shootDistance: number) {
        const distance = g.distanceBetween(this.bot, this.target);
        const angle = g.angleBetween(this.bot, this.target);
        if (distance < shootDistance) {
            return this.turnBot(angle);
        } else {
            return this.moveBot(angle);
        }
    },

    getBulletsSituation: function (bullets: any[]) {
        const safeBullets = bullets.filter((bullet: any) => {
            return !bullet.dangerous;
        });
        if (safeBullets.length < 1) {
            return null;
        }
        let resultBullets: any[] = [];
        let nearestBullet: any;
        let temp = g.ground.width + g.ground.height;

        safeBullets.forEach((bullet: any) => {
            if (g.rayBetween(this.bot, bullet)) {
                resultBullets.push(bullet);
                let d = g.distanceBetween(this.bot, bullet);
                if (d < temp) {
                    nearestBullet = bullet;
                    temp = d;
                }
            }
        });
        if (resultBullets.length > 0) {
            return {
                nearest: nearestBullet,
                bullets: resultBullets,
            };
        } else {
            return null;
        }
    },

    goToNearestBullet: function (bulletSituation: any) {
        if (bulletSituation && this.bot.bullets < g.creatureMaxBullets[this.bot.level]) {
            const angle = g.angleBetween(this.bot, bulletSituation.nearest);
            return this.moveBot(angle);
        } else {
            return null;
        }
    },

    checkCanHeal: function () {
        return this.bot.lives < g.creatureMaxLives[this.bot.level] - g.livesPerEatenBullet && this.bot.energy >= g.eatBulletEnergyCost && this.bot.bullets > 0;
    },

    survive: function (enemies: any[]) {
        let suspiciousArray: any[] = [];
        let suspicious: any = null;
        const b = Math.PI / 20.0;
        let temp = Math.PI / 20;

        enemies.forEach((e: any) => {
            let dist = g.distanceBetween(this.bot, e);
            const angle = g.angleBetween(e, this.bot);
            const d = Math.abs(g.differenceBetweenAngles(e.angle, angle));
            if (g.rayBetween(this.bot, e) && e.bullets > 0 && d < b && dist < 500) {
                suspiciousArray.push(e);
                if (d < temp) {
                    suspicious = e;
                    temp = d;
                }
            }
        });

        if (suspiciousArray.length < 1) {
            this.message = 'HELLZONE';
            return this.idleBot();
        }

        const angle = g.angleBetween(suspicious, this.bot);
        const d = Math.abs(g.differenceBetweenAngles(suspicious.angle, angle));
        if (d < b) {
            if (d > Math.PI) {
                return this.moveBot(suspicious.angle - Math.PI / 2.0);
            } else {
                return this.moveBot(suspicious.angle + Math.PI / 2.0);
            }
        }
        return this.idleBot();
    },
};

export default helltrain;
