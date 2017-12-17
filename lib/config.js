'use strict';

exports.__esModule = true;
exports.DAEMON_COMMAND = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.stringifyProxyOptions = stringifyProxyOptions;
exports.resolveServerAddr = resolveServerAddr;
exports.getDefaultProxyOptions = getDefaultProxyOptions;
exports.getConfig = getConfig;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _ip = require('ip');

var _dns = require('dns');

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

var _fs = require('fs');

var _defaultConfig = require('./defaultConfig');

var _defaultConfig2 = _interopRequireDefault(_defaultConfig);

var _config = require('../config.json');

var _config2 = _interopRequireDefault(_config);

var _utils = require('./utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DAEMON_COMMAND = exports.DAEMON_COMMAND = {
  start: 'start',
  stop: 'stop',
  restart: 'restart'
};

var PROXY_ARGUMENT_PAIR = {
  c: 'configFilePath',
  s: 'serverAddr',
  p: 'serverPort',
  pac_port: 'pacServerPort',
  l: 'localAddr',
  b: 'localPort',
  k: 'password',
  m: 'method',
  t: 'timeout',
  level: 'level',
  log_path: 'logPath',
  // private
  mem: '_recordMemoryUsage'
};

var PROXY_ARGUMENT_EXTRAL_KEYS = ['localAddrIPv6', 'serverAddrIPv6', '_recordMemoryUsage'];

var GENERAL_ARGUMENT_PAIR = {
  h: 'help',
  help: 'help',
  d: 'daemon',
  pac_update_gfwlist: 'pacUpdateGFWList'
};

function getProxyOptionArgName(optionName) {
  // ignore these keys
  if (PROXY_ARGUMENT_EXTRAL_KEYS.indexOf(optionName) >= 0) {
    return null;
  }

  var result = Object.keys(PROXY_ARGUMENT_PAIR).find(function (item) {
    return PROXY_ARGUMENT_PAIR[item] === optionName;
  });

  if (!result) {
    throw new Error('invalid optionName: "' + optionName + '"');
  }

  return result;
}

function stringifyProxyOptions(proxyOptions) {
  if ((typeof proxyOptions === 'undefined' ? 'undefined' : _typeof(proxyOptions)) !== 'object') {
    throw new Error('invalid type of "proxyOptions"');
  }

  var args = [];

  Object.keys(proxyOptions).forEach(function (optionName) {
    var value = proxyOptions[optionName];
    var argName = getProxyOptionArgName(optionName);

    if (!argName) {
      return;
    }

    args.push((0, _utils.getPrefixedArgName)(argName), value);
  });

  return args.join(' ');
}

function getArgvOptions(argv) {
  var generalOptions = {};
  var proxyOptions = {};
  var configPair = (0, _minimist2.default)(argv);
  var optionsType = [{
    options: proxyOptions,
    keys: Object.keys(PROXY_ARGUMENT_PAIR),
    values: PROXY_ARGUMENT_PAIR
  }, {
    options: generalOptions,
    keys: Object.keys(GENERAL_ARGUMENT_PAIR),
    values: GENERAL_ARGUMENT_PAIR
  }];

  var invalidOption = null;

  Object.keys(configPair).forEach(function (key) {
    if (key === '_') {
      return;
    }

    var hit = false;

    optionsType.forEach(function (optType) {
      var i = optType.keys.indexOf(key);

      if (i >= 0) {
        optType.options[optType.values[optType.keys[i]]] = configPair[key]; // eslint-disable-line
        hit = true;
      }
    });

    if (!hit) {
      invalidOption = key;
    }
  });

  if (invalidOption) {
    invalidOption = invalidOption.length === 1 ? '-' + invalidOption : '--' + invalidOption;
  } else if (generalOptions.daemon && Object.keys(DAEMON_COMMAND).indexOf(generalOptions.daemon) < 0) {
    invalidOption = 'invalid daemon command: ' + generalOptions.daemon;
  }

  if (proxyOptions.logPath && !_path2.default.isAbsolute(proxyOptions.logPath)) {
    proxyOptions.logPath = _path2.default.resolve(process.cwd(), proxyOptions.logPath);
  }

  return {
    generalOptions: generalOptions, proxyOptions: proxyOptions, invalidOption: invalidOption
  };
}

function readConfig(_filePath) {
  if (!_filePath) {
    return null;
  }

  var filePath = _path2.default.resolve(process.cwd(), _filePath);

  try {
    (0, _fs.accessSync)(filePath);
  } catch (e) {
    throw new Error('failed to find config file in: ' + filePath);
  }

  return JSON.parse((0, _fs.readFileSync)(filePath));
}

/**
 * Transform domain && ipv6 to ipv4.
 */
function resolveServerAddr(config, next) {
  var serverAddr = config.proxyOptions.serverAddr;


  if ((0, _ip.isV4Format)(serverAddr)) {
    next(null, config);
  } else {
    (0, _dns.lookup)(serverAddr, function (err, addresses) {
      if (err) {
        next(new Error('failed to resolve \'serverAddr\': ' + serverAddr), config);
      } else {
        // NOTE: mutate data
        config.proxyOptions.serverAddr = addresses; // eslint-disable-line
        next(null, config);
      }
    });
  }
}

function getDefaultProxyOptions() {
  return Object.assign({}, _defaultConfig2.default);
}

function getConfig() {
  var argv = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var arg1 = arguments[1];
  var arg2 = arguments[2];

  var doNotResolveIpv6 = arg1;
  var next = arg2;

  if (!arg2) {
    doNotResolveIpv6 = false;
    next = arg1;
  }

  var _getArgvOptions = getArgvOptions(argv),
      generalOptions = _getArgvOptions.generalOptions,
      proxyOptions = _getArgvOptions.proxyOptions,
      invalidOption = _getArgvOptions.invalidOption;

  var specificFileConfig = readConfig(proxyOptions.configFilePath) || _config2.default;
  var config = {
    generalOptions: generalOptions,
    invalidOption: invalidOption,
    proxyOptions: Object.assign({}, _defaultConfig2.default, specificFileConfig, proxyOptions)
  };

  if (doNotResolveIpv6) {
    next(null, config);
    return;
  }

  resolveServerAddr(config, next);
}