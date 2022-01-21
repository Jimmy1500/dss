'use strict'
const { Config, App, Cluster } = require('./src/lib');
const { Reactor } = require('./src/app')

async function go(period = 0) {
    /* set up */
    const fleet = new Cluster(Config.NETWORK_TYPE.SHARED, Config.IDLE.STRATEGY);
    const ships = [
        new App(fleet.network(), Config.REDIS.TOPIC.M3_DATA, 0, Config.POLL_SIZE, Config.BLOCK_PERIOD, Config.CACHE.DATA_EXPIRY, Config.RETRY.STRATEGY),
        new App(fleet.network(), Config.REDIS.TOPIC.M3_USER, 0, Config.POLL_SIZE, Config.BLOCK_PERIOD, Config.CACHE.USER_EXPIRY, Config.RETRY.STRATEGY),
        new App(fleet.network(), Config.REDIS.TOPIC.M3_REPO, 0, Config.POLL_SIZE, Config.BLOCK_PERIOD, Config.CACHE.REPO_EXPIRY, Config.RETRY.STRATEGY)
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