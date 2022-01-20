'use strict'
const { Config, App, Cluster } = require('./src/lib');
const { Reactor } = require('./src/app')

function go(period = 10000) {
    /* set up */
    const fleet = new Cluster(Config.NETWORK_TYPE.SHARED, Config.IDLE_STRATEGY, Config.FAILOVER_RETRY);
    const ships = [
        new App(fleet.network(), Config.REDIS.TOPIC.M3_DATA, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.DATA_EXPIRY),
        new App(fleet.network(), Config.REDIS.TOPIC.M3_USER, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.USER_EXPIRY),
        new App(fleet.network(), Config.REDIS.TOPIC.M3_REPO, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.REPO_EXPIRY)
    ]

    /* deploy */
    for ( const ship of ships ) {
        ship.wire(
            new Reactor( fleet.network() || ship.network() )
        );
    }
    fleet.deploy(ships);

    /* run */
    fleet.go(period);
}

go(0);