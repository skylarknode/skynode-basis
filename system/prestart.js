'use strict';

var nconf = require('nconf');
var url = require('url');
var winston = require('winston');
var path = require('path');

var pkg = require('../../package.json');
var dirname = require('./paths').baseDir;

function setupWinston() {
	console.log("winston.format:" + winston.format);
	if (!winston.format) {
		return;
	}

	// allow winton.error to log error objects properly
	// https://github.com/SkyBB/SkyBB/issues/6848
	const winstonError = winston.error;
	winston.error = function (msg, error) {
		console.log("winston.error:" + msg);
		console.error(error);
		ddd
		if (msg instanceof Error) {
			winstonError(msg);
		} else if (error instanceof Error) {
			msg = msg + '\n' + error.stack;
			winstonError(msg);
		} else {
			winstonError.apply(null, arguments);
		}
	};


	// https://github.com/winstonjs/winston/issues/1338
	// error objects are not displayed properly
	const enumerateErrorFormat = winston.format((info) => {
		if (info.message instanceof Error) {
			info.message = Object.assign({
				message: `${info.message.message}\n${info.message.stack}`,
			}, info.message);
		}

		if (info instanceof Error) {
			return Object.assign({
				message: `${info.message}\n${info.stack}`,
			}, info);
		}

		return info;
	});
	var formats = [];
	formats.push(enumerateErrorFormat());
	if (nconf.get('log-colorize') !== 'false') {
		formats.push(winston.format.colorize());
	}

	if (nconf.get('json-logging')) {
		formats.push(winston.format.timestamp());
		formats.push(winston.format.json());
	} else {
		const timestampFormat = winston.format((info) => {
			var dateString = new Date().toISOString() + ' [' + nconf.get('port') + '/' + global.process.pid + ']';
			info.level = dateString + ' - ' + info.level;
			return info;
		});
		formats.push(timestampFormat());
		formats.push(winston.format.splat());
		formats.push(winston.format.simple());
	}

	winston.configure({
		level: nconf.get('log-level') || (global.env === 'production' ? 'info' : 'verbose'),
		format: winston.format.combine.apply(null, formats),
		transports: [
			new winston.transports.Console({
				handleExceptions: true,
				level: 'error'  // add by lwf
			}),
			new winston.transports.Console({
				handleExceptions: true,
				level: 'info'  // add by lwf
			}),
		],
	});
}

function loadConfig(configFile) {
	nconf.file({
		file: configFile,
	});

	nconf.defaults({
		base_dir: dirname,
		themes_path: path.join(dirname, 'node_modules'),
		//upload_path: 'public/uploads',
		upload_path: 'uploads',
		views_dir: path.join(dirname, 'build/public/templates'),
		version: pkg.version,
	});

	if (!nconf.get('isCluster')) {
		nconf.set('isPrimary', 'true');
		nconf.set('isCluster', 'false');
	}
	var isPrimary = nconf.get('isPrimary');
	nconf.set('isPrimary', isPrimary === undefined ? 'true' : isPrimary);

	// Ensure themes_path is a full filepath
	nconf.set('themes_path', path.resolve(dirname, nconf.get('themes_path')));
	nconf.set('core_templates_path', path.join(dirname, 'src/views'));
	nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-persona/templates'));

	nconf.set('upload_path', path.resolve(nconf.get('base_dir'), nconf.get('upload_path')));

	if (nconf.get('url')) {
		nconf.set('url_parsed', url.parse(nconf.get('url')));
	}

	// Explicitly cast 'jobsDisabled' as Bool
	var castAsBool = ['jobsDisabled'];
	nconf.stores.env.readOnly = false;
	castAsBool.forEach(function (prop) {
		var value = nconf.get(prop);
		if (value) {
			nconf.set(prop, typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
		}
	});
	nconf.stores.env.readOnly = true;

	nconf.set('runJobs', nconf.get('isPrimary') === 'true' && !nconf.get('jobsDisabled'));
}

function versionCheck() {
	var version = process.version.slice(1);
	var range = pkg.engines.node;
	var semver = require('semver');
	var compatible = semver.satisfies(version, range);

	if (!compatible) {
		winston.warn('Your version of Node.js is too outdated for SkyBB. Please update your version of Node.js.');
		winston.warn('Recommended ' + range.green + ', '.reset + version.yellow + ' provided\n'.reset);
	}
}

exports.setupWinston = setupWinston;
exports.loadConfig = loadConfig;
exports.versionCheck = versionCheck;
