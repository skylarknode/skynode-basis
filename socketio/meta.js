'use strict';

var user = require('../user');
//var topics = require('skynode-contents/topics'); //TODO:lwf

var ns = require("./ns");

var SocketMeta = ns.meta = {};

SocketMeta.reconnected = function (socket, data, callback) {
	callback = callback || function () {};
	if (socket.uid) {
		topics.pushUnreadCount(socket.uid);
		user.notifications.pushCount(socket.uid);
	}
	callback();
};


SocketMeta.getServerTime = function (socket, data, callback) {
	// Returns server time in milliseconds
	callback(null, Date.now());
};

module.exports = SocketMeta;
