'use strict'
const { Config, App, Cluster } = require('./src/lib');
const { Reactor } = require('./src/app')

const { NETWORK_TYPE, IDLE, REDIS, POLL, BLOCK, CACHE, RETRY } = Config;

async function go(period = 0) {
    /* set up */
    const fleet = new Cluster(NETWORK_TYPE.SHARED, IDLE.PLAN);
    const ships = [
        new App(fleet.network(), REDIS.TOPIC.M3_DATA, 0, POLL.PLAN, BLOCK.PLAN, CACHE.EXPIRY.DATA, RETRY.PLAN),
        new App(fleet.network(), REDIS.TOPIC.M3_USER, 0, POLL.PLAN, BLOCK.PLAN, CACHE.EXPIRY.USER, RETRY.PLAN),
        new App(fleet.network(), REDIS.TOPIC.M3_REPO, 0, POLL.PLAN, BLOCK.PLAN, CACHE.EXPIRY.REPO, RETRY.PLAN)
        /* ... */
    ]

    /* deploy */
    for ( const ship of ships ) {
        ship.wire(
            new Reactor( fleet.network() || ship.network() )
        );
    }
    fleet.deploy(ships);

    /* run */
    await fleet.go(period);
}

go();