'use strict'
const { Bus, uuid, axios, jsonOf } = require('../lib');
const { cacheOf } = require('./Tool');

class Reactor {
    constructor( bus ) {
        if ( !bus || !(bus instanceof Bus) ) { throw new EvalError(`invalid reactor network ${bus}`); }
        this.bus_ = bus;
        this.id_  = uuid.v4();
        console.log('reactor %O created', this.id_);
    }

    /* --------------- primary interface --------------- */
    id() { return this.id_; }

    /* reactor.on(data) */
    async on({ topic = null, event = null, expiry = 0, page = null }) {
        console.log('# reactor.on(%O.%O), %O', topic, event?.id, event?.body);
        if ( !topic?.length             ) { throw new EvalError(`invalid topic ${topic}`);      }
        if ( !(event instanceof Object) ) { throw new EvalError(`invalid event ${event}`);      }
        if ( !event?.body?.length       ) { throw new EvalError(`invalid event.body ${body}`);  }

        const body = jsonOf(event?.body);
        const data = body?.error    || await cacheOf(this.bus_, topic, body, expiry, page);
        const url  = body?.callback || body?.error?.body?.callback;

        if      ( !url?.length ) { console.warn('%O.%O: no callback specified, data will not be sent', topic, event.id); }
        else if ( !data        ) { console.warn('%O.%O: no data recovered, callback will not be hit',  topic, event.id); }
        else { // send data via callback
            try {
                const res = await axios.post(url, data);
                console.log(`(%O) %O: %O`, res?.status, url, data);
            } catch ( error ) {
                const status  = error?.response?.status        || 400;
                const message = error?.response?.data?.message || error?.message;
                switch ( status ) {
                    case 403: console.error('(%O) callback %O forbidden, %O', status, url, message); break;
                    case 404: console.error('(%O) callback %O offline, %O', status, url, message);   break;
                    default:  console.error('(%O) callback %O failed, %O', status, url, message);    break;
                }
            }
        }
    } // on( data )
} // class Reactor

module.exports = {
    Reactor
}