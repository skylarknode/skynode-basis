'use strict';

var LRU = require('lru-cache');
var pubsub = require('./pubsub');

const cacheGet = LRU.prototype.get;
const cacheDel = LRU.prototype.del;
const cacheReset = LRU.prototype.reset;

class LRU2 extends LRU {
   get(key) {
		const data = cacheGet.apply(cache, [key]);
		if (data === undefined) {
			cache.misses += 1;
		} else {
			cache.hits += 1;
		}
		return data;
	}

	del(key) {
		if (!Array.isArray(key)) {
			key = [key];
		}
		pubsub.publish('local:cache:del', key);
		key.forEach(key => cacheDel.apply(cache, [key]));
	};

	reset() {
		pubsub.publish('local:cache:reset');
		localReset();
	}

}

var cache = new LRU2({
	max: 1000,
	maxSize:10000,
	///maxAge: 0,
	ttl: 1000 * 60 * 5,
    sizeCalculation: (value, key) => {
    	// return an positive integer which is the size of the item,
    	// if a positive integer is not returned, will use 0 as the size.
    	return 1
  	}

});

cache.hits = 0;
cache.misses = 0;

function localReset() {
	cacheReset.apply(cache);
	cache.hits = 0;
	cache.misses = 0;
}

pubsub.on('local:cache:reset', function () {
	localReset();
});

pubsub.on('local:cache:del', function (keys) {
	if (Array.isArray(keys)) {
		keys.forEach(key => cacheDel.apply(cache, [key]));
	}
});

module.exports = cache;
