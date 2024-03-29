'use strict';

var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
///var mkdirp = require('mkdirp');
var nfs = require('skynode-nfs');
var mkdirp = nfs.mkdir;

var async = require('async');

var file = require('../file');
var plugins = require('../plugins');
var Meta = require('../meta');

var nconf = require('nconf');


//var soundsPath = path.join(__dirname, '../../build/public/sounds');
//var uploadsPath = path.join(__dirname, '../../uploads/sounds');

var Sounds = module.exports;

Sounds.addUploads = function addUploads(callback) {
    var uploadsPath = path.join(nconf.get('base_dir'), 'uploads/sounds');
	fs.readdir(uploadsPath, function (err, files) {
		if (err) {
			if (err.code !== 'ENOENT') {
				return callback(err);
			}

			files = [];
		}

		var uploadSounds = files.reduce(function (prev, fileName) {
			var name = fileName.split('.');
			if (!name.length || !name[0].length) {
				return prev;
			}
			name = name[0];
			name = name[0].toUpperCase() + name.slice(1);

			prev[name] = fileName;
			return prev;
		}, {});

		plugins.soundpacks = plugins.soundpacks.filter(function (pack) {
			return pack.name !== 'Uploads';
		});
		if (Object.keys(uploadSounds).length) {
			plugins.soundpacks.push({
				name: 'Uploads',
				id: 'uploads',
				dir: uploadsPath,
				sounds: uploadSounds,
			});
		}

		callback();
	});
};

Sounds.build = function build(callback) {
	var soundsPath = path.join(nconf.get('base_dir'), 'build/public/sounds');

	Sounds.addUploads(function (err) {
		if (err) {
			return callback(err);
		}

		var map = plugins.soundpacks.map(function (pack) {
			return Object.keys(pack.sounds).reduce(function (prev, soundName) {
				var soundPath = pack.sounds[soundName];
				prev[pack.name + ' | ' + soundName] = pack.id + '/' + soundPath;
				return prev;
			}, {});
		});
		map.unshift({});
		map = Object.assign.apply(null, map);

		async.series([
			function (next) {
				rimraf(soundsPath, next);
			},
			function (next) {
				mkdirp(soundsPath, next);
			},
			function (cb) {
				async.parallel([
					function (next) {
						fs.writeFile(path.join(soundsPath, 'fileMap.json'), JSON.stringify(map), next);
					},
					function (next) {
						async.each(plugins.soundpacks, function (pack, next) {
							file.linkDirs(pack.dir, path.join(soundsPath, pack.id), next);
						}, next);
					},
				], cb);
			},
		], function (err) {
			callback(err);
		});
	});
};
