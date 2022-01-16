const { App, Cluster, Config } = require('./src')

async function run() {
    const cluster = new Cluster(Config.NETWORK_TYPE.SHARED);
    cluster.deploy([
        new App(cluster.network(), Config.REDIS.TOPIC.M3_USER, 0, 10, 1000),
        new App(cluster.network(), Config.REDIS.TOPIC.M3_REPO, 0, 10, 1000)
    ]); 
    await cluster.run()
}

run();
// bus.set('token', ['a', 'b', 'c'], false).then(
//     bus.get('token', false).then( val => {
//         console.log(val);
//         bus.flush();
//     })
// );

// bus.push(REDIS.TOPIC.M3_USER, [ 'user', 'REQ_USER'  ])
// bus.push(REDIS.TOPIC.M3_REPO, [ 'repos', 'REQ_REPOS'])
// 
// bus.pull([...Object.values(REDIS.TOPIC)], [ 0, 0 ], 10, 0)
// .then(last_id => {
//     console.log('last:', last_id);
//     bus.flush();
//     bus.disconnect();
// })