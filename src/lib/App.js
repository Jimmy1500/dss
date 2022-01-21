'use strict'
const { NETWORK_TYPE, REDIS } = require('./Config');
const { uuid, jsonOf, hashOf } = require('./Util');
const { Bus } = require('./Bus');

function idOf(topic, event_id) {
    if ( !topic?.length ) { throw new EvalError(`invalid topic ${topic}`); }
    if ( !event_id?.length  ) { throw new EvalError(`invalid event_id ${event_id}`); }
    return hashOf(`retry.${topic}.${event_id}`);
}

class App {
    constructor(
        bus,
        topic,
        last_id = 0,
        count   = 50,
        block   = 0,
        expiry  = 300000,
        retries = 1,
    ) {
        if ( typeof topic    != 'string' && !Array.isArray(topic)   ) { throw new EvalError(`invalid topic ${topic}`);     }
        if ( typeof last_id  != 'number' && !Array.isArray(last_id) ) { throw new EvalError(`invalid last_id ${last_id}`); }
        if ( typeof count    != 'number'   || count   <= 0          ) { throw new EvalError(`invalid count ${count}`);     }
        if ( typeof block    != 'number'   || block   <  0          ) { throw new EvalError(`invalid block ${block}`);     }
        if ( typeof expiry   != 'number'   || expiry  <  0          ) { throw new EvalError(`invalid expiry ${expiry}`);   }
        if ( typeof retries  != 'number'   || retries <  0          ) { throw new EvalError(`invalid retries ${retries}`); }

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
        this.last_id_   = topic?.length === last_id?.length ? last_id : ( Array.isArray(topic) ? Array(topic?.length).fill(0) : 0 );
        this.count_     = count;
        this.block_     = block;
        this.expiry_    = expiry;
        this.retries_   = retries;
        this.id_        = uuid.v4();
        console.log('app %O created, topic: %O, network type: %O', this.id_, this.topic_, this.network_type_);
    }

    /* --------------- primary interface --------------- */
    id()          { return this.id_; }
    network()     { return this.bus_; }
    wire(reactor) {
        if ( typeof reactor?.on != 'function' ) { throw new EvalError(`invalid reactor, ${reactor?.on} interface, must implement on(data)`); }
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
    async work() {
        if ( !this.reactor_?.on ) { throw new EvalError(`invalid reactor, ${this.reactor_?.on} interface, must implement on(data)`); }

        const streams = await this.bus_.poll(this.topic_, this.last_id_, this.count_, this.block_);
        if ( !streams?.length ) { console.warn("topic %O drained", this.topic_); }
        else {
            for ( const [ topic, events ] of streams ) { // `topic` should equal to ${topic[i]}
                let next = true;
                for ( const event of events ) { 
                    try {
                        switch ( this.reactor_.on.constructor.name ) {
                            case 'AsyncFunction': await this.reactor_.on({ topic: topic, event: event, expiry: this.expiry_ }); break;
                            default:                    this.reactor_.on({ topic: topic, event: event, expiry: this.expiry_ }); break;
                        }
                        await this.bus_.free(topic, event.id);

                        if ( next ) {
                            // update last processed event_id if all succeeded
                            if ( Array.isArray(this.topic_) ) {
                                const index = this.topic_.length > 1 ? this.topic_.findIndex(name => name == topic) : 0;
                                this.last_id_[index] = event.id;
                            } else {
                                this.last_id_ = event.id;
                            }
                        }
                    } catch( error ) {
                        next = false;
                        const key = idOf(topic, event?.id);
                        let retry = Number(await this.bus_.get(key) || 0);

                        if ( ++retry < this.retries_ ) {
                            await this.bus_.set(key, retry);
                        } else {
                            // event -> error event
                            await this.bus_.del (key);
                            await this.bus_.free(topic, event.id);
                            await this.bus_.push(topic, {
                                error: {
                                    code:    'FAILURE',
                                    message: `cannot handle request, retried ${retry} of ${this.retries_}`,
                                    body:    jsonOf(event?.body)
                                },
                            });
                        }
                        console.error("%O.%O failed %O of %O, %O", topic, event.id, retry, this.retries_, error.stack);
                    }
                } // for ( const event of events )
            }
        }
    }
}

module.exports = {
    App
}