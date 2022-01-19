'use strict'
const { default: axios } = require('axios');
const hash = require('object-hash');

function jsonOf(string) {
    try { return JSON.parse(string); } catch (error) { return string; }
}

function hashOf(topic, user) {
    if ( !topic?.length ) { throw new TypeError('no topic specified'); }
    if ( !user?.length ) { throw new TypeError('no user specified'); }
    return hash.sha1({ cache_id: `${topic}|${user}` });
}

// get valid cache, or get data from source api (refreshes cache) with rate limit check (optional)
async function cacheOf(bus, topic, user, expiry = 0, url = null, rate_url = null) {
    if ( typeof expiry != 'number' || expiry < 0 ) { throw new EvalError('no expiry specified'); }

    const key = hashOf(topic, user);
    const val = await bus.get(key);
    if ( val ) {
        const value = jsonOf(val);
        if ( !value?.data || !value?.expiry ) {
            await bus.del(key);
            console.warn(`cache %O purged for %O, no data or expiry specified`, key, topic);
        } else if ( value.expiry > Date.now() ) {
            console.warn(`cache %O valid for %O, expires in %Os`, key, topic, (value.expiry - Date.now())/1000);
            return value?.data;
        } else { console.warn(`cache %O expired for %O`, key, topic); }
    } else { console.warn(`no cache %O exists for %O`, key, topic); }

    // refresh cache if source api url is specified
    if ( url?.length ) {
        try {
            if ( rate_url?.length ) {
                const usage     = await axios.get(rate_url);
                const rate      = usage?.data?.rate;
                const limit     = rate?.limit     || 'N/A';
                const remaining = rate?.remaining || 0;
                const reset     = rate?.reset     || 'N/A';
                const used      = rate?.used      || 'N/A'

                if ( !remaining ) { throw new EvalError(`rate limit reached ${used} of ${limit}, resets in ${reset}s`); }
                console.log(`(%O) rate limit used %O of %O, %O left, resets in %Os`, usage.status, used, limit, remaining, reset);
            }

            const res   = await axios.get(url);
            await bus.set(key, { data: res?.data, expiry: Date.now() + expiry });
            console.log(`(%O) %O, cache %O updated for %O, expires in %Os`, res?.status, url, key, topic, expiry/1000);
            return res?.data;
        } catch ( error ) {
            console.error('api failed', error.stack);
            const status  = error?.response?.status         || 400;
            const message = error?.response?.data?.message  || error.message;
            switch ( status ) {
                case 403: throw new EvalError(`(${status}) api forbidden, ${message}`);
                case 404:
                    switch ( message ) {
                        case 'Not Found': throw new EvalError(`(${status}) user '${user}' not found`);
                        default:          throw new EvalError(`(${status}) api offline, ${message}`);
                    }
                default: throw new EvalError(`(${status}) api failed, ${message}`);
            }
        }
    }
    return null;
}

// stash cache
async function stash(bus, topic, user, data, expiry = 0) {
    if ( !data ) { throw new EvalError('no data specified'); }
    if ( typeof expiry != 'number' || expiry < 0 ) { throw new EvalError('no expiry specified'); }
    if ( expiry ) {
        const key = hashOf(topic, user);
        const val = { data: data, expiry: Date.now() + expiry };
        await bus.set(key, val);
    }
}

// merge user data and repo data into final output (view)
async function merge(user, user_data, repo_data) {
    if ( typeof user != 'string' || !user?.length ) { throw new EvalError('no username specified'); }
    if ( !user_data ) { throw new EvalError(`missing user data`); }
    if ( !repo_data ) { throw new EvalError(`missing repo data`); }

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
}

module.exports = {
    axios,
    hash,
    jsonOf,
    hashOf,
    cacheOf,
    stash,
    merge,
}