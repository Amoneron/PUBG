import type { Brain } from '../types';

const g = globalThis as any;

const prosucc: Brain & Record<string, any> = {

    name: "ProSUCC",
    kind: g.kinds.sprayer,
    author: "Survs",
    description: "Meme machine",

    goForSucc: function (self: any, enemy: any) {
        if (g.distanceBetween(self, enemy) > g.vampireDistance) {
            let angle = g.angleBetween(self, enemy);
            return { do: g.actions.move, params: { angle: angle, message: "w8ing 4 SUCC" } };
        }
        else {
            return this.SUCC(self, enemy);
        }
    },

    doNothing: function () {
        return { do: g.actions.none };
    },

    SUCC: function (self: any, enemy: any) {
        if (self.energy >= g.vampireEnergyCost) {
            return { do: g.actions.spell, params: { target: enemy, message: "SUCC" } };
        }
        // else
        // {
        //     return {do: g.actions.none, params:{message:"NONONO"}};
        // }
    },

    rotate: function (self: any, msg: any) {
        return { do: g.actions.rotate, params: { clockwise: true, message: msg } };
    },

    goForBullet: function (self: any, bullet: any, msg: any) {
        let angle = g.angleBetween(self, bullet);
        return { do: g.actions.move, params: { angle: angle, message: msg } };
    },

    heal: function (self: any) {
        return { do: g.actions.eat };
    },

    shootEnemy: function (self: any, msg: any) {
        return { do: g.actions.shoot, params: { message: msg } };
    },

    turnToEnemy: function (self: any, enemy: any, msg: any) {
        let angle = g.angleBetween(self, enemy);
        let diff = g.differenceBetweenAngles(self.angle, angle);
        diff = diff / Math.abs(diff);
        return { do: g.actions.turn, params: { angle: angle + 0.1 * diff } };
    },


    thinkAboutIt: function (self, enemies, bullets, objects, events) {
        var msg_wounded = ["\u0417\u0410 \u0429\u041E\u041E\u041E", "Wow wow\r\nizi boi"];
        let msg: any;
        events.forEach((ev: any) => {
            if (ev.type == g.eventTypes.wound && ev.payload[0].name == self.name) {
                let rnd = g.randomInt(0, msg_wounded.length - 1);
                msg = msg_wounded[rnd];
            }
            if (ev.type == g.eventTypes.murder) {
                msg = "GET REKT\r\n" + ev.payload[0].name;
            }
            if (ev.type == g.eventTypes.death) {
                msg = "GET REKT\r\n" + ev.payload[0].name;
            }
        });
        const max = g.ground.width + g.ground.height;
        if (enemies.length == 0) {
            return this.doNothing();
        }
        let enemy = enemies[0],
            enemyDist = max;
        enemies.forEach((e: any) => {
            let dist = g.distanceBetween(self, e);
            if (dist < enemyDist) {
                enemyDist = dist;
                enemy = e;
            }
        });
        if (self.energy > g.eatBulletEnergyCost && self.lives < g.creatureMaxLives[self.level] * 0.66 && self.bullets > 0) {
            return this.heal(self);
        }
        if (self.level > 0 && self.lives > g.creatureMaxLives[self.level] / 2 && self.energy > g.vampireEnergyCost + 10) {
            return this.goForSucc(self, enemy);
        }
        if (self.bullets > 1 && ((self.energy > g.shotEnergyCost + 20 && self.level == 0) || self.energy > g.shotEnergyCost + 50) && self.lives > g.creatureMaxLives[self.level] * 0.5) {
            let flag = 0;
            enemies.forEach((e: any) => {
                if ((Math.abs(g.differenceBetweenAngles(self.angle, g.angleBetween(self, e))) < 0.15 && g.rayBetween(self, e) && g.distanceBetween(self, e) < 500.0) || (Math.abs(g.differenceBetweenAngles(self.angle, g.angleBetween(self, e))) < 0.3 && g.rayBetween(self, e) && g.distanceBetween(self, e) < 200.0)) {
                    flag = 1;
                }
            });
            if (flag == 1) {
                return this.shootEnemy(self, msg);
            }
        }
        let bullet: any;
        if (bullets.length > 0 && self.bullets < g.creatureMaxBullets[self.level]) {
            bullet = bullets[0];
            let distForBullet = 100000;
            bullets.forEach((bul: any) => {
                if (bul.dangerous == false) {
                    let myDist = g.distanceBetween(self, bul);
                    let enemDist = myDist + 1;
                    enemies.forEach((e: any) => {
                        let newEnemDist = g.distanceBetween(e, bul);
                        if (newEnemDist < enemDist) enemDist = newEnemDist;
                    });
                    if (myDist < enemDist && myDist < distForBullet) {
                        bullet = bul;
                        distForBullet = myDist;
                    }
                }
            });
            if (distForBullet != 100000) {
                return this.goForBullet(self, bullet, msg);
            }
        }
        return this.turnToEnemy(self, enemy, msg);
    }

};

export default prosucc;
