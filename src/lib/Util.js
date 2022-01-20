'use strict'
const uuid = require('uuid');
const { default: axios } = require('axios');

function jsonOf(string) {
    try { return JSON.parse(string); } catch (error) { return string; }
}

function hashOf(key) {
    if ( !key?.length ) { throw new TypeError(`invalid key ${key}`); }
    return uuid.v5(key, uuid.v5.URL);
}

module.exports = {
    uuid,
    axios,
    jsonOf,
    hashOf
}