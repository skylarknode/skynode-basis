'use strict';
var async = require('async');

var plugins = require('../../plugins');

var db = require('../../database');

var SocketAdmin = require("../admin");

var SocketPlugins = SocketAdmin.plugins = module.exports;

SocketPlugins.toggleActive = function (socket, plugin_id, callback) {
	///require('../posts/cache').reset(); //TODO:lwf
	plugins.toggleActive(plugin_id, callback);
};

SocketPlugins.toggleInstall = function (socket, data, callback) {
	///require('../posts/cache').reset(); //TODO:lwf
	plugins.toggleInstall(data.id, data.version, callback);
};

SocketPlugins.getActive = function (socket, data, callback) {
	plugins.getActive(callback);
};

SocketPlugins.orderActivePlugins = function (socket, data, callback) {
	async.each(data, function (plugin, next) {
		if (plugin && plugin.name) {
			db.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name, next);
		} else {
			setImmediate(next);
		}
	}, callback);
};

SocketPlugins.upgrade = function (socket, data, callback) {
	plugins.upgrade(data.id, data.version, callback);
};

