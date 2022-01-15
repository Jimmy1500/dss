const { NODE, REDIS, AWS, GIT } = require('./src/Config')
const { Bus } = require('./src/Bus')

const bus = new Bus();
bus.connect(
    {
		port: REDIS.PORT,
		host: REDIS.HOST,
		db: 0,
		// username:
		// password:
    }
)

bus.push(REDIS.TOPIC.M3_USER, [ 'user', 'REQ_USER'  ])
bus.push(REDIS.TOPIC.M3_REPO, [ 'repos', 'REQ_REPOS'])

bus.pull([...Object.values(REDIS.TOPIC)], [ 0, 0 ]).then(last_id => console.log('last:', last_id))
bus.flush();