import type { Brain } from '../types';

const g = globalThis as any;

// Module-scope state (was global in original)
let readyToFire: boolean | undefined;
let bullMesage: string | undefined;
let spam: number = 0;
let bullMesageSpam: number = 0;
let clockwise: number | undefined;

const bulletbull: Brain = {

    name: "BULLetBULL",
    kind: g.kinds.bull,
    author: "Urist",
    description: "The spinning one. BULLetBULL gathers enough bullets, then goes to the arena center and starts spinning like a balerina of death until some poor soul appears in his line of sight.",

    thinkAboutIt: function (self, enemies, bullets, objects, events) {

        if (typeof readyToFire == "undefined") {
            bullMesage = undefined;
            readyToFire = false;
            spam = 0;
            bullMesageSpam = 0;
        }

        if (bullMesage && bullMesageSpam === 0) {
            bullMesageSpam = 20;
        } else if (bullMesage && bullMesageSpam === 1) {
            bullMesageSpam--;
            bullMesage = undefined;
        } else if (bullMesageSpam > 0) {
            bullMesageSpam--;
        }

        const max = g.ground.width + g.ground.height;
        let safeBullet: any, dangerousBullet: any,
            safeBulletDist = max,
            dangerousBulletDist = max,
            center = {
                x: g.ground.width / 2,
                y: g.ground.height / 2
            };

        let doShooty = function (params: any) {
            bullMesage = "Target acquired.";
            params.message = bullMesage;
            spam = 1;
            return { do: g.actions.shoot, params: params };
        };

        let doMove = function (params: any) {
            spam = 0;
            params.message = bullMesage;
            return { do: g.actions.move, params: params };
        };

        let doEatan = function (params: any) {
            params.message = bullMesage;
            return { do: g.actions.eat, params: params };
        };

        let doRotate = function (params: any) {
            params.message = bullMesage;

            if (spam == 0) {
                spam = 1;
                bullMesage = "Turret mode: Activated.";
            }
            if (readyToFire) {
                bullMesage = "Rage mode: Activated.";
            }
            params.message = bullMesage;
            return { do: g.actions.rotate, params: params };
        };

        let doTurn = function (params: any) {
            params.message = bullMesage;

            if (spam == 0) {
                spam = 1;
                bullMesage = "Turret mode: Activated.";
            }
            if (readyToFire) {
                bullMesage = "Rage mode: Activated.";
            }
            params.message = bullMesage;
            return { do: g.actions.turn, params: params };
        };

        let doNothing = function (params: any) {
            params.message = bullMesage;
            return { do: g.actions.none, params: params };
        };

        let doJumpy = function (params: any) {
            params.message = bullMesage;
            return { do: g.actions.jump, params: params };
        };

        let goToCenter = function () {
            let wh = g.ground.width / 8,
                hh = g.ground.height / 8;
            if (self.position.x < center.x - wh || self.position.x > center.x + wh ||
                self.position.y < center.y - hh || self.position.y > center.y + hh) {
                return doMove({ angle: g.angleBetweenPoints(self.position, center) });
            } else {
                return prepareYourAnuses();
            }
        };

        let prepareYourAnuses = function (): any {
            if (self.bullets > 0 && self.energy) {
                let backlash = Math.PI / 20;
                let distance = 200;
                if (readyToFire) {
                    backlash = Math.PI / 10;
                    distance = 400;
                }
                let shoot = false;
                if (self.energy >= g.shotEnergyCost * self.bullets) {
                    enemies.forEach((e: any) => {
                        let directionAngle = g.angleBetween(self, e);
                        let diff = Math.abs(g.differenceBetweenAngles(self.angle, directionAngle));
                        if (diff < backlash && g.distanceBetween(self, e) <= distance && g.rayBetween(self, e)) {
                            shoot = true;
                        }
                    });

                    if (shoot) {
                        if (self.bullets == 1) {
                            readyToFire = false;
                        }
                        clockwise = g.randomInt(0, 1);
                        return doShooty({});
                    }
                }
            }

            if (typeof clockwise == "undefined") {
                clockwise = g.randomInt(0, 1);
            }
            if (readyToFire) {
                return doTurn({ angle: g.normalizeAngle(self.angle + (21.0 - (2.0 * (clockwise!))) * Math.PI / 20.0) });
            }
            else {
                return doRotate({ clockwise: clockwise });
            }
        };

        if (self.bullets == g.creatureMaxBullets[self.level]) {
            readyToFire = true;
        }

        // Looking for bullets
        bullets.forEach((bullet: any) => {
            let dist = g.distanceBetween(self, bullet);
            if (bullet.dangerous && dist < dangerousBulletDist) {
                dangerousBulletDist = dist;
                dangerousBullet = bullet;
            }
            dist = g.distanceBetweenPoints(center, bullet.position);

            if (!bullet.dangerous && dist < safeBulletDist) {
                let messedUpEnemies = 0;
                enemies.forEach((enemy: any) => {
                    if (g.distanceBetween(bullet, enemy) > g.distanceBetween(bullet, self)) {
                        messedUpEnemies += 1;
                    }
                });
                if (messedUpEnemies >= enemies.length - 2 + self.bullets) {
                    safeBulletDist = dist;
                    safeBullet = bullet;
                }
            }
        });

        if (safeBullet && !readyToFire) {
            let angle = g.angleBetween(self, safeBullet);
            return doMove({ angle: angle });
        }

        // Do nothing if there's no anyone else
        if (self.bullets < 1 || enemies.length < 1) {
            return doNothing({});
        } else {
            return goToCenter();
        }

        return goToCenter();
    }
};

export default bulletbull;
