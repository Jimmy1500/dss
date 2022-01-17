'use strict'
const hash = require('object-hash');
const { default: axios } = require('axios');

function hashOf(topic, user) {
    if ( !topic?.length ) { throw new TypeError('no topic specified'); }
    if ( !user?.length ) { throw new TypeError('no user specified'); }
    return hash.sha1({ cache_id: `${topic}|${user}` });
}

async function cacheOf(bus, topic, user, expiry = 0, url = null) {
    const key = hashOf(topic, user);
    const cache = await bus.get(key);
    if ( cache ) {
        const cached = JSON.parse(cache);
        if ( !cached?.data || !cached?.expiry ) {
            await bus.del(key);
            console.warn(`cache %O purged for %O, no data or expiry specified`, key, topic);
        } else if ( cached.expiry > Date.now() ) {
            console.warn(`cache %O valid for %O, expire in %Os`, key, topic, (cached.expiry - Date.now())/1000);
            return cached?.data;
        } else { console.warn(`cache %O expired for %O`, key, topic); }
    } else { console.warn(`no cache %O exists for %O`, key, topic); }

    // refresh cache if source api url is specified
    if ( url?.length ) {
        try {
            const res = await axios.get(url);
            await bus.set(key, { data: res?.data, expiry: Date.now() + expiry });
            console.log(`(%O) %O, cache %O updated for %O, expire in %Os`, res?.status, url, key, topic, expiry/1000);
            return res?.data;
        } catch ( error ) {
            const { status, data } = error?.response;
            switch ( status ) {
                case 403: throw new EvalError(`(${status}) api rate limit reached`);
                case 404:
                    switch ( data?.message ) {
                        case 'Not Found': throw new EvalError(`(${status}) user ${user} not found`);
                        default: throw new EvalError(`(${status}) api offline`);
                    }
                default: throw new EvalError(`(${status}) api failed`);
            }
        }
    }
    return null;
}

async function stash(bus, topic, user, data, expiry) {
    await bus.set(hashOf(topic, user), { data: data, expiry: Date.now() + expiry });
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
    hashOf,
    cacheOf,
    stash,
    merge,
}