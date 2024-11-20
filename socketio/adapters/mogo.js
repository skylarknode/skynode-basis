var mongoAdapter = require('socket.io-adapter-mongo');
var mongoModule = require('skynode-kvs/mogo');

module.exports = function socketAdapter() {
	var mongoAdapter = require('socket.io-adapter-mongo');
	return mongoAdapter(mongoModule.getConnectionString());
};
