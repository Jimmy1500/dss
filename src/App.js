'use strict'
const uuid = require('uuid');
const { Bus } = require('./Bus');
const { REDIS } = require('./Env');

function jsonOf(string) {
    try { return JSON.parse(string); } catch (error) { return string; }
}

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
        handler = async (bus, topic, event, expiry) => { console.warn("%O.%O handled, expiry %O", topic, event.id, expiry); }
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
    async work(retries = 1) {
        if ( retries < 0 ) { throw new EvalError('no retries specified'); }

        const streams = await this.bus_.poll(this.topic_, this.last_id_, this.count_, this.block_);
        if ( !streams?.length ) { console.warn("topic %O drained", this.topic_); }
        else {
            for ( const [ topic, events ] of streams ) { // `topic` should equal to ${topic[i]}
                let yes = true;
                for ( const event of events ) { 
                    try {
                        console.log('# handling %O.%O: %O', topic, event?.id, event?.body);
                        switch ( this.handler_.constructor.name ) {
                            case 'AsyncFunction': await this.handler_(this.bus_, topic, event, this.expiry_); break;
                            default:                    this.handler_(this.bus_, topic, event, this.expiry_); break;
                        }
                        await this.bus_.free(topic, event.id);

                        if ( yes ) {
                            // update last processed event_id if all succeeded
                            if ( Array.isArray(this.topic_) ) {
                                const index = this.topic_.length > 1 ? this.topic_.findIndex(name => name == topic) : 0;
                                this.last_id_[index] = event.id;
                            } else {
                                this.last_id_ = event.id;
                            }
                        }
                    } catch( error ) {
                        yes = false;
                        const retry_key = `retry.${topic}.${event.id}`;
                        let retry = Number(await this.bus_.get(retry_key) || 0);

                        if ( ++retry >= retries ) {
                            const body = jsonOf(event?.body);

                            // event -> error event
                            await this.bus_.del (retry_key);
                            await this.bus_.free(topic, event.id);
                            await this.bus_.push(topic, {
                                error: {
                                    code:    'FAILURE',
                                    message: `cannot handle request, retried ${retry} of ${retries}`,
                                    request:  body
                                },
                                callback: body?.callback
                            });
                            console.error("%O.%O freed, %O, retried %O of %O", topic, event.id, error.message, retry, retries);
                        } else {
                            await this.bus_.set(retry_key, retry);
                            console.error("%O.%O failed, %O, retried %O of %O", topic, event.id, error.stack, retry, retries);
                        }
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