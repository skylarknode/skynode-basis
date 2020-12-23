'use strict';

var async = require('async');
var _ = require('lodash');
var path = require('path');
var nconf = require('nconf');

var db = require('../database');
var plugins = require('../plugins');
var batch = require('../batch');
var file = require('../file');

module.exports = function (User) {
	var deletesInProgress = {};

	User.delete = function (callerUid, uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, new Error('[[error:invalid-uid]]'));
		}
		if (deletesInProgress[uid]) {
			return setImmediate(callback, new Error('[[error:already-deleting]]'));
		}
		deletesInProgress[uid] = 'user.delete';
		async.waterfall([
			function (next) {
				removeFromSortedSets(uid, next);
			},
			function (next) {
				User.deleteAccount(uid, next);
			},
		], callback);
	};


	function removeFromSortedSets(uid, callback) {
		db.sortedSetsRemove([
			'users:joindate',
			'users:postcount',
			'users:reputation',
			'users:banned',
			'users:banned:expire',
			'users:flags',
			'users:online',
			'users:notvalidated',
			'digest:day:uids',
			'digest:week:uids',
			'digest:month:uids',
		], uid, callback);
	}

	User.deleteAccount = function (uid, callback) {
		if (deletesInProgress[uid] === 'user.deleteAccount') {
			return setImmediate(callback, new Error('[[error:already-deleting]]'));
		}
		deletesInProgress[uid] = 'user.deleteAccount';
		var userData;
		async.waterfall([
			function (next) {
				removeFromSortedSets(uid, next);
			},
			function (next) {
				db.getObject('user:' + uid, next);
			},
			function (_userData, next) {
				if (!_userData || !_userData.username) {
					delete deletesInProgress[uid];
					return callback(new Error('[[error:no-user]]'));
				}
				userData = _userData;
				plugins.fireHook('static:user.delete', { uid: uid }, next);
			},
			function (next) {
				deleteVotes(uid, next);
			},
			function (next) {
				deleteChats(uid, next);
			},
			function (next) {
				User.auth.revokeAllSessions(uid, next);
			},
			function (next) {
				async.parallel([
					function (next) {
						db.sortedSetRemove('username:uid', userData.username, next);
					},
					function (next) {
						db.sortedSetRemove('username:sorted', userData.username.toLowerCase() + ':' + uid, next);
					},
					function (next) {
						db.sortedSetRemove('userslug:uid', userData.userslug, next);
					},
					function (next) {
						db.sortedSetRemove('fullname:uid', userData.fullname, next);
					},
					function (next) {
						if (userData.email) {
							async.parallel([
								async.apply(db.sortedSetRemove, 'email:uid', userData.email.toLowerCase()),
								async.apply(db.sortedSetRemove, 'email:sorted', userData.email.toLowerCase() + ':' + uid),
							], next);
						} else {
							next();
						}
					},
					function (next) {
						db.decrObjectField('global', 'userCount', next);
					},
					function (next) {
						var keys = [
							'uid:' + uid + ':notifications:read',
							'uid:' + uid + ':notifications:unread',
							'uid:' + uid + ':bookmarks',
							'uid:' + uid + ':followed_tids',
							'uid:' + uid + ':ignored_tids',
							'user:' + uid + ':settings',
							'uid:' + uid + ':topics', 'uid:' + uid + ':posts',
							'uid:' + uid + ':chats', 'uid:' + uid + ':chats:unread',
							'uid:' + uid + ':chat:rooms', 'uid:' + uid + ':chat:rooms:unread',
							'uid:' + uid + ':upvote', 'uid:' + uid + ':downvote',
							'uid:' + uid + ':flag:pids',
							'uid:' + uid + ':sessions', 'uid:' + uid + ':sessionUUID:sessionId',
						];
						db.deleteAll(keys, next);
					},
					function (next) {
						deleteUserIps(uid, next);
					},
					function (next) {
						deleteBans(uid, next);
					},
					function (next) {
						deleteUserFromFollowers(uid, next);
					},
					function (next) {
						groups.leaveAllGroups(uid, next);
					},
				], next);
			},
			function (results, next) {
				db.deleteAll(['followers:' + uid, 'following:' + uid, 'user:' + uid], next);
			},
		], function (err) {
			delete deletesInProgress[uid];
			callback(err, userData);
		});
	};


	function deleteUserIps(uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('uid:' + uid + ':ip', 0, -1, next);
			},
			function (ips, next) {
				var keys = ips.map(function (ip) {
					return 'ip:' + ip + ':uid';
				});
				db.sortedSetsRemove(keys, uid, next);
			},
			function (next) {
				db.delete('uid:' + uid + ':ip', next);
			},
		], callback);
	}

};
