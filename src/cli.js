#!/usr/bin/env node
import Promise from 'bluebird'
import chalk from 'chalk'
import meow from 'meow'
import {
  normalizeOptions,
  compress,
  release,
  updateUrl
} from './index'

const cli = meow({
  help: [
    'Usage',
    '  $ electron-release',
    'Options',
    '  --app  [Required] The path to the .app to compress and upload.',
    '  --token  [Required] Github token to be able to publish the relase.',
    '  --tag  The git tag connected to the release, needs to be semver. Defaults to version in package.json',
    '  --repo  The github repo in the following format: "username/reponame". Defaults to repository.url in package.json',
    '  --name  The name of the relase. Defaults to --tag',
    '  --output  The .zip output folder. Defaults to same folder as .app'
  ]
})

const opts = normalizeOptions(cli.flags)

if (!opts.tag || !opts.repo || !opts.app || !opts.token) {
  console.log('Missing required options.')
  process.exit()
}

Promise.resolve()
  .then(() => compress(opts))
  .then(() => release({ ...opts, verbose: true }))
  .then(url => updateUrl(url))
  .then(() => {
    console.log(chalk.green('Published new release to GitHub (' + opts.tag + ')'))
  })
  .catch(err => {
    console.log(chalk.red(err))
    process.exit()
  })
