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
    PLAN: 500   | 0,
}
const RETRY = {
    PLAN: 2     | 0,
}
const POLL = {
    PLAN: 100   | 0,
}
const BLOCK = {
    PLAN: 500   | 0,
}
const CACHE = {
    EXPIRY: {
        AMZ_PT: 600000  | 0,
        IBM_EC: 600000  | 0,
        CRT_PF: 600000  | 0,
        CRT_PJ: 600000  | 0,
    }
}

const AWS = {
    REGION:             process.env.AWS_REGION            || 'us-east-1',
    ACCESS_KEY_ID:      process.env.AWS_ACCESS_KEY_ID     || 'FAKE',
    SECRET_ACCESS_KEY:  process.env.AWS_SECRET_ACCESS_KEY || 'FAKE',
    API_VERSION:        process.env.AWS_API_VERSION       || '2006-03-01',
    S3: {
        HOST:           process.env.AWS_S3_HOST           || 'http://localhost:4566',
        BUCKET:         process.env.AWS_S3_BUCKET         || 'dss',
    }
}

const REDIS = {
    HOST:   process.env.REDIS_HOST  || 'localhost',
    PORT:   process.env.REDIS_PORT  || '6379',
    TOPIC: {
        DSS_AMZ_PT: 'DSS_AMZ_PT',
        DSS_IBM_EC: 'DSS_IBM_EC',
        DSS_CRT_PF: 'DSS_CRT_PF',
        DSS_CRT_PJ: 'DSS_CRT_PJ',
    },
}

const WEB = {
    HEADLESS:       false,
    BROWSER : {
        CHROME:     'CHROME',
        FIREFOX:    'FIREFOX',
        SAFARI:     'SAFARI',
    },
    URL: {
        DSS_AMZ_PT: process.env.URL_AMZ_PT || 'https://duckduckgo.com',
        DSS_IBM_EC: process.env.URL_IBM_EC || 'https://servicos.ibama.gov.br/ctf/publico/areasembargadas/ConsultaPublicaAreasEmbargadas.php',
        DSS_CRT_PF: process.env.URL_CRT_PF || 'https://duckduckgo.com',
        DSS_CRT_PJ: process.env.URL_CRT_PJ || 'https://duckduckgo.com',
    }
}

module.exports = {
    NETWORK_TYPE,
    CLUSTER_STATUS,
    IDLE,
    RETRY,
    POLL,
    BLOCK,
    CACHE,
    AWS,
    REDIS,
    WEB,
}