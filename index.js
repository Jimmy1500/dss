'use strict'
const { config, Cluster, browserOf } = require('./src/lib');
const { App, Reactor } = require('./src/app');

const { NETWORK_TYPE, IDLE, RETRY, POLL, BLOCK, CACHE, REDIS, WEB } = config;

async function main(period = 0) {
    const browser = await browserOf(WEB.ENGINE, WEB.HEADLESS);

    /* set up */
    const server = new Cluster(browser, NETWORK_TYPE.SHARED, IDLE.PLAN);
    const apps = [
        new App(server.network(), server.browser(), REDIS.TOPIC.DSS_AMZ_PT, 0, POLL.PLAN, BLOCK.PLAN, CACHE.EXPIRY.AMZ_PT, RETRY.PLAN),
        new App(server.network(), server.browser(), REDIS.TOPIC.DSS_IBM_EC, 0, POLL.PLAN, BLOCK.PLAN, CACHE.EXPIRY.IBM_EC, RETRY.PLAN),
        new App(server.network(), server.browser(), REDIS.TOPIC.DSS_CRT_PF, 0, POLL.PLAN, BLOCK.PLAN, CACHE.EXPIRY.CRT_PF, RETRY.PLAN),
        new App(server.network(), server.browser(), REDIS.TOPIC.DSS_CRT_PJ, 0, POLL.PLAN, BLOCK.PLAN, CACHE.EXPIRY.CRT_PJ, RETRY.PLAN)
        /* ... */
    ]

    /* deploy */
    for ( const app of apps ) {
        app.wire(
            new Reactor( server.network() || app.network() )
        );
    }
    server.deploy(apps);

    /* run */
    await server.run(period);
}

main();