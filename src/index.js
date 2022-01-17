const lib = require('./lib')
const { Bus } = require('./Bus');
const { App, NETWORK_TYPE } = require('./App');
const { Cluster, CLUSTER_STATUS } = require('./Cluster');
const { LOCALE, REDIS, AWS, GIT } = require('./Env');

const Config = {
    NETWORK_TYPE,
    CLUSTER_STATUS,
    IDLE_STRATEGY:  5,
    POLL_SIZE:      50,
    BLOCK_ON_EMPTY: 1000,
    CACHE: {
        USER_EXPIRY: 600000,   
        REPO_EXPIRY: 400000,
    },
    LOCALE,
    REDIS,
    AWS,
    GIT
}

module.exports = {
    lib,
    Bus,
    App,
    Cluster,
    Config
}