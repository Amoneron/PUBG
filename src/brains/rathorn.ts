import type { Brain } from '../types';

const g = globalThis as any;

// Module-scope state (was global in original)
let ratRun: boolean | undefined;
let ticksToRun: number = 50;
let ticksTillMoving: number = 50;
let ratMessage: string | undefined;
let ratSpam: number = 0;
let ratMessageSpam: number = 0;
let danger: any;
let distance: number;
let enemy: any;

const rathorn: Brain = {

    name: "RatHorn",
    kind: g.kinds.rhino,
    author: "BlackPeter",
    description: "The sleazy one. Waits for his opponents to run out of health just to deliver the final blow. Master of hit&run and runaway arts.",

    thinkAboutIt: function (self, enemies, bullets, objects, events) {

        const corners = [{ x: 70, y: g.ground.height - 70 }, { x: 70, y: 70 }, { x: g.ground.width - 70, y: 70 }, { x: g.ground.width - 70, y: g.ground.height - 70 }];

        const max = g.ground.width + g.ground.height;
        let height = g.ground.height;
        let width = g.ground.width;
        let safeBullet: any, dangerousBullet: any,
            safeBulletDist = max,
            dangerousBulletDist = max,
            center = {
                x: g.ground.width / 2,
                y: g.ground.height / 2
            };
        if (typeof ratRun == "undefined") {
            ticksTillMoving = 50;
            ratRun = false;
            ratMessage = undefined;
            ratSpam = 0;
            ratMessageSpam = 0;
        }


        if (ratMessage && ratMessageSpam === 0) {
            ratMessageSpam = 20;
        } else if (ratMessage && ratMessageSpam === 1) {
            ratMessageSpam--;
            ratMessage = undefined;
        } else if (ratMessageSpam > 0) {
            ratMessageSpam--;
        }

        events.forEach((event: any) => {
            if (event.type == 1) {
                if (event.payload[0].id == self.id) {
                    ratMessage = "Easy kill, " + event.payload[1].name;
                }
            }
        });

        let doShooty = function (params: any) {
            params.message = ratMessage ? ratMessage : params.message;
            return {
                do: g.actions.shoot,
                params: params
            };
        };

        let doMove = function (params: any) {
            params.message = ratMessage ? ratMessage : params.message;
            return {
                do: g.actions.move,
                params: params
            };
        };

        let doEatan = function (params: any) {
            params.message = ratMessage ? ratMessage : params.message;
            return {
                do: g.actions.eat,
                params: params
            };
        };

        let doRotate = function (params: any) {
            params.message = ratMessage ? ratMessage : params.message;
            return {
                do: g.actions.rotate,
                params: params
            };
        };

        let doNothing = function (params: any) {
            params.message = ratMessage ? ratMessage : params.message;
            return {
                do: g.actions.none,
                params: params
            };
        };

        let doJumpy = function (params: any) {
            params.message = ratMessage ? ratMessage : params.message;
            return {
                do: g.actions.jump,
                params: params
            };
        };

        let doTurn = function (params: any) {
            params.message = ratMessage ? ratMessage : params.message;
            return {
                do: g.actions.turn,
                params: params
            };
        };

        let shootAtEnemy = function (enemy: any, backlash: number) {
            let directionAngle = g.angleBetween(self, enemy);
            let diff = Math.abs(g.differenceBetweenAngles(self.angle, directionAngle));
            if (!g.rayBetween(self, enemy)) {
                return doMove({
                    angle: directionAngle,
                    message: "You can run, but you can't hide."
                });
            }
            if (diff < backlash) {
                if (g.distanceBetween(self, enemy) > 300) {
                    return doMove({
                        angle: directionAngle
                    });
                }
                let killMessage: string | null = null;
                if (enemy.name.length >= 6) {
                    killMessage = enemy.name + "? More like Dead" + enemy.name.substring(enemy.name.length / 2, enemy.name.length);
                }
                else {
                    killMessage = "You are dead, " + enemy.name;
                }
                return doShooty({
                    message: killMessage
                });
            } else {
                if (g.distanceBetween(self, enemy) < 300) {
                    return doTurn({
                        angle: directionAngle
                    });
                }
                return doMove({
                    angle: directionAngle,
                    message: "How are you, " + (enemy as any).name + "?"
                });
            }
        };

        let hitAndRun = function (): any {
            // Find nearest enemy
            let enemy = enemies[0],
                enemyDist = max;
            enemies.forEach((e: any) => {
                let dist = g.distanceBetween(self, e);
                if (dist < enemyDist) {
                    enemyDist = dist;
                    enemy = e;
                }
            });
            let directionAngle = g.angleBetween(self, enemy);

            let backlash = Math.PI / 50.0;

            if (g.distanceBetween(self, enemy) < 200) {
                backlash = backlash * 3;
            }

            // Check enough energy for hunting
            if (self.energy > g.shotEnergyCost + 10) {
                let diff = Math.abs(g.differenceBetweenAngles(self.angle, directionAngle));
                if (diff < backlash) {
                    if (g.distanceBetween(self, enemy) > 300) {
                        return doMove({
                            angle: directionAngle,
                            message: "Crawling in the dark..."
                        });
                    }
                    ratRun = true;
                    danger = enemy;
                    ticksToRun = 15;
                    return doShooty({});
                } else {
                    if (g.distanceBetween(self, enemy) < 300 && g.distanceBetween(self, enemy) > 100) {
                        return doTurn({
                            clockwise: directionAngle
                        });
                    } else if (g.distanceBetween(self, enemy) <= 100) {
                        return doMove({
                            angle: Math.PI + directionAngle,
                            message: enemy.name + ", please back off"
                        });
                    }
                    return doMove({
                        angle: directionAngle,
                        message: "Too bad you can't see me, " + enemy.name
                    });
                }
            }
        };

        let runForYourLife = function () {
            if (ticksToRun == 1) {
                ratRun = false;
            }
            ticksToRun -= 1;
            return runThehellAway(danger);
        };

        let goToPreferablePosition = function (position1: any, position2: any, enemyPosition: any) {
            if (g.distanceBetweenPoints(position1, enemyPosition) > g.distanceBetweenPoints(position2, enemyPosition)) {
                return goToPosition(position1);
            }
            else {
                return goToPosition(position2);
            }
        };

        let runThehellAway = function (enemy: any) {
            let runAngle = g.angleBetween(self, enemy) + (Math.PI / 2.0) + Math.PI / 6;

            if (self.position.x + 70 > g.ground.width) {
                if (self.position.y + 70 > g.ground.height || self.position.y < 70) {
                    return goToPreferablePosition(corners[0], corners[2], enemy.position);
                }
                return goToPreferablePosition(corners[2], corners[3], enemy.position);
            }

            if (self.position.x - 70 < 0) {
                if (self.position.y + 70 > g.ground.height || self.position.y < 70) {
                    return goToPreferablePosition(corners[1], corners[3], enemy.position);
                }
                return goToPreferablePosition(corners[0], corners[1], enemy.position);
            }

            if (self.position.y - 70 < 0) {
                if (self.position.x + 70 > g.ground.width) {
                    // empty block in original
                }
                return goToPreferablePosition(corners[1], corners[2], enemy.position);
            }

            if (self.position.y + 70 > g.ground.height) {
                return goToPreferablePosition(corners[0], corners[3], enemy.position);
            }

            return doMove({
                angle: runAngle,
                message: "Spare the little mouse, " + enemy.name + "."
            });
        };

        let goToPosition = function (position: any) {
            const angle = g.angleBetweenPoints(self.position, position);
            return doMove({ angle: angle });
        };

        let stealth = function (enemy: any) {
            if ((g.distanceBetween(self, enemy) > 400 && enemy.lives < g.creatureMaxBullets[self.level] + 2 * g.bulletDamage) || (g.distanceBetween(self, enemy) > 300 && enemy.lives < g.creatureMaxBullets[self.level] + 1 * g.bulletDamage) || g.distanceBetween(self, enemy) > 500) {
                return goToPosition(weakestEnemy.position);
            }
            else {
                return doTurn({ angle: g.angleBetween(self, enemy), message: "I'm looking at you, " + enemy.name });
            }
        };

        // Looking for bullets
        bullets.forEach((bullet: any) => {
            let dist = g.distanceBetween(self, bullet);
            if (bullet.dangerous && dist < dangerousBulletDist) {
                dangerousBulletDist = dist;
                dangerousBullet = bullet;
            }

            if (!bullet.dangerous && dist < safeBulletDist) {
                let messedUpEnemies = 0;
                enemies.forEach((enemy: any) => {
                    if (g.distanceBetween(bullet, enemy) > g.distanceBetween(bullet, self)) {
                        messedUpEnemies += 1;
                    }
                });
                if (messedUpEnemies >= enemies.length - 1) {
                    safeBulletDist = dist;
                    safeBullet = bullet;
                }
            }
        });

        let e: any = 0;
        let weakestEnemy = enemies[0];
        distance = max;
        let lives = self.bullets * g.bulletDamage;
        enemies.forEach((enemy: any) => {
            if (enemy.lives < weakestEnemy.lives) {
                weakestEnemy = enemy;
            }
            if (lives > enemy.lives) {
                e = enemy;
                distance = g.distanceBetween(self, enemy);
                lives = enemy.lives;
            } else if (lives == enemy.lives) {
                if (distance > g.distanceBetween(self, enemy)) {
                    distance = g.distanceBetween(self, enemy);
                    lives = enemy.lives;
                    e = enemy;
                }
            }
        });

        if (e != 0) {
            enemy = e;
            let backlash = Math.PI / 50.0;
            let directionAngle = g.angleBetween(self, e);
            if (g.distanceBetween(self, enemy) < 150) {
                backlash = Math.PI / 20;
            }
            if (self.energy > g.shotEnergyCost + 10) {
                return shootAtEnemy(enemy, backlash);
            }
        }

        if (dangerousBullet && dangerousBulletDist < 200 && self.lives < 0.5 * g.creatureMaxLives[self.level]) {
            let bulletAngle = Math.atan2(dangerousBullet.velocity.y, dangerousBullet.velocity.x);
            let collisionAngle = g.angleBetween(self, dangerousBullet);
            const backlash = Math.PI / 25.0;
            let diff = Math.abs(g.differenceBetweenAngles(bulletAngle, collisionAngle));
            if (diff < backlash) {
                return doMove({
                    angle: bulletAngle + Math.PI / 2.0,
                    message: "Jumpy-jumpy"
                });
            }
        }

        if (self.lives < 0.4 * g.creatureMaxLives[self.level]) {
            if (self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
                return doEatan({});
            }
        }

        // Consider save bullet
        if (safeBullet && self.bullets < g.creatureMaxBullets[self.level]) {
            ratRun = false;
            let angle = g.angleBetween(self, safeBullet);
            return doMove({
                angle: angle
            });
        }

        let dangerousEnemy: any = 0;
        let backlash = Math.PI / 4;
        enemies.forEach((enemy: any) => {
            if (enemy.bullets > 0 && g.distanceBetween(self, enemy) < 500 && self.energy > g.creatureMaxEnergy[self.level] * 0.2 && Math.abs(g.angleBetween(enemy, self) - g.normalizeAngle(enemy.angle)) < backlash) {
                dangerousEnemy = enemy;
            }
        });
        if (dangerousEnemy) {
            return runThehellAway(dangerousEnemy);
        }

        if (ratRun) {
            return runForYourLife();
        }

        // Do nothing if there's no anyone else
        if (self.bullets < 1 || enemies.length < 1) {
            return doNothing({});
        } else {

            if (self.lives < g.creatureMaxLives[self.level] * 0.9 && self.energy == g.creatureMaxEnergy[self.level]) {
                return doEatan({ message: "Yummi!" });
            } else if (self.energy == g.creatureMaxEnergy[self.level] && self.bullets == g.creatureMaxBullets[self.level]) {
                return hitAndRun();
            }
        }

        if (self.energy > g.creatureMaxEnergy[self.level] * 0.7) {
            return stealth(weakestEnemy);
        }
        return doNothing({});
    }

};

export default rathorn;
