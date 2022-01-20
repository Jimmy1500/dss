'use strict'
const { Config, App, Cluster } = require('./src/lib');
const { Reactor } = require('./src/app')

function run(duration = 10000) {
    if ( duration < 0 ) { throw new EvalError('duration cannot be < 0'); }

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
    console.log('running app cluster %O, shutdown in approx...%Os', fleet.id(), duration ? duration/1000: 'N/A');
    fleet.go();

    /* shutdown */
    if ( duration ) { fleet.wait(duration).then( _ => fleet.halt()); }
}

run(0);