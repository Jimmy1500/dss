'use strict'
const uuid = require('uuid');
const { default: axios } = require('axios');

function jsonOf(string) { try { return JSON.parse(string); } catch (error) { return string; } }

module.exports = {
    uuid,
    axios,
    jsonOf
}