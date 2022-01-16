const { Bus } = require('./Bus');
const { App, NETWORK_TYPE } = require('./App');
const { Cluster, CLUSTER_STATUS } = require('./Cluster');
const { LOCALE, REDIS, AWS, GIT } = require('./Env');

const Config = {
    NETWORK_TYPE,
    CLUSTER_STATUS,
    IDLE_STRATEGY:  0,
    POLL_SIZE:      50,
    BLOCK_ON_EMPTY: 1000,
    CACHE: {
        USER_EXPIRY: 30000,   
        REPO_EXPIRY: 20000,
    },
    LOCALE,
    REDIS,
    AWS,
    GIT
}

module.exports = {
    Bus,
    App,
    Cluster,
    Config
}