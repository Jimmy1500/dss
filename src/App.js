'use strict'
const uuid = require('uuid');
const hash = require('object-hash');
const { Bus } = require('./Bus');
const { ENV, REDIS, AWS, GIT } = require('./Env');

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
        block   = 0,
        expiry  = 300000,
        handler = (topic, event) => { console.warn("topic: %O, event: %O", topic, event); return false; }
    ) {
        if ( typeof topic   != 'string' && !Array.isArray(topic)   ) { throw new TypeError(`invalid topic type ${typeof topic}`);     }
        if ( typeof last_id != 'number' && !Array.isArray(last_id) ) { throw new TypeError(`invalid last_id type ${typeof last_id}`); }
        if ( typeof count   != 'number'   ) { throw new TypeError(`invalid count type ${typeof count}`);     }
        if ( typeof block   != 'number'   ) { throw new TypeError(`invalid block type ${typeof block}`);     }
        if ( typeof expiry  != 'number'   ) { throw new TypeError(`invalid expiry type ${typeof expiry}`);     }
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
        // align: topic vs. last_id
        if ( Array.isArray(topic) ) {
            if ( !Array.isArray(last_id) || topic.length != last_id.length ) {
                this.last_id_ = Array(topic.length).fill(0);
            }
        } else if ( Array.isArray(last_id) ) { this.last_id_ = 0; }
        this.count_     = count;
        this.block_     = block;
        this.expiry_    = expiry > 0 ? expiry : 300000;
        this.handler_   = handler;
        this.id_        = uuid.v4();
        console.log('app %O created, topic: %O, network type: %O', this.id_, this.topic_, this.network_type_);
    }

    /* --------------- primary interface --------------- */
    id() { return this.id_; }
    async pop(topic, event) {
        if ( !(event instanceof Object)   ) { throw new TypeError("event must be object");      }

        const key   = hash.sha1({ topic: topic, body: event?.body });
        const cache = await this.bus_.get(key);
        if ( cache ) {
            const cached = JSON.parse(cache);
            if ( !cached?.data || !cached?.expiry ) {
                await this.bus_.del(key);
                console.warn(`cache %O deleted, no data or expiry`, key);
            } else if ( cached?.expiry > Date.now() ) {
                console.warn(`cache %O recovered per %O.%O, expire in %Os`, key, topic, event?.id, (cached.expiry - Date.now())/1000);
                return cached?.data;
            } else {
                console.warn(`cache %O expired, retrieving data...`, key);
            }
        } else {
            console.warn(`no cache exists per %O.%O, retrieving data...`, topic, event?.id);
        }

        const data = this.handler_.constructor.name == 'AsyncFunction' ? await this.handler_(topic, event) : this.handler_(topic, event);
        if ( data ) {
            await this.bus_.set(key, { data: data, expiry: Date.now() + this.expiry_ });
            console.error(`data retrieved per %O.%O, cache %O updated, expire in %Os`, topic, event?.id, key, this.expiry_/1000);
        }
        return data;
    }

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
        const streams = await this.bus_.poll(this.topic_, this.last_id_, this.count_, this.block_);

        if ( !streams?.length ) { console.warn("topic %O drained", this.topic_); }
        else {
            let failed = false;

            for ( const [ topic, events ] of streams ) { // `topic_name` should equal to ${topic[i]}
                for ( const event of events ) {
                    try {
                        console.log('processing event %O.%O: %O', topic, event?.id, event?.body);
                        const data = await this.pop(topic, event);
                        if ( data ) { await this.bus_.free(topic, event.id); }
                        else {
                            console.error(`no data retrieved per %O.%O: %O`, topic, event?.id, event?.body);
                            failed = true;
                        }

                        // update last processed event_id if all succeeded
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