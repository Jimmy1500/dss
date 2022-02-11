'use strict'
const { AWS: sdk } = require('aws-sdk');
const { Stream } = require('stream');
const archiver = require('archiver');

class S3 {
    constructor(
        api_version = null,
        host        = null
    ) {
        this.client_ = (
            !api_version?.length || !host?.length
        ) ? new sdk.S3() : new sdk.S3({
            apiVersion:         api_version,
            endpoint:           host,
            s3ForcePathStyle:   true
        });
    }

    async exists(bucket_name, file_name) {
        if( !bucket_name?.length) { throw new EvalError(`no bucket specified`); }
        if( !file_name?.length  ) { throw new EvalError(`no file specified to check in bucket ${bucket_name}`); }
        return new Promise((resolve, _) => {
            this.client_.headObject({ Bucket: bucket_name, Key: file_name }, (error, _) => {
                if ( error ) { resolve(false); }
                else         { resolve(true);  }
            })
        })
    }
    
    async upload(bucket_name, file, replace = false) {
        const file_name = file?.name || file?.originalname;
        if ( !file_name?.length      ) { throw new EvalError(`no file name specified`);                 }
        if ( !bucket_name?.length    ) { throw new EvalError(`no bucket name specified`);               }
        if ( !file?.buffer?.length   ) { throw new EvalError(`no buffer specified in ${file_name}`);    }
        if ( !file?.mimetype?.length ) { throw new EvalError(`no mime type specified in ${file_name}`); }
    
        if ( await this.exists(bucket_name, file_name) ) {
            if ( replace ) { await this.client_.deleteObject({ Bucket: bucket_name, Key: file_name }).promise(); }
            else           { throw new EvalError(`${file_name} exists in s3://${bucket_name}, replace=false`);  }
        }
    
        const upload = await new Promise((resolve, reject) => {
            this.client_.upload({ 
                Bucket:         bucket_name,
                Key:            file_name,
                Body:           file.buffer,
                ContentType:    file.mimetype
            }, (error, data) => {
                if ( error ) { return reject(error); }
                else         { return resolve(data); }
            });
        });
    
        return {
            mimeType: file.mimetype,
            location: upload.Location,
            bucket:   upload.Bucket,
            key:      upload.Key,
            name:     file_name,
            size:     file.size,
            content:  file.buffer
        }
    }
    
    async download(bucket_name, file_name) {
        return new Promise((resolve, reject) => {
            this.client_.getObject({ Bucket: bucket_name, Key: file_name }, (error, data) => {
                if (error) { reject(new EvalError(`no s3://${bucket_name}/${file_name}, ${error.message}`)); }
                else       { resolve(data); }
            });
        });
    }
    
    async delete(bucket_name, file_names) {
        if( !bucket_name?.length ) { throw new EvalError(`no bucket specified`); }
        if( !file_names?.length  ) { throw new EvalError(`no file names specified to check in bucket ${bucket_name}`); }

        const page = [];
        const size = 500;
        const keys = file_names.map(name => { return { Key: name }; })
        for ( const key of keys ) {
            page.push(key);
            if ( !(page?.length % size) ) {
                await this.client_.deleteObjects({ Bucket: bucket_name, Delete: { Objects: page } }).promise();
                page.splice(0, page?.length);
            }
        }
        if ( page?.length ) {
            await this.client_.deleteObjects({ Bucket: bucket_name, Delete: { Objects: page } }).promise();
        }
    }

    // [S3] unzipped files -- stream --> [Local] zipper -- stream --> [S3] zipped file
    async zip(bucket_name, unzipped, zipped, watch = true) {
        if( !bucket_name?.length     ) { throw new EvalError(`invalid bucket ${bucket}`);          }
        if( !Array.isArray(unzipped) ) { throw new EvalError(`invalid unzipped keys ${unzipped}`); }
    
        // make sure files exist
        for (const key of unzipped) {
            if ( !await this.exists(bucket_name, key) ) { throw new EvalError(`no key %O exists in %O`, key, bucket_name); }
        }
     
        // upload
        const pipe = new Stream.PassThrough();
        const upload = new Promise((resolve, reject) => {
            const send = this.client_.upload({
                ACL:            'private',
                Body:           pipe,
                Bucket:         bucket_name,
                ContentType:    'application/zip',
                Key:            zipped,
                StorageClass:   'STANDARD_IA'
            }, (error, data) => {
                if ( error ) { reject(`cannot stream to s3, ${error.message}, ${error.stack}`); }
                else         { resolve(data); }
            });
            if ( watch ) { send.on('httpUploadProgress', (uploaded) => { console.log("uploaded: %O", uploaded); }); }
        });

        // zip
        console.log('--- zip started ---');
        await new Promise((resolve, reject) => {
            // config streaming pipeline
            pipe.on('close', resolve);
            pipe.on('end',   resolve);
            pipe.on('error', reject);

            // config compressor
            const zipper = archiver('zip');
            zipper.on('error', error => reject(error));
            zipper.pipe(pipe);
    
            // download & compress
            for ( const key of unzipped ) {
                zipper.append(
                    this.client_.getObject({ Bucket: bucket_name, Key: key }).createReadStream(),
                    { name: key }
                );
            }
            zipper.finalize();
        }); 
        await upload;
        console.log('--- zip finished ---')
    }

} // S3

class AWS {
    constructor(
        region      = null,
        api_version = null,
        s3_host     = null,
    ) {
        if ( !region?.length ) { throw new EvalError(`invalid region ${region}`); }
        sdk.config.update({ region });
        this.s3_ = S3( api_version, s3_host );
    }

    s3() { return this.s3_; }
}

module.exports = {
    AWS
}