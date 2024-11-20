'use strict';

var Sockets = module.exports = require("./sockets");

require("./admin");
require("./admin/analytics");
require("./admin/config");
require("./admin/email");
require("./admin/errors");
require("./admin/groups");
require("./admin/logs");
require("./admin/plugins");
require("./admin/settings");
require("./admin/uploads");
require("./admin/user");

require("./blacklist");
require("./groups");
require("./meta");
require("./modules");
require("./modules/sounds");
require("./notifications");
require("./plugins");
require("./user");

