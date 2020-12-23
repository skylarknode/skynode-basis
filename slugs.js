'use strict';

var async = require('async');
var utils = require('./utils');

var slugs = module.exports;

slugs.userOrGroupExists = function (slug, callback) {
	var user = require('./user');
	var groups = require('./groups');
	slug = utils.slugify(slug);
	async.parallel([
		async.apply(user.existsBySlug, slug),
		async.apply(groups.existsBySlug, slug),
	], function (err, results) {
		callback(err, results ? results.some(function (result) { return result; }) : false);
	});
};

