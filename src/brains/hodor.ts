import type { Brain } from '../types';

const g = globalThis as any;

const hodor: Brain & Record<string, any> = {

    name: "Hodor",
    kind: g.kinds.moose,
    author: "Martin",
    description: "Kills the creature who talks more than others.",

    creatures: [] as any[],
    desired: null as any,


    thinkAboutIt: function (self, enemies, bullets, objects, events) {

        let target: any = null,
            counter = 0;
        enemies.forEach((e: any) => {
            let fid = -1;
            for (let i = 0; i < this.creatures.length; i++) {
                let c = this.creatures[i];
                if (c.id == e.id) {
                    c.exists = true;
                    fid = i;
                    if (c.message != e.message) {
                        c.message = e.message;
                        c.counter++;
                    }
                    break;
                }
            }
            if (fid < 0) {
                this.creatures.push({ id: e.id, message: e.message, exists: true, counter: 0 });
            }
            else
                if (this.creatures[fid].counter > counter && g.rayBetween(self, e)) {
                    target = e;
                    counter = this.creatures[fid].counter;
                }
        });

        for (let i = this.creatures.length - 1; i >= 0; i--) {
            if (!this.creatures[i].exists) this.creatures.splice(i, 1);
        }

        const max = g.ground.width + g.ground.height;

        let dangerousBullet: any,
            dangerousBulletDist = max,
            center = { x: g.ground.width / 2, y: g.ground.height / 2 };

        let drops: any[] = [],
            exists = false;
        bullets.forEach((bullet: any) => {
            let dist = g.distanceBetween(self, bullet);
            if (bullet.dangerous && dist < dangerousBulletDist) {
                dangerousBulletDist = dist;
                dangerousBullet = bullet;
            }
            if (this.desired == null && bullet.speed < 0.1) drops.push(bullet);
            if (this.desired && this.desired.id == bullet.id) exists = true;
        });

        if (!exists) this.desired = null;
        if (this.desired == null) this.desired = drops[g.randomInt(0, drops.length - 1)];

        if (dangerousBullet && dangerousBulletDist < 200 && self.energy >= g.jumpEnergyCost) {
            let bulletAngle = Math.atan2(dangerousBullet.velocity.y, dangerousBullet.velocity.x);
            let collisionAngle = g.angleBetween(dangerousBullet, self);
            const backlash = Math.PI / 25.0;
            let diff = Math.abs(g.differenceBetweenAngles(bulletAngle, collisionAngle));
            if (diff < backlash) {
                return { do: g.actions.jump, params: { angle: bulletAngle + Math.PI / 2.0 } };
            }
        }

        if (self.lives < g.creatureMaxLives[self.level] * 0.5 && self.bullets > 0) {
            if (self.energy >= g.eatBulletEnergyCost) return { do: g.actions.eat };
            let corners = [{ x: 0, y: 0 },
            { x: g.ground.width, y: 0 },
            { x: g.ground.width, y: g.ground.height },
            { x: 0, y: g.ground.height }],
                dist = max,
                corner: any;
            corners.forEach((c: any) => {
                if (g.distanceBetweenPoints(self.position, c) < dist) {
                    dist = g.distanceBetweenPoints(self.position, c);
                    corner = c;
                }
            });
            if (dist > 120) {
                return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, corner) } };
            }
            else
                return { do: self.energy >= g.eatBulletEnergyCost ? g.actions.eat : g.actions.none };
        }

        if (this.desired && self.bullets < g.creatureMaxBullets[self.level]) {
            let angle = g.angleBetween(self, this.desired);
            return { do: g.actions.move, params: { angle: angle } };
        }

        if (self.level > 0 && self.lives < g.creatureMaxLives[self.level] * 0.7 && self.energy >= g.invisibleEnergyCost) {
            return { do: g.actions.spell };
        }

        if (target && self.energy > g.shotEnergyCost + 20 /* for pursuit */) {
            let directionAngle = g.angleBetween(self, target);
            let dist = g.distanceBetween(self, target);
            if (dist < 100) return { do: g.actions.none };
            if (dist > 300) return { do: g.actions.move, params: { angle: directionAngle } };
            const backlash = Math.PI / 50.0;
            let diff = Math.abs(g.differenceBetweenAngles(self.angle, directionAngle));
            if (diff < backlash) return { do: g.actions.shoot };
            else return { do: g.actions.turn, params: { angle: directionAngle } };
        }

        return { do: g.actions.none };
    }
};

export default hodor;
