'use strict'
const uuid = require('uuid');
const { default: axios } = require('axios');
const { chromium, firefox, webkit } = require('playwright');
const { REDIS, WEB } = require('./Config');

function jsonOf(string) {
    if ( typeof string != 'string' ) { throw new TypeError(`invalid string ${string}, json conversion failed`); }
    try { return JSON.parse(string); } catch (error) { return string; }
}

function hashOf(key) {
    if ( !key?.length ) { throw new EvalError(`invalid key ${key}`); }
    return uuid.v5(key, uuid.v5.URL);
}

function idOf(prefix, ids) {
    if ( !Array.isArray(ids) || !ids?.length ) { throw new EvalError(`invalid ids ${ids}`); }
    return hashOf(`${prefix}.${ids.join('.')}`);
}

async function browserOf( browser_type = null, headless = true ) {
    const launch_option = { headless: headless };
    switch ( browser_type ) {
        case WEB.BROWSER.CHROME:    return await chromium.launch(launch_option);
        case WEB.BROWSER.FIREFOX:   return await firefox.launch(launch_option);
        case WEB.BROWSER.SAFARI:    return await webkit.launch(launch_option);
        default:
            const browsers = Object.values(WEB.BROWSER);
            const pick     = Math.floor( Math.random() * (browsers?.length || 1) ); // randomly pick 1 browser type
            switch ( browsers[pick] ) {
                case WEB.BROWSER.CHROME:    return await chromium.launch(launch_option);
                case WEB.BROWSER.FIREFOX:   return await firefox.launch(launch_option);
                case WEB.BROWSER.SAFARI:    return await webkit.launch(launch_option);
                default: throw new EvalError(`invalid browser_type ${type}, invalid index ${pick}`)
            }
    }
}

function checkBrowser(browser) {
    if ( !browser                                  ) { throw new EvalError(`invalid browser ${browser}`);                           }
    if ( typeof browser?.close       != 'function' ) { throw new EvalError(`invalid browser ${browser}, no browser.close()`);       }
    if ( typeof browser?.newPage     != 'function' ) { throw new EvalError(`invalid browser ${browser}, no browser.newPage()`);     }
    if ( typeof browser?.newContext  != 'function' ) { throw new EvalError(`invalid browser ${browser}, no browser.newContext()`);  }
    if ( typeof browser?.isConnected != 'function' ) { throw new EvalError(`invalid browser ${browser}, no browser.isConnected()`); }
    if ( !browser.isConnected()                    ) { throw new EvalError(`invalid browser ${browser}, isConnected=false`);        }
}

function watchPage(page) {
    if ( !page ) { throw new EvalError(`invalid page ${page}`); }
    page.once('load',             () => { console.log('page %O loaded',       page.url()); });
    page.once('popup',            () => { console.log('page %O popped',       page.url()); });
    page.once('close',            () => { console.log('page %O closed',       page.url()); });
    page.once('frameattached',    () => { console.log('frame %O attached',    page.url()); });
    page.once('framenavigated',   () => { console.log('frame %O navigated',   page.url()); });
    page.once('framedetached',    () => { console.log('frame %O dettached',   page.url()); });
}

async function browse( topic, browser, watch = true ) {
    if ( !topic?.length    ) { throw new EvalError(`invalid topic ${topic}`);           }

    const url = WEB.URL[topic];
    if ( !url?.length      ) { throw new EvalError(`no url mapped for topic ${topic}`); }
    checkBrowser(browser);

    switch( topic ) {
        case REDIS.TOPIC.DSS_AMZ_PT:
        case REDIS.TOPIC.DSS_IBM_EC:
        case REDIS.TOPIC.DSS_CRT_PF:
        case REDIS.TOPIC.DSS_CRT_PJ: {
            const context = await browser.newContext({ ignoreHTTPSErrors: true });
            const page    = await context.newPage();
            if ( watch ) { watchPage(page); }
            await page.goto( url );
            return { context, page };
        }
        default: throw new EvalError(`invalid topic ${topic}`);
    }
}

module.exports = {
    uuid,
    axios,
    playwright: { chromium, firefox, webkit },
    jsonOf,
    hashOf,
    idOf,
    browserOf,
    checkBrowser,
    watchPage,
    browse,
}