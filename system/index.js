/*
	NodeBB - A better forum platform for the modern web
	https://github.com/NodeBB/NodeBB/
	Copyright (C) 2013-2017  NodeBB Inc.

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/



console.log("serve");

require('amd-loader');


var nconf = require('nconf');
nconf.argv().env({
	separator: '__',
});

var async = require('async');
var winston = require('winston');

///winston.add(new winston.transports.Console()); // added by lwf

var url = require('url');
var path = require('path');

var file = require('skynode-basis/file');

global.env = process.env.NODE_ENV || 'production';

// Alternate configuration file support
/*
var	configFile = path.resolve(__dirname, nconf.any(['config', 'CONFIG']) || '../../bin/config.json');

var configExists = file.existsSync(configFile) || (nconf.get('url') && nconf.get('secret') && nconf.get('database'));

prestart.loadConfig(configFile);
var prestart = require('./prestart');
prestart.setupWinston();
prestart.versionCheck();
winston.verbose('* using configuration stored in: %s', configFile);

*/


function setupWinston() {
	if (!winston.format) {
		return;
	}

	// allow winton.error to log error objects properly
	// https://github.com/SkyBB/SkyBB/issues/6848
	const winstonError = winston.error;
	winston.error = function (msg, error) {
		console.log("winston.error:" + msg);
		if (msg instanceof Error) {
			winstonError(msg.stack);
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

setupWinston();

if (!process.send) {
	// If run using `node app`, log GNU copyright info along with server info
	winston.info('NodeBB v' + nconf.get('version') + ' Copyright (C) 2013-' + (new Date()).getFullYear() + ' NodeBB Inc.');
	winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
	winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
	winston.info('');
}

function start() {
	console.log("start");
	//var db = require('skynode-basis/database');
	//var meta = require('skynode-basis/meta');

	//setupConfigs();

	printStartupInfo();

	addProcessHandlers();

	async.waterfall([
		/*
		function (next) {
			db.init(next);
		},
		function (next) {
			async.parallel([
				async.apply(db.checkCompatibility),
				async.apply(meta.configs.init),
				function (next) {
					if (nconf.get('dep-check') === undefined || nconf.get('dep-check') !== false) {
						meta.dependencies.check(next);
					} else {
						winston.warn('[init] Dependency checking skipped!');
						setImmediate(next);
					}
				},
				function (next) {
					require('../../bin/upgrade').check(next);
				},
			], function (err) {
				next(err);
			});
		//},
		//function (next) {
		//	db.initSessionStore(meta.getSessionTTLSeconds(),next);
		},
		*/
		function (next) {
			/*var webserver = require('./src/webserver');
			require('./src/socket.io').init(webserver.server);

			if (nconf.get('runJobs')) {
				require('./src/notifications').startJobs();
				require('./src/user').startJobs();
			}

			webserver.listen(next);
			*/
			require('skynode-server').start(next);

		},
	], function (err) {
		console.error(err);
		if (err) {
			switch (err.message) {
			case 'schema-out-of-date':
				winston.error('Your SkyBB schema is out-of-date. Please run the following command to bring your dataset up to spec:');
				winston.error('    ./skybb upgrade');//modified by lwf
				break;
			case 'dependencies-out-of-date':
				winston.error('One or more of SkyBB\'s dependent packages are out-of-date. Please run the following command to update them:');
				winston.error('    ./skybb upgrade');//modified by lwf
				break;
			case 'dependencies-missing':
				winston.error('One or more of SkyBB\'s dependent packages are missing. Please run the following command to update them:');
				winston.error('    ./skybb upgrade');//modified by lwf
				break;
			default:
				winston.error(err);
				break;
			}

			// Either way, bad stuff happened. Abort start.
			process.exit();
		}

		if (process.send) {
			process.send({
				action: 'listening',
			});
		}
	});
};

function printStartupInfo() {
	if (nconf.get('isPrimary') === 'true') {
		winston.info('Initializing SkyBB v%s %s', nconf.get('version'), nconf.get('url'));

		var host = nconf.get(nconf.get('database') + ':host');
		var storeLocation = host ? 'at ' + host + (!host.includes('/') ? ':' + nconf.get(nconf.get('database') + ':port') : '') : '';

		winston.verbose('* using %s store %s', nconf.get('database'), storeLocation);
		winston.verbose('* using themes stored in: %s', nconf.get('themes_path'));
	}
}

function addProcessHandlers() {
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
	process.on('SIGHUP', restart);
	process.on('uncaughtException', function (err) {
		winston.error(err);

		///require('skynode-basis/meta').js.killMinifier();
		restart(); //  modified by lwf
		//shutdown(1);
	});
}

function restart() {
	if (process.send) {
		winston.info('[app] Restarting...');
		process.send({
			action: 'restart',
		});
	} else {
		winston.error('[app] Could not restart server. Shutting down.');
		shutdown(1);
	}
}

function shutdown(code) {
	winston.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
	async.waterfall([
		///function (next) {
		///	require('skynode-server').destroy(next);
		///},
		function (next) {
			winston.info('[app] Web server closed to connections.');
			require('skynode-basis/analytics').writeData(next);
		},
		function (next) {
			winston.info('[app] Live analytics saved.');
			require('skynode-basis/database').close(next);
		},
	], function (err) {
		if (err) {
			winston.error(err);
			return process.exit(code || 0);
		}
		winston.info('[app] Database connection closed.');
		winston.info('[app] Shutdown complete.');
		process.exit(code || 0);
	});
}

module.exports = {
	start
};
///start();