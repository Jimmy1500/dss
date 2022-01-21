'use strict'
const { axios, jsonOf, hashOf } = require('../lib')

function idOf(topic, user) {
    if ( !topic?.length ) { throw new EvalError(`invalid topic ${topic}`); }
    if ( !user?.length  ) { throw new EvalError(`invalid user ${user}`); }
    return hashOf(`data.${topic}.${user}`);
}

// get valid data, or get data from source api (refreshes data) with rate limit check (optional)
async function cacheOf(bus, topic, user, expiry = 0, url = null, rate_url = null) {
    if ( typeof expiry != 'number' || expiry < 0 ) { throw new EvalError(`invalid expiry ${expiry}`); }
    
    const key = idOf(topic, user);
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

    // refresh data if source api url is specified
    if ( url?.length ) {
        try {
            if ( rate_url?.length ) {
                const usage     = await axios.get(rate_url);
                const rate      = usage?.data?.rate;
                const limit     = rate?.limit     ?? 'N/A';
                const remaining = rate?.remaining ?? 0;
                const reset     = rate?.reset     ?? 'N/A';
                const used      = rate?.used      ?? 'N/A'

                if ( !remaining ) { throw new EvalError(`rate limit reached ${used} of ${limit}, resets in ${reset}s`); }
                console.log(`(%O) rate limit used %O of %O, %O left, resets in %Os`, usage.status, used, limit, remaining, reset);
            }

            const res = await axios.get(url);
            await bus.set(key, { data: res?.data, expiry: Date.now() + expiry });
            console.log(`(%O) %O, cache %O.%O updated, expires in %Os`, res?.status, url, topic, key, expiry/1000);
            return res?.data;
        } catch ( error ) {
            const status  = error?.response?.status         || 400;
            const message = error?.response?.data?.message  || error?.message;
            console.error('$(%O) api failed, %O', status, error.stack);
            switch ( status ) {
                case 403: throw new EvalError(`(${status}) api forbidden, ${message}`);
                case 404:
                    switch ( message ) {
                        case 'Not Found': throw new EvalError(`(${status}) user '${user}' not found`);
                        default:          throw new EvalError(`(${status}) api offline, ${message}`);
                    }
                default:                  throw new EvalError(`(${status}) api failed, ${message}`);
            }
        }
    }
    return null;
}

// stash data
async function stash(bus, topic, user, data, expiry = 0) {
    if ( !data                                   ) { throw new EvalError(`invalid data ${data}`);     }
    if ( typeof expiry != 'number' || expiry < 0 ) { throw new EvalError(`invalid expiry ${expiry}`); }
    if ( expiry ) {
        const key = idOf(topic, user);
        const val = { data: data, expiry: Date.now() + expiry };
        await bus.set(key, val);
    }
}

// merge user data and repo data into final output (view)
async function merge(user, user_data, repo_data) {
    if ( typeof user != 'string' || !user?.length ) { throw new EvalError(`invalid ${user}`); }
    if ( !user_data ) { throw new EvalError(`invalid user_data`); }
    if ( !repo_data ) { throw new EvalError(`invalid repo_data`); }

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
    cacheOf,
    stash,
    merge,
}