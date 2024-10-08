'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var winston = require('winston');
var semver = require('semver');
var nconf = require('nconf');

var app;
var middleware;

var Plugins = module.exports;

require('./install')(Plugins);
require('./load')(Plugins);
require('./hooks')(Plugins);
Plugins.data = require('./data');

Plugins.getPluginPaths = Plugins.data.getPluginPaths;
Plugins.loadPluginInfo = Plugins.data.loadPluginInfo;

Plugins.pluginsData = {};
Plugins.libraries = {};
Plugins.loadedHooks = {};
Plugins.staticDirs = {};
Plugins.cssFiles = [];
Plugins.lessFiles = [];
Plugins.acpLessFiles = [];
Plugins.clientScripts = [];
Plugins.acpScripts = [];
Plugins.libraryPaths = [];
Plugins.versionWarning = [];
Plugins.soundpacks = [];
Plugins.languageData = {};

Plugins.initialized = false;

var defaultRequire = module.require;

module.require = function (p) {
	try {
		return defaultRequire.apply(module, arguments);
	} catch (err) {
		// if we can't find the module try in parent directory
		// since plugins.js moved into plugins folder
		if (err.code === 'MODULE_NOT_FOUND') {
			let stackLine = err.stack.split('\n');
			stackLine = stackLine.find(line => line.includes('nodebb-plugin') || line.includes('nodebb-theme') || line.includes('skybb-plugin') || line.includes('skybb-theme'));
			var deprecatedPath = err.message.replace('Cannot find module ', '');
			winston.warn('[deprecated] requiring core modules with `module.parent.require(' + deprecatedPath + ')` is deprecated. Please use `require.main.require("./src/<module_name>")` instead.\n' + stackLine);
			if (path.isAbsolute(p)) {
				throw err;
			}
			//return defaultRequire.apply(module, [path.join('../', p)]); // modified by lwf
			return defaultRequire.apply(module, [path.join('../../src', p)]);
		}
		throw err;
	}
};

Plugins.requireLibrary = function (pluginID, libraryPath) {
	Plugins.libraries[pluginID] = require(libraryPath);
	Plugins.libraryPaths.push(libraryPath);
};

Plugins.init = function (nbbApp, nbbMiddleware, callback) {
	callback = callback || function () {};
	if (Plugins.initialized) {
		return callback();
	}

	if (nbbApp) {
		app = nbbApp;
		middleware = nbbMiddleware;
	}

	if (global.env === 'development') {
		winston.verbose('[plugins] Initializing plugins system');
	}

	Plugins.reload(function (err) {
		if (err) {
			console.error(err);
			winston.error('[plugins] SkyBB encountered a problem while loading plugins', err);
			return callback(err);
		}

		if (global.env === 'development') {
			winston.info('[plugins] Plugins OK');
		}

		Plugins.initialized = true;
		callback();
	});
};

Plugins.reload = function (callback) {
	// Resetting all local plugin data
	Plugins.libraries = {};
	Plugins.loadedHooks = {};
	Plugins.staticDirs = {};
	Plugins.versionWarning = [];
	Plugins.cssFiles.length = 0;
	Plugins.lessFiles.length = 0;
	Plugins.acpLessFiles.length = 0;
	Plugins.clientScripts.length = 0;
	Plugins.acpScripts.length = 0;
	Plugins.libraryPaths.length = 0;

	async.waterfall([
		Plugins.getPluginPaths,
		function (paths, next) {
			async.eachSeries(paths, Plugins.loadPlugin, next);
		},
		function (next) {
			// If some plugins are incompatible, throw the warning here
			if (Plugins.versionWarning.length && nconf.get('isPrimary') === 'true') {
				winston.warn('[plugins/load] The following plugins may not be compatible with your version of SkyBB. This may cause unintended behaviour or crashing. In the event of an unresponsive SkyBB caused by this plugin, run `./nodebb reset -p PLUGINNAME` to disable it.');
				for (var x = 0, numPlugins = Plugins.versionWarning.length; x < numPlugins; x += 1) {
					console.log('  * '.yellow + Plugins.versionWarning[x]);
				}
			}

			Object.keys(Plugins.loadedHooks).forEach(function (hook) {
				var hooks = Plugins.loadedHooks[hook];
				hooks.sort(function (a, b) {
					return a.priority - b.priority;
				});
			});

			next();
		},
	], callback);
};


Plugins.get = function (id, callback) {
	var url = (nconf.get('registry') || 'https://packages.nodebb.org') + '/api/v1/plugins/' + id;

	require('request')(url, {
		json: true,
	}, function (err, res, body) {
		if (res.statusCode === 404 || !body.payload) {
			return callback(err, {});
		}

		Plugins.normalise([body.payload], function (err, normalised) {
			normalised = normalised.filter(function (plugin) {
				return plugin.id === id;
			});
			return callback(err, !err ? normalised[0] : undefined);
		});
	});
};

Plugins.list = function (matching, callback) {
	if (arguments.length === 1 && typeof matching === 'function') {
		callback = matching;
		matching = true;
	}
	var version = require(path.join(nconf.get('base_dir'), 'package.json')).version;
	var url = (nconf.get('registry') || 'https://packages.nodebb.org') + '/api/v1/plugins' + (matching !== false ? '?version=' + version : '');

	require('request')(url, {
		json: true,
	}, function (err, res, body) {
		if (err || (res && res.statusCode !== 200)) {
			winston.error('Error loading ' + url, err || body);
			return Plugins.normalise([], callback);
		}

		Plugins.normalise(body, callback);
	});
};

