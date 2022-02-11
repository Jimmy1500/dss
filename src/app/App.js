'use strict'
const { config, Bus, uuid, jsonOf, idOf, checkBrowser, browse } = require('../lib');
const { NETWORK_TYPE, REDIS } = config;

class App {
    constructor(
        bus,
        browser,
        topic,
        last_id = 0,
        count   = 50     | 0,
        block   = 0      | 0,
        expiry  = 300000 | 0,
        retries = 1      | 0,
    ) {
        if ( typeof topic    != 'string' && !Array.isArray(topic)   ) { throw new EvalError(`invalid topic ${topic}`);     }
        if ( typeof last_id  != 'number' && !Array.isArray(last_id) ) { throw new EvalError(`invalid last_id ${last_id}`); }
        if ( typeof count    != 'number'   || count   <= 0          ) { throw new EvalError(`invalid count ${count}`);     }
        if ( typeof block    != 'number'   || block   <  0          ) { throw new EvalError(`invalid block ${block}`);     }
        if ( typeof expiry   != 'number'   || expiry  <  0          ) { throw new EvalError(`invalid expiry ${expiry}`);   }
        if ( typeof retries  != 'number'   || retries <  0          ) { throw new EvalError(`invalid retries ${retries}`); }
        checkBrowser(browser);

        if ( !bus ) {
            this.bus_          = new Bus();
            this.network_type_ = NETWORK_TYPE.PRIVATE;
        } else if ( bus instanceof Bus ) {
            this.bus_          = bus;
            this.network_type_ = NETWORK_TYPE.SHARED;
        } else {
            throw new TypeError('bus must be instance of Bus');
        }
        this.browser_ = browser;
        this.topic_     = topic;
        this.last_id_   = topic?.length === last_id?.length ? last_id : ( Array.isArray(topic) ? Array(topic?.length).fill(0) : 0 );
        this.count_     = count   | 0;
        this.block_     = block   | 0;
        this.expiry_    = expiry  | 0;
        this.retries_   = retries | 0;
        this.id_        = uuid.v4();
        console.log('app %O created, topic: %O, network type: %O', this.id_, this.topic_, this.network_type_);
    }

    /* --------------- primary interface --------------- */
    id()          { return this.id_; }
    network()     { return this.bus_; }
    wire(reactor) {
        if ( typeof reactor?.on != 'function' ) { throw new EvalError(`invalid reactor interface on(data) ${reactor?.on}`); }
        this.reactor_ = reactor;
    }

    async start() {
        switch (this.network_type_) {
            case NETWORK_TYPE.PRIVATE:
                if ( !this.bus_ ) { throw new EvalError(`app ${this.id()} cannot connect, invalid private network ${this.bus_}`); }
                this.bus_.connect({ port: REDIS.PORT, host: REDIS.HOST, db: 0, /* username: , password: */ });
                console.log('app network connected');
                break;
            default: break;
        }
        console.log('app %O started', this.id_);
    }

    async stop() {
        switch (this.network_type_) {
            case NETWORK_TYPE.PRIVATE:
                if ( !this.bus_ ) { throw new EvalError(`app ${this.id()} cannot disconnect, invalid private network ${this.bus_}`); }
                this.bus_.disconnect();
                console.log('app network disconnected');
                break;
            default: break;
        }
        console.log('app %O stopped, last event id: %O', this.id_, this.last_id_);
    }

    async work() {
        if ( !this.reactor_?.on ) { throw new EvalError(`invalid reactor interface on(data) ${reactor?.on}`); }

        const streams = await this.bus_.poll(this.topic_, this.last_id_, this.count_, this.block_);
        if ( !streams?.length ) { console.warn("topic %O drained", this.topic_); }
        else {
            for ( const [ topic, events ] of streams ) { // `topic` should equal to ${topic[i]}
                const { context, page } = await browse(topic, this.browser_);

                let next = true;
                for ( const event of events ) { 
                    try {
                        switch ( this.reactor_.on.constructor.name ) {
                            case 'AsyncFunction': await this.reactor_.on({ topic: topic, event: event, expiry: this.expiry_, page: page }); break;
                            default:                    this.reactor_.on({ topic: topic, event: event, expiry: this.expiry_, page: page }); break;
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
                        const key = idOf('retry', [topic, event?.id]);
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
                                    message: `cannot handle request, ${error.message}, retried ${retry} of ${this.retries_}`,
                                    body:    jsonOf(event?.body)
                                },
                            });
                        }
                        console.error("%O.%O failed %O of %O, %O", topic, event.id, retry, this.retries_, error.stack);
                    }
                } // for ( const event of events )

                if ( page    ) { await page.close();    }
                if ( context ) { await context.close(); }
            } // for ( const [ topic, events ] of streams ) { // `topic` should equal to ${topic[i]}
        }
    }
}

module.exports = {
    App
}