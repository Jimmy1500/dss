const { Bus } = require('./Bus');
const { App, NETWORK_TYPE } = require('./App');
const { Cluster, CLUSTER_STATUS } = require('./Cluster');
const { ENV, REDIS, AWS, GIT } = require('./Const');

const Config = {
    NETWORK_TYPE,
    CLUSTER_STATUS,
    IDLE_STRATEGY:  0,
    POLL_SIZE:      50,
    BLOCK_ON_EMPTY: 1000,
    ENV,
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