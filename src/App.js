'use strict'
const uuid = require('uuid');
const hash = require('object-hash');
const { Bus } = require('./Bus');
const { ENV, REDIS, AWS, GIT } = require('./Const');

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
                this.bus_           = bus;
                this.network_type_  = NETWORK_TYPE.SHARED;
            } else { throw new TypeError('bus must be instance of Bus'); }
        } else {
            this.bus_           = new Bus();
            this.network_type_  = NETWORK_TYPE.PRIVATE;
        }
        
        this.topic_     = topic;
        this.last_id_   = last_id;
        this.count_     = count;
        this.block_     = block;
        this.handler_   = handler;
        this.id_        = uuid.v4();
        console.log('app %O created, topic: %O, network type: %O', this.id_, this.topic_, this.network_type_);
    }

    /* --------------- primary interface --------------- */
    id() { return this.id_; }
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
        console.log('app %O stopped, last event id: %O', this.id_, this.last_id_);
    }
    async work() {
        const { last_id, streams } = await this.bus_.pull(this.topic_, this.last_id_, this.count_, this.block_);
        this.last_id_ = last_id;

        if ( !streams?.length ) { console.warn("topic %O drained", this.topic_); }
        else {
            let failed = false;

            for ( const [ topic, events ] of streams ) { // `topic_name` should equal to ${topic[i]}
                for ( const event of events ) {
                    try {
                        const data = this.handler_.constructor.name == 'AsyncFunction' ? await this.handler_(topic, event) : this.handler_(topic, event)
                        if ( data ) {
                            const key = hash.sha1({ topic: topic, body: event?.body })
                            await this.bus_.set(key, data);
                            console.log('data retrieved, cache %O refreshed', key);
                            await this.bus_.free(topic, event.id);
                        } else { failed = true; }

                        if ( !failed ) {
                            if ( Array.isArray(this.topic_) ) {
                                const index = this.topic_.length > 1 ? this.topic_.findIndex(name => name == topic) : 0;
                                this.last_id_[index] = event.id;
                            } else {
                                this.last_id_ = event.id;
                            }
                        }
                    } catch( error ) {
                        console.error("event %O failed, %O", event, error.stack);
                        failed = true;
                    }
                } // for ( const event of events )
            }
        }
    }
}

module.exports = {
    NETWORK_TYPE,
    App
}