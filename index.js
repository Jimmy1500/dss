'use strict'
const { axios, cacheOf, merge, Bus, App, Cluster, Config } = require('./src');

// const bus = new Bus();
// bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ });
// bus.push(Config.REDIS.TOPIC.M3_DATA, { user: 'octocat', callback: 'http://localhost:5000/dev/callback' });
// bus.push(Config.REDIS.TOPIC.M3_USER, { user: 'octocat' });
// bus.push(Config.REDIS.TOPIC.M3_REPO, { user: 'octocat' });
// bus.poll([...Object.values(Config.REDIS.TOPIC)], [ 0, 0, 0 ], 10, 0).then(s  => { console.log('streams: %O', s); bus.flush(); });
// bus.set('test_cache', ['a', 'b', 'c'], false).then(
//     bus.get('test_cache', false).then( val => {
//         console.log('test_cache retrieved: %O', val);
//         bus.del('test_cache');
//         console.log('test_cache deleted: %O', val);
//         bus.disconnect();
//     })
// );

async function handler(bus, topic, event, expiry) {
    if ( !(bus instanceof Bus)      ) { throw new TypeError('bus must be instance of Bus');     }
    if ( !(event instanceof Object) ) { throw new TypeError("event must be instance of object");}
    if ( !event?.body?.length       ) { throw new TypeError('no body specified in event');      }

    const body = JSON.parse(event?.body);
    if ( !body?.user?.length ) { throw new EvalError('no user specified in event.body'); }
    const user = body.user;

    switch (topic) {
        case Config.REDIS.TOPIC.M3_DATA: {
            if ( !body?.callback?.length ) { throw new EvalError(`callback url not specified per ${topic}.${event.id}`); }

            // get data from cache/source api
            let user_data, repo_data, data;
            try {
                user_data = await cacheOf(bus, Config.REDIS.TOPIC.M3_USER, event, Config.CACHE.USER_EXPIRY, `${Config.GIT.API_BASE_URL}/${user}`);
                repo_data = await cacheOf(bus, Config.REDIS.TOPIC.M3_REPO, event, Config.CACHE.REPO_EXPIRY, `${Config.GIT.API_BASE_URL}/${user}/repos`);
                data      = await merge  (user, user_data, repo_data);
            } catch ( error ) {
                data      = { code: 'FAILURE', message: `no data recovered for user '${user}', ${error.message}` };
            }

            // send data via callback
            try {
                console.log(`POST %O: %O`, body?.callback, data);
                const res = await axios.post(body?.callback, data)
                console.log(`status %O`, res?.status);
            } catch ( error ) {
                throw new EvalError(`callback url ${body?.callback} offline, ${error.message}`)
            }
            break;
        }
        case Config.REDIS.TOPIC.M3_USER: {
            const data = await cacheOf(bus, topic, event, expiry, `${Config.GIT.API_BASE_URL}/${user}`);
            if ( !data ) { throw new EvalError(`${topic}.${event.id}: no data recovered for user '${user}'`); }
            break;
        }
        case Config.REDIS.TOPIC.M3_REPO: {
            const data = await cacheOf(bus, topic, event, expiry, `${Config.GIT.API_BASE_URL}/${user}/repos`);
            if ( !data ) { throw new EvalError(`${topic}.${event.id}: no data recovered for user '${user}'`); }
            break;
        }
        default: {
            console.warn('unrecognized topic: %O, event: %O', topic, event);
            break;
        }
    }
}

function run(duration = 10000) {
    if ( duration < 0 ) { throw new EvalError('duration cannot be < 0'); }

    const cluster = new Cluster(Config.NETWORK_TYPE.SHARED, Config.IDLE_STRATEGY);
    cluster.deploy([
        new App(cluster.network(), Config.REDIS.TOPIC.M3_DATA, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, 0, handler),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_USER, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.USER_EXPIRY, handler),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_REPO, 0, Config.POLL_SIZE, Config.BLOCK_ON_EMPTY, Config.CACHE.REPO_EXPIRY, handler)
    ]); 

    console.log('running cluster, shutdown in approx...%Os', duration ? duration/1000: 'N/A');

    cluster.run();
    if ( duration ) { cluster.wait(duration).then( _ => cluster.shutdown()); }
}

run(0);