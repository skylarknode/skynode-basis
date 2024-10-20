
'use strict';

var async = require('async');
var _ = require('lodash');

var groups = require('../groups');
var plugins = require('../plugins');
var helpers = require('./helpers');
var user = require('../user');
var meta = require('../meta');


module.exports = function (privileges) {
	privileges.groups = {};
	privileges.groups.getGroupsFromSet = function (uid, sort, start, stop, callback) {
		var set = 'groups:visible:name';
		if (sort === 'count') {
			set = 'groups:visible:memberCount';
		} else if (sort === 'date') {
			set = 'groups:visible:createtime';
		}

		async.waterfall([
			function (next) {
				groups.getGroupsFromSet(set, uid, start, stop, next);
			},
			function (groupsData, next) {
				next(null, {
					groups: groupsData,
					allowGroupCreation: meta.config.allowGroupCreation,
					nextStart: stop + 1,
				});
			},
		], callback);
	};


};
