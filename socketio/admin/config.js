'use strict';
var async = require('async');

var meta = require('../../meta');
var plugins = require('../../plugins');
var SocketAdmin = require("../admin");
var logger = require('../../logger');
var sockets = require("../sockets");
var events = require('../../events');

var SocketConfig = SocketAdmin.config = module.exports;


SocketConfig.set = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var _data = {};
	_data[data.key] = data.value;
	SocketConfig.setMultiple(socket, _data, callback);
};

SocketConfig.setMultiple = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var changes = {};
	data = meta.configs.deserialize(data);
	Object.keys(data).forEach(function (key) {
		if (data[key] !== meta.config[key]) {
			changes[key] = data[key];
			changes[key + '_old'] = meta.config[key];
		}
	});

	async.waterfall([
		function (next) {
			meta.configs.setMultiple(data, next);
		},
		function (next) {
			var setting;
			for (var field in data) {
				if (data.hasOwnProperty(field)) {
					setting = {
						key: field,
						value: data[field],
					};
					plugins.fireHook('action:config.set', setting);
					logger.monitorConfig({ io: sockets.server }, setting);
				}
			}

			if (Object.keys(changes).length) {
				changes.type = 'config-change';
				changes.uid = socket.uid;
				changes.ip = socket.ip;
				events.log(changes, next);
			} else {
				next();
			}
		},
	], callback);
};

SocketConfig.remove = function (socket, key, callback) {
	meta.configs.remove(key, callback);
};
