'use strict';
var async = require('async');

var meta = require('../../meta');

var logger = require('../../logger');

var SocketAdmin = require("../admin");

var SocketLogs = SocketAdmin.logs = module.exports;

SocketLogs.get = function (socket, data, callback) {
	meta.logs.get(callback);
};

SocketLogs.clear = function (socket, data, callback) {
	meta.logs.clear(callback);
};
