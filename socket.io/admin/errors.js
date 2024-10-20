'use strict';
var async = require('async');

var meta = require('../../meta');

var SocketAdmin = require("../admin");

var SocketErrors = SocketAdmin.errors = module.exports;

SocketErrors.clear = function (socket, data, callback) {
	meta.errors.clear(callback);
};