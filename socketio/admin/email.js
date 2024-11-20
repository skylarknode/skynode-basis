'use strict';
var async = require('async');

var meta = require('../../meta');

var notifications = require('../../notifications');
///var userDigest = require('skynode-contents/user/digest'); //TODO: lwf
var userEmail = require('../../user/email');

var SocketAdmin = require("../admin");

var SocketEmail = SocketAdmin.email = module.exports;

SocketEmail.test = function (socket, data, callback) {
	var payload = {
		subject: '[[email:test-email.subject]]',
	};

	switch (data.template) {
	case 'digest':
		userDigest.execute({
			interval: 'alltime',
			subscribers: [socket.uid],
		}, callback);
		break;

	case 'banned':
		Object.assign(payload, {
			username: 'test-user',
			until: utils.toISOString(Date.now()),
			reason: 'Test Reason',
		});
		//emailer.send(data.template, socket.uid, payload, callback);
		userEmail.send(data.template, socket.uid, payload, callback);
		break;

	case 'welcome':
		userEmail.sendValidationEmail(socket.uid, {
			force: 1,
		}, callback);
		break;

	case 'notification':
		async.waterfall([
			function (next) {
				notifications.create({
					type: 'test',
					bodyShort: '[[admin-settings-email:testing]]',
					bodyLong: '[[admin-settings-email:testing.send-help]]',
					nid: 'uid:' + socket.uid + ':test',
					path: '/',
					from: socket.uid,
				}, next);
			},
			function (notifObj, next) {
				//emailer.send('notification', socket.uid, {
				userEmail.send('notification', socket.uid, {
					path: notifObj.path,
					subject: utils.stripHTMLTags(notifObj.subject || '[[notifications:new_notification]]'),
					intro: utils.stripHTMLTags(notifObj.bodyShort),
					body: notifObj.bodyLong || '',
					notification: notifObj,
					showUnsubscribe: true,
				}, next);
			},
		]);
		break;
	default:
		//emailer.send(data.template, socket.uid, payload, callback);
		userEmail.send(data.template, socket.uid, payload, callback);
		break;
	}
};