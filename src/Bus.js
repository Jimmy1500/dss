'use strict'
const Redis = require('ioredis');

// array -> object
function encode(array, object) {
    if ( array.length % 2 || !object ) { throw new Error("cannot encode array -> object, expected: array.length % 2 == 0 && object"); }
    for (let i = 0; i < array.length; i += 2) {
        const key = array[i];
        const val = array[i+1];
        object[key] = val;
    }
}     

/* 
    events: [                           ->  objects: [
        ${id}, [ ${key}, ${val}, ... ], ->      { id: ${id}, ${key}: ${val}, ... }
        ${id}, [ ${key}, ${val}, ... ], ->      { id: ${id}, ${key}: ${val}, ... }
        ...                             ->      ...
    ]                                   ->  ]
*/
function parse(events) {
    return events.map( ([id, data]) => {
        const object = { id: id }
        encode(data, object)
        return object;
    });
}

class Bus {
    constructor() {
        this.type = 'redis',
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
            return this.encode(replies);
        });
    }

    encode(array) { const object = {}; encode(array, object); return object; }

    /* --------------- primary interface --------------- */

    // options?: IORedis.RedisOptions
    connect(options) { this.redis_ = new Redis(options); }

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

    async pull(topic, last_id, block = 0, count = 10, fn = async (topic, event) => { console.warn("not processed: topic: %O, event: %O", topic, event); return false }) {
        if ( count <= 0 ) { count = 10; } 

        let streams;
        if ( Array.isArray(topic) ) {
            if ( !Array.isArray(last_id) || topic.length != last_id.length ) { last_id = Array(topic.length).fill(0); }
            streams = await this.redis_.xread("count", count, "block", block, "STREAMS", ...topic, ...last_id);
        } else {
            if ( Array.isArray(last_id) ) { last_id = 0; }
            streams = await this.redis_.xread("count", count, "block", block, "STREAMS", topic, last_id);
        }

        // console.log(`consuming ${streams.length} topic(s)`)
        if ( !Array.isArray(streams) ) {
            console.warn("topic %O drained", topic);
        } else {
            let failed = false;
            for ( const [ topic_name, events ] of streams ) { // `topic_name` should equals to ${topic[i]}
                // console.log("consuming topic: %O", topic_name)
                for ( const event of events ) {
                    try {
                        const done = fn.constructor.name == 'AsyncFunction' ? await fn(topic_name, event) : fn(topic_name, event)
                        if ( !done ) { failed = true; }
                        if ( !failed ) {
                            if ( Array.isArray(topic) ) {
                                const topic_index = topic.length > 1 ? topic.findIndex(name => name == topic_name) : 0;
                                last_id[topic_index] = event.id;
                            } else {
                                last_id = event.id;
                            }
                            await this.free(topic_name, event.id);
                        }
                    } catch( e ) {
                        failed = true;
                        console.error("event %O failed, critical error", e)
                    }
                } // for ( const event of events )
            }
        }
        return last_id;
    }

    /* cache */
    async set(key, val) {
        if ( typeof val == 'string' || typeof val == 'number' || typeof val == 'boolean' ) {
            return await this.redis_.set(key, val);
        } else if ( val instanceof Object || Array.isArray(val) ) {
            return await this.redis_.set(key, JSON.stringify(val));
        }
        throw new TypeError(`invalid cache type ${val}: ${typeof val}`)
    }
    async get(key) {
        return new Promise((resolve, reject) => {
            this.redis_.get(key, (err, val) => {
                if (err) { reject(err); }
                else { resolve(val); }
            });
        });
    }

    /* clean */
    async del(key) { return await this.redis_.del(key) }
    async free(topic_name, event_id) {
        await this.redis_.xdel(topic_name, event_id);
        await this.redis_.del(event_id);
    }
    async flush() { await this.redis_.flushall(); }
    async sleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }
}; // class Bus

module.exports = {
    Bus: Bus
}