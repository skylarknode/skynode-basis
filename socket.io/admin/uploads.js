'use strict';
var async = require('async');

var nfs = require('../../helpers/files/nfs');

var SocketAdmin = require("../admin");

var SocketUploads = SocketAdmin.uploads = module.exports;


SocketUploads.delete = function (socket, pathToFile, callback) {
	pathToFile = nfs.join(nconf.get('upload_path'), pathToFile);
	if (!pathToFile.startsWith(nconf.get('upload_path'))) {
		return callback(new Error('[[error:invalid-path]]'));
	}

	nfs.unlink(pathToFile, callback);
};
