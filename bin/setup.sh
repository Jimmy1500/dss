#!/usr/bin/env bash

arch=`uname -s`_`uname -m`
echo "Machine architecture detected: $arch"
windows_warning_msg="Don't be so naughty and stop using Windows, switch you OS and come back again"

# sanity check
if [[ `which docker` ]]; then
    echo "toolchain dependency: docker...OK"
else
    echo "toolchain dependency: docker...missing"
    echo "try downloading docker desktop from [https://www.docker.com]"
    exit 1
fi
if [[ `which gawk` ]]; then
    echo "toolchain dependency: gawk...OK";
else
    echo "toolchain dependency: gawk...missing";
    if [ $arch == "Linux_x86_64" ]; then
        echo try \"apt install gawk\"
    elif [ $arch == "Darwin_x86_64" ]; then
        echo try \"brew install gawk\"
    else
        echo $windows_warning_msg
    fi
    exit 1
fi

if [ $arch == "Linux_x86_64" -o $arch == "Darwin_x86_64" ]; then
    # systemctl stop postgresql
    if [[ `docker images -q` ]]; then
        docker rmi $(docker images -q)
    fi
    if [[ `docker ps -a -q` ]]; then
        docker stop $(docker ps -a -q)
        docker rm $(docker ps -a -q)
    fi
    if [[ `docker volume ls -q` ]]; then
        docker volume rm $(docker volume ls -q)
    fi

    docker-compose up --build -d

    echo "checking health..."
    aws_container_up=`docker ps -a | grep -i 'localstack:latest' | grep 'Up' | gawk 'BEGIN{}{}END{ print $NF; }'`
    if [[ ${aws_container_up} ]]; then
        echo "container ${aws_container_up} is up!"
        sleep 8
    else
        aws_container_down=`docker ps -a | grep -i 'localstack:latest' | grep 'Exited' | gawk 'BEGIN{}{}END{ print $NF; }'`
        if [[ ${aws_container_down} ]]; then
            echo "health check failed, container \"${aws_container_down}\" is down";
        else
            echo "health check failed, container doesn't exist";
        fi
        exit 1
    fi

    aws --no-sign-request --endpoint-url=http://localhost:4566 s3 mb s3://m3-api
else
    echo $windows_warning_msg
    exit 1
fi