Plugins.normalise = function (apiReturn, callback) {
	var themeNamePattern = /^(@.*?\/)?(nodebb|skybb)-theme-.*$/;//modified by lwf
	var pluginMap = {};
	var dependencies = require(path.join(nconf.get('base_dir'), 'package.json')).dependencies;
	apiReturn = Array.isArray(apiReturn) ? apiReturn : [];
	for (var i = 0; i < apiReturn.length; i += 1) {
		apiReturn[i].id = apiReturn[i].name;
		apiReturn[i].installed = false;
		apiReturn[i].active = false;
		apiReturn[i].url = apiReturn[i].url || (apiReturn[i].repository ? apiReturn[i].repository.url : '');
		pluginMap[apiReturn[i].name] = apiReturn[i];
	}

	Plugins.showInstalled(function (err, installedPlugins) {
		if (err) {
			return callback(err);
		}

		installedPlugins = installedPlugins.filter(function (plugin) {
			return plugin && !plugin.system;
		});

		async.each(installedPlugins, function (plugin, next) {
			// If it errored out because a package.json or plugin.json couldn't be read, no need to do this stuff
			if (plugin.error) {
				pluginMap[plugin.id] = pluginMap[plugin.id] || {};
				pluginMap[plugin.id].installed = true;
				pluginMap[plugin.id].error = true;
				return next();
			}

			pluginMap[plugin.id] = pluginMap[plugin.id] || {};
			pluginMap[plugin.id].id = pluginMap[plugin.id].id || plugin.id;
			pluginMap[plugin.id].name = plugin.name || pluginMap[plugin.id].name;
			pluginMap[plugin.id].description = plugin.description;
			pluginMap[plugin.id].url = pluginMap[plugin.id].url || plugin.url;
			pluginMap[plugin.id].installed = true;
			pluginMap[plugin.id].isTheme = themeNamePattern.test(plugin.id);
			pluginMap[plugin.id].error = plugin.error || false;
			pluginMap[plugin.id].active = plugin.active;
			pluginMap[plugin.id].version = plugin.version;
			pluginMap[plugin.id].settingsRoute = plugin.settingsRoute;
			pluginMap[plugin.id].license = plugin.license;

			// If package.json defines a version to use, stick to that
			if (dependencies.hasOwnProperty(plugin.id) && semver.valid(dependencies[plugin.id])) {
				pluginMap[plugin.id].latest = dependencies[plugin.id];
			} else {
				pluginMap[plugin.id].latest = pluginMap[plugin.id].latest || plugin.version;
			}
			pluginMap[plugin.id].outdated = semver.gt(pluginMap[plugin.id].latest, pluginMap[plugin.id].version);
			next();
		}, function (err) {
			if (err) {
				return callback(err);
			}

			var pluginArray = [];

			for (var key in pluginMap) {
				if (pluginMap.hasOwnProperty(key)) {
					pluginArray.push(pluginMap[key]);
				}
			}

			pluginArray.sort(function (a, b) {
				if (a.name > b.name) {
					return 1;
				} else if (a.name < b.name) {
					return -1;
				}
				return 0;
			});

			callback(null, pluginArray);
		});
	});
};

//Plugins.nodeModulesPath = path.join(__dirname, '../../node_modules');

Plugins.nodeModulesPath = path.join(nconf.get('base_dir'), 'node_modules');

Plugins.showInstalled = function (callback) {
	var pluginNamePattern = /^(@.*?\/)?(nodebb|skybb)-(theme|plugin|widget|rewards)-.*$/;  //modified by lwf

	async.waterfall([
		function (next) {
			fs.readdir(Plugins.nodeModulesPath, next);
		},
		function (dirs, next) {
			var pluginPaths = [];

			async.each(dirs, function (dirname, next) {
				var dirPath = path.join(Plugins.nodeModulesPath, dirname);

				async.waterfall([
					function (cb) {
						fs.stat(dirPath, function (err, stats) {
							if (err && err.code !== 'ENOENT') {
								return cb(err);
							}
							if (err || !stats.isDirectory()) {
								return next();
							}

							if (pluginNamePattern.test(dirname)) {
								pluginPaths.push(dirname);
								return next();
							}

							if (dirname[0] !== '@') {
								return next();
							}
							fs.readdir(dirPath, cb);
						});
					},
					function (subdirs, cb) {
						async.each(subdirs, function (subdir, next) {
							if (!pluginNamePattern.test(subdir)) {
								return next();
							}

							var subdirPath = path.join(dirPath, subdir);
							fs.stat(subdirPath, function (err, stats) {
								if (err && err.code !== 'ENOENT') {
									return next(err);
								}

								if (err || !stats.isDirectory()) {
									return next();
								}

								pluginPaths.push(dirname + '/' + subdir);
								next();
							});
						}, cb);
					},
				], next);
			}, function (err) {
				next(err, pluginPaths);
			});
		},

		function (dirs, next) {
			dirs = dirs.map(function (dir) {
				return path.join(Plugins.nodeModulesPath, dir);
			});
			var plugins = [];

			async.each(dirs, function (file, next) {
				async.waterfall([
					function (next) {
						Plugins.loadPluginInfo(file, next);
					},
					function (pluginData, next) {
						Plugins.isActive(pluginData.name, function (err, active) {
							if (err) {
								return next(new Error('no-active-state'));
							}

							delete pluginData.hooks;
							delete pluginData.library;
							pluginData.active = active;
							pluginData.installed = true;
							pluginData.error = false;
							next(null, pluginData);
						});
					},
				], function (err, pluginData) {
					if (err) {
						return next(); // Silently fail
					}

					plugins.push(pluginData);
					next();
				});
			}, function (err) {
				next(err, plugins);
			});
		},
	], callback);
};

Plugins.async = require('../promisify')(Plugins);
