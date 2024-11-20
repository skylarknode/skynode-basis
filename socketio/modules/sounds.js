'use strict';
var async = require('async');

var user = require('../../user');

var SocketModules = require("../modules");

var SocketSounds = SocketModules.sounds = module.exports;

/* Sounds */
SocketSounds.getUserSoundMap = function getUserSoundMap(socket, data, callback) {
	//meta.sounds.getUserSoundMap(socket.uid, callback);
	user.getUserSoundMap(socket.uid, callback);
};
