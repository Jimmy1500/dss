'use strict'
const { config, jsonOf, idOf } = require('../lib');

/* TODO: S3 operation patterns
const { AWS } = require('../lib');
const fs = require("fs");

const aws    = new AWS(config.AWS.REGION, config.AWS.API_VERSION, config.AWS.S3.HOST);
const bucket = config.AWS.S3.BUCKET;
const files  = ['./file1.txt', './file2.txt'];
const zipped = 'zipped.zip';

for ( const key of files ) {
    if ( !await aws.s3().exists(bucket, key) ) { throw new EvalError(`no ${key} exists in ${bucket}`); }
    const file = {
        name: key,
        mimetype: 'application/txt',
        buffer: fs.readFileSync(key)
    }
    await aws.s3().upload(bucket, file, true);
}

await aws.s3().zip(bucket, files, zipped, true);
await aws.s3().delete(bucket, files);
*/

/* raw doc data -> doc data per API contract (per topic) */
async function docOf(topic, raw_doc) {
    if ( !topic?.length ) { throw new EvalError(`invalid topic ${topic}`);     }
    if ( !raw_doc       ) { throw new EvalError(`invalid raw_doc ${raw_doc}`); }

    /* TODO */
    switch( topic ) {
        case config.REDIS.TOPIC.DSS_AMZ_PT:
        case config.REDIS.TOPIC.DSS_IBM_EC:
        case config.REDIS.TOPIC.DSS_CRT_PF:
        case config.REDIS.TOPIC.DSS_CRT_PJ:
            /* [ {
                ds_remarks: pdf[15],
                ds_farmer_name: pdf[11],
                nr_cpf_cnpj: pdf[13],
                ds_certificate_number: pdf[5],
                ds_certificate_type: 'Negativa',
            } ] */
            return raw_doc;
        default: throw new EvalError(`invalid topic ${topic}`);
    }
}

async function dataOf(bus, topic, body, page) {
        if ( !bus                      ) { throw new EvalError(`invalid bus ${bus}`);     }
        if ( !topic?.length            ) { throw new EvalError(`invalid topic ${topic}`); }
        if ( !page || page?.isClosed() ) { throw new EvalError(`invalid page ${page}`);   }

        const tax_id = body?.tax_id?.trim();
        const page_url = page.url();
        if ( !tax_id?.length           ) { throw new EvalError(`invalid body ${body}, no tax_id ${tax_id}`); }
        if ( !page_url?.length         ) { throw new EvalError(`invalid page ${page}, no url ${page_url}`);  }

        switch ( topic ) {
            case config.REDIS.TOPIC.DSS_AMZ_PT: { return body; }
            case config.REDIS.TOPIC.DSS_IBM_EC: {
                await page.locator('id=sit_isencao_lic_transporte_E').click();
                await page.locator('id=sit_desmatamento_T').click();
                await page.fill   ('id=num_cpf_cnpj', tax_id);
                await page.locator('id=Emitir_Certificado').click();

                await bus.wait(1000);
                const doc_url = await page.evaluate(() => {
                    const iframe = document.querySelector("iframe#iframe_formdin_area_sub_1");
                    for ( const attr of iframe?.attributes ) {
                        if ( attr?.nodeName === 'src' ) { return attr?.nodeValue; }
                        else { continue; }
                    }
                    return null;
                });

                if ( !doc_url?.length ) { throw new EvalError(`invalid doc_url ${url} per topic ${topic}`); }
                await page.goto( doc_url );

                await bus.wait(1000);
                const raw_doc = await page.evaluate(() => {
                    const spans = document.querySelectorAll("div#viewer.pdfViewer > div.page > div.textLayer > span");
                    const doc = [];
                    for ( const span of spans ) {
                        const txt = span.innerText?.trim();
                        if ( txt?.length ) { doc.push(txt); }
                    }
                    return doc;
                });

                await page.goto( page_url );
                return { ...body, data: { document: await docOf(topic, raw_doc) } };
            }
            case config.REDIS.TOPIC.DSS_CRT_PF:
            case config.REDIS.TOPIC.DSS_CRT_PJ: { return body; }
            default: throw new EvalError(`invalid topic ${topic}`);
        }
    }

// get valid cache, or get data from source (updates cache optionally)
async function cacheOf(bus, topic, body = null, expiry = 0, page = null) {
    const tax_id = body?.tax_id?.trim();
    if ( !tax_id?.length ) { throw new EvalError(`invalid tax_id ${tax_id} in body ${body}`); }
    if ( !topic?.length  ) { throw new EvalError(`invalid topic ${topic}`);                   }

    const prefix = 'cache';
    const key = idOf(prefix, [topic, tax_id]);
    const val = await bus.get(key);
    if ( val ) {
        const cache = jsonOf(val);
        if ( !cache?.data || !cache?.expiry ) {
            await bus.del(key);
            console.warn(`cache %O purged for %O, no data or expiry specified`, key, topic);
        } else if ( cache.expiry > Date.now() ) {
            console.warn(`cache %O valid for %O, expires in %Os`, key, topic, (cache.expiry - Date.now())/1000);
            return cache?.data;
        } else { console.warn(`cache %O expired for %O`, key, topic); }
    } else { console.warn(`no cache %O exists for %O`, key, topic); }

    // update cache per doc type (topic)
    if ( page ) {
        const data = await dataOf(bus, topic, body, page);
        await stash(bus, prefix, [topic, tax_id], data, expiry);
        return data;
    }
    return null;
}

// stash data
async function stash(bus, prefix, ids, data, expiry = 0) {
    if ( !data                                   ) { throw new EvalError(`invalid data ${data}`);     }
    if ( typeof expiry != 'number' || expiry < 0 ) { throw new EvalError(`invalid expiry ${expiry}`); }
    else if ( expiry ) {
        const key = idOf(prefix, ids);
        const val = { data: data, expiry: Date.now() + expiry };
        await bus.set(key, val);
        console.log(`cache %O stashed for %O, expires in %Os`, key, ids, expiry/1000);
    }
}

module.exports = {
    docOf,
    dataOf,
    cacheOf,
    stash,
}