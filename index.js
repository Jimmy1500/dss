const { App, Cluster, Config } = require('./src');

// const { Bus } = require('./src/Bus');
// const bus = new Bus();
// bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ });

// bus.set('token', ['a', 'b', 'c'], false).then(
//     bus.get('token', false).then( val => {
//         console.log(val);
//         bus.flush();
//     })
// );

// bus.push(Config.REDIS.TOPIC.M3_USER, [ 'user', 'REQ_USER'  ])
// bus.push(Config.REDIS.TOPIC.M3_REPO, [ 'repos', 'REQ_REPOS'])

// bus.pull([...Object.values(Config.REDIS.TOPIC)], [ 0, 0 ], 10, 0)
// .then(last_id => {
//     console.log('last:', last_id);
//     bus.flush();
//     bus.disconnect();
// })

function handler(topic, event) {
    try {
        switch (topic) {
            case Config.REDIS.TOPIC.M3_USER:
                console.warn('processing topic: %O, event: %O', topic, event);
                return true;
            case Config.REDIS.TOPIC.M3_REPO:
                console.warn('processing topic: %O, event: %O', topic, event);
                return true;
            default:
                console.warn('unrecognized topic: %O, event: %O', topic, event);
                return true;
        }
    } catch ( error ) {
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