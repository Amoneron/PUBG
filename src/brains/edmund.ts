import type { Brain } from '../types';

const g = globalThis as any;

const edmund: Brain = {

    name: "Edmund",
    kind: g.kinds.bear,
    author: "Amoneron",
    description: "The basic algorithm for writing your bots",

    thinkAboutIt: function (self, enemies, bullets, objects, events) {

        // Use max conts as max possible distance between the creature and bullets / enemies
        const max = g.ground.width + g.ground.height;

        // Declare bullets and distances variables
        let safeBullet: any, dangerousBullet: any,
            safeBulletDist = max,
            dangerousBulletDist = max,
            center = { x: g.ground.width / 2, y: g.ground.height / 2 };

        // Try to find nearest dangerous bullet to the creature
        // and nearest safe bullet to the center of the ground.
        // Bullets at the corners aren't always easy available,
        // so we go to centered bullet first.
        bullets.forEach((bullet: any) => {
            let dist = g.distanceBetween(self, bullet);
            if (bullet.dangerous && dist < dangerousBulletDist) {
                dangerousBulletDist = dist;
                dangerousBullet = bullet;
            }
            dist = g.distanceBetweenPoints(center, bullet.position);
            if (!bullet.dangerous && dist < safeBulletDist) {
                safeBulletDist = dist;
                safeBullet = bullet;
            }
        });

        // Consider dangerous bullet first.
        if (dangerousBullet && dangerousBulletDist < 200 && self.energy >= g.jumpEnergyCost) {
            let bulletAngle = Math.atan2(dangerousBullet.velocity.y, dangerousBullet.velocity.x);
            let collisionAngle = g.angleBetween(dangerousBullet, self);
            const backlash = Math.PI / 25.0;
            let diff = Math.abs(g.differenceBetweenAngles(bulletAngle, collisionAngle));
            if (diff < backlash) {
                return { do: g.actions.jump, params: { angle: bulletAngle + Math.PI / 2.0 } };
            }
        }

        // Consider what to do if we have no bullets or we're alone
        if (self.bullets < 1 || enemies.length < 1) {

            // Try to grab safe bullet if possible
            if (safeBullet && self.bullets < g.creatureMaxBullets[self.level]) {
                let angle = g.angleBetween(self, safeBullet);
                return { do: g.actions.move, params: { angle: angle } };
            }

            // Otherwise go to center and wait for enemies or bullets.
            let wh = g.ground.width / 8,
                hh = g.ground.height / 8;
            if (self.position.x < center.x - wh || self.position.x > center.x + wh ||
                self.position.y < center.y - hh || self.position.y > center.y + hh) {
                return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, center) } };
            }
            else {
                return { do: g.actions.none };
            }

        }
        else {

            // Eat bullet to heal itself or do nothing to accumulate enough energy
            if (self.lives < g.creatureMaxLives[self.level] * 0.25) {
                return { do: self.energy >= g.eatBulletEnergyCost ? g.actions.eat : g.actions.none };
            }

            // Otherwise find the nearest enemy.
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
            const backlash = Math.PI / 50.0;

            // Check enough energy for hunting
            if (self.energy > g.shotEnergyCost + 20 /* for pursuit */) {
                let diff = Math.abs(g.differenceBetweenAngles(self.angle, directionAngle));
                if (diff < backlash) {
                    return { do: g.actions.shoot };
                }
                else {
                    return { do: g.actions.move, params: { angle: directionAngle } };
                }
            }
        }

        return { do: g.actions.none };
    }

};

export default edmund;
