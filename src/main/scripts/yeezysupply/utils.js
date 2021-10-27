'use strict';

const constants = require('./constants');

exports.randomString = function randomString() {
  return Math.random()
    .toString(36)
    .substring(7);
};

exports.randomInt = function randomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

exports.parseProxyUrl = function(proxyUrl) {
  let proxyConfig = {
    name: constants.NO_PROXY,
    proxyAddress: null,
    proxyUser: null,
    proxyPassword: null,
  };
  if (proxyUrl != constants.NO_PROXY) {
    let parts = proxyUrl.split(':');
    proxyConfig.proxyAddress = parts[0] + ':' + parts[1];
    proxyConfig.proxyUser = parts[2];
    proxyConfig.proxyPassword = parts[3];
    proxyConfig.name = proxyConfig.proxyAddress + ':' + proxyConfig.proxyUser;
  }
  return proxyConfig;
};
