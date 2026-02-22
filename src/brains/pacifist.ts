import type { Brain } from '../types';

const g = globalThis as any;

const pacifist: Brain = {

    name: "Pacifist",
    kind: g.kinds.moose,
    author: "Sonya",
    description: "Make love, not war. Bot with a hard destiny: he does not accept any type of violence, so the main purpose of his life is to consume the bullets before others will get them",

    thinkAboutIt: function (self, enemies, bullets, objects, events) {

        // Just eat reachible bullets.
        // Don't kill anybody.

        // Message
        let message: string | undefined = undefined;
        events.forEach((event: any) => {
            if (event.type == g.eventTypes.wound && event.payload[0].name == self.name && Math.random() < 0.2) {
                message = "\u0422\u0410\u041A, \u0411\u041B\u042D\u0422";
            }
        });

        // Eat bullet if self has one
        if (self.bullets > 0) {
            return { do: g.actions.eat, params: { message: message } };
        }

        let safeBullet: any;
        const max = g.ground.width + g.ground.height;
        let safeBulletDist = max;

        // Looking for most centered safe bullet
        let center = { x: g.ground.width / 2, y: g.ground.height / 2 };
        bullets.forEach((bullet: any) => {
            let dist = g.distanceBetweenPoints(center, bullet.position);
            if (!bullet.dangerous && dist < safeBulletDist) {
                safeBulletDist = dist;
                safeBullet = bullet;
            }
        });

        // Grab the bullet
        if (safeBullet) {
            let angle = g.angleBetween(self, safeBullet);
            return { do: g.actions.move, params: { angle: angle, message: message } };
        }

        // Do nothing otherwise
        return { do: g.actions.none, params: { message: message } };
    }

};

export default pacifist;
