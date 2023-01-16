'use strict';

var async = require('async');

///var mkdirp = require('mkdirp');
var nfs = require('skynode-nfs');
var mkdirp = nfs.mkdir;

var winston = require('winston');

var nconf = require('../system/parameters');


//var filePath = nfs.join(__dirname, '../../build/cache-buster');
var filePath = nfs.join(nconf.get('base_dir'), 'build/cache-buster');

var cached;

// cache buster is an 11-character, lowercase, alphanumeric string
function generate() {
	return (Math.random() * 1e18).toString(32).slice(0, 11);
}

exports.write = function write(callback) {
	async.waterfall([
		function (next) {
			mkdirp(nfs.dirname(filePath), next);
		},
		function (data, next) {
			nfs.writeFile(filePath, generate(), next);
		},
	], callback);
};

exports.read = function read(callback) {
	if (cached) {
		return callback(null, cached);
	}

	nfs.readFile(filePath, 'utf8', function (err, buster) {
		if (err) {
			winston.warn('[cache-buster] could not read cache buster', err);
			return callback(null, generate());
		}

		if (!buster || buster.length !== 11) {
			winston.warn('[cache-buster] cache buster string invalid: expected /[a-z0-9]{11}/, got `' + buster + '`');
			return callback(null, generate());
		}

		cached = buster;
		callback(null, cached);
	});
};
