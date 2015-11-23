#!/usr/bin/env node
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _meow = require('meow');

var _meow2 = _interopRequireDefault(_meow);

var _index = require('./index');

var cli = (0, _meow2['default'])({
  help: ['Usage', '  $ electron-release', 'Options', '  --app  [Required] The path to the .app to compress and upload.', '  --token  [Required] Github token to be able to publish the relase.', '  --tag  The git tag connected to the release, needs to be semver. Defaults to version in package.json', '  --repo  The github repo in the following format: "username/reponame". Defaults to repository.url in package.json', '  --name  The name of the relase. Defaults to --tag', '  --output  The .zip output folder. Defaults to same folder as .app']
});

var opts = (0, _index.normalizeOptions)(cli.flags);

if (!opts.tag || !opts.repo || !opts.app || !opts.token) {
  console.log('Missing required options.');
  process.exit();
}

_bluebird2['default'].resolve().then(function () {
  return (0, _index.compress)(opts);
}).then(function () {
  return (0, _index.release)(_extends({}, opts, { verbose: true }));
}).then(function (url) {
  return (0, _index.updateUrl)(url);
}).then(function () {
  console.log(_chalk2['default'].green('Published new release to GitHub (' + opts.tag + ')'));
})['catch'](function (err) {
  console.log(_chalk2['default'].red(err));
  process.exit();
});