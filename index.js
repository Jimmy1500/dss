'use strict'
const { Config, App, Cluster } = require('./src/lib');
const { Reactor } = require('./src/app')

async function go(period = 0) {
    /* set up */
    const fleet = new Cluster(Config.NETWORK_TYPE.SHARED, Config.IDLE.PLAN);
    const ships = [
        new App(fleet.network(), Config.REDIS.TOPIC.M3_DATA, 0, Config.POLL.PLAN, Config.BLOCK.PLAN, Config.CACHE.EXPIRY.DATA, Config.RETRY.PLAN),
        new App(fleet.network(), Config.REDIS.TOPIC.M3_USER, 0, Config.POLL.PLAN, Config.BLOCK.PLAN, Config.CACHE.EXPIRY.USER, Config.RETRY.PLAN),
        new App(fleet.network(), Config.REDIS.TOPIC.M3_REPO, 0, Config.POLL.PLAN, Config.BLOCK.PLAN, Config.CACHE.EXPIRY.REPO, Config.RETRY.PLAN)
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