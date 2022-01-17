const { Bus, App, Cluster, Config } = require('./src');
const { default: axios } = require('axios');
const hash = require('object-hash');

// const bus = new Bus();
// bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ });

// bus.push(Config.REDIS.TOPIC.M3_DATA, { user: 'octocat', callback: 'http://localhost:5000/webhook' });
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

async function cacheOf(bus, topic, event, expiry, url = null) {
    const key   = hash.sha1({ topic: topic, body: event?.body });
    const cache = await bus.get(key);
    if ( cache ) {
        const cached = JSON.parse(cache);
        if ( !cached?.data || !cached?.expiry ) {
            await bus.del(key);
            console.warn(`cache %O deleted, no data or expiry specified`, key);
        } else if ( cached.expiry > Date.now() ) {
            console.warn(`cache %O recovered per %O.%O, expire in %Os`, key, topic, event?.id, (cached.expiry - Date.now())/1000);
            return cached?.data;
        } else { console.warn(`cache %O expired`, key); }
    } else { console.warn(`no cache exists per %O.%O`, topic, event?.id); }

    // refresh cache if source api url is specified
    if ( url?.length ) {
        const res = await axios.get(url);
        await bus.set(key, { data: res?.data, expiry: Date.now() + expiry });
        console.log(`data retrieved per %O.%O (%O), cache %O updated, expire in %Os`, topic, event?.id, res?.status, key, expiry/1000);
        return res?.data;
    }
    return null;
}

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

            const user_data = await cacheOf(bus, Config.REDIS.TOPIC.M3_USER, event, expiry);
            const repo_data = await cacheOf(bus, Config.REDIS.TOPIC.M3_REPO, event, expiry);
            if ( user_data && repo_data ) {
                console.log(`POST %O`, body?.callback);
                const res = await axios.post(body?.callback, { ...user_data, repos: repo_data })
                console.log(`POST(%O) %O`, res?.status, body?.callback);
            } else {
                if ( !user_data ) { bus.push(Config.REDIS.TOPIC.M3_USER, { user: user }); }
                if ( !repo_data ) { bus.push(Config.REDIS.TOPIC.M3_REPO, { user: user }); }
                throw new EvalError(`no data available per ${topic}.${event.id}`);
            }
            break;
        }
        case Config.REDIS.TOPIC.M3_USER: {
            const data = await cacheOf(bus, topic, event, expiry, `${Config.GIT.API_BASE_URL}/${user}`);
            if ( !data ) { throw new EvalError(`no data recovered per ${topic}.${event.id}`); }
            break;
        }
        case Config.REDIS.TOPIC.M3_REPO: {
            const data = await cacheOf(bus, topic, event, expiry, `${Config.GIT.API_BASE_URL}/${user}/repos`);
            if ( !data ) { throw new EvalError(`no data recovered per ${topic}.${event.id}`); }
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