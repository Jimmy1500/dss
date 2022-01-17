'use strict'
const hash = require('object-hash');
const { default: axios } = require('axios');

async function cacheOf(bus, topic, event, expiry = 0, url = null) {
    const body  = JSON.parse(event?.body);
    if ( !(body instanceof Object)         ) { throw new TypeError('no body specified in event');           }
    if ( typeof body?.user     != 'string' ) { throw new TypeError('no user specified in event body');      }

    const key   = hash.sha1({ id: `${topic}|${body?.user}` });
    const cache = await bus.get(key);
    if ( cache ) {
        const cached = JSON.parse(cache);
        if ( !cached?.data || !cached?.expiry ) {
            await bus.del(key);
            console.warn(`cache %O purged, no data or expiry specified`, key);
        } else if ( cached.expiry > Date.now() ) {
            console.warn(`cache %O valid, expire in %Os`, key, (cached.expiry - Date.now())/1000);
            return cached?.data;
        } else { console.warn(`cache %O expired`, key); }
    } else { console.warn(`no cache %O exists`, key); }

    // refresh cache if source api url is specified
    if ( url?.length ) {
        const res = await axios.get(url);
        await bus.set(key, { data: res?.data, expiry: Date.now() + expiry });
        console.log(`(%O) %O, cache %O updated, expire in %Os`, res?.status, url, key, expiry/1000);
        return res?.data;
    }
    return null;
}

async function merge(user, user_data, repo_data) {
    if ( typeof user != 'string' ) { throw new TypeError('username must be string'); }
    if ( user_data && repo_data ) {
        return {
            user_name:      user_data?.login,
            display_name:   user_data?.name ,
            avatar:         user_data?.avatar_url,
            geo_location:   user_data?.location,
            email:          user_data?.email,
            url:            user_data?.url,
            created_at:     (user_data?.created_at || new Date().toISOString()).replace('T', ' ').replace('Z', ''),
            repos:          repo_data?.map(r => {
                return {
                    name: r?.name,
                    url:  r?.html_url
                }
            }),
            code: 'SUCCESS',
            message: `data recovered for user '${user}'`,
        };
    } else {
        if ( !user_data ) { throw new EvalError(`missing user data`); }
        if ( !repo_data ) { throw new EvalError(`missing repo data`); }
    }
}

module.exports = {
    hash,
    axios,
    cacheOf,
    merge,
}