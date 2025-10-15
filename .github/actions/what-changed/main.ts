#!/usr/bin/env node

import * as core from '@actions/core'
import * as exec from '@actions/exec'

const exclude = new Set(['@hono/bun-transpiler'])
const since = core.getInput('since')

const workspaces = await exec.getExecOutput('yarn workspaces list', [
  '--json',
  '--no-private',
  since ? `--since=${since}` : '--since',
])

const changed = []

for (const workspace of workspaces.stdout.split('\n')) {
  try {
    const { name } = JSON.parse(workspace)

    if (!exclude.has(name)) {
      changed.push(name.replace(/^@hono\//, ''))
    }
  } catch {
    // Ignore any parsing errors for empty lines or invalid JSON
  }
}

core.setOutput('packages', changed)
