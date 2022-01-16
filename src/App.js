'use strict'
const uuid = require('uuid');
const { Bus } = require('./Bus')
const { ENV, REDIS, AWS, GIT } = require('./Const')

const NETWORK_TYPE = {
    SHARED:  'SHARED',
    PRIVATE: 'PRIVATE'
}

class App {
    constructor(
        bus,
        topic,
        last_id = 0,
        count   = 50,
        block   = 10,
        handler = (topic, event) => { console.warn("topic: %O, event: %O", topic, event); return false; }
    ) {
        if ( typeof topic   != 'string' && !Array.isArray(topic)   ) { throw new TypeError(`invalid topic type ${typeof topic}`);     }
        if ( typeof last_id != 'number' && !Array.isArray(last_id) ) { throw new TypeError(`invalid last_id type ${typeof last_id}`); }
        if ( typeof count   != 'number'   ) { throw new TypeError(`invalid count type ${typeof count}`);     }
        if ( typeof block   != 'number'   ) { throw new TypeError(`invalid block type ${typeof block}`);     }
        if ( typeof handler != 'function' ) { throw new TypeError(`invalid handler type ${typeof handler}`); }

        if ( bus ) {
            if ( bus instanceof Bus ) {
                this.bus_       = bus;
                this.network_type_  = NETWORK_TYPE.SHARED;
            } else { throw new TypeError('bus must be instance of Bus'); }
        } else {
            this.bus_       = new Bus();
            this.network_type_  = NETWORK_TYPE.PRIVATE;
        }
        
        this.topic_     = topic;
        this.last_id_   = last_id;
        this.count_     = count;
        this.block_     = block;
        this.handler_   = handler;
        this.id_        = uuid.v4();
        console.log('app instantiated on %O, network type: %O', topic, this.network_type_);
    }

    /* --------------- primary interface --------------- */
    async start() {
        switch (this.network_type_) {
            case NETWORK_TYPE.PRIVATE:
                this.bus_.connect({ port: REDIS.PORT, host: REDIS.HOST, db: 0, /* username: , password: */ });
                break;
            default: break;
        }
        console.log('app %O started', this.id_);
    }
    async stop() {
        switch (this.network_type_) {
            case NETWORK_TYPE.PRIVATE:
                this.bus_.disconnect();
                break;
            default: break;
        }
        console.log('app %O stopped', this.id_);
    }
    async work() {
        console.log('app %O working...', this.id_);
        this.last_id_ = await this.bus_.pull(this.topic_, this.last_id_, this.count_, this.block_, this.handler_);
    }
}

module.exports = {
    NETWORK_TYPE,
    App
}