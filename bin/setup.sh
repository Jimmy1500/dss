#!/usr/bin/env bash

arch=`uname -s`_`uname -m`
echo "Machine architecture detected: $arch"
windows_warning_msg="Don't be so naughty and stop using Windows, switch your OS and come back again"

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

    docker builder prune --force --all
    docker-compose up --build -d

    echo "checking health..."
    aws=`docker ps -a | grep -i 'localstack'`
    aws_up=`docker ps -a | grep -i 'localstack' | grep 'Up' | gawk 'END{ print $NF; }'`
    aws_down=`docker ps -a | grep -i 'localstack' | grep 'Exited' | gawk 'END{ print $NF; }'`
    if [[ ${aws} ]]; then
        if [[ ${aws_up} ]]; then
            echo -n "container up: \"${aws_up}\", initializing..."
            sleep 5
            aws --no-sign-request --endpoint-url=http://localhost:4566 s3 mb s3://dss
        elif [[ ${aws_down} ]]; then
            echo "container down: \"${aws_down}\""
            exit 1
        else
            echo "container invalid state: \"${aws}\""
            exit 1
        fi
    else
        echo "no container exists";
        exit 1
    fi

else
    echo $windows_warning_msg
    exit 1
fi
