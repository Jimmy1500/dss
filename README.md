# Project M3

## How to Start
### Prerequisite:
* docker
* docker-compose
* gawk
### Steps
1. spin up all containers [app, sls, redis, s3] online
> peforms auto clean up, then calls `docker-compose up --build`
```
./bin/setup.sh
```
2. follow serverless logs (terminal panel 1)
```
docker logs -f sls
```
3. follow app logs (terminal panel 2)
```
docker logs -f app
```

## How to Play
### Option 1: `curl`
* Health
> if you got some response, then congratulations, your service is online!
```
curl -X GET --url http://localhost:4000/dev/health
```
* Sync API
> this will return data(or error) synchronously as the response of this call
```
curl -X POST --url http://localhost:4000/dev/data/sync --data "{\"user\": \"octocat\"}"
```
* Async API
> this will return data(or error) asynchronously via callback url if specified in request, monitor sls & app logs to observe what happens
```
curl -X POST --url http://localhost:4000/dev/data/async --data "{\"user\": \"octocat\", \"callback\": \"http://sls:4000/dev/callback\"}"
```
### Option 2: `get_data.sh`
> Feeling lazy? Got you covered! use `bin/get_data.sh` instead to avoid typing/copy+paste headaches:
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
### Diagram
* [Application Flow](arch/app.png)
### Description


## Development Instruction
### Container (Recommended)
* prerequisite:
    * docker
* steps  
    * open vscode
    * click "Open a Remote Window" (green button at the bottom left corner)
    * select option "Open Folder in Container"
    * nagivate to this project folder and confirm
    * work work work!
* it might take a moment for the development container to be built(1st time only), so go pour youself a coffee or tea!
