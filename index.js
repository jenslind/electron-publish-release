'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.normalizeOptions = normalizeOptions;
exports.compress = compress;
exports.release = release;
exports.updateUrl = updateUrl;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _publishRelease = require('publish-release');

var _publishRelease2 = _interopRequireDefault(_publishRelease);

var _got = require('got');

var _got2 = _interopRequireDefault(_got);

var _loadJsonFile = require('load-json-file');

var _loadJsonFile2 = _interopRequireDefault(_loadJsonFile);

var _writeJsonFile = require('write-json-file');

var _writeJsonFile2 = _interopRequireDefault(_writeJsonFile);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _singleLineLog = require('single-line-log');

var _prettyBytes = require('pretty-bytes');

var _prettyBytes2 = _interopRequireDefault(_prettyBytes);

var _archiver = require('archiver');

var _archiver2 = _interopRequireDefault(_archiver);

function loadPackageJson() {
  try {
    return _loadJsonFile2['default'].sync('./package.json');
  } catch (err) {
    return;
  }
}

function getRepo(pkg) {
  var url = pkg.repository.url.split('/');
  return url[3] + '/' + url[4].replace(/\.[^/.]+$/, '');
}

function getTag(pkg) {
  return 'v' + pkg.version;
}

function ensureArray(val) {
  if (!Array.isArray(val)) {
    return val.replace(/ /g, '').split(',');
  }

  return val;
}

function ensureZip(file) {
  if (_path2['default'].extname(file) === '.zip') {
    return file;
  } else {
    return file + '.zip';
  }
}

function normalizeOptions() {
  var opts = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  if (!opts.app || !opts.token) return opts;

  var pkg = loadPackageJson();

  if (!opts.repo) opts.repo = getRepo(pkg);
  if (!opts.tag) opts.tag = getTag(pkg);
  if (!opts.name) opts.name = opts.tag;
  if (!opts.output) opts.output = opts.app;

  opts.app = ensureArray(opts.app);
  opts.output = ensureArray(opts.output).map(ensureZip);

  return opts;
}

function compress(_ref) {
  var app = _ref.app;
  var output = _ref.output;

  if (app.length !== output.length) {
    return _bluebird2['default'].reject(new Error('Output length does not match app length'));
  }

  var cwd = process.cwd();

  var promises = app.map(function (src, index) {
    var pathSrcFile = _path2['default'].join(cwd, src);
    var pathDstFile = _path2['default'].join(cwd, output[index]);

    return new _bluebird2['default'](function (resolve, reject) {
      var output = _fs2['default'].createWriteStream(pathDstFile);
      var archive = (0, _archiver2['default'])('zip');

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      _fs2['default'].lstat(pathSrcFile, function (err, stats) {
        if (err) return reject(err);

        var srcFilename = _path2['default'].basename(pathSrcFile);
        if (stats.isDirectory()) {
          archive.directory(pathSrcFile, srcFilename);
        } else {
          archive.append(_fs2['default'].createReadStream(pathSrcFile), { name: srcFilename });
        }
        archive.finalize();
      });
    });
  });

  return _bluebird2['default'].all(promises)['catch'](function (err) {
    throw new Error('Unable to compress app. ' + err.stack);
  });
}

function release(_ref2) {
  var token = _ref2.token;
  var repo = _ref2.repo;
  var tag = _ref2.tag;
  var name = _ref2.name;
  var output = _ref2.output;
  var verbose = _ref2.verbose;

  return publishReleaseAsync({ token: token, repo: repo, tag: tag, name: name, output: output, verbose: verbose }).then(function (_ref3) {
    var assets_url = _ref3.assets_url;

    return (0, _got2['default'])(assets_url);
  }).then(function (res) {
    var jsonBody = JSON.parse(res.body);
    return jsonBody[0].browser_download_url;
  })['catch'](function (err) {
    console.error(err);
    throw new Error('Unable to create a new release on GitHub.');
  });
}

function updateUrl(releaseUrl) {
  return (0, _loadJsonFile2['default'])('./auto_updater.json').then(function (content) {
    content.url = releaseUrl;
    return (0, _writeJsonFile2['default'])('./auto_updater.json', content);
  })['catch'](function () {});
}

function publishReleaseAsync(_ref4) {
  var token = _ref4.token;
  var repo = _ref4.repo;
  var tag = _ref4.tag;
  var name = _ref4.name;
  var output = _ref4.output;
  var verbose = _ref4.verbose;

  return new _bluebird2['default'](function (resolve, reject) {
    var publishRelease = new _publishRelease2['default']({
      token: token, tag: tag, name: name,
      owner: repo.split('/')[0],
      repo: repo.split('/')[1],
      assets: output
    }, function (err, release) {
      if (err) return reject(err);
      resolve(release);
    });

    if (verbose) {
      publishRelease.on('upload-progress', render);
      publishRelease.on('uploaded-asset', function () {
        return _singleLineLog.stdout.clear();
      });
    }
  });
}

function render(name, prog) {
  var pct = prog.percentage;
  var speed = (0, _prettyBytes2['default'])(prog.speed);
  var bar = Array(Math.floor(50 * pct / 100)).join('=') + '>';
  while (bar.length < 50) bar += ' ';

  (0, _singleLineLog.stdout)(['\nUploading ' + name + '\n', '[' + bar + '] ' + pct.toFixed(1) + '% (' + speed + '/s)\n'].join(''));
}