'use strict'
const { BUS_TYPE, Bus } = require("./Bus");
const { ENV, REDIS, AWS, GIT } = require('./Config')

const CLUSTER_STATUS =  {
    IDLE:               'IDLE',
    DEPLOYED:           'DEPLOYED',
    STARTED:            'STARTED',
    SHUTDOWN:           'SHUTDOWN',
    STOPPED:            'STOPPED'
}

class Cluster {
    constructor(bus_type = BUS_TYPE.SHARED) {
        switch( bus_type ) {
            case BUS_TYPE.SHARED:
                this.bus_ = new Bus();
                break;
            default:
                this.bus_ = null;
                break;
        }
        this.apps_ = [];
        this.state_ = CLUSTER_STATUS.IDLE;
    }

    /* --------------- primary interface --------------- */
    network()     { return this.bus_; }
    report(status){ this.state_ = status; }
    shutdown()    { this.report(CLUSTER_STATUS.SHUTDOWN); }

    deploy(apps) {
        switch(this.state_) {
            case CLUSTER_STATUS.IDLE:
                if ( Array.isArray(apps) ) {
                    for ( const app of apps ) { this.apps_.push(app); }
                } else {
                    this.apps_.push(apps);
                }
                this.report(CLUSTER_STATUS.DEPLOYED);
                break;
            default: throw new EvalError(`cannot deploy app to cluster, invalid cluster state: ${this.state_}`);
        }
    }

    async start() {
        if ( this.bus_ ) { this.bus_.connect({ port: REDIS.PORT, host: REDIS.HOST, db: 0, /* username: , password: */ }); }
        switch(this.state_) {
            case CLUSTER_STATUS.DEPLOYED:
            case CLUSTER_STATUS.STOPPED:
                for ( const app of this.apps_ ) { await app.start(); }
                this.report(CLUSTER_STATUS.STARTED);
                break;
            default: throw new EvalError(`cannot start cluster, invalid cluster state: ${this.state_}`);
        }
    }

    async stop() {
        switch(this.state_) {
            case CLUSTER_STATUS.STARTED:
                for ( const app of this.apps_ ) { await app.stop(); }
                this.report(CLUSTER_STATUS.STOPPED);
                break;
            default: throw new EvalError(`cannot stop cluster, invalid cluster state: ${this.state_}`);
        }
        if ( this.bus_ ) { this.bus_.disconnect(); }
    }


    async work() {
        for ( const app of this.apps_ ) { await app.work(); }
    }

    async run() {
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
                    default: throw new EvalError(`cannot run cluster, invalid cluster state: ${this.state_}`);
                }
            } catch ( e )  {
                console.log(e.stack);
                break;
            }
        } while (true);
    }
}

module.exports = {
    CLUSTER_STATUS,
    Cluster
}