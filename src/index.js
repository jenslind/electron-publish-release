'use strict'
const exec = require('child_process').exec
const publishRelease = require('publish-release')
const got = require('got')
const Promise = require('bluebird')
const loadJsonFile = require('load-json-file')
const writeJsonFile = require('write-json-file')
const path = require('path')

export default class Publish {

  constructor (opts = {}) {
    this.opts = opts;
    if (!opts.repo) opts.repo = this._getRepo()
    if (!opts.tag) opts.tag = this._getTag()
    if (!opts.name) opts.name = opts.tag
    if (!opts.output) opts.output = opts.app

    this._releaseUrl = null
  }

  // Zip compress .app
  compress () {
    let { app, output } = this.opts;

    if (!Array.isArray(app)) app = app.replace(/ /g, '').split(',')
    if (!Array.isArray(output)) output = output.replace(/ /g, '').split(',')

    return new Promise((resolve, reject) => {
      if (app.length !== output.length) reject(new Error('Output length does not match app length'))

      for (let i in app) {
        let outputZip = (path.extname(output[i]) === '.zip') ? output[i] : output[i] + '.zip'
        let cmd = `ditto -c -k --sequesterRsrc --keepParent ${app[i]} ${outputZip}`;
        exec(cmd, err => {
          if (!err) {
            resolve()
          } else {
            reject(new Error('Unable to compress app.'))
          }
        })
      }
    })
  }

  // Create new release with zip as asset.
  release () {
    return new Promise((resolve, reject) => {
      publishRelease({
        token: this.opts.token,
        owner: this.opts.repo.split('/')[0],
        repo: this.opts.repo.split('/')[1],
        tag: this.opts.tag,
        name: this.opts.name,
        assets: this.opts.output
      }, (err, release) => {
        if (!err) {
          got(release.assets_url).then(res => {
            var jsonBody = JSON.parse(res.body)
            this._releaseUrl = jsonBody[0].browser_download_url
            resolve()
          })
        } else {
          reject(new Error('Unable to create a new release on GitHub.'))
        }
      })
    })
  }

  // Update auto_update.json file with latest url.
  updateUrl () {
    return new Promise(resolve => {
      loadJsonFile('./auto_updater.json').then(content => {
        content.url = this._releaseUrl
        writeJsonFile('./auto_updater.json', content).then(() => {
          resolve()
        })
      })
      .catch(err => {
        resolve()
      })
    })
  }

  // Load package.json
  _loadPackageJson () {
    try {
      return loadJsonFile.sync('./package.json')
    } catch (err) {
      return
    }
  }

  // Get repo from package.json
  _getRepo () {
    let pkg = this._loadPackageJson()

    let url = pkg.repository.url.split('/')
    return url[3] + '/' + url[4].replace(/\.[^/.]+$/, '')
  }

  // Get tag (version) from package.json
  _getTag () {
    let pkg = this._loadPackageJson()

    let version = pkg.version
    return 'v' + version
  }

}
