'use strict'
const { axios, jsonOf, cacheOf, stash, merge, Bus, App, Cluster, Config } = require('./src');

async function handler(bus, topic, event, expiry) {
    if ( !(bus instanceof Bus)      ) { throw new TypeError('bus must be instance of Bus');     }
    if ( !(event instanceof Object) ) { throw new TypeError("event must be instance of object");}
    if ( !event?.body?.length       ) { throw new TypeError('no body specified in event');      }

    const body = jsonOf(event?.body);
    let this_data = body?.error;

    if ( !this_data ) {
        if ( !body?.user?.length ) { throw new EvalError('no user specified in event.body'); }

        const user = body.user;
        const rate_url = `${Config.GIT.API_BASE_URL}/rate_limit`;

        switch (topic) {
            case Config.REDIS.TOPIC.M3_DATA: {
                // get data from cache/source api
                this_data = await cacheOf(bus, topic, user);
                if ( !this_data ) {
                    try {
                        const this_user = await cacheOf(bus, Config.REDIS.TOPIC.M3_USER, user, Config.CACHE.USER_EXPIRY, `${Config.GIT.API_BASE_URL}/users/${user}`,       rate_url);
                        const this_repo = await cacheOf(bus, Config.REDIS.TOPIC.M3_REPO, user, Config.CACHE.REPO_EXPIRY, `${Config.GIT.API_BASE_URL}/users/${user}/repos`, rate_url);
                        this_data       = await merge  (user, this_user, this_repo);
                    } catch ( error ) {
                        this_data       = { code: 'FAILURE', message: `no data recovered for user '${user}', ${error.message}` };
                    }
                    stash(bus, topic, user, this_data, expiry);
                }
                break;
            }
            case Config.REDIS.TOPIC.M3_USER: {
                this_data = await cacheOf(bus, topic, user, expiry, `${Config.GIT.API_BASE_URL}/users/${user}`,       rate_url);
                break;
            }
            case Config.REDIS.TOPIC.M3_REPO: {
                this_data = await cacheOf(bus, topic, user, expiry, `${Config.GIT.API_BASE_URL}/users/${user}/repos`, rate_url);
                break;
            }
            default: {
                throw new EvalError('unrecognized event %O.%O', topic, event);
            }
        }
    }

    // send data via callback
    const url = body?.callback;
    if      ( !url?.length ) { console.warn('no callback specified per %O.%O, data will not be sent', topic, event.id); }
    else if ( !this_data   ) { console.warn('no data recovered per %O.%O, callback will not be hit',  topic, event.id); }
    else {
        try {
            const res = await axios.post(url, this_data)
            console.log(`(%O) %O: %O`, res?.status, url, this_data);
        } catch ( error ) {
            const status  = error?.response?.status        || 400;
            const message = error?.response?.data?.message || error.message;
            switch ( status ) {
                case 403: throw new EvalError(`(${status}) callback ${url} forbidden, ${message}`);
                case 404: throw new EvalError(`(${status}) callback ${url} offline, ${message}`);
                default:  throw new EvalError(`(${status}) callback ${url} failed, ${message}`);
            }
        }
    }
}

function run(duration = 10000) {
    if ( duration < 0 ) { throw new EvalError('duration cannot be < 0'); }

    const cluster = new Cluster(Config.NETWORK_TYPE.SHARED, Config.IDLE_STRATEGY, Config.FAILOVER_RETRY);
    cluster.deploy([
        new App(cluster.network(), Config.REDIS.TOPIC.M3_DATA, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.DATA_EXPIRY, handler),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_USER, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.USER_EXPIRY, handler),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_REPO, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.REPO_EXPIRY, handler)
    ]); 

    console.log('running cluster, shutdown in approx...%Os', duration ? duration/1000: 'N/A');

    cluster.run();
    if ( duration ) { cluster.wait(duration).then( _ => cluster.shutdown()); }
}

run(0);