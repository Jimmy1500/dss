const { hash, axios, jsonOf, hashOf, cacheOf, stash, merge } = require('./Core')
const { Bus } = require('./Bus');
const { App, NETWORK_TYPE } = require('./App');
const { Cluster, CLUSTER_STATUS } = require('./Cluster');
const { LOCALE, REDIS, AWS, GIT } = require('./Env');

const Config = {
    NETWORK_TYPE,
    CLUSTER_STATUS,
    FAILOVER_RETRY: 2,
    IDLE_STRATEGY:  5,
    POLL_SIZE:      50,
    BLOCK_ON_EMPTY: 500,
    CACHE: {
        DATA_EXPIRY: 10000,
        USER_EXPIRY: 600000,   
        REPO_EXPIRY: 400000,
    },
    LOCALE,
    REDIS,
    AWS,
    GIT
}

module.exports = {
    hash,
    axios,
    jsonOf,
    hashOf,
    cacheOf,
    stash,
    merge,
    Bus,
    App,
    Cluster,
    Config
}