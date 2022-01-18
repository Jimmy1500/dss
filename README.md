# Project M3

## How to Set Up
* prerequisite:
    * docker
* steps
    * (local) bring all containers [lambda, app, redis, s3] online
    ```
    ./bin/setup.sh
    ```
# How to Play
* (Option 1) `bin/get_data.sh`
```
./bin/get_data.sh --sync <username>
./bin/get_data.sh --async <username>
```
* (Option 2) `curl`
```
curl -X POST --url http://localhost:4000/dev/data/sync --data "{\"user\": \"octocat\"}
```
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

## Service Endpoints
### Serverless Functions
* base url
```
http://localhost:4000/dev
```
| Endpoints                                              | Method | URL           | Example Request                             |
| :----------------------------------------------------: | :----: | :-----------: | :-----------------------------------------: |
| [health](http://localhost:4000/dev/health)             | GET    | /health       | `N/A`                                       |
| [get_data_sync](http://localhost:4000/dev/data/sync)   | POST   | /data/sync    | `{"user": "octocat"}`                       |
| [get_data_async](http://localhost:4000/dev/data/async) | POST   | /data/async   | `{"user": "octocat", "callback": "http://localhost:4000/dev/callback" }` |
