'use strict'
const { Bus } = require('./Bus')
const { App, NETWORK_TYPE } = require('./App');
const { REDIS } = require('./Const')

const CLUSTER_STATUS =  {
    IDLE:               'IDLE',
    DEPLOYED:           'DEPLOYED',
    STARTED:            'STARTED',
    SHUTDOWN:           'SHUTDOWN',
    STOPPED:            'STOPPED'
}

class Cluster {
    constructor(network_type = NETWORK_TYPE.SHARED, idle_ms = 0) {
        if ( typeof idle_ms != 'number' ) { throw new TypeError(`idle_ms must be number`); }

        switch( network_type ) {
            case NETWORK_TYPE.SHARED:
                this.bus_ = new Bus();
                break;
            default:
                this.bus_ = null;
                break;
        }
        this.apps_  = [];
        this.state_ = CLUSTER_STATUS.IDLE;
        this.idle_  = idle_ms > 0 ? idle_ms : 0;
        console.log('cluster created, idle_strategy: %O ms', this.idle_);
    }

    /* --------------- primary interface --------------- */
    network()     { return this.bus_; }
    report(status){ this.state_ = status; }
    shutdown()    { this.report(CLUSTER_STATUS.SHUTDOWN); }
    deploy(apps)  {
        switch(this.state_) {
            case CLUSTER_STATUS.IDLE:
                if ( apps instanceof App ) { this.apps_.push(apps); }
                else if ( Array.isArray(apps) ) {
                    for ( const app of apps ) {
                        if ( app instanceof App ) {
                            this.apps_.push(app);
                            console.log('app %O deployed', app.id());
                        } else {
                            console.warn(`cannot deploy app to cluster, invalid type ${typeof app}`);
                        }
                    }
                } else {
                    throw new EvalError(`cannot deploy app(s) to cluster, invalid type ${typeof apps}`);
                }
                this.report(CLUSTER_STATUS.DEPLOYED);
                break;
            default: throw new EvalError(`cannot deploy app to cluster, invalid cluster state ${this.state_}`);
        }
        console.log(`cluster deployed`);
    }

    async start() {
        switch(this.state_) {
            case CLUSTER_STATUS.DEPLOYED:
            case CLUSTER_STATUS.STOPPED:
                if ( this.bus_ ) { this.bus_.connect({ port: REDIS.PORT, host: REDIS.HOST, db: 0, /* username: , password: */ }); }
                for ( const app of this.apps_ ) { await app.start(); }
                this.report(CLUSTER_STATUS.STARTED);
                break;
            default: throw new EvalError(`cannot start cluster, invalid cluster state: ${this.state_}`);
        }
        console.log(`cluster started`);
    }

    async stop() {
        console.log(`cluster shutting down...`);
        switch(this.state_) {
            case CLUSTER_STATUS.STARTED:
            case CLUSTER_STATUS.SHUTDOWN:
                for ( const app of this.apps_ ) { await app.stop(); }
                if ( this.bus_ ) { this.bus_.disconnect(); }
                this.report(CLUSTER_STATUS.STOPPED);
                break;
            default: throw new EvalError(`cannot stop cluster, invalid cluster state: ${this.state_}`);
        }
        console.log(`cluster stopped`);
    }

    async work() {
        for ( const app of this.apps_ ) {
            await app.work();
            if ( this.idle_ ) { await this.wait(this.idle_); }
        }
    }

    async run() {
        let running = true;
        do {
            try {
                switch(this.state_) {
                    case CLUSTER_STATUS.DEPLOYED:
                        await this.start();
                        break;
                    case CLUSTER_STATUS.STARTED:
                        await this.work();
                        break;
                    case CLUSTER_STATUS.SHUTDOWN:
                        await this.stop();
                        break;
                    case CLUSTER_STATUS.STOPPED:
                        running = false;
                        break;
                    default: 
                        throw new EvalError(`cannot run cluster, invalid cluster state: ${this.state_}`);
                }
            } catch ( e )  {
                console.log(e.stack);
                running = false;
                break;
            }
        } while (running);
    }

    async wait(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }
}

module.exports = {
    CLUSTER_STATUS,
    Cluster,
}