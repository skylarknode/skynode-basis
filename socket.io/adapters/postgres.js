var postgresAdapter = require('socket.io-adapter-postgres');
var postgresModule = require('skynode-kvs/postgres');

module.exports = function socketAdapter() {{
	return postgresAdapter(postgresModule.getConnectionOptions(), {
		pubClient: postgresModule.pool,
	});
};