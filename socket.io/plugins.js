'use strict';

var ns = require("./ns");

var SocketPlugins = ns.plugins = {};

/*
	This file is provided exclusively so that plugins can require it and add their own socket listeners.

	How? From your plugin:

		var SocketPlugins = require.main.require('./src/socket.io/plugins');
		SocketPlugins.myPlugin = {};
		SocketPlugins.myPlugin.myMethod = function(socket, data, callback) { ... };

	Be a good lad and namespace your methods.
*/

module.exports = SocketPlugins;
