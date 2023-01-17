var nconf = require('../../system/parameters');
var winston = require('winston');
var mime = require('mime');
var strings = require("skylark-langx-strings");

var nfs = module.exports = require("skynode-nfs");

nfs.saveFileToLocal = function (filename, folder, tempPath, callback) {
	/*
	 * remarkable doesn't allow spaces in hyperlinks, once that's fixed, remove this.
	 */
	filename = filename.split('.').map(function (name) {
		return strings.slugify(name);
	}).join('.');

	var uploadPath = nfs.join(nconf.get('upload_path'), folder, filename);

	winston.verbose('Saving file ' + filename + ' to : ' + uploadPath);
	nfs.mkdir(nfs.dirname(uploadPath), function (err) {
		if (err) {
			return callback(err);
		}

		nfs.copyFile(tempPath, uploadPath, function (err) {
			if (err) {
				return callback(err);
			}

			callback(null, {
				url: '/assets/uploads/' + (folder ? folder + '/' : '') + filename,
				path: uploadPath,
			});
		});
	});
};

nfs.typeToExtension = function (type) {
	var extension;
	if (type) {
		extension = '.' + mime.getExtension(type);
	}
	return extension;
};

nfs.appendToFileName = function (filename, string) {
	var dotIndex = filename.lastIndexOf('.');
	if (dotIndex === -1) {
		return filename + string;
	}
	return filename.substring(0, dotIndex) + string + filename.substring(dotIndex);
};

nfs.delete = function (path, callback) {
	callback = callback || function () {};
	if (!path) {
		return setImmediate(callback);
	}
	nfs.unlink(path, function (err) {
		if (err) {
			winston.warn(err);
		}
		callback();
	});
};
