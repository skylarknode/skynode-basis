const redisModule = require('skynode-kvs/redisdb');
const nconf = require('nconf');
const { createAdapter } = require("@socket.io/redis-adapter");

module.exports = function socketAdapter() {
	var pub = redisModule.connect(nconf.get('redis'));
	var sub = pub.duplicate();

	//return redisAdapter({
	//	key: 'db:' + nconf.get('redis:database') + ':adapter_key',
	//	pubClient: pub,
	//	subClient: sub,
	//});

	return createAdapter(pub,sub);
};
