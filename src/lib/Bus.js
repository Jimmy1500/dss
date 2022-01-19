'use strict'
const Redis = require('ioredis');

// array -> object
function encode(array, object) {
    if ( array?.length % 2 || !object ) { throw new Error("cannot encode array -> object, expected: array.length % 2 == 0 && object"); }
    for (let i = 0; i < array.length; i += 2) {
        const key = array[i];
        const val = array[i+1];
        object[key] = val;
    }
    return object;
}     

// object -> array
function decode(object) {
    return Object.entries(object).reduce((array, entry) => [...array, ...entry], [])
}

/* 
    events: [                           ->  objects: [
        ${id}, [ ${key}, ${val}, ... ], ->      { id: ${id}, ${key}: ${val}, ... }
        ${id}, [ ${key}, ${val}, ... ], ->      { id: ${id}, ${key}: ${val}, ... }
        ...                             ->      ...
    ]                                   ->  ]
*/
function parse(events) { return events.map( ([id, data]) => { return encode(data, { id: id }); }); }

class Bus {
    constructor(type = 'redis') {
        this.type_ = type || 'redis',
        // enable array to json transformation for xread replies
        Redis.Command.setReplyTransformer('xread', (replies) => {
            if ( !replies?.length ) { return null; }
            if ( !Array.isArray(replies) ) { replies = [replies]; }
            for (const reply of replies) {
                const [ topic_name, events ] = reply;
                if ( !topic_name || !Array.isArray(events) ) { throw new EvalError('cannot parse events, expected: topic_name && Array.isArray(events)'); }
                reply[1] = parse(events);
            }
            return replies;
        });
        // enable array to json transformation for hgetall replies
        Redis.Command.setReplyTransformer("hgetall", (replies) => {
            if ( !replies?.length ) { return null; }
            if ( !Array.isArray(replies) ) { replies = [replies]; }
            return encode(replies, {});
        });
    }

    /* --------------- primary interface --------------- */
    // options?: IORedis.RedisOptions
    connect(options) { this.redis_ = new Redis(options); }
    disconnect()     { this.redis_.disconnect(); }

    /* messaging */
    async push(topic, event, event_id = null) {
        const id = event_id || '*';
        if ( !event ) { throw new EvalError("cannot push empty event"); }
        if ( typeof val == 'string' || typeof val == 'number' || typeof val == 'boolean' ) {
            return this.redis_.xadd(topic, id, ['body', event]);
        } else if ( event instanceof Object || Array.isArray(event) ) {
            return this.redis_.xadd(topic, id, ['body', JSON.stringify(event)]);
        } else {
            throw new TypeError(`cannot push invalid event of ${typeof event}`);
        }
    }

    async poll(topic, last_id, count = 50, block = 0) {
        if ( typeof count != 'number' || count <= 0 ) { throw new EvalError(`invalid count ${count}`); }
        if ( Array.isArray(topic) ) {
            if ( !Array.isArray(last_id) || topic.length != last_id.length ) {
                throw new EvalError(`mis-aligned, topic ${topic} vs. last_id ${last_id}`);
            }
            return await this.redis_.xread("count", count, "block", block, "STREAMS", ...topic, ...last_id);
        } else {
            if ( Array.isArray(last_id) ) {
                throw new EvalError(`mis-aligned, topic ${topic} vs. last_id ${last_id}`);
            }
            return await this.redis_.xread("count", count, "block", block, "STREAMS", topic, last_id);
        }
    }

    /* caching */
    async set(key, val, literal = true) {
        if ( literal ) {
            if ( val instanceof Object || Array.isArray(val) ) { return await this.redis_.set(key, JSON.stringify(val)); }
            if ( typeof val == 'string' || typeof val == 'number' || typeof val == 'boolean' ) { return await this.redis_.set(key, val); }
        } else {
            if ( Array.isArray(val) && !(val.length % 2)) { return await this.redis_.hset(key, ...val); }
            if (val instanceof Object) { return await this.redis_.hset(key, ...decode(val)); }
            if ( typeof val == 'string' || typeof val == 'number' || typeof val == 'boolean' ) { throw new TypeError(`invalid cache type invalid ${val}: ${typeof val}, use set(key,val,literal=true) instead`); }
        }
        throw new TypeError(`invalid cache type ${val}: ${typeof val}`)
    }
    async get(key, literal = true) {
        if ( literal ) {
            return new Promise((resolve, reject) => {
                this.redis_.get(key, (err, val) => {
                    if (err) { reject(err); }
                    else { resolve(val); }
                });
            });
        } else {
            return new Promise((resolve, reject) => {
                this.redis_.hgetall(key, (err, val) => {
                    if (err) { reject(err); }
                    else { resolve(val); }
                });
            });
        }
    }

    /* clean */
    async del(key) { return await this.redis_.del(key) }
    async free(topic_name, event_id) {
        await this.redis_.xdel(topic_name, event_id);
        await this.redis_.del(event_id);
    }
    async flush() { await this.redis_.flushall(); }

    /* util */
    async wait(ms){ return new Promise((resolve) => { setTimeout(resolve, ms); }); }
}; // class Bus

module.exports = {
    Bus: Bus
}