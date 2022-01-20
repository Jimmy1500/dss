'use strict'
const { Config, uuid, axios, jsonOf, Bus } = require('../lib');
const { cacheOf, stash, merge } = require('./Util');


class Reactor {
    constructor( bus ) {
        if ( !bus || !(bus instanceof Bus) ) { throw new EvalError(`invalid reactor network ${bus}`); }
        this.bus_ = bus;
        this.id_  = uuid.v4();
        console.log('reactor %O created', this.id_);
    }

    /* --------------- primary interface --------------- */
    id() { return this.id_; }

    async on({ topic = null, event = null, expiry = 0 }) {
        if ( !topic?.length             ) { throw new EvalError(`invalid topic ${topic}`);     }
        if ( !(event instanceof Object) ) { throw new EvalError(`invalid event ${event}`);     }
        if ( !event?.body?.length       ) { throw new EvalError(`invalid event.body ${body}`); }

        const body = jsonOf(event?.body);
        let this_data = body?.error;

        if ( !this_data ) {
            if ( !body?.user?.length ) { throw new EvalError('no user specified in event.body'); }

            const user = body.user;
            const rate_url = `${Config.GIT.API_BASE_URL}/rate_limit`;

            switch (topic) {
                case Config.REDIS.TOPIC.M3_DATA: {
                    // get data from cache/source api
                    this_data = await cacheOf(this.bus_, topic, user);
                    if ( !this_data ) {
                        try {
                            const this_user = await cacheOf(this.bus_, Config.REDIS.TOPIC.M3_USER, user, Config.CACHE.USER_EXPIRY, `${Config.GIT.API_BASE_URL}/users/${user}`,       rate_url);
                            const this_repo = await cacheOf(this.bus_, Config.REDIS.TOPIC.M3_REPO, user, Config.CACHE.REPO_EXPIRY, `${Config.GIT.API_BASE_URL}/users/${user}/repos`, rate_url);
                            this_data       = await merge  (user, this_user, this_repo);
                        } catch ( error ) {
                            this_data       = { code: 'FAILURE', message: `no data recovered for user '${user}', ${error.message}`, body: body };
                        }
                        stash(this.bus_, topic, user, this_data, expiry);
                    }
                    break;
                }
                case Config.REDIS.TOPIC.M3_USER: {
                    this_data = await cacheOf(this.bus_, topic, user, expiry, `${Config.GIT.API_BASE_URL}/users/${user}`,       rate_url);
                    break;
                }
                case Config.REDIS.TOPIC.M3_REPO: {
                    this_data = await cacheOf(this.bus_, topic, user, expiry, `${Config.GIT.API_BASE_URL}/users/${user}/repos`, rate_url);
                    break;
                }
                default: {
                    throw new EvalError('unrecognized event %O.%O', topic, event);
                }
            }
        }

        // send data via callback
        const url = body?.callback;
        if      ( !url?.length ) { console.warn('no callback specified per %O.%O, data will not be sent', topic, event.id); }
        else if ( !this_data   ) { console.warn('no data recovered per %O.%O, callback will not be hit',  topic, event.id); }
        else {
            try {
                const res = await axios.post(url, this_data)
                console.log(`(%O) %O: %O`, res?.status, url, this_data);
            } catch ( error ) {
                const status  = error?.response?.status        || 400;
                const message = error?.response?.data?.message || error?.message;
                switch ( status ) {
                    case 403: throw new EvalError(`(${status}) callback ${url} forbidden, ${message}`);
                    case 404: throw new EvalError(`(${status}) callback ${url} offline, ${message}`);
                    default:  throw new EvalError(`(${status}) callback ${url} failed, ${message}`);
                }
            }
        }
    } // on( data )
} // class Reactor

module.exports = {
    Reactor
}