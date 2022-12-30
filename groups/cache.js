'use strict';

var LRU = require('lru-cache');
var pubsub = require('../pubsub');

var cache = new LRU({
  max: 40000,

  // for use with tracking overall storage size
  maxSize: 5000,

  maxAge: 0,

  sizeCalculation: (value, key) => {
    return 1
  },

  // how long to live in ms
  ttl: 1000 * 60 * 5,

  // return stale items before removing from cache?
  allowStale: false,

  updateAgeOnGet: false,
  updateAgeOnHas: false,

  // async method to use for cache.fetch(), for
  // stale-while-revalidate type of behavior
  fetchMethod: async (key, staleValue, { options, signal }) => {}
});


cache.hits = 0;
cache.misses = 0;

module.exports = function (Groups) {
	Groups.cache = cache;

	pubsub.on('group:cache:reset', function () {
		localReset();
	});

	pubsub.on('group:cache:del', function (data) {
		if (data && data.groupNames) {
			data.groupNames.forEach(function (groupName) {
				cache.del(data.uid + ':' + groupName);
			});
		}
	});

	Groups.resetCache = function () {
		pubsub.publish('group:cache:reset');
		localReset();
	};

	function localReset() {
		cache.reset();
		cache.hits = 0;
		cache.misses = 0;
	}

	Groups.clearCache = function (uid, groupNames) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}
		pubsub.publish('group:cache:del', { uid: uid, groupNames: groupNames });
		groupNames.forEach(function (groupName) {
			cache.del(uid + ':' + groupName);
		});
	};
};
