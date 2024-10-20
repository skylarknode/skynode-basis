'use strict';

var async = require('async');
var winston = require('winston');

var meta = require('../meta');
var user = require('../user');

var events = require('../events');
var db = require('../database');
var websockets = require('./sockets');

var ns = require("./ns");

var SocketAdmin = ns.admin = {
};

SocketAdmin.before = function (socket, method, data, next) {
	async.waterfall([
		function (next) {
			user.isAdministrator(socket.uid, next);
		},
		function (isAdmin) {
			if (isAdmin) {
				return next();
			}
			winston.warn('[socket.io] Call to admin method ( ' + method + ' ) blocked (accessed by uid ' + socket.uid + ')');
			next(new Error('[[error:no-privileges]]'));
		},
	], next);
};

SocketAdmin.restart = function (socket, data, callback) {
	logRestart(socket);
	meta.restart();
	callback();
};

function logRestart(socket) {
	events.log({
		type: 'restart',
		uid: socket.uid,
		ip: socket.ip,
	});
	db.setObject('lastrestart', {
		uid: socket.uid,
		ip: socket.ip,
		timestamp: Date.now(),
	});
}

SocketAdmin.reload = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			require('skynode-basis/meta/build').buildAll(next);
		},
		function (next) {
			events.log({
				type: 'build',
				uid: socket.uid,
				ip: socket.ip,
			});

			logRestart(socket);
			meta.restart();
			next();
		},
	], callback);
};

SocketAdmin.fireEvent = function (socket, data, callback) {
	websockets.server.emit(data.name, data.payload || {});
	callback();
};

/*
SocketAdmin.themes.getInstalled = function (socket, data, callback) {
	meta.themes.get(callback);
};

SocketAdmin.themes.set = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			if (data.type === 'bootswatch') {
				setImmediate(next);
			} else {
				widgets.reset(next);
			}
		},
		function (next) {
			// Add uid and ip data
			data.ip = socket.ip;
			data.uid = socket.uid;

			meta.themes.set(data, next);
		},
	], callback);
};
*/


/*
SocketAdmin.widgets.set = function (socket, data, callback) {
	if (!Array.isArray(data)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.eachSeries(data, widgets.setArea, callback);
};
//lwf
SocketAdmin.widgets.categories.set = function (socket, data, callback) {
	var cid = data.cid,
		areas = data.areas;
	if (!Array.isArray(areas)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var setCategoryArea = require("../widgets/categories").widgets.setCategoryArea;

	async.eachSeries(areas, function(area,next) {
		setCategoryArea(cid,area,next);
	}  , callback);
};
*/

SocketAdmin.deleteEvents = function (socket, eids, callback) {
	events.deleteEvents(eids, callback);
};

SocketAdmin.deleteAllEvents = function (socket, data, callback) {
	events.deleteAll(callback);
};
/*
SocketAdmin.getSearchDict = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			///console.log("socket.uid:" + socket.uid);
			user.getSettings(socket.uid, next);
		},
		function (settings, next) {
			var lang = settings.userLang || meta.config.defaultLang || 'en-GB';
			getAdminSearchDict(lang, next);
		},
	], callback);
};
*/
SocketAdmin.deleteAllSessions = function (socket, data, callback) {
	user.auth.deleteAllSessions(callback);
};

SocketAdmin.reloadAllSessions = function (socket, data, callback) {
	websockets.in('uid_' + socket.uid).emit('event:livereload');
	callback();
};


module.exports = SocketAdmin;
