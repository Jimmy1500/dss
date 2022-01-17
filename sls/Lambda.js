'use strict'
const { Bus, Config } = require('../src');

const bus = new Bus();

async function health(event) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: event,
      },null, 2),
    };
}

async function data(event){
    bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ });
    bus.disconnect();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'data requested',
        input: { body: event.body },
      },null, 2),
    };
}

async function webhook(event){
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: { body: event.body },
      },null, 2),
    };
}

module.exports = {
    health,
    data,
    webhook
}