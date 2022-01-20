# Project M3

## How to Start
### Container (Recommended)
* prerequisite:
    * docker
    * docker-compose
    * aws
    * grep
    * gawk
* steps
    * spin up all containers [sls, app, redis, s3] online
    > peforms auto clean up, then calls `docker-compose up --build`
    ```
    ./bin/setup.sh
    ```
    * follow serverless logs (terminal panel 1)
    ```
    docker logs -f sls
    ```
    * follow app logs (terminal panel 2)
    ```
    docker logs -f app
    ```

## How to Play
### Option 1: `curl`
* Health (health)
> if you got some response, then congratulations, your service is online!
```
curl -X GET --url http://localhost:4000/dev/health
```
* Sync API (getDataSync)
> this returns data(or error) synchronously as the response of this call
```
curl -X POST --url http://localhost:4000/dev/data/sync --data '{"user": "octocat"}'
```
* Async API (getDataAsync)
> this returns data(or error) asynchronously via callback url if specified in request,  
> please monitor sls & app logs to observe what happens
```
curl -X POST --url http://localhost:4000/dev/data/async --data '{"user": "octocat", "callback": "http://sls:4000/dev/callback"}'
```
### Option 2: `get_data.sh`
> feeling lazy? got you covered!  
> use `bin/get_data.sh` instead to avoid headaches of typing/copy+paste:
```
./bin/get_data.sh --help
```

## Service Endpoints
### Serverless Functions
* base url
```
http://localhost:4000/dev
```
| API                                                    | Method | URL           | Description           | Example Request                                                    |
| :----------------------------------------------------: | :----: | :-----------: | :-------------------: | :---------------------------------------------------------------:  |
| [Health](http://localhost:4000/dev/health)             | GET    | /health       | health check          | `N/A`                                                              |
| [Sync API](http://localhost:4000/dev/data/sync)   | POST   | /data/sync    | get data (sync mode)  | `{"user": "octocat"}`                                              |
| [Async API](http://localhost:4000/dev/data/async) | POST   | /data/async   | get data (async mode) | `{"user": "octocat", "callback": "http://sls:4000/dev/callback" }` |

## Architecture
### Introduction
This service has an active, single-threaded event driven mechanism that performs:
* cache validation per individual expiry configuration
* data retrieval from source api
* individual cache update per user data, repo data and merged data(user + repo)
### Primary Components
* [Diagram](arch/app.png)
* Lambda:
    * hosts stateless api endpoints(health, getDataSync, getDataAsync, callback), serves request(s) and emits event(s) to messaging
* App Cluster:
    * hosts long running node application
    * cluster deploys and schedules app(s) via well defined interface
    * each app handles event(s) from one or more topic(s), updates and validates cache(s) per configurations, then sends data to callback if applicable
### Design Emphasis
* Event driven microservice cluster
* Unified messaging & caching interface
* Infinite horizontal scalability
* Efficient vertical scalability
* Clean seperation of concerns (business logic vs. cross cutting framework logic)
* Granular configurability (see src/index.Config)
    * individual cache expiry
    * event(s) failover retry
    * cluster/app network sharing
    * ...
### Design Patterns
* Scheduler (Cluster) -> Worker (App) -> Reactor (src/index.handler)
* Scheduler (Cluster) operates as finite-state machine 
* Workers (App) act on event(s) per reactor implementation (src/index.handler)
### System Intefaces
* Cluster (Scheduler)
    * deploy(apps: App | App[])
    * start()
    * stop()
    * work()
* App (Worker)
    * start()
    * stop()
    * work()
* Bus (Messaging)
    * push(topic: string, event: object | string | number | ...)
    * poll(topic: string)
* Bus (Caching)
    * get(key: string)
    * set(key: string, val: object | string)

## Development Instruction
### Container (Recommended)
* prerequisite:
    * vscode
    * docker
* steps  
    * open vscode
    * click "Open a Remote Window" (green button at the bottom left corner)
    * select option "Open Folder in Container"
    * nagivate to this project folder and confirm
    * work work work!
* it might take a moment for the development container to be built(1st time only), so go pour youself a coffee or tea!
