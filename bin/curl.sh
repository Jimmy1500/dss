#!/usr/bin/env bash

function check_inputs() {
    if [ -z "$1" ]; then echo "invalid input ($@), no type specified"     && exit 1; fi
    if [ -z "$2" ]; then echo "invalid input ($@), no tax_id specified"   && exit 1; fi
    if [ -z "$3" ]; then echo "invalid input ($@), no callback specified" && exit 1; fi
}

# type, cpf_cnpj, callback, state[optional], date_of_birth[optional]
function get_doc() {
    check_inputs "$@";

    local type="$1";
    local cpf_cnpj="$2";
    local callback="$3";
    local state="${4-PR}";
    local dob="${5-1990/01/01}";

    curl -X POST                         \
    --url http://localhost:4000/dev/doc  \
    --data '{
        "type"          : "'${type}'",
        "tax_id"        : "'${cpf_cnpj}'",
        "callback"      : "'${callback}'",
        "state"         : "'${state}'",
        "date_of_birth" : "'${dob}'"
    }';
}

get_doc "DSS_IBM_EC" "01837060487"     "http://localhost:4000/dev/callback"
get_doc "DSS_IBM_EC" "00958464928"     "http://localhost:4000/dev/callback"
get_doc "DSS_IBM_EC" "24657868000208"  "http://localhost:4000/dev/callback"