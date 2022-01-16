const { App, Cluster, Config } = require('./src');
const { default: axios } = require('axios');

// const { Bus } = require('./src/Bus');
// const bus = new Bus();
// bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ });

// bus.push(Config.REDIS.TOPIC.M3_USER, { user: 'octocat' });
// bus.push(Config.REDIS.TOPIC.M3_REPO, { user: 'octocat' });
// bus.pull([...Object.values(Config.REDIS.TOPIC)], [ 0, 0 ], 10, 0).then(s  => { console.log('streams: %O', s); bus.flush(); });

// bus.set('test_cache', ['a', 'b', 'c'], false).then(
//     bus.get('test_cache', false).then( val => {
//         console.log(val);
//         bus.del('test_cache');
//         bus.disconnect();
//     })
// );

async function handler(topic, event) {
    try {
        console.log('processing %O.%O: %O', topic, event?.id, event?.body);

        const user = JSON.parse(event?.body)?.user;
        if ( !user?.length ) { throw new EvalError('no user specified in event.body'); }

        switch (topic) {
            case Config.REDIS.TOPIC.M3_USER: {
                const info = await axios.get(`${Config.GIT.API_BASE_URL}/${user}`);
                switch ( info?.status ) {
                    case 200: return info?.data;
                    default:
                        console.error(`[${info?.status}] no user data retrieved per user ${user}`);
                        return false;
                }
            }
            case Config.REDIS.TOPIC.M3_REPO: {
                const info = await axios.get(`${Config.GIT.API_BASE_URL}/${user}/repos`);
                switch ( info?.status ) {
                    case 200: return info?.data;
                    default:
                        console.error(`[${info?.status}] no repo data retrieved per user ${user}`);
                        return false;
                }
            }
            default: {
                console.warn('unrecognized topic: %O, event: %O', topic, event);
                return true;
            }
        }
    } catch ( error ) {
        console.error(error.stack);
        return false;
    } 
}

function run(duration = 10000) {
    if ( duration < 0 ) { throw new EvalError('duration cannot be < 0'); }

    const cluster = new Cluster(Config.NETWORK_TYPE.SHARED, Config.IDLE_STRATEGY);
    cluster.deploy([
        new App(cluster.network(), Config.REDIS.TOPIC.M3_USER, 0, 50, 100, handler),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_REPO, 0, 50, 100, handler)
    ]); 

    console.log('running cluster, shutdown in approx...%O', duration ? `${duration} ms`: 'never');

    cluster.run();
    if ( duration ) { cluster.wait(duration).then( _ => cluster.shutdown()); }
}

run();