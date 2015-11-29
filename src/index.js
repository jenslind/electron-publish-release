import Promise from 'bluebird'
import {exec} from 'child_process'
import PublishRelease from 'publish-release'
import got from 'got'
import loadJsonFile from 'load-json-file'
import writeJsonFile from 'write-json-file'
import fs from 'fs'
import path from 'path'
import { stdout as log } from 'single-line-log'
import prettyBytes from 'pretty-bytes'
import archiver from 'archiver'

const execAsync = Promise.promisify(exec)

function loadPackageJson () {
  try {
    return loadJsonFile.sync('./package.json')
  } catch (err) {
    return
  }
}

function getRepo (pkg) {
  let url = pkg.repository.url.split('/')
  return url[3] + '/' + url[4].replace(/\.[^/.]+$/, '')
}

function getTag (pkg) {
  return `v${pkg.version}`
}

function ensureArray (val) {
  if (!Array.isArray(val)) {
    return val.replace(/ /g, '').split(',')
  }

  return val
}

function ensureZip (file) {
  if (path.extname(file) === '.zip') {
    return file
  } else {
    return file + '.zip'
  }
}

export function normalizeOptions (opts = {}) {
  if (!opts.app || !opts.token) return opts

  let pkg = loadPackageJson()

  if (!opts.repo) opts.repo = getRepo(pkg)
  if (!opts.tag) opts.tag = getTag(pkg)
  if (!opts.name) opts.name = opts.tag
  if (!opts.output) opts.output = opts.app

  opts.app = ensureArray(opts.app)
  opts.output = ensureArray(opts.output).map(file => {
    return ensureZip(file)
  })

  return opts
}

export function compress ({ app, output }) {
  if (app.length !== output.length) {
    return Promise.reject(new Error('Output length does not match app length'))
  }

  const cwd = process.cwd()

  const promises = app.map((src, index) => {
    const pathSrcFile = path.join(cwd, src)
    const pathDstFile = path.join(cwd, output[index])

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(pathDstFile)
      const archive = archiver('zip')

      output.on('close', resolve)
      archive.on('error', reject)
      archive.pipe(output)

      fs.lstat(pathSrcFile, (err, stats) => {
        const srcFilename = path.basename(pathSrcFile)
        if (stats.isDirectory()) {
          archive.directory(pathSrcFile, srcFilename)
        } else {
          archive.append(fs.createReadStream(pathSrcFile), { name: srcFilename })
        }
        archive.finalize()
      })
    })
  })

  return Promise.all(promises).catch((err) => {
    throw new Error('Unable to compress app. ' + err.stack)
  })
}

export function release ({ token, repo, tag, name, output, verbose }) {
  return publishReleaseAsync({ token, repo, tag, name, output, verbose })
  .then(({ assets_url }) => {
    return got(assets_url)
  }).then(res => {
    let jsonBody = JSON.parse(res.body)
    return jsonBody[0].browser_download_url
  }).catch((err) => {
    console.error(err)
    throw new Error('Unable to create a new release on GitHub.')
  })
}

export function updateUrl (releaseUrl) {
  return loadJsonFile('./auto_updater.json').then(content => {
    content.url = releaseUrl
    return writeJsonFile('./auto_updater.json', content)
  }).catch(function () {})
}

function publishReleaseAsync ({ token, repo, tag, name, output, verbose }) {
  return new Promise((resolve, reject) => {
    const publishRelease = new PublishRelease({
      token, tag, name,
      owner: repo.split('/')[0],
      repo: repo.split('/')[1],
      assets: output
    }, (err, release) => {
      if (err) return reject(err)
      resolve(release)
    })

    if (verbose) {
      publishRelease.on('upload-progress', render)
      publishRelease.on('uploaded-asset', () => log.clear())
    }
  })
}

function render (name, prog) {
  let pct = prog.percentage
  let speed = prettyBytes(prog.speed)
  let bar = Array(Math.floor(50 * pct / 100)).join('=') + '>'
  while (bar.length < 50) bar += ' '

  log([
    `\nUploading ${name}\n`,
    `[${bar}] ${pct.toFixed(1)}% (${speed}/s)\n`
  ].join(''))
}
