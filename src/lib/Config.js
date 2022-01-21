'use strict'

const NETWORK_TYPE = {
    SHARED:     'SHARED',
    PRIVATE:    'PRIVATE'
}
const CLUSTER_STATUS = {
    IDLE:       'IDLE',
    DEPLOYED:   'DEPLOYED',
    STARTED:    'STARTED',
    HALTED:     'HALTED',
    STOPPED:    'STOPPED'
}
const IDLE = {
    PLAN: 5
}
const RETRY = {
    PLAN: 2
}
const POLL = {
    PLAN: 50
}
const BLOCK = {
    PLAN: 500
}
const CACHE = {
    EXPIRY: {
        DATA: 10000,
        USER: 600000,
        REPO: 400000,
    }
}


const LOCALE = process.env.NODE_ENV || 'LOCAL';

const REDIS = { 
    HOST:   process.env.REDIS_HOST || 'localhost',
    PORT:   process.env.REDIS_PORT || '6379',
    TOPIC: {
        M3_DATA: 'M3_DATA',
        M3_USER: 'M3_USER',
        M3_REPO: 'M3_REPO',
    },
}

const AWS = {
    REGION:             process.env.AWS_REGION            || 'us-east-1',
    ACCESS_KEY_ID:      process.env.AWS_ACCESS_KEY_ID     || 'FAKE',
    SECRET_ACCESS_KEY:  process.env.AWS_SECRET_ACCESS_KEY || 'FAKE',
    API_VERSION:        process.env.AWS_API_VERSION       || '2006-03-01',
    S3: {
        HOST:           process.env.AWS_S3_HOST           || 'http://localhost:4566',
        BUCKET:         process.env.AWS_S3_BUCKET         || 'm3-api',
    }
}

const GIT = {
    ACCESS_TOKEN:       process.env.GIT_ACCESS_TOKEN      || 'FAKE',
    API_BASE_URL:       process.env.GIT_API_BASE_URL      || 'https://api.github.com'
}

module.exports = {
    NETWORK_TYPE,
    CLUSTER_STATUS,
    IDLE,
    RETRY,
    POLL,
    BLOCK,
    CACHE,
    LOCALE,
    REDIS,
    AWS,
    GIT
}