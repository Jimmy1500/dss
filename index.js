'use strict'
const { Config, App, Cluster } = require('./src/lib');
const { Reactor } = require('./src/app')

function run(duration = 10000) {
    if ( duration < 0 ) { throw new EvalError('duration cannot be < 0'); }

    /* set up */
    const cluster = new Cluster(Config.NETWORK_TYPE.SHARED, Config.IDLE_STRATEGY, Config.FAILOVER_RETRY);
    const apps = [
        new App(cluster.network(), Config.REDIS.TOPIC.M3_DATA, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.DATA_EXPIRY),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_USER, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.USER_EXPIRY),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_REPO, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.REPO_EXPIRY)
    ]

    /* deploy */
    for ( const app of apps ) { app.wire(new Reactor( cluster.network() || app.network() )); }
    cluster.deploy(apps);

    /* run */
    console.log('running cluster, shutdown in approx...%Os', duration ? duration/1000: 'N/A');
    cluster.run();

    /* shutdown */
    if ( duration ) { cluster.wait(duration).then( _ => cluster.shutdown()); }
}

run(0);