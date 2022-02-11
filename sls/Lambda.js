'use strict'
const { config, jsonOf, Bus } = require('../src/lib');

const bus = new Bus();

async function health(event) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'serverless health check: functions online!',
      event: event,
    }),
  };
}

async function getDoc(event){
  const body = jsonOf(event.body);
  try {
    if ( !body?.type?.length    ) { throw new EvalError(`invalid type ${body?.type}`);     }
    if ( !body?.tax_id?.length  ) { throw new EvalError(`invalid tax_id ${body?.tax_id}`); }

    switch ( body?.type ) {
      case config.REDIS.TOPIC.DSS_AMZ_PT:
      case config.REDIS.TOPIC.DSS_IBM_EC:
      case config.REDIS.TOPIC.DSS_CRT_PF:
      case config.REDIS.TOPIC.DSS_CRT_PJ:
        bus.connect({ port: config.REDIS.PORT, host: config.REDIS.HOST, db: 0, /* username: , password: */ })
        await bus.push(body?.type, body);
        bus.disconnect();
        break;
      default: throw new EvalError(`invalid type ${body?.type}, doc type not supported`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        code: 'SUCCESS',
        message: 'data request (async) succeeded!',
        req: body
      }),
    };

  } catch ( error ) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        code: 'FAILURE',
        message: `data request (async) failed, ${error.message}`,
        req: body
      }),
    };

  }
}

async function callback(event){
  const body = jsonOf(event.body);
  console.log(JSON.stringify(body));
  return {
    statusCode: 200,
    body: JSON.stringify({
      code: 'SUCCESS',
      message: 'callback received',
      req: body
    }),
  };
}



module.exports = {
  health,
  getDoc,
  callback
}