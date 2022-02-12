'use strict'
const { NETWORK_TYPE, CLUSTER_STATUS, REDIS } = require('./Config')
const { Bus } = require('./Bus')
const { uuid, checkBrowser } = require('./Util');

class Cluster {
    constructor(
        browser,
        network_type = NETWORK_TYPE.SHARED,
        idle         = 0 | 0,
    ) {
        if ( typeof idle != 'number' || idle < 0 ) { throw new EvalError(`invalid idle ${idle}`); }
        checkBrowser(browser);

        switch( network_type ) {
            case NETWORK_TYPE.SHARED: this.bus_ = new Bus(); break;
            default:                  this.bus_ = null;      break;
        }
        this.browser_   = browser;
        this.apps_      = [];
        this.state_     = CLUSTER_STATUS.IDLE;
        this.idle_      = idle;
        this.id_        = uuid.v4();
        console.log('cluster %O created, idle_strategy: %O ms', this.id_, this.idle_);
    }

    /* --------------- primary interface --------------- */
    id()          { return this.id_;      }
    network()     { return this.bus_;     }
    browser()     { return this.browser_; }
    report(status){ this.state_ = status; }
    halt()        { this.report(CLUSTER_STATUS.HALTED); }
    workable(app) { return typeof app?.start == 'function' && typeof app?.stop == 'function' && typeof app?.work == 'function' && typeof app?.id == 'function'; }

    deploy(apps)  {
        switch(this.state_) {
            case CLUSTER_STATUS.IDLE:
                if ( Array.isArray(apps) ) {
                    for ( const app of apps ) {
                        if ( this.workable(app) ) {
                            this.apps_.push(app);
                            console.log('app %O deployed', app.id());
                        } else { console.warn(`cannot deploy app to cluster, invalid type ${typeof app}`); }
                    }
                } else if ( this.workable(apps) ) {
                    this.apps_.push(apps);
                    console.log('apps %O deployed', apps.id());
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
                if ( this.bus_ ) {
                    this.bus_.connect({ port: REDIS.PORT, host: REDIS.HOST, db: 0, /* username: , password: */ });
                    console.log('cluster network connected');
                }
                for ( const app of this.apps_ ) { await app.start(); }
                this.report(CLUSTER_STATUS.STARTED);
                break;
            default: throw new EvalError(`cannot start cluster, invalid cluster state: ${this.state_}`);
        }
        console.log(`cluster started`);
    }

    async stop() {
        console.log(`cluster stopping...`);
        switch(this.state_) {
            case CLUSTER_STATUS.STARTED:
            case CLUSTER_STATUS.HALTED:
                for ( const app of this.apps_     ) { await app.stop(); }
                if  ( this.browser_.isConnected() ) { await this.browser_.close(); console.log('cluster browswer closed'); }
                if  ( this.bus_                   ) { this.bus_.disconnect(); console.log('cluster network disconnected'); }
                this.report(CLUSTER_STATUS.STOPPED);
                break;
            default: throw new EvalError(`cannot stop cluster, invalid cluster state: ${this.state_}`);
        }
        console.log(`cluster stopped`);
    }

    async work() {
        for ( const app of this.apps_ ) {
            try {
                await app.work();
            } catch (error) {
                console.error('app %O of cluster %O failed, %O', app.id(), this.id_, error.stack);
            }
        }
    }

    async run(period = 0) {
        if ( typeof period != 'number' || period < 0 ) { throw new EvalError(`invalid period ${period}`); }
        if ( period ) {
            console.log('running cluster %O, stop in %Os', this.id_, period/1000);
            this.wait(period).then( _ => this.halt());
        } else        { console.log('running cluster %O, indefinitely', this.id_); }

        let next = true;
        do {
            try {
                switch( this.state_ ) {
                    case CLUSTER_STATUS.DEPLOYED:   await this.start(); break;
                    case CLUSTER_STATUS.STARTED:    await this.work();  break;
                    case CLUSTER_STATUS.HALTED:     await this.stop();  break;
                    case CLUSTER_STATUS.STOPPED:    next = false;       break;
                    default: throw new EvalError(`cannot run cluster, invalid cluster state: ${this.state_}`);
                }
                if ( next && this.idle_ ) { await this.wait(this.idle_); }
            } catch ( error )  {
                next = false;
                console.error('cluster error, %O', error.stack);
                break;
            }
        } while ( next );
    }

    async wait(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }
}

module.exports = {
    Cluster,
}