#!/usr/bin/env bash

base_url="http://localhost:4000/dev"
mode="sync"
method="POST"
user="octocat"

for var in "$@"; do
    if [ $var == "async" -o $var == "-a" ]; then
        mode="async";
    else
        user="$var";
    fi
done

function get_data() {
    set -x
    local data="{ \"user\": \"${user}\", \"callback\": \"${base_url}/callback\" }"
    curl -X "${method}"                     \
        --url "${base_url}/data/${mode}"    \
        --data "${data}"
}

get_data $@
