'use strict';

var os = require('os');
var async = require('async');
var nconf = require('nconf');
var winston = require('winston');
var url = require('url');
var cookieParser = require('cookie-parser')(nconf.get('secret'));

var db = require('../database');
var user = require('../user');
var logger = require('../logger');
var plugins = require('../plugins');
var ratelimit = require('./ratelimit');


var Sockets = module.exports;

var Namespaces = Sockets.Namespaces =  require("./ns");

var io;

Sockets.init = function (server) {
	var SocketIO = require('socket.io'); //TODO : for avoiding a require search bug?
	var socketioWildcard = require('socketio-wildcard')();
	io = new SocketIO.Server({
		path: nconf.get('relative_path') + '/socket.io',
		// modified by lwf for test
		  cors: {
		    origin: function (origin, fn) {
		      //const isTarget = origin !== undefined && origin.match(/^https?:\/\/www\.test\.net/) !== null;
		      const isTarget = true;
		      return isTarget ? fn(null, origin) : fn('error invalid domain');
		    },
		    credentials: true
		  }
	});

	if (nconf.get('singleHostCluster')) {
		io.adapter(require('./single-host-cluster'));
	} else if (nconf.get('redis')) {
		io.adapter(require('./adapters/redis')());
	} else {
		io.adapter(require('./adapters/'+nconf.get('database'))());
	}

	io.use(socketioWildcard);
	io.use(authorize);

	var opts = {

	};
	var	transports = nconf.get('socket.io:transports');

	if (transports) {
		opts.transports = transports;
	}

	io.on('connection', onConnection);

	/*
	 * Restrict socket.io listener to cookie domain. If none is set, infer based on url.
	 * Production only so you don't get accidentally locked out.
	 * Can be overridden via config (socket.io:origins)
	 */
	if (process.env.NODE_ENV !== 'development') {
		const parsedUrl = url.parse(nconf.get('url'));

		// cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
		const domain = nconf.get('cookieDomain') || parsedUrl.hostname;

		const origins = nconf.get('socket.io:origins') || `${parsedUrl.protocol}//${domain}:*`;
		nconf.set('socket.io:origins', origins);

		//io.origins(origins);
		opts.cors =  {
    	 origin: origins,
    	 methods: ["GET", "POST"],
    	 allowedHeaders: ["content-type"],
    	 credentials: true
  		};
		winston.info('[socket.io] Restricting access to origin: ' + origins);
	}

	io.listen(server, opts);

	Sockets.server = io;
};

function onConnection(socket) {
	socket.ip = (socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress || '').split(',')[0];

	logger.io_one(socket, socket.uid);

	onConnect(socket);

	socket.on('*', function (payload) {
		onMessage(socket, payload);
	});
}

function onConnect(socket) {
	if (socket.uid) {
		socket.join('uid_' + socket.uid);
		socket.join('online_users');
	} else {
		socket.join('online_guests');
	}

	socket.join('sess_' + socket.request.signedCookies[nconf.get('sessionKey')]);
	///io.sockets.sockets[socket.id].emit('checkSession', socket.uid);
	///io.sockets.sockets[socket.id].emit('setHostname', os.hostname());
	socket.emit('checkSession', socket.uid);
	socket.emit('setHostname', os.hostname());
}

function onMessage(socket, payload) {
	if (!payload.data.length) {
		return winston.warn('[socket.io] Empty payload');
	}

	var eventName = payload.data[0];
	var params = payload.data[1];
	var callback = typeof payload.data[payload.data.length - 1] === 'function' ? payload.data[payload.data.length - 1] : function () {};

	if (!eventName) {
		return winston.warn('[socket.io] Empty method name');
	}

	var parts = eventName.toString().split('.');
	var namespace = parts[0];
	var methodToCall = parts.reduce(function (prev, cur) {
		if (prev !== null && prev[cur]) {
			return prev[cur];
		}
		return null;
	}, Namespaces);

	if (!methodToCall) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('[socket.io] Unrecognized message: ' + eventName);
		}
		return callback({ message: '[[error:invalid-event]]' });
	}

	socket.previousEvents = socket.previousEvents || [];
	socket.previousEvents.push(eventName);
	if (socket.previousEvents.length > 20) {
		socket.previousEvents.shift();
	}

	if (!eventName.startsWith('admin.') && ratelimit.isFlooding(socket)) {
		winston.warn('[socket.io] Too many emits! Disconnecting uid : ' + socket.uid + '. Events : ' + socket.previousEvents);
		return socket.disconnect();
	}

	async.waterfall([
		function (next) {
			checkMaintenance(socket, next);
		},
		function (next) {
			validateSession(socket, next);
		},
		function (next) {
			if (Namespaces[namespace].before) {
				Namespaces[namespace].before(socket, eventName, params, next);
			} else {
				next();
			}
		},
		function (next) {
			methodToCall(socket, params, next);
		},
	], function (err, result) {
		callback(err ? { message: err.message } : null, result);
	});
}

function checkMaintenance(socket, callback) {
	var meta = require('../meta');
	if (!meta.config.maintenanceMode) {
		return setImmediate(callback);
	}
	user.isAdministrator(socket.uid, function (err, isAdmin) {
		if (err || isAdmin) {
			return callback(err);
		}
	});
}

function validateSession(socket, callback) {
	var req = socket.request;
	if (!req.signedCookies || !req.signedCookies[nconf.get('sessionKey')]) {
		return callback();
	}

	db.sessionStore.get(req.signedCookies[nconf.get('sessionKey')], function (err, sessionData) {
		if (err || !sessionData) {
			return callback(err || new Error('[[error:invalid-session]]'));
		}

		plugins.fireHook('static:sockets.validateSession', {
			req: req,
			socket: socket,
			session: sessionData,
		}, callback);
	});
}

function authorize(socket, callback) {
	var request = socket.request;

	if (!request) {
		return callback(new Error('[[error:not-authorized]]'));
	}

	async.waterfall([
		function (next) {
			cookieParser(request, {}, next);
		},
		function (next) {
			console.log("io.sessionKey:" + nconf.get('sessionKey'));
			console.log("io.signedCookies:" + request.signedCookies[nconf.get('sessionKey')]);
			db.sessionStore.get(request.signedCookies[nconf.get('sessionKey')], function (err, sessionData) {
				if (err) {
					return next(err);
				}
				console.dir(sessionData);
				if (sessionData && sessionData.passport && sessionData.passport.user) {
					request.session = sessionData;
					socket.uid = parseInt(sessionData.passport.user, 10);
				} else {
					socket.uid = 0;
				}
				next();
			});
		},
	], callback);
}

Sockets.in = function (room) {
	return io.in(room);
};

Sockets.getUserSocketCount = function (uid) {
	if (!io) {
		return 0;
	}

	var room = io.sockets.adapter.rooms['uid_' + uid];
	return room ? room.length : 0;
};


Sockets.reqFromSocket = function (socket, payload, event) {
	var headers = socket.request ? socket.request.headers : {};
	var encrypted = socket.request ? !!socket.request.connection.encrypted : false;
	var host = headers.host;
	var referer = headers.referer || '';
	var data = ((payload || {}).data || []);

	if (!host) {
		host = url.parse(referer).host || '';
	}

	return {
		uid: socket.uid,
		params: data[1],
		method: event || data[0],
		body: payload,
		ip: socket.ip,
		host: host,
		protocol: encrypted ? 'https' : 'http',
		secure: encrypted,
		url: referer,
		path: referer.substr(referer.indexOf(host) + host.length),
		headers: headers,
	};
};
