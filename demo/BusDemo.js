const { Bus, Config } = require('../src/lib');

const bus = new Bus();
bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ });

/* messaging */
bus.push(Config.REDIS.TOPIC.M3_DATA, { user: 'octocat', callback: 'http://localhost:4000/dev/callback' });
bus.push(Config.REDIS.TOPIC.M3_USER, { user: 'octocat', callback: 'http://localhost:4000/dev/callback' });
bus.push(Config.REDIS.TOPIC.M3_REPO, { user: 'octocat', callback: 'http://localhost:4000/dev/callback' });
bus.poll([...Object.values(Config.REDIS.TOPIC)], [ 0, 0, 0 ], 10, 0).then( streams  => {
    console.log('streams retrieved: %O', streams);
    for ( const [ topic, events ] of streams ) {
        console.log('# topic: %O', topic)
        for ( const event of events ) {
            console.log('%O: %O', event.id, event.body)
        }
    }
    bus.flush();
});

/* caching */
bus.set('cache_key', ['a', 'b', 'c']).then(
    bus.get('cache_key').then( val => {
        console.log('cache retrieved: %O', val);
        bus.del('cache_key').then( _ => {
            console.log('cache deleted: %O', val);
            bus.disconnect();
        })
    })
);