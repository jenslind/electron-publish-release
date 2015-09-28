'use strict'
const Promise = require('bluebird')
const execAsync = Promise.promisify(require('child_process').exec)
const publishReleaseAsync = Promise.promisify(require('publish-release'))
const got = require('got')
const loadJsonFile = require('load-json-file')
const writeJsonFile = require('write-json-file')
const path = require('path')

function loadPackageJson() {
  try {
    return loadJsonFile.sync('./package.json')
  } catch (err) {
    return
  }
}

function getRepo(pkg) {
  let url = pkg.repository.url.split('/')
  return url[3] + '/' + url[4].replace(/\.[^/.]+$/, '')
}

function getTag() {
  return `v${version}`
}

export function normalizeOptions(opts = {}) {
  let pkg = loadPackageJson()

  if (!opts.repo) opts.repo = getRepo(pkg)
  if (!opts.tag) opts.tag = getTag(pkg)
  if (!opts.name) opts.name = opts.tag
  if (!opts.output) opts.output = opts.app

  return opts
}

export function compress({ app, output }) {
  if (!Array.isArray(app)) app = app.replace(/ /g, '').split(',')
  if (!Array.isArray(output)) output = output.replace(/ /g, '').split(',')

  if (app.length !== output.length) {
    return Promise.reject(new Error('Output length does not match app length'))
  }

  return Promise.resolve(app).map((item, index) => {
    let outputZip = (path.extname(output[i]) === '.zip') ? output[i] : output[i] + '.zip'
    let cmd = `ditto -c -k --sequesterRsrc --keepParent ${item} ${outputZip}`

    return execAsync(cmd).catch(err => {
      throw new Error('Unable to compress app.')
    })
  })
}

export function release({ token, repo, tag, name, output }) {
  return publishReleaseAsync({
    token, tag, name,
    owner: repo.split('/')[0],
    repo: repo.split('/')[1],
    assets: output
  }).then({ assets_url } => {
    return got(assets_url);
  }).then(res => {
    let jsonBody = JSON.parse(res.body)
    return jsonBody[0].browser_download_url
  }).catch(err => {
    throw new Error('Unable to create a new release on GitHub.')
  })
}

export function updateUrl(releaseUrl) {
  return loadJsonFile('./auto_updater.json').then(content => {
    content.url = releaseUrl
    return writeJsonFile('./auto_updater.json', content)
  }).catch()
}
