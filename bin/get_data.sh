#!/usr/bin/env bash

function display_help() {
    cat <<HELP

Description:

  curl wrapper to play with M3 serverless endpoints

Usage:

  $0 --sync --user <user>                   : request data per <user>, response will be returned synchronously
  $0 --async --user <user> --callback <url> : request data per <user>, response will be returned asynchronously via <url>

Flags:
  -h    || --help       : display this help message
  -s    || --sync       : sync mode
  -a    || --async      : async mode
  -u    || --user       : specify user, default "octocat"
  -c    || --callback   : specify callback url (for async only), default "http://sls:4000/dev/callback"

HELP
}

req_url="http://localhost:4000/dev/data"
res_url="http://sls:4000/dev/callback"
method="POST"
user="octocat"

is_user=false;
is_req_url=false;
is_res_url=false;

if [[ -z "$@" ]]; then
    display_help && exit 0;
fi

for var in "$@"; do
    if [ $var == "-h" -o $var == "--help"  ]; then
        display_help && exit 0;
    elif [ $var == "-a" -o $var == "--async"  ]; then
        mode="async";
        continue;
    elif [ $var == "-s" -o $var == "--sync"  ]; then
        mode="sync";
        continue;
    elif [ $var == "-u" -o $var == "--user"  ]; then
        is_user=true;
        continue;
    elif [ $var == "-c" -o $var == "--callback"  ]; then
        is_res_url=true;
        continue;
    elif $is_user; then
        user="$var";
        is_user=false;
        continue
    elif $is_res_url; then
        res_url="$var";
        is_res_url=false;
        continue;
    else
        req_url="$var";
        continue;
    fi
done

function get_data() {
    local data="{ \"user\": \"${user}\", \"callback\": \"${res_url}\" }"
    curl -X "${method}"               \
        --url "${req_url}/${mode}"    \
        --data "${data}"
}

# set -x
get_data "$@"
