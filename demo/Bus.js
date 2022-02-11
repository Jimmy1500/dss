const { config, Bus } = require('../src/lib');

const bus = new Bus();
bus.connect({ port: config.REDIS.PORT, host: config.REDIS.HOST, db: 0, /* username: , password: */ });

/* messaging */
bus.push(config.REDIS.TOPIC.DSS_AMZ_PT, { cpf_cnpj: '1234', callback: 'http://localhost:4000/dev/callback' })
bus.push(config.REDIS.TOPIC.DSS_CRT_PF, { cpf_cnpj: '1234', callback: 'http://localhost:4000/dev/callback' });
bus.push(config.REDIS.TOPIC.DSS_CRT_PJ, { cpf_cnpj: '1234', callback: 'http://localhost:4000/dev/callback' });

const topic   = Object.values(config.REDIS.TOPIC);
const last_id = Array(topic?.length).fill(0);
bus.poll(topic, last_id, 10, 0).then( streams  => {
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