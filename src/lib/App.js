'use strict'
const uuid = require('uuid');
const { Bus } = require('./Bus');
const { jsonOf } = require('./Util');
const { NETWORK_TYPE, REDIS } = require('./Config');

class App {
    constructor(
        bus,
        topic,
        last_id = 0,
        count   = 50,
        block   = 0,
        expiry  = 300000,
    ) {
        if ( typeof topic    != 'string' && !Array.isArray(topic)   ) { throw new EvalError(`invalid topic ${topic}`);     }
        if ( typeof last_id  != 'number' && !Array.isArray(last_id) ) { throw new EvalError(`invalid last_id ${last_id}`); }
        if ( typeof count    != 'number'   || count  <= 0           ) { throw new EvalError(`invalid count ${count}`);     }
        if ( typeof block    != 'number'   || block  < 0            ) { throw new EvalError(`invalid block ${block}`);     }
        if ( typeof expiry   != 'number'   || expiry < 0            ) { throw new EvalError(`invalid expiry ${expiry}`);   }

        if ( !bus ) {
            this.bus_          = new Bus();
            this.network_type_ = NETWORK_TYPE.PRIVATE;
        } else if ( bus instanceof Bus ) {
            this.bus_          = bus;
            this.network_type_ = NETWORK_TYPE.SHARED;
        } else {
            throw new TypeError('bus must be instance of Bus');
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
        this.expiry_    = expiry;
        this.id_        = uuid.v4();
        console.log('app %O created, topic: %O, network type: %O', this.id_, this.topic_, this.network_type_);
    }

    /* --------------- primary interface --------------- */
    id() { return this.id_; }
    network() { return this.bus_; }
    admit(reactor) {
        if ( typeof reactor?.on != 'function' ) { throw new EvalError(`invalid reactor ${reactor} interface, must implement on(data)`); }
        this.reactor_ = reactor;
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
                        switch ( this.reactor_.on.constructor.name ) {
                            case 'AsyncFunction': await this.reactor_.on({ topic: topic, event: event, expiry: this.expiry_ }); break;
                            default:                    this.reactor_.on({ topic: topic, event: event, expiry: this.expiry_ }); break;
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
                            // event -> error event
                            await this.bus_.del (retry_key);
                            await this.bus_.free(topic, event.id);
                            await this.bus_.push(topic, {
                                error: {
                                    code:    'FAILURE',
                                    message: `cannot handle request, retried ${retry} of ${retries}`,
                                    body:    jsonOf(event?.body)
                                },
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
    App
}