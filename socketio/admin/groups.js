'use strict';

var async = require('async');

var groups = require('../../groups');

var SocketAdmin = require("../admin");

var SocketGroups = SocketAdmin.groups = module.exports;

SocketGroups.create = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	} else if (groups.isPrivilegeGroup(data.name)) {
		return callback(new Error('[[error:invalid-group-name]]'));
	}

	groups.create({
		name: data.name,
		description: data.description,
		ownerUid: socket.uid,
	}, callback);
};

SocketGroups.join = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			groups.isMember(data.uid, data.groupName, next);
		},
		function (isMember, next) {
			if (isMember) {
				return next(new Error('[[error:group-already-member]]'));
			}
			groups.join(data.groupName, data.uid, next);
		},
	], callback);
};

SocketGroups.leave = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (socket.uid === parseInt(data.uid, 10) && data.groupName === 'administrators') {
		return callback(new Error('[[error:cant-remove-self-as-admin]]'));
	}

	async.waterfall([
		function (next) {
			groups.isMember(data.uid, data.groupName, next);
		},
		function (isMember, next) {
			if (!isMember) {
				return next(new Error('[[error:group-not-member]]'));
			}
			groups.leave(data.groupName, data.uid, next);
		},
	], callback);
};

SocketGroups.update = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.update(data.groupName, data.values, callback);
};
