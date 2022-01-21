'use strict'
const { Config, jsonOf, Bus } = require('../src/lib');
const { cacheOf, stash, merge } = require('../src/app')

const bus = new Bus();

async function health(event) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'serverless health check: functions online!',
      event: event,
    },null, 2),
  };
}

async function getDataSync(event){
  const body = jsonOf(event.body);
  const user = body.user;

  bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ })
  let this_data = await cacheOf(bus, Config.REDIS.TOPIC.M3_DATA, user);
  if ( !this_data ) {
      try {
          const rate_url  = `${Config.GIT.API_BASE_URL}/rate_limit`;
          const this_user = await cacheOf(bus, Config.REDIS.TOPIC.M3_USER, user, Config.CACHE.EXPIRY.USER, `${Config.GIT.API_BASE_URL}/users/${user}`,       rate_url);
          const this_repo = await cacheOf(bus, Config.REDIS.TOPIC.M3_REPO, user, Config.CACHE.EXPIRY.REPO, `${Config.GIT.API_BASE_URL}/users/${user}/repos`, rate_url);
          this_data       = await merge  (user, this_user, this_repo);
      } catch ( error ) {
          this_data       = { code: 'FAILURE', message: `no data recovered for user '${user}', ${error.message}`, body: body };
      }
      stash(bus, Config.REDIS.TOPIC.M3_DATA, user, this_data, Config.CACHE.EXPIRY.DATA);
  }
  bus.disconnect();

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'data requested (sync)',
      req: body,
      res: this_data,
    },null, 2),
  };
}

async function getDataAsync(event){
  const body = jsonOf(event.body);

  bus.connect({ port: Config.REDIS.PORT, host: Config.REDIS.HOST, db: 0, /* username: , password: */ })
  await bus.push(Config.REDIS.TOPIC.M3_DATA, body);
  bus.disconnect();

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'data requested (async)',
      req: body
    },null, 2),
  };
}

async function callback(event){
  return {
    statusCode: 200,
    body: JSON.stringify({
      code: 'SUCCESS',
      message: 'callback received!',
      req: jsonOf(event.body)
    },null, 2),
  };
}

module.exports = {
  health,
  getDataSync,
  getDataAsync,
  callback
}