'use strict'

const cli = require('heroku-cli-util')
const co = require('co')
const merge = require('../util/merge')
const file = require('../util/file')
const _ = require('lodash')
const { shared: sharedFlags, pipelineFlagsAreValid, buildPullUrl } = require('../util/flags')

// eslint-disable-next-line generator-star-spacing, space-before-function-paren
function* patchConfig(context, heroku, payload, success, url) {
  try {
    yield heroku.patch(url, { body: payload })
    if (!context.flags.quiet) {
      cli.log(success)
    }
  } catch (err) {
    cli.exit(1, err)
  }
}

// eslint-disable-next-line generator-star-spacing, space-before-function-paren
function* push(context, heroku) {
  let fname = context.flags.file // this gets defaulted in read

  if (!pipelineFlagsAreValid(context.flags)){
    cli.exit(1, 'If you specify either `pipeline-name` or `pipeline-stage`, specify them both.')
  }

  const pullUrl = yield buildPullUrl(context, heroku, cli)

  let config = yield {
    remote: heroku.get(pullUrl),
    local: file.read(fname, context.flags)
  }

  let res = merge(config.local, config.remote, context.flags)
  yield patchConfig(
    context,
    heroku,
    res,
    'Successfully wrote settings to Heroku!',
    pullUrl
  )

  if (context.flags.clean) {
    // grab keys that weren't in local
    let keysToDelete = _.difference(
      Object.keys(config.remote),
      Object.keys(config.local)
    )
    let nullKeys = _.fromPairs(keysToDelete.map(k => [k, null]))

    yield patchConfig(
      context,
      heroku,
      nullKeys,
      'Successfully deleted unused settings from Heroku!',
      pullUrl
    )
  }
}

module.exports = (() => {
  let flags = [
    ...sharedFlags,
    {
      name: 'clean',
      char: 'c',
      description:
        'delete all destination vars that do not appear in local file'
    }
  ]

  return {
    topic: 'config',
    command: 'push',
    description: 'push env variables to heroku',
    help:
      'Write local config vars into heroku, favoring existing remote configs in case of collision',
    needsApp: true,
    needsAuth: true,
    run: cli.command(co.wrap(push)),
    flags
  }
})()
